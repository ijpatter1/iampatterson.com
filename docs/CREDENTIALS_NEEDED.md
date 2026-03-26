# Credentials & Configuration Needed

What I need from you to complete the remaining Phase 1 deliverables.

---

## Cookiebot

- Cookiebot account ID (the `CBID` from your Cookiebot dashboard)

## Client-Side GTM

- GTM container ID (format: `GTM-XXXXXXX`)

## sGTM on Stape

- Stape sGTM container URL (the custom domain, e.g. `sgtm.iampatterson.com`)
- Confirmation that the Stape container is provisioned and the custom domain DNS is pointed

## GA4

- GA4 Measurement ID (format: `G-XXXXXXXXXX`)
- Confirmation that the GA4 property exists and is configured to receive from sGTM (or if you want me to document the sGTM tag config for you to set up in the GTM UI)

## BigQuery

- GCP project ID
- Confirmation that the `iampatterson_raw` dataset and `events_raw` table exist (or whether you want me to write the schema/setup script)
- Confirmation that sGTM has a BigQuery API tag configured (this is done in the sGTM container UI, not in code)

## Deployment

- Vercel account connected to the repo, or a GCP project + Cloud Run setup
- If Vercel: just confirm and I can add any needed config
- If Cloud Run: GCP project ID and region preference
