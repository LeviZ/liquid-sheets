/* Golden-master harness: run the JS engine on the exported fixtures and diff
 * against the Python engine's recorded run. Exit 0 only on zero mismatches.
 *
 * Usage: node run_golden.mjs [fixtures-dir]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { blendProjections, valueBoard } from "../engine/engine.js";

const dir = process.argv[2] ?? new URL("fixtures", import.meta.url).pathname;
const load = (f) => JSON.parse(readFileSync(join(dir, f), "utf8"));

const { config, model_params_used, run_config, source_order } = load("config.json");
const projections = load("projections.json");
const prior = load("prior.json");
const expected = load("expected.json");

const ordered = {};
for (const src of source_order) ordered[src] = projections[src];

let asOf, players;
if (run_config.source === "blend") {
  ({ asOf, players } = blendProjections(ordered, config.scoring));
} else {
  const single = ordered[run_config.source];
  asOf = `${run_config.source}@${single.as_of}`;
  players = single.players;
}
const mp = { ...config.model_params, ...model_params_used };
const result = valueBoard(config, players, prior, mp);

const got = new Map(result.players.map((p) => [p.player_id, p]));
const fields = ["proj_pts", "vbd", "dollar", "tier", "spread"];
let mismatches = 0, missing = 0, maxDiff = 0;

for (const exp of expected.rows) {
  const g = got.get(exp.player_id);
  if (!g) { missing++; console.log(`MISSING ${exp.player_id}`); continue; }
  for (const f of fields) {
    const a = exp[f], b = g[f];
    if (a === null && b === null) continue;
    if (a === null || b === null || Math.abs(a - b) > 1e-9) {
      mismatches++;
      const d = a !== null && b !== null ? Math.abs(a - b) : Infinity;
      if (d !== Infinity) maxDiff = Math.max(maxDiff, d);
      if (mismatches <= 20) {
        console.log(`DIFF ${exp.player_id} ${f}: py=${a} js=${b}`);
      }
    }
  }
}
const extra = result.players.length - expected.rows.length;

console.log(`\nrun ${expected.run_id}: ${expected.rows.length} expected rows, ` +
  `${result.players.length} produced (${extra >= 0 ? "+" : ""}${extra})`);
console.log(`blend as_of: ${asOf}`);
console.log(`meta: baselines=${JSON.stringify(result.meta.baselines)} ` +
  `premium=${result.meta.premium} ` +
  `(py: ${JSON.stringify(run_config.baselines)} / ${run_config.premium})`);
console.log(mismatches || missing
  ? `FAIL: ${mismatches} field mismatches, ${missing} missing, maxDiff=${maxDiff}`
  : "PASS: zero diff across all rows and fields");
process.exit(mismatches || missing ? 1 : 0);
