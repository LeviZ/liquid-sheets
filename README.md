# Liquid Sheets

A free, open, browser-only auction draft tool for fantasy football. All computation runs client-side. You bring your own projections and league settings. It works with no internet connection, because draft-room wifi always dies at the worst moment.

**Status: pre-build.** This repo is currently plans and decisions, developed in the open. The app does not exist yet. Target: public beta by July 2027, launch for the 2027 draft season.

## Why

The best draft tools of the past (BeerSheets and its descendants) kept dying, mostly over data licensing. Liquid Sheets is designed around that failure mode: it never hosts or redistributes anyone's projections. The tool is the engine, the draft room, and the discipline; the data is yours.

It is derived from a private single-league tool built and battle-tested through the 2026 season, including a full value-based-drafting engine, an auction draft room, and a design doctrine of deliberate parsimony: fewer numbers, each one traceable, adjustments off by default.

## Principles (non-negotiable)

1. No data redistribution, ever. Users bring their own.
2. Client-side everything. No backend, no accounts.
3. Every number traces to an inspectable calculation.
4. Offline-first. Airplane mode is the acceptance test.
5. Free forever. No monetization.

## The plan

- [MASTER-PLAN.md](MASTER-PLAN.md) - the phased roadmap and learnings log
- [CHARTER.md](CHARTER.md) - success definition, name, license, hosting posture
- [phase-plans/](phase-plans/) - per-phase execution plans, written just-in-time
- [docs/adr/](docs/adr/README.md) - architecture decision records (starts filling in Phase 1)

## License

[MIT](LICENSE).
