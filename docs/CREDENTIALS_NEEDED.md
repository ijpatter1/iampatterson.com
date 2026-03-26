# Credentials & Configuration Status

Status of external service credentials and configuration for Phase 1.

---

## Cookiebot — DONE (code-side)

- CBID: `7258d666-e9f4-4a84-bfb4-634f84da84b6`
- Script integrated in root layout via `NEXT_PUBLIC_COOKIEBOT_ID` env var
- Consent Mode v2 defaults configured (all denied by default)

## Client-Side GTM — DONE (code-side), CONTAINER CONFIG PENDING

- GTM ID: `GTM-MWHFMTZN` (our production container)
- Script integrated in root layout via `NEXT_PUBLIC_GTM_ID` env var
- **Pending:** Web container tags/triggers/variables must be configured — see `infrastructure/gtm/web-container.json` for spec
- **Note:** Stape auto-generated a separate lead gen container (`GTM-NW698GF4`, exported in `docs/gtm-web-template.json`) — this is a reference template, not our production container

## sGTM on Stape — DONE (code-side), CONTAINER CONFIG PENDING

- sGTM URL: `io.iampatterson.com`
- sGTM container ID: `GTM-NTTKZFWD` (our production container, separate from Stape's auto-generated `GTM-KNTVZ3JW`)
- GTM loads from sGTM domain for same-origin cookie context via `NEXT_PUBLIC_SGTM_URL` env var
- DNS propagation: **DONE, verified**
- **Pending:** sGTM tags/triggers must be configured — see `infrastructure/gtm/server-container.json` for spec
- **Note:** Stape auto-generated a reference sGTM container (`GTM-KNTVZ3JW`, exported in `docs/gtm-server-template.json`) with GA4 client + Data Client. We use Stape's infrastructure (hosting, GA4 client, Data Client, BigQuery tag template) but configure our own tags/triggers on top

## GA4 — DONE (code-side), sGTM TAG PENDING

- Measurement ID: `G-9M2G3RLHWF`
- Stored as `NEXT_PUBLIC_GA4_MEASUREMENT_ID` for reference
- **Pending:** GA4 tag must be configured in the sGTM container UI (Stape dashboard) **DONE**

## BigQuery — SETUP SCRIPT READY, sGTM TAG PENDING

- GCP Project: `iampatterson`
- Setup script: `./infrastructure/bigquery/setup.sh` — creates `iampatterson_raw` dataset and `events_raw` table
- Run with: `./infrastructure/bigquery/setup.sh` (requires `gcloud` CLI authenticated with BigQuery permissions)
- Tag template: Stape "Write to BigQuery" (`docs/template.tpl`)
- **Tag config:** Table ID = `iampatterson.iampatterson_raw.events_raw`, Data to Write = "All Event Data", check "Add Event Timestamp" with field name `received_timestamp`
- **Pending:** sGTM BigQuery tag must be configured in the sGTM container UI

## Deployment — VERCEL CONFIG READY

- `vercel.json` added with security headers
- **To deploy:** Connect this repo to Vercel and set these environment variables in the Vercel dashboard:
  - `NEXT_PUBLIC_COOKIEBOT_ID` = `7258d666-e9f4-4a84-bfb4-634f84da84b6`
  - `NEXT_PUBLIC_GTM_ID` = `GTM-MWHFMTZN`
  - `NEXT_PUBLIC_SGTM_URL` = `io.iampatterson.com`
  - `NEXT_PUBLIC_GA4_MEASUREMENT_ID` = `G-9M2G3RLHWF`

---

## Stape Reference Templates

Stape auto-generated a lead gen GTM web + sGTM container pair on initial setup. These are **reference only** — not our production containers.

- `docs/gtm-web-template.json` — Stape's web container (`GTM-NW698GF4`): GA4 event tags for `page_view`, `generate_lead`, `contact`, `schedule` with user data collection (email, phone via sessionStorage)
- `docs/gtm-server-template.json` — Stape's sGTM container (`GTM-KNTVZ3JW`): GA4 client, Data Client, GA4 forwarding tag, event routing triggers

**Useful patterns from Stape's templates:**
- Trigger groups (consent + page URL) for conversion firing
- GA4 `user_provided_data` variable structure for enhanced conversions (Phase 6)
- Data Client routing for external destinations
- `server_container_url` variable for sGTM transport

**Not applicable to us:**
- Their event names (`contact`, `schedule`, `generate_lead`) — we use our own taxonomy
- Their PII collection approach (sessionStorage) — we don't collect PII in Phase 1
- Their container IDs (`GTM-NW698GF4`, `GTM-KNTVZ3JW`) — ours are different

---

## Remaining Manual Steps (not code)

1. **Stape DNS:** Verify `io.iampatterson.com` DNS has propagated **DONE**
2. **sGTM GA4 tag:** Configure GA4 Measurement Protocol tag in sGTM container pointing to `G-9M2G3RLHWF` **DONE**
3. **Web GTM container:** Configure tags/triggers/variables per `infrastructure/gtm/web-container.json` spec
4. **sGTM container:** Configure tags/triggers per `infrastructure/gtm/server-container.json` spec
5. **sGTM BigQuery tag:** Configure BigQuery API tag in sGTM container writing to `iampatterson.iampatterson_raw.events_raw`
6. **BigQuery table:** Run `./infrastructure/bigquery/setup.sh` from a machine with `gcloud` CLI (or create manually in BigQuery Console)
7. **Vercel:** Connect repo and set environment variables listed above
