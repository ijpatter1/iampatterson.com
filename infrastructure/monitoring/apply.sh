#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Monitoring as committed configuration (Phase 12, deliverable 12.2).
#
# Reads the specs under infrastructure/monitoring/spec/ and reconciles the
# notification channels, the uptime checks, one uptime alert policy per
# check, the log-based metrics (12.3) and the _Default bucket retention
# against project iampatterson through the Monitoring and Logging REST APIs,
# idempotent by display name. Nothing here deletes: a check whose host
# changed (an immutable field) is reported for a hand recreate.
#
#   apply.sh [--dry-run] apply     plan (create / update / unchanged), then apply unless --dry-run
#   apply.sh verify                 latest uptime results per check, the log-based metrics, the retention
#                                   setting and the four 24-hour queries, written to docs/verification/
#   apply.sh rehearse [check]       point one check at a missing path, wait for the alert to arrive
#                                   on the Pub/Sub channel, restore, record (default: claudish-proxy-health)
#   apply.sh rehearse-policy        fire the capacity policy on purpose: kill switch on, one translation,
#                                   wait for the alert on the Pub/Sub channel, kill switch off, record
#
# Env: PROJECT (iampatterson), SPEC_DIR, OUT_DIR (docs/verification), REHEARSE_WAIT_MIN (25)
# Needs: gcloud (an access token; no alpha/beta component), python3, curl.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="${PROJECT:-iampatterson}"
SPEC_DIR="${SPEC_DIR:-$(cd "$(dirname "$0")" && pwd)/spec}"
OUT_DIR="${OUT_DIR:-docs/verification}"
DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; shift; fi
CMD="${1:-apply}"; shift || true

TOKEN=$(gcloud auth print-access-token 2>/dev/null) || { echo "❌ no gcloud access token (run: gcloud auth login)" >&2; exit 1; }
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' 2>/dev/null || true)

# The Pub/Sub side of the pubsub channel: topic, the Monitoring notification
# service agent as publisher, and a pull subscription the rehearsal reads.
ensure_pubsub() {
  local topic sub
  topic=$(python3 -c 'import json,sys; print([c for c in json.load(open(sys.argv[1])) if c["type"]=="pubsub"][0]["labels"]["topic"].split("/")[-1])' "$SPEC_DIR/channels.json")
  sub="${topic}-verify"
  if [ "$DRY" = "1" ]; then echo "[dry-run] would ensure topic $topic, publisher binding for the monitoring agent, subscription $sub"; return; fi
  gcloud pubsub topics describe "$topic" --project="$PROJECT" >/dev/null 2>&1 || gcloud pubsub topics create "$topic" --project="$PROJECT" --quiet
  # The Monitoring notification service agent only exists once provisioned; the
  # binding below fails with INVALID_ARGUMENT until it does (seen 2026-09-04).
  gcloud beta services identity create --service=monitoring.googleapis.com --project="$PROJECT" --quiet >/dev/null 2>&1 || true
  gcloud pubsub topics add-iam-policy-binding "$topic" --project="$PROJECT" \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-monitoring-notification.iam.gserviceaccount.com" --role=roles/pubsub.publisher --quiet >/dev/null
  gcloud pubsub subscriptions describe "$sub" --project="$PROJECT" >/dev/null 2>&1 || gcloud pubsub subscriptions create "$sub" --topic="$topic" --project="$PROJECT" --ack-deadline=60 --message-retention-duration=7d --quiet
  echo "pubsub: topic $topic, subscription $sub, monitoring agent may publish"
}

case "$CMD" in
  apply) ensure_pubsub ;;
  verify|rehearse|rehearse-policy) ;;
  *) echo "usage: apply.sh [--dry-run] apply | verify | rehearse [check] | rehearse-policy" >&2; exit 1 ;;
esac

