---
status: accepted
date: 2026-08-18
decision-makers: Levi Zortman
consulted: []
informed: []
related: "[ADR-0001](0001-serious-hobbyist-auction-drafter-audience.md), [ADR-0003](0003-first-class-yahoo-and-espn.md)"
---

# Auction drafts only, stated proudly; snake drafts are explicitly out of scope

## Decision

Liquid Sheets supports auction drafts only and says so loudly ("not for snake drafts") as a positioning statement, because owning the niche beats diluting the tool for the majority format.

## Context and Problem Statement

Snake drafts are the majority of fantasy drafts; auctions are the minority format with the more devoted following. The private predecessor is auction-native throughout: dollar valuations, budget ledgers, plan envelopes, inflation tracking. Should the public tool add snake support to widen the audience?

## Decision Drivers

* Snake support is a large surface expansion (pick-based value curves, ADP-driven advice, turn logic) with almost zero reuse of the auction machinery
* The [audience decision](0001-serious-hobbyist-auction-drafter-audience.md) already selects for depth over breadth
* Snake drafters are abundantly served (FantasyPros, Draft Sharks, BeatADP); auction drafters are not
* A proud constraint is marketing: "the auction tool" is a memorable identity, "a draft tool" is not

## Considered Options

* Auction only, stated loudly
* Auction first, snake later
* Both formats at launch

## Decision Outcome

Chosen option: auction only, stated loudly. "Snake later" was rejected as scope creep with a fuse on it; nothing in the v1 design will be contorted to keep a snake door open.

### Consequences

* Good, because every screen, verdict, and number can assume a budget and a ledger
* Good, because the positioning writes itself and matches the audience's self-identity
* Bad, because most fantasy players are turned away at the door, by design
* Neutral, because a future snake product would be a separate design effort, not an extension; this ADR would be superseded, not stretched

### Confirmation

The landing page (Phase 5) carries the auction-only statement above the fold.

## Approval Checklist

- [x] Reviewed by: Levi Zortman (working session, 2026-08-18)
- [x] Approved by: Levi Zortman
- [x] Status updated to accepted
