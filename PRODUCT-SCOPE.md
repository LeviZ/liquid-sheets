# Product Scope - Feature Triage

Status: **PROPOSED** (drafted 2026-08-18, awaiting Levi's ratification). Becomes the single source of truth once ratified; after that, changes require a note in the MASTER-PLAN.md learnings log.

Framing: every call below cites the audience from [ADR-0001](docs/adr/0001-serious-hobbyist-auction-drafter-audience.md) (serious-hobbyist auction drafter), the auction-only stance ([ADR-0002](docs/adr/0002-auction-only-no-snake.md)), and the platform posture ([ADR-0003](docs/adr/0003-first-class-yahoo-and-espn.md)). The inventory is the full feature set of the private predecessor.

Buckets: **AS-IS** (port faithfully) / **GENERALIZED** (survives, reshaped for any league or platform) / **CUT** (not in this product) / **DEFERRED** (post-v1; v1 must not foreclose it).

## Engine

| Feature | Bucket | Rationale |
|---|---|---|
| VBD core (scoring, flex shares, shallow baseline) | AS-IS | The product's spine; hobbyists come exactly for this |
| Tremblay dollar conversion | AS-IS | Auction-native pricing; no platform in it |
| Availability discount (per-slot expected missed games) | GENERALIZED | Survives as a shipped slot-level aggregate prior; whether shipping that aggregate is licensing-clean is a named Phase 2 check |
| Multi-source blend | GENERALIZED | From five hardcoded sources to N user-provided sources (1 to many); the one-source floor must be first-class |
| Rank-implied stat lines for rankings-only sources | GENERALIZED | The Dell-loader trick becomes a generic "import a rankings list" path |
| Runs immutability (every number traces to a run) | AS-IS | Doctrine R1; also the debugging story when a stranger reports wrong numbers |
| my_calls named bets (clamped, thesis required, off by default) | GENERALIZED | Serious hobbyists have convictions; the discipline (clamp + mandatory thesis + separate run) is the feature |
| Toggle discipline (adjustments off by default) | AS-IS | Doctrine R2, product identity |
| Levi-league priors (WR overspend, QB anchor gap, etc.) | CUT | League-specific by definition; the *mechanism* for users to encode their own league reads is DEFERRED |
| Post-season evaluation views (calibration, market_vs_me) | DEFERRED | High value, zero draft-day value; needs season-end actuals design |
| Mock draft simulator | DEFERRED | Beloved practice feature but needs an opponent model that generalizes; v1.1 candidate |

## Data-in (details are Phase 2's whole job)

| Feature | Bucket | Rationale |
|---|---|---|
| Yahoo player/value paste parser | GENERALIZED | First-class per ADR-0003; hardened for format drift |
| ESPN data-in (values, players) | GENERALIZED | New build, first-class per ADR-0003 |
| Generic projections CSV import | GENERALIZED | The universal floor: any source the user can export |
| Sleeper client-side fetch | GENERALIZED | Only if fetchable from the user's own browser (CORS check in Phase 2); otherwise falls to generic CSV |
| Server-side scrapers (ESPN kona, CBS read_html) | CUT | No server exists; replaced by user-side export/paste |
| Yahoo API integration | CUT | Requires backend and app approval; against the no-backend constraint |
| AI news sweep + generated opinions | CUT | We do not ship AI-generated content about real players to the public; see co-pilot row |
| Player tags / flagged players | GENERALIZED | Survives as user-entered tags and notes; the UI stays, the shipped content goes |

## Draft room

| Feature | Bucket | Rationale |
|---|---|---|
| Board tab (position columns, tier cliffs, surplus gradient, staged pulse) | AS-IS | The product |
| The Call (verdict + max bid on staged player) | AS-IS | The draft-day heartbeat; pure engine math |
| Sale flow, undo, append-only journal | AS-IS | Battle-tested; journal becomes the in-browser recovery story |
| Owner ledger + max-bid tracking | GENERALIZED | Any team count and names, from wizard config |
| TEAMS tab (draft grid) | GENERALIZED | N-team grid instead of hardcoded 12 |
| Deal column (our value vs. platform value, rescaled to league money supply) | GENERALIZED | The rescaling insight is platform-agnostic; anchor is whichever platform's values the user pasted |
| Plan envelopes + stars-and-scrubs flexing | GENERALIZED | Ships as editable templates (default: stars-and-scrubs) instead of Levi's hand-tuned envelope file |
| Inflation gauge, sold bar, heat, last-sale chips | AS-IS | Compact and universal |
| Rosters dropdown (view any team) | AS-IS | No league-specific logic |
| Print backup sheet | AS-IS | Offline-first identity; the paper fallback |
| Themes (light/focus/dark/inverted) | AS-IS | Token architecture already clean |
| Position colors | GENERALIZED | Yahoo and ESPN scheme variants, tied to a platform setting |
| Under-the-hood explainer | GENERALIZED | Identity feature for this audience; content rewritten for strangers |
| League setup wizard | GENERALIZED | New build; replaces hand-written league JSON. Scope: budget, team count, roster shape, scoring rules, platform |
| Draft state export/import (file backup) | GENERALIZED | New build; replaces the server's snapshot backups as the recovery path |
| Local server, launcher, DB snapshots | CUT | The browser is the runtime; storage moves client-side (Phase 3 decision) |

## AI co-pilot

| Feature | Bucket | Rationale |
|---|---|---|
| Deterministic flow read (runs, temperature, crunch, hoarders, pace) | GENERALIZED | Contains no AI; it is pure ledger heuristics and ports as ordinary code. Keeps the co-pilot panel alive without any API key |
| Pre-computed AI opinions | CUT | Shipping AI-generated takes on real players to the public is a liability and violates no-data-shipped; users' own notes replace it |
| Live "reading the room" (BYO Anthropic API key) | DEFERRED | Genuinely differentiating, but v1 ships without any API-key UX; design must keep the panel's third slot open |

## What the wizard must therefore cover (input to Phase 2)

Budget, team count, roster shape (starters, bench, flex definitions), scoring rules (at minimum: the knobs the engine's scorer actually uses), platform selection (Yahoo/ESPN/other, driving parsers and colors), and team/owner names. Nothing else. Anything the wizard does not need is a knob the engine should default sensibly.

## Ratification

- [ ] Levi has reviewed every row, amended where needed, and ratified. (Then flip Status to RATIFIED.)
