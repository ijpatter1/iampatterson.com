# Preview protection blocking automated checks

**No alert leads here.** You meet this when a script, a test, or a Lighthouse run
tries to read a Vercel preview deployment and gets a login page instead of the
site.

## What is happening

Vercel deployment protection is enabled for preview deployments on this project.
Every preview URL requires a browser login, which is the right default: previews
of a consulting site should not be publicly readable before they ship.

The cost is that anything automated sees the authentication wall. An end-to-end
test suite pointed at a preview URL gets HTML for a login page, and its failures
look like application bugs rather than an access problem.

## Recognise it quickly

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<preview-deployment>.vercel.app/
```

Measured on 2026-09-05, the protection answers **`302`**, redirecting to
`vercel.com/sso-api` and on to a login page that itself returns `200`. So the
status code alone will mislead you twice: the first response is not an error, and
if you follow redirects the final response is a success. Read the body:

```bash
curl -s https://<preview-deployment>.vercel.app/ | head -20
```

If you see Vercel's own markup rather than the application's, that is this entry
and not a broken build.

## Fix: the automation bypass secret

Vercel provides a bypass token for exactly this. Once it exists, an automated
client sends it and reads the preview without a browser:

```bash
curl -s -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  https://<preview-deployment>.vercel.app/
```

or as a query parameter, which also sets a cookie for subsequent requests in the
same session.

**This secret does not exist yet.** Creating it is a browser action in the Vercel
dashboard, so it is tracked as a manual task at
`docs/manual/task-2026-09-05-001.md`. Until it is created, the honest answer is
that automated checks cannot read previews, and the alternatives are to run them
against a local build or against production.

## What not to do

Do not turn off deployment protection to make a script work. It protects unshipped
work on a site whose whole purpose is to be shown to prospects, and the bypass
secret exists precisely so that the protection can stay on.

## How you know it worked

With the secret set:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  https://<preview-deployment>.vercel.app/
```

returns `200`, and the body is the site. Without the header, the same URL still
returns the login wall — that second half is the check that the protection is
still doing its job.

## Rehearsal

Rehearsed on 2026-09-05 against the live preview deployment for PR #62.

An unauthenticated request returned `302` to
`https://vercel.com/sso-api?url=…&nonce=…`, and following the redirects ended at
`https://vercel.com/login` with HTTP 200 — the authentication page, not the
site. Production returned 200 with the application, for contrast.

That is the wall this entry describes, confirmed working rather than assumed.
Note the shape it actually takes: **not a 401.** A naive check that treats any
2xx as success will follow the redirect chain, receive 200 from Vercel's login
page, and conclude the site is up. That is the trap this entry exists to name,
and it is why the check above reads the body rather than only the status.

The other half — that the bypass header lets an automated client through — could
not be rehearsed, because the secret does not exist yet. It is
`docs/manual/task-2026-09-05-001.md`, and step 5 of that card is the rehearsal.
