import type { Research } from "./forecast";
export type Match = {
  h: string;
  a: string;
  hg: number;
  ag: number;
  hs: number;
  as: number;
  hst: number;
  ast: number;
  hx: number;
  ax: number;
  md: number;
  date: string;
  hxp?: number;
  axp?: number;
  hpp?: number;
  app?: number;
  hnp?: number;
  anp?: number;
  scorers?: [string, string, number][];
};
export type Player = {
  id: string;
  name: string;
  club: string;
  pos: string;
  g: number;
  xg: number;
  xa: number;
  minutes: number;
  shots: number;
  kp: number;
  npxg: number;
  assists: number;
  prog?: number;
  sca?: number;
  rec?: number;
};
export type Club = { id: string; name: string; short: string; logo: string };
export type Stump = {
  f: number;
  t: number;
  l: number;
  r: number;
  mean: number;
};
export type Model = {
  home: Stump[];
  away: Stump[];
  base: number;
  rho: number;
  temp: number;
  samples: number;
  metrics: number[];
};
export type Season = {
  year: string;
  clubs: Club[];
  matches: Match[];
  history: Match[];
  players: Player[];
  playerSource: string;
  research: Research;
  updated: string;
  prevAvg: number;
  xgSource: string;
};
export type Row = Club & {
  mp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  xg: number;
  xga: number;
  xpts: number;
  diff: number;
  form: string[];
  pos: number;
  shots: number;
  sot: number;
  cs: number;
  trajectory: number[];
};
export const ranges = [
  [1, 34],
  [1, 10],
  [11, 22],
  [23, 34],
];
export const rangeNames = [
  "Full season",
  "Opening phase",
  "Mid-season",
  "Run-in",
];
export const seasonLabel = (y: string) => `${y}/${String(+y + 1).slice(-2)}`;
export const f = (n: number, d = 1) => n.toFixed(d);
export const signed = (n: number, d = 1) =>
  `${n > 0 ? "+" : ""}${n.toFixed(d)}`;
