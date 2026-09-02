/* cl2en lab (docs/claudish/cl2en-experiment-rules.md). Paths come from CL2EN_LAB_DIR; raw pool text never enters the repo. */
/**
 * Score cl2en outputs across EVERY CCLD model in the local registry
 * (~/.claudish-corpus/models/<tag>/ccld-weights.json), plus the regex
 * heuristic and the shipped product score max(shipped, heuristic).
 * Inputs: one or more report JSONs from cl2en-local.ts (modelId + rows
 * with id/out), and the inputs file for the Claudish baseline.
 * Usage: CL2EN_INPUTS=pool.json ts-node score-registry.ts out.csv reportA.json reportB.json ...
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { loadCcldModel } from "../../../src/lib/claudish/ccld";
import { scoreClaudish } from "../../../src/lib/claudish/heuristic";
import shippedWeights from "../../../src/lib/claudish/ccld-weights.json";

interface Row {
  id: string;
  out: string;
  p?: number;
  attempts?: unknown[];
}
interface Report {
  modelId: string;
  cl2en: Row[];
}

const registry = path.join(homedir(), ".claudish-corpus", "models");
const shippedJson = JSON.stringify(shippedWeights);
const models = readdirSync(registry)
  .filter((t) => existsSync(path.join(registry, t, "ccld-weights.json")))
  .sort()
  .map((tag) => {
    const raw = readFileSync(
      path.join(registry, tag, "ccld-weights.json"),
      "utf8",
    );
    const parsed: unknown = JSON.parse(raw);
    const model = loadCcldModel(parsed);
    return { tag, model, shipped: JSON.stringify(parsed) === shippedJson };
  });
const loadable = models.filter((m) => m.model !== null);
const shippedTag = loadable.find((m) => m.shipped)?.tag ?? "(none)";

const outCsv = process.argv[2];
const reports: Report[] = process.argv.slice(3).map((f) => {
  const r = JSON.parse(readFileSync(f, 'utf8')) as Report;
  const base = path.basename(f).replace(/\.json$/, '').replace(/^pool-/, '');
  return { ...r, modelId: base };
});
const inputs = JSON.parse(
  readFileSync(process.env.CL2EN_INPUTS ?? "", "utf8"),
) as Array<{ id: string; text: string }>;

type Scored = {
  variant: string;
  id: string;
  scores: Record<string, number>;
  heuristic: number;
  product: number;
  chars: number;
};
const scored: Scored[] = [];
function scoreText(variant: string, id: string, text: string) {
  const scores: Record<string, number> = {};
  for (const m of loadable) scores[m.tag] = m.model!.predict(text);
  const heuristic = scoreClaudish(text).score;
  const shippedP = scores[shippedTag] ?? NaN;
  scored.push({
    variant,
    id,
    scores,
    heuristic,
    product: Math.max(shippedP, heuristic),
    chars: text.length,
  });
}
for (const inp of inputs) scoreText("input", inp.id, inp.text);
for (const r of reports) {
  const ids = new Set(inputs.map((i) => i.id));
  for (const row of r.cl2en)
    if (ids.has(row.id) && row.out) scoreText(r.modelId, row.id, row.out);
}

const variants = ["input", ...reports.map((r) => r.modelId)];
const mean = (xs: number[]) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const passRate = (xs: number[]) =>
  xs.length ? xs.filter((x) => x < 0.5).length / xs.length : NaN;
console.log(
  `registry: ${models.length} models, ${loadable.length} loadable; shipped = ${shippedTag}`,
);
console.log(
  `n per variant: ${variants.map((v) => `${v}=${scored.filter((s) => s.variant === v).length}`).join("  ")}`,
);
console.log("");
const header = [
  "model".padEnd(28),
  ...variants.map((v) => v.replace("gemini-", "").padStart(22)),
].join("");
console.log(header);
console.log("  (mean p | pass<0.5 share)");
const tags = [...loadable.map((m) => m.tag), "heuristic", "product(shipped)"];
for (const tag of tags) {
  const cells = variants.map((v) => {
    const xs = scored
      .filter((s) => s.variant === v)
      .map((s) =>
        tag === "heuristic"
          ? s.heuristic
          : tag === "product(shipped)"
            ? s.product
            : s.scores[tag],
      );
    return `${mean(xs).toFixed(3)} | ${(passRate(xs) * 100).toFixed(0).padStart(3)}%`.padStart(
      22,
    );
  });
  const label = (tag === shippedTag ? `${tag} *SHIPPED*` : tag).padEnd(28);
  console.log(label + cells.join(""));
}
// Paired comparison on the shipped model: per input, which variant scores lower?
if (reports.length === 2) {
  const [a, b] = reports.map((r) => r.modelId);
  let aLower = 0,
    bLower = 0,
    ties = 0;
  const diffs: number[] = [];
  for (const inp of inputs) {
    const sa = scored.find((s) => s.variant === a && s.id === inp.id);
    const sb = scored.find((s) => s.variant === b && s.id === inp.id);
    if (!sa || !sb) continue;
    const pa = sa.scores[shippedTag],
      pb = sb.scores[shippedTag];
    diffs.push(pb - pa);
    if (Math.abs(pa - pb) < 0.02) ties++;
    else if (pa < pb) aLower++;
    else bLower++;
  }
  console.log("");
  console.log(
    `paired on ${shippedTag}: ${a} lower on ${aLower}, ${b} lower on ${bLower}, ties(<0.02) ${ties}; mean(${b.replace("gemini-", "")} - ${a.replace("gemini-", "")}) = ${mean(diffs).toFixed(3)}`,
  );
}
const csv = [
  "variant,id,chars,heuristic,product," + loadable.map((m) => m.tag).join(","),
];
for (const s of scored)
  csv.push(
    [
      s.variant,
      s.id,
      s.chars,
      s.heuristic.toFixed(4),
      s.product.toFixed(4),
      ...loadable.map((m) => s.scores[m.tag].toFixed(4)),
    ].join(","),
  );
writeFileSync(outCsv, csv.join("\n"));
console.log(`\nper-case scores: ${outCsv}`);
