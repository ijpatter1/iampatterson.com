#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Deploy a Cloud Run service from source: no-traffic revision, diff, promote.
#
# event-stream and data-generator had no deploy path in the repo, and a
# bare `gcloud run deploy --source` that dropped an env var or a scaling
# annotation would take the live overlay down while /health still answered
# 200. Three subcommands keep the reviewed revision and the promoted
# revision the same one:
#
#   deploy  <service> <source-dir> [--promote] [--allow-drift]
#           builds a no-traffic revision, writes its diff against the serving
#           revision to docs/verification/deploys/<revision>.diff,
#           and stops. With --promote it routes traffic to THAT revision only
#           when nothing but the image digest differs (--allow-drift overrides).
#   diff    <service> <revision-a> <revision-b>
#           the same field diff for any two revisions (records after the fact).
#   promote <service> <revision>
#           routes all traffic to a revision already built, then checks health
#           (identity token when the service is private).
#   set-env <service> KEY=VALUE [KEY=VALUE...] [--promote] [--allow-drift]
#           an env change that reaches traffic: builds a no-traffic revision on
#           the SERVING revision's image digest with only those keys changed,
#           diffs it (anything else that moved is drift), and with --promote
#           routes traffic to that exact revision and confirms it serves the values.
#   kill-switch <service> on|off [--allow-drift]
#           set-env KILL_SWITCH=on|off --promote, for incidents.
#
# Why set-env exists (2026-11-15): promote pins traffic to a named revision, so
# a bare `gcloud run services update --update-env-vars` afterwards creates a
# revision that serves 0% and the change never takes effect. Routing to LATEST
# is no fix: LATEST can be an unpromoted `deploy` revision nobody reviewed.
#
# deploy never writes env: the live values are the contract. Only set-env does,
# and only the keys it is given. Env lives on each revision, so promoting an
# older revision restores that revision's env (KILL_SWITCH included).
# Env: PROJECT (iampatterson), REGION (us-central1), HEALTH_PATH (/health), DIFF_DIR
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
DIFF_DIR="${DIFF_DIR:-docs/verification/deploys}"

CMD="${1:?deploy | diff | promote}"; shift

serving_revision() {
  gcloud run services describe "$1" --project="$PROJECT" --region="$REGION" --format=json \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); t=[x for x in d["status"].get("traffic",[]) if x.get("percent")]; print(t[0]["revisionName"] if t else "")'
}

# The fields a redeploy must preserve, in a stable shape for diffing.
snapshot_revision() {
  gcloud run revisions describe "$1" --project="$PROJECT" --region="$REGION" --format=json \
    | python3 -c '
import json, sys
d = json.load(sys.stdin); s = d["spec"]; c = s["containers"][0]; a = d["metadata"].get("annotations", {})
env = {e["name"]: e.get("value", "<secret:%s/%s@%s>" % (e.get("valueFrom", {}).get("secretKeyRef", {}).get("name", "?"), e.get("valueFrom", {}).get("secretKeyRef", {}).get("key", "?"), e.get("valueFrom", {}).get("secretKeyRef", {}).get("version", "?"))) for e in c.get("env", [])}
ref = c.get("image", "")
out = {
  "imagePath": ref.split("@")[0],
  "imageDigest": ref.split("@")[1] if "@" in ref else "",
  "serviceAccount": s.get("serviceAccountName"),
  "minScale": a.get("autoscaling.knative.dev/minScale"),
  "maxScale": a.get("autoscaling.knative.dev/maxScale"),
  "concurrency": s.get("containerConcurrency"),
  "timeoutSeconds": s.get("timeoutSeconds"),
  "cpu": c.get("resources", {}).get("limits", {}).get("cpu"),
  "memory": c.get("resources", {}).get("limits", {}).get("memory"),
  "executionEnvironment": a.get("run.googleapis.com/execution-environment"),
  "env": env,
}
print(json.dumps(out, indent=2, sort_keys=True))'
}