export function matrix(h: number, a: number, c = 0.08) {
  const out: { h: number; a: number; p: number }[] = [];
  const pois = (l: number, n: number) => (Math.exp(-l) * l ** n) / fact(n);
  const shared = Math.max(0, Math.min(h * 0.4, a * 0.4, c));
  let sum = 0;
  for (let i = 0; i <= 12; i++)
    for (let j = 0; j <= 12; j++) {
      let p = 0;
      for (let k = 0; k <= Math.min(i, j); k++)
        p +=
          pois(h - shared, i - k) * pois(a - shared, j - k) * pois(shared, k);
      out.push({ h: i, a: j, p });
      sum += p;
    }
  out.forEach((o) => (o.p /= sum));
  return out;
}
const factorial = [1];
for (let i = 1; i <= 16; i++) factorial.push(factorial[i - 1] * i);
function fact(n: number) {
  return factorial[n];
}
const xpCache = new Map<string, number[]>();
function expected(h: number, a: number) {
  const k = h + ":" + a;
  if (xpCache.has(k)) return xpCache.get(k)!;
  const m = matrix(h, a, 0);
  let home = 0,
    away = 0;
  for (const s of m) {
    home += s.p * (s.h > s.a ? 3 : s.h === s.a ? 1 : 0);
    away += s.p * (s.a > s.h ? 3 : s.a === s.h ? 1 : 0);
  }
  const v = [home, away];
  xpCache.set(k, v);
  return v;
}
export function standings(
  clubs: Club[],
  matches: Match[],
  venue = "all",
): Row[] {
  const rows: Row[] = clubs.map((c) => ({
    ...c,
    mp: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0,
    xg: 0,
    xga: 0,
    xpts: 0,
    diff: 0,
    form: [],
    pos: 0,
    shots: 0,
    sot: 0,
    cs: 0,
    trajectory: [],
  }));
  const map = Object.fromEntries(rows.map((r) => [r.id, r]));
  for (const m of matches) {
    const xp =
      m.hxp != null && m.axp != null ? [m.hxp, m.axp] : expected(m.hx, m.ax);
    for (const home of [true, false]) {
      if ((venue === "home" && !home) || (venue === "away" && home)) continue;
      const r = map[home ? m.h : m.a];
      if (!r) continue;
      const [g, a] = home ? [m.hg, m.ag] : [m.ag, m.hg];
      r.mp++;
      r.gf += g;
      r.ga += a;
      r.gd = r.gf - r.ga;
      r.cs += +(a === 0);
      r.xg += home ? m.hx : m.ax;
      r.xga += home ? m.ax : m.hx;
      r.xpts += xp[home ? 0 : 1];
      r.shots += home ? m.hs : m.as;
      r.sot += home ? m.hst : m.ast;
      if (g > a) r.w++;
      else if (g === a) r.d++;
      else r.l++;
      r.pts = r.w * 3 + r.d;
      r.form.push(g > a ? "W" : g < a ? "L" : "D");
      r.diff = r.pts - r.xpts;
      r.trajectory.push(r.pts);
    }
  }
  return rows
    .sort(
      (a, b) =>
        b.pts - a.pts ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.name.localeCompare(b.name),
    )
    .map((r, i) => ({ ...r, pos: i + 1, form: r.form.slice(-5) }));
}
export function csv(
  name: string,
  rows: (string | number)[][],
  meta: Record<string, string | number>,
) {
  const contents = [
    ["BundesLens", "Report metadata"],
    ["Exported at (UTC)", new Date().toISOString()],
    ...Object.entries(meta),
    [],
    ...rows,
  ];
  const field = (v: string | number) => {
    const s = String(v);
    const safe =
      typeof v === "string" &&
      /^\s*[=+@-]/.test(s) &&
      !Number.isFinite(Number(s))
        ? "'" + s
        : s;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  const b = new Blob(
    ["\uFEFF" + contents.map((r) => r.map(field).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8;" },
  );
  const u = URL.createObjectURL(b),
    a = document.createElement("a");
  a.href = u;
  a.download = name + ".csv";
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1500);
}
export function pointsForm(form: string[]) {
  return (
    form.reduce((s, v) => s + (v === "W" ? 3 : v === "D" ? 1 : 0), 0) /
    (form.length || 1)
  );
}
export const definitions: Record<string, string> = {
  xG: "Expected goals: the estimated scoring value of chances created.",
  xGA: "Expected goals against: the estimated value of chances conceded.",
  xPts: "Expected points derived from the match goal-probability distribution.",
  "xPts Δ": "Actual points minus model-expected points.",
  xA: "Expected assists: the expected goals value of shots created by a pass.",
  PPDA: "Passes allowed per defensive action; lower values indicate more intense pressing.",
  RPS: "Ranked probability score: cumulative error across the three ordered outcomes.",
  "Log-Loss": "Mean negative log probability assigned to the observed outcome.",
  GD: "Goals scored minus goals conceded.",
  Form: "Last five matches, ordered from oldest to newest.",
  Pts: "Three points for a win and one for a draw.",
  MP: "Matches played in the selected matchday range.",
  "Brier score":
    "Sum of squared errors across the three outcome probabilities, averaged over fixtures; lower is better.",
  "Non-penalty xG / shot":
    "Expected goals excluding penalties, divided by the club’s total shots in this window.",
  "Goals / shot":
    "Goals scored divided by total shots in the selected matchdays.",
  "Shots on target": "Percentage of attempts that were on target.",
  "95% CI":
    "The middle 95% of estimated probabilities from the matchday-block bootstrap refits.",
  "λ Home": "Mean home goals under the calibrated scoreline distribution.",
  "λ Away": "Mean away goals under the calibrated scoreline distribution.",
  "Goals/90": "Goals scored per 90 minutes played.",
  "xG/90": "Expected scoring output per 90 minutes played.",
  "xA/90": "Expected assists per 90 minutes played.",
  "Progressive passes/90":
    "Passes that significantly advance play towards goal per 90 minutes; a proxy is used when unavailable.",
  "Shot creation/90":
    "Shot-creating actions per 90 minutes; shots and key passes serve as a proxy when event counts are unavailable.",
  "Recoveries/90":
    "Possession recoveries per 90 minutes; a positional proxy is used when counts are unavailable.",
};
export function playerAxes(p: Player) {
  const n = 90 / p.minutes;
  return [
    p.g * n,
    p.xg * n,
    p.xa * n,
    (p.prog ?? p.kp * 1.9 + p.assists) * n,
    (p.sca ?? p.kp + p.shots) * n,
    p.rec != null
      ? p.rec * n
      : (p.pos === "DF"
          ? 6.8
          : p.pos === "MF"
            ? 5.2
            : p.pos === "GK"
              ? 1.6
              : 2.4) *
        (0.8 + Math.min(1, p.minutes / 3000) * 0.35),
  ];
}
export const axes = [
  "Goals/90",
  "xG/90",
  "xA/90",
  "Progressive passes/90",
  "Shot creation/90",
  "Recoveries/90",
];
export function percentiles(p: Player, pool: Player[], minimum = 90) {
  const peers = pool
    .filter((x) => x.pos === p.pos && x.minutes >= minimum)
    .map(playerAxes);
  // Empirical mid-distribution: ties receive the midpoint of their rank block.
  return playerAxes(p).map((v, i) => {
    if (!peers.length) return NaN;
    let below = 0,
      equal = 0;
    for (const rates of peers) {
      const delta = rates[i] - v;
      if (Math.abs(delta) < 1e-10) equal++;
      else if (delta < 0) below++;
    }
    return Math.min(
      99,
      Math.max(0, Math.round((100 * (below + equal / 2)) / peers.length)),
    );
  });
}
