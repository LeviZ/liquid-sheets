/* Draft-day logic: append-only sale journal, owner ledger math, live
 * inflation, and The Call. Pure functions over the doc; UI lives in app.js.
 *
 * Doctrine: the journal is never rewritten. A sale appends a sale entry;
 * an undo appends an unsale entry referencing it. Board values never move
 * during the draft (runs are immutable); live market reality enters ONLY
 * through the inflation factor and The Call. */

export function totalRosterSpots(roster) {
  return Object.values(roster).reduce((a, b) => a + b, 0);
}

export function appendSale(doc, { pid, name, pos, owner, price }) {
  const seq = doc.journal.length + 1;
  doc.journal.push({ type: "sale", seq, ts: new Date().toISOString(),
    pid, name, pos, owner, price });
  return seq;
}

export function appendUnsale(doc, refSeq) {
  doc.journal.push({ type: "unsale", seq: doc.journal.length + 1,
    ts: new Date().toISOString(), ref: refSeq });
}

/* Active sales after folding unsale reversals, in sale order. */
export function activeSales(journal) {
  const undone = new Set();
  for (const e of journal) if (e.type === "unsale") undone.add(e.ref);
  return journal.filter((e) => e.type === "sale" && !undone.has(e.seq));
}

/* Per-owner ledger: spent, remaining, spots left, and max bid (remaining
 * minus $1 for every other open spot; you can never bid what you cannot
 * roster around). */
export function ownerStates(league, sales) {
  const spots = totalRosterSpots(league.full_roster);
  const owners = league.team_names.map((name, i) => ({
    idx: i, name, spent: 0, count: 0,
  }));
  for (const s of sales) {
    const o = owners[s.owner];
    if (!o) continue;
    o.spent += s.price;
    o.count += 1;
  }
  for (const o of owners) {
    o.remaining = league.budget - o.spent;
    o.spotsLeft = spots - o.count;
    o.maxBid = o.spotsLeft > 0 ? o.remaining - (o.spotsLeft - 1) : 0;
  }
  return owners;
}

/* Live inflation: money still in the room versus board value still on it,
 * over the draftable pool (top teams x roster-spots players by value).
 * Above 1: money is chasing less value and prices run hot. */
export function inflationFactor(league, run, sales) {
  const poolN = league.teams *
    league.model_params.dollar_slots_per_team;
  const sold = new Set(sales.map((s) => s.pid));
  const pool = [...run.players].sort((a, b) => b.dollar - a.dollar)
    .slice(0, poolN);
  let remainingValue = 0;
  for (const p of pool) if (!sold.has(p.player_id)) remainingValue += p.dollar;
  const spent = sales.reduce((a, s) => a + s.price, 0);
  const remainingMoney = league.teams * league.budget - spent;
  return remainingValue > 0 ? remainingMoney / remainingValue : 1;
}

/* The Call: the answer to "should I bid, and up to how much" for a staged
 * player, in the seconds after a nomination. Board value never moves; the
 * live layer is inflation and my own ledger cap. */
export function theCall({ league, run, player, sales, marketValues, scale }) {
  const owners = ownerStates(league, sales);
  const me = owners[0];
  const infl = inflationFactor(league, run, sales);
  const adjusted = Math.max(player.dollar * infl, 1);
  const bidTo = Math.min(Math.round(adjusted), Math.max(me.maxBid, 1));

  const group = run.players.filter((p) => p.pos === player.pos)
    .sort((a, b) => b.dollar - a.dollar);
  const rank = group.findIndex((p) => p.player_id === player.player_id) + 1;
  const baseRank = run.meta.baselines[player.pos] ?? 0;
  const sold = new Set(sales.map((s) => s.pid));
  const tierMates = group.filter((p) => p.tier === player.tier &&
    !sold.has(p.player_id));

  const badges = [];
  let verdict;
  if (rank > baseRank || player.dollar <= 1) {
    verdict = "DOLLAR ONLY";
    badges.push("below the FREE line");
  } else {
    let deal = null;
    if (marketValues && marketValues[player.player_id] != null) {
      deal = player.dollar - marketValues[player.player_id] * scale;
    }
    if (tierMates.length === 1) badges.push("LAST OF TIER " + player.tier);
    if (deal != null && deal >= 3) {
      verdict = "TARGET";
      badges.push(`room likely underprices by $${Math.round(deal)}`);
    } else if (deal != null && deal <= -3) {
      verdict = "LET THE ROOM PAY";
      badges.push(`room likely overpays by $${Math.round(-deal)}`);
    } else {
      verdict = tierMates.length === 1 ? "TARGET" : "FAIR VALUE";
    }
    if (bidTo < Math.round(adjusted)) badges.push("capped by your max bid");
  }
  const contenders = owners.slice(1)
    .filter((o) => o.maxBid >= Math.round(adjusted)).length;
  return { verdict, bidTo, adjusted, inflation: infl, badges, rank,
    baseRank, contenders, myMax: me.maxBid };
}
