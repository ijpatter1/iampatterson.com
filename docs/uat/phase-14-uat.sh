#!/usr/bin/env bash
# Phase 14 — Declarative infrastructure — User Acceptance Test
#
# QA: NEEDS WORK — guv:reviewer found issues — 18 findings incl. 3 Critical on draft 1 — all Criticals and 6 of 7 Majors fixed in draft 2; draft 2 not itself vetted. See handoff Issues & Technical Debt.
#
# Phase 14 closes initiative 002 (Phases 12-14, operational readiness). Its
# thesis: a committed spec drifts from the live system when nothing compares the
# two, and a check that cannot fail hides the drift. Every scenario below is a
# comparison between something committed and something live — not a feature demo.
#
# This file is on its second draft. The first was vetted and came back NEEDS
# WORK with three Criticals, each the phase's own defect appearing in the
# artifact meant to certify it: a check greping for a word the tool never
# prints; six warehouse assertions that pass when `bq` fails; and
# `.protection_rules | length`, the exact defect removed from both workflows
# hours earlier. The helpers below exist because of those findings — read them
# before adding a check.
#
# Deliverables exercised:
#   [14.1] GTM container reconciler, census, consent parity
#   [14.2] Metabase load balancer retired from one-shots onto Terraform
#   [14.3] Reconcile workflow in CI behind WIF and an approval gate
#   [14.4] web_vital and page_engagement wiring
#   [14.5] Claudish proxy and identity layer adopted into Terraform
#   [14.6] The session warehouse fix — real visitors, and an assertion that can fail
#
# Usage:  bash docs/uat/phase-14-uat.sh
# Safe to re-run. Read-only against production throughout.
#
# Requires: gcloud (authenticated), bq, gh (authenticated), terraform, node 24,
#           npx, curl, python3.

set -uo pipefail

PATH="/opt/homebrew/opt/node@24/bin:/opt/homebrew/bin:$PATH"
export PATH
PROJECT=iampatterson
REPO=ijpatter1/iampatterson.com
GTM_ACCOUNT=6346433751
GTM_WEB_CONTAINER=247511905
CLAUDISH_PROXY=https://claudish-proxy-eb4xrwmo3q-uc.a.run.app
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 1

PASS=0; FAIL=0; SKIP=0
BROWSED=0

hdr()  { echo ""; echo "════════════════════════════════════════════════════════════"; echo " $1"; echo "════════════════════════════════════════════════════════════"; }
note() { echo "   … $1"; }

# Mechanical check. The command's OUTPUT is captured and shown on failure — the
# first draft redirected nearly every command to /dev/null, so an operator saw
# "✗ terraform plan reports no changes" and nothing more, not even
# "terraform: command not found".
verify() {
  local desc="$1"; shift
  local out
  if out=$("$@" 2>&1); then
    echo "  ✓ $desc"; PASS=$((PASS+1))
  else
    echo "  ✗ $desc"
    printf '%s\n' "$out" | head -5 | sed 's/^/      /'
    FAIL=$((FAIL+1))
  fi
}

# A scalar BigQuery query. Returns NONZERO when bq fails or returns nothing.
#
# This exists because of a Critical finding: `verify` runs its command through
# `bash -c`, which does NOT inherit `set -o pipefail` from line 33, and
# `awk '{exit !($1>0)}'` on empty input never enters the block and exits 0. Six
# warehouse assertions therefore reported PASS whenever bq failed — and this
# project's gcloud credentials expire roughly hourly, mid-run.
bq_scalar() {
  local out
  out=$(bq query --project_id="$PROJECT" --nouse_legacy_sql --format=csv "$1" 2>&1) || return 1
  out=$(printf '%s\n' "$out" | tail -1 | tr -d '[:space:]')
  [ -n "$out" ] || return 1
  printf '%s' "$out"
}

# Assert a scalar query satisfies a numeric comparison. Prints the value, so a
# pass is legible and a failure says what it actually got.
verify_num() {
  local desc="$1" sql="$2" op="$3" want="$4" got
  if ! got=$(bq_scalar "$sql"); then
    echo "  ✗ $desc"
    echo "      BigQuery returned nothing. Credentials expire roughly hourly —"
    echo "      re-run 'gcloud auth login' and try again."
    FAIL=$((FAIL+1)); return
  fi
  case "$got" in
    ''|*[!0-9.eE+-]*)
      echo "  ✗ $desc"; echo "      non-numeric result: '$got'"; FAIL=$((FAIL+1)); return ;;
  esac
  if awk -v g="$got" -v w="$want" "BEGIN{ exit !(g $op w) }"; then
    echo "  ✓ $desc  ($got)"; PASS=$((PASS+1))
  else
    echo "  ✗ $desc  (got $got, wanted $op $want)"; FAIL=$((FAIL+1))
  fi
}

