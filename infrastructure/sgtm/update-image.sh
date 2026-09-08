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

# The revision actually receiving traffic. NOT latestReadyRevisionName: when a
# service has traffic pinned to a revision — which deploy-cloud-run.sh promote
# does by design — the newest ready revision is not the one visitors hit, and a
# tool that reads it reports a stale service as current. That is the trap this
# whole script exists to detect, so reading the wrong field would have made it
# blind to its own subject.
serving_revision() {
  gcloud run services describe "$1" --project="$PROJECT" --region="$REGION" \
    --format='value(status.traffic[0].revisionName)' 2>/dev/null
}

# The digest the serving revision runs. Empty means the question could not be
# answered — expired credentials, a missing service — and callers must treat
# that as a failure rather than as "no digest", because an empty string compares
# equal to another empty string and every service would report `current`.
running_digest() {
  local rev
  rev="$(serving_revision "$1")"
  [ -n "$rev" ] || { echo ""; return; }
  gcloud run revisions describe "$rev" --project="$PROJECT" --region="$REGION" \
    --format='value(status.imageDigest)' 2>/dev/null | sed 's/.*@//'
}

deployed_at() {
  local rev
  rev="$(serving_revision "$1")"
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
  # Without this guard an expired credential makes every lookup return empty,
  # empty compares equal to empty, and the report reads all-current — a false
  # all-clear from the one command the monthly cadence relies on. Credentials
  # expire hourly on this project, so this is the common case, not the edge.
  [ -n "$want" ] || { echo "❌ could not resolve $IMAGE:$TAG — check credentials (see docs/runbook/expired-gcloud-credentials.md)" >&2; exit 1; }
  echo "  :$TAG resolves to  $want"
  echo
  printf '  %-16s %-24s %-14s %s\n' SERVICE RUNNING DEPLOYED STATE
  local s run state rc=0
  for s in "${SERVICES[@]}"; do
    run="$(running_digest "$s")"
    if [ -z "$run" ]; then
      state="UNKNOWN"; rc=1
    elif [ "$run" = "$want" ]; then
      state="current"
    else
      state="BEHIND"
    fi
    printf '  %-16s %-24s %-14s %s\n' "$s" "${run:0:23}" "$(deployed_at "$s")" "$state"
  done
  [ "$rc" = "0" ] || echo "  ❌ at least one service could not be read; UNKNOWN is not current" >&2
  return $rc
}

cmd_update() {
  local svc="$1" want run
  case " ${SERVICES[*]} " in *" $svc "*) ;; *)
    echo "❌ unknown service: $svc (expected one of: ${SERVICES[*]})" >&2; exit 1 ;;
  esac
  want="$(resolve_tag)"
  run="$(running_digest "$svc")"
  [ -n "$want" ] || { echo "❌ could not resolve $IMAGE:$TAG" >&2; exit 1; }
  # `run` is the digest the rollback hint hands the operator mid-incident. An
  # empty one produces `--image=…@`, which is unusable at exactly the moment it
  # is needed, so refuse to start rather than deploy without a way back.
  [ -n "$run" ] || { echo "❌ could not read what $svc is currently serving; refusing to deploy without a rollback target" >&2; exit 1; }

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

  # Health alone cannot confirm this worked. `gcloud run deploy` creates a
  # revision but does not move traffic on a service with traffic pinned to one,
  # and the health endpoint answers from whatever is serving — so the OLD
  # revision returns 200 and the update reads as a success while nothing
  # changed. Ask what is actually serving instead. This is the same trap that
  # bit data-generator on 2026-09-05.
  local now; now="$(running_digest "$svc")"
  local after; after="$(check_health "$svc")"
  echo "  serving   ${now:-unreadable}"
  echo "  health    $after (after)"

  if [ "$now" != "$want" ]; then
    echo "  ❌ $svc is still serving ${now:-an unreadable revision}, not the digest just deployed." >&2
    echo "     The revision was created but traffic did not move — this service has traffic pinned." >&2
    echo "     Route it deliberately, then re-check:" >&2
    echo "       gcloud run services update-traffic $svc --project=$PROJECT --region=$REGION --to-latest" >&2
    exit 2
  fi
  if [ "$after" != "200" ]; then
    echo "  ❌ $svc did not return 200 after the update. Roll back with:" >&2
    echo "     gcloud run deploy $svc --project=$PROJECT --region=$REGION --image=$IMAGE@$run" >&2
    exit 2
  fi
  echo "  ✅ $svc serving the new digest and healthy"
}

case "$CMD" in
  status) cmd_status ;;
  update)
    [ -n "$ARG" ] || { echo "❌ update needs a service name (${SERVICES[*]})" >&2; exit 1; }
    cmd_update "$ARG" ;;
esac
