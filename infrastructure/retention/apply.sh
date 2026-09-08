#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Retention and cost controls as committed configuration (Phase 13, 13.1).
#
# Reads spec/retention.json and reconciles BigQuery partition expiration,
# GCS lifecycle rules and the project budget's notification channels against
# project iampatterson. The `_Default` log bucket's retention is owned by
# infrastructure/monitoring/apply.sh (12.3) and is only read here, so one
# value has one writer.
#
#   apply.sh [--dry-run] measure   read-only: what is live, printed as a table
#   apply.sh [--dry-run] apply     plan (change / unchanged), then apply unless --dry-run
#   apply.sh verify                measure and write the record to docs/verification/
#
# --dry-run is honoured in any position. Nothing here deletes data: the GCS
# rules are lifecycle configuration, applied to the two build-artifact buckets
# the spec names and never to the Terraform state bucket.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT=iampatterson
BILLING_ACCOUNT=01FFAB-2D440A-4D16D8
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPEC="$ROOT/infrastructure/retention/spec/retention.json"

DRY=0; CMD=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    measure|apply|verify)
      [ -z "$CMD" ] || { echo "❌ two commands given: $CMD and $1" >&2; exit 1; }; CMD="$1" ;;
    *) echo "❌ unrecognized argument: $1" >&2
       echo "usage: apply.sh [--dry-run] measure | apply | verify" >&2; exit 1 ;;
  esac
  shift
done
CMD="${CMD:-measure}"

command -v bq >/dev/null || { echo "❌ bq not on PATH" >&2; exit 1; }
command -v gcloud >/dev/null || { echo "❌ gcloud not on PATH" >&2; exit 1; }
[ -f "$SPEC" ] || { echo "❌ spec not found at $SPEC" >&2; exit 1; }

py() { python3 -c "$@"; }

