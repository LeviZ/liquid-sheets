/* Liquid Sheets app shell, M1: wizard -> fetch -> engine -> board -> persist.
 * Draft room features arrive in M3/M4; this milestone proves the full pipe. */

import { blendProjections, valueBoard, scoreStatLine, POSITIONS }
  from "../engine/engine.js";
import { KINDS, parsePaste, guessMapping, toEntries, matchEntries,
  rankImpliedStats, marketScale, detectKind } from "./importers.js";
import { activeSales, appendSale, appendUnsale, ownerStates,
  inflationFactor, theCall, totalRosterSpots as rosterSpots }
  from "./draft.js";
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

/* Platform selection was removed from the wizard (V3): it had no effect at
 * setup time. The paste-import flow asks for the format at the moment it
 * actually matters. */
const STEPS = ["League", "Roster", "Scoring", "Teams", "Data"];

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

  const steps = [stepLeague, stepRoster, stepScoring, stepTeams, stepData];
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
  navButtons(nav, { onNext: () => { wizardState.step++; renderWizard(); } });
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
  navButtons(nav, { onNext: () => { wizardState.step++; renderWizard(); } });
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
  body.appendChild(el("p", "hint", "Enter your league's scoring settings"));
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
  navButtons(nav, { onNext: () => { wizardState.step++; renderWizard(); } });
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
      wizardState.step++; renderWizard();
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
      renderBoardScreen();
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
    onNext: async () => { await finishWizard(); renderBoardScreen(); },
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

/* -------------------------------------------------------------- import */

let importState = null;

/* Per-position expansion of the below-FREE section. Module-level, never on
 * DOM nodes: re-renders destroy nodes (the predecessor's dead-expander
 * lesson). Collapsed by default. */
const freeExpanded = {};

function boardRoster() {
  const roster = [];
  for (const src of Object.values(doc.sources)) {
    for (const p of src.players) {
      roster.push({ pid: p.player_id, name: doc.names[p.player_id] ?? "",
        pos: p.pos });
    }
  }
  if (doc.kdef) {
    for (const p of doc.kdef.players) {
      roster.push({ pid: p.player_id, name: doc.names[p.player_id] ?? "",
        pos: p.pos });
    }
  }
  const seen = new Set();
  return roster.filter((r) => !seen.has(r.pid) && seen.add(r.pid));
}

function renderImport() {
  const root = $("#main");
  root.innerHTML = "";
  const panel = el("div", "bigpanel");
  root.appendChild(panel);
  panel.appendChild(el("h2", null, "Add data"));
  panel.appendChild(el("p", "hint",
    "Add the values that the rest of your league will likely be using. " +
    "Import today's Yahoo or ESPN values (avg salary) as a csv or copy " +
    "and paste plain text here."));
  panel.appendChild(el("p", "hint",
    "If your source is not actual auction salary values, you can also use " +
    "other formats (projection or player rankings); the app detects what " +
    "you pasted."));

  const ta = el("textarea");
  ta.rows = 10;
  ta.placeholder = "Paste here (or choose a file below)";
  ta.value = importState.text ?? "";
  ta.oninput = () => { importState.text = ta.value; };
  panel.appendChild(ta);

  const fileRow = el("div", "choices");
  const fileInp = el("input");
  fileInp.type = "file"; fileInp.accept = ".csv,.tsv,.txt";
  fileInp.onchange = async () => {
    if (fileInp.files.length) {
      importState.text = await fileInp.files[0].text();
      ta.value = importState.text;
    }
  };
  fileRow.appendChild(fileInp);
  panel.appendChild(fileRow);

  const msg = el("p", "msg");
  panel.appendChild(msg);
  const nav = el("div", "wiznav");
  const cancel = el("button", "ghost", "Cancel");
  cancel.onclick = () => { importState = null; renderBoardScreen(); };
  nav.appendChild(cancel);
  const prev = el("button", "primary", "Preview");
  prev.onclick = () => {
    const parsed = parsePaste(importState.text ?? "");
    if (!parsed.rows.length) { msg.textContent = "Nothing parseable found."; return; }
    importState.parsed = parsed;
    importState.kind = detectKind(parsed);
    setMapping();
    renderMapper();
  };
  nav.appendChild(prev);
  panel.appendChild(nav);
}

function setMapping() {
  const { parsed, kind } = importState;
  if (parsed.preset === "yahoo" && kind === "values") {
    importState.mapping = ["name", "pos", "team", "ignore", "value", "ignore"];
  } else {
    importState.mapping = guessMapping(parsed.headers, parsed.rows, kind);
  }
}

