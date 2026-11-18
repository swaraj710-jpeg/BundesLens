import {
  f,
  seasonLabel,
  standings,
  type Match,
  type Row,
  type Season,
} from "./data";

export const venueLabels = [
  "Points",
  "Goals",
  "Expected Goals (xG)",
  "Clean Sheets",
];
export function venueValues(row: Row, perGame: boolean) {
  return [row.pts, row.gf, row.xg, row.cs].map(
    (v) => v / (perGame ? Math.max(1, row.mp) : 1),
  );
}
export function clubResult(m: Match, id: string): "W" | "D" | "L" {
  const margin = (m.hg - m.ag) * (m.h === id ? 1 : -1);
  return margin > 0 ? "W" : margin < 0 ? "L" : "D";
}
export function teamReport(
  data: Season,
  matches: Match[],
  rows: Row[],
  selected: string,
) {
  const team = rows.find((r) => r.id === selected) ?? rows[0];
  const splits = ["home", "away"].map(
    (venue) =>
      standings(data.clubs, matches, venue).find((r) => r.id === team.id)!,
  );
  const fixtures = matches
    .filter((m) => m.h === team.id || m.a === team.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.md - a.md);
  const np = new Map<string, number>();
  for (const m of matches) {
    np.set(m.h, (np.get(m.h) ?? 0) + (m.hnp ?? 0));
    np.set(m.a, (np.get(m.a) ?? 0) + (m.anp ?? 0));
  }
  const ratio = (n: number, d: number) => (d ? n / d : 0);
  const measures = (r: Row) => [
    r.shots,
    100 * ratio(r.sot, r.shots),
    ratio(r.gf, r.shots),
    ratio(np.get(r.id) ?? 0, r.shots),
  ];
  const totals = rows.reduce(
    (a, r) => ({
      shots: a.shots + r.shots,
      sot: a.sot + r.sot,
      goals: a.goals + r.gf,
      np: a.np + (np.get(r.id) ?? 0),
    }),
    { shots: 0, sot: 0, goals: 0, np: 0 },
  );
  const avg = [
    ratio(totals.shots, rows.length),
    100 * ratio(totals.sot, totals.shots),
    ratio(totals.goals, totals.shots),
    ratio(totals.np, totals.shots),
  ];
  const metrics = [
    "Total shots",
    "Shots on target",
    "Goals / shot",
    "Non-penalty xG / shot",
  ].map((label, i) => ({
    label,
    value: measures(team)[i],
    avg: avg[i],
    max: Math.max(...rows.map((r) => measures(r)[i]), 1e-9),
    format: (v: number, benchmark = false) =>
      f(v, i === 0 ? (benchmark ? 1 : 0) : i === 1 ? 1 : 3) +
      (i === 1 ? "%" : ""),
  }));
  const observed = (xs: (number | undefined)[]) =>
    xs.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const sample = observed(
      fixtures.map((m) => (m.h === team.id ? m.hpp : m.app)),
    ),
    reference = observed(matches.flatMap((m) => [m.hpp, m.app]));
  const mean = (v: number[]) =>
    v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  const ppda = mean(sample),
    leaguePP = mean(reference);
  const window = `MD ${Math.min(...matches.map((m) => m.md))}–${Math.max(...matches.map((m) => m.md))}`;
  const name = (id: string) => data.clubs.find((c) => c.id === id)?.name ?? id;
  const splitHeaders = [
    "Venue",
    "MP",
    "W",
    "D",
    "L",
    "Points",
    "Goals",
    "xG",
    "Clean sheets",
    "Points / game",
    "Goals / game",
    "xG / game",
    "Clean sheets / game",
  ];
  const splitRows = splits.map((r, i) => [
    i ? "Away" : "Home",
    r.mp,
    r.w,
    r.d,
    r.l,
    ...venueValues(r, false).map((v, j) => (j === 2 ? f(v, 3) : v)),
    ...venueValues(r, true).map((v) => f(v, 4)),
  ]);
  const fixtureHeaders = [
    "MD",
    "Date",
    "Home",
    "Away",
    "Home goals",
    "Away goals",
    "Home xG",
    "Away xG",
    "Club result",
  ];
  const fixtureRows = fixtures.map((m) => [
    m.md,
    m.date,
    name(m.h),
    name(m.a),
    m.hg,
    m.ag,
    m.hx,
    m.ax,
    clubResult(m, team.id),
  ]);
  const csvRows: (string | number)[][] = [
    ["BundesLens · Club Intelligence"],
    ["Club", team.name],
    ["Season", seasonLabel(data.year)],
    ["Matchdays", window],
    [],
    ["Home / Away splits"],
    splitHeaders,
    ...splitRows,
    [],
    ["Shot efficiency", "Club", "League average"],
    ...metrics.map((m, i) => [
      m.label + (i === 1 ? " (%)" : ""),
      m.value,
      m.avg,
    ]),
    [],
    ["Pressing intensity", "Club", "League average"],
    ["PPDA", ppda ?? "N/A", leaguePP ?? "N/A"],
    ["Observed team-match samples", sample.length, reference.length],
    [],
    ["Fixture log"],
    fixtureHeaders,
    ...fixtureRows,
  ];
  return {
    team,
    home: splits[0],
    away: splits[1],
    fixtures,
    metrics,
    ppda,
    leaguePP,
    window,
    splitHeaders,
    splitRows,
    fixtureHeaders,
    fixtureRows,
    csvRows,
  };
}
