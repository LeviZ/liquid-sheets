# Golden-master verification

Proves the JS engine (`engine/engine.js`) reproduces the predecessor's Python engine exactly, on real data.

## How it works

1. `export_fixtures.py --db <levi.db> --run <N> --out fixtures/` dumps a recorded valuation run's exact inputs (per-source projection rows, availability prior, league config as the run used it) and expected outputs.
2. `node run_golden.mjs fixtures/` feeds the same inputs to the JS engine and diffs every player on proj_pts, vbd, dollar, tier, and spread. Exit 0 only at zero mismatches.

## Fixtures are private

Fixture files embed licensed projection data and values derived from it. They are gitignored (`verify/fixtures*/`) and must never be committed. Reproduce verification against your own database.

## Verified results

2026-08-18: runs 14-19 (five per-source + blend), zero diff on all rows and fields.
2026-08-19: the predecessor fixed its tier algorithm (cumulative drop from the tier's own top, replacing the adjacent-gap rule that left smooth positions in one giant tier) and regenerated runs 21-30. The fix was ported and runs 24-29 (five per-source + blend) verified at zero diff on all rows and fields, tiers included.

Porting traps the harness caught (kept as regression knowledge):

* Python `round()` is ties-to-even; `Math.round` is not. Integer rounding uses an explicit half-to-even (`pyRound`).
* Python `round(x, 1)` rounds the exact binary value; pre-scaling by 10 in JS misrounds near-half values. `toFixed` is correctly rounded, but breaks exact ties upward, and exact ties DO occur (binary-representable x.25 spreads appeared in real data). `round1` detects the odd-quarter case and applies ties-to-even.
* Tie order in sorts matters; both engines rely on stable sorts (guaranteed in JS since ES2019).
