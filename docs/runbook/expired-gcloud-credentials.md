# Expired gcloud credentials during an incident

**No alert leads here.** This is the entry for the moment when you are trying to
fix something else and the tools stop working.

## What it looks like

```
ERROR: (gcloud.projects.describe) There was a problem refreshing your current
auth tokens: Reauthentication failed. cannot prompt during non-interactive
execution.
```

or, from Terraform:

```
Error: Failed to open state file at gs://iampatterson-tfstate/...:
auth: "invalid_grant" "reauth related error (invalid_rapt)"
```

Credentials on this project expire roughly hourly, and always overnight. This is
not the incident. It is a thing that happens during incidents, at the worst
moment, and it costs a few minutes if you recognise it and much longer if you
mistake it for the fault you were chasing.

## There are two separate credentials

This is the part that wastes time. Re-authenticating one does not fix the other.

**The CLI credential** is what `gcloud` and `bq` use. Restore it with:

```bash
gcloud auth login
```

**Application Default Credentials** are what libraries and Terraform use.
Separate store, separate expiry, separate command:

```bash
gcloud auth application-default login
```

Both open a browser. Neither can be completed by a script or an agent, which is
why an automated session simply stops here rather than working around it.

## The quota project trap

`gcloud auth application-default login` attaches a quota project, and on this
machine it defaults to the wrong one. After re-authenticating ADC, set it:

```bash
gcloud auth application-default set-quota-project iampatterson
```

Skip this and you get confusing failures that look like missing permissions but
are not. A real example: `gcloud billing budgets list` failed with a message
naming a permission on the billing account, when the actual cause was that the
Billing Budgets API was not enabled on the *quota* project. The fix was
`--billing-project=iampatterson`, not a grant.

## The other project trap

The CLI's default project on this machine is not this project. Every command in
this runbook passes `--project=iampatterson` for that reason. A command that
omits it either fails confusingly or operates on something else.

```bash
gcloud config get-value project    # expect: not iampatterson
```

That is fine and deliberate. Do not "fix" it by changing the default; pass the
flag.

## How you know it worked

```bash
gcloud auth list --format='value(account,status)'
gcloud projects describe iampatterson --format='value(projectId)'
```

The second command is the real check. It exercises a token against this specific
project rather than just reporting what is stored.

For Terraform specifically, the check is that it can reach the state bucket:

```bash
cd infrastructure/terraform && terraform init -reconfigure
```

## Rehearsal

Rehearsed on 2026-09-05, involuntarily, which is the best kind.

An unattended session was part-way through Phase 13 work when both credentials
expired overnight. Terraform failed first, on the state bucket:

```
auth: "invalid_grant" "reauth related error (invalid_rapt)"
```

and `gcloud` failed second, with the reauthentication error quoted at the top of
this page. The session recognised the condition, stopped rather than treating it
as the fault it had been chasing, and asked for both commands — which is exactly
the behaviour this entry prescribes.

Two details in this page come directly from that morning: that the two
credentials expire independently and need separate commands, and that ADC
re-attaches the wrong quota project on the way back in. Both cost time before
they were understood.
