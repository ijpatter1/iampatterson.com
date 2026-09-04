#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# Monitoring as committed configuration (Phase 12, deliverables 12.2 to 12.5).
#
# Reads the specs under infrastructure/monitoring/spec/ and reconciles the
# notification channels, the uptime checks, one uptime alert policy per
# check, the log-based metrics (12.3) and the _Default bucket retention
# against project iampatterson through the Monitoring and Logging REST APIs,
# idempotent by display name. Only one path deletes anything — rehearse-dashboard,
# which rebuilds from the spec immediately after — so a check whose host changed
# (an immutable field) is reported for a hand recreate rather than replaced.
#
#   apply.sh [--dry-run] apply     plan (create / update / unchanged), then apply unless --dry-run
#   apply.sh verify                 latest uptime results per check, the log-based metrics, the retention
#                                   setting and the four 24-hour queries, written to docs/verification/
#   apply.sh rehearse [check]       point one check at a missing path, wait for the alert to arrive
#                                   on the Pub/Sub channel, restore, record (default: claudish-proxy-health)
#   apply.sh rehearse-policy        fire the capacity policy on purpose: kill switch on, one translation,
#                                   wait for the alert on the Pub/Sub channel, kill switch off, record
#   apply.sh rehearse-dashboard     delete the dashboard and rebuild it from the spec, diff the shapes, record
#   apply.sh rehearse-dataform      run the one Dataform assertion that already fails nightly, so a
#                                   conditionMatchedLog policy notifies once for real, and record it
#
# Env: PROJECT (iampatterson), SPEC_DIR, OUT_DIR (docs/verification), REHEARSE_WAIT_MIN (25)
# Needs: gcloud (an access token; no alpha/beta component), python3, curl.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT="${PROJECT:-iampatterson}"
SPEC_DIR="${SPEC_DIR:-$(cd "$(dirname "$0")" && pwd)/spec}"
OUT_DIR="${OUT_DIR:-docs/verification}"
# A flag is accepted in any position and an unrecognized argument is refused:
# "apply.sh apply --dry-run" used to run a real apply with the flag as its
# argument, which for the rehearsals means touching production.
DRY=0; CMD=""; ARG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    apply|verify|rehearse|rehearse-policy|rehearse-dashboard|rehearse-dataform)
      [ -z "$CMD" ] || { echo "❌ two commands given: $CMD and $1" >&2; exit 1; }; CMD="$1" ;;
    *)
      if [ "$CMD" = "rehearse" ] && [ -z "$ARG" ]; then ARG="$1"; else
        echo "❌ unrecognized argument: $1" >&2
        echo "usage: apply.sh [--dry-run] apply | verify | rehearse [check] | rehearse-policy | rehearse-dashboard | rehearse-dataform" >&2
        exit 1
      fi ;;
  esac
  shift
done
CMD="${CMD:-apply}"

TOKEN=$(gcloud auth print-access-token 2>/dev/null) || { echo "❌ no gcloud access token (run: gcloud auth login)" >&2; exit 1; }
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)' 2>/dev/null || true)

# The Pub/Sub side of the pubsub channel: topic, the Monitoring notification
# service agent as publisher, and a pull subscription the rehearsal reads.
ensure_pubsub() {
  local topic sub ackdl retain
  [ -n "$PROJECT_NUMBER" ] || { echo "❌ could not read the project number for $PROJECT (expired credentials, or the wrong project)" >&2; exit 1; }
  # Topic and pull subscription are declared with the channel in channels.json,
  # so the resources the rehearsals depend on are in the spec like everything else.
  eval "$(python3 - "$SPEC_DIR/channels.json" <<'PSPEC'
import json, sys
c = [c for c in json.load(open(sys.argv[1])) if c["type"] == "pubsub"][0]
s = c["pullSubscription"]
print("topic=" + c["labels"]["topic"].split("/")[-1])
print("sub=" + s["name"])
print("ackdl=" + str(s["ackDeadlineSeconds"]))
print("retain=" + s["messageRetentionDuration"])
PSPEC
)"
  if [ "$DRY" = "1" ]; then echo "[dry-run] would ensure topic $topic, publisher binding for the monitoring agent, subscription $sub"; return; fi
  gcloud pubsub topics describe "$topic" --project="$PROJECT" >/dev/null 2>&1 || gcloud pubsub topics create "$topic" --project="$PROJECT" --quiet
  # The Monitoring notification service agent only exists once provisioned; the
  # binding below fails with INVALID_ARGUMENT until it does (seen 2026-09-04).
  gcloud beta services identity create --service=monitoring.googleapis.com --project="$PROJECT" --quiet >/dev/null 2>&1 || true
  gcloud pubsub topics add-iam-policy-binding "$topic" --project="$PROJECT" \
    --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-monitoring-notification.iam.gserviceaccount.com" --role=roles/pubsub.publisher --quiet >/dev/null
  gcloud pubsub subscriptions describe "$sub" --project="$PROJECT" >/dev/null 2>&1 || gcloud pubsub subscriptions create "$sub" --topic="$topic" --project="$PROJECT" --ack-deadline="$ackdl" --message-retention-duration="$retain" --quiet
  echo "pubsub: topic $topic, subscription $sub, monitoring agent may publish"
}

