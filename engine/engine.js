/* Liquid Sheets valuation engine (JS port of the proven Python engine).
 *
 * Pure functions, no DOM, no storage, no dependencies. Pipeline:
 * projections -> scored points -> availability discount -> shallow-baseline
 * VBD -> auction dollars -> gap tiers. Verified against the predecessor's
 * Python engine by the golden-master harness in verify/.
 *
 * Faithfulness notes (do not "fix" these):
 * - pyRound replicates Python's round-half-to-even; Math.round would drift
 *   baselines on exact halves.
 * - Sorts rely on Array.prototype.sort stability (guaranteed since ES2019)
 *   to preserve tie order exactly as the Python engine's stable sorts do.
 * - baselines() reads cfg.model_params (league defaults), while alpha/theta
 *   come from the run's possibly-overridden params: the Python engine does
 *   the same, and runs were recorded under that behavior.
 */

export const POSITIONS = ["QB", "RB", "WR", "TE"];

export function pyRound(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return d > 0.5 ? f + 1 : f;
}

/* Python's round(x, 1) rounds the EXACT binary value with ties-to-even.
 * toFixed is also correctly rounded from the exact value but breaks ties
 * upward. The only values exactly halfway between tenths that a binary
 * float can represent are the x.25 / x.75 family (odd multiple of 1/4),
 * so detect that case and apply ties-to-even; everywhere else toFixed
 * agrees with Python. The golden master caught real .25 ties in spreads. */
export function round1(x) {
  if (Number.isInteger(x * 4) && !Number.isInteger(x * 2)) {
    const f = Math.floor(x * 10);
    return (f % 2 === 0 ? f : f + 1) / 10;
  }
  return Number(x.toFixed(1));
}

export function scoreStatLine(pos, st, scoring) {
  const g = (k) => st[k] ?? 0;
  const p = scoring.pass ?? {};
  const r = scoring.rush ?? {};
  const c = scoring.rec ?? {};
  const m = scoring.misc ?? {};
  let pts = 0;
  pts += g("pass_yds") * (p.yd ?? 0) + g("pass_tds") * (p.td ?? 0);
  pts += g("ints") * (p.int ?? 0);
  pts += g("rush_yds") * (r.yd ?? 0) + g("rush_tds") * (r.td ?? 0);
  pts += g("rec_yds") * (c.yd ?? 0) + g("rec_tds") * (c.td ?? 0);
  pts += g("receptions") * ((c.ppr_by_pos ?? {})[pos] ?? 0);
  pts += g("fumbles_lost") * (m.fumble_lost ?? 0);
  pts += g("two_pt") * (m.two_pt ?? 0);
  return Math.max(pts, 0);
}

export function flexShares(slots) {
  const fRb = Math.min(0.25 + (slots.WR - slots.RB) / 3.0, 0.8);
  const fTe = slots.TE === 0 && (slots.FLEX ?? 0) > 0 ? 0.4 : 0.1;
  return { RB: fRb, TE: fTe, WR: 1.0 - fRb - fTe, QB: 0.0 };
}

export function baselines(cfg) {
  const slots = cfg.roster_slots;
  const share = cfg.model_params.baseline_bench_share;
  const f = flexShares(slots);
  const flex = slots.FLEX ?? 0;
  const out = {};
  for (const pos of POSITIONS) {
    const eff = (slots[pos] ?? 0) + f[pos] * flex;
    out[pos] = Math.max(pyRound(cfg.teams * eff * (1 + share)), 1);
  }
  return out;
}

export function gapTiers(vbds, theta) {
  if (!vbds.length) return [];
  const maxVbd = Math.max(vbds[0], 1e-9);
  const tiers = [1];
  let t = 1;
  for (let i = 1; i < vbds.length; i++) {
    if (vbds[i - 1] - vbds[i] > theta * maxVbd) t += 1;
    tiers.push(t);
  }
  return tiers;
}

/* sourcesMap: ordered {name: {as_of, players: [{player_id,pos,team,stats}]}}.
 * Averages each stat across sources; records per-player source spread
 * (max minus min of per-source scored points). */
