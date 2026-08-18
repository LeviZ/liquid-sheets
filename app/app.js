/* Liquid Sheets app shell, M1: wizard -> fetch -> engine -> board -> persist.
 * Draft room features arrive in M3/M4; this milestone proves the full pipe. */

import { blendProjections, valueBoard, POSITIONS } from "../engine/engine.js";
import { PRIOR, PRIOR_SEASON } from "./prior_2026.js";
import { loadDoc, saveDoc, wipeDoc, newDoc, exportDoc, importDocFile }
  from "./storage.js";
import { fetchSleeper } from "./sleeper.js";

let doc = null;
const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

/* ------------------------------------------------------------- scoring */

const PRESETS = {
  standard: 0, half: 0.5, full: 1,
};

function buildScoring(pprPerRec, knobs) {
  return {
    pass: { yd: knobs.pass_yd, td: knobs.pass_td, int: knobs.int },
    rush: { yd: knobs.rush_rec_yd, td: knobs.rush_rec_td },
    rec: {
      yd: knobs.rush_rec_yd, td: knobs.rush_rec_td,
      ppr_by_pos: { QB: pprPerRec, RB: pprPerRec, WR: pprPerRec, TE: pprPerRec },
    },
    misc: { fumble_lost: knobs.fumble_lost, two_pt: knobs.two_pt },
  };
}

const DEFAULT_KNOBS = {
  pass_yd: 0.04, pass_td: 4, int: -2,
  rush_rec_yd: 0.1, rush_rec_td: 6, fumble_lost: -2, two_pt: 2,
};

/* -------------------------------------------------------------- wizard */

const wizardState = {
  step: 0,
  platform: "yahoo",
  teams: 12, budget: 200,
  roster: { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, K: 1, DEF: 1, BN: 5 },
  preset: "half",
  knobs: { ...DEFAULT_KNOBS },
  teamNames: [],
};

const STEPS = ["Platform", "League", "Roster", "Scoring", "Teams", "Data"];

function renderWizard() {
  const root = $("#main");
  root.innerHTML = "";
  const box = el("div", "wizard");
  const crumbs = el("div", "crumbs");
  STEPS.forEach((s, i) => {
    const c = el("span", i === wizardState.step ? "crumb on" : "crumb", s);
    crumbs.appendChild(c);
  });
  box.appendChild(crumbs);
  const body = el("div", "wizbody");
  box.appendChild(body);
  const nav = el("div", "wiznav");
  box.appendChild(nav);
  root.appendChild(box);

  const steps = [stepPlatform, stepLeague, stepRoster, stepScoring,
    stepTeams, stepData];
  steps[wizardState.step](body, nav);
}

function navButtons(nav, { back = true, next = "Next", onNext }) {
  if (back && wizardState.step > 0) {
    const b = el("button", "ghost", "Back");
    b.onclick = () => { wizardState.step--; renderWizard(); };
    nav.appendChild(b);
  }
  const n = el("button", "primary", next);
  n.onclick = onNext;
  nav.appendChild(n);
}

function stepPlatform(body, nav) {
  body.appendChild(el("h2", null, "Where does your league live?"));
  body.appendChild(el("p", "hint",
    "Auction drafts only. This picks paste formats and colors later; " +
    "every number is computed from your own settings either way."));
  const row = el("div", "choices");
  for (const p of ["yahoo", "espn", "other"]) {
    const b = el("button",
      wizardState.platform === p ? "choice on" : "choice",
      p === "espn" ? "ESPN" : p[0].toUpperCase() + p.slice(1));
    b.onclick = () => { wizardState.platform = p; renderWizard(); };
    row.appendChild(b);
  }
  body.appendChild(row);
  navButtons(nav, { onNext: () => { wizardState.step = 1; renderWizard(); } });
}

function numInput(labelText, value, min, max, onchange) {
  const wrap = el("label", "field");
  wrap.appendChild(el("span", null, labelText));
  const inp = el("input");
  inp.type = "number"; inp.value = value; inp.min = min; inp.max = max;
  inp.onchange = () => onchange(Number(inp.value));
  wrap.appendChild(inp);
  return wrap;
}

