/* Data-in logic (DATA-IN-SPEC Paths B, C, D, E): parse pasted or uploaded
 * tables, guess a column mapping, match names against the board, and shape
 * imports. Pure logic; the mapper UI lives in app.js.
 *
 * Philosophy (ratified in Phase 2): one universal mapper. Platform presets
 * are pre-parsers plus prefilled mappings in front of it, so when a site
 * changes its layout the user re-confirms two dropdowns instead of waiting
 * for a code fix. */

const SUFFIX_RE = /\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i;
const POS_RE = /^(QB|RB|WR|TE|K|DEF|DST)$/i;

export function norm(name) {
  let n = String(name).toLowerCase().trim().replace(SUFFIX_RE, "");
  n = n.replace(/[^a-z0-9 ]/g, "");
  return n.replace(/\s+/g, " ").trim();
}

export function num(s) {
  const t = String(s).replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (t === "" || t === "-") return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

export const STAT_FIELDS = [
  "pass_yds", "pass_tds", "ints", "rush_yds", "rush_tds",
  "receptions", "rec_yds", "rec_tds", "fumbles_lost", "two_pt",
];

export const KINDS = {
  values: {
    label: "Market values",
    hint: "Add the values that the rest of your league will likely be " +
      "using. Import today's Yahoo or ESPN values (avg salary) as a csv " +
      "or copy and paste plain text here.",
    fields: ["name", "pos", "team", "value"],
  },
  projections: {
    label: "Projections",
    hint: "A stat-line projections export: one row per player with " +
      "yardage, TD, reception columns. Becomes a source in the blend.",
    fields: ["name", "pos", "team", ...STAT_FIELDS],
  },
  rankings: {
    label: "Rankings list",
    hint: "An ordered list (rank, name) with no stat lines. Converted to " +
      "rank-implied stat lines and blended as a source.",
    fields: ["rank", "name", "pos", "team"],
  },
};

/* Deterministic kind detection: nobody should have to tell the app what
 * they pasted. Stat columns mean projections; a dollar-ish column means
 * market values; a bare ordered list means rankings. The mapper screen
 * shows the verdict and lets the user override it. */
export function detectKind(parsed) {
  if (parsed.preset === "yahoo") return "values";
  const { headers, rows } = parsed;
  if (headers) {
    const statHits = headers.filter((h) =>
      HEADER_HINTS.some(([re, f]) => STAT_FIELDS.includes(f) &&
        re.test(h.trim()))).length;
    if (statHits >= 3) return "projections";
    if (headers.some((h) => /(avg|salary|value|price|\$|aav|cost)/i.test(h))) {
      return "values";
    }
    if (headers.some((h) => /^(rank|rk|#|ovr|overall)$/i.test(h.trim()))) {
      return "rankings";
    }
  }
  const sample = rows.slice(0, 12);
  if (sample.some((r) => r.some((c) => String(c).includes("$")))) {
    return "values";
  }
  const width = rows[0]?.length ?? 0;
  const numericCols = [];
  for (let i = 0; i < width; i++) {
    const cells = sample.map((r) => r[i] ?? "").filter((c) => c !== "");
    if (cells.length && cells.every((c) => num(c) !== null)) numericCols.push(i);
  }
  if (numericCols.length >= 4) return "projections";
  if (numericCols.length === 1) {
    const vals = sample.map((r) => num(r[numericCols[0]]))
      .filter((v) => v !== null);
    const sorted = vals.every((v, i) => i === 0 || v >= vals[i - 1]);
    if (sorted && vals[0] <= 5) return "rankings";
  }
  return "values";
}

/* ------------------------------------------------------------ parsing */

/* Yahoo's player-list paste comes out as repeating blocks starting with a
 * "Photo of <player>" line. Two layouts exist; anchoring on the %Drafted
 * field survives both (the predecessor's proven trick). */
function parseYahooPhoto(text) {
  const lines = text.split("\n");
  const rows = [];
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith("Photo of")) { i++; continue; }
    const name = (lines[i + 1] ?? "").trim();
    const m = /^([A-Za-z]{2,3})\s*-\s*(QB|RB|WR|TE|K|DEF)/
      .exec((lines[i + 2] ?? "").trim());
    const fields = [];
    let j = i + 3;
    while (j < lines.length && fields.length < 5 &&
      !lines[j].startsWith("Photo of")) {
      if (!lines[j].includes("\t")) fields.push(lines[j].trim());
      j++;
    }
    i = j;
    if (!m) continue;
    const pctIdx = fields.findIndex((f) => f.endsWith("%"));
    let avg = null, proj = null;
    if (pctIdx >= 0) {
      avg = fields[pctIdx + 1] ?? null;
      proj = fields[pctIdx + 2] ?? null;
    } else if (fields.length >= 5) {
      avg = fields[3]; proj = fields[4];
    } else {
      avg = fields[2] ?? null; proj = fields[3] ?? null;
    }
    rows.push([name, m[2], m[1], fields[0] ?? "", avg ?? "", proj ?? ""]);
  }
  return {
    preset: "yahoo",
    headers: ["Player", "Pos", "Team", "Rank", "Avg $", "Proj $"],
    rows,
  };
}

function splitCsvLine(line, delim) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export function parsePaste(text) {
  if (/^Photo of /m.test(text)) return parseYahooPhoto(text);
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""))
    .filter((l) => l.trim() !== "");
  if (!lines.length) return { preset: null, headers: null, rows: [] };
  const sample = lines.slice(0, 5);
  let delim = null;
  if (sample.every((l) => l.includes("\t"))) delim = "\t";
  else if (sample.every((l) => l.includes(","))) delim = ",";
  else if (sample.every((l) => l.includes(";"))) delim = ";";
  let rows;
  if (delim) rows = lines.map((l) => splitCsvLine(l, delim));
  else rows = lines.map((l) => l.split(/\s{2,}/).map((c) => c.trim()));
  const width = Math.max(...rows.map((r) => r.length));
  rows = rows.map((r) => { while (r.length < width) r.push(""); return r; });
  // Header row: no cell parses as a number and at least one looks wordy.
  const first = rows[0];
  const isHeader = first.every((c) => num(c) === null) &&
    first.some((c) => /[a-z]/i.test(c));
  return {
    preset: null,
    headers: isHeader ? first : null,
    rows: isHeader ? rows.slice(1) : rows,
  };
}

