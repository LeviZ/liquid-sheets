# UI Carryover Plan: harvesting the original app

Status: ACTIVE (2026-08-19). Governs all remaining Phase 4 UI work.
Parent: [PHASE-4.md](PHASE-4.md). Source of truth being harvested: `levi-sheet/draftroom/app.html`, currently **V36, 1589 lines** (nine versions of work landed AFTER this repo's handoff snapshot; audited 2026-08-19).

## Ground rules

1. **Port, don't redesign.** CSS blocks move verbatim (token names and all); JS moves with only its data-access layer adapted (their server state `S.*` becomes our local `doc`/run). The only legitimate reasons to diverge: infrastructure (no server), ratified scope cuts, or generalization (12 teams to N teams).
2. **The original is a moving target until Levi's real draft (~early Sept 2026), then it freezes.** A final harvest sweep runs after that draft to pick up anything V37+ adds.
3. Every harvest round is a numbered V-bump here, screenshot-reviewed by Levi, same as always.

## Bucket A: carry as-is (port verbatim, adapt only data access)

| # | Component (original's names) | Notes | Round |
|---|---|---|---|
| 1 | Token architecture: DATA vs CHROME (`--c-*`) split, all 4 themes, `#rail` subtree re-scoping, the color re-resolution fix | The foundation everything else styles against; port FIRST in M4 | M4 |
| 2 | Position colors light+dark variants, `--posbg-*` tile tints, `.pQB`-style classes | | M4 |
| 3 | Typography: Copperplate display masthead, Verdana UI, Menlo mono, tabular-nums | | M3.2 |
| 4 | Chip design: lab/value structure, `.cval`, gauge/bar/segs micro-viz, `#infl.hot`, last-5 heat chip | Replaces our plain chips | M4 |
| 5 | `surplusBg()` sqrt-scaled sold shading with theme polarity | Replaces our linear tint | M3.2 |
| 6 | Staged-row `bidglow` + reduced-motion guard; sold `#stamp` animation | | M3.2 |
| 7 | `#errbar` + window.onerror/onunhandledrejection surfacing | | M3.2 |
| 8 | Row system: grid-skill columns (tier/name/pts/edge/usd), zebra + odd-hover specificity fix, `t-open` tier cliffs, `.mine` highlighting, injury/rank marks | Replaces our simpler rows | M3.2 |
| 9 | `.freebar` styling (both apps converged on FREE independently) and `.more` expander styling | Align ours | M3.2 |
| 10 | Sale flow structure: `#q`/`#hits`/`#picked`/`#call`/`#saleform`, steplab, `$` price input, `#ogrid` owner buttons (2-col, left$/me/out/selected states), `#summary`, DRAFT, `#msg` | Rebuild our rail to this exact shape | M3.2 |
| 11 | The Call: `advise()` verdict set (TARGET/VALUE/LAST/PASS/BENCH classes), `ownerNeedMap()` contest counting, `.cslots`, `.ctags` | Port logic wholesale; richer than our v1 | M3.2 |
| 12 | `inflation()`: money over owners WITH open slots, value over top-spotsLeft unsold | Subtly better than our fixed-pool version; port | M3.2 |
| 13 | Ledger: ohead/orow grid, collapse toggle, team/manager name toggle, `.out` dimming | | M3.2 |
| 14 | Roster panel: SLOT_ORDER slot-based display, `#rostersel` | Slots derived from config roster | M3.2 |
| 15 | Keyboard layer: slash-focus, hit navigation, Enter chain | | M3.2 |
| 16 | Player modal: `#mtable`, profile block, `.ptags`, `#mtabs`, sell/reverse from modal | Tags become user-imported tags | M4 |
| 17 | Collapsible position columns (`colMin` vertical strips with "N left") | | M4 |
| 18 | Sortable headers (usd/deal), K/DEF view toggle | | M4 |
| 19 | TEAMS tab: tgrid/tcol/ttile, posbg tiles, meCol | | M4 |
| 20 | Board tabs (`.btab` with the active-tab-wears-board-tokens fix) | | M4 |
| 21 | Flagged Players panel (`.note`, flag up/dn/mix, impact sort, instant tooltip) | Fed by user tags import | M4 |
| 22 | Flow strip (deterministic room currents: `.fcell` tight/crunch, runmark, hoarder dots) | The co-pilot's deterministic tier; fully in scope | M4 |
| 23 | Gear menu structure (themes, under-the-hood entry, 2-step reset) | Merge with our existing gear | M4 |
| 24 | Under-the-hood tabbed explainer content pattern | Rewrite copy for strangers | M4 |

## Bucket B: carry adapted (generalization required)

| Component | Adaptation |
|---|---|
| `ownerStates()`/`short()` | Their owner model has `is_me`; ours is team_names[0] = you. Same math otherwise (already true) |
| Hardcoded 156 / 12 / budget | Already parameterized here; keep it that way while porting |
| `#runsel` run selector | Ours has a runs array; selector lands with M4 chips |
| `marketScale` | Identical logic both sides already |
| `myPlanState()`/`planFit()` envelopes | Ratified as GENERALIZED: ships as editable templates (M4); The Call's plan-fit inputs arrive then |
| `kdefCol()` | Theirs is Yahoo-paste-fed; ours is Sleeper-fed. Port the column UI, keep our data |
| Print sheet | Theirs is a server endpoint (/print); ours is a client-side print view (M4) |

## Bucket C: cannot carry (infrastructure or ratified scope)

| Component | Why | Disposition |
|---|---|---|
| `refresh()` polling of /api/state, `code_stale` check | No server | Local event-driven rendering (already so) |
| `stageCopilot()` live read + `#liveread` | AI deferred to BYO-key / power kit (ADR-0004) | NOTE: the original RETIRED the floating panel and folded the read into the staging card; our deferred design should follow that, the staging card keeps the third slot |
| my_calls run wiring, `pureRunId()` | my_calls deferred at ratification | Schema room kept |
| AI profiles/opinions content | Never shipped in-app | Power-kit import hook (built, V4) |
| sale_journal file, DB snapshot backups | No filesystem | IndexedDB journal + export file (built) |

## Round plan

- **M3.2 (next round): the rail becomes the original's rail.** Items 3, 5-15 above: sale flow shape, The Call port, ledger, slot-based roster, keyboard, surplus/stamp/errbar, inflation port. This is the "sidebar should look like the other app" round.
- **M4: tokens first, then everything that styles against them.** Items 1-2, 4, 16-24, plus Bucket B's envelopes, run selector, K/DEF column UI, print view.
- **Post-draft sweep (after ~Sept 6): diff the frozen original against this table**, harvest V37+ additions, close the plan.

## Phase 4B (queued after Phase 4): Liquid Workflows brand pass

Levi's direction (2026-08-19): the public app adopts the Liquid Workflows brand identity. Inputs live at `claude-projects/liquid-workflows/projects/personal-brand/assets/color-type/`: `tokens.css`, `brand-theme-kit.html`, `tailwind.config.js`, and the logo/icon set (cube, Q, square variants). Sequencing matters: the token architecture (item 1) must land first so the brand maps onto tokens, not onto scattered hardcoded colors. Scope sketch (execution plan written when entered, per the master-plan method): map brand palette onto the DATA/CHROME token sets, brand the masthead/favicon/wordmark, reconcile with the four inherited themes. Recorded in [MASTER-PLAN.md](../MASTER-PLAN.md).