function stepLeague(body, nav) {
  body.appendChild(el("h2", null, "League shape"));
  body.appendChild(numInput("Teams", wizardState.teams, 4, 20,
    (v) => { wizardState.teams = v; }));
  body.appendChild(numInput("Auction budget per team ($)", wizardState.budget,
    50, 1000, (v) => { wizardState.budget = v; }));
  navButtons(nav, { onNext: () => { wizardState.step = 2; renderWizard(); } });
}

function stepRoster(body, nav) {
  body.appendChild(el("h2", null, "Roster"));
  body.appendChild(el("p", "hint",
    "Starting slots per position, one FLEX pool (RB/WR/TE), bench size. " +
    "Kickers and defenses are priced at $1 by design."));
  const grid = el("div", "grid4");
  for (const slot of ["QB", "RB", "WR", "TE", "FLEX", "K", "DEF", "BN"]) {
    grid.appendChild(numInput(slot, wizardState.roster[slot], 0, 12,
      (v) => { wizardState.roster[slot] = v; }));
  }
  body.appendChild(grid);
  navButtons(nav, { onNext: () => { wizardState.step = 3; renderWizard(); } });
}

function stepScoring(body, nav) {
  body.appendChild(el("h2", null, "Scoring"));
  const row = el("div", "choices");
  for (const [name] of Object.entries(PRESETS)) {
    const label = name === "half" ? "Half PPR"
      : name === "full" ? "Full PPR" : "Standard";
    const b = el("button",
      wizardState.preset === name ? "choice on" : "choice", label);
    b.onclick = () => { wizardState.preset = name; renderWizard(); };
    row.appendChild(b);
  }
  body.appendChild(row);
  body.appendChild(el("p", "hint",
    "These are the exact numbers the engine scores with. The preset fills " +
    "them in; edit any of them to match your league."));
  const form = el("div", "form");
  const knobDefs = [
    ["pass_yd", "Points per passing yard"], ["pass_td", "Passing TD"],
    ["int", "Interception"], ["rush_rec_yd", "Points per rush/rec yard"],
    ["rush_rec_td", "Rush/rec TD"], ["fumble_lost", "Fumble lost"],
    ["two_pt", "Two-point conversion"],
  ];
  for (const [k, label] of knobDefs) {
    const r = el("label", "formrow");
    r.appendChild(el("span", null, label));
    const inp = el("input");
    inp.type = "number"; inp.step = "0.01"; inp.value = wizardState.knobs[k];
    inp.onchange = () => { wizardState.knobs[k] = Number(inp.value); };
    r.appendChild(inp);
    form.appendChild(r);
  }
  body.appendChild(form);
  navButtons(nav, { onNext: () => { wizardState.step = 4; renderWizard(); } });
}

function stepTeams(body, nav) {
  body.appendChild(el("h2", null, "Team names"));
  body.appendChild(el("p", "hint",
    "One per line. Editable any time later. The first one is yours."));
  const ta = el("textarea");
  ta.rows = Math.min(wizardState.teams, 14);
  if (!wizardState.teamNames.length) {
    wizardState.teamNames = Array.from({ length: wizardState.teams },
      (_, i) => `Team ${i + 1}`);
  }
  ta.value = wizardState.teamNames.join("\n");
  body.appendChild(ta);
  navButtons(nav, {
    onNext: () => {
      const names = ta.value.split("\n").map((s) => s.trim()).filter(Boolean);
      while (names.length < wizardState.teams) {
        names.push(`Team ${names.length + 1}`);
      }
      wizardState.teamNames = names.slice(0, wizardState.teams);
      wizardState.step = 5; renderWizard();
    },
  });
}