/* ----------------------------------------------------------- guessing */

const HEADER_HINTS = [
  [/^(player|name)$/i, "name"],
  [/^pos(ition)?$/i, "pos"],
  [/^(team|tm|nfl)$/i, "team"],
  [/(avg|salary|value|price|\$|aav|cost)/i, "value"],
  [/^(rank|rk|#|ovr|overall)$/i, "rank"],
  [/^tags?$/i, "tags"],
  [/^notes?$/i, "note"],
  [/pass.*yd|yds.*pass/i, "pass_yds"], [/pass.*td/i, "pass_tds"],
  [/^int|intercept/i, "ints"],
  [/rush.*yd|yds.*rush/i, "rush_yds"], [/rush.*td/i, "rush_tds"],
  [/^rec(eptions)?$|^catches$/i, "receptions"],
  [/rec.*yd|yds.*rec/i, "rec_yds"], [/rec.*td/i, "rec_tds"],
  [/fum/i, "fumbles_lost"], [/two|2.?pt/i, "two_pt"],
];

export function guessMapping(headers, rows, kind) {
  const width = rows[0]?.length ?? headers?.length ?? 0;
  const allowed = new Set(KINDS[kind].fields);
  const map = new Array(width).fill("ignore");
  const used = new Set();
  const assign = (i, f) => {
    if (allowed.has(f) && !used.has(f)) { map[i] = f; used.add(f); }
  };
  if (headers) {
    headers.forEach((h, i) => {
      for (const [re, f] of HEADER_HINTS) {
        if (re.test(h.trim())) { assign(i, f); return; }
      }
    });
  }
  // Shape-based fallback for anything still unmapped.
  const col = (i) => rows.slice(0, 12).map((r) => r[i] ?? "");
  for (let i = 0; i < width; i++) {
    if (map[i] !== "ignore") continue;
    const cells = col(i).filter((c) => c !== "");
    if (!cells.length) continue;
    if (!used.has("pos") && cells.every((c) => POS_RE.test(c))) {
      assign(i, "pos");
    } else if (!used.has("name") &&
      cells.every((c) => /[a-z]/i.test(c) && num(c) === null) &&
      cells.some((c) => c.includes(" ") || c.includes("."))) {
      assign(i, "name");
    } else if (!used.has("team") &&
      cells.every((c) => /^[A-Z]{2,3}$/.test(c))) {
      assign(i, "team");
    } else if (cells.every((c) => num(c) !== null)) {
      if (kind === "rankings") assign(i, "rank");
      else if (kind === "values") assign(i, "value");
    }
  }
  return map;
}

export function toEntries(rows, mapping) {
  const out = [];
  for (const r of rows) {
    const e = { stats: {} };
    mapping.forEach((f, i) => {
      const cell = r[i] ?? "";
      if (f === "ignore" || cell === "") return;
      if (f === "name") e.name = cell;
      else if (f === "pos") e.pos = cell.toUpperCase().replace("DST", "DEF");
      else if (f === "team") e.team = cell.toUpperCase();
      else if (f === "tags") {
        e.tags = cell.split(/[;,|]/).map((t) => t.trim()).filter(Boolean);
      } else if (f === "note") e.note = cell;
      else if (f === "value" || f === "rank") e[f] = num(cell);
      else e.stats[f] = num(cell) ?? 0;
    });
    if (e.name) out.push(e);
  }
  return out;
}

/* ----------------------------------------------------------- matching */

/* roster: [{pid, name, pos}]. Matches by normalized (name, pos); falls back
 * to name-only when that is unambiguous. Silent drops are forbidden: the
 * caller shows every unmatched row. */
export function matchEntries(entries, roster) {
  const byBoth = new Map(), byName = new Map();
  for (const p of roster) {
    byBoth.set(`${norm(p.name)}|${p.pos}`, p.pid);
    const k = norm(p.name);
    byName.set(k, byName.has(k) ? null : p.pid);
  }
  const matched = [], unmatched = [];
  for (const e of entries) {
    let pid = e.pos ? byBoth.get(`${norm(e.name)}|${e.pos}`) : undefined;
    if (!pid) {
      const cand = byName.get(norm(e.name));
      if (cand) pid = cand;
    }
    if (pid) matched.push({ entry: e, pid });
    else unmatched.push(e);
  }
  return { matched, unmatched };
}

/* -------------------------------------------------------- rank-implied */

/* Convert a rankings-only source into stat lines: the player ranked r at a
 * position gets the stat line of the r-th player on the reference curve
 * (the current blend), clamped to the curve's end. The predecessor's proven
 * technique for folding in analysts who publish ranks, not projections. */
export function rankImpliedStats(matched, reference, scoreFn) {
  const curves = {};
  for (const p of reference) {
    (curves[p.pos] = curves[p.pos] ?? []).push(p);
  }
  for (const pos of Object.keys(curves)) {
    curves[pos].sort((a, b) => scoreFn(b) - scoreFn(a));
  }
  const byPos = {};
  for (const m of matched) {
    if (m.entry.rank == null) continue;
    (byPos[m.pos ?? m.entry.pos] = byPos[m.pos ?? m.entry.pos] ?? []).push(m);
  }
  const players = [];
  for (const [pos, list] of Object.entries(byPos)) {
    const curve = curves[pos];
    if (!curve || !curve.length) continue;
    list.sort((a, b) => a.entry.rank - b.entry.rank);
    list.forEach((m, i) => {
      const ref = curve[Math.min(i, curve.length - 1)];
      players.push({ player_id: m.pid, pos, team: m.entry.team ?? ref.team,
        stats: { ...ref.stats } });
    });
  }
  return players;
}

/* ------------------------------------------------------- market scale */

/* Deal rescaling (ADR-0005 of the predecessor, carried forward): platform
 * dollars come from rooms with different scoring and money, so rescale
 * them to this league's supply before comparing. Scale is computed over
 * the top-N board players that have a market price. */
export function marketScale(runPlayers, values, topN) {
  const top = [...runPlayers].sort((a, b) => b.dollar - a.dollar)
    .slice(0, topN)
    .filter((p) => values[p.player_id] != null && values[p.player_id] > 0);
  if (top.length < 10) return 1;
  const ours = top.reduce((a, p) => a + p.dollar, 0);
  const theirs = top.reduce((a, p) => a + values[p.player_id], 0);
  return theirs > 0 ? ours / theirs : 1;
}
