import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ExpandedOverviewChart } from "./ExpandedOverviewChart";
import { overviewVenue } from "./overviewVenue";
import { useReport } from "./reportContext";
import { chartPalette } from "./chartTheme";
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowDownUp,
  ArrowUpRight,
  BarChart3,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Flag,
  Info,
  Layers3,
  ListOrdered,
  Maximize2,
  Medal,
  Trophy,
} from "lucide-react";
import type { ChartConfiguration, Plugin } from "chart.js";
import {
  Canvas,
  chartScales,
  Crest,
  Metric,
  Modal,
  PanelTitle,
  Select,
  Spark,
} from "./ui";
import {
  f,
  seasonLabel,
  signed,
  standings,
  type Match,
  type Row,
  type Season,
} from "./data";
export function Overview({
  data,
  matches,
  rows,
  theme,
  onTeam,
  phase,
}: {
  data: Season;
  matches: Match[];
  rows: Row[];
  theme: string;
  onTeam: (id: string) => void;
  phase: number;
}) {
  const [expanded, setExpanded] = useState(false),
    [venue, setVenue] = useState("all"),
    [sort, setSort] = useState<{ key: keyof Row; desc: boolean }>({
      key: "pts",
      desc: true,
    }),
    [zoom, setZoom] = useState(""),
    [hidden, setHidden] = useState<string[]>([]);
  const tableRows = useMemo(
    () => standings(data.clubs, matches, venue),
    [data, matches, venue],
  );
  const sorted = [...tableRows].sort((a, b) => {
    const av = a[sort.key],
      bv = b[sort.key];
    return (
      (typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv))) * (sort.desc ? -1 : 1)
    );
  });
  useReport(() => ({
    meta: {
      Venue: venue,
      Sort: `${sort.key} ${sort.desc ? "descending" : "ascending"}`,
      Coverage: "All 18 clubs in selected window",
    },
    rows: [
      [
        "Rank",
        "Club",
        "MP",
        "W",
        "D",
        "L",
        "GF",
        "GA",
        "GD",
        "xG",
        "xGA",
        "xPts",
        "xPts difference",
        "Points",
        "Form",
      ],
      ...sorted.map((r) => [
        r.pos,
        r.name,
        r.mp,
        r.w,
        r.d,
        r.l,
        r.gf,
        r.ga,
        r.gd,
        f(r.xg, 3),
        f(r.xga, 3),
        f(r.xpts, 3),
        f(r.diff, 3),
        r.pts,
        r.form.join(""),
      ]),
    ],
  }));
  const palette = chartPalette(theme);
  const leader = rows[0],
    g = rows.reduce((s, r) => s + r.gf, 0),
    x = rows.reduce((s, r) => s + r.xg, 0) / Math.max(1, matches.length);
  const byDay = Array.from(new Set(matches.map((m) => m.md))).sort(
    (a, b) => a - b,
  );
  const chartScope = overviewVenue(tableRows, venue, byDay);
  const raceClubs = chartScope.contenders;
  const chartKey = `${data.year}-${phase}-${venue}`;
  const daily = byDay.map((d) =>
    matches.filter((m) => m.md === d).reduce((s, m) => s + m.hg + m.ag, 0),
  );
  const xdaily = byDay.map((d) =>
    matches.filter((m) => m.md === d).reduce((s, m) => s + m.hx + m.ax, 0),
  );
  const fullScorer = [...data.players].sort((a, b) => b.g - a.g)[0];
  const events = new Map<string, { club: string; goals: number }>();
  for (const m of matches)
    for (const [n, c, v] of m.scorers || []) {
      const p = events.get(n) || { club: c, goals: 0 };
      p.goals += v;
      events.set(n, p);
    }
  const eventTop = [...events.entries()].sort(
    (a, b) => b[1].goals - a[1].goals,
  )[0];
  const sp =
    phase === 0 && fullScorer
      ? {
          name: fullScorer.name,
          g: fullScorer.g,
          xg: fullScorer.xg,
          club: fullScorer.club,
        }
      : eventTop
        ? {
            name: eventTop[0],
            g: eventTop[1].goals,
            xg: undefined,
            club: eventTop[1].club,
          }
        : null;
  const n = matches.length;
  const leagueAvg = g / Math.max(1, n);
  const setKey = (key: keyof Row) =>
    setSort((s) => ({
      key,
      desc: s.key === key ? !s.desc : !["name", "pos"].includes(key),
    }));
  const headers: [string, keyof Row][] = [
    ["Pos", "pos"],
    ["Club", "name"],
    ["MP", "mp"],
    ["W-D-L", "w"],
    ["GF:GA", "gf"],
    ["GD", "gd"],
    ["xG", "xg"],
    ["xGA", "xga"],
    ["xPts", "xpts"],
    ["xPts Δ", "diff"],
    ["Form", "form"],
    ["Pts", "pts"],
  ];
  const maxX =
    Math.max(2.5, ...tableRows.map((r) => r.xg / Math.max(1, r.mp))) + 0.2;
  const quad: Plugin = {
    id: "quadrants",
    beforeDraw(chart) {
      const { ctx, chartArea: a, scales } = chart;
      if (!a) return;
      const xx = scales.x.getPixelForValue(chartScope.average.x),
        yy = scales.y.getPixelForValue(chartScope.average.y);
      ctx.save();
      ctx.fillStyle = "rgba(19,174,139,.047)";
      ctx.fillRect(xx, a.top, a.right - xx, yy - a.top);
      ctx.fillStyle = "rgba(230,75,94,.035)";
      ctx.fillRect(a.left, yy, xx - a.left, a.bottom - yy);
      ctx.strokeStyle = palette.edge;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(xx, a.top);
      ctx.lineTo(xx, a.bottom);
      ctx.moveTo(a.left, yy);
      ctx.lineTo(a.right, yy);
      ctx.stroke();
      ctx.font = '8px "IBM Plex Mono",monospace';
      ctx.fillStyle = palette.accent;
      ctx.fillText("ELITE BALANCE", a.right - 77, a.top + 13);
      ctx.fillStyle = palette.ticks;
      ctx.fillText("DEFENSIVE", a.left + 6, a.top + 13);
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const meta = chart.getDatasetMeta(0);
      chart.ctx.save();
      chart.ctx.font = '9px "IBM Plex Mono",monospace';
      meta.data.forEach((point, i) => {
        if (i < 6) {
          chart.ctx.fillStyle = theme === "dark" ? "#c3ccd8" : "#334155";
          chart.ctx.fillText(tableRows[i].short, point.x + 7, point.y - 5);
        }
      });
      chart.ctx.restore();
    },
  };
  const scatter: ChartConfiguration = {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Club efficiency",
          data: tableRows.map((r) => ({
            x: r.xg / Math.max(1, r.mp),
            y: r.xga / Math.max(1, r.mp),
          })),
          pointRadius: 5,
          pointHoverRadius: 8,
          pointBackgroundColor: tableRows.map(
            (_, i) =>
              [
                "#ed5367",
                "#29bfd0",
                "#ffbf53",
                "#d5d94d",
                "#b38be9",
                "#71bca9",
              ][i % 6],
          ),
          pointBorderColor: "#121923",
          pointBorderWidth: 1.3,
        },
      ],
    },
    options: {
      animation: false,
      layout: { padding: { right: 25 } },
      plugins: {
        tooltip: {
          callbacks: {
            label: (c) =>
              `${tableRows[c.dataIndex].name}: ${f((c.raw as { x: number }).x, 2)} xG · ${f((c.raw as { y: number }).y, 2)} xGA`,
          },
        },
      },
      scales: {
        x: {
          ...chartScales().x,
          title: { display: true, text: "Attacking output · xG / 90 →" },
          suggestedMin: 0.5,
          max: maxX,
        },
        y: {
          ...chartScales().y,
          reverse: true,
          title: { display: true, text: "xGA / 90 · lower is better" },
          suggestedMin: 0.5,
          max:
            Math.max(2.5, ...tableRows.map((r) => r.xga / Math.max(1, r.mp))) +
            0.1,
        },
      },
    },
    plugins: [quad],
  };
  const colors = ["#f05263", "#28beca", "#efbb53", "#a88ae5"];
  const trajectory: ChartConfiguration = {
    type: "line",
    data: {
      labels: chartScope.labels,
      datasets: raceClubs.map((r, i) => ({
        label: r.name,
        hidden: hidden.includes(r.id),
        data: [...r.trajectory],
        borderColor: colors[i],
        backgroundColor: colors[i] + "09",
        fill: i === 0,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2.2,
        tension: 0.25,
      })),
    },
    options: {
      animation: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        ...chartScales(),
        y: { ...chartScales().y, beginAtZero: true },
      },
    },
  };
  return (
    <>
      <div className="kpis">
        <article className="kpi kpi-goals">
          <div className="kpi-label">
            <span className="chip-icon red">
              <Crosshair size={15} />
            </span>
            Total league goals
          </div>
          <div className="kpi-main">
            <b>{g.toLocaleString()}</b>
            <Spark
              values={daily.slice(-18)}
              color="#ed5264"
              id="goal-spark"
              bars
            />
          </div>
          <div className="kpi-foot">
            <span
              className={leagueAvg >= data.prevAvg ? "positive" : "has-decline"}
            >
              {leagueAvg >= data.prevAvg ? (
                <ArrowUpRight size={12} />
              ) : (
                <ArrowDownRight size={12} />
              )}{" "}
              {signed((leagueAvg / (data.prevAvg || leagueAvg) - 1) * 100)}%
            </span>{" "}
            vs. prior season pace
          </div>
        </article>
        <article className="kpi">
          <div className="kpi-label">
            <span className="chip-icon cyan">
              <Activity size={15} />
            </span>
            Avg <Metric name="xG" value={f(x, 3)} /> / match
          </div>
          <div className="kpi-main">
            <b>{f(x, 2)}</b>
            <Spark values={xdaily.slice(-17)} color="#28c3d2" id="xg-spark" />
          </div>
          <div className="kpi-foot">
            <span className="cyan">
              <ChartNoAxesCombined size={12} />
              {f(x / 2, 2)}
            </span>{" "}
            per club / match
          </div>
        </article>
        <article className="kpi scorer-card">
          <div className="kpi-label">
            <span className="chip-icon gold">
              <Medal size={15} />
            </span>
            Top scorer
          </div>
          <div className="player-kpi">
            <div>
              <strong>{sp?.name || "No goals yet"}</strong>
              <span>
                {data.clubs.find((c) => c.id === sp?.club)?.name ||
                  "Selected range"}
              </span>
            </div>
            {sp?.name === "Harry Kane" ? (
              <img
                src="/images/kane.png"
                className="player-photo"
                alt="Harry Kane"
              />
            ) : (
              sp &&
              data.clubs.find((c) => c.id === sp.club) && (
                <Crest
                  club={data.clubs.find((c) => c.id === sp.club)!}
                  size={45}
                />
              )
            )}
          </div>
          <div className="kpi-foot">
            <span className="gold">{sp?.g || 0} goals</span>
            <i />{" "}
            {sp?.xg != null && phase === 0 ? (
              <Metric name="xG" value={sp.xg}>
                {f(sp.xg)} xG
              </Metric>
            ) : (
              "Match event total"
            )}
          </div>
        </article>
        <article className="kpi leader-card">
          <div className="kpi-label">
            <span className="chip-icon green">
              <Trophy size={15} />
            </span>
            League leader
          </div>
          <div className="player-kpi">
            <div>
              <strong>{leader.name}</strong>
              <span>1st in Bundesliga</span>
            </div>
            <Crest club={leader} size={50} />
          </div>
          <div className="kpi-foot">
            <span className="positive">{leader.pts} pts</span>
            <i />
            <Metric name="xPts" value={leader.xpts}>
              {f(leader.xpts)} xPts
            </Metric>
          </div>
        </article>
      </div>
      <section className="panel standings">
        <PanelTitle
          title="Bundesliga Standings"
          german="Tabelle"
          icon={<ListOrdered size={18} />}
          action={
            <div className="head-actions">
              <span className="subtle-tag">18 CLUBS</span>
              <Select
                label="Standings venue"
                value={venue}
                onChange={(v) => {
                  setVenue(v);
                  setHidden([]);
                }}
              >
                <option value="all">Overall</option>
                <option value="home">Home only</option>
                <option value="away">Away only</option>
              </Select>
            </div>
          }
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {headers.map(([label, key]) => (
                  <th key={key}>
                    <button
                      className={sort.key === key ? "sorted" : ""}
                      onClick={() => setKey(key)}
                      title={`Sort by ${label}`}
                    >
                      <Metric name={label} />
                      {key === "pts" ? (
                        sort.desc ? (
                          <ArrowDown size={10} />
                        ) : (
                          <ChevronUp size={10} />
                        )
                      ) : key === "name" ? (
                        <ArrowDownUp size={9} />
                      ) : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr
                  key={r.id}
                  className={
                    (r.pos === 1 ? "leading-row " : "") +
                    (!expanded && i >= 6 ? "print-only-row" : "")
                  }
                >
                  <td>
                    <span
                      className={
                        "rank " +
                        (r.pos < 5
                          ? "cl"
                          : r.pos < 7
                            ? "el"
                            : r.pos === 16
                              ? "playoff"
                              : r.pos > 16
                                ? "rl"
                                : "")
                      }
                    >
                      {String(r.pos).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <button className="club-link" onClick={() => onTeam(r.id)}>
                      <Crest club={r} size={23} />
                      <span>{r.name}</span>
                    </button>
                  </td>
                  <td>{r.mp}</td>
                  <td className="record">
                    {r.w}
                    <span>-</span>
                    {r.d}
                    <span>-</span>
                    {r.l}
                  </td>
                  <td>
                    {r.gf}
                    <span className="dim">:</span>
                    {r.ga}
                  </td>
                  <td className={r.gd >= 0 ? "positive" : "red"}>
                    {signed(r.gd, 0)}
                  </td>
                  <td>
                    <Metric name="xG" value={r.xg.toFixed(3)}>
                      {f(r.xg)}
                    </Metric>
                  </td>
                  <td>
                    <Metric name="xGA" value={r.xga.toFixed(3)}>
                      {f(r.xga)}
                    </Metric>
                  </td>
                  <td>
                    <Metric name="xPts" value={r.xpts.toFixed(3)}>
                      {f(r.xpts)}
                    </Metric>
                  </td>
                  <td className={r.diff >= 0 ? "positive" : "red"}>
                    {signed(r.diff)}
                  </td>
                  <td>
                    <div className="form-pills">
                      {r.form.map((v, i) => (
                        <span
                          key={i}
                          className={"form-" + v}
                          title={`${i === r.form.length - 1 ? "Most recent match" : `Form match ${i + 1}`}: ${v === "W" ? "win" : v === "L" ? "loss" : "draw"}`}
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="points">{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-foot">
          <div className="qualification">
            <span>
              <i className="q1" />
              Champions League
            </span>
            <span>
              <i className="q2" />
              Europa places
            </span>
            <span>
              <i className="q-playoff" />
              Relegation playoff
            </span>
            <span>
              <i className="q3" />
              Relegation
            </span>
          </div>
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show top 6" : "View all 18 clubs"}
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </section>
      <div className="two-col chart-panels">
        <section className="panel">
          <PanelTitle
            title="Attack vs. defense"
            icon={<Crosshair size={17} />}
            sub="Expected goals for and against, per 90 minutes"
            action={
              <button
                className="iconbtn"
                aria-label="Expand efficiency chart"
                onClick={() => setZoom("efficiency")}
              >
                <Maximize2 size={14} />
              </button>
            }
          />
          <Canvas
            key={`scatter-${chartKey}`}
            config={scatter}
            height={220}
            label="Club attack and defense efficiency quadrant"
            theme={theme}
          />
          <div className="chart-note">
            <Info size={12} /> Lower xGA indicates a stronger defense.
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            title="Title race trajectory"
            icon={<ChartNoAxesCombined size={17} />}
            sub={`${chartScope.label} · cumulative points for the selected window’s top four`}
            action={
              <button
                className="iconbtn"
                aria-label="Expand title race chart"
                onClick={() => setZoom("trajectory")}
              >
                <Maximize2 size={14} />
              </button>
            }
          />
          <div className="legend">
            {raceClubs.map((r, i) => (
              <button
                className={
                  "legend-toggle " + (hidden.includes(r.id) ? "off" : "")
                }
                aria-label={`Toggle ${r.name} trajectory`}
                aria-pressed={!hidden.includes(r.id)}
                onClick={() =>
                  setHidden((v) =>
                    v.includes(r.id)
                      ? v.filter((k) => k !== r.id)
                      : [...v, r.id],
                  )
                }
                key={r.id}
              >
                <i style={{ background: colors[i] }} />
                {r.short}
              </button>
            ))}
          </div>
          <Canvas
            key={`trajectory-${chartKey}`}
            config={trajectory}
            label="Cumulative points of the top four clubs"
            height={191}
            theme={theme}
          />
          <div className="chart-note">
            <Flag size={12} />
            <span
              title={
                venue === "all"
                  ? "Distinct league fixtures"
                  : `${n} fixtures contribute one ${venue} team appearance each; league-match equivalents = appearances ÷ 2.`
              }
            >
              {chartScope.matchCount} matches in the selected window
              {venue === "all" ? "." : " (league equivalents)."}
            </span>
          </div>
        </section>
      </div>
      {zoom &&
        createPortal(
          <Modal
            title={
              zoom === "efficiency"
                ? "Attack vs. defense"
                : "Title race trajectory"
            }
            kicker="Expanded visualization"
            close={() => setZoom("")}
          >
            <ExpandedOverviewChart
              key={`${zoom}-${chartKey}`}
              kind={zoom}
              rows={tableRows}
              contenders={raceClubs}
              labels={chartScope.labels}
              average={chartScope.average}
              venueLabel={chartScope.label}
              theme={theme}
              scope={`Bundesliga ${seasonLabel(data.year)} · MD ${byDay[0]}–${byDay.at(-1)}`}
            />
          </Modal>,
          document.body,
        )}
    </>
  );
}
export function EmptyRange() {
  return (
    <section className="panel empty-state">
      <BarChart3 size={32} />
      <h2>No matches in this window yet</h2>
      <p>
        This season has not reached the selected matchdays. Choose an earlier
        phase or a completed season.
      </p>
    </section>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status" aria-label="Loading analytics">
      <div className="kpis">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
      <div className="skeleton table-skeleton" />
      <span>
        <Layers3 size={13} />
        Preparing season analytics
      </span>
    </div>
  );
}