PROJECT="$PROJECT" TOKEN="$TOKEN" SPEC_DIR="$SPEC_DIR" OUT_DIR="$OUT_DIR" DRY="$DRY" CMD="$CMD" ARG="${1:-}" REHEARSE_WAIT_MIN="${REHEARSE_WAIT_MIN:-25}" python3 - <<'PYEOF'
import base64, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

P = os.environ["PROJECT"]; TOKEN = os.environ["TOKEN"]; SPEC = os.environ["SPEC_DIR"]; OUT = os.environ["OUT_DIR"]
DRY = os.environ["DRY"] == "1"; CMD = os.environ["CMD"]; ARG = os.environ["ARG"]
API = f"https://monitoring.googleapis.com/v3/projects/{P}"
PUBSUB = f"https://pubsub.googleapis.com/v1/projects/{P}"
LOGGING = f"https://logging.googleapis.com/v2/projects/{P}"

def call(method, url, body=None, params=None):
    if params: url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params, doseq=True)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url.split('?')[0]} -> HTTP {e.code}: {e.read().decode()[:300]}")

def paged(url, key, params=None):
    items, token = [], None
    while True:
        p = dict(params or {})
        if token: p["pageToken"] = token
        d = call("GET", url, params=p); items += d.get(key, []); token = d.get("nextPageToken")
        if not token: return items

def by_name(items): return {i.get("displayName"): i for i in items}
def act(kind, verb, name, detail=""):
    print(f"  {'[dry-run] ' if DRY else ''}{verb:<9} {kind:<8} {name}{'  ' + detail if detail else ''}")

channels_spec = json.load(open(f"{SPEC}/channels.json")); checks_spec = json.load(open(f"{SPEC}/uptime.json"))
metrics_spec = json.load(open(f"{SPEC}/log-metrics.json")); retention_spec = json.load(open(f"{SPEC}/retention.json")); queries_spec = json.load(open(f"{SPEC}/queries.json"))
policies_spec = json.load(open(f"{SPEC}/policies.json"))

def desired_spec_policy(p, channel_names):
    doc = f"{p['threshold']}\n\nFiring: {p['firing']}\n\nRunbook: {p['runbook']}. Spec: infrastructure/monitoring/spec/policies.json."
    base = {"displayName": p["displayName"], "combiner": "OR", "notificationChannels": sorted(channel_names), "enabled": True,
            "documentation": {"content": doc, "mimeType": "text/markdown"}}
    if p["kind"] == "log":
        base["conditions"] = [{"displayName": p["displayName"], "conditionMatchedLog": {"filter": p["logFilter"]}}]
        base["alertStrategy"] = {"notificationRateLimit": {"period": "1800s"}, "autoClose": "1800s"}
    else:
        base["conditions"] = [{"displayName": p["displayName"], "conditionThreshold": {"filter": p["filter"], "aggregations": p["aggregations"], "comparison": p["comparison"],
                               "thresholdValue": p["thresholdValue"], "duration": p["duration"], "trigger": {"count": 1}}}]
        base["alertStrategy"] = {"autoClose": "1800s"}
    return base

def spec_policy_differs(cur, want):
    cc = cur.get("conditions", [{}])[0]; wc = want["conditions"][0]
    if "conditionMatchedLog" in wc:
        return cc.get("conditionMatchedLog", {}).get("filter") != wc["conditionMatchedLog"]["filter"] or sorted(cur.get("notificationChannels", [])) != want["notificationChannels"] or cur.get("enabled") is False
    a, b = cc.get("conditionThreshold", {}), wc["conditionThreshold"]
    return (a.get("filter") != b["filter"] or a.get("comparison") != b["comparison"] or a.get("thresholdValue") != b["thresholdValue"] or a.get("duration") != b["duration"]
            or sorted(cur.get("notificationChannels", [])) != want["notificationChannels"] or cur.get("enabled") is False or cur.get("documentation", {}).get("content") != want["documentation"]["content"])

