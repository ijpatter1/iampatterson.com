# GTM container census, measured

Taken 2026-09-08, session-2026-09-08-002, deliverable [14.1]. This is the gated
precondition the amended deliverable requires: *measure both live containers and
record every live entity class the committed specs do not represent, before any
write.*

Read through the Tag Manager API v2 as
`gtm-reconciler@iampatterson.iam.gserviceaccount.com`, reached by impersonation
with `tagmanager.readonly`. Nothing was written.

## Result: the escalation trigger fired

The deliverable says a materially incomplete spec is a `/guv:replan` moment while
the phase is still open. It is incomplete, in **both directions**, and differently
in each container. The reconciler cannot be built to "diff the committed specs
against live" until a person decides which side is authoritative for the server
container.

## Counts

| | web `247511905` | server `247531845` |
| --- | --- | --- |
| workspace | Default Workspace (id 9) | Default Workspace (id 14) |
| tags | live 18 / spec 22 | live 5 / spec 5 |
| triggers | live 17 / spec 21 | live 8 / spec 10 |
| variables | live 40 / spec 55 | live 5 / spec 0 |
| built-in variables | live 2 / **spec has no such class** | live 2 / **spec has no such class** |
| folders | live 2 / **spec has no such class** | live 3 / **spec has no such class** |
| templates | live 0 | live 5 / **spec has no such class** |
| clients | live 0 | live 2 / spec 2 |
| zones, transformations | 0 | 0 |

Three live entity classes — **built-in variables, folders and custom templates** —
have no representation in either committed spec. Under `--allow-deletes` they
would be deletion candidates; without it they are permanent drift in every
report. The reconciler must declare them exempt and out of its ownership.

## Web container: the spec is ahead of live, by exactly the Claudish work

Every web-container difference is one story. In the spec and **not live**:

- 4 tags — `GA4 - claudish_detected`, `claudish_rate`, `claudish_share`, `claudish_translate`
- 4 triggers — the matching `ce - claudish_*`
- 16 variables — `dlv - direction`, `outcome`, `ttft_ms`, `cache`, `detected_language`,
  `detector_source`, `duration_ms`, `input_chars`, `input_em_dashes`, `output_chars`,
  `rating`, `share_action`, `share_truncated`, `share_url_chars`, `source_mode`, `event`

That is precisely what `infrastructure/gtm/deploy-claudish.js` creates. **The script
was never run against production.** The spec was updated as though it had been.

One variable is live and unspecced: `ga4 - shared_event_settings`.

### The consequence, measured

```sql
SELECT event_name, COUNT(*) FROM `iampatterson.iampatterson_raw.events_raw`
WHERE DATE(_PARTITIONTIME) >= DATE_SUB(CURRENT_DATE(), INTERVAL 14 DAY)
GROUP BY event_name ORDER BY 2 DESC
```

Seventeen event names return. **`claudish_translate`, `claudish_detected`,
`claudish_share` and `claudish_rate` are not among them, and neither are
`web_vital` or `page_engagement`.** Six event families are instrumented in the
application, rendered as coverage chips in the overlay, and absent from the
warehouse. The `/claudish` page has been live since the Claudish launch and every
event it fires dies in the data layer.

This is the same defect [14.4] was written to fix for two events. The census
shows it is six.

## Server container: the spec is fiction, and live is correct

Live is coherent and working. The spec describes a container that was planned and
never built — much of what exists was created through Stape's own interface, as
the `[Stape]` prefixes show.

Named in the spec, **absent from live**: `GA4 - Forwarding`, `BigQuery - Write All
Events`, `Pub/Sub - Publish All Events`, and nine triggers including
`All GA4 Events`, `ce - page_view`, `ce - form_submit`, `ce - consent_update`.

Live, **absent from the spec**: tags `[Stape] GA4 - Base`, `BigQuery API`,
`Pub/Sub Publish`; triggers `clientName - GA4`, `ce - conversions`, `ga4 -
generate_lead`, `ga4 - schedule`, `dc - page_view`, `dc - contact`, `dc -
generate_lead`, `dc - schedule`; five `ed - *` event-data variables; five custom
templates.

The three destination tags are the spec's three under different names. All three
fire on `clientName - GA4`, a trigger of type `always` filtered on `{{Client Name}}
contains GA4`:

```
Pub/Sub Publish       fires on clientName - GA4
BigQuery API          fires on clientName - GA4
[Stape] GA4 - Base    fires on clientName - GA4
```

**So the generic-forwarding architecture is real and needs no route change.** What
is wrong is the name. `deploy-claudish.js:8` calls it "All-GA4-Events",
`pubsub-tag-template.js:16` names it in its setup comment, and the [14.4] wording
amended earlier this session calls it `All GA4 Events`. None of those triggers
exists; the live one is `clientName - GA4`. The amended wording took the name
from the spec on the same day this census falsified it.

*(Corrected 2026-09-08, minutes after first writing: this paragraph originally
said ARCHITECTURE also carried the name. It does not — `grep -rn "All GA4 Events"
docs/` returns no hit in `ARCHITECTURE.md`. The claim was asserted from memory of
what the spec said rather than checked, which is the failure this document exists
to report in others.)*

`ce - conversions` fires the two simulated ad-platform tags, filtered to
`purchase|trial_signup|form_complete` — consistent with the simulation constraint.

## What this changes

1. **Applying `server-container.json` to live would be destructive in effect.**
   Nine triggers and three tags would be created under spec names alongside the
   working ones, and the five templates and five event-data variables are
   invisible to the spec entirely. The server container must not be reconciled
   from this spec.
2. **[14.4]'s trigger name is wrong** and needs a reword before anyone builds
   against it.
3. **Four Claudish events have no owner in the plan.** They are a third family in
   the same defect class [14.4] addresses, discovered here.
4. The web container's spec *is* usable as the source of truth: its only
   divergence is work that was authored and never applied, plus one unspecced
   variable.

## Reproduction

The enumeration script is `census.py` in this session's scratchpad; it walks
`accounts → containers → workspaces → {tags, triggers, variables,
built_in_variables, folders, clients, templates, zones, transformations}` and
writes a JSON dump. It becomes the read half of `reconcile.js`, so it is not
committed separately.