function renderMapper() {
  const root = $("#main");
  root.innerHTML = "";
  const panel = el("div", "bigpanel wide");
  root.appendChild(panel);
  const { parsed, mapping, kind } = importState;
  panel.appendChild(el("h2", null,
    `Confirm the columns (${parsed.rows.length} rows` +
    (parsed.preset === "yahoo" ? ", Yahoo format detected" : "") + ")"));
  const kindRow = el("div", "choices");
  kindRow.appendChild(el("span", "hint", "Looks like:"));
  for (const [k, def] of Object.entries(KINDS)) {
    const b = el("button", kind === k ? "choice on" : "choice", def.label);
    b.onclick = () => { importState.kind = k; setMapping(); renderMapper(); };
    kindRow.appendChild(b);
  }
  panel.appendChild(kindRow);
  if (kind === "values") {
    const radios = el("div", "choices radios");
    radios.appendChild(el("span", "hint", "These values are from:"));
    for (const p of ["yahoo", "espn"]) {
      const lab = el("label", "radio");
      const r = el("input");
      r.type = "radio"; r.name = "platform"; r.value = p;
      const current = importState.platform ??
        (parsed.preset === "yahoo" ? "yahoo" : "yahoo");
      importState.platform = current;
      r.checked = current === p;
      r.onchange = () => { importState.platform = p; };
      lab.appendChild(r);
      lab.appendChild(el("span", null, p === "espn" ? "ESPN" : "Yahoo"));
      radios.appendChild(lab);
    }
    panel.appendChild(radios);
  } else {
    const labelRow = el("label", "field");
    labelRow.appendChild(el("span", null, "Source name"));
    const labelInp = el("input");
    labelInp.value = importState.label ?? kind;
    importState.label = importState.label ?? kind;
    labelInp.onchange = () => { importState.label = labelInp.value.trim(); };
    labelRow.appendChild(labelInp);
    panel.appendChild(labelRow);
  }
  panel.appendChild(el("p", "hint",
    "The app guessed what each column is. Fix any dropdown that is wrong; " +
    "set columns you do not want to \"ignore\"."));
  const fields = ["ignore", ...KINDS[kind].fields];
  const tbl = el("table", "maptable");
  const selRow = el("tr");
  mapping.forEach((f, i) => {
    const td = el("th");
    const sel = el("select");
    for (const opt of fields) {
      const o = el("option", null, opt);
      o.value = opt;
      if (opt === f) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = () => { importState.mapping[i] = sel.value; };
    td.appendChild(sel);
    selRow.appendChild(td);
  });
  tbl.appendChild(selRow);
  if (parsed.headers) {
    const hr = el("tr", "hdr");
    parsed.headers.forEach((h) => hr.appendChild(el("td", null, h)));
    tbl.appendChild(hr);
  }
  for (const r of parsed.rows.slice(0, 6)) {
    const tr = el("tr");
    r.forEach((c) => tr.appendChild(el("td", null, c)));
    tbl.appendChild(tr);
  }
  const wrap = el("div", "tblwrap");
  wrap.appendChild(tbl);
  panel.appendChild(wrap);
  const msg = el("p", "msg");
  panel.appendChild(msg);
  const nav = el("div", "wiznav");
  const back = el("button", "ghost", "Back");
  back.onclick = renderImport;
  nav.appendChild(back);
  const imp = el("button", "primary", "Import");
  imp.onclick = () => {
    if (!importState.mapping.includes("name")) {
      msg.textContent = "One column must be mapped to \"name\"."; return;
    }
    if (kind === "rankings" && !importState.mapping.includes("rank")) {
      msg.textContent = "Rankings need a \"rank\" column."; return;
    }
    const entries = toEntries(parsed.rows, importState.mapping);
    const { matched, unmatched } = matchEntries(entries, boardRoster());
    importState.matched = matched;
    importState.unmatched = unmatched;
    if (unmatched.length) renderUnmatched();
    else finishImport();
  };
  nav.appendChild(imp);
  panel.appendChild(nav);
}

function renderUnmatched() {
  const root = $("#main");
  root.innerHTML = "";
  const panel = el("div", "bigpanel");
  root.appendChild(panel);
  panel.appendChild(el("h2", null,
    `${importState.unmatched.length} rows did not match a player`));
  panel.appendChild(el("p", "hint",
    "Nothing is dropped silently. Match each row by hand or skip it."));
  const run = doc.runs[doc.runs.length - 1];
  const dollars = new Map(
    (run?.players ?? []).map((p) => [p.player_id, p.dollar]));
  const roster = boardRoster()
    .sort((a, b) => (dollars.get(b.pid) ?? 0) - (dollars.get(a.pid) ?? 0));
  importState.resolutions = importState.unmatched.map(() => null);
  const list = el("div", "form");
  importState.unmatched.forEach((e, i) => {
    const r = el("label", "formrow");
    r.appendChild(el("span", null,
      `${e.name}${e.pos ? ` (${e.pos})` : ""}`));
    const sel = el("select");
    sel.appendChild(el("option", null, "skip"));
    const cands = e.pos ? roster.filter((p) => p.pos === e.pos) : roster;
    for (const c of cands.slice(0, 80)) {
      const o = el("option", null, `${c.name} (${c.pos})`);
      o.value = c.pid;
      sel.appendChild(o);
    }
    sel.onchange = () => {
      importState.resolutions[i] = sel.value === "skip" ? null : sel.value;
    };
    r.appendChild(sel);
    list.appendChild(r);
  });
  panel.appendChild(list);
  const nav = el("div", "wiznav");
  const back = el("button", "ghost", "Back");
  back.onclick = renderMapper;
  nav.appendChild(back);
  const fin = el("button", "primary", "Finish import");
  fin.onclick = () => {
    importState.unmatched.forEach((e, i) => {
      if (importState.resolutions[i]) {
        importState.matched.push({ entry: e, pid: importState.resolutions[i] });
      }
    });
    finishImport();
  };
  nav.appendChild(fin);
  panel.appendChild(nav);
}

async function finishImport() {
  const { kind, matched } = importState;
  const label = kind === "values" ? (importState.platform ?? "yahoo")
    : (importState.label ?? kind).trim() || kind;
  const as_of = new Date().toISOString().slice(0, 10);
  const posOf = new Map(boardRoster().map((r) => [r.pid, r.pos]));
  if (kind === "values") {
    const values = {};
    for (const m of matched) {
      if (m.entry.value != null) values[m.pid] = m.entry.value;
    }
    doc.market = { label, as_of, values };
  } else if (kind === "projections") {
    doc.sources[label] = {
      as_of,
      players: matched.filter((m) => posOf.get(m.pid))
        .map((m) => ({ player_id: m.pid, pos: posOf.get(m.pid),
          team: m.entry.team ?? null, stats: m.entry.stats })),
    };
    await makeRun();
  } else if (kind === "rankings") {
    const srcNames = Object.keys(doc.sources);
    let reference;
    if (srcNames.length > 1) {
      reference = blendProjections(doc.sources, doc.league.scoring).players;
    } else if (srcNames.length === 1) {
      reference = doc.sources[srcNames[0]].players;
    } else {
      alert("Fetch or import projections first; rankings need a curve to map onto.");
      importState = null; renderBoardScreen(); return;
    }
    const withPos = matched.map((m) => ({ ...m, pos: posOf.get(m.pid) }))
      .filter((m) => m.pos);
    const players = rankImpliedStats(withPos, reference,
      (p) => scoreStatLine(p.pos, p.stats, doc.league.scoring));
    doc.sources[label] = { as_of, players };
    await makeRun();
  }
  await saveDoc(doc);
  importState = null;
  renderBoardScreen();
}

/* --------------------------------------------------------------- board */

/* ------------------------------------------------------------ the room
 * Ported from the original (levi-sheet/draftroom/app.html V36): same DOM
 * shape, same CSS, same interaction grammar. Data access adapted from its
 * server state to our local doc; everything else moves faithfully. */

let P = [], byId = {}, soldSet = new Set(), soldBy = {};
let hitList = [], hitSel = 0, picked = null, selOwner = null;
let stagedId = null, rosterView = null, showTeams = false, kdefView = "K";
let sortBy = localStorage.getItem("ls-sort") || "usd";
let mScale = 1;
let curRun = null, curSales = [];

const fmt$ = (v) => v == null ? "" : "$" + Math.round(v);
const posClass = (l) => ({ QB: "pQB", RB: "pRB", WR: "pWR", TE: "pTE",
  K: "pK", DEF: "pDEF" }[l] || "");
const owners = () => doc.league.team_names.map((name, i) =>
  ({ id: i, name, is_me: i === 0 }));
const short = (o) => o.is_me ? "ME"
  : o.name.split(" ")[0].slice(0, 4).toUpperCase();

window.onerror = (m, src, l) => { const e = $("#errbar");
  e.style.display = "block";
  e.textContent = "UI ERROR (screenshot this): " + m + " @line " + l; };
window.onunhandledrejection = (ev) => { const e = $("#errbar");
  e.style.display = "block";
  e.textContent = "UI ERROR (screenshot this): " + ev.reason; };

function slotOrder() {
  const r = doc.league.full_roster;
  const out = [];
  for (const pos of ["QB", "RB", "WR", "TE"]) {
    for (let i = 0; i < (r[pos] ?? 0); i++) out.push(pos);
  }
  for (let i = 0; i < (r.FLEX ?? 0); i++) out.push("FLX");
  for (const pos of ["K", "DEF"]) {
    for (let i = 0; i < (r[pos] ?? 0); i++) out.push(pos);
  }
  for (let i = 0; i < (r.BN ?? 0); i++) out.push("BN");
  return out;
}

function buildModel() {
  curRun = doc.runs[doc.runs.length - 1] ?? null;
  curSales = activeSales(doc.journal);
  soldSet = new Set(curSales.map((s) => s.pid));
  soldBy = {}; curSales.forEach((s) => { soldBy[s.pid] = s; });
  const mv = doc.market?.values ?? null;
  P = [];
  if (curRun) {
    for (const p of curRun.players) {
      const meta = doc.player_meta[p.player_id] ?? {};
      P.push({ id: p.player_id, name: doc.names[p.player_id] ?? p.player_id,
        pos: p.pos, team: p.team, pts: p.proj_pts, usd: p.dollar,
        tier: p.tier, inj: meta.injury_status, rookie: meta.is_rookie,
        y_avg: mv ? mv[p.player_id] ?? null : null });
    }
    mScale = mv ? marketScale(curRun.players, mv,
      doc.league.teams * doc.league.model_params.dollar_slots_per_team) : 1;
  }
  if (doc.kdef) {
    for (const p of doc.kdef.players) {
      P.push({ id: p.player_id, name: doc.names[p.player_id] ?? p.player_id,
        pos: p.pos, team: p.team, pts: p.pts, usd: null, tier: null,
        y_avg: mv ? mv[p.player_id] ?? null : null, kd: true });
    }
  }
  byId = {}; P.forEach((p) => { byId[p.id] = p; });
}

const dealOf = (p) => (doc.market && p.usd != null && p.y_avg != null)
  ? p.usd - p.y_avg * mScale : null;

/* ledger states in the original's field names */
function oStates() {
  return ownerStates(doc.league, curSales).map((o) => ({
    id: o.idx, name: o.name, is_me: o.idx === 0, spent: o.spent,
    left: o.remaining, open: o.spotsLeft, max: o.maxBid }));
}

/* inflation, ported: money over owners with open spots, value over the
 * top spotsLeft unsold players */
function inflation() {
  const os = oStates();
  const money = os.reduce((a, o) => a + (o.open > 0 ? o.left : 0), 0);
  const spotsLeft = os.reduce((a, o) => a + Math.max(o.open, 0), 0);
  const vals = P.filter((p) => !soldSet.has(p.id))
    .map((p) => Math.max(p.usd || 1, 1)).sort((a, b) => b - a)
    .slice(0, spotsLeft);
  const value = vals.reduce((a, b) => a + b, 0);
  return { money, value, ratio: value > 0 ? money / value : 1 };
}

function ownerNeedMap() {
  const r = doc.league.full_roster;
  const base = { QB: r.QB ?? 0, RB: r.RB ?? 0, WR: r.WR ?? 0, TE: r.TE ?? 0,
    FLX: r.FLEX ?? 0, K: r.K ?? 0, DEF: r.DEF ?? 0, BN: r.BN ?? 0 };
  const map = {};
  owners().forEach((o) => { map[o.id] = { ...base }; });
  curSales.forEach((s) => {
    const p = byId[s.pid]; if (!p) return;
    const n = map[s.owner]; if (!n) return;
    if (n[p.pos] > 0) n[p.pos]--;
    else if (["RB", "WR", "TE"].includes(p.pos) && n.FLX > 0) n.FLX--;
    else n.BN--;
  });
  return map;
}

/* BeerSheets-style surplus shading (ported, incl. sqrt scale) */
function surplusBg(ourVal, price) {
  const d = (ourVal == null ? 1 : ourVal) - price;
  if (Math.abs(d) < 0.5) return "";
  const t = Math.sqrt(Math.min(Math.abs(d), 20) / 20);
  const dark = !!document.documentElement.dataset.theme &&
    document.documentElement.dataset.theme !== "focus";
  const a = (dark ? 0.08 : 0.05) + t * (dark ? 0.40 : 0.36);
  return d > 0
    ? (dark ? `rgba(102,189,143,${a.toFixed(2)})` : `rgba(13,107,70,${a.toFixed(2)})`)
    : (dark ? `rgba(224,133,99,${a.toFixed(2)})` : `rgba(166,58,48,${a.toFixed(2)})`);
}

function stampShow(big, small) {
  const s = $("#stamp");
  s.innerHTML = `${big}<small>${small}</small>`;
  s.classList.remove("show"); void s.offsetWidth; s.classList.add("show");
  clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove("show"), 1600);
}