def reconcile_spec_policies(channel_names):
    live = by_name(paged(f"{API}/alertPolicies", "alertPolicies"))
    for p in policies_spec:
        want = desired_spec_policy(p, list(channel_names.values())); cur = live.get(p["displayName"])
        if cur is None:
            act("policy", "create", p["displayName"])
            if not DRY: call("POST", f"{API}/alertPolicies", want)
        elif spec_policy_differs(cur, want):
            act("policy", "update", p["displayName"])
            if not DRY: call("PATCH", f"https://monitoring.googleapis.com/v3/{cur['name']}", {**want, "name": cur["name"]}, {"updateMask": "conditions,notificationChannels,alertStrategy,documentation,enabled"})
        else:
            act("policy", "unchanged", p["displayName"])

def cert_days():
    end = datetime.now(timezone.utc); start = end - timedelta(minutes=40)
    d = call("GET", f"{API}/timeSeries", params={"filter": 'metric.type="monitoring.googleapis.com/uptime_check/time_until_ssl_cert_expires"', "interval.startTime": start.isoformat(), "interval.endTime": end.isoformat(), "view": "FULL"})
    out = {}
    for ts in d.get("timeSeries", []):
        host = ts["resource"]["labels"].get("host", "?"); pts = ts.get("points", [])
        if pts: out[host] = min(out.get(host, 1e9), float(pts[0]["value"].get("doubleValue", pts[0]["value"].get("int64Value", 0))))
    return out

def verify_policies():
    live = by_name(paged(f"{API}/alertPolicies", "alertPolicies")); channels = by_name(paged(f"{API}/notificationChannels", "notificationChannels"))
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"); rows = []; ok = True
    for p in policies_spec:
        cur = live.get(p["displayName"]); good = cur is not None and cur.get("enabled", True) and len(cur.get("notificationChannels", [])) == len(channels_spec); ok = ok and good
        rows.append(f"| {'✓' if good else '✗'} | {p['displayName']} | {p['threshold']} | {p['firing']} |")
    days = cert_days()
    for host, dd in sorted(days.items()): rows.append(f"| {'✓' if dd > 14 else '✗'} | certificate on {host} | {dd:.0f} days until expiry (alert below 14) | measured by the uptime checks |")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp[:10]}-alert-policies.md"
    with open(path, "w") as f:
        f.write(f"# Alerting policies\n\nDeliverable 12.4. Generated by `infrastructure/monitoring/apply.sh verify` at {stamp} from `infrastructure/monitoring/spec/policies.json`; rerun to refresh. Every policy routes to {', '.join(sorted(channels))}.\n\n| | Policy | Threshold | Firing record or safety reason |\n|---|---|---|---|\n" + "\n".join(rows) + f"\n\nResult: {'every policy present, enabled and routed' if ok else 'ATTENTION: see the ✗ rows'}.\n")
    print("\n".join(rows)); print(f"record: {path}"); return ok