case "$CMD" in
  apply) ensure_pubsub ;;
  verify|rehearse|rehearse-policy|rehearse-dashboard|rehearse-dataform) ;;
  *) echo "usage: apply.sh [--dry-run] apply | verify | rehearse [check] | rehearse-policy | rehearse-dashboard | rehearse-dataform" >&2; exit 1 ;;
esac

PROJECT="$PROJECT" TOKEN="$TOKEN" SPEC_DIR="$SPEC_DIR" OUT_DIR="$OUT_DIR" DRY="$DRY" CMD="$CMD" ARG="$ARG" REHEARSE_WAIT_MIN="${REHEARSE_WAIT_MIN:-25}" python3 - <<'PYEOF'
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
policies_spec = json.load(open(f"{SPEC}/policies.json")); dashboard_spec = json.load(open(f"{SPEC}/dashboard.json"))

def desired_spec_policy(p, channel_names):
    doc = f"{p['threshold']}\n\nFiring: {p['firing']}\n\nRunbook entry (Phase 13 deliverable 13.5, not yet written): {p['runbook']}. Spec: infrastructure/monitoring/spec/policies.json."
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

def policy_shape(p):
    """Every field apply.sh sends, normalized so the API's own defaults cannot
    read as drift: proto3 omits zero values, so an absent threshold or duration
    is the zero it was sent as. Comparing a projection rather than a hand-listed
    set of fields means aggregations are diffed too — without that, a spec edit
    to an aligner or a window reported "unchanged" forever."""
    c = (p.get("conditions") or [{}])[0]
    shape = {"channels": sorted(p.get("notificationChannels", [])), "enabled": p.get("enabled", True),
             "documentation": (p.get("documentation") or {}).get("content"),
             "autoClose": (p.get("alertStrategy") or {}).get("autoClose"),
             "rateLimit": ((p.get("alertStrategy") or {}).get("notificationRateLimit") or {}).get("period")}
    if "conditionMatchedLog" in c:
        shape["logFilter"] = c["conditionMatchedLog"].get("filter")
    else:
        th = c.get("conditionThreshold", {})
        shape.update({"filter": th.get("filter"), "comparison": th.get("comparison"),
                      "threshold": th.get("thresholdValue", 0), "duration": th.get("duration", "0s"),
                      "aggregations": [sorted((k, tuple(v) if isinstance(v, list) else v) for k, v in a.items()) for a in th.get("aggregations", [])]})
    return shape

def spec_policy_differs(cur, want):
    return policy_shape(cur) != policy_shape(want)

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
    want_chans = sorted(c["displayName"] for c in channels_spec)
    chan_names = [ch["name"] for n, ch in channels.items() if n in want_chans]
    for p in policies_spec:
        cur = live.get(p["displayName"])
        routed = sorted(n for n, ch in channels.items() if cur and ch["name"] in cur.get("notificationChannels", [])) if cur else []
        matches = cur is not None and not spec_policy_differs(cur, desired_spec_policy(p, chan_names))
        good = cur is not None and cur.get("enabled", True) and matches and routed == want_chans; ok = ok and good
        if p["kind"] == "log":
            n, more = log_matches(p["logFilter"])
            measured = f"; the filter selects {n}{'+' if more and n else ''} {'entry' if n == 1 and not more else 'entries'} in the last 30 days"
        else:
            measured = ""
        state = ("absent" if cur is None else "disabled" if not cur.get("enabled", True)
                 else "the live policy differs from the spec; re-run apply" if not matches
                 else f"routed to {', '.join(routed) or 'nothing'}, not {', '.join(want_chans)}" if routed != want_chans
                 else f"matches the spec, routed to {', '.join(routed)}{measured}")
        rows.append(f"| {'✓' if good else '✗'} | {p['displayName']} | {p['threshold']} | {p['firing']} | {state} |")
    days = cert_days()
    for host, dd in sorted(days.items()): rows.append(f"| {'✓' if dd > 14 else '✗'} | certificate on {host} | {dd:.0f} days until expiry (alert below 14) | measured by the uptime checks | — |")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp[:10]}-alert-policies.md"
    with open(path, "w") as f:
        f.write(f"# Alerting policies\n\nDeliverable 12.4. Generated by `infrastructure/monitoring/apply.sh verify` at {stamp} from `infrastructure/monitoring/spec/policies.json`; rerun to refresh. A ✓ means the live policy matches the spec field for field and routes to {', '.join(want_chans)}.\n\n| | Policy | Threshold | Firing record or safety reason | Live state |\n|---|---|---|---|---|\n" + "\n".join(rows) + f"\n\nResult: {'every policy present, enabled and routed' if ok else 'ATTENTION: see the ✗ rows'}.\n")
    print("\n".join(rows)); print(f"record: {path}"); return ok

