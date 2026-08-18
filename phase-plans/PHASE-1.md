# Phase 1 Execution Plan: Audience and feature triage

Status: IN PROGRESS (opened 2026-08-18)
Parent: [MASTER-PLAN.md](../MASTER-PLAN.md)

## Inputs decided by Levi (2026-08-18)

1. **Audience**: the serious-hobbyist auction drafter. The ex-BeerSheets crowd, the r/fantasyfootball and r/findaleague auction threads. People who will happily paste a CSV if the tool respects their intelligence.
2. **Auction only, loudly.** The tool explicitly says it is NOT for snake drafts. We target auctioneers and celebrate the niche rather than apologizing for it.
3. **Platforms**: Yahoo AND ESPN both get first-class support. Core stays platform-agnostic.

## Steps

1. Write ADRs for the three framing decisions above (accepted; decided by Levi in working session). These are the irreversible calls that shape everything downstream.
2. Build the complete feature inventory from the private tool and triage every item into SURVIVES AS-IS / SURVIVES GENERALIZED / CUT FOR V1 / DEFERRED, each with a one-line rationale. Draft status: PROPOSED.
3. Levi reviews the triage table, amends buckets, ratifies. Exit gate requires zero unresolved rows.
4. Write PRODUCT-SCOPE.md as the ratified single source of truth, including what the setup wizard must therefore cover.
5. Additional ADRs for any triage calls that prove contentious or irreversible during review (expected candidate: the AI co-pilot's fate).
6. Close out: learnings appended to MASTER-PLAN.md.

## Working principles for the triage

- The audience decision is the knife: every bucket call cites the serious-hobbyist auctioneer, not an abstract user.
- Portfolio framing tiebreaker (Phase 0 learning): when torn, choose the option that shows the work.
- DEFERRED is an honest bucket, not a dodge: it means "post-v1, and the v1 design must not foreclose it."
- Parsimony doctrine applies to the product itself, not just the numbers: fewer features, each earning its place.

## Exit gate (from master plan)

Every feature in the inventory has a bucket and a rationale. No "we'll see" entries.