def rehearse_policy():
    import subprocess
    topic = [ch for ch in channels_spec if ch["type"] == "pubsub"][0]["labels"]["topic"].split("/")[-1]; sub = f"{topic}-verify"
    wait = int(os.environ["REHEARSE_WAIT_MIN"]) * 60; stamp = datetime.now(timezone.utc)
    svc = ["gcloud", "run", "services", "update", "claudish-proxy", f"--project={P}", "--region=us-central1", "--quiet", "--update-env-vars"]
    url = subprocess.run(["gcloud", "run", "services", "describe", "claudish-proxy", f"--project={P}", "--region=us-central1", "--format=value(status.url)"], capture_output=True, text=True).stdout.strip()
    for _ in pull(sub, 1): pass
    if DRY: print("[dry-run] would turn KILL_SWITCH on, request one translation, wait for the capacity alert, turn it off"); return
    lines = [f"# Alert policy rehearsal: capacity_no_budget", "", f"Deliverable 12.4. Generated by `infrastructure/monitoring/apply.sh rehearse-policy` starting {stamp.strftime('%Y-%m-%dT%H:%M:%SZ')}. The proxy's kill switch was turned on, one translation was requested so the proxy logged `capacity_no_budget`, the policy's notification was read from the Pub/Sub channel, and the switch was turned off.", ""]
    print("KILL_SWITCH=on"); subprocess.run(svc + ["KILL_SWITCH=on"], check=True, capture_output=True)
    opened = None
    try:
        time.sleep(20)
        req = urllib.request.Request(f"{url}/translate", data=json.dumps({"text": f"rehearsal {stamp.strftime('%H%M%S')} hello there", "direction": "en2cl"}).encode(), headers={"Origin": "https://www.iampatterson.com", "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as r: code = r.status
        except urllib.error.HTTPError as e: code = e.code
        lines.append(f"- translation request with the switch on answered HTTP {code} (503 capacity expected)")
        t0 = time.time()
        for at, data in pull(sub, wait):
            inc = data.get("incident", {})
            if "capacity_no_budget" in json.dumps(data) and inc.get("state") == "open":
                opened = (at, inc.get("incident_id"), inc.get("policy_name")); break
    finally:
        subprocess.run(svc + ["KILL_SWITCH=off"], check=True, capture_output=True); print("KILL_SWITCH=off")
    lines.append(f"- OPEN notification received at {opened[0]} after {int(time.time()-t0)//60} min: incident `{opened[1]}`, policy `{opened[2]}`" if opened else f"- no OPEN notification within {wait//60} min; the switch is off again; investigate the metric and the policy before relying on it")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp.strftime('%Y-%m-%d')}-policy-rehearsal.md"
    open(path, "w").write("\n".join(lines) + "\n"); print("\n".join(lines[3:])); print(f"record: {path}"); sys.exit(0 if opened else 1)

def desired_metric(m):
    d = {"name": m["name"], "description": m["description"], "filter": m["filter"], "metricDescriptor": {"metricKind": "DELTA", "valueType": "INT64", "unit": "1",
         "labels": [{"key": k, "valueType": "STRING", "description": v["description"]} for k, v in sorted(m.get("labels", {}).items())]}}
    if m.get("labels"): d["labelExtractors"] = {k: v["extractor"] for k, v in m["labels"].items()}
    return d

def metric_differs(cur, want):
    return (cur.get("filter") != want["filter"] or cur.get("description") != want["description"]
            or cur.get("labelExtractors", {}) != want.get("labelExtractors", {}))

def reconcile_metrics():
    live = {m["name"]: m for m in paged(f"{LOGGING}/metrics", "metrics")}
    for m in metrics_spec:
        want = desired_metric(m); cur = live.get(m["name"])
        if cur is None:
            act("metric", "create", m["name"])
            if not DRY: call("POST", f"{LOGGING}/metrics", want)
        elif metric_differs(cur, want):
            act("metric", "update", m["name"])
            if not DRY: call("PUT", f"{LOGGING}/metrics/{m['name']}", want)
        else:
            act("metric", "unchanged", m["name"])

def reconcile_retention():
    b = call("GET", f"{LOGGING}/locations/global/buckets/{retention_spec['bucket']}")
    want = int(retention_spec["retentionDays"]); cur = int(b.get("retentionDays", 30))
    if cur != want:
        act("bucket", "update", retention_spec["bucket"], f"retention {cur}d -> {want}d ({retention_spec['status']})")
        if not DRY: call("PATCH", f"{LOGGING}/locations/global/buckets/{retention_spec['bucket']}", {"retentionDays": want}, {"updateMask": "retentionDays"})
    else:
        act("bucket", "unchanged", retention_spec["bucket"], f"retention {cur}d ({retention_spec['status']})")
    for s in retention_spec.get("sinks", []):
        act("sink", "skip", s, "sinks are declared here but applied by hand; none declared today")

def run_queries(hours=24):
    end = datetime.now(timezone.utc); start = end - timedelta(hours=hours); rows = []
    for q in queries_spec:
        f = f'{q["filter"]} AND timestamp>="{start.isoformat()}" AND timestamp<="{end.isoformat()}"'
        d = call("POST", "https://logging.googleapis.com/v2/entries:list", {"resourceNames": [f"projects/{P}"], "filter": f, "orderBy": "timestamp desc", "pageSize": 200})
        entries = d.get("entries", []); count = len(entries) + (0 if not d.get("nextPageToken") else 200)
        sample = ""
        if entries:
            e = entries[0]; sample = (e.get("jsonPayload", {}).get("event") or e.get("textPayload") or json.dumps(e.get("jsonPayload", {}))[:80] or str(e.get("httpRequest", {}).get("status", "")))
            sample = f"latest {e.get('timestamp','')[:19]}: {str(sample)[:90]}"
        rows.append((q["service"], count, d.get("nextPageToken") is not None, sample))
    return rows

def verify_metrics_and_logs():
    live = {m["name"]: m for m in paged(f"{LOGGING}/metrics", "metrics")}
    b = call("GET", f"{LOGGING}/locations/global/buckets/{retention_spec['bucket']}")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"); rows = []; ok = True
    for m in metrics_spec:
        cur = live.get(m["name"]); good = cur is not None and cur.get("filter") == m["filter"]; ok = ok and good
        rows.append(f"| {'✓' if good else '✗'} | metric `{m['name']}` | {'present, filter matches the spec' if good else ('absent' if cur is None else 'filter differs from the spec')} |")
    ret_ok = int(b.get("retentionDays", 0)) == int(retention_spec["retentionDays"]); ok = ok and ret_ok
    rows.append(f"| {'✓' if ret_ok else '✗'} | `_Default` retention | {b.get('retentionDays')} days live; spec {retention_spec['retentionDays']} days, {retention_spec['status']}; sinks: none |")
    qrows = run_queries()
    for service, count, more, sample in qrows:
        rows.append(f"| ✓ | 24-hour query: {service} | {count}{'+' if more else ''} matching entries{'; ' + sample if sample else ''} |")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp[:10]}-log-metrics.md"
    with open(path, "w") as f:
        f.write(f"# Log-based metrics, retention and the 24-hour queries\n\nDeliverable 12.3. Generated by `infrastructure/monitoring/apply.sh verify` at {stamp} from the committed specs; rerun to refresh. A query row is a count of matching log entries in the last 24 hours (zero on a healthy day), with the latest entry as the sample.\n\n| | Check | Evidence |\n|---|---|---|\n" + "\n".join(rows) + f"\n\nResult: {'metrics and retention match the spec; queries ran' if ok else 'ATTENTION: see the ✗ rows'}.\n")
    print("\n".join(rows)); print(f"record: {path}"); return ok

