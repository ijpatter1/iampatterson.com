#!/usr/bin/env bash
#
# Phase 9B deliverable 6a — idempotent upsert driver for Metabase
# dashboards-as-code. Authors define questions and dashboards in YAML
# under ./specs/; this script reconciles the live Metabase instance at
# $METABASE_URL to match them.
#
# Flow:
#   1. Fetch admin API key from Secret Manager ($PROJECT / metabase-api-key).
#   2. Resolve the BigQuery database ID by name in Metabase.
#   3. Ensure the collection exists.
#   4. Upsert each specs/questions/*.yaml → POST or PUT /api/card.
#   5. Upsert specs/dashboards/*.yaml → POST or PUT /api/dashboard,
#      then PUT /api/dashboard/{id} with the dashcards grid.
#   6. Enable signed embedding on questions flagged enable_embedding:true
#      and on the dashboard.
#   7. Write .ids.json locally. With --publish-embed-config, also push to
#      the metabase-embed-config secret for deliverable 6b to consume.
#
# Idempotent. Safe to re-run. Cards and dashboards are identified by
# name within the collection; a rename in the spec produces a new asset
# and leaves the old one behind (rare; manual cleanup if needed).
#
# Prerequisites:
#   - Phase 9B-infra Task 5 (setup-domain.sh) has been re-run with the
#     step-8 URL-map split applied. /api/* bypasses IAP on bi.iampatterson.com.
#   - Secret metabase-api-key exists in Secret Manager — admin-scoped
#     API key generated in Metabase UI under Admin → Authentication →
#     API Keys, assigned to the Admin group.
#   - BigQuery data source "iampatterson marts" already connected in
#     Metabase (done in Phase 9B-infra Task 7).
#   - Local tools: yq (mikefarah/yq v4+), jq, curl, gcloud.
#
# Usage:
#   ./apply.sh                          # reconcile
#   ./apply.sh --dry-run                # print actions; no API writes
#   ./apply.sh --publish-embed-config   # also push IDs to Secret Manager

set -euo pipefail

# -----------------------------------------------------------------------------
# Config (all overridable via env)
# -----------------------------------------------------------------------------
PROJECT="${PROJECT:-iampatterson}"
METABASE_URL="${METABASE_URL:-https://bi.iampatterson.com}"
API_KEY_SECRET="${API_KEY_SECRET:-metabase-api-key}"
EMBED_CONFIG_SECRET="${EMBED_CONFIG_SECRET:-metabase-embed-config}"
DB_NAME="${DB_NAME:-iampatterson marts}"
COLLECTION_NAME="${COLLECTION_NAME:-E-Commerce Dashboards}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPECS_DIR="${SPECS_DIR:-${SCRIPT_DIR}/specs}"
IDS_FILE="${IDS_FILE:-${SCRIPT_DIR}/.ids.json}"

export METABASE_URL

DRY_RUN=false
PUBLISH_EMBED_CONFIG=false
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=true ;;
    --publish-embed-config) PUBLISH_EMBED_CONFIG=true ;;
    -h|--help)
      sed -n '1,/^set -euo pipefail/p' "$0" | sed 's/^# \{0,1\}//' | grep -v '^!'
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument '${arg}'. Run with --help." >&2
      exit 1
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Preflight
# -----------------------------------------------------------------------------
for tool in yq jq curl gcloud; do
  command -v "${tool}" >/dev/null 2>&1 || {
    echo "ERROR: '${tool}' not found in PATH. Install before running." >&2
    exit 1
  }
done

echo "==> Fetching API key from Secret Manager (${API_KEY_SECRET})..."
MB_API_KEY="$(gcloud secrets versions access latest \
  --secret="${API_KEY_SECRET}" --project="${PROJECT}")"
export MB_API_KEY
trap 'unset MB_API_KEY' EXIT
[[ -n "${MB_API_KEY}" ]] || { echo "ERROR: empty API key from secret" >&2; exit 1; }

# shellcheck source=lib/metabase_client.sh
source "${SCRIPT_DIR}/lib/metabase_client.sh"

echo "==> Pinging Metabase at ${METABASE_URL}..."
mb_ping

