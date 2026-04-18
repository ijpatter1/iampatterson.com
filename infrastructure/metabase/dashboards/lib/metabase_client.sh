#!/usr/bin/env bash
#
# Thin curl wrappers around the Metabase REST API. Sourced by apply.sh.
#
# Requires these environment variables set by the caller:
#   METABASE_URL   — base URL (e.g. https://bi.iampatterson.com)
#   MB_API_KEY     — admin-scoped API key (fetched from Secret Manager)
#
# Authentication: the x-api-key header. Requires Metabase >= 0.49 and
# an API key generated in Metabase UI under Admin → Authentication →
# API Keys, assigned to the Admin group.
#
# Errors: every wrapper returns non-zero on HTTP >= 400 and prints the
# response body to stderr so the caller can surface Metabase's structured
# error message (usually JSON with {"errors": {...}, "message": "..."}).
# Under `set -e`, the caller aborts.

# ---- private: do-request "VERB" "/path" [BODY] ----
_mb_request() {
  local verb="$1" path="$2" body="${3:-}"
  local tmp http_code
  tmp="$(mktemp)"

  # -sS: silent but show errors; -o: response body to tmp; -w: extract status.
  # Using --fail-with-body would also work but isn't available on older curl.
  local -a args=(
    -sS
    -o "${tmp}"
    -w "%{http_code}"
    -X "${verb}"
    -H "x-api-key: ${MB_API_KEY}"
    -H "Accept: application/json"
  )
  if [[ -n "${body}" ]]; then
    args+=(-H "Content-Type: application/json" --data "${body}")
  fi

  http_code="$(curl "${args[@]}" "${METABASE_URL}${path}" || echo "000")"

  if [[ "${http_code}" -ge 400 ]] || [[ "${http_code}" == "000" ]]; then
    echo "ERROR: ${verb} ${path} returned HTTP ${http_code}" >&2
    if [[ -s "${tmp}" ]]; then
      cat "${tmp}" >&2
      echo "" >&2
    fi
    rm -f "${tmp}"
    return 1
  fi

  cat "${tmp}"
  rm -f "${tmp}"
}

mb_get()  { _mb_request GET  "$1"; }
mb_post() { _mb_request POST "$1" "$2"; }
mb_put()  { _mb_request PUT  "$1" "$2"; }

# Sanity check that the API key is valid + the LB path split works.
# Called at startup by apply.sh before any writes.
mb_ping() {
  local response user_email
  response="$(mb_get "/api/user/current")"
  user_email="$(jq -r '.email // "<unknown>"' <<<"${response}")"
  echo "Authenticated to Metabase as: ${user_email}"
}