diff_revisions() {
  python3 - "$1" "$2" <<'PYEOF'
import json, sys
a, b = (json.load(open(p)) for p in sys.argv[1:3])
# A new digest is what a redeploy is for; everything else must match.
print(f"  image digest: {a.get('imageDigest', '')[:19]}… -> {b.get('imageDigest', '')[:19]}…")
changed = 0
for k in sorted((set(a) | set(b)) - {"imageDigest"}):
    if k == "env":
        for ek in sorted(set(a["env"]) | set(b["env"])):
            if a["env"].get(ek) != b["env"].get(ek):
                changed += 1; print(f"  env.{ek}: {a['env'].get(ek)!r} -> {b['env'].get(ek)!r}")
    elif a.get(k) != b.get(k):
        changed += 1; print(f"  {k}: {a.get(k)!r} -> {b.get(k)!r}")
print(f"  {changed} field(s) differ besides the digest" + ("" if changed == 0 else " — review before promoting"))
PYEOF
}

# Print the diff and return 0 when only the digest changed, 1 otherwise.
# Returns 0 only when both snapshots succeeded, the diff ran, and nothing but
# the digest differs. A failed snapshot (expired credential, missing revision)
# is a failure, never "no drift" (review finding, 2026-09-04).
write_diff() { # write_diff <service> <before> <after> <out-file>
  local tmp; tmp=$(mktemp -d)
  if ! snapshot_revision "$2" > "$tmp/before.json" || ! snapshot_revision "$3" > "$tmp/after.json"; then
    echo "❌ could not snapshot $2 or $3 (credential expired? revision gone?)" | tee "$4" >&2; rm -rf "$tmp"; return 2
  fi
  {
    echo "# $1: $2 -> $3 ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
    diff_revisions "$tmp/before.json" "$tmp/after.json" || echo "  diff failed"
  } | tee "$4"
  rm -rf "$tmp"
  grep -qE "^ *0 field\(s\) differ besides the digest$" "$4"
}

health_check() { # health_check <service> <revision-for-the-message> <before-revision>
  local url code via
  url=$(gcloud run services describe "$1" --project="$PROJECT" --region="$REGION" --format='value(status.url)')
  # A private service (no allUsers invoker) answers 403 to an anonymous probe; retry with the caller's identity token.
  # `|| true`: a hung container trips curl's --max-time (exit 28) and set -e must not kill
  # the script before the roll-back line prints.
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${url}${HEALTH_PATH}" || true); via="anonymous"
  if [ "$code" = "403" ] || [ "$code" = "401" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 -H "Authorization: Bearer $(gcloud auth print-identity-token 2>/dev/null || true)" "${url}${HEALTH_PATH}" || true); via="identity token"
  fi
  if [ "$code" = "200" ]; then
    echo "✓ ${url}${HEALTH_PATH} -> 200 on $2 ($via)"
  else
    if [ "${4:-}" = "no-rollback-hint" ]; then
      echo "✗ ${url}${HEALTH_PATH} -> $code on $2" >&2
    else
      echo "✗ ${url}${HEALTH_PATH} -> $code on $2; roll back with:" >&2
      echo "  gcloud run services update-traffic $1 --project=$PROJECT --region=$REGION --to-revisions=$3=100" >&2
    fi
    return 1
  fi
}


# Like diff_revisions, but for an env change on the same image: the digest
# must NOT move, and the only env keys that may change are the requested ones,
# to the requested values. Prints the diff; exit 0 only on exactly that.
diff_env_change() { # diff_env_change <before.json> <after.json> KEY=VALUE...
  python3 - "$@" <<'PYEOF'
import json, sys
a, b = (json.load(open(p)) for p in sys.argv[1:3])
want = dict(kv.split("=", 1) for kv in sys.argv[3:])
bad = 0
if a.get("imageDigest") != b.get("imageDigest"):
    bad += 1; print(f"  image digest moved: {a.get('imageDigest', '')[:19]}… -> {b.get('imageDigest', '')[:19]}… (unexpected)")
else:
    print(f"  image digest: {a.get('imageDigest', '')[:19]}… (unchanged, as expected)")
for k in sorted((set(a) | set(b)) - {"imageDigest", "env"}):
    if a.get(k) != b.get(k):
        bad += 1; print(f"  {k}: {a.get(k)!r} -> {b.get(k)!r} (unexpected)")
for ek in sorted(set(a["env"]) | set(b["env"]) | set(want)):
    before, after = a["env"].get(ek), b["env"].get(ek)
    if ek in want:
        ok = after == want[ek]
        if before != after or not ok:
            print(f"  env.{ek}: {before!r} -> {after!r}" + ("" if ok else f" (expected {want[ek]!r})"))
        if not ok: bad += 1
    elif before != after:
        bad += 1; print(f"  env.{ek}: {before!r} -> {after!r} (unexpected)")
print(f"  {bad} unexpected change(s)" + ("" if bad == 0 else " — review before promoting"))
# A moved digest means the revision is not the one this run built on the
# serving image: never something --allow-drift may wave through.
sys.exit(2 if a.get("imageDigest") != b.get("imageDigest") else 0 if bad == 0 else 1)
PYEOF
}