/* ---------------- board columns (ported) ---------------- */

function addRow(p, target, kdef) {
  const sold = soldSet.has(p.id), sale = soldBy[p.id];
  const winner = sale && owners()[sale.owner];
  const edge = dealOf(p);
  const row = el("div", "row " + (kdef ? "grid-kdef" : "grid-skill")
    + (sold ? " sold" : "")
    + (p.id === stagedId && !sold ? " staged" : ""));
  row.dataset.id = p.id;
  if (sold) row.style.background = surplusBg(kdef ? 1 : p.usd, sale.price);
  if (kdef) {
    row.innerHTML = `<span class="nm">${p.name}</span>`
      + (sold ? `<span class="mkt">${fmt$(sale.price)} ${short(winner)}</span>`
        : `<span class="mkt">${p.y_avg != null ? fmt$(p.y_avg) : "$1"}</span>`);
  } else {
    row.innerHTML =
      `<span class="tier">${p.tier ?? ""}</span>`
      + `<span class="nm">${p.name}<span class="tm">${p.team || ""}</span>`
      + (p.inj ? `<span class="inj" title="${p.inj}">+</span>` : "")
      + (p.rookie ? `<span class="rk" title="rookie">R</span>` : "") + `</span>`
      + `<span class="pts">${p.pts != null ? Math.round(p.pts) : ""}</span>`
      + (sold
        ? `<span class="edge"></span><span class="usd">${fmt$(sale.price)} ${short(winner)}</span>`
        : `<span class="edge ${edge > 2 ? "up" : edge < -2 ? "dn" : ""}">${edge == null ? "" : (edge > 0 ? "+" : "") + Math.round(edge)}</span>`
          + `<span class="usd">${fmt$(p.usd)}</span>`);
  }
  /* single click = popup; double click = nominate (ported timing trick) */
  row.onclick = () => {
    if (sold) { openModal(p.id); return; }
    clearTimeout(row._t);
    row._t = setTimeout(() => openModal(p.id), 260);
  };
  row.ondblclick = () => { if (!sold) { clearTimeout(row._t); pick(p.id); } };
  target.appendChild(row);
}