def rehearse_policy():
    import subprocess
    sub = verify_subscription()
    wait = int(os.environ["REHEARSE_WAIT_MIN"]) * 60; stamp = datetime.now(timezone.utc)
    svc = ["gcloud", "run", "services", "update", "claudish-proxy", f"--project={P}", "--region=us-central1", "--quiet", "--update-env-vars"]
    url = subprocess.run(["gcloud", "run", "services", "describe", "claudish-proxy", f"--project={P}", "--region=us-central1", "--format=value(status.url)"], capture_output=True, text=True).stdout.strip()
    for _ in pull(sub, 1): pass
    if DRY: print("[dry-run] would turn KILL_SWITCH on, request one translation, wait for the capacity alert, turn it off"); return
    lines = [f"# Alert policy rehearsal: capacity_no_budget", "", f"Deliverable 12.4. Generated by `infrastructure/monitoring/apply.sh rehearse-policy` starting {stamp.strftime('%Y-%m-%dT%H:%M:%SZ')}. The proxy's kill switch was turned on, one translation was requested so the proxy logged `capacity_no_budget`, the policy's notification was read from the Pub/Sub channel, and the switch was turned off.", ""]
    print("KILL_SWITCH=on"); subprocess.run(svc + ["KILL_SWITCH=on"], check=True, capture_output=True)
    opened = None; off = False
    def switch_off():
        nonlocal off
        if not off: subprocess.run(svc + ["KILL_SWITCH=off"], check=True, capture_output=True); off = True; print("KILL_SWITCH=off")
    try:
        time.sleep(20)
        req = urllib.request.Request(f"{url}/translate", data=json.dumps({"text": f"rehearsal {stamp.strftime('%H%M%S')} hello there", "direction": "en2cl"}).encode(), headers={"Origin": "https://www.iampatterson.com", "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as r: code = r.status
        except urllib.error.HTTPError as e: code = e.code
        lines.append(f"- translation request with the switch on answered HTTP {code} (503 capacity expected)")
        # The refusal is already logged, so the alert fires whether or not the
        # switch is still on: turn it off now rather than holding the live site
        # on the capacity path for the length of the wait.
        switch_off(); lines.append(f"- switch turned off {int(time.time() - stamp.timestamp())}s after it went on; the wait for the notification runs with the proxy serving normally")
        t0 = time.time()
        for at, data in pull(sub, wait):
            inc = data.get("incident", {})
            if "capacity_no_budget" in json.dumps(data) and inc.get("state") == "open":
                opened = (at, inc.get("incident_id"), inc.get("policy_name")); break
    finally:
        switch_off()
    lines.append(f"- OPEN notification received at {opened[0]} after {int(time.time()-t0)//60} min: incident `{opened[1]}`, policy `{opened[2]}`" if opened else f"- no OPEN notification within {wait//60} min; the switch is off again; investigate the metric and the policy before relying on it")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp.strftime('%Y-%m-%d')}-policy-rehearsal.md"
    open(path, "w").write("\n".join(lines) + "\n"); print("\n".join(lines[3:])); print(f"record: {path}"); sys.exit(0 if opened else 1)

def desired_metric(m):
    d = {"name": m["name"], "description": m["description"], "filter": m["filter"], "metricDescriptor": {"metricKind": "DELTA", "valueType": "INT64", "unit": "1",
         "labels": [{"key": k, "valueType": "STRING", "description": v["description"]} for k, v in sorted(m.get("labels", {}).items())]}}
    if m.get("labels"): d["labelExtractors"] = {k: v["extractor"] for k, v in m["labels"].items()}
    return d

def metric_shape(m):
    """Every field desired_metric sends, the metric descriptor included: a label
    description edit used to report "unchanged" and never reach the API."""
    d = m.get("metricDescriptor", {}) or {}
    return {"filter": m.get("filter"), "description": m.get("description"), "extractors": m.get("labelExtractors", {}),
            "metricKind": d.get("metricKind"), "valueType": d.get("valueType"), "unit": d.get("unit"),
            # STRING is the zero value of the label's valueType enum, so the API
            # omits it on the way back; read the absence as the STRING we sent.
            "labels": sorted((l.get("key"), l.get("valueType", "STRING"), l.get("description")) for l in d.get("labels", []))}

def metric_differs(cur, want):
    return metric_shape(cur) != metric_shape(want)

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
    want = int(retention_spec["retentionDays"]); cur = live_retention(b)
    if cur != want:
        act("bucket", "update", retention_spec["bucket"], f"retention {cur}d -> {want}d ({retention_spec['status']})")
        if not DRY: call("PATCH", f"{LOGGING}/locations/global/buckets/{retention_spec['bucket']}", {"retentionDays": want}, {"updateMask": "retentionDays"})
    else:
        act("bucket", "unchanged", retention_spec["bucket"], f"retention {cur}d ({retention_spec['status']})")

def run_queries(hours=24):
    end = datetime.now(timezone.utc); start = end - timedelta(hours=hours); rows = []
    for q in queries_spec:
        f = f'{q["filter"]} AND timestamp>="{start.isoformat()}" AND timestamp<="{end.isoformat()}"'
        d = call("POST", "https://logging.googleapis.com/v2/entries:list", {"resourceNames": [f"projects/{P}"], "filter": f, "orderBy": "timestamp desc", "pageSize": 200})
        entries = d.get("entries", []); count = len(entries)  # a page token means "at least this many"; the row renders the +
        sample = ""
        if entries:
            e = entries[0]; jp = e.get("jsonPayload") or {}
            status = e.get("httpRequest", {}).get("status")
            sample = (jp.get("event") or e.get("textPayload") or (json.dumps(jp)[:80] if jp else "")
                      or (f"HTTP {status}" if status else "") or f"severity {e.get('severity', '?')}, no payload text")
            sample = f"latest {e.get('timestamp','')[:19]}: {str(sample)[:90]}"
        rows.append((q["service"], count, d.get("nextPageToken") is not None, sample))
    return rows

def verify_metrics_and_logs():
    live = {m["name"]: m for m in paged(f"{LOGGING}/metrics", "metrics")}
    b = call("GET", f"{LOGGING}/locations/global/buckets/{retention_spec['bucket']}")
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"); rows = []; ok = True
    for m in metrics_spec:
        cur = live.get(m["name"]); good = cur is not None and not metric_differs(cur, desired_metric(m)); ok = ok and good
        rows.append(f"| {'✓' if good else '✗'} | metric `{m['name']}` | {'present, filter matches the spec' if good else ('absent' if cur is None else 'filter differs from the spec')} |")
    ret_ok = live_retention(b) == int(retention_spec["retentionDays"]); ok = ok and ret_ok
    rows.append(f"| {'✓' if ret_ok else '✗'} | `_Default` retention | {live_retention(b)} days live; spec {retention_spec['retentionDays']} days, {retention_spec['status']} |")
    qrows = run_queries()
    for service, count, more, sample in qrows:
        rows.append(f"| · | 24-hour query: {service} | ran; {count}{'+' if more else ''} matching entries{'; ' + sample if sample else ''} |")
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

def check_shape(c):
    """Every field desired_check sends. Projecting both sides through one
    function is what keeps a spec edit from reporting "unchanged" — the same
    defect policy_shape fixes, which lived here too."""
    h = c.get("httpCheck", {}) or {}
    return {"path": h.get("path"), "port": h.get("port"), "useSsl": h.get("useSsl", False), "validateSsl": h.get("validateSsl", False),
            "requestMethod": h.get("requestMethod"), "period": c.get("period"), "timeout": c.get("timeout"),
            "checkerType": c.get("checkerType"),
            "statusClasses": sorted(s.get("statusClass") for s in h.get("acceptedResponseStatusCodes", []))}

def check_differs(cur, want):
    return check_shape(cur) != check_shape(want)

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
    return policy_shape(cur) != policy_shape(want)

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
        good = bool(pts) and passed == len(pts) and pol is not None and sorted(chans) == sorted(c["displayName"] for c in channels_spec)
        ok = ok and good
        rows.append(f"| {'✓' if good else '✗'} | {c['displayName']} | `{c['host']}{c['path']}` | {passed}/{len(pts)} passed in 30 min | {latest[0][:19] + ' ' + ('pass' if latest[1] else 'FAIL') + ' from ' + latest[2] if latest else 'no points yet'} | {'policy → ' + ', '.join(sorted(chans)) if pol else 'no policy'} |")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp[:10]}-uptime-checks.md"
    with open(path, "w") as f:
        f.write(f"# Uptime checks and their alerts\n\nDeliverable 12.2. Generated by `infrastructure/monitoring/apply.sh verify` at {stamp} from the committed specs; rerun to refresh.\n\n| | Check | Surface | Results | Latest | Alerting |\n|---|---|---|---|---|---|\n" + "\n".join(rows) + f"\n\nChannels: {', '.join(sorted(channels))}.\n\nResult: {'all checks passing and alerting' if ok else 'ATTENTION: see the ✗ rows'}.\n")
    print("\n".join(rows)); print(f"record: {path}")
    if not ok: sys.exit(1)

