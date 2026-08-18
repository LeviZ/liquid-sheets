# Phase 2 Execution Plan: Data-in design

Status: IN PROGRESS (opened 2026-08-18)
Parent: [MASTER-PLAN.md](../MASTER-PLAN.md)

## Inherited from Phase 1

The [ratified scope](../PRODUCT-SCOPE.md) fixes the surface: first-class Yahoo and ESPN paste paths, a generic CSV floor, Sleeper client-side fetch if CORS allows, a rankings-only import path, the opinions/tags import hook, and the wizard covering budget, team count, roster shape, scoring, platform, and team names. The licensing review covers app data paths, the shipped availability-prior aggregate, and power-kit script publishability.

## Steps

1. **Ground truth**: read the private tool's parsers (`levi-sheet/ingest/load_manual.py`, `pull_sleeper_projections.py`) to extract the real formats and endpoints already proven to work.
2. **CORS test**: empirically check whether Sleeper's public API sends permissive CORS headers (a curl of the actual endpoints). This decides whether the app can offer one-click Sleeper fetch or falls back to CSV.
3. **Platform format research**: what a Yahoo user and an ESPN user can actually copy or export in 2026 (player lists, auction values, projections), and how stable those surfaces are.
4. **Licensing matrix**: per-source posture in three columns: app data-in, shipped-with-app artifacts (availability prior), power-kit script publishability.
5. **Design the spec**: DATA-IN-SPEC.md covering the sources matrix, parser strategy (including how we survive annual format drift), the one-source floor experience, the wizard flow, the opinions/tags import format, and a start-to-board walkthrough for a named outsider persona.
6. **Levi review** of the named decision points, then close with learnings.

## Exit gate (from master plan)

A named person outside the project could, on paper, get their league from zero to a populated board following the spec.
