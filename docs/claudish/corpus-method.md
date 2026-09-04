# Claudish corpus — method and privacy statement

How the training corpus and lexicon behind /claudish were produced, and
what never leaves the machine.

## Pipeline

`scripts/claudish/` (local-only tooling, run via
`npx ts-node -P tsconfig.scripts.json <script>`):

1. `mine-corpus.ts` streams every Claude Code transcript under
   `~/.claude/projects/` (main sessions + arbitrarily nested subagent
   transcripts, which inherit the parent session id — the split-safety
   unit). The parser tolerates unknown record types and format drift
   across CLI versions by contract (tested with synthetic fixtures
   only). Assistant prose is extracted from `text` content blocks;
   thinking and tool blocks never enter the corpus.
2. Scrub, two rule classes: REMOVE (code fences, non-identifier inline
   code, file paths, URLs, emails, markdown structure — bold survives,
   it is a genuine tic) and DROP-THE-WHOLE-CHUNK (secret shapes,
   denylist terms, currency amounts with 4+ digits) — masking would
   leak the sentence around the hit.
3. Chunking matches the runtime distribution (log-uniform 40–1,200
   chars + a 15% short bucket), seeded and reproducible.
4. Dedup: exact SHA-1, banded 64-bit SimHash (Hamming ≤ 3), and
   boilerplate suppression (any chunk seen in >20 distinct sessions).
   Balance caps: no session over ~2× the mean, no project over 15%.
5. `mine-lexicon.ts` emits tic counts + candidate examples (Track A,
   seeded from the voice guide's kill list) and, once a negative corpus
   exists, Track B log-odds discovery (Monroe/Colaresi/Quinn prior).
6. `build-dataset.ts` + `train-ccld.ts`: see the model card.

## What never enters the repo

Raw transcripts, the chunk store, the candidates file, and the
workspace all live at `~/.claudish-corpus/` — outside the repo, so no
.gitignore mistake can commit client conversations. Exactly four
generated/curated artifacts ship: `ccld-weights.json` (3,168 rows of 8
int8 values behind a lossy hash — it cannot reconstruct a sentence),
`ccld-metrics.json` (numbers), `ccld-fixtures.json` (hand-written probe
strings only), and — after Ian's hand review flips `reviewed: true`
per item — `lexicon.json`. A Jest test re-runs the scrub invariants
over every committed artifact.

## The hand-review gate

`~/.claudish-corpus/lexicon.candidates.json` holds every candidate tic
with up to 5 scrubbed example sentences, all `reviewed: false`. Nothing
from it ships until each shipped item is reviewed by hand. Few-shot
pairs for the translator prompt are hand-written, never mined verbatim.
