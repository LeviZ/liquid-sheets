# Phase 4 Execution Plan: Draft room generalization

Status: IN PROGRESS (opened 2026-08-18). M1 done (V1-V2, two feedback rounds). M2 core landed V3-V8 (see below). Current milestone: M3, first round landed in V9: search-to-stage sale flow with explicit DRAFT commit and Enter-key path, The Call (verdict, inflation-adjusted bid-to number, tier/deal/contender badges), owner ledger with max bids, append-only journal with unsale reversals, undo paths (last sale, any sold row, roster x), sold-row strikethrough with surplus tint, staged-row pulse, inflation and sold and last-sale chips, roster viewer per team, below-line sales auto-expand their section. (M2 notes: universal mapper with Yahoo photo-format preset, projections CSV, rankings-only import with rank-implied conversion, tags import, unmatched-rows hand-matching, deal column with money-supply rescale; still open: ESPN preset tuning against a real page sample, tags surfaced on the board which lands with M4's flagged players). Wizard change of record: the Platform step was removed (V3); platform-format choice happens in the import flow where it has an effect.
Parent: [MASTER-PLAN.md](../MASTER-PLAN.md)

## Architecture for this phase

Static files, no build step, no framework, no dependencies: `app/` holds the UI (index.html plus small ES modules) importing the verified engine from `engine/engine.js`. The predecessor's single-file constraint came from its stdlib server; static hosting serves a handful of files just as offline-safely once the PWA service worker (M5) caches them. Dev loop: `python3 -m http.server` from the repo root, open `http://localhost:8000/app/`.

The availability prior ships as a committed artifact (`app/prior_2026.js`), the attributed slot-level aggregate cleared in [DATA-IN-SPEC.md](../DATA-IN-SPEC.md).

## Milestones (each one is a working checkpoint and a session resume point)

- **M1: Skeleton that values a board.** Storage layer per [ADR-0005](../docs/adr/0005-plain-structures-indexeddb-storage.md) (IndexedDB wrapper, versioned doc, export/import file), the 7-step setup wizard, one-click Sleeper fetch, run creation through the verified engine, and a minimal board list. Proves the full pipe: wizard -> fetch -> engine -> board -> persisted.
- **M2: Data-in complete.** Universal column mapper (paste and CSV) with Yahoo and ESPN presets, rankings-only import, unmatched-rows report with hand-matching, opinions/tags import hook, market values feeding a deal column (hidden when absent).
- **M3: Draft room core.** Real board tab (position columns, tier cliffs, surplus gradients, staged-row pulse), The Call verdicts with max bids, sale flow with explicit DRAFT commit, owner ledger, undo and append-only journal, inflation chips, rosters view.
- **M4: The rest of the room.** TEAMS grid, plan envelopes as editable templates with both-ways flexing, flagged players from user tags, the four themes with platform position colors, under-the-hood explainer, print sheet.
- **M5: PWA and the acceptance gauntlet.** Service worker, install prompt, then: airplane-mode full draft, tab-kill reopen to identical board, delete-site-data then import-file to identical board, and two differently-shaped fictional leagues (one Yahoo, one ESPN) run side by side.

## Working method

Same as the original build: iterative, screenshot-driven refinement with Levi's eyes on the UI at every milestone. Design polish concentrates in M3/M4 (porting the predecessor's token architecture); M1/M2 are function-first. Every JS change gets `node --check`; every text artifact gets the non-ASCII/dash grep.

## Exit gate (from master plan)

Two fictional leagues with different sizes, budgets, and scoring run correct side-by-side drafts (verified in M5).
