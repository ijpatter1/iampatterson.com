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
#
# Env is never rewritten here: the live values are the contract.
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
    echo "✗ ${url}${HEALTH_PATH} -> $code on $2; roll back with:" >&2
    echo "  gcloud run services update-traffic $1 --project=$PROJECT --region=$REGION --to-revisions=$3=100" >&2
    return 1
  fi
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
    write_diff "$SERVICE" "$BEFORE" "$AFTER" "$DIFF_DIR/$AFTER.diff"; DIFF_RC=$?
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
  *) echo "usage: deploy-cloud-run.sh deploy <service> <src> [--promote] [--allow-drift] | diff <service> <a> <b> | promote <service> <revision>" >&2; exit 1;;
esac