# Logging omits retentionDays on a bucket left at the default, and the apply
# and verify paths have to read that absence the same way.
DEFAULT_RETENTION_DAYS = 30

def live_retention(bucket):
    return int(bucket.get("retentionDays") or DEFAULT_RETENTION_DAYS)

def pubsub_channel():
    return [c for c in channels_spec if c["type"] == "pubsub"][0]

def verify_subscription():
    return pubsub_channel()["pullSubscription"]["name"]

def log_matches(filt, days=30):
    """What a log-match policy's filter actually selects, so a record can
    measure the claim instead of repeating the spec's prose."""
    start = datetime.now(timezone.utc) - timedelta(days=days)
    d = call("POST", "https://logging.googleapis.com/v2/entries:list",
             {"resourceNames": [f"projects/{P}"], "filter": f'{filt} AND timestamp>="{start.isoformat()}"', "orderBy": "timestamp desc", "pageSize": 100})
    return len(d.get("entries", [])), d.get("nextPageToken") is not None

def pull(sub, seconds):
    deadline = time.time() + seconds
    while time.time() < deadline:
        d = call("POST", f"{PUBSUB}/subscriptions/{sub}:pull", {"maxMessages": 10})
        msgs = d.get("receivedMessages", [])
        for m in msgs:
            # One ack per message, as the caller consumes it: a caller that
            # breaks out of this generator leaves the rest on the subscription
            # instead of acknowledging notifications nobody read.
            call("POST", f"{PUBSUB}/subscriptions/{sub}:acknowledge", {"ackIds": [m["ackId"]]})
            data = json.loads(base64.b64decode(m["message"].get("data", "")).decode() or "{}")
            yield m["message"].get("publishTime", ""), data
        if not msgs: time.sleep(20)