def reconcile_channels():
    live = by_name(paged(f"{API}/notificationChannels", "notificationChannels"))
    out = {}
    for c in channels_spec:
        desired = {"type": c["type"], "displayName": c["displayName"], "labels": c["labels"], "enabled": True}
        cur = live.get(c["displayName"])
        if cur is None:
            act("channel", "create", c["displayName"], c["type"])
            if not DRY: cur = call("POST", f"{API}/notificationChannels", desired)
        elif cur.get("labels") != c["labels"] or cur.get("enabled") is False:
            act("channel", "update", c["displayName"])
            if not DRY: cur = call("PATCH", f"https://monitoring.googleapis.com/v3/{cur['name']}", {**desired, "name": cur["name"]}, {"updateMask": "labels,enabled"})
        else:
            act("channel", "unchanged", c["displayName"])
        if cur: out[c["displayName"]] = cur["name"]
    return out

def desired_check(c):
    return {
        "displayName": c["displayName"],
        "monitoredResource": {"type": "uptime_url", "labels": {"project_id": P, "host": c["host"]}},
        "httpCheck": {"path": c["path"], "port": 443, "useSsl": True, "validateSsl": True, "requestMethod": "GET",
                      "acceptedResponseStatusCodes": [{"statusClass": s} for s in c["acceptedStatusClasses"]]},
        "period": f"{c['periodSeconds']}s", "timeout": f"{c['timeoutSeconds']}s", "checkerType": "STATIC_IP_CHECKERS",
    }