set_env() { # set_env <service> <promote 0|1> <allow-drift 0|1> KEY=VALUE...
  local svc="$1" promote="$2" allow="$3"; shift 3
  [ "$#" -gt 0 ] || { echo "❌ set-env needs at least one KEY=VALUE" >&2; exit 1; }
  local kv
  for kv in "$@"; do
    case "$kv" in *=*) ;; *) echo "❌ not KEY=VALUE: $kv" >&2; exit 1;; esac
    case "$kv" in *@*) echo "❌ '@' is the env delimiter here and cannot appear in a value: $kv" >&2; exit 1;; esac
  done
  local before image after tmp suffix flags rc=0 hc=0
  before=$(serving_revision "$svc" 2>/dev/null || true)
  [ -n "$before" ] || { echo "❌ no serving revision found for $svc (are the gcloud credentials valid?)" >&2; exit 1; }
  image=$(gcloud run revisions describe "$before" --project="$PROJECT" --region="$REGION" --format='value(spec.containers[0].image)')
  case "$image" in *@sha256:*) ;; *) echo "❌ serving revision $before has no pinned image digest ($image); not building on it" >&2; exit 1;; esac
  tmp=$(mktemp -d)
  # `gcloud run deploy` merges env into the service TEMPLATE, which after a
  # rollback (or any unpromoted revision) differs from what serves. Rebase the
  # template's plain env onto the serving revision's, then apply the request:
  # the new revision's env is the serving env plus exactly these keys. Secret
  # references are left alone and show up in the diff if they differ.
  if ! gcloud run services describe "$svc" --project="$PROJECT" --region="$REGION" --format=json > "$tmp/service.json" \
     || ! gcloud run revisions describe "$before" --project="$PROJECT" --region="$REGION" --format=json > "$tmp/serving.json"; then
    rm -rf "$tmp"; echo "❌ could not read the service or $before; nothing changed" >&2; exit 1
  fi
  flags=$(python3 - "$tmp/service.json" "$tmp/serving.json" "$@" <<'PYEOF'
import json, sys
plain = lambda c: {e["name"]: e["value"] for e in c.get("env", []) if "value" in e}
tmpl = plain(json.load(open(sys.argv[1]))["spec"]["template"]["spec"]["containers"][0])
serving = plain(json.load(open(sys.argv[2]))["spec"]["containers"][0])
want = dict(kv.split("=", 1) for kv in sys.argv[3:])
target = {**serving, **want}
update = {k: v for k, v in target.items() if tmpl.get(k) != v}
remove = [k for k in tmpl if k not in target]
if any("@" in v for v in update.values()):
    sys.exit("an env value on the serving revision contains '@'; set it by hand")
print("--update-env-vars=^@^" + "@".join(f"{k}={v}" for k, v in update.items()) if update else "")
if remove: print("--remove-env-vars=" + ",".join(remove))
PYEOF
  ) || { rm -rf "$tmp"; echo "❌ could not compute the env change; nothing changed" >&2; exit 1; }
  # A fixed suffix names the revision up front: latestCreatedRevisionName can
  # name someone else's revision, or an old one if nothing new was created.
  suffix="env-$(date -u +%m%d%H%M%S)"; after="$svc-$suffix"
  echo "═══ $svc: set $* on the serving image (no traffic); serving revision $before ═══"
  # --image pins the code to what serves now: the template may hold a newer,
  # unpromoted build, and an env change must not ship it.
  local args=()
  while IFS= read -r line; do [ -n "$line" ] && args+=("$line"); done <<< "$flags"
  gcloud run deploy "$svc" --image "$image" --project="$PROJECT" --region="$REGION" \
    --revision-suffix="$suffix" ${args[@]+"${args[@]}"} --no-traffic --quiet
  echo "new revision (no traffic): $after"
  mkdir -p "$DIFF_DIR"
  if ! snapshot_revision "$before" > "$tmp/before.json" || ! snapshot_revision "$after" > "$tmp/after.json"; then
    echo "❌ could not snapshot $before or $after; not promoting. Investigate, then promote by hand:" >&2
    echo "  scripts/deploy-cloud-run.sh promote $svc $after" >&2; rm -rf "$tmp"; exit 2
  fi
  { echo "# $svc: $before -> $after, set $* ($(date -u +%Y-%m-%dT%H:%M:%SZ))"; diff_env_change "$tmp/before.json" "$tmp/after.json" "$@"; } \
    | tee "$DIFF_DIR/$after.diff" || rc=$?
  echo "diff written: $DIFF_DIR/$after.diff"
  if [ "$promote" != "1" ]; then
    rm -rf "$tmp"; echo ""; echo "Stopped before traffic. Promote this exact revision with:"; echo "  scripts/deploy-cloud-run.sh promote $svc $after"; exit 0
  fi
  if [ "$rc" = "2" ]; then
    rm -rf "$tmp"
    echo "❌ the new revision does not run the serving image; not promoting, and --allow-drift does not apply. Run the command again." >&2; exit 2
  fi
  if [ "$rc" != "0" ] && [ "$allow" != "1" ]; then
    rm -rf "$tmp"
    echo "❌ more changed than the requested env; not promoting. Review the diff, then re-run with --allow-drift or promote by hand:" >&2
    echo "  scripts/deploy-cloud-run.sh promote $svc $after" >&2; exit 2
  fi
  echo "═══ promote: all traffic to $after ═══"
  gcloud run services update-traffic "$svc" --project="$PROJECT" --region="$REGION" --to-revisions="$after=100" --quiet
  # A failed probe must not stop the check of what serves, and must not
  # suggest routing back to $before: for the kill switch that undoes it.
  health_check "$svc" "$after" "$before" no-rollback-hint || hc=$?
  # Confirm what now serves, by name and by value: the check the bare
  # `services update` kill switch never had.
  local now; now=$(serving_revision "$svc" 2>/dev/null || true)
  if [ "$now" != "$after" ] || ! snapshot_revision "$now" > "$tmp/now.json" \
     || ! python3 -c 'import json,sys; e=json.load(open(sys.argv[1]))["env"]; sys.exit(0 if all(e.get(k)==v for k,v in (x.split("=",1) for x in sys.argv[2:])) else 1)' "$tmp/now.json" "$@"; then
    rm -rf "$tmp"; echo "✗ serving revision is ${now:-unknown}, not $after carrying $*; check traffic by hand" >&2; exit 3
  fi
  rm -rf "$tmp"
  echo "✓ $now serves 100% with $*"
  if [ "$hc" != "0" ]; then
    echo "⚠ but its health probe failed. It IS serving with the new env; do not route back to $before unless you mean to undo the change." >&2
    exit 4
  fi
  echo "  To undo: scripts/deploy-cloud-run.sh set-env $svc <KEY=previous value> --promote (promoting $before also restores ALL of its env)"
}