export function blendProjections(sourcesMap, scoring, exclude = []) {
  const perPlayer = new Map();
  const dates = [];
  for (const [src, data] of Object.entries(sourcesMap)) {
    if (exclude.includes(src)) continue;
    dates.push(`${src}@${data.as_of}`);
    for (const p of data.players) {
      if (!perPlayer.has(p.player_id)) {
        perPlayer.set(p.player_id, { pos: p.pos, team: p.team, lines: [] });
      }
      perPlayer.get(p.player_id).lines.push(p.stats);
    }
  }
  const out = [];
  for (const [pid, d] of perPlayer) {
    const keys = new Set();
    for (const l of d.lines) for (const k of Object.keys(l)) keys.add(k);
    const avg = {};
    for (const k of keys) {
      let s = 0;
      for (const l of d.lines) s += l[k] ?? 0;
      avg[k] = s / d.lines.length;
    }
    const pts = d.lines.map((l) => scoreStatLine(d.pos, l, scoring));
    out.push({
      player_id: pid, pos: d.pos, team: d.team, stats: avg,
      spread: pts.length > 1
        ? round1(Math.max(...pts) - Math.min(...pts))
        : null,
    });
  }
  return { asOf: dates.join(" + "), players: out };
}

/* cfg: {season, teams, budget, weeks, roster_slots, scoring, model_params}.
 * players: [{player_id, pos, team, stats, spread?}] (from blendProjections or
 * a single source). prior: [[pos, rank_slot, exp_games_missed], ...].
 * mp: the run's model params (defaults to cfg.model_params; a caller may pass
 * overridden values, recorded in the run for traceability). */
export function valueBoard(cfg, players, prior, mp = cfg.model_params) {
  const weeks = cfg.weeks;
  const priorMap = new Map(prior.map(([pos, slot, m]) => [`${pos}|${slot}`, m]));

  const ps = players.map((p) => ({
    ...p, raw_pts: scoreStatLine(p.pos, p.stats, cfg.scoring),
  }));

  for (const pos of POSITIONS) {
    const group = ps.filter((p) => p.pos === pos)
      .sort((a, b) => b.raw_pts - a.raw_pts);
    group.forEach((p, i) => {
      const missed = priorMap.get(`${pos}|${Math.min(i + 1, 100)}`) ?? 0;
      p.proj_pts = (p.raw_pts * (weeks - missed)) / weeks;
    });
  }

  const nBase = baselines(cfg);
  const f = flexShares(cfg.roster_slots);
  const flex = cfg.roster_slots.FLEX ?? 0;
  const nVols = {};
  for (const pos of POSITIONS) {
    nVols[pos] = Math.max(
      pyRound(cfg.teams * ((cfg.roster_slots[pos] ?? 0) + f[pos] * flex)), 1);
  }
  const alpha = mp.vols_blend_alpha ?? 0;

  for (const pos of POSITIONS) {
    const group = ps.filter((p) => p.pos === pos)
      .sort((a, b) => b.proj_pts - a.proj_pts);
    const ptsAt = (rank) =>
      group.length ? group[Math.min(rank, group.length) - 1].proj_pts : 0;
    const basePts = alpha * ptsAt(nVols[pos]) + (1 - alpha) * ptsAt(nBase[pos]);
    for (const p of group) p.vbd = p.proj_pts - basePts;
    const tiers = gapTiers(group.map((p) => p.vbd), mp.tier_gap_theta);
    group.forEach((p, i) => { p.tier = tiers[i]; });
  }

  const premium = cfg.budget * cfg.teams - mp.dollar_slots_per_team * cfg.teams;
  let totalPosVbd = 0;
  for (const p of ps) if (p.vbd > 0) totalPosVbd += p.vbd;
  for (const p of ps) {
    p.dollar = totalPosVbd > 0
      ? Math.max((p.vbd * premium) / totalPosVbd + 1, 1.0)
      : 1.0;
  }

  return {
    meta: { baselines: nBase, vols_baselines: nVols, premium },
    players: ps.map((p) => ({
      player_id: p.player_id, pos: p.pos, team: p.team,
      proj_pts: round1(p.proj_pts), vbd: round1(p.vbd),
      dollar: round1(p.dollar), tier: p.tier, spread: p.spread ?? null,
    })),
  };
}