function skillCol(pos) {
  const col = el("div", "poscol");
  const base = curRun.meta.baselines[pos] ?? "";
  const dealCols = doc.market ? `<span class="r sortable${sortBy === "deal" ? " on" : ""}" data-sort="deal" title="DEAL: our value minus what the room's market pays (rescaled to your league's money). Green +3: likely bargain. Red -5: the market pays past our value. CLICK to sort by deal.">deal</span>` : `<span></span>`;
  col.innerHTML =
    `<div class="colhead"><div class="t1"><span class="${posClass(pos)}" title="Position column. Values are computed against replacement baseline ${pos}${base}: the best player assumed freely available.">${pos}</span></div>
     <div class="t2 grid-skill"><span title="tier: players within noise of each other. A new tier starts where the value gap exceeds 20% of the position's top value.">T</span><span>player</span>
       <span class="pts" title="projected season points under YOUR league scoring">pts</span>
       ${dealCols}
       <span class="r sortable${sortBy === "usd" ? " on" : ""}" data-sort="usd" title="our auction value for this league: the most you should be willing to pay. CLICK to sort by value.">our$</span></div></div>`;
  col.querySelectorAll(".sortable").forEach((s) => {
    s.onclick = (e) => { e.stopPropagation(); sortBy = s.dataset.sort;
      localStorage.setItem("ls-sort", sortBy); renderBoard(); };
  });
  const wrap = el("div", "rows");
  let group = P.filter((p) => p.pos === pos && p.usd != null);
  group.sort((a, b) => b.usd - a.usd);
  if (sortBy === "deal") {
    group = [...group].sort((a, b) =>
      ((dealOf(b) ?? -999) - (dealOf(a) ?? -999)));
  }
  const above = group.filter((p) => (p.usd || 0) >= 2);
  const free = group.filter((p) => (p.usd || 0) < 2);
  let lastTier = null;
  const rowWithTier = (p, target) => {
    addRow(p, target, false);
    if (sortBy !== "deal" && p.tier !== lastTier && lastTier !== null) {
      target.lastChild.classList.add("t-open");
    }
    lastTier = p.tier;
  };
  above.forEach((p) => rowWithTier(p, wrap));
  col.appendChild(wrap);
  if (free.length) {
    const bar = el("div", "freebar");
    bar.title = "the replacement line: everyone below prices at $1 - never bid $2";
    bar.innerHTML = `<span></span>&#9660; FREE &#9660;<span></span>`;
    col.appendChild(bar);
    if (freeExpanded[pos]) {
      const tail = el("div", "rows");
      free.forEach((p) => rowWithTier(p, tail));
      col.appendChild(tail);
    }
    const more = el("button", "more",
      freeExpanded[pos] ? "- collapse" : `+ ${free.length} more..`);
    more.onclick = (e) => { e.stopPropagation();
      freeExpanded[pos] = !freeExpanded[pos]; renderBoard(); };
    col.appendChild(more);
  }
  return col;
}