function stepData(body, nav) {
  body.appendChild(el("h2", null, "Projections"));
  body.appendChild(el("p", "hint",
    "One click fetches projections from Sleeper's public data, straight " +
    "from your browser. You can add more sources later."));
  const btn = el("button", "primary big", "Fetch projections");
  const msg = el("p", "msg");
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Fetching...";
    try {
      await finishWizard();
      await doFetchSleeper();
      renderBoard();
    } catch (e) {
      msg.textContent = `Fetch failed (${e.message}). If you are offline, ` +
        "reconnect and try again; the wizard settings are saved.";
      btn.disabled = false; btn.textContent = "Fetch projections";
    }
  };
  body.appendChild(btn);
  body.appendChild(msg);
  navButtons(nav, {
    next: "Skip for now",
    onNext: async () => { await finishWizard(); renderBoard(); },
  });
}

function totalRosterSpots(roster) {
  return Object.values(roster).reduce((a, b) => a + b, 0);
}

async function finishWizard() {
  if (!doc) doc = newDoc();
  const w = wizardState;
  doc.league = {
    platform: w.platform, season: PRIOR_SEASON,
    teams: w.teams, budget: w.budget, weeks: 17,
    roster_slots: { QB: w.roster.QB, RB: w.roster.RB, WR: w.roster.WR,
      TE: w.roster.TE, FLEX: w.roster.FLEX },
    full_roster: { ...w.roster },
    scoring: buildScoring(PRESETS[w.preset], w.knobs),
    model_params: {
      baseline_bench_share: 0.15, vols_blend_alpha: 0,
      tier_gap_theta: 0.2,
      dollar_slots_per_team: totalRosterSpots(w.roster),
    },
    team_names: [...w.teamNames],
  };
  await saveDoc(doc);
}

/* ---------------------------------------------------------------- runs */

async function doFetchSleeper() {
  const { as_of, players, kdef, names, meta } =
    await fetchSleeper(doc.league.season);
  doc.sources.sleeper = { as_of, players };
  doc.kdef = { as_of, players: kdef };
  Object.assign(doc.names, names);
  Object.assign(doc.player_meta, meta);
  await makeRun();
}

async function makeRun() {
  const cfg = doc.league;
  const sourceNames = Object.keys(doc.sources);
  if (!sourceNames.length) return;
  let asOf, players, label;
  if (sourceNames.length > 1) {
    ({ asOf, players } = blendProjections(doc.sources, cfg.scoring));
    label = "blend";
  } else {
    const s = doc.sources[sourceNames[0]];
    asOf = `${sourceNames[0]}@${s.as_of}`;
    players = s.players;
    label = sourceNames[0];
  }
  const result = valueBoard(cfg, players, PRIOR);
  doc.runs.push({
    run_id: doc.runs.length + 1,
    created_at: new Date().toISOString(),
    source_label: label, as_of: asOf,
    meta: result.meta,
    players: result.players,
  });
  await saveDoc(doc);
}

/* --------------------------------------------------------------- board */

