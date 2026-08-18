# Liquid Sheets Public - Master Plan

Status: ACTIVE. Phase 0 COMPLETE (2026-08-18, pending only the GitHub push). Next: Phase 1.
Created: 2026-08-17. This is the high-level roadmap only. Each phase gets its own dedicated execution plan written at the moment we enter that phase, never earlier, because each phase produces learnings that reshape the next one.

## What we are building

A public, static, browser-only version of Liquid Sheets: the auction draft tool built in `claude-projects/fantasy-football/levi-sheet/`. All computation runs client-side. Users bring their own data. No backend, no accounts, no server-held projections. Hosted as a static site (working assumption: Cloudflare Pages), installable as a PWA so it survives dead draft-room wifi.

The personal tool in `levi-sheet/` is NOT modified by this workstream. It remains Levi's draft-day tool for 2026 and the reference implementation this product is derived from.

## Non-negotiable constraints (carry into every phase)

1. **No data redistribution.** We never ship, host, or proxy projections, rankings, or market values. Users paste or upload their own. This is the constraint that killed the tools before us; it is architectural, not legal fine print.
2. **Client-side everything.** No server component in v1. If a feature requires a backend, it is cut or deferred, not accommodated.
3. **Parsimony doctrine survives.** The public tool inherits the levi-sheet philosophy: every number traces to an inspectable calculation, adjustments are off-by-default toggles, evidence beside numbers never inside them. See `claude-projects/fantasy-football/levi-sheet/DATA-MODEL.md` rules R1-R4.
4. **Offline-first is the differentiator.** "Works when the ballroom wifi dies" is the identity, not a nice-to-have.
5. **AI text never enters value math.** Same rule as the personal tool.

## The calendar reality

Fantasy draft season runs late August to early September. Today is 2026-08-17. There is no responsible path to a public launch for the 2026 season.

- **Target: public beta by July 2027, launch for the 2027 draft season.**
- Levi's own 2026 draft (early Sept, using the personal tool) becomes the final dogfood of the underlying model before the public work begins in earnest.
- The long runway is an asset: the offseason is when the design decisions (Phase 1) can be made without deadline pressure, and spring mock-draft season provides real test users before the stakes are real.

## Phases

Each phase ends with two things: its named deliverables, and a short LEARNINGS section appended to this file. The next phase's execution plan is written only after those learnings land.

### Phase 0: Charter and repo setup (small)

Goal: make the workstream real and scoped before any design happens.

- Decide the working name and check availability (is "Liquid Sheets" free as a domain / not trademarked / not already a product?).
- Decide open-source posture and license (the public app repo: MIT? source-available? closed but free?).
- Decide which GitHub account hosts it (personal, per the account rules) and create the repo skeleton.
- Write down the success definition: what does "this was worth doing" look like in Sept 2027? (e.g., N real drafts run on it, not revenue.)

Exit gate: name chosen, repo exists, success definition written.

### Phase 1: Audience and feature triage (THE BIG LIFT)

Goal: decide exactly who this is for, and let that decision execute the feature list. This is the phase Levi already identified as the heavy one, and everything downstream depends on it.

Key questions to settle, in rough order:

- **Who is the target user?** Candidate framings to choose between: (a) auction drafters only, any platform; (b) the ex-BeerSheets crowd who want a sheet-like board with modern values; (c) power users willing to paste their own projections vs. casuals who won't. Each framing kills different features.
- **Auction only, or snake too?** The personal tool is auction-native (Tremblay dollars, envelopes, ledger). Snake support is a large surface expansion. Strong prior: auction-only for v1, but decide it explicitly.
- **Which platforms' leagues do we support?** Yahoo-specific features (the deal column needs pasted Yahoo values, Yahoo position colors, the paste parsers) vs. platform-agnostic design.
- **Feature-by-feature triage** of the full levi-sheet inventory into four buckets: SURVIVES AS-IS / SURVIVES GENERALIZED / CUT FOR V1 / DEFERRED. The inventory to triage includes at minimum: the board and TEAMS tabs, The Call verdicts, plan envelopes and stars-and-scrubs logic, my_calls named bets, the deal column, availability prior, flagged players, mock simulator, themes, the AI co-pilot (likely BYO-API-key or cut; decided here, built later if it survives).
- **What does the setup experience demand?** The personal tool has league_2026.json hand-written; the public tool needs a league setup wizard. Its scope (scoring rules supported, roster shapes supported) is set by the audience decision.

Deliverables: a PRODUCT-SCOPE.md in the public repo; a feature decision table with a one-line rationale per cut; ADRs for the irreversible calls (audience, auction-only, platform posture), following the same ADR practice as `claude-projects/fantasy-football/levi-sheet/docs/adr/`.

