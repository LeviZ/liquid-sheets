---
status: accepted
date: 2026-08-18
decision-makers: Levi Zortman
consulted: []
informed: []
related: "[ADR-0002](0002-auction-only-no-snake.md), [ADR-0003](0003-first-class-yahoo-and-espn.md), [MASTER-PLAN](../../MASTER-PLAN.md)"
---

# Build for the serious-hobbyist auction drafter, not the casual mass market

## Decision

Liquid Sheets targets the serious-hobbyist auction drafter (the ex-BeerSheets crowd), because with no monetization there is no reason to chase market size over depth of fit.

## Context and Problem Statement

A public draft tool can aim at casuals who need zero-setup magic, or at hobbyists who will paste a CSV in exchange for a tool that respects their intelligence. Each audience kills different features and sets a different bar for the data-in experience. Who is this for?

## Decision Drivers

* The project never monetizes ([CHARTER](../../CHARTER.md)); audience choice can optimize purely for genuine fit
* BeerSheets left a real, findable, underserved community (Reddit auction threads) that already understands value-based drafting
* Bring-your-own-data is an architectural constraint; casuals will not tolerate it, hobbyists will
* The builder is the audience: the tool exists because Levi is this user

## Considered Options

* Casual mass market (zero-setup, maximum hand-holding)
* Serious-hobbyist auction drafters
* Both, via progressive disclosure

## Decision Outcome

Chosen option: serious hobbyists, because the BYO-data constraint already selects for them, and "both" quietly becomes "casuals" in every design fight. Every feature triage call in [PRODUCT-SCOPE](../../PRODUCT-SCOPE.md) cites this user.

### Consequences

* Good, because setup friction (pasting projections) becomes acceptable, keeping the no-backend architecture intact
* Good, because epistemic-honesty features (under-the-hood explainer, traceable numbers) become selling points, not clutter
* Bad, because the ceiling on user count is genuinely lower
* Bad, because this audience is demanding and vocal when numbers look wrong; the golden-master rigor is non-optional

### Confirmation

Beta recruitment (Phase 6) happens in the communities named here; if they do not engage, the premise was wrong.

## Approval Checklist

- [x] Reviewed by: Levi Zortman (working session, 2026-08-18)
- [x] Approved by: Levi Zortman
- [x] Status updated to accepted