# Human-judgment gate. SKIPS rather than auto-passing when nobody is there to
# answer — a `read` at EOF leaves $REPLY empty, the [Nn] test fails, and every
# gate would fall through to the pass branch.
confirm() {
  echo ""
  echo "  → $1"
  if [ ! -t 0 ] || [ -n "${GUV_NON_INTERACTIVE:-}" ] || [ -n "${CI:-}" ]; then
    echo "  ⊘ SKIPPED (non-interactive — no human to judge): $2"; SKIP=$((SKIP+1))
    return
  fi
  read -p "  Pass? [Y/n] " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "  ✗ $2"; FAIL=$((FAIL+1))
  else
    echo "  ✓ $2"; PASS=$((PASS+1))
  fi
}

skipped() { echo "  ⊘ SKIPPED: $1"; SKIP=$((SKIP+1)); }

# ─────────────────────────────────────────────────────────────────────────────
hdr "Prerequisites"
note "Every tool the scenarios use, not just the first three — a missing binary"
note "must fail here, loudly, rather than inside a check."

for tool in gcloud bq gh terraform node npx curl python3; do
  verify "$tool is on PATH" command -v "$tool"
done
verify "gcloud is authenticated" gcloud auth print-access-token
verify "gh is authenticated" gh auth status
verify "node is 24.x" bash -c 'node --version | grep -q "^v24"'

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Prerequisites failed. Fix these before running the scenarios — the checks"
  echo "below would otherwise report failures that are really missing tools."
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 1 — The committed spec still matches the live containers  [14.1]"
note "The phase's thesis. If this fails, something changed GTM outside the"
note "reconciler and the repo no longer describes production."

verify "web container: reconciler reports no drift" \
  bash -c 'node infrastructure/gtm/reconcile.js --container=web 2>&1 | grep -q "no drift"'
verify "server container: reconciler reports no drift" \
  bash -c 'node infrastructure/gtm/reconcile.js --container=server 2>&1 | grep -q "no drift"'

# The first draft grepped for "applying", a word the reconciler never prints on
# any path — so deleting the safety guard entirely left the check green. Below
# is the refusal string reconcile.js:91 actually emits, and the exit status is
# asserted too.
verify "a write REFUSES without an explicit --container" \
  bash -c 'out=$(node infrastructure/gtm/reconcile.js --apply 2>&1); rc=$?;
           [ "$rc" -ne 0 ] && printf "%s" "$out" | grep -q "refusing to act on a container you did not name"'

verify "the retired GTM one-shots are gone from the tree" \
  bash -c '[ ! -f infrastructure/gtm/deploy-phase6.js ] && [ ! -f infrastructure/gtm/deploy-claudish.js ]'

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 2 — Real visitor events reach the warehouse with a joinable key  [14.1, 14.4, 14.6]"
note "The defect [14.6] fixed: session_id is a reserved GA4 parameter name, so"
note "the GA4 client in sGTM consumed it and every real row landed with"
note "session_id NULL. iap_session_id exists precisely because GA4 won't remap it."

if [ -t 0 ] && [ -z "${GUV_NON_INTERACTIVE:-}" ] && [ -z "${CI:-}" ]; then
  note ""
  note "MANUAL STEP: open https://www.iampatterson.com/ in a browser, ACCEPT"
  note "analytics on the consent banner, click through two or three pages, then"
  note "return here. Events take up to a minute to land."
  read -p "  Press Enter once you have browsed the live site (or 's' to skip)… " -r
  [[ ! $REPLY =~ ^[Ss]$ ]] && BROWSED=1
fi

# Gated on the browse actually happening. The first draft ran this regardless,
# so "recent browser rows carry a populated iap_session_id" counted as a PASS
# with nobody having browsed.
if [ "$BROWSED" = "1" ]; then
  # Streaming rows carry a NULL _PARTITIONTIME until committed, so a partition
  # filter hides exactly the rows this is about.
  verify_num "your just-browsed rows carry a populated iap_session_id" \
    "SELECT COUNTIF(iap_session_id IS NOT NULL) FROM \`$PROJECT.iampatterson_raw.events_raw\`
     WHERE _PARTITIONTIME IS NULL AND user_agent NOT LIKE 'iampatterson-data-generator%'" \
    ">" 0