def check_differs(cur, want):
    h = cur.get("httpCheck", {})
    return (h.get("path") != want["httpCheck"]["path"] or cur.get("period") != want["period"] or cur.get("timeout") != want["timeout"]
            or sorted(s["statusClass"] for s in h.get("acceptedResponseStatusCodes", [])) != sorted(s["statusClass"] for s in want["httpCheck"]["acceptedResponseStatusCodes"]))

def reconcile_checks():
    live = by_name(paged(f"{API}/uptimeCheckConfigs", "uptimeCheckConfigs"))
    out = {}
    for c in checks_spec:
        want = desired_check(c); cur = live.get(c["displayName"])
        if cur is None:
            act("check", "create", c["displayName"], f"{c['host']}{c['path']}")
            if not DRY: cur = call("POST", f"{API}/uptimeCheckConfigs", want)
        elif cur["monitoredResource"]["labels"].get("host") != c["host"]:
            act("check", "RECREATE", c["displayName"], f"host is immutable: live {cur['monitoredResource']['labels'].get('host')} vs spec {c['host']}; delete by hand, then re-run")
        elif check_differs(cur, want):
            act("check", "update", c["displayName"])
            if not DRY: cur = call("PATCH", f"https://monitoring.googleapis.com/v3/{cur['name']}", {**want, "name": cur["name"]}, {"updateMask": "httpCheck,period,timeout"})
        else:
            act("check", "unchanged", c["displayName"])
        if cur: out[c["displayName"]] = cur["name"]
    return out

def desired_policy(c, check_name, channel_names):
    check_id = check_name.split("/")[-1]
    return {
        "displayName": f"Uptime: {c['displayName']}",
        "combiner": "OR",
        "conditions": [{
            "displayName": f"{c['host']}{c['path']} failing from more than one checker",
            "conditionThreshold": {
                "filter": f'metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.label.check_id="{check_id}" AND resource.type="uptime_url"',
                "aggregations": [{"alignmentPeriod": "1200s", "perSeriesAligner": "ALIGN_NEXT_OLDER", "crossSeriesReducer": "REDUCE_COUNT_FALSE", "groupByFields": ["resource.label.*"]}],
                "comparison": "COMPARISON_GT", "thresholdValue": 1, "duration": "60s", "trigger": {"count": 1},
            },
        }],
        "notificationChannels": sorted(channel_names),
        "alertStrategy": {"autoClose": "1800s"},
        "documentation": {"content": f"Uptime check `{c['displayName']}` on `{c['host']}{c['path']}` is failing from more than one checker. Runbook entry: Phase 13 (13.5). Spec: infrastructure/monitoring/spec/uptime.json.", "mimeType": "text/markdown"},
        "enabled": True,
    }

def policy_differs(cur, want):
    cc = cur["conditions"][0]["conditionThreshold"]; wc = want["conditions"][0]["conditionThreshold"]
    return (cc.get("filter") != wc["filter"] or sorted(cur.get("notificationChannels", [])) != want["notificationChannels"]
            or cur.get("enabled") is False or cc.get("duration") != wc["duration"] or cc.get("thresholdValue") != wc["thresholdValue"])

def reconcile_policies(check_names, channel_names):
    live = by_name(paged(f"{API}/alertPolicies", "alertPolicies"))
    for c in checks_spec:
        if not c.get("alert"): continue
        if c["displayName"] not in check_names:
            act("policy", "skip", f"Uptime: {c['displayName']}", "check not created yet (dry run)"); continue
        want = desired_policy(c, check_names[c["displayName"]], list(channel_names.values())); cur = live.get(want["displayName"])
        if cur is None:
            act("policy", "create", want["displayName"])
            if not DRY: call("POST", f"{API}/alertPolicies", want)
        elif policy_differs(cur, want):
            act("policy", "update", want["displayName"])
            if not DRY: call("PATCH", f"https://monitoring.googleapis.com/v3/{cur['name']}", {**want, "name": cur["name"]}, {"updateMask": "conditions,notificationChannels,alertStrategy,documentation,enabled"})
        else:
            act("policy", "unchanged", want["displayName"])