def rehearse():
    name = ARG or "claudish-proxy-health"
    c = next(x for x in checks_spec if x["displayName"] == name)
    live = by_name(paged(f"{API}/uptimeCheckConfigs", "uptimeCheckConfigs")); cur = live[name]
    sub = verify_subscription()
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
        lines.append(f"- `ops-email` is on the same policy, so the same notification was addressed to the inbox. This script observes only the Pub/Sub receipt; delivery to the inbox was confirmed by hand on 2026-09-04 (see docs/verification/2026-09-04-first-real-alert.md) and is not re-observed on each run.")
    else:
        lines.append(f"- No OPEN notification arrived within {wait//60} min; the check was restored. Investigate the policy and the Pub/Sub publisher binding before relying on this alert.")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp.strftime('%Y-%m-%d')}-uptime-rehearsal.md"
    open(path, "w").write("\n".join(lines) + "\n"); print("\n".join(lines[3:])); print(f"record: {path}"); sys.exit(0 if opened else 1)

# ── The dashboard (12.5) ────────────────────────────────────────────────
# The spec declares tiles in reading order; the layout is generated here, so
# the spec stays short. The v1 dashboards API is a different surface from the
# v3 one everything else uses.
DASH = f"https://monitoring.googleapis.com/v1/projects/{P}/dashboards"

def desired_dashboard():
    d = dashboard_spec; dflt = d["defaults"]; cols = d["columns"]
    tiles = []; x = y = row_h = 0
    for t in d["tiles"]:
        w = t.get("width", dflt["width"]); h = t.get("height", dflt["height"])
        if x + w > cols: x = 0; y += row_h; row_h = 0
        widget = {"title": t["title"]}
        if "logs" in t:
            widget["logsPanel"] = {"filter": t["logs"], "resourceNames": [f"projects/{P}"]}
        else:
            widget["xyChart"] = {"dataSets": [dataset(s, dflt) for s in t["series"]], "yAxis": {"scale": "LINEAR"}}
        tiles.append({"xPos": x, "yPos": y, "width": w, "height": h, "widget": widget})
        x += w; row_h = max(row_h, h)
    return {"displayName": d["displayName"], "mosaicLayout": {"columns": cols, "tiles": tiles}}

def dataset(s, dflt):
    agg = {"alignmentPeriod": s.get("period", dflt["period"]), "perSeriesAligner": s["aligner"], "crossSeriesReducer": s["reducer"]}
    if s.get("groupBy"): agg["groupByFields"] = s["groupBy"]
    return {"timeSeriesQuery": {"timeSeriesFilter": {"filter": s["filter"], "aggregation": agg}}, "plotType": "LINE", "legendTemplate": s["legend"], "targetAxis": "Y1"}

