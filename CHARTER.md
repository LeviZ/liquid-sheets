# Liquid Sheets Public - Charter

Decided: 2026-08-18 (Phase 0). Changes to this file after Phase 0 require a note in the MASTER-PLAN.md learnings log.

## What this is

A free, public, browser-only auction draft tool for fantasy football, derived from the private Liquid Sheets tool. All computation client-side, users bring their own data, works offline. The full roadmap is [MASTER-PLAN.md](MASTER-PLAN.md).

## Success definition

This was worth doing if, by the end of the 2027 draft season:

1. The tool ran at least a handful of real drafts (target: 10+) for people Levi has never met, and at least one of them said something a stranger would only say if the tool actually helped.
2. It stands as a portfolio piece Levi is proud to link: visible process (plans, ADRs, golden-master tests), clean code, honest documentation of what the numbers are and are not.
3. Zero dollars changed hands in either direction beyond the domain Levi already owns. No monetization, ever. No hosting bill (static hosting free tier only).

Traction beyond that is a bonus, not the bar. The project can be declared successful even if usage is small, provided items 2 and 3 hold and item 1's floor is met.

## Name

**Liquid Sheets.** Risk check (2026-08-18): web search found no existing software product or fantasy tool with the name. Nearest neighbors (LiquidPlanner, LiquidText, Grateful Sheets) are not collisions. No formal trademark search performed; for a free, never-monetized tool the residual risk is accepted.

## Hosting posture

Primary: a subdomain of Levi's existing Liquid Workflows domain. This fits the portfolio framing (the tool visibly belongs to Levi's body of work). Exact subdomain chosen in Phase 5. liquidsheets.com was available as of 2026-08-18 and is deliberately NOT being purchased now; revisit only if traction makes a standalone identity worth it.

## License

**MIT.** Rationale: never-monetize plus portfolio visibility means maximum-permissive is all upside. There is no business model to protect, and MIT is the least friction for anyone who wants to learn from or fork the code, which is itself portfolio value. See [LICENSE](LICENSE).

## Open-source posture

Public repo, developed in the open from day one, planning documents included. The visible process is part of the product. GitHub account: personal (this is not WCK work).
