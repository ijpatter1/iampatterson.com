#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Deploy a Cloud Run service from source, no traffic first, diff, promote.
#
# event-stream and data-generator had no deploy path in the repo, and a
# bare `gcloud run deploy --source` that dropped an env var or a scaling
# annotation would take the live overlay down while /health still answered
# 200. This script deploys the new revision with no traffic, prints a diff
# of the new revision against the serving one (image, env, service account,
# scaling, resources, concurrency, timeout), and moves traffic only behind
# --promote. Env is never rewritten here: the live values are the contract.
#
# Usage:
#   scripts/deploy-cloud-run.sh <service> <source-dir>              # deploy no-traffic, diff, stop
#   scripts/deploy-cloud-run.sh <service> <source-dir> --promote    # ...then route traffic and check health
# Env: PROJECT (iampatterson), REGION (us-central1), HEALTH_PATH (/health)
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="${PROJECT:-iampatterson}"
REGION="${REGION:-us-central1}"
HEALTH_PATH="${HEALTH_PATH:-/health}"

SERVICE="${1:?service name}"
SRC="${2:?source directory}"
PROMOTE="${3:-}"
[ -d "$SRC" ] || { echo "❌ source dir not found: $SRC" >&2; exit 1; }
[ -z "$PROMOTE" ] || [ "$PROMOTE" = "--promote" ] || { echo "❌ third argument must be --promote or absent" >&2; exit 1; }

serving_revision() {
  gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format=json \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); t=[x for x in d["status"].get("traffic",[]) if x.get("percent")]; print(t[0]["revisionName"] if t else "")'
}

# The fields a redeploy must preserve, in a stable shape for diffing.
snapshot_revision() {
  gcloud run revisions describe "$1" --project="$PROJECT" --region="$REGION" --format=json \
    | python3 -c '
import json, sys
d = json.load(sys.stdin); s = d["spec"]; c = s["containers"][0]; a = d["metadata"].get("annotations", {})
env = {e["name"]: e.get("value", "<secret:" + e.get("valueFrom", {}).get("secretKeyRef", {}).get("name", "?") + ">") for e in c.get("env", [])}
out = {
  "image": c.get("image", "").split("@")[0].split(":")[-1] if "@" in c.get("image", "") else c.get("image", ""),
  "imageRef": c.get("image", ""),
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
changed = 0
for k in sorted(set(a) | set(b)):
    if k == "env":
        for ek in sorted(set(a["env"]) | set(b["env"])):
            if a["env"].get(ek) != b["env"].get(ek):
                changed += 1; print(f"  env.{ek}: {a['env'].get(ek)!r} -> {b['env'].get(ek)!r}")
    elif a.get(k) != b.get(k):
        changed += 1; print(f"  {k}: {a.get(k)!r} -> {b.get(k)!r}")
print(f"  ({changed} field(s) differ; the image ref is expected to)")
sys.exit(0)
PYEOF
}

echo "═══ $SERVICE: deploy from $SRC (no traffic) ═══"
BEFORE=$(serving_revision)
[ -n "$BEFORE" ] || { echo "❌ no serving revision found for $SERVICE" >&2; exit 1; }
echo "serving revision: $BEFORE"

gcloud run deploy "$SERVICE" --source "$SRC" --project="$PROJECT" --region="$REGION" --no-traffic --quiet
AFTER=$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.latestCreatedRevisionName)')
echo "new revision (no traffic): $AFTER"

TMP=$(mktemp -d)
snapshot_revision "$BEFORE" > "$TMP/before.json"
snapshot_revision "$AFTER" > "$TMP/after.json"
echo "═══ diff $BEFORE -> $AFTER ═══"
diff_revisions "$TMP/before.json" "$TMP/after.json"
rm -rf "$TMP"

if [ "$PROMOTE" != "--promote" ]; then
  echo ""
  echo "Stopped before traffic. Review the diff, then re-run with --promote (or route by hand):"
  echo "  gcloud run services update-traffic $SERVICE --project=$PROJECT --region=$REGION --to-latest"
  exit 0
fi

echo "═══ promote: all traffic to $AFTER ═══"
gcloud run services update-traffic "$SERVICE" --project="$PROJECT" --region="$REGION" --to-latest --quiet
URL=$(gcloud run services describe "$SERVICE" --project="$PROJECT" --region="$REGION" --format='value(status.url)')
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "${URL}${HEALTH_PATH}")
if [ "$code" = "200" ]; then
  echo "✓ ${URL}${HEALTH_PATH} -> 200 on $AFTER"
else
  echo "✗ ${URL}${HEALTH_PATH} -> $code on $AFTER; roll back with:" >&2
  echo "  gcloud run services update-traffic $SERVICE --project=$PROJECT --region=$REGION --to-revisions=$BEFORE=100" >&2
  exit 1
fi