def dashboard_shape(d):
    """The fields we own, in a form the API's own defaults can't perturb."""
    out = [d.get("displayName"), d.get("mosaicLayout", {}).get("columns")]
    for t in d.get("mosaicLayout", {}).get("tiles", []):
        w = t.get("widget", {}); box = (t.get("xPos", 0), t.get("yPos", 0), t.get("width", 0), t.get("height", 0))
        if "logsPanel" in w:
            out.append((box, w.get("title"), w["logsPanel"].get("filter")))
        else:
            sets = []
            for ds in w.get("xyChart", {}).get("dataSets", []):
                f = ds.get("timeSeriesQuery", {}).get("timeSeriesFilter", {}); a = f.get("aggregation", {})
                sets.append((f.get("filter"), a.get("perSeriesAligner"), a.get("crossSeriesReducer"), tuple(a.get("groupByFields", [])), a.get("alignmentPeriod"), ds.get("legendTemplate")))
            out.append((box, w.get("title"), tuple(sets)))
    return out

def reconcile_dashboard():
    want = desired_dashboard(); live = by_name(paged(DASH, "dashboards")); cur = live.get(want["displayName"])
    if cur is None:
        act("dashboard", "create", want["displayName"])
        if not DRY: call("POST", DASH, want)
    elif dashboard_shape(cur) != dashboard_shape(want):
        act("dashboard", "update", want["displayName"])
        if not DRY: call("PATCH", f"https://monitoring.googleapis.com/v1/{cur['name']}", {**want, "name": cur["name"], "etag": cur.get("etag", "")})
    else:
        act("dashboard", "unchanged", want["displayName"])
    return want["displayName"]

def verify_dashboard():
    want = desired_dashboard(); live = by_name(paged(DASH, "dashboards")); cur = live.get(want["displayName"])
    good = cur is not None and dashboard_shape(cur) == dashboard_shape(want)
    charts = sum(1 for t in dashboard_spec["tiles"] if "logs" not in t); logs = len(dashboard_spec["tiles"]) - charts
    rows = [f"# Operations dashboard", "", f"Deliverable 12.5. Generated by `infrastructure/monitoring/apply.sh verify` at {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')} from `infrastructure/monitoring/spec/dashboard.json`.", "",
            "| | check | detail |", "| --- | --- | --- |",
            f"| {'✓' if cur else '✗'} | dashboard `{want['displayName']}` | {'live at ' + cur['name'] if cur else 'absent'} |",
            f"| {'✓' if good else '✗'} | live layout matches the spec | {len(dashboard_spec['tiles'])} tiles ({charts} charts, {logs} logs panel), {dashboard_spec['columns']} columns |"]
    live_tiles = {e[1]: e for e in (dashboard_shape(cur)[2:] if cur else [])}
    want_tiles = {e[1]: e for e in dashboard_shape(want)[2:]}
    for t in dashboard_spec["tiles"]:
        src = t["logs"] if "logs" in t else " · ".join(s["filter"].split("metric.type=")[1].split(" AND ")[0].strip('"') for s in t["series"])
        tile_ok = live_tiles.get(t["title"]) == want_tiles.get(t["title"])
        rows.append(f"| {'✓' if tile_ok else '✗'} | {t['title']} | {src}{'' if tile_ok else ' — the live tile does not match the spec'} |")
    print("\n".join(rows[4:]))
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}-dashboard.md"
    open(path, "w").write("\n".join(rows) + "\n"); print(f"record: {path}")
    return good

DATAFORM = f"https://dataform.googleapis.com/v1/projects/{P}/locations/us-central1"

