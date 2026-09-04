/**
 * Fixed probe battery for CCLD model comparison. Every string
 * hand-written. Run after any retrain:
 *   npx ts-node -P tsconfig.scripts.json -T scripts/claudish/probe-battery.ts
 */
import { loadCcldModel } from '../../src/lib/claudish/ccld';
import weights from '../../src/lib/claudish/ccld-weights.json';

const model = loadCcldModel(weights);

const BATTERY: Array<[string, string]> = [
  // [expectation, text]
  ['ENGLISH ', 'Hang on a minute, let me call my wife and make sure this is ok with her.'],
  ['ENGLISH ', 'Let me know if Thursday works for the budget review.'],
  ['ENGLISH ', 'Sure, let me grab my coat and we can head out for lunch.'],
  ['ENGLISH ', 'The meeting moved to Thursday. Bring the numbers.'],
  ['ENGLISH ', 'hold my beer'],
  ['ENGLISH ', 'What would the cost breakdown be if I wanted to use Opus 5 at low/no reasoning for the english to claudish? Fable 5 and Opus 5 are the only models fluent in Claudish.'],
  ['ENGLISH ', 'Claude Opus and Claude Fable are impressive models.'],
  ['ENGLISH ', 'I asked Claude to summarize the meeting notes.'],
  ['ENGLISH ', 'Saw a tweet this week about Anthropic, one of the hottest companies on earth, saying their biggest problem is still hiring.'],
  ['ENGLISH ', 'The book delves into medieval trade routes across the Baltic.'],
  ['CLAUDISH', "This isn't just a refactor — it's a fundamental shift in how the pipeline thinks about state."],
  ['CLAUDISH', "Let me delve into this — it isn't just a bug; it's a robust, seamless testament to the intricate interplay of state."],
  ['SOFT-CL ', "Those quotes sting because they're accurate. I'll resist the urge to explain why the six complaints are really answers to three different questions."],
  ['SOFT-CL ', "You're right to push back on that. The plan was too clever by half, and the simpler version ships tomorrow."],
  ['SOFT-CL ', 'The tests pass, but passing tests were never the question. The question is whether the abstraction earns its keep.'],
  ['SOFT-CL ', 'That criticism lands. The report buried its one actionable number under six paragraphs of context.'],
  ['GRAYZONE', 'let me check the numbers before we send it over there'],
  ['MEME    ', 'Let me delve into this for you'],
];

for (const [expected, text] of BATTERY) {
  const p = model ? model.predict(text) : NaN;
  console.log(`${expected}  ccld=${p.toFixed(3)}  | ${text.slice(0, 70)}`);
}
