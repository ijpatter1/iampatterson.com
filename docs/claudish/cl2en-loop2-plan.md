# cl2en experiment loop 2: plan (APPROVED by Ian 2026-09-02: "go"; T1 defaults to the deployed prompt with retry temperature 0.3 unless Ian says otherwise; gcloud re-auth needed only for the T arms)

**Budget:** $20.00 new, approved 2026-09-02. **Rules:** loop 1's rules carry over unchanged
(`docs/claudish/cl2en-experiment-rules.md`: fixed sets, frozen judges, intent check per arm,
no training on loop output, nothing deploys), plus the amendments in section 5.

## 1. What loop 1 established

- Prompt and gate changes cannot lower the shipped detector's score without losing meaning; the
  fidelity judges catch it every time. The apparatus noise floor is about ±0.035 on the mean.
- The detector convicts plain translations for their transcript skeleton, not their register.
  Re-weighting human negatives inside the same character-n-gram featurizer did not move it.
- Speaker preservation lives in the few-shots: on the held-out set the minimal prompt drifted
  from "I" to "we" or "you" where the deployed prompt held first person (heldout 008, 039, 040).

## 2. The pivot

Loop 1 optimised the translator against a scoreboard that is wrong about plain English. Loop 2
targets the scoreboard's error directly: build a detector candidate that convicts Claudish and
acquits plain human prose of the same kind, using only human-written text, and evaluate it as a
candidate replacement for the product detector. Ian decides adoption; until then r7d stays the
reported scoreboard. A translator arm runs only at the end, with the fairer judge in the loop.

## 3. Measures

- Human false-positive rate by source on the fixed holdout negatives (git-docs, rust-book,
  curl-docs, wikipedia-2022, HN, usenet, movie dialogue, human turns) and on the NEW human sources
  below, held out by group. Target: technical and business prose under 3%.
- Claudish recall on the held-out transcript positives: stays at or above r7d's 0.93.
- Agreement with the frozen frontier judges' plainness ratings on loop-1 translations
  (evaluation only, never training): a detector that scores judge-rated plain translations
  below 0.5 while keeping the Claudish inputs above 0.9.
- For the final translator arm: r7d scoreboard (reported), the candidate detector (reported),
  guards, both frozen judges on the fixed subset, then the held-out set.

## 4. Arms

- D1 New human negatives that look like plain translations of technical and business content,
  all pre-2022 and human-written, fetched with provenance: Simple English Wikipedia, US
  plain-language government pages, Enron business email (cleaned), Stack Exchange accepted
  answers, developer blog posts pinned by date. Train the current featurizer on the extended mix.
  Cost: $0 (fetch and CPU).
- D2 Featurizer v5: hashed word unigrams and bigrams alongside the character n-grams, so the
  model can learn that topic words are not register. Train on the loop-1 mix and on D1's mix.
  Requires a serving-side featurizer update in the frontend and the proxy vendor copy, with the
  parity gate. Cost: $0.
- D3 Structure features: sentence-shape statistics (clause count, appositive and colon rates,
  sentence-initial pattern classes, length variance) as explicit inputs, extending v4. Cost: $0.
- D4 Combinations of D1 to D3 that clear the measures; select at most two candidates.
- T1 Translator arm with the best candidate as the loop's judge (replacing the r7d member of the
  ensemble, or the whole ensemble): minimal-or-deployed prompt per Ian's held-out read, default
  gate, facts off, retry temperature 0.3. Evaluated as in loop 1 against the deployed baseline
  on both scoreboards, guards, both judges; then held-out. Cost: about $0.9 plus $1.4 held-out.
- T2 If T1 holds fidelity: one round on the few-shot set, restoring the two or three speaker-
  preservation examples the held-out read shows the minimal prompt lost. Cost: about $0.9.

Budget: detector work is CPU-only; judge-agreement evaluations cost about $0.10 per candidate
(scoring existing translations, no new generation); T1, T2 and the held-out runs use about $4;
the rest is reserve for a second translator round or a full-99 judged pass on the winner.

## 5. Rule amendments for loop 2

1. The product detector (r7d) remains the reported scoreboard throughout. A candidate detector is
   reported next to it and adopted as the loop's judge only for the T arms, and as the product
   scoreboard only by Ian's explicit decision after this loop.
2. New negative sources must be human-written, dated before 2022-11-30, fetched with a manifest
   (URL, date or commit, byte count), and held out by group like the existing sources.
3. Every detector candidate is evaluated on the judge-agreement measure before it may become a
   loop judge; a candidate that acquits Claudish inputs (recall under 0.90) is out regardless.
4. The intent check runs per arm as before; D arms are checked as a family with the data manifest
   attached.

## 6. Stopping and reporting

Budget to $20 as before, no early stop. Final report in the same shape as loop 1, with the
detector candidates' measures table, the T-arm results, the held-out pairs, and a Decision entry.