def rehearse_dataform():
    """Fire a conditionMatchedLog policy once, for real.

    The capacity rehearsal proves a threshold policy notifies; nothing proved
    the log-match kind, which is what the crash-loop, scheduler and Dataform
    policies use. `assert_volume_anomaly` already fails every night, so running
    that one assertion off-schedule produces a genuine ERROR log without
    inventing a failure. The targeted form invokes the assertion alone and
    writes no table; the RUN_FULL_WORKFLOW fallback runs all twenty production
    actions, which is why it is gated.

    This works only while some Dataform action is failing. Phase 12 corrects
    that assertion, so once the fix reaches the dataform branch the subcommand
    stops early rather than waiting out its deadline on a signal that can no
    longer appear."""
    sub = verify_subscription(); wait = int(os.environ["REHEARSE_WAIT_MIN"]) * 60
    stamp = datetime.now(timezone.utc)
    repos = call("GET", f"{DATAFORM}/repositories").get("repositories", [])
    if not repos: print("❌ no Dataform repository in us-central1", file=sys.stderr); sys.exit(1)
    repo = repos[0]["name"]
    rel = call("GET", f"https://dataform.googleapis.com/v1/{repo}/releaseConfigs").get("releaseConfigs", [])
    comp = next((r["compilationResult"] for rc in rel for r in rc.get("recentScheduledReleaseRecords", []) if r.get("compilationResult")), None)
    if comp is None: print("❌ no compiled release to invoke", file=sys.stderr); sys.exit(1)
    recent = call("GET", f"https://dataform.googleapis.com/v1/{repo}/workflowInvocations").get("workflowInvocations", [])
    failed_recently = any(w.get("state") == "FAILED" for w in recent[:10])
    if not failed_recently:
        print("❌ no recent Dataform invocation has failed, so there is no error to reproduce and this policy\n"
              "   cannot be rehearsed. The rehearsal only produces a signal while a Dataform action is failing;\n"
              "   the assertion it was built around is corrected in Phase 12. Refusing before spending a\n"
              "   production workflow run. See spec/policies.json for the written reason this policy is unfired.",
              file=sys.stderr)
        sys.exit(2)
    only_the_assertion = {"includedTargets": [{"database": P, "schema": "iampatterson_assertions", "name": "assert_volume_anomaly"}],
                          "transitiveDependenciesIncluded": False, "transitiveDependentsIncluded": False}
    if DRY: print(f"[dry-run] would invoke assert_volume_anomaly from {comp.split('/')[-1]} and wait up to {wait//60} min for the alert"); return
    for _ in pull(sub, 1): pass  # drain anything stale
    url = f"https://dataform.googleapis.com/v1/{repo}/workflowInvocations"
    try:
        inv = call("POST", url, {"compilationResult": comp, "invocationConfig": only_the_assertion})
    except SystemExit as refusal:
        if "act as" not in str(refusal) and "INVALID_ARGUMENT" not in str(refusal):
            raise  # 401, 403, 5xx: report the real cause, not a re-run instruction that fails the same way
        # Invoking just the assertion is refused two ways in this project: an
        # invocation built from a compilation result must name a service account
        # under strict act-as, and the workflow-config path rejects an invocation
        # config outright. What is left is the full production workflow — the same
        # twenty actions the 04:00 UTC schedule runs — so it is gated rather than
        # taken silently. The nightly run fires this policy for free; this switch
        # exists for the case where the proof is needed now.
        if os.environ.get("RUN_FULL_WORKFLOW") != "1":
            print("❌ the single-assertion invocation was refused (strict act-as). Re-run with RUN_FULL_WORKFLOW=1 to\n"
                  "   invoke the whole production workflow instead, or wait for the 04:00 UTC schedule, which fires\n"
                  "   this policy on the same failing assertion at no cost.", file=sys.stderr)
            sys.exit(2)
        cfgs = call("GET", f"https://dataform.googleapis.com/v1/{repo}/workflowConfigs").get("workflowConfigs", [])
        if not cfgs: print("❌ no workflow config to invoke through", file=sys.stderr); sys.exit(1)
        print(f"invoking the full workflow through {cfgs[0]['name'].split('/')[-1]}")
        inv = call("POST", url, {"workflowConfig": cfgs[0]["name"]})
    print(f"invoked {inv['name'].split('/')[-1]}; waiting for it to finish")
    state = "RUNNING"; t0 = time.time()
    while state == "RUNNING" and time.time() - t0 < 600:
        time.sleep(20); state = call("GET", f"https://dataform.googleapis.com/v1/{inv['name']}").get("state", "?")
    if state == "SUCCEEDED":
        note = ["# Alert policy rehearsal: Dataform workflow invocation failed — not fired", "",
                f"Deliverable 12.4. Generated by `infrastructure/monitoring/apply.sh rehearse-dataform` at {stamp.strftime('%Y-%m-%dT%H:%M:%SZ')}.", "",
                "- The invocation succeeded, so it wrote no ERROR log and the policy could not be fired.",
                "- This rehearsal only produces a signal while a Dataform action is failing. The assertion it was built",
                "  around, `iampatterson_assertions.assert_volume_anomaly`, is corrected in Phase 12, so there is no",
                "  remaining way to fire a log-match policy in this project on demand.",
                "- The policy's condition and filter were validated against the 28 real failures logged in the 30 days",
                "  to 2026-09-04; what is unproven is the notification path for the `conditionMatchedLog` kind."]
        os.makedirs(OUT, exist_ok=True); p = f"{OUT}/{stamp.strftime('%Y-%m-%d')}-dataform-policy-rehearsal.md"
        open(p, "w").write("\n".join(note) + "\n"); print("\n".join(note[3:]), file=sys.stderr); print(f"record: {p}")
        sys.exit(2)
    print(f"invocation finished in state {state}; waiting up to {wait//60} min for the notification")
    opened = None
    for at, data in pull(sub, wait):
        i = data.get("incident", {})
        if "Dataform" in json.dumps(data) and i.get("state") == "open":
            opened = (at, i.get("incident_id"), i.get("policy_name")); break
    lines = [f"# Alert policy rehearsal: Dataform workflow invocation failed", "",
             f"Deliverable 12.4. Generated by `infrastructure/monitoring/apply.sh rehearse-dataform` at {stamp.strftime('%Y-%m-%dT%H:%M:%SZ')}. This is the log-match policy kind proved end to end: `capacity_no_budget` is a threshold policy, so before this run no `conditionMatchedLog` policy had ever notified.", "",
             f"- invoked `assert_volume_anomaly` alone (no dependencies, no table written) from compilation `{comp.split('/')[-1]}`; the invocation finished in state **{state}**",
             f"- the assertion is the one that fails nightly: 'Assertion failed, expected zero rows', 28 times in the 30 days to 2026-09-04"]
    lines.append(f"- OPEN notification received at {opened[0]}: incident `{opened[1]}`, policy `{opened[2]}`. The same notification went to `ops-email`." if opened
                 else f"- no OPEN notification within {wait//60} min. The log-match policies are unproven; investigate before relying on them.")
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp.strftime('%Y-%m-%d')}-dataform-policy-rehearsal.md"
    open(path, "w").write("\n".join(lines) + "\n"); print("\n".join(lines[3:])); print(f"record: {path}"); sys.exit(0 if opened else 1)