function kdefCol() {
  const col = el("div", "poscol");
  col.innerHTML =
    `<div class="colhead"><div class="t1">
       <span class="kd pK${kdefView === "K" ? " on" : ""}" data-kd="K" title="show kickers">K</span> /
       <span class="kd pDEF${kdefView === "DEF" ? " on" : ""}" data-kd="DEF" title="show defenses">DEF</span>
       <small title="the model prices every K and DEF at $1">$1 rule</small></div>
     <div class="t2 grid-kdef"><span>player</span><span class="r" title="market average salary, when you have pasted values">mkt$</span></div></div>`;
  col.querySelectorAll(".kd").forEach((s) => {
    s.onclick = (e) => { e.stopPropagation(); kdefView = s.dataset.kd;
      renderBoard(); };
  });
  const wrap = el("div", "rows");
  P.filter((p) => p.pos === kdefView)
    .sort((a, b) => (b.y_avg || b.pts || 0) - (a.y_avg || a.pts || 0))
    .slice(0, 34)
    .forEach((p) => addRow(p, wrap, true));
  col.appendChild(wrap);
  return col;
}

function renderBoard() {
  const board = $("#board");
  if (!board) return;
  board.innerHTML = "";
  POSITIONS.forEach((pos) => board.appendChild(skillCol(pos)));
  if (doc.kdef && doc.kdef.players.length) board.appendChild(kdefCol());
}

/* ---------------- rail renders (ported) ---------------- */

function renderOwners() {
  const os = [...oStates()].sort((a, b) => b.left - a.left);
  $("#ownerbody").innerHTML = os.map((o) =>
    `<div class="orow${o.is_me ? " me" : ""}${o.max <= 1 ? " out" : ""}">
      <span>${o.name}</span>
      <span class="m g">$${o.left}</span>
      <span class="m">$${Math.max(o.max, 0)}</span>
      <span class="sp">${o.open}</span></div>`).join("");
  renderOwnerGrid();
}

function renderOwnerGrid() {
  const grid = $("#ogrid");
  if (!grid) return;
  const os = oStates();
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
  grid.innerHTML = os.map((o, i) =>
    `<button class="obtn${o.is_me ? " me" : ""}${o.max <= 1 ? " out" : ""}${selOwner === o.id ? " selected" : ""}"
      data-oid="${o.id}" title="${o.name} (key: ${keys[i] ?? ""})"><span>${o.name}</span><small>$${o.left}</small></button>`).join("");
  grid.querySelectorAll(".obtn").forEach((b) =>
    b.onclick = () => selectOwner(+b.dataset.oid));
}

function ownerSlots(oid) {
  const theirs = curSales.filter((s) => s.owner === oid)
    .map((s) => ({ ...(byId[s.pid] ?? { name: s.name, pos: s.pos }),
      price: s.price }));
  const slots = slotOrder().map((l) => ({ lab: l, who: null, price: null }));
  const fits = { QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"], K: ["K"],
    DEF: ["DEF"] };
  theirs.forEach((p) => {
    const s = slots.find((x) => !x.who && (fits[p.pos] || []).includes(x.lab))
      || (["RB", "WR", "TE"].includes(p.pos)
        ? slots.find((x) => !x.who && x.lab === "FLX") : null)
      || slots.find((x) => !x.who && x.lab === "BN");
    if (s) { s.who = p; s.price = p.price; }
  });
  return { slots, spent: theirs.reduce((a, p) => a + p.price, 0) };
}

function renderRoster() {
  const viewId = rosterView ?? 0;
  const sel = $("#rostersel");
  if (document.activeElement !== sel) {
    sel.innerHTML = owners().map((o) =>
      `<option value="${o.id}">${o.is_me ? "My Roster" : o.name}</option>`)
      .join("");
    sel.value = String(viewId);
  }
  const os = ownerSlots(viewId);
  $("#roster").innerHTML = os.slots.map((s) =>
    `<div class="slot${s.who ? " filled" : ""}"><span class="lab ${posClass(s.lab)}">${s.lab}</span>
      <span class="who">${s.who ? s.who.name : ""}</span>
      <span class="pr">${s.who ? fmt$(s.price) : ""}</span></div>`).join("")
    + `<div class="slot"><span class="lab"></span><span class="who">spent</span>
       <span class="pr">$${os.spent} / ${doc.league.budget}</span></div>`;
}

function renderChips() {
  const inf = inflation();
  const infEl = $("#infl");
  infEl.className = "chip"
    + (inf.ratio > 1.12 || inf.ratio < 0.88 ? " hot" : "");
  const pct = Math.max(2, Math.min(98, (inf.ratio - 0.6) / 0.8 * 100));
  infEl.innerHTML = `<span class="lab">inflation</span>
    <span class="cval"><b>${inf.ratio.toFixed(2)}</b>
    <span class="g">$${inf.money}</span><span>/ $${Math.round(inf.value)}</span></span>
    <span class="gauge" title="dot vs center tick: right of center = money-rich room (overpays coming), left = money drying up (deals coming)"><i style="left:${pct.toFixed(1)}%"></i></span>`;
  const total = doc.league.teams * rosterSpots(doc.league.full_roster);
  $("#soldct").innerHTML = `<span class="lab">sold</span>
    <span class="cval"><b>${curSales.length}</b><span>/${total}</span></span>
    <span class="bar"><i style="width:${(curSales.length / total * 100).toFixed(1)}%"></i></span>`;
  const recent = curSales.slice(-5)
    .map((s) => s.price - Math.max((byId[s.pid] && byId[s.pid].usd) || 1, 1));
  if (recent.length) {
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const mood = avg > 1 ? "hot" : avg < -1 ? "deals" : "even";
    const col = avg > 1 ? "var(--warn)" : avg < -1 ? "var(--good)"
      : "var(--c-text)";
    $("#heat").innerHTML = `<span class="lab">last 5 sales</span>
      <span class="cval"><b style="color:${col}">${avg >= 0 ? "+" : "-"}$${Math.abs(avg).toFixed(0)} ${mood}</b></span>
      <span class="segs">${recent.map((d) =>
    `<i style="background:${d > 0 ? "var(--bad)" : "var(--good)"};opacity:${(Math.min(Math.abs(d), 12) / 12 * 0.75 + 0.25).toFixed(2)}"></i>`).join("")}</span>`;
  } else {
    $("#heat").innerHTML = `<span class="lab">last 5 sales</span><b>none yet</b>`;
  }
  const last = curSales[curSales.length - 1];
  if (last) {
    $("#lastchip").innerHTML = `<span class="lab">last sale</span>
      <span class="cval"><b>${last.name}</b><span class="g">${fmt$(last.price)}</span><span>${short(owners()[last.owner])}</span></span>`;
  } else {
    $("#lastchip").innerHTML = `<span class="lab">last sale</span><b>none yet</b>`;
  }
  const mast = $("#spendline");
  mast.textContent = `${doc.league.teams} TEAMS X $${doc.league.budget}` +
    (doc.market ? ` X MARKET ${mScale.toFixed(2)}` : "");
}

