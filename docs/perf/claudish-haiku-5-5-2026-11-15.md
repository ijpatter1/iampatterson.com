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

Against the targets (time to first token p50 under 1 s, p95 under 2 s), p50 passes and p95 misses. The request log shows why: every en2cl call that took longer than 2.7 s made three lane attempts, two failed Vertex calls before `anthropic-api`. Calls that went straight to `anthropic-api` started in 0.7 to 1.1 s. The breaker retries a failed lane after 30 seconds, so a request roughly every 30 seconds pays for both Vertex failures.
