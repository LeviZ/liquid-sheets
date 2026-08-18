---
status: proposed
date: 2026-08-18
decision-makers: Levi Zortman
consulted: []
informed: []
related: "[ADR-0004](0004-one-app-plus-post-launch-power-kit.md), [DATA-IN-SPEC](../../DATA-IN-SPEC.md)"
---

# Store state as plain JS structures persisted to IndexedDB; no in-browser SQL

## Decision

The app holds league config, imported data, valuation runs, and draft state as plain JavaScript structures, persisted to IndexedDB as versioned JSON documents, because the app's access patterns are simple lookups and the predecessor's SQLite semantics that matter (immutable runs, append-only journal) are disciplines, not query features.

## Context and Problem Statement

The predecessor used SQLite (WAL, full sync) on a local server. A static app must persist in the browser. The candidates differ hugely in weight and ceremony. Which storage layer preserves runs-immutability (doctrine R1), the append-only sale journal, and the export/import recovery story?

## Decision Drivers

* Access patterns are trivial: load whole board, append a sale, append a run; there are no joins the UI needs at runtime
* localStorage's ~5MB ceiling is too tight for multi-source projections plus runs
* sql.js means shipping ~1MB+ of WASM for query power nothing uses
* Draft-day recovery must not depend on any storage subtlety: a one-file export/import is the real safety net
* The predecessor's crash-safety came from SQLite sync settings; the browser equivalent is writing after every sale plus the journal

## Considered Options

* sql.js (SQLite compiled to WASM), porting the schema directly
* localStorage with JSON
* Plain structures in memory, persisted to IndexedDB, with file export/import

## Decision Outcome

Chosen option: plain structures over IndexedDB. Discipline is preserved structurally: runs live in an append-only array and are never mutated after creation; sales append to a journal array that is never rewritten, only appended or reverted by explicit reversal entries; every write after a sale persists synchronously in the transaction sense before the UI confirms. A versioned top-level document (`schema_version`) keeps future migrations sane. Export/import is one JSON file containing everything, doubling as the pre-draft backup ritual.

### Consequences

* Good, because zero dependencies survives (the whole app stays one file plus the engine module)
* Good, because the export file is human-readable JSON a user can inspect, matching the epistemic-honesty identity
* Bad, because complex post-season analysis queries (the deferred evaluation views) will be written in JS instead of SQL when they arrive
* Bad, because IndexedDB's API is awkward; a small promise wrapper is required code

### Confirmation

Phase 4 acceptance includes: kill the tab mid-draft, reopen, and the board reproduces exactly from IndexedDB; delete site data, import the export file, and the board reproduces exactly from the file.

## Approval Checklist

- [ ] Reviewed by: Levi Zortman
- [ ] Approved by: Levi Zortman
- [ ] Status updated to accepted