/* ---------------- sale flow (ported) ---------------- */

const normName = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");

function search(qs) {
  const q = normName(qs);
  if (!q) return [];
  return P.filter((p) => !soldSet.has(p.id) && normName(p.name).includes(q))
    .sort((a, b) => ((b.usd || b.y_avg || 0) - (a.usd || a.y_avg || 0)))
    .slice(0, 8);
}

function renderHits() {
  $("#hits").innerHTML = hitList.map((p, i) =>
    `<button class="hit${i === hitSel ? " sel" : ""}" data-id="${p.id}">
      <span class="p">${p.pos}</span><span class="n">${p.name} ${p.team || ""}</span>
      <span class="d">${p.usd != null ? fmt$(p.usd) : "$1"}</span></button>`)
    .join("");
  $("#hits").querySelectorAll(".hit").forEach((b) =>
    b.onclick = () => pick(b.dataset.id));
}

function pick(pid) {
  picked = byId[pid]; selOwner = null;
  hitList = []; renderHits(); $("#q").value = "";
  const p = picked;
  $("#picked").style.display = "block";
  $("#picked").innerHTML = `<div class="pnm">${p.name} <span class="${posClass(p.pos)}">${p.pos}</span> <span style="color:var(--faint)">${p.team || ""}</span>${p.inj ? ' <span style="color:var(--bad);font-size:12px">' + p.inj + "</span>" : ""}</div>`;
  $("#saleform").style.display = "block";
  $("#price").value = ""; $("#msg").textContent = "";
  renderCall(p);
  stagedId = p.id;
  document.querySelectorAll(".row.staged").forEach((r) =>
    r.classList.remove("staged"));
  const br = document.querySelector(`.row[data-id="${p.id}"]`);
  if (br) br.classList.add("staged");
  renderOwnerGrid(); updateSummary();
  $("#price").focus();
}

/* the call: deterministic advisor (ported; plan-fit inputs land in M4) */
function advise(p) {
  const inf = inflation();
  const deal = dealOf(p);
  const est = (doc.market && p.y_avg != null)
    ? Math.max(1, Math.round(p.y_avg * mScale * inf.ratio)) : null;
  const val = p.usd != null ? Math.round(p.usd) : 1;
  const myMax = oStates().find((o) => o.is_me).max;
  const reasons = [];

  let comparable = null, drop = null;
  if (POSITIONS.includes(p.pos) && p.usd != null) {
    const peers = P.filter((x) => x.pos === p.pos && !soldSet.has(x.id)
      && x.id !== p.id && x.usd != null);
    comparable = peers.filter((x) => x.usd >= p.usd - 5).length;
    const below = peers.filter((x) => x.usd < p.usd - 5)
      .sort((a, b) => b.usd - a.usd)[0];
    drop = below ? Math.round(p.usd - below.usd) : null;
  }
  const needs = ownerNeedMap();
  const contest = oStates().filter((o) => !o.is_me
    && o.max > Math.max(est || 2, 2)
    && (needs[o.id][p.pos] > 0
      || (["RB", "WR", "TE"].includes(p.pos) && needs[o.id].FLX > 0))).length;

  let cls, label, max;
  if (p.pos === "K" || p.pos === "DEF") {
    cls = "bench"; label = "$1 RULE"; max = 1;
    reasons.push("kickers and defenses are $1 players; never bid $2");
  } else {
    const cliffPressure = comparable != null && comparable <= 2 && contest >= 2
      && (drop == null || drop >= 8);
    if (deal != null && deal <= -4 && !cliffPressure) {
      cls = "pass"; label = "LET HIM GO"; max = val;
    } else if (cliffPressure) {
      cls = "last"; label = "LAST CHANCE"; max = val;
      reasons.push(`only ${comparable} comparable ${p.pos}s left`
        + (drop != null ? ` before a $${drop} drop` : "")
        + ` and ${contest} funded owners still need one; paying full value is correct here`);
    } else if (deal != null && deal >= 2) {
      cls = "target"; label = "TARGET"; max = val;
    } else {
      cls = "value"; label = "FAIR VALUE"; max = val;
    }
    if (comparable != null && !cliffPressure) {
      reasons.push(`${comparable} comparable ${p.pos}s left, `
        + `${contest} funded owner${contest === 1 ? "" : "s"} fighting for them`);
    }
  }
  if (inf.ratio > 1.1) {
    reasons.push(`money-rich room (x${inf.ratio.toFixed(2)}): expect ~${Math.round((inf.ratio - 1) * 100)}% overpays`);
  } else if (inf.ratio < 0.9) {
    reasons.push(`money drying up (x${inf.ratio.toFixed(2)}): patience is being paid`);
  }
  if (p.inj) reasons.push("injury status: " + p.inj);
  return { cls, label, max: Math.max(1, Math.min(max, myMax)), est, reasons };
}

function renderCall(p) {
  const a = advise(p);
  $("#call").style.display = "block";
  $("#call").innerHTML = `<span class="cverdict ${a.cls}">${a.label}</span>
    <div class="cmax" title="the break-even ceiling from our value model - past this you provably overpaid.">worth up to <b>$${a.max}</b>${a.est ? ` <span>room likely pays ~$${a.est}</span>` : ""}</div>
    <ul>${a.reasons.slice(0, 5).map((r) => `<li>${r}</li>`).join("")}</ul>`;
}