else
  skipped "your just-browsed rows carry a populated iap_session_id (site not browsed)"
fi

# Discriminated by ORIGIN, not by event name. iap_source is set on the site's own
# data-layer path and absent on GA4 enhanced-measurement events. A name filter
# would have been wrong: page_view occurs BOTH ways (measured 2026-09-09, 54
# site-authored and 25 auto-collected), so filtering by name discards the site's
# own page_views — and form_submit, the lead-gen conversion — from the very
# check that claims to protect them.
verify_num "no SITE-AUTHORED event lands without a session key" \
  "SELECT COUNTIF(iap_source = 'true' AND iap_session_id IS NULL)
   FROM \`$PROJECT.iampatterson_raw.events_raw\`
   WHERE user_agent NOT LIKE 'iampatterson-data-generator%'" \
  "==" 0

verify_num "site-authored real traffic exists, so the check above is not vacuous" \
  "SELECT COUNTIF(iap_source = 'true')
   FROM \`$PROJECT.iampatterson_raw.events_raw\`
   WHERE user_agent NOT LIKE 'iampatterson-data-generator%'" \
  ">" 0

# A bounded report of the KNOWN residue, not a demand for perfection. GA4's
# enhanced-measurement events (scroll, user_engagement, some SPA page_views) are
# auto-collected by the tag rather than pushed through the data layer, so they
# carry neither key and COALESCE has nothing to fall back on. Measured
# 2026-09-09: 742 real rows carry iap_session_id, 0 carry session_id, 252 carry
# neither. This fails only if the gap GROWS — a NEW unjoinable path, not this one.
verify_num "unjoinable real rows stay within the known enhanced-measurement residue" \
  "SELECT ROUND(SAFE_DIVIDE(COUNTIF(iap_session_id IS NULL AND session_id IS NULL), COUNT(*)), 4)
   FROM \`$PROJECT.iampatterson_raw.events_raw\`
   WHERE user_agent NOT LIKE 'iampatterson-data-generator%'" \
  "<" 0.35

verify_num "stg_sessions contains real (non-synthetic) sessions" \
  "SELECT COUNTIF(is_synthetic = FALSE) FROM \`$PROJECT.iampatterson_staging.stg_sessions\`" \
  ">" 0

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 3 — Declining consent actually stops collection  [14.1]"
note "This gate was claimed in the docs since Phase 1 and was not implemented"
note "until [14.1]. Container version 9 is the first that enforces it."
note ""
note "MANUAL STEP: open https://www.iampatterson.com/ in a PRIVATE window,"
note "DECLINE analytics, then open DevTools → Network and filter for 'collect'."

confirm "With analytics declined, are there NO requests to google-analytics.com/g/collect?" \
  "Consent gate blocks GA4 collection when analytics_storage is denied"

confirm "Does the under-the-hood overlay tell a declining visitor the truth about what was sent?" \
  "Overlay does not claim delivery for events the consent gate blocked"

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 4 — Web Vitals and engagement land WITH their payloads  [14.4]"
note "The defect was not missing rows: schema.json had never been applied to the"
note "live table, so the first page_engagement landed with every parameter null."
note "Counting rows would have passed on that."

verify_num "web_vital rows carry a populated metric value" \
  "SELECT COUNT(*) FROM \`$PROJECT.iampatterson_raw.events_raw\`
   WHERE event_name = 'web_vital' AND metric_value IS NOT NULL
     AND user_agent NOT LIKE 'iampatterson-data-generator%'
     AND TIMESTAMP_MILLIS(received_timestamp) > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)" \
  ">" 0

verify_num "page_engagement rows carry their PARAMETERS, not just a name" \
  "SELECT COUNT(*) FROM \`$PROJECT.iampatterson_raw.events_raw\`
   WHERE event_name = 'page_engagement'
     AND (engagement_seconds IS NOT NULL OR max_scroll_pct IS NOT NULL)
     AND user_agent NOT LIKE 'iampatterson-data-generator%'
     AND TIMESTAMP_MILLIS(received_timestamp) > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)" \
  ">" 0

confirm "On the under-the-hood overlay's Overview tab, does the web_vital coverage chip render?" \
  "[14.4]'s visitor-facing payoff is present on the overlay"

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 5 — Terraform owns the infrastructure it claims to own  [14.2, 14.5]"

verify "terraform plan reports no changes across the whole root" \
  bash -c 'GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token) \
    terraform -chdir=infrastructure/terraform plan -input=false -detailed-exitcode'

verify "the Metabase LB is in Terraform state, not merely in the project" \
  bash -c 'GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token) \
    terraform -chdir=infrastructure/terraform state list | grep -q metabase'

verify "the Claudish proxy is in Terraform state" \
  bash -c 'GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token) \
    terraform -chdir=infrastructure/terraform state list | grep -q claudish'

verify "the retired Metabase one-shots are gone from the tree" \
  bash -c '[ ! -f infrastructure/metabase/setup-domain.sh ] && [ ! -f infrastructure/metabase/setup-iap.sh ]'

# These suites live in tests/unit/infrastructure/ — a DIFFERENT directory from
# tests/unit/infra/. The first draft ran only the latter, so [14.2] and [14.5]
# rested on one plan and two greps while the pins their acceptance clauses name
# verbatim were never executed.
verify "the Terraform pins named in [14.2] and [14.5] acceptance are green" \
  npx jest tests/unit/infrastructure/

# [14.5]'s acceptance names the proxy answering. The /claudish page does not
# prove that — it renders whether or not the proxy is alive.
verify "the claudish-proxy service itself answers" \
  bash -c "code=\$(curl -s -o /dev/null -w '%{http_code}' $CLAUDISH_PROXY/health);
           [ \"\$code\" = '200' ] || [ \"\$code\" = '204' ] || { echo \"got HTTP \$code\"; exit 1; }"

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 6 — Every production apply is gated, and the gate is CHECKED  [14.3]"
note "A comment on infra-terraform.yml once asserted repo settings required"
note "approval. Measured 2026-09-08: no such environment existed, and GitHub"
note "creates a referenced-but-missing environment implicitly and unprotected."

# required_reviewers, NOT `.protection_rules | length`. GitHub returns three rule
# types; an environment carrying only a wait timer returns 1, so the count would
# report the gate healthy while an apply ran unreviewed. Same defect d500a8e
# removed from both workflows — it survived here, in the artifact that certifies
# them, until the vet caught it.
verify "infra-production carries a REQUIRED REVIEWER rule, not merely some rule" \
  bash -c "n=\$(gh api repos/$REPO/environments/infra-production \
                 --jq '[.protection_rules[] | select(.type==\"required_reviewers\")] | length');
           [ -n \"\$n\" ] && [ \"\$n\" -gt 0 ] || { echo \"required-reviewer rules: \${n:-none}\"; exit 1; }"

# Counts the workflows it examined and asserts 2. A loop that examines zero files
# exits 0, so "BOTH workflows" needs something that actually counts. Accepts the
# mapping form of `environment:` too, which is required to add a `url:`.
verify "exactly 2 workflows deploy to infra-production, and BOTH check it first" \
  bash -c 'n=0
    for f in .github/workflows/*.yml; do
      grep -qE "environment:[[:space:]]*infra-production|name:[[:space:]]*infra-production" "$f" || continue
      n=$((n+1))
      grep -q "required_reviewers" "$f" || { echo "no reviewer check in $f"; exit 1; }
      g=$(grep -n "refuse an unprotected environment" "$f" | head -1 | cut -d: -f1)
      a=$(grep -nE "name: (terraform apply|reconcile apply)" "$f" | head -1 | cut -d: -f1)
      [ -n "$g" ] && [ -n "$a" ] && [ "$g" -lt "$a" ] || { echo "guard not before apply in $f"; exit 1; }
    done
    [ "$n" -eq 2 ] || { echo "expected 2 deploying workflows, found $n"; exit 1; }'

verify "the workflow invariants are pinned by tests that have been seen red" \
  npx jest tests/unit/infra/workflow-injection.test.ts

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 7 — [14.3] end to end, as it actually happened  [14.3]"
note "The headline acceptance clause: a pull request shows the dry-run comment,"
note "and a merge shows the approval gate then a successful apply on each of the"
note "two workflows the variable arms. Static file checks cannot show this."

verify "both workflows have a successful apply run on main" \
  bash -c "for wf in infra-reconcile infra-terraform; do
             gh run list --repo $REPO --workflow \"\$wf.yml\" --branch main \
               --json conclusion --jq '.[].conclusion' \
               | grep -q success || { echo \"no successful main run for \$wf\"; exit 1; }
           done"

verify "those applies passed through the environment gate, not around it" \
  bash -c "gh api repos/$REPO/deployments --jq '.[].environment' \
             | grep -q infra-production || { echo 'no infra-production deployment recorded'; exit 1; }"

confirm "In the Actions UI, did the apply jobs wait for your approval rather than starting on their own?" \
  "The approval gate held on a real merge"

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 8 — EDGE: the assertion that could not fail, can now  [14.6]"
note "assert_stg_sessions asserted 'no null session_ids' against a table whose"
note "own WHERE clause had already removed every null. It reported green for"
note "months while the warehouse held zero real visitors."

verify "no assertion tests a null its source model already filters out" \
  npx jest tests/unit/dataform/

# The grep the first draft used passed on any one of three occurrences, one of
# which is a docstring. The suite above pins all the resolution sites; this
# asserts the count rather than mere presence.
verify "the staging model resolves iap_session_id at every keyed site" \
  bash -c 'n=$(grep -c "COALESCE(iap_session_id, session_id)" \
                 infrastructure/dataform/definitions/staging/stg_events.sqlx);
           [ "$n" -ge 3 ] || { echo "only $n resolution site(s) found"; exit 1; }'

# [14.6]'s own tracker entry records that the marts carry the fix only after the
# sync action mirrors main to the `dataform` branch. That mirror is the one
# committed-vs-live comparison nothing else in the repo makes.
verify "the dataform branch mirror is in sync with main's model" \
  bash -c 'git fetch -q origin dataform main
    a=$(git show origin/main:infrastructure/dataform/definitions/staging/stg_events.sqlx | shasum | cut -d" " -f1)
    b=$(git show origin/dataform:definitions/staging/stg_events.sqlx | shasum | cut -d" " -f1)
    [ -n "$a" ] && [ "$a" = "$b" ] || { echo "mirror differs (main $a vs dataform $b) — the sync action may not have run"; exit 1; }'

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 9 — EDGE: the rollback path a person would take at 3am  [14.3]"
note "From docs/runbook/infra-apply-damaged-production.md. READS the version"
note "list; publishing stays the operator's call."

verify "the GTM version history is reachable with a read-only token" \
  bash -c "TOKEN=\$(CLOUDSDK_CORE_PROJECT=$PROJECT gcloud auth print-access-token \
      --impersonate-service-account=gtm-reconciler@$PROJECT.iam.gserviceaccount.com \
      --scopes=https://www.googleapis.com/auth/tagmanager.readonly)
    curl -sf -H \"Authorization: Bearer \$TOKEN\" \
      'https://tagmanager.googleapis.com/tagmanager/v2/accounts/$GTM_ACCOUNT/containers/$GTM_WEB_CONTAINER/version_headers' \
      | grep -q containerVersionHeader"

verify "the live version is NAMED, so a rollback target is identifiable" \
  bash -c "TOKEN=\$(CLOUDSDK_CORE_PROJECT=$PROJECT gcloud auth print-access-token \
      --impersonate-service-account=gtm-reconciler@$PROJECT.iam.gserviceaccount.com \
      --scopes=https://www.googleapis.com/auth/tagmanager.readonly)
    curl -sf -H \"Authorization: Bearer \$TOKEN\" \
      'https://tagmanager.googleapis.com/tagmanager/v2/accounts/$GTM_ACCOUNT/containers/$GTM_WEB_CONTAINER/versions:live' \
      | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get(\"name\") else 1)'"

confirm "Does docs/runbook/infra-apply-damaged-production.md give you enough to roll back at 3am without asking anyone?" \
  "Rollback runbook is actionable standalone"

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 10 — EDGE: the surfaces are still up  [12.x carry-forward, 14.2, 14.5]"

verify "the site answers 200" \
  bash -c '[ "$(curl -s -o /dev/null -w %{http_code} https://www.iampatterson.com/)" = "200" ]'
verify "/claudish answers 200" \
  bash -c '[ "$(curl -s -o /dev/null -w %{http_code} https://www.iampatterson.com/claudish)" = "200" ]'
verify "sGTM is healthy" \
  bash -c '[ "$(curl -s -o /dev/null -w %{http_code} https://io.iampatterson.com/healthy)" = "200" ]'

# Any 302 would satisfy a bare status check, including a redirect pointing
# anywhere at all. The destination is the property that matters.
verify "Metabase redirects to Google SSO specifically (the IAP gate)" \
  bash -c 'url=$(curl -s -o /dev/null -w "%{redirect_url}" https://bi.iampatterson.com/);
           case "$url" in https://accounts.google.com/*) : ;;
             *) echo "redirects to: ${url:-<nothing>}"; exit 1 ;; esac'

# ─────────────────────────────────────────────────────────────────────────────
hdr "Scenario 11 — EDGE: the string that stops any repo minting a token  [14.3]"
note "The WIF provider's attribute condition is the single control preventing"
note "any GitHub repository on earth from assuming infra-deployer — an identity"
note "the record itself calls close to roles/editor. It is declared in no .tf and"
note "no script, so until this check nothing compared it to live."

EXPECTED_CONDITION="assertion.repository == '$REPO'"

# EXACT equality, not a substring. A substring match passes on
#   assertion.repository == '…' || assertion.repository_owner == 'someone'
# and disjunction is precisely how this control gets loosened in practice.
verify "the live attribute condition EXACTLY equals the committed expectation" \
  bash -c "actual=\$(gcloud iam workload-identity-pools providers describe github \
      --project=$PROJECT --location=global --workload-identity-pool=github \
      --format='value(attributeCondition)');
    [ \"\$actual\" = \"$EXPECTED_CONDITION\" ] || { echo \"live:     \$actual\"; echo \"expected: $EXPECTED_CONDITION\"; exit 1; }"

# Matches the FULL principalSet including the pool, so a binding minted through a
# different, unconditioned pool cannot satisfy a check that names this one.
verify "the deployer is bound only through the github pool, scoped to this repo" \
  bash -c "gcloud iam service-accounts get-iam-policy \
      infra-deployer@$PROJECT.iam.gserviceaccount.com --project=$PROJECT --format=json \
    | python3 -c \"
import json,sys
p=json.load(sys.stdin)
want='/workloadIdentityPools/github/attribute.repository/$REPO'
ms=[m for b in p.get('bindings',[]) if b['role']=='roles/iam.workloadIdentityUser' for m in b.get('members',[])]
if not ms:
    print('no workloadIdentityUser binding'); sys.exit(1)
bad=[m for m in ms if want not in m]
if bad:
    print('binding outside the scoped pool:', bad); sys.exit(1)
\""

# An equivalent route to minting a token for the same account, which the binding
# check above does not cover.
# An equivalent route to minting a token for the same account. The owner's own
# user account holding it is expected — that is how Ian impersonates the deployer
# from a workstation. Any OTHER member is a second, unreviewed path to a
# near-roles/editor identity, which is what this is looking for.
verify "no unexpected principal can mint a token for the deployer" \
  bash -c "gcloud iam service-accounts get-iam-policy \
      infra-deployer@$PROJECT.iam.gserviceaccount.com --project=$PROJECT --format=json \
    | python3 -c \"
import json,sys
p=json.load(sys.stdin)
allowed={'user:Ian@tunameltsmyheart.com'}
ms=[m for b in p.get('bindings',[]) if b['role']=='roles/iam.serviceAccountTokenCreator' for m in b.get('members',[])]
bad=[m for m in ms if m not in allowed]
if bad:
    print('unexpected tokenCreator member(s):', bad); sys.exit(1)
\"" 

# ─────────────────────────────────────────────────────────────────────────────
hdr "Results"
TOTAL=$((PASS+FAIL+SKIP))
echo ""
echo "  $PASS passed, $FAIL failed, $SKIP skipped  (of $TOTAL)"
echo ""
if [ "$FAIL" -gt 0 ]; then
  echo "  VERDICT: FAIL — Phase 14 is not accepted. Address the failures above."
  exit 1
elif [ "$SKIP" -gt 0 ]; then
  echo "  VERDICT: INCOMPLETE — $SKIP check(s) went unanswered or unrun."
  echo "  The judgment is owed, not waived. Re-run interactively to close them."
  exit 2
else
  echo "  VERDICT: PASS — Phase 14 accepted, and with it initiative 002."
  exit 0
fi
