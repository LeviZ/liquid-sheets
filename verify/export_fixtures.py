"""Export golden-master fixtures for the JS engine port.

Dumps, from a private Liquid Sheets predecessor database, the exact inputs the
Python engine consumed and the expected outputs of one recorded valuation run.
The JS engine must reproduce the run to the rounded decimal.

The fixture files embed licensed projection data and values derived from it.
They are gitignored and must NEVER be committed. Anyone reproducing
verification generates fixtures from their own database.

Usage: python3 export_fixtures.py --db path/to/levi.db --run 19 --out fixtures/
"""
import argparse
import json
import sqlite3
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--run", type=int, required=True)
    ap.add_argument("--out", default="fixtures")
    args = ap.parse_args()

    con = sqlite3.connect(f"file:{args.db}?mode=ro", uri=True)
    out = Path(args.out)
    out.mkdir(exist_ok=True)

    run_row = con.execute(
        "SELECT season, config FROM valuation_run WHERE run_id=?",
        (args.run,)).fetchone()
    if not run_row:
        raise SystemExit(f"run {args.run} not found")
    season, run_config = run_row[0], json.loads(run_row[1])

    row = con.execute(
        "SELECT teams, budget, weeks, roster_slots, scoring, model_params "
        "FROM league_season WHERE season=?", (season,)).fetchone()
    cfg = {"season": season, "teams": row[0], "budget": row[1], "weeks": row[2],
           "roster_slots": json.loads(row[3]), "scoring": json.loads(row[4]),
           "model_params": json.loads(row[5])}
    # Model params as the run actually used them (a --set override would differ
    # from the league defaults; the run config is the truth).
    mp = {k: run_config[k] for k in cfg["model_params"] if k in run_config}

    sources = [r[0] for r in con.execute(
        "SELECT DISTINCT source FROM projection WHERE season=?", (season,))]
    proj = {}
    for src in sources:
        date = con.execute(
            "SELECT max(as_of_date) FROM projection WHERE season=? AND source=?",
            (season, src)).fetchone()[0]
        rows = con.execute(
            "SELECT p.player_id, ps.pos, ps.nfl_team, p.stats FROM projection p "
            "JOIN player_season ps ON ps.player_id = p.player_id "
            "AND ps.season = p.season "
            "WHERE p.season=? AND p.source=? AND p.as_of_date=?",
            (season, src, date)).fetchall()
        proj[src] = {"as_of": date,
                     "players": [{"player_id": r[0], "pos": r[1], "team": r[2],
                                  "stats": json.loads(r[3])} for r in rows]}

    prior = [[pos, slot, missed] for pos, slot, missed in con.execute(
        "SELECT pos, rank_slot, exp_games_missed FROM availability_prior "
        "WHERE season=?", (season,))]

    expected = [{"player_id": r[0], "pos": r[1], "proj_pts": r[2], "vbd": r[3],
                 "dollar": r[4], "tier": r[5], "spread": r[6]}
                for r in con.execute(
                    "SELECT player_id, pos, proj_pts, vbd, dollar_value, tier, "
                    "source_spread FROM valuation WHERE run_id=?", (args.run,))]

    (out / "config.json").write_text(json.dumps(
        {"config": cfg, "model_params_used": mp,
         "run_config": run_config, "source_order": sources}, indent=1))
    (out / "projections.json").write_text(json.dumps(proj))
    (out / "prior.json").write_text(json.dumps(prior))
    (out / "expected.json").write_text(json.dumps(
        {"run_id": args.run, "rows": expected}))
    print(f"exported run {args.run}: {len(expected)} expected rows, "
          f"{len(sources)} sources ({', '.join(sources)}), "
          f"{len(prior)} prior cells -> {out}/")


if __name__ == "__main__":
    main()