function selectOwner(oid) {
  selOwner = oid;
  renderOwnerGrid(); updateSummary();
  $("#sold").focus();
}

function updateSummary() {
  const ready = picked && selOwner != null
    && parseInt($("#price").value, 10) >= 1;
  $("#sold").disabled = !ready;
  if (picked && selOwner != null) {
    const o = owners()[selOwner];
    const pr = parseInt($("#price").value, 10);
    $("#summary").style.display = "block";
    $("#summary").innerHTML = `<b>${picked.name}</b> to <b>${o.name}</b> for <span class="g">${pr >= 1 ? fmt$(pr) : "$?"}</span>`;
  } else {
    $("#summary").style.display = "none";
  }
}

function resetSale() {
  picked = null; selOwner = null; hitList = []; hitSel = 0;
  stagedId = null;
  document.querySelectorAll(".row.staged").forEach((r) =>
    r.classList.remove("staged"));
  const ids = ["#picked", "#saleform", "#call", "#summary"];
  ids.forEach((i) => { const n = $(i); if (n) n.style.display = "none"; });
  if ($("#hits")) $("#hits").innerHTML = "";
  if ($("#q")) { $("#q").value = ""; $("#q").focus(); }
  if ($("#msg")) $("#msg").textContent = "";
}

async function commit() {
  if (!picked || selOwner == null) return;
  const price = parseInt($("#price").value, 10);
  if (!price || price < 1) {
    $("#msg").textContent = "enter a price of $1 or more";
    $("#price").focus(); return;
  }
  const p = picked, ow = selOwner;
  appendSale(doc, { pid: p.id, name: p.name, pos: p.pos, owner: ow, price });
  if (!p.kd && (p.usd || 0) < 2) freeExpanded[p.pos] = true;
  await saveDoc(doc);
  stampShow("SOLD", `${p.name} ${fmt$(price)} to ${owners()[ow].name}`);
  resetSale();
  refreshRoom();
  $("#q").focus();
}

async function undoLast() {
  const last = curSales[curSales.length - 1];
  if (!last) return;
  appendUnsale(doc, last.seq);
  await saveDoc(doc);
  stampShow("UNDONE", `${last.name} back on the board`);
  refreshRoom();
}

/* ---------------- modal (ported, minus profile layer for now) ------- */

function openModal(pid) {
  const p = byId[pid], sale = soldBy[pid];
  const rows = [
    ["tier", p.tier != null ? p.tier : "-"],
    ["our value", p.usd != null ? fmt$(p.usd) : "$1", "g"],
    ["status", (p.inj || "healthy") + (p.rookie ? " / rookie" : "")],
  ];
  const d = dealOf(p);
  if (d != null) rows.push(["deal", (d > 0 ? "+" : "") + Math.round(d)]);
  if (sale) {
    rows.unshift(["SOLD",
      fmt$(sale.price) + " to " + owners()[sale.owner].name, "g"]);
  }
  $("#modal").innerHTML = `<h3>${p.name}</h3><div class="sub">${p.pos} &middot; ${p.team || ""}</div>
    <table id="mtable">${rows.map((r) => `<tr><td>${r[0]}</td><td class="${r[2] || ""}">${r[1]}</td></tr>`).join("")}</table>
    ${!sale ? `<button id="msell">RECORD SALE</button>`
    : `<button id="mrev">REVERSE THIS SALE</button>`}`;
  $("#ovl").style.display = "flex";
  const ms = $("#msell");
  if (ms) ms.onclick = () => { closeModal(); pick(p.id); };
  const mr = $("#mrev");
  if (mr) {
    mr.onclick = async () => {
      appendUnsale(doc, sale.seq);
      await saveDoc(doc);
      closeModal();
      stampShow("REVERSED", `${p.name} back on the board`);
      refreshRoom();
    };
  }
}
function closeModal() {
  $("#ovl").style.display = "none";
  if (!picked && $("#q")) $("#q").focus();
}

/* ---------------- the room shell ---------------- */