Exit gate: every feature in the inventory has a bucket and a rationale. No "we'll see" entries.

### Phase 2: Data-in design

Goal: design how a stranger's league data gets into the app, which is the make-or-break usability problem and the place licensing gets concrete.

- Which sources can users realistically bring, and in what form (CSV export, copy-paste, manual entry)? The levi-sheet paste parsers are the seed material.
- What can legitimately be fetched client-side from the user's own browser (e.g., Sleeper's public API, CORS permitting) vs. what must be pasted?
- Graceful degradation: what does the tool look like with ONE projection source and no market values? It must still be useful at the floor.
- League settings wizard design, scoped by Phase 1's audience decision.

Deliverables: data-in spec, supported-sources matrix with licensing posture per source, wizard flow design.

Exit gate: a named person outside the project could, on paper, get their league from zero to a populated board following the spec.

### Phase 3: Engine port and verification

Goal: port the valuation engine (`claude-projects/fantasy-football/levi-sheet/engine/valuation.py`) to client-side JavaScript with proof it produces identical numbers.

- Golden-master test harness: run the Python engine and the JS port on identical inputs, diff to the dollar. The port is not done until the diff is zero.
- Storage decision: IndexedDB vs. sql.js vs. plain JS structures with localStorage persistence. The runs-are-immutable model (R1) must survive the translation.
- Scope only what Phase 1 kept. Cut features do not get ported.

Deliverables: JS engine module, golden-master suite passing, storage layer.

Exit gate: byte-level agreement with the Python engine on the 2026 dataset.

### Phase 4: Draft room generalization

Goal: adapt the UI (`claude-projects/fantasy-football/levi-sheet/draftroom/app.html`) from Levi's league to any league that Phase 1 scoped in.

- De-Levi-fication: owner names, league constants, envelope defaults, hardcoded 12-team/$200 assumptions all become configuration.
- PWA packaging: service worker, install prompt, full offline verification (airplane-mode test is the acceptance test).
- Iteration loop with screenshots, same as the original build process.

Deliverables: the working app, offline-verified, driven entirely by wizard-produced config.

Exit gate: two fictional leagues with different sizes, budgets, and scoring run correct side-by-side drafts.

### Phase 5: Packaging and launch surface

Goal: everything around the app.

- Hosting setup (Cloudflare Pages or equivalent), custom domain.
- Landing page, in-app onboarding, and docs (the "under the hood" explainer tradition carries forward; epistemic honesty about what the numbers are is part of the brand).
- Privacy-respecting usage measurement decision (or none at all).
- Feedback channel (GitHub issues if open-source).

Exit gate: a stranger can find it, understand it, and start a draft without talking to us.

### Phase 6: Beta and 2027 launch

Goal: real users, real mock drafts, then the real season.

- Recruit beta users during 2027 mock-draft season (spring/summer).
- Structured feedback capture; fix cycle.
- Launch decision gate before the 2027 draft window opens.

Exit gate: the 2027 season happens on it.

## Standing risks (revisit at every phase boundary)

- **Data licensing drift**: a source we design around changes its terms or export format. Mitigation: the Phase 2 floor requirement (useful with one generic source).
- **Scope creep vs. parsimony**: the public audience will ask for everything BeerSheets ever had. The Phase 1 decision table is the shield; additions require the same toggle-with-a-test discipline as the personal tool.
- **Single maintainer**: this is a nights-and-weekends product. Phase gates exist so the project can pause cleanly at any boundary without leaving a half-built phase.
- **Name risk**: unresolved until Phase 0 completes.

## Learnings log

Appended at each phase exit.

### Phase 0 (closed 2026-08-18)

- Name is clean: no software product or fantasy tool called "Liquid Sheets" exists (web-checked; no formal trademark search, residual risk accepted for a free tool). Nearest neighbor in the space is Grateful Sheets, an Excel tool, which is useful competitive awareness for Phase 1.
- Levi decided: never monetize, portfolio piece first. This resolved license (MIT), hosting identity (subdomain of his Liquid Workflows domain, not liquidsheets.com, which was available but deliberately not purchased), and open-source posture (public from day one, planning docs included) all in one stroke. Lesson for later phases: the portfolio framing is a decision-making shortcut; when torn, choose the option that shows the work.
- The repo is `liquid-sheets-public/` itself, git-initialized locally. GitHub push deferred pending Levi's account confirmation (his own global rule about GitHub accounts, plus a new public repo is outward-facing).
- Implication for Phase 1: with no revenue pressure, the audience decision can optimize purely for "who will genuinely use and appreciate this," not market size. That likely tilts toward the serious-hobbyist auction drafter rather than the broadest casual audience, but that is Phase 1's call to make, not Phase 0's.