function renderBoard() {
  const root = $("#main");
  root.innerHTML = "";
  const run = doc.runs[doc.runs.length - 1];

  const bar = el("div", "topbar");
  if (run) {
    const chip = (text, tip) => {
      const c = el("span", "chip", text);
      c.dataset.tip = tip;
      bar.appendChild(c);
    };
    chip(`run ${run.run_id} (${run.source_label}) ${run.as_of}`,
      "Every dollar on this board traces to this numbered engine run: " +
      "which projections it used and when they were fetched.");
    chip(`premium $${run.meta.premium}`,
      "The money that buys value: all league dollars minus $1 per roster " +
      "spot, split among players by how far they sit above replacement.");
    chip("baselines " + POSITIONS.map((p) => `${p}${run.meta.baselines[p]}`)
      .join(" "),
      "Replacement level per position: the positional rank where value " +
      "reaches $1 (last starter plus a bench share). VBD measures points " +
      "above this player.");
  }
  const spacer = el("span", "spacer");
  bar.appendChild(spacer);
  const refresh = el("button", "ghost", "Refresh projections");
  refresh.onclick = async () => {
    refresh.disabled = true; refresh.textContent = "Fetching...";
    try { await doFetchSleeper(); renderBoard(); }
    catch (e) {
      refresh.textContent = "Offline; board unchanged";
      setTimeout(renderBoard, 2500);
    }
  };
  bar.appendChild(refresh);
  const exp = el("button", "ghost", "Export backup");
  exp.onclick = () => exportDoc(doc);
  bar.appendChild(exp);
  const reset = el("button", "ghost danger", "Reset");
  reset.onclick = async () => {
    if (!confirm("Delete all local Liquid Sheets data? Export a backup first."))
      return;
    await wipeDoc(); doc = null; wizardState.step = 0; renderWizard();
  };
  bar.appendChild(reset);
  root.appendChild(bar);

  if (!run) {
    const empty = el("div", "empty");
    empty.appendChild(el("p", null,
      "No projections yet. Fetch to populate the board."));
    const btn = el("button", "primary", "Fetch projections");
    btn.onclick = async () => {
      btn.disabled = true;
      try { await doFetchSleeper(); renderBoard(); }
      catch (e) { btn.textContent = `Failed: ${e.message}`; }
    };
    empty.appendChild(btn);
    root.appendChild(empty);
    return;
  }

  const headerRow = (table) => {
    const h = el("div", "row colhead");
    h.appendChild(el("span", "nm", "Player"));
    const pts = el("span", "pts", "Pts");
    pts.dataset.tip = "Projected season points under YOUR scoring rules, " +
      "after the injury-availability discount.";
    h.appendChild(pts);
    const usd = el("span", "usd", "Our $");
    usd.dataset.tip = "Auction value: this player's share of the league's " +
      "money, by points above the positional baseline.";
    h.appendChild(usd);
    table.appendChild(h);
  };
  const cols = el("div", "cols");
  for (const pos of POSITIONS) {
    const col = el("div", "col");
    col.appendChild(el("h3", `pos-${pos.toLowerCase()}`, pos));
    const table = el("div", "rows");
    headerRow(table);
    const group = run.players.filter((p) => p.pos === pos)
      .sort((a, b) => b.dollar - a.dollar).slice(0, 40);
    let lastTier = null;
    for (const p of group) {
      if (lastTier !== null && p.tier !== lastTier) {
        table.appendChild(el("div", "tiercut"));
      }
      lastTier = p.tier;
      const row = el("div", "row");
      row.appendChild(el("span", "nm", doc.names[p.player_id] ?? p.player_id));
      row.appendChild(el("span", "pts", p.proj_pts.toFixed(0)));
      row.appendChild(el("span", "usd", `$${p.dollar.toFixed(0)}`));
      table.appendChild(row);
    }
    col.appendChild(table);
    cols.appendChild(col);
  }
  if (doc.kdef && doc.kdef.players.length) {
    const col = el("div", "col");
    const h3 = el("h3", "pos-kdef", "K / DEF");
    h3.dataset.tip = "Kickers and defenses are priced at $1 by design: " +
      "their year-to-year value is too noisy to bid on.";
    col.appendChild(h3);
    const table = el("div", "rows");
    for (const sub of ["K", "DEF"]) {
      table.appendChild(el("div", "row subhead", sub === "K"
        ? "Kickers" : "Defenses"));
      for (const p of doc.kdef.players.filter((x) => x.pos === sub)
        .slice(0, 14)) {
        const row = el("div", "row");
        row.appendChild(el("span", "nm",
          doc.names[p.player_id] ?? p.player_id));
        row.appendChild(el("span", "pts", p.pts.toFixed(0)));
        row.appendChild(el("span", "usd", "$1"));
        table.appendChild(row);
      }
    }
    col.appendChild(table);
    cols.appendChild(col);
  }
  root.appendChild(cols);
}

/* ---------------------------------------------------------------- boot */

async function boot() {
  doc = await loadDoc();
  const importInput = $("#importfile");
  importInput.onchange = async () => {
    if (!importInput.files.length) return;
    try {
      doc = await importDocFile(importInput.files[0]);
      doc.league ? renderBoard() : renderWizard();
    } catch (e) { alert(e.message); }
  };
  $("#importbtn").onclick = () => importInput.click();
  if (doc && doc.league) renderBoard();
  else renderWizard();
}

boot();
