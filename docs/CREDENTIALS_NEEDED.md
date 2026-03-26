# Credentials & Configuration Status

Status of external service credentials and configuration for Phase 1.

---

## Cookiebot — DONE (code-side)

- CBID: `7258d666-e9f4-4a84-bfb4-634f84da84b6`
- Script integrated in root layout via `NEXT_PUBLIC_COOKIEBOT_ID` env var
- Consent Mode v2 defaults configured (all denied by default)

## Client-Side GTM — DONE (code-side)

- GTM ID: `GTM-MWHFMTZN`
- Script integrated in root layout via `NEXT_PUBLIC_GTM_ID` env var

## sGTM on Stape — DONE (code-side), DNS PENDING

- sGTM URL: `io.iampatterson.com`
- GTM loads from sGTM domain for same-origin cookie context via `NEXT_PUBLIC_SGTM_URL` env var
- **Pending:** Custom domain DNS propagation (72-hour window from initial setup) **DONE, DNS is verified**

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

## Remaining Manual Steps (not code)

1. **Stape DNS:** Verify `io.iampatterson.com` DNS has propagated **DONE**
2. **sGTM GA4 tag:** Configure GA4 Measurement Protocol tag in sGTM container pointing to `G-9M2G3RLHWF` **DONE**
3. **sGTM BigQuery tag:** Configure BigQuery API tag in sGTM container writing to `iampatterson.iampatterson_raw.events_raw`
4. **BigQuery table:** Run `./infrastructure/bigquery/setup.sh` from a machine with `gcloud` CLI
5. **Vercel:** Connect repo and set environment variables listed above