def series(check_id, minutes):
    end = datetime.now(timezone.utc); start = end - timedelta(minutes=minutes)
    d = call("GET", f"{API}/timeSeries", params={
        "filter": f'metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND metric.label.check_id="{check_id}"',
        "interval.startTime": start.isoformat(), "interval.endTime": end.isoformat(), "view": "FULL"})
    pts = [(pt["interval"]["endTime"], pt["value"].get("boolValue", False), ts.get("metric", {}).get("labels", {}).get("checker_location", ts["resource"]["labels"].get("checker_location", "?")))
           for ts in d.get("timeSeries", []) for pt in ts.get("points", [])]
    return sorted(pts)

def verify():
    live = by_name(paged(f"{API}/uptimeCheckConfigs", "uptimeCheckConfigs"))
    channels = by_name(paged(f"{API}/notificationChannels", "notificationChannels"))
    policies = by_name(paged(f"{API}/alertPolicies", "alertPolicies"))
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"); rows = []; ok = True
    for c in checks_spec:
        cur = live.get(c["displayName"])
        if not cur: rows.append(f"| ✗ | {c['displayName']} | `{c['host']}{c['path']}` | not created | | |"); ok = False; continue
        pts = series(cur["name"].split("/")[-1], 30)
        passed = sum(1 for _, v, _ in pts if v); latest = pts[-1] if pts else None
        pol = policies.get(f"Uptime: {c['displayName']}")
        chans = [n for n, ch in channels.items() if pol and ch["name"] in pol.get("notificationChannels", [])] if pol else []
        good = bool(pts) and passed == len(pts) and pol is not None and len(chans) == len(channels_spec)
        ok = ok and good
        rows.append(f"| {'✓' if good else '✗'} | {c['displayName']} | `{c['host']}{c['path']}` | {passed}/{len(pts)} passed in 30 min | {latest[0][:19] + ' ' + ('pass' if latest[1] else 'FAIL') + ' from ' + latest[2] if latest else 'no points yet'} | {'policy → ' + ', '.join(sorted(chans)) if pol else 'no policy'} |")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp[:10]}-uptime-checks.md"
    with open(path, "w") as f:
        f.write(f"# Uptime checks and their alerts\n\nDeliverable 12.2. Generated by `infrastructure/monitoring/apply.sh verify` at {stamp} from the committed specs; rerun to refresh.\n\n| | Check | Surface | Results | Latest | Alerting |\n|---|---|---|---|---|---|\n" + "\n".join(rows) + f"\n\nChannels: {', '.join(sorted(channels))}.\n\nResult: {'all checks passing and alerting' if ok else 'ATTENTION: see the ✗ rows'}.\n")
    print("\n".join(rows)); print(f"record: {path}")
    if not ok: sys.exit(1)

def pull(sub, seconds):
    deadline = time.time() + seconds
    while time.time() < deadline:
        d = call("POST", f"{PUBSUB}/subscriptions/{sub}:pull", {"maxMessages": 10})
        msgs = d.get("receivedMessages", [])
        if msgs:
            call("POST", f"{PUBSUB}/subscriptions/{sub}:acknowledge", {"ackIds": [m["ackId"] for m in msgs]})
            for m in msgs:
                data = json.loads(base64.b64decode(m["message"].get("data", "")).decode() or "{}")
                yield m["message"].get("publishTime", ""), data
        time.sleep(20)

