#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# sGTM container image lifecycle (Phase 13, 13.2).
#
# The decision this script implements: pin the digest, update deliberately.
#
# `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` looks like an
# auto-updating tag and is not one. Cloud Run resolves a tag to a digest when
# the revision is created and the revision holds that digest forever, so a
# service whose spec says `:stable` runs whatever `:stable` meant on the day it
# was last deployed. Measured on 2026-09-05: both sgtm and sgtm-preview were
# deployed 2026-04-03 on sha256:0f47d392…, while `:stable` had moved on to
# sha256:688d35c6…. Five months of container updates had not arrived, and
# nothing in the configuration said so.
#
# So the tag is the worst of both worlds — an unpinned declaration over a
# silently pinned runtime. This script makes the pin explicit and the update an
# act someone performs and reviews.
#
#   update-image.sh [--dry-run] status              what each service runs vs what :stable resolves to
#   update-image.sh [--dry-run] update <service>    move one service to the current :stable digest
#
# `update <service>` takes sgtm-preview or sgtm. Preview first, always: it
# serves no production traffic, and its health is the evidence that the new
# image works before sgtm follows.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT=iampatterson
REGION=us-central1
IMAGE=gcr.io/cloud-tagging-10302018/gtm-cloud-image
TAG=stable
SERVICES=(sgtm-preview sgtm)

DRY=0; CMD=""; ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    status|update)
      [ -z "$CMD" ] || { echo "❌ two commands given: $CMD and $1" >&2; exit 1; }; CMD="$1" ;;
    *)
      if [ "$CMD" = "update" ] && [ -z "$ARG" ]; then ARG="$1"; else
        echo "❌ unrecognized argument: $1" >&2
        echo "usage: update-image.sh [--dry-run] status | update <sgtm-preview|sgtm>" >&2; exit 1
      fi ;;
  esac
  shift
done
CMD="${CMD:-status}"

command -v gcloud >/dev/null || { echo "❌ gcloud not on PATH" >&2; exit 1; }

# The digest `:stable` points at today.
resolve_tag() {
  gcloud container images describe "$IMAGE:$TAG" --format='value(image_summary.digest)' 2>/dev/null
}

# The digest a service is actually serving, read from its live revision rather
# than from its spec — the spec is what lies here.
running_digest() {
  local rev
  rev="$(gcloud run services describe "$1" --project="$PROJECT" --region="$REGION" \
         --format='value(status.latestReadyRevisionName)' 2>/dev/null)"
  [ -n "$rev" ] || { echo ""; return; }
  gcloud run revisions describe "$rev" --project="$PROJECT" --region="$REGION" \
    --format='value(status.imageDigest)' 2>/dev/null | sed 's/.*@//'
}

deployed_at() {
  local rev
  rev="$(gcloud run services describe "$1" --project="$PROJECT" --region="$REGION" \
         --format='value(status.latestReadyRevisionName)' 2>/dev/null)"
  [ -n "$rev" ] || { echo "unknown"; return; }
  gcloud run revisions describe "$rev" --project="$PROJECT" --region="$REGION" \
    --format='value(metadata.creationTimestamp)' 2>/dev/null | cut -dT -f1
}

health_url() {
  local url
  url="$(gcloud run services describe "$1" --project="$PROJECT" --region="$REGION" \
         --format='value(status.url)' 2>/dev/null)"
  echo "${url}/healthy"
}

check_health() {
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$(health_url "$1")" || echo 000)"
  echo "$code"
}

cmd_status() {
  local want; want="$(resolve_tag)"
  echo "  :$TAG resolves to  $want"
  echo
  printf '  %-16s %-24s %-14s %s\n' SERVICE RUNNING DEPLOYED STATE
  local s run
  for s in "${SERVICES[@]}"; do
    run="$(running_digest "$s")"
    local state="current"
    [ "$run" = "$want" ] || state="BEHIND"
    printf '  %-16s %-24s %-14s %s\n' "$s" "${run:0:23}" "$(deployed_at "$s")" "$state"
  done
}

cmd_update() {
  local svc="$1" want run
  case " ${SERVICES[*]} " in *" $svc "*) ;; *)
    echo "❌ unknown service: $svc (expected one of: ${SERVICES[*]})" >&2; exit 1 ;;
  esac
  want="$(resolve_tag)"
  run="$(running_digest "$svc")"
  [ -n "$want" ] || { echo "❌ could not resolve $IMAGE:$TAG" >&2; exit 1; }

  echo "  service   $svc"
  echo "  running   ${run:-none}"
  echo "  target    $want"
  if [ "$run" = "$want" ]; then
    echo "  ok        already on the current $TAG digest; nothing to do"
    return 0
  fi

  local before; before="$(check_health "$svc")"
  echo "  health    $before (before)"

  if [ "$DRY" = "1" ]; then
    echo "  [dry-run] would deploy $IMAGE@$want to $svc and re-check health"
    return 0
  fi

  gcloud run deploy "$svc" --project="$PROJECT" --region="$REGION" \
    --image="$IMAGE@$want" --quiet >/dev/null
  echo "  deployed  $IMAGE@$want"

  local after; after="$(check_health "$svc")"
  echo "  health    $after (after)"
  if [ "$after" != "200" ]; then
    echo "  ❌ $svc did not return 200 after the update. Roll back with:" >&2
    echo "     gcloud run deploy $svc --project=$PROJECT --region=$REGION --image=$IMAGE@$run" >&2
    exit 2
  fi
  echo "  ✅ $svc healthy on the new digest"
}

case "$CMD" in
  status) cmd_status ;;
  update)
    [ -n "$ARG" ] || { echo "❌ update needs a service name (${SERVICES[*]})" >&2; exit 1; }
    cmd_update "$ARG" ;;
esac