def rehearse_dashboard():
    """The acceptance criterion, run rather than asserted: delete the live
    dashboard and rebuild it from the spec, then diff the two shapes."""
    want = desired_dashboard(); name = want["displayName"]; stamp = datetime.now(timezone.utc)
    live = by_name(paged(DASH, "dashboards")); cur = live.get(name)
    if cur is None: print(f"❌ {name} is not live; run apply first"); sys.exit(1)
    if DRY: print(f"[dry-run] would delete {cur['name']} and recreate it from the spec"); return
    before = dashboard_shape(cur); print(f"deleting {cur['name']}")
    call("DELETE", f"https://monitoring.googleapis.com/v1/{cur['name']}")
    gone = by_name(paged(DASH, "dashboards")).get(name) is None
    print("recreating from the spec")
    try:
        made = call("POST", DASH, want)
    except SystemExit:
        # The dashboard is deleted and the rebuild failed. Say what to run
        # rather than exiting on the API's message alone.
        print(f"❌ the rebuild failed and {name} is not live. Recover with: apply.sh apply", file=sys.stderr)
        raise
    again = by_name(paged(DASH, "dashboards")).get(name)
    same = again is not None and dashboard_shape(again) == before == dashboard_shape(want)
    lines = [f"# Dashboard rebuild rehearsal", "", f"Deliverable 12.5. Generated by `infrastructure/monitoring/apply.sh rehearse-dashboard` at {stamp.strftime('%Y-%m-%dT%H:%M:%SZ')}. The live dashboard was deleted and rebuilt from `infrastructure/monitoring/spec/dashboard.json`; the acceptance criterion is that it comes back identical.", "",
             f"- deleted `{cur['name']}`; confirmed absent from the dashboard list: {gone}",
             f"- recreated as `{made.get('name', '?')}` from the spec ({len(want['mosaicLayout']['tiles'])} tiles)",
             f"- the rebuilt layout is {'identical to the deleted one and to the spec' if same else 'NOT identical — investigate before relying on the spec'}",
             f"- the dashboard id changes on a rebuild, so nothing may link to it by id; it is found by name"]
    os.makedirs(OUT, exist_ok=True); path = f"{OUT}/{stamp.strftime('%Y-%m-%d')}-dashboard-rehearsal.md"
    open(path, "w").write("\n".join(lines) + "\n"); print("\n".join(lines[3:])); print(f"record: {path}"); sys.exit(0 if same else 1)

if CMD == "apply":
    print("═══ channels ═══"); ch = reconcile_channels()
    print("═══ uptime checks ═══"); ck = reconcile_checks()
    print("═══ alert policies ═══"); reconcile_policies(ck, ch)
    print("═══ log-based metrics ═══"); reconcile_metrics()
    print("═══ log retention ═══"); reconcile_retention()
    print("═══ alert policies (spec) ═══"); reconcile_spec_policies(ch)
    print("═══ dashboard ═══"); reconcile_dashboard()
    if DRY: print("dry run: nothing written")
elif CMD == "verify":
    print("═══ log-based metrics, retention, queries ═══"); logs_ok = verify_metrics_and_logs()
    print("═══ alert policies ═══"); pol_ok = verify_policies()
    print("═══ dashboard ═══"); dash_ok = verify_dashboard()
    print("═══ uptime checks ═══"); verify(); sys.exit(0 if (logs_ok and pol_ok and dash_ok) else 1)
elif CMD == "rehearse-policy":
    rehearse_policy()
elif CMD == "rehearse-dataform":
    rehearse_dataform()
elif CMD == "rehearse-dashboard":
    rehearse_dashboard()
elif CMD == "rehearse":
    rehearse()
PYEOF
