# Claudish on Claude Haiku 5.5: deploy and live checks, 2026-11-15 (20.1)

## Deploy

- Merged as `2e6110db31e1c39603ea264d45ced618de40520b` (#195). Deployed from a clean checkout at that commit: `git status` empty, `HEAD` equal to the merge SHA.
- `scripts/deploy-cloud-run.sh deploy claudish-proxy …` built `claudish-proxy-00034-vcv` with no traffic. Its diff against the serving `claudish-proxy-00033-vr6` showed the image digest only, with 0 other fields changed (`docs/verification/deploys/claudish-proxy-00034-vcv.diff`).
- `promote claudish-proxy claudish-proxy-00034-vcv` routed 100% of traffic to it, and `/health` answered 200.
- The service sets no `VERTEX_MODEL_ID` or `ANTHROPIC_MODEL_ID`. The rollback target is `claudish-proxy-00033-vr6`. Roll back by promoting that revision, never by a model override.

## Golden suite before the merge, `anthropic-api` lane

- en2cl: 21 of 21 cases passed, including the five refusal cases (17 to 21). The 2,264-character case ended with `end_turn`.
- `GOLDEN_REPEAT=3`, en2cl: `[golden] en2cl pass rate on anthropic-api: 62/63 runs (3 per case)`. en2cl-16-long-post passed 2 of 3; the miss failed `expands` (2,375 characters out for 2,264 in).
- cl2en on the Gemini loop: cl2en-08 and cl2en-13 failed. They fail the same way on the pre-20.1 `main`, and this change doesn't touch that path.
- The Vertex lanes couldn't be run. The project's Claude Haiku quota on Vertex is zero (global answers 429) and us-east5 answers 404, for Haiku 4.5 and 5.5 alike.

## Smoke test and prompt cache, deployed service

- en2cl and cl2en each streamed a translation and ended with `done`.
- Two different en2cl requests: the first read 0 cached tokens, the second read 6,946. The prefix is about 2% above the planned ~6,800, so `CLAUDE_CHARS_PER_TOKEN` stays. The request log records cache reads but not cache writes.

## Latency, deployed service

`scripts/run-claudish-latency.sh` stopped on HTTP 429. It sends 40 calls back to back, and the proxy allows 20 per minute per IP. Its input lists are also shorter than its 20 iterations, so it repeats inputs and partly measures the response cache. The numbers below come from the harness's measurement code run with one call started every 3.5 seconds:

- Harness inputs, 40 calls: `[latency] all: n=40 ttft p50=59ms p95=753ms | full-render p95 (<300 chars)=1143ms`. 29 of the 40 calls were cache hits, so this line does not measure the model.
- 20 uncached en2cl inputs: `[latency] en2cl uncached n=20 ttft p50=894ms p95=2844ms max=3327ms | full-render p50=1159ms p95=3089ms`.
- Uncached cl2en (Gemini loop), 6 samples: time to first token p50 580 ms, p95 598 ms.

Against the targets (time to first token p50 under 1 s, p95 under 2 s, full render p95 under 3 s), p50 passes; p95 and full render p95 (3,089 ms) miss. The request log shows why: every en2cl call that took longer than 2.7 s made three lane attempts, two failed Vertex calls before `anthropic-api`. Calls that went straight to `anthropic-api` started in 0.7 to 1.1 s. The breaker retries a failed lane after 30 seconds, so a request roughly every 30 seconds pays for both Vertex failures.

## Vertex lanes off, the baseline of record

Ian turned the Vertex lanes off without removing them (2026-11-15). The live service was updated to `LANES=anthropic-api,cache-only`, which made `claudish-proxy-00035-z47`. Its diff against `00034-vcv` shows the same image digest and `env.LANES` as the only change. It was promoted and `/health` answered 200.

- 20 uncached en2cl inputs: `[latency] en2cl uncached n=20 ttft p50=965ms p95=1295ms max=1688ms | full-render p50=1139ms p95=1651ms`. All calls took one lane attempt.
- All three targets are met: time to first token p50 under 1 s, p95 under 2 s, and full render p95 under 3 s.

Rollback for the model is promoting `claudish-proxy-00033-vr6`, which serves Haiku 4.5 at its own prices. **Env lives on each revision:** 00033 and 00034 both carry the four-lane `LANES` and `KILL_SWITCH=off`, so after either rollback run `scripts/deploy-cloud-run.sh set-env claudish-proxy LANES=anthropic-api,cache-only --promote`, and the kill switch again if it was on.

## Found during the deploy: the kill switch did not take effect

`scripts/deploy-cloud-run.sh promote` routes traffic to a named revision. After that, `gcloud run services update --update-env-vars …` creates a new revision that gets 0% of traffic. The `LANES` update did exactly that until `00035-z47` was promoted. The documented kill switch is the same kind of update, so on any service promoted by name it would not have stopped spending. #196 first added `update-traffic --to-revisions=LATEST=100`; its review found that unsafe, because LATEST can be an unpromoted, unreviewed revision. The fix that replaced it is `scripts/deploy-cloud-run.sh kill-switch claudish-proxy on|off` (and `set-env` for other env changes), which builds on the serving image, refuses to promote anything else that moved, and promotes that exact revision. It has not been exercised against production.
