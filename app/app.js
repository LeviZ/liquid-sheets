/* Liquid Sheets app shell, M1: wizard -> fetch -> engine -> board -> persist.
 * Draft room features arrive in M3/M4; this milestone proves the full pipe. */

import { blendProjections, valueBoard, scoreStatLine, POSITIONS }
  from "../engine/engine.js";
import { KINDS, parsePaste, guessMapping, toEntries, matchEntries,
  rankImpliedStats, marketScale, detectKind } from "./importers.js";
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

/* -------------------------------------------------------------- import */

let importState = null;

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
  const panel = el("div", "panel");
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
  cancel.onclick = () => { importState = null; renderBoard(); };
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
  const panel = el("div", "panel wide");
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
  const panel = el("div", "panel");
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
      importState = null; renderBoard(); return;
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
  renderBoard();
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
  const srcNames = Object.keys(doc.sources);
  if (srcNames.length) {
    const c = el("span", "chip",
      `sources: ${srcNames.map((s) => `${s}@${doc.sources[s].as_of}`)
        .join(", ")}`);
    c.dataset.tip = "Projection sources loaded. More than one and the " +
      "board runs on their stat-by-stat average (the blend).";
    bar.appendChild(c);
  }
  const spacer = el("span", "spacer");
  bar.appendChild(spacer);
  const add = el("button", "ghost", "Add Sources");
  add.onclick = () => { importState = { kind: "values" }; renderImport(); };
  bar.appendChild(add);
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

  // Deal column exists only when market values were imported; absence
  // removes the feature entirely (never zeros).
  let scale = null, marketValues = null;
  if (doc.market && Object.keys(doc.market.values).length) {
    marketValues = doc.market.values;
    scale = marketScale(run.players, marketValues,
      doc.league.teams * doc.league.model_params.dollar_slots_per_team);
    const c = el("span", "chip",
      `market: ${doc.market.label}@${doc.market.as_of} x${scale.toFixed(2)}`);
    c.dataset.tip = "Pasted market prices, rescaled by this factor so " +
      "their money supply matches your league's before comparing.";
    bar.insertBefore(c, bar.querySelector(".spacer"));
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
    if (marketValues) {
      const dl = el("span", "deal", "Deal");
      dl.dataset.tip = "Our value minus the market price (rescaled to your " +
        "league's money). Green: the room likely underprices him. Within " +
        "$2 is noise and stays grey.";
      h.appendChild(dl);
    }
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
      if (marketValues) {
        const mv = marketValues[p.player_id];
        if (mv == null) row.appendChild(el("span", "deal", ""));
        else {
          const d = p.dollar - mv * scale;
          const cls = Math.abs(d) <= 2 ? "deal dzero"
            : d > 0 ? "deal dpos" : "deal dneg";
          row.appendChild(el("span", cls,
            `${d > 0 ? "+" : ""}${d.toFixed(0)}`));
        }
      }
      table.appendChild(row);
    }
    col.appendChild(table);
    cols.appendChild(col);
  }
  if (doc.kdef && doc.kdef.players.length) {
    const col = el("div", "col");
    const h3 = el("h3", "pos-kdef", "K / DEF");
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
    try { await doFetchSleeper(); renderBoard(); }
    catch (e) { alert(`Fetch failed (${e.message}). Are you offline?`); }
  };
  if (doc && doc.league) renderBoard();
  else renderWizard();
}

boot();
