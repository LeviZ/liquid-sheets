---
status: accepted
date: 2026-08-18
decision-makers: Levi Zortman
consulted: []
informed: []
related: "[ADR-0001](0001-serious-hobbyist-auction-drafter-audience.md), [PRODUCT-SCOPE](../../PRODUCT-SCOPE.md)"
---

# One app for everyone; the AI-savvy path ships as a post-launch power kit, not a second version

## Decision

Liquid Sheets is one app with no AI shipped in it at v1; the "use it the way the author did" experience (co-pilot prompts, opinion-sweep prompts, personal-use ingestion scripts, BYO-AI walkthrough) is published after launch as a power kit in the same repo, because a companion kit delivers everything a second app version would without doubling maintenance forever.

## Context and Problem Statement

The private predecessor's AI layer (pre-computed player opinions, a live draft-room read) was powered by the author's own Claude access and prompts. Levi wants the community to be able to run the full setup, prompts intact, on their own AI and their own data. Do we ship a second "full" version of the app, build BYO-key AI into v1, or something else?

## Decision Drivers

* Shipping AI-generated takes on real players to the public is a liability the app itself must never carry
* Two app versions means two builds to test, document, and keep honest, forever, for a nights-and-weekends project
* Publishing the actual prompts is portfolio gold (Phase 0 learning: choose the option that shows the work)
* Levi's launch narrative: clean app first, then an encore reveal for the AI-savvy
* Kit scripts touch data sources; their licensing posture is per-source, not blanket

## Considered Options

* Two app versions: a clean one and a full-AI one
* One app with BYO-API-key AI built into v1
* One app, cut clean at v1, plus a post-launch power kit in the repo

## Decision Outcome

Chosen option: one app plus a post-launch power kit. The only v1 obligation this creates is an import hook for user-generated opinions and tags, so kit output flows onto the same board everyone uses. BYO-key AI inside the app remains a deferred candidate for later, unchanged by this decision.

### Consequences

* Good, because one codebase, one identity, and the kit doubles as public documentation of how the tool was really built
* Good, because the encore release is a second launch moment with the same repo
* Bad, because AI-savvy users wait until post-launch for the kit
* Neutral, because each kit script's inclusion is decided by the Phase 2 per-source licensing review (public-API sources are safe; scrapers are decided there)

### Confirmation

The v1 app contains zero AI-generated content and zero API-key UX; the kit, when released, produces files the shipped import hook accepts.

## Approval Checklist

- [x] Reviewed by: Levi Zortman (working session, 2026-08-18)
- [x] Approved by: Levi Zortman
- [x] Status updated to accepted
