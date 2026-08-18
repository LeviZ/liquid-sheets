/* One-click Sleeper fetch (DATA-IN-SPEC Path A). Public unauthenticated API
 * with permissive CORS, verified 2026-08-18. Stat mapping mirrors the
 * predecessor's proven ingest; the engine scores raw stat lines under the
 * user's own rules, so Sleeper's default-scoring points are never used. */

const POSITIONS = ["QB", "RB", "WR", "TE"];

const STAT_MAP = {
  pass_yd: "pass_yds", pass_td: "pass_tds", pass_int: "ints",
  pass_cmp: "completions", pass_att: "pass_atts",
  rush_yd: "rush_yds", rush_td: "rush_tds", rush_att: "rush_atts",
  rec: "receptions", rec_yd: "rec_yds", rec_td: "rec_tds",
  fum_lost: "fumbles_lost",
};

export function sleeperUrl(season) {
  const pos = POSITIONS.map((p) => `position[]=${p}`).join("&");
  return `https://api.sleeper.com/projections/nfl/${season}` +
    `?season_type=regular&${pos}&order_by=adp_half_ppr`;
}

/* Returns {as_of, players, names, meta}; players match the engine's input
 * shape. Throws on network failure; the caller owns the offline message. */
export async function fetchSleeper(season) {
  const resp = await fetch(sleeperUrl(season));
  if (!resp.ok) throw new Error(`Sleeper responded ${resp.status}`);
  const items = await resp.json();
  const players = [], names = {}, meta = {};
  for (const it of items) {
    const pl = it.player ?? {};
    const stats = it.stats ?? {};
    const pos = pl.position;
    if (!POSITIONS.includes(pos) || !stats.pts_half_ppr) continue;
    const pid = `sl:${it.player_id}`;
    const line = {};
    for (const [theirs, ours] of Object.entries(STAT_MAP)) {
      if (stats[theirs] !== undefined && stats[theirs] !== null) {
        line[ours] = stats[theirs];
      }
    }
    line.two_pt = (stats.pass_2pt ?? 0) + (stats.rush_2pt ?? 0) +
      (stats.rec_2pt ?? 0);
    players.push({ player_id: pid, pos, team: it.team ?? null, stats: line });
    names[pid] = `${pl.first_name ?? ""} ${pl.last_name ?? ""}`.trim();
    meta[pid] = {
      adp: stats.adp_half_ppr && stats.adp_half_ppr < 999
        ? Math.round(stats.adp_half_ppr) : null,
      injury_status: pl.injury_status ?? null,
      is_rookie: pl.years_exp === 0,
    };
  }
  return { as_of: new Date().toISOString().slice(0, 10), players, names, meta };
}