case "$CMD" in
  diff)
    SERVICE="${1:?service}"; A="${2:?revision a}"; B="${3:?revision b}"
    mkdir -p "$DIFF_DIR"; write_diff "$SERVICE" "$A" "$B" "$DIFF_DIR/$B.diff" || true
    ;;
  promote)
    SERVICE="${1:?service}"; REV="${2:?revision}"
    BEFORE=$(serving_revision "$SERVICE" 2>/dev/null || true)
    [ -n "$BEFORE" ] || { echo "❌ no serving revision found for $SERVICE" >&2; exit 1; }
    echo "═══ promote $SERVICE: all traffic to $REV (from $BEFORE) ═══"
    gcloud run services update-traffic "$SERVICE" --project="$PROJECT" --region="$REGION" --to-revisions="$REV=100" --quiet
    health_check "$SERVICE" "$REV" "$BEFORE"
    ;;
  deploy)
    SERVICE="${1:?service}"; SRC="${2:?source directory}"; shift 2
    PROMOTE=0; ALLOW_DRIFT=0
    for flag in "$@"; do case "$flag" in --promote) PROMOTE=1;; --allow-drift) ALLOW_DRIFT=1;; *) echo "❌ unknown flag $flag" >&2; exit 1;; esac; done
    [ -d "$SRC" ] || { echo "❌ source dir not found: $SRC" >&2; exit 1; }
    BEFORE=$(serving_revision "$SERVICE" 2>/dev/null || true)
    [ -n "$BEFORE" ] || { echo "❌ no serving revision found for $SERVICE (does the service exist? are the gcloud credentials valid?)" >&2; exit 1; }
    echo "═══ $SERVICE: deploy from $SRC (no traffic); serving revision $BEFORE ═══"
    gcloud run deploy "$SERVICE" --source "$SRC" --project="$PROJECT" --region="$REGION" --no-traffic --quiet
    AFTER=$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.latestCreatedRevisionName)')
    echo "new revision (no traffic): $AFTER"
    mkdir -p "$DIFF_DIR"
    # Errexit is on, so write_diff has to run in a context that tolerates a
    # nonzero return; `write_diff …; DIFF_RC=$?` aborts the script before the
    # gates below and was itself a review finding (2026-09-04). Seed DIFF_RC
    # first: set -u makes an unset variable fatal on the clean path.
    DIFF_RC=0; write_diff "$SERVICE" "$BEFORE" "$AFTER" "$DIFF_DIR/$AFTER.diff" || DIFF_RC=$?
    echo "diff written: $DIFF_DIR/$AFTER.diff"
    if [ "$PROMOTE" != "1" ]; then
      echo ""; echo "Stopped before traffic. Promote this exact revision with:"; echo "  scripts/deploy-cloud-run.sh promote $SERVICE $AFTER"; exit 0
    fi
    # write_diff returns 2 when a snapshot failed, which is not the same thing
    # as drift: there is no diff to review, so --allow-drift has nothing to
    # override and must not carry the promotion (review finding, 2026-09-04).
    if [ "$DIFF_RC" = "2" ]; then
      echo "❌ the drift snapshot failed, so no diff was recorded and --allow-drift does not apply; not promoting. Investigate, then promote by hand:" >&2
      echo "  scripts/deploy-cloud-run.sh promote $SERVICE $AFTER" >&2; exit 2
    fi
    if [ "$DIFF_RC" != "0" ] && [ "$ALLOW_DRIFT" != "1" ]; then
      echo "❌ fields other than the image digest differ; not promoting. Re-run with --allow-drift after reviewing, or promote by hand:" >&2
      echo "  scripts/deploy-cloud-run.sh promote $SERVICE $AFTER" >&2; exit 2
    fi
    echo "═══ promote: all traffic to $AFTER ═══"
    gcloud run services update-traffic "$SERVICE" --project="$PROJECT" --region="$REGION" --to-revisions="$AFTER=100" --quiet
    health_check "$SERVICE" "$AFTER" "$BEFORE"
    ;;
  set-env)
    SERVICE="${1:?service}"; shift
    PROMOTE=0; ALLOW_DRIFT=0; PAIRS=()
    for a in "$@"; do case "$a" in --promote) PROMOTE=1;; --allow-drift) ALLOW_DRIFT=1;; -*) echo "❌ unknown flag $a" >&2; exit 1;; *) PAIRS+=("$a");; esac; done
    set_env "$SERVICE" "$PROMOTE" "$ALLOW_DRIFT" ${PAIRS[@]+"${PAIRS[@]}"}
    ;;
  kill-switch)
    SERVICE="${1:?service}"; KS="${2:?on|off}"; ALLOW_DRIFT=0
    case "$KS" in on|off) ;; *) echo "❌ kill-switch takes on or off, not $KS" >&2; exit 1;; esac
    shift 2
    for a in "$@"; do case "$a" in --allow-drift) ALLOW_DRIFT=1;; *) echo "❌ kill-switch takes only --allow-drift, not $a" >&2; exit 1;; esac; done
    set_env "$SERVICE" 1 "$ALLOW_DRIFT" "KILL_SWITCH=$KS"
    ;;
  *) echo "usage: deploy-cloud-run.sh deploy <service> <src> [--promote] [--allow-drift] | diff <service> <a> <b> | promote <service> <revision> | set-env <service> KEY=VALUE... [--promote] [--allow-drift] | kill-switch <service> on|off [--allow-drift]" >&2; exit 1;;
esac
