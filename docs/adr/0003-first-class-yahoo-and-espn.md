---
status: accepted
date: 2026-08-18
decision-makers: Levi Zortman
consulted: []
informed: []
related: "[ADR-0001](0001-serious-hobbyist-auction-drafter-audience.md), [ADR-0002](0002-auction-only-no-snake.md)"
---

# Platform-agnostic core with first-class Yahoo and ESPN support

## Decision

The engine and draft room are platform-agnostic (any league's scoring, roster, and budget are configuration), while Yahoo and ESPN each get first-class data-in support, because those two platforms host the bulk of the target audience's auction leagues.

## Context and Problem Statement

The private predecessor is Yahoo-shaped in places: paste parsers for Yahoo's player list, a deal column anchored to Yahoo Avg Salary, Yahoo position colors. A public tool must decide whether that platform coupling is identity or accident. Which platforms do we commit to, and how deep does the coupling go?

## Decision Drivers

* Levi's directive: it must work for ESPN leagues as well as Yahoo
* The engine's math has no platform in it; only data-in and cosmetics do
* Each first-class platform is real ongoing work: paste/export formats change yearly and silently
* The deal column concept (our value vs. platform-displayed value, rescaled to league money supply) generalizes to any platform that shows auction values, and both Yahoo and ESPN do

## Considered Options

* Yahoo only (predecessor inertia)
* Yahoo and ESPN first-class, agnostic core
* Fully agnostic, no platform-specific support at all

## Decision Outcome

Chosen option: Yahoo and ESPN first-class over an agnostic core. Fully-agnostic was rejected because "paste anything" without platform-tuned parsers means every user debugs their own import, which fails the audience even at hobbyist tolerance. Sleeper and others enter through the generic CSV path until demand earns them first-class parsers.

### Consequences

* Good, because the core stays clean: platform knowledge lives only at the data-in edge (Phase 2's spec) and in cosmetics
* Good, because ESPN roughly doubles the reachable audience over Yahoo-only
* Bad, because two platforms' paste/export formats must be tracked and tested every season, forever
* Neutral, because platform position-color schemes become a theme concern, not an identity concern

### Confirmation

Phase 4's exit gate already requires two differently-configured leagues to run side by side; one will be Yahoo-shaped and one ESPN-shaped.

## Approval Checklist

- [x] Reviewed by: Levi Zortman (working session, 2026-08-18)
- [x] Approved by: Levi Zortman
- [x] Status updated to accepted