def rehearse():
    name = ARG or "claudish-proxy-health"
    c = next(x for x in checks_spec if x["displayName"] == name)
    live = by_name(paged(f"{API}/uptimeCheckConfigs", "uptimeCheckConfigs")); cur = live[name]
    topic = [ch for ch in channels_spec if ch["type"] == "pubsub"][0]["labels"]["topic"].split("/")[-1]; sub = f"{topic}-verify"
    wait = int(os.environ["REHEARSE_WAIT_MIN"]) * 60
    stamp = datetime.now(timezone.utc); lines = [f"# Uptime alert rehearsal: {name}", "", f"Deliverable 12.2. Generated by `infrastructure/monitoring/apply.sh rehearse {name}` starting {stamp.strftime('%Y-%m-%dT%H:%M:%SZ')}. The check was pointed at a missing path, the alert's notification was read from the Pub/Sub channel by this script, and the check was restored.", ""]
    broken = {**desired_check(c), "name": cur["name"]}; broken["httpCheck"]["path"] = c["path"].rstrip("/") + "/rehearsal-missing-" + stamp.strftime("%H%M%S")
    for _ in pull(sub, 1): pass  # drain anything stale
    if DRY: print(f"[dry-run] would point {name} at {broken['httpCheck']['path']} and wait up to {wait//60} min for the alert"); return
    print(f"pointing {name} at {broken['httpCheck']['path']}; waiting up to {wait//60} min for the OPEN notification")
    call("PATCH", f"https://monitoring.googleapis.com/v3/{cur['name']}", broken, {"updateMask": "httpCheck"})
    opened = closed = None
    try:
        t0 = time.time()
        for at, data in pull(sub, wait):
            inc = data.get("incident", {})
            if name in json.dumps(data) and inc.get("state") == "open":
                opened = (at, inc.get("incident_id"), inc.get("policy_name"), inc.get("summary", "")[:160]); break
    finally:
        call("PATCH", f"https://monitoring.googleapis.com/v3/{cur['name']}", {**desired_check(c), "name": cur["name"]}, {"updateMask": "httpCheck"})
        print(f"restored {name} to {c['path']}")
    if opened:
        lines.append(f"- OPEN notification received at {opened[0]} after {int(time.time()-t0)//60} min: incident `{opened[1]}`, policy `{opened[2]}`: {opened[3]}")
        for at, data in pull(sub, wait):
            inc = data.get("incident", {})
            if inc.get("incident_id") == opened[1] and inc.get("state") == "closed": closed = at; break
        lines.append(f"- CLOSED notification received at {closed}" if closed else f"- CLOSED notification not seen within {wait//60} min of restoring the path (the policy auto-closes after 30 min; the email channel carries the same notification)")
        lines.append(f"- The email channel `ops-email` is on the same policy, so the same notification went to the inbox; the Pub/Sub receipt above is the machine record.")
    else:
        lines.append(f"- No OPEN notification arrived within {wait//60} min; the check was restored. Investigate the policy and the Pub/Sub publisher binding before relying on this alert.")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp.strftime('%Y-%m-%d')}-uptime-rehearsal.md"
    open(path, "w").write("\n".join(lines) + "\n"); print("\n".join(lines[3:])); print(f"record: {path}"); sys.exit(0 if opened else 1)

if CMD == "apply":
    print("═══ channels ═══"); ch = reconcile_channels()
    print("═══ uptime checks ═══"); ck = reconcile_checks()
    print("═══ alert policies ═══"); reconcile_policies(ck, ch)
    print("═══ log-based metrics ═══"); reconcile_metrics()
    print("═══ log retention ═══"); reconcile_retention()
    print("═══ alert policies (spec) ═══"); reconcile_spec_policies(ch)
    if DRY: print("dry run: nothing written")
elif CMD == "verify":
    print("═══ log-based metrics, retention, queries ═══"); logs_ok = verify_metrics_and_logs()
    print("═══ alert policies ═══"); pol_ok = verify_policies()
    print("═══ uptime checks ═══"); verify(); sys.exit(0 if (logs_ok and pol_ok) else 1)
elif CMD == "rehearse-policy":
    rehearse_policy()
elif CMD == "rehearse":
    rehearse()
PYEOF
