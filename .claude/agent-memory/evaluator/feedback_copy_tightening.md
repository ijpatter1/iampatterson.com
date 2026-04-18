---
name: Copy tightening during close-out commits
description: Close-out commits that promote ambiguous claims ("X") into definite claims ("X — live") can move the copy from vague-but-defensible into inaccurate-if-not-actually-demonstrable. When reviewing close-out/polish commits, verify each "— live" or "happening now" qualifier against actual runtime behavior.
type: feedback
---

Rule: When a close-out commit tightens product copy from neutral to confident ("— live", "happening now", "visible when you open"), verify each qualifier against runtime behavior before accepting.

**Why:** On Phase 9A-redesign pass-3 close-out (commit 1379bd8), the subscription and lead-gen demo cards gained "— live" suffixes on bullets like "Full lifecycle instrumentation: signup → trial → paid → churn — live" and "PII hashing happens server-side in sGTM — live". In fact, `paid` and `churn` events are not fired from the subscription demo front-end, and PII hashing isn't demonstrated anywhere in the shipped app. The tightening was intended to create symmetric honesty with the e-commerce card's "— live" suffixes (which ARE demonstrable via 9B-deliverable undersides), but ended up making less-grounded claims look more grounded.

**How to apply:** For any commit diff where copy shifts from speculative to definite ("— live", "now", "live", "watch it happen"), grep the codebase for the concrete mechanism the copy implies (event name, hash function, consent-routing flip) and verify it actually runs where the user would look for it. If the supporting code isn't there, flag as Critical or Important — false confidence is worse than vague confidence on a portfolio site.
