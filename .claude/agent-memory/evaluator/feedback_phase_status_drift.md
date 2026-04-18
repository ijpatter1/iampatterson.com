---
name: PHASE_STATUS.md test-count drift
description: The test-count line in PHASE_STATUS.md header tends to be stale by the time of handoff, because pass-1/pass-2/pass-3 evaluator fixes add tests after PHASE_STATUS was written. Verify the header count against `npm test` output before accepting a PASS verdict.
type: feedback
---

Rule: On handoff evaluations, check the PHASE_STATUS.md header's "N tests passing" claim against actual `npm test` output.

**Why:** On Phase 9A-redesign handoff, PHASE_STATUS header read "577 tests passing" while actual count was 593. The header was written in the D10 finalize commit (beab71f), before pass-1 (069b04a), pass-2 (523a5f9), and close-out (1379bd8) added tests. This drift is low-severity but flags the session did not refresh docs after the multi-pass evaluator cycle — a Minor issue worth reporting.

**How to apply:** After running `npm test`, grep PHASE_STATUS.md for the test count, compare, and flag as Minor if they disagree. Same check for CLAUDE.md current-phase line if it mentions a count.
