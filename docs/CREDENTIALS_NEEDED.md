# Credentials & Configuration Needed

What I need from you to complete the remaining Phase 1 deliverables.

---

## Cookiebot

- Cookiebot account ID (the `CBID` from your Cookiebot dashboard) CBID=7258d666-e9f4-4a84-bfb4-634f84da84b6

## Client-Side GTM

- GTM container ID (format: `GTM-XXXXXXX`) GTM_ID=GTM-MWHFMTZN

## sGTM on Stape

- Stape sGTM container URL (the custom domain, e.g. `sgtm.iampatterson.com`) STAPE_CURL=io.iampatterson.com
- Confirmation that the Stape container is provisioned and the custom domain DNS is pointed **This is in progress, requires 72 hours**

## GA4

- GA4 Measurement ID (format: `G-XXXXXXXXXX`) MEASUREMENT_ID=G-9M2G3RLHWF
- Confirmation that the GA4 property exists and is configured to receive from sGTM (or if you want me to document the sGTM tag config for you to set up in the GTM UI) **This is not set up in stape yet**

## BigQuery

- GCP project ID PROJECT_ID=iampatterson
- Confirmation that the `iampatterson_raw` dataset and `events_raw` table exist (or whether you want me to write the schema/setup script) **I want you to handle this**
- Confirmation that sGTM has a BigQuery API tag configured (this is done in the sGTM container UI, not in code) **this is not done yet**

## Deployment

- Vercel account connected to the repo, or a GCP project + Cloud Run setup
- If Vercel: just confirm and I can add any needed config **We're using Vercel over GCP for the frontend hosting because it's more representative of real world client architectures where they'll be coming to us with an existing web site hosting provider.**
- If Cloud Run: GCP project ID and region preference