# -----------------------------------------------------------------------------
# Resolve BigQuery database ID
# -----------------------------------------------------------------------------
echo "==> Resolving BigQuery database (name: '${DB_NAME}')..."
DB_RESPONSE="$(mb_get "/api/database")"
# Metabase returns either {data: [...]} or a bare array depending on version.
DB_ID="$(jq -r --arg n "${DB_NAME}" '
  (.data // .) | map(select(.name == $n)) | .[0].id // empty
' <<<"${DB_RESPONSE}")"
[[ -n "${DB_ID}" ]] || {
  echo "ERROR: database '${DB_NAME}' not found in Metabase." >&2
  echo "Available databases:" >&2
  jq -r '(.data // .)[] | "  - \(.name) (id=\(.id))"' <<<"${DB_RESPONSE}" >&2
  exit 1
}
echo "Database ID: ${DB_ID}"

# -----------------------------------------------------------------------------
# Resolve or create collection
# -----------------------------------------------------------------------------
echo "==> Ensuring collection '${COLLECTION_NAME}' exists..."
COLLECTION_ID="$(mb_get "/api/collection" | jq -r --arg n "${COLLECTION_NAME}" '
  map(select(.name == $n and (.archived // false) == false)) | .[0].id // empty
')"
if [[ -z "${COLLECTION_ID}" ]]; then
  echo "  Not found — creating."
  if ${DRY_RUN}; then
    COLLECTION_ID="dry-run-collection-id"
    echo "  [dry-run] would POST /api/collection"
  else
    COLLECTION_ID="$(mb_post "/api/collection" \
      "$(jq -n --arg n "${COLLECTION_NAME}" '{name: $n, color: "#509EE3"}')" \
      | jq -r '.id')"
  fi
fi
echo "Collection ID: ${COLLECTION_ID}"

# -----------------------------------------------------------------------------
# Upsert questions
#
# CARD_IDS_JSON accumulates {name: id} as we process each spec. Used later
# to resolve dashboard card references and to write .ids.json.
# -----------------------------------------------------------------------------
CARD_IDS_JSON='{}'

save_card_id() {
  local name="$1" id="$2"
  CARD_IDS_JSON="$(jq --arg n "${name}" --argjson id "${id}" \
    '. + {($n): $id}' <<<"${CARD_IDS_JSON}")"
}

echo "==> Fetching existing cards in collection..."
if ${DRY_RUN} && [[ "${COLLECTION_ID}" == "dry-run-collection-id" ]]; then
  EXISTING_CARDS='{"data":[]}'
else
  EXISTING_CARDS="$(mb_get "/api/collection/${COLLECTION_ID}/items?models=card")"
fi

echo "==> Upserting questions from ${SPECS_DIR}/questions/..."
shopt -s nullglob
question_specs=("${SPECS_DIR}"/questions/*.yaml)
shopt -u nullglob

[[ ${#question_specs[@]} -gt 0 ]] || {
  echo "ERROR: no question specs found in ${SPECS_DIR}/questions/" >&2
  exit 1
}

for spec in "${question_specs[@]}"; do
  name="$(yq -r '.name' "${spec}")"
  description="$(yq -r '.description // ""' "${spec}")"
  display="$(yq -r '.display' "${spec}")"
  query="$(yq -r '.query' "${spec}")"
  viz_settings="$(yq -o=json '.visualization_settings // {}' "${spec}")"
  enable_embedding="$(yq -r '.enable_embedding // false' "${spec}")"

  existing_id="$(jq -r --arg n "${name}" '
    .data | map(select(.name == $n)) | .[0].id // empty
  ' <<<"${EXISTING_CARDS}")"

  payload="$(jq -n \
    --arg name "${name}" \
    --arg desc "${description}" \
    --arg disp "${display}" \
    --arg q "${query}" \
    --argjson db "${DB_ID}" \
    --argjson coll "${COLLECTION_ID}" \
    --argjson viz "${viz_settings}" \
    '{
      name: $name,
      description: ($desc | if . == "" then null else . end),
      display: $disp,
      collection_id: $coll,
      dataset_query: {
        type: "native",
        database: $db,
        native: { query: $q, "template-tags": {} }
      },
      visualization_settings: $viz
    }')"

  if [[ -n "${existing_id}" ]]; then
    echo "  [${name}] — exists (id=${existing_id}), updating"
    if ! ${DRY_RUN}; then
      mb_put "/api/card/${existing_id}" "${payload}" >/dev/null
    fi
    save_card_id "${name}" "${existing_id}"
  else
    echo "  [${name}] — new, creating"
    if ${DRY_RUN}; then
      save_card_id "${name}" "0"
    else
      new_id="$(mb_post "/api/card" "${payload}" | jq -r '.id')"
      save_card_id "${name}" "${new_id}"
    fi
  fi

  if [[ "${enable_embedding}" == "true" ]]; then
    card_id="$(jq -r --arg n "${name}" '.[$n]' <<<"${CARD_IDS_JSON}")"
    echo "    └ enabling embedding on card ${card_id}"
    if ! ${DRY_RUN}; then
      mb_put "/api/card/${card_id}" '{"enable_embedding": true}' >/dev/null
    fi
  fi
done

# -----------------------------------------------------------------------------
# Upsert dashboard
# -----------------------------------------------------------------------------
DASH_SPEC="${SPECS_DIR}/dashboards/ecommerce_executive.yaml"
[[ -f "${DASH_SPEC}" ]] || {
  echo "ERROR: dashboard spec not found at ${DASH_SPEC}" >&2
  exit 1
}

echo "==> Upserting dashboard from $(basename "${DASH_SPEC}")..."
dash_name="$(yq -r '.name' "${DASH_SPEC}")"
dash_desc="$(yq -r '.description // ""' "${DASH_SPEC}")"

if ${DRY_RUN} && [[ "${COLLECTION_ID}" == "dry-run-collection-id" ]]; then
  EXISTING_DASHBOARDS='{"data":[]}'
else
  EXISTING_DASHBOARDS="$(mb_get "/api/collection/${COLLECTION_ID}/items?models=dashboard")"
fi

DASHBOARD_ID="$(jq -r --arg n "${dash_name}" '
  .data | map(select(.name == $n)) | .[0].id // empty
' <<<"${EXISTING_DASHBOARDS}")"

if [[ -z "${DASHBOARD_ID}" ]]; then
  echo "  Dashboard not found — creating"
  if ${DRY_RUN}; then
    DASHBOARD_ID="0"
  else
    DASHBOARD_ID="$(mb_post "/api/dashboard" \
      "$(jq -n --arg n "${dash_name}" --arg d "${dash_desc}" --argjson c "${COLLECTION_ID}" \
        '{name: $n, description: ($d | if . == "" then null else . end), collection_id: $c}')" \
      | jq -r '.id')"
  fi
fi
echo "  Dashboard ID: ${DASHBOARD_ID}"

# Build dashcards array from spec. Each entry refers to a card by name;
# we resolve the name to an ID from CARD_IDS_JSON.
dash_card_count="$(yq -r '.cards | length' "${DASH_SPEC}")"
dashcards='[]'
for ((i=0; i<dash_card_count; i++)); do
  card_name="$(yq -r ".cards[${i}].card" "${DASH_SPEC}")"
  row="$(yq -r ".cards[${i}].row" "${DASH_SPEC}")"
  col="$(yq -r ".cards[${i}].col" "${DASH_SPEC}")"
  size_x="$(yq -r ".cards[${i}].size_x" "${DASH_SPEC}")"
  size_y="$(yq -r ".cards[${i}].size_y" "${DASH_SPEC}")"

  card_id="$(jq -r --arg n "${card_name}" '.[$n] // ""' <<<"${CARD_IDS_JSON}")"
  [[ -n "${card_id}" ]] || {
    echo "ERROR: dashboard references unknown card '${card_name}' — did you author a matching question spec?" >&2
    exit 1
  }

  # id: -1 signals "new dashcard" to Metabase. row/col/size_x/size_y are
  # the grid position (24-column grid; each unit ~ 22px wide).
  dashcards="$(jq -c \
    --argjson id "${card_id}" \
    --argjson r "${row}" \
    --argjson c "${col}" \
    --argjson sx "${size_x}" \
    --argjson sy "${size_y}" \
    '. + [{id: -1, card_id: $id, row: $r, col: $c, size_x: $sx, size_y: $sy, parameter_mappings: [], visualization_settings: {}}]' \
    <<<"${dashcards}")"
done

echo "  Writing ${dash_card_count} dashcards + enabling embedding"
if ! ${DRY_RUN}; then
  dash_update="$(jq -n \
    --argjson dc "${dashcards}" \
    --arg name "${dash_name}" \
    --arg desc "${dash_desc}" \
    '{name: $name, description: ($desc | if . == "" then null else . end), dashcards: $dc, enable_embedding: true}')"
  mb_put "/api/dashboard/${DASHBOARD_ID}" "${dash_update}" >/dev/null
fi

# -----------------------------------------------------------------------------
# Write .ids.json
# -----------------------------------------------------------------------------
echo "==> Writing ${IDS_FILE}..."
final_json="$(jq -n \
  --argjson db "${DB_ID}" \
  --argjson coll "${COLLECTION_ID}" \
  --argjson dash "${DASHBOARD_ID}" \
  --argjson cards "${CARD_IDS_JSON}" \
  '{databaseId: $db, collectionId: $coll, dashboardId: $dash, cardIds: $cards}')"

if ${DRY_RUN}; then
  echo "[dry-run] would write:"
  echo "${final_json}" | jq .
else
  echo "${final_json}" > "${IDS_FILE}"
fi

# -----------------------------------------------------------------------------
# Optionally publish embed config to Secret Manager (6b consumer)
# -----------------------------------------------------------------------------
if ${PUBLISH_EMBED_CONFIG}; then
  echo "==> Publishing ${EMBED_CONFIG_SECRET} to Secret Manager..."
  if ${DRY_RUN}; then
    echo "[dry-run] would gcloud secrets versions add ${EMBED_CONFIG_SECRET}"
  else
    if gcloud secrets describe "${EMBED_CONFIG_SECRET}" \
         --project="${PROJECT}" >/dev/null 2>&1; then
      echo "${final_json}" | gcloud secrets versions add "${EMBED_CONFIG_SECRET}" \
        --data-file=- --project="${PROJECT}"
    else
      echo "${final_json}" | gcloud secrets create "${EMBED_CONFIG_SECRET}" \
        --data-file=- --project="${PROJECT}" \
        --replication-policy="automatic"
    fi
  fi
fi

echo ""
echo "==> Done."
if ! ${DRY_RUN}; then
  echo "  Dashboard: ${METABASE_URL}/dashboard/${DASHBOARD_ID}"
  echo "  IDs:       ${IDS_FILE}"
fi
