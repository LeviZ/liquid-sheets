# Phase 3 Execution Plan: Engine port and verification

Status: CODE COMPLETE (2026-08-18). Golden master: zero diff on all six recorded 2026 runs (14-19), 624 rows on the blend. Exit gate exceeded (gate required the blend run only). Remaining: Levi ratifies [ADR-0005](../docs/adr/0005-plain-structures-indexeddb-storage.md) (storage), then close.
Parent: [MASTER-PLAN.md](../MASTER-PLAN.md)

## Scope (from ratified PRODUCT-SCOPE.md and Phase 2 handoff)

Port the valuation engine to a client-side JavaScript module: scoring, flex shares, shallow baseline, availability discount, blend, rank-implied conversion, tier gaps, Tremblay dollars, immutable runs. No my_calls UI (deferred), but the run model keeps room for calls-style adjustments. The wizard's config JSON is the engine's input shape.

## Steps

1. **Golden-master harness FIRST.** A Python exporter dumps, from the private tool's levi.db, the exact inputs of the real 2026 dataset (per-source projection rows, availability prior, league config) and the expected outputs (run 19, the pure 5-source blend). A Node runner feeds the same inputs to the JS engine and diffs to the dollar. Zero diff is the definition of done.
2. **Fixtures stay private.** The exported fixtures embed restricted projection data (FantasyPros, CBS-derived, analyst rankings) and values derived from it. They are gitignored; only the exporter script and runner are public. Anyone reproducing verification generates fixtures from their own data.
3. **Port the engine** as a dependency-free ES module (`engine/`), pure functions, no DOM, no storage: config in, valued board out.
4. **Storage decision ADR**: how runs, config, and draft state persist in the browser while preserving runs-immutability (R1) and the export/import backup story.
5. Iterate until the golden master passes at zero diff; record the result in this file.
6. Close out with learnings.

## Exit gate (from master plan)

Byte-level agreement with the Python engine on the 2026 dataset (dollar values identical for every player in the run).