function renderBoardScreen() {
  const root = $("#main");
  root.innerHTML = "";
  buildModel();

  const bar = el("div", "topbar");
  if (curRun) {
    const runChip = el("div", "chip");
    runChip.innerHTML = `<span class="lab">values from</span>
      <b>${curRun.source_label === "blend" ? "blend" : curRun.as_of}</b>`;
    runChip.title = "which saved run all board values come from. "
      + (curRun.source_label === "blend" ? curRun.as_of : "");
    bar.appendChild(runChip);
    for (const id of ["infl", "soldct", "heat", "lastchip"]) {
      const c = el("div", "chip"); c.id = id; bar.appendChild(c);
    }
  }
  bar.appendChild(el("span", "spacer"));
  const add = el("button", null, "ADD SOURCE");
  add.onclick = () => { importState = { kind: "values" }; renderImport(); };
  bar.appendChild(add);
  const undo = el("button", "danger", "UNDO LAST");
  undo.title = "remove the last recorded sale";
  undo.onclick = undoLast;
  bar.appendChild(undo);
  const reset = el("button", "danger", "RESET");
  reset.onclick = async () => {
    if (!confirm("Delete all local Liquid Sheets data? Export a backup first."))
      return;
    await wipeDoc(); doc = null; resetSale();
    wizardState.step = 0; renderWizard();
  };
  bar.appendChild(reset);
  root.appendChild(bar);

  if (!curRun) {
    const empty = el("div", "empty");
    empty.appendChild(el("p", null,
      "No projections yet. Fetch to populate the board."));
    const btn = el("button", "primary", "Fetch projections");
    btn.onclick = async () => {
      btn.disabled = true;
      try { await doFetchSleeper(); renderBoardScreen(); }
      catch (e) { btn.textContent = `Failed: ${e.message}`; }
    };
    empty.appendChild(btn);
    root.appendChild(empty);
    return;
  }

  const layout = el("div", "layout");
  const boardcol = el("div", "boardcol");
  const board = el("div", "cols"); board.id = "board";
  boardcol.appendChild(board);
  layout.appendChild(boardcol);

  const rail = el("div"); rail.id = "rail";
  rail.innerHTML = `
    <div class="panel">
      <input id="q" placeholder="/Player" autocomplete="off">
      <div id="hits"></div>
      <div id="picked"></div>
      <div id="call"></div>
      <div id="saleform">
        <div class="steplab">price</div>
        <span style="font-family:var(--mono);color:var(--gold);font-size:17px;font-weight:700">$</span>
        <input id="price" type="number" min="1" step="1" placeholder="0">
        <div id="ogrid"></div>
        <div id="summary"></div>
        <button id="sold" disabled>DRAFT</button>
        <div id="msg"></div>
      </div>
    </div>
    <div class="panel">
      <h2><select id="rostersel" title="view any team's roster"></select></h2>
      <div id="roster"></div>
    </div>
    <div class="panel">
      <h2 id="ledgerhead" style="cursor:pointer" title="click to collapse/expand">Owner ledger <span id="ledgerarrow">&#9662;</span></h2>
      <div id="ledgerbody">
        <div class="ohead"><span>team</span><span>left</span><span>max bid</span><span>open</span></div>
        <div id="ownerbody"></div>
      </div>
    </div>`;
  layout.appendChild(rail);
  root.appendChild(layout);

  $("#q").addEventListener("input", () => {
    hitList = search($("#q").value); hitSel = 0; renderHits();
  });
  $("#q").addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { hitSel = Math.min(hitSel + 1,
      hitList.length - 1); renderHits(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { hitSel = Math.max(hitSel - 1, 0);
      renderHits(); e.preventDefault(); }
    else if (e.key === "Enter" && hitList[hitSel]) {
      pick(hitList[hitSel].id); e.preventDefault(); }
  });
  $("#price").addEventListener("input", updateSummary);
  $("#price").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!$("#sold").disabled) { commit(); return; }
      const b = document.querySelector(".obtn"); if (b) b.focus();
    }
  });
  $("#sold").onclick = commit;
  $("#rostersel").onchange = () => {
    rosterView = parseInt($("#rostersel").value, 10); renderRoster();
  };
  $("#ledgerhead").onclick = () => {
    const open = $("#ledgerbody").style.display !== "none";
    $("#ledgerbody").style.display = open ? "none" : "block";
    $("#ledgerarrow").innerHTML = open ? "&#9656;" : "&#9662;";
  };

  renderBoard(); renderOwners(); renderRoster(); renderChips();
}

/* re-render everything after a state change, preserving staged state */
function refreshRoom() {
  const keepPicked = picked, keepOwner = selOwner;
  renderBoardScreen();
  if (keepPicked && !soldSet.has(keepPicked.id)) {
    pick(keepPicked.id);
    if (keepOwner != null) selectOwner(keepOwner);
  }
}

const renderBoard_screen_alias = renderBoardScreen;

/* ---------------- keys (ported) ---------------- */

const OKEYS = { "1": 0, "2": 1, "3": 2, "4": 3, "5": 4, "6": 5, "7": 6,
  "8": 7, "9": 8, "0": 9, "-": 10, "=": 11 };

document.addEventListener("keydown", (e) => {
  if (!doc || !doc.league || !curRun || !$("#q")) return;
  const a = document.activeElement;
  const inInput = a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"
    || a.tagName === "SELECT");
  if (e.key === "/" && !inInput) { $("#q").focus(); e.preventDefault(); return; }
  if (e.key === "Escape") { resetSale(); closeModal(); return; }
  if (!inInput && !picked && e.key.length === 1 && /[a-z]/i.test(e.key)
    && !e.metaKey && !e.ctrlKey && !e.altKey) { $("#q").focus(); return; }
  if (picked && !inInput && e.key in OKEYS) {
    const btns = document.querySelectorAll(".obtn");
    const b = btns[OKEYS[e.key]];
    if (b) { selectOwner(+b.dataset.oid); e.preventDefault(); return; }
  }
  if (picked && !inInput && e.key === "Enter" && !$("#sold").disabled
    && !(a && a.className && String(a.className).includes("obtn"))) {
    commit(); e.preventDefault(); return;
  }
  if (a && a.className && String(a.className).includes("obtn")) {
    const btns = [...document.querySelectorAll(".obtn")];
    const i = btns.indexOf(a);
    const moves = { ArrowDown: 2, ArrowUp: -2, ArrowRight: 1, ArrowLeft: -1 };
    if (e.key in moves && btns[i + moves[e.key]]) {
      btns[i + moves[e.key]].focus(); e.preventDefault();
    }
  }
});
$("#ovl").onclick = (e) => { if (e.target.id === "ovl") closeModal(); };

/* ---------------- boot ---------------- */

async function boot() {
  doc = await loadDoc();
  const importInput = $("#importfile");
  importInput.onchange = async () => {
    if (!importInput.files.length) return;
    try {
      doc = await importDocFile(importInput.files[0]);
      doc.league ? renderBoardScreen() : renderWizard();
    } catch (e) { alert(e.message); }
  };
  const menu = $("#gearmenu");
  $("#gearbtn").onclick = (ev) => {
    ev.stopPropagation();
    menu.hidden = !menu.hidden;
  };
  document.addEventListener("click", (ev) => {
    if (!menu.hidden && !menu.contains(ev.target)) menu.hidden = true;
  });
  $("#menuImport").onclick = () => { menu.hidden = true; importInput.click(); };
  $("#menuExport").onclick = () => {
    menu.hidden = true;
    if (doc) exportDoc(doc);
    else alert("Nothing to back up yet.");
  };
  $("#menuSleeper").onclick = async () => {
    menu.hidden = true;
    if (!doc || !doc.league) { alert("Finish setup first."); return; }
    try { await doFetchSleeper(); renderBoardScreen(); }
    catch (e) { alert(`Fetch failed (${e.message}). Are you offline?`); }
  };
  if (doc && doc.league) renderBoardScreen();
  else renderWizard();
}

boot();