# ── measurement ────────────────────────────────────────────────────────
measure_bq_options() {
  bq --project_id="$PROJECT" query --nouse_legacy_sql --format=csv --quiet \
    "SELECT table_schema, table_name, option_value AS partition_expiration_days
     FROM \`$PROJECT.iampatterson_raw.INFORMATION_SCHEMA.TABLE_OPTIONS\`
     WHERE option_name = 'partition_expiration_days'
     UNION ALL SELECT table_schema, table_name, option_value
     FROM \`$PROJECT.iampatterson_staging.INFORMATION_SCHEMA.TABLE_OPTIONS\`
     WHERE option_name = 'partition_expiration_days'
     UNION ALL SELECT table_schema, table_name, option_value
     FROM \`$PROJECT.iampatterson_marts.INFORMATION_SCHEMA.TABLE_OPTIONS\`
     WHERE option_name = 'partition_expiration_days'
     ORDER BY 1,2" 2>/dev/null | tail -n +2
}

measure_bq_sizes() {
  bq --project_id="$PROJECT" query --nouse_legacy_sql --format=csv --quiet \
    "SELECT * FROM (
       SELECT 'iampatterson_raw' ds, table_id, ROUND(size_bytes/1048576,2) mib, row_count FROM \`$PROJECT.iampatterson_raw.__TABLES__\`
       UNION ALL SELECT 'iampatterson_staging', table_id, ROUND(size_bytes/1048576,2), row_count FROM \`$PROJECT.iampatterson_staging.__TABLES__\`
       UNION ALL SELECT 'iampatterson_marts', table_id, ROUND(size_bytes/1048576,2), row_count FROM \`$PROJECT.iampatterson_marts.__TABLES__\`
       UNION ALL SELECT 'iampatterson_assertions', table_id, ROUND(size_bytes/1048576,2), row_count FROM \`$PROJECT.iampatterson_assertions.__TABLES__\`
     ) ORDER BY mib DESC" 2>/dev/null | tail -n +2
}

# Prints "<bucket>\t<rule summary>\t<versioning>" for every bucket in the project.
measure_gcs() {
  local b
  for b in $(gcloud storage buckets list --project="$PROJECT" --format='value(name)' 2>/dev/null); do
    local json rules ver
    json="$(gcloud storage buckets describe "gs://$b" --project="$PROJECT" --format=json 2>/dev/null || echo '{}')"
    rules="$(printf '%s' "$json" | py "
import json,sys
d=json.loads(sys.stdin.read() or '{}')
lc=(d.get('lifecycle_config') or d.get('lifecycle') or {})
rs=lc.get('rule') or []
print('; '.join('%s after %sd' % (r.get('action',{}).get('type','?'), r.get('condition',{}).get('age','?')) for r in rs) or 'none')
" <<<"$json")"
    ver="$(printf '%s' "$json" | py "
import json,sys
d=json.loads(sys.stdin.read() or '{}')
v=d.get('versioning_enabled')
if v is None: v=(d.get('versioning') or {}).get('enabled')
print('on' if v else 'off')
" <<<"$json")"
    printf '%s\t%s\t%s\n' "$b" "$rules" "$ver"
  done
}

measure_log_retention() {
  gcloud logging buckets describe _Default --location=global --project="$PROJECT" \
    --format='value(retentionDays)' 2>/dev/null
}

# Prints "<displayName>\t<amount>\t<channel count>" for budgets that name this project.
measure_budgets() {
  gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" --format=json 2>/dev/null \
  | py "
import json,sys
for b in json.load(sys.stdin):
    ch=(b.get('notificationsRule') or {}).get('monitoringNotificationChannels') or []
    print('%s\t%s\t%d' % (b.get('displayName'), (b.get('amount',{}).get('specifiedAmount',{}) or {}).get('units','?'), len(ch)))
"
}

measure_dataform() {
  local tok
  tok="$(gcloud auth print-access-token 2>/dev/null)" || true
  # An expired credential yields an empty token, `local var=$(...)` hides the
  # failure from set -e, and the API then returns 401 whose JSON has no
  # workflowConfigs key — printing an empty section indistinguishable from a
  # project with no Dataform schedule. Same silent-all-clear shape as the
  # update-image.sh finding; fail loudly instead.
  if [ -z "$tok" ]; then
    echo "  ❌ no access token — cannot read the Dataform schedule (see docs/runbook/expired-gcloud-credentials.md)" >&2
    return 1
  fi
  curl -s -H "Authorization: Bearer $tok" \
    "https://dataform.googleapis.com/v1/projects/$PROJECT/locations/us-central1/repositories/iampatterson-dataform/workflowConfigs" \
  | py "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('UNREADABLE\tthe Dataform API returned no JSON\t-'); raise SystemExit
if 'error' in d:
    e=d['error']
    print('UNREADABLE\t%s %s\t-' % (e.get('code'), (e.get('status') or '')[:40])); raise SystemExit
ws=d.get('workflowConfigs',[])
if not ws:
    print('NONE\tno workflow configs exist in this repository\t-')
for w in ws:
    print('%s\t%s\t%s' % (w['name'].split('/')[-1], w.get('cronSchedule','-'), w.get('timeZone','-')))
"
}

print_measurement() {
  # Returns nonzero if ANY measurement failed or came back empty. Each one is
  # captured first and checked, because a failing command in a pipeline prints
  # nothing while the awk that formats it still emits its END block — so a
  # section can look present and complete while carrying no data at all. That
  # is how the first version of the verify guard passed a substantively empty
  # record (review finding, 2026-09-08).
  local rc=0 out

  echo "── BigQuery partition expiration ─────────────────────────────"
  if out="$(measure_bq_options)" && [ -n "$out" ]; then
    printf '%s\n' "$out" | awk -F, '{printf "  %-24s %-26s %s days\n", $1, $2, $3}'
  else
    echo "  ❌ could not read partition expiration"; rc=1
  fi
  echo
  echo "── BigQuery storage ──────────────────────────────────────────"
  if out="$(measure_bq_sizes)" && [ -n "$out" ]; then
    printf '%s\n' "$out" | awk -F, '{printf "  %-24s %-28s %8s MiB  %10s rows\n", $1, $2, $3, $4}'
    printf '%s\n' "$out" | awk -F, '{s+=$3} END {printf "  %-24s %-28s %8.2f MiB  (10 GiB is free)\n", "TOTAL", "", s}'
  else
    echo "  ❌ could not read table sizes"; rc=1
  fi
  echo
  echo "── GCS lifecycle ─────────────────────────────────────────────"
  if out="$(measure_gcs)" && [ -n "$out" ]; then
    printf '%s\n' "$out" | awk -F'\t' '{printf "  %-42s rules: %-22s versioning: %s\n", $1, $2, $3}'
  else
    echo "  ❌ could not read bucket lifecycle"; rc=1
  fi
  echo
  echo "── Cloud Logging ─────────────────────────────────────────────"
  if out="$(measure_log_retention)" && [ -n "$out" ]; then
    printf '  %-42s %s days (owned by monitoring/apply.sh)\n' "_Default" "$out"
  else
    echo "  ❌ could not read _Default retention"; rc=1
  fi
  echo
  echo "── Budgets ───────────────────────────────────────────────────"
  if out="$(measure_budgets)" && [ -n "$out" ]; then
    printf '%s\n' "$out" | awk -F'\t' '{printf "  %-42s $%-8s %s notification channel(s)\n", $1, $2, $3}'
  else
    echo "  ❌ could not read budgets"; rc=1
  fi
  echo
  echo "── Dataform schedule ─────────────────────────────────────────"
  if out="$(measure_dataform)" && [ -n "$out" ]; then
    printf '%s\n' "$out" | awk -F'\t' '{printf "  %-42s cron: %-14s %s\n", $1, $2, $3}'
  else
    echo "  ❌ could not read the Dataform schedule"; rc=1
  fi
  return $rc
}

# ── reconciliation ─────────────────────────────────────────────────────
channel_id() {
  gcloud beta monitoring channels list --project="$PROJECT" \
    --filter="displayName='$1'" --format='value(name)' 2>/dev/null | head -1
}

apply_gcs() {
  local rc=0
  while IFS=$'\t' read -r bucket age action; do
    [ -n "$bucket" ] || continue
    # Read once. An empty body means the bucket could not be read — expired
    # credentials, a deleted bucket, a missing permission — which is NOT the same
    # as a bucket with no rules. Treating the two alike would report fabricated
    # drift on a dry run and overwrite a lifecycle configuration that was never
    # actually inspected.
    local body
    body="$(gcloud storage buckets describe "gs://$bucket" --project="$PROJECT" --format=json 2>/dev/null || true)"
    if [ -z "$body" ]; then
      echo "  ❌ UNREADABLE gs://$bucket — not changing a bucket whose current state could not be read" >&2
      rc=1
      continue
    fi
    # Compare the rule itself, not how many there are. A bucket carrying
    # `Delete after 3650d` where the spec says 90 has exactly one rule, and a
    # count-only check calls that ok forever.
    local state
    state="$(printf '%s' "$body" | py "
import json,sys
d=json.loads(sys.stdin.read() or '{}')
rs=((d.get('lifecycle_config') or d.get('lifecycle') or {}).get('rule')) or []
want_a, want_age = '$action', $age
for r in rs:
    a=(r.get('action') or {}).get('type')
    g=(r.get('condition') or {}).get('age')
    if a==want_a and g==want_age:
        print('match'); break
else:
    print('drift:%d' % len(rs))
")"
    if [ "$state" = "match" ]; then
      echo "  ok      gs://$bucket carries $action after ${age}d"
      continue
    fi
    local existing="${state#drift:}"
    if [ "$existing" = "0" ]; then
      echo "  CHANGE  gs://$bucket → $action after ${age}d (no rule today)"
    else
      echo "  CHANGE  gs://$bucket → $action after ${age}d ($existing existing rule(s) disagree with the spec)"
    fi
    if [ "$DRY" = "0" ]; then
      local tmp; tmp="$(mktemp)"
      printf '{"rule":[{"action":{"type":"%s"},"condition":{"age":%s}}]}\n' "$action" "$age" > "$tmp"
      gcloud storage buckets update "gs://$bucket" --project="$PROJECT" --lifecycle-file="$tmp" >/dev/null
      rm -f "$tmp"
    fi
  done < <(py "
import json
s=json.load(open('$SPEC'))
for b in s['gcs']['buckets']:
    if b.get('ageDays') and b.get('action'):
        print('%s\t%s\t%s' % (b['name'], b['ageDays'], b['action']))
")
  return $rc
}

apply_budget_channels() {
  local name want have
  name="$(py "import json;print(json.load(open('$SPEC'))['budgets'][0]['displayName'])")"
  want="$(py "import json;print(' '.join(json.load(open('$SPEC'))['budgets'][0]['channels']))")"
  # Resolve every channel BEFORE sending anything. channel_id returns empty when
  # the display name matches nothing, and appending that blindly produced either
  # an empty list — which CLEARS the budget's channels, silently un-fixing the
  # thing this deliverable exists to fix, while printing that it succeeded — or a
  # malformed ",id" when only some resolved.
  local ids="" c cid
  for c in $want; do
    cid="$(channel_id "$c")"
    if [ -z "$cid" ]; then
      echo "  ❌ notification channel '$c' not found in project $PROJECT; refusing to update the budget" >&2
      echo "     (sending an empty channel list would clear the budget's notifications)" >&2
      return 1
    fi
    ids="${ids:+$ids,}$cid"
  done
  local budget_id
  budget_id="$(gcloud billing budgets list --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" --format=json 2>/dev/null \
    | py "
import json,sys
for b in json.load(sys.stdin):
    if b.get('displayName')=='$name': print(b['name'].split('/')[-1]); break
")"
  [ -n "$budget_id" ] || { echo "  ⚠️  budget '$name' not found; skipping"; return 0; }
  # Compare which channels, not how many. A budget wired to a stale or wrong
  # channel has a nonzero count and would otherwise pass clean forever.
  have="$(gcloud billing budgets describe "$budget_id" --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" --format=json 2>/dev/null \
    | py "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print('UNREADABLE'); raise SystemExit
print(','.join(sorted((d.get('notificationsRule') or {}).get('monitoringNotificationChannels') or [])) or 'NONE')
")"
  if [ "$have" = "UNREADABLE" ] || [ -z "$have" ]; then
    echo "  ❌ could not read budget '$name'; not changing it" >&2
    return 1
  fi
  local want_sorted; want_sorted="$(printf '%s' "$ids" | tr ',' '\n' | sort | paste -sd, -)"
  if [ "$have" = "$want_sorted" ]; then
    echo "  ok      budget '$name' notifies exactly $want"
    return 0
  fi
  if [ "$have" = "NONE" ]; then
    echo "  CHANGE  budget '$name' → $want (no channels today)"
  else
    echo "  CHANGE  budget '$name' → $want (currently notifies different channels)"
  fi
  if [ "$DRY" = "0" ]; then
    gcloud billing budgets update "$budget_id" --billing-account="$BILLING_ACCOUNT" --billing-project="$PROJECT" \
      --notifications-rule-monitoring-notification-channels="$ids" >/dev/null
  fi
  return 0
}

case "$CMD" in
  measure) print_measurement ;;
  apply)
    [ "$DRY" = "1" ] && echo "── DRY RUN: nothing will be changed ──" || true
    echo "── GCS lifecycle ─────────────────────────────────────────────"
    apply_gcs || true
    echo
    echo "── Budget notification channels ──────────────────────────────"
    apply_budget_channels || true
    echo
    echo "── BigQuery partition expiration ─────────────────────────────"
    # Raw already carries the spec's value; staging and marts deliberately carry
    # none (they are rebuilt from raw). Reported, never silently changed: a
    # partition expiry that drops data is not something a script should apply
    # as a side effect of running.
    py "
import json,subprocess
s=json.load(open('$SPEC'))
for d in s['bigquery']['datasets']:
    want=d['partitionExpirationDays']
    print('  spec    %-26s %s' % (d['dataset'], ('%s days' % want) if want else 'no expiration'))
"
    echo "  (values are confirmed by measure; changing one is a deliberate edit, not an apply)"
    ;;
  verify)
    OUT="$ROOT/docs/verification/$(date -u +%Y-%m-%d)-retention-measured.md"
    # Build in a temp file and move only on success. Under `set -e` a failed bq
    # or gcloud call inside print_measurement aborts mid-table with the
    # redirection already open, leaving a half-written record that reads as a
    # complete measurement — the worst possible artifact from a verification step.
    TMP="$(mktemp)"
    # Do NOT trust the exit status of the brace group below. It reports its LAST
    # command — the closing fence — not print_measurement, and `set -e` is
    # suppressed inside an `if` condition and in functions called from one. An
    # earlier version of this guard wrapped the group in `if`, which made the
    # false branch dead code and published the truncated record it was written to
    # prevent. Found by review, 2026-09-08; the same shape as the Phase 12
    # errexit regression.
    #
    # So check the artifact rather than the mechanism: a complete record contains
    # every section, and that cannot be faked by a shell subtlety.
    RC=0
    { echo "# Retention and cost controls, measured"; echo
      echo "Generated by \`infrastructure/retention/apply.sh verify\` on $(date -u +%Y-%m-%dT%H:%M:%SZ)."; echo
      echo '```'; print_measurement || RC=$?; echo '```'; } > "$TMP"

    # Two independent checks. RC is print_measurement's own verdict — meaningful
    # now that each measurement is captured and tested. The marker sweep is the
    # backstop: a record missing a section header is incomplete however it got
    # that way. Note the failure text itself, because a section can be present
    # and carry only an error line.
    MISSING=""
    for SECTION in "BigQuery partition expiration" "BigQuery storage" "GCS lifecycle" \
                   "Cloud Logging" "Budgets" "Dataform schedule"; do
      grep -qF "$SECTION" "$TMP" || MISSING="$MISSING '$SECTION'"
    done
    grep -q "❌ could not read" "$TMP" && RC=1

    if [ -n "$MISSING" ] || [ "$RC" != "0" ]; then
      rm -f "$TMP"
      echo "❌ measurement incomplete — no record written, the previous one is untouched" >&2
      [ -n "$MISSING" ] && echo "   missing sections:$MISSING" >&2
      echo "   if credentials expired, see docs/runbook/expired-gcloud-credentials.md" >&2
      exit 1
    fi
    mv "$TMP" "$OUT"
    echo "written: $OUT"
    ;;
esac
