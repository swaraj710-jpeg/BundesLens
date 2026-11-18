import { useMemo, useState } from "react";
import { architectures, featureNames, forecast, vector } from "./forecast";
import { ResearchReport } from "./ResearchReport";
import { provenance, useReport, type Report } from "./reportContext";
import { ScoutingRadar } from "./ScoutingRadar";
import { clubResult, teamReport, venueLabels, venueValues } from "./teamReport";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Crosshair,
  Database,
  FlaskConical,
  Home,
  Info,
  MapPin,
  Search,
  ShieldHalf,
  SlidersHorizontal,
  Target,
  Trophy,
  UsersRound,
  Workflow,
} from "lucide-react";
import {
  Canvas,
  chartScales,
  Crest,
  Metric,
  PanelTitle,
  Pipeline,
  Select,
} from "./ui";
import {
  axes,
  csv,
  f,
  percentiles,
  playerAxes,
  seasonLabel,
  signed,
  type Match,
  type Row,
  type Season,
} from "./data";
export function TeamView({
  data,
  matches,
  rows,
  selected,
  choose,
  download,
}: {
  data: Season;
  matches: Match[];
  rows: Row[];
  selected: string;
  choose: (s: string) => void;
  download: () => void;
}) {
  const report = useMemo(
    () => teamReport(data, matches, rows, selected),
    [data, matches, rows, selected],
  );
  const { team, home, away, fixtures, metrics, ppda, leaguePP } = report;
  const id = team.id;
  const [mode, setMode] = useState("rate");
  const perGame = mode === "rate";
  useReport(() => ({
    rows: report.csvRows,
    meta: {
      Club: team.name,
      "Venue chart scale": perGame ? "Per game" : "Season totals",
      Fixtures: fixtures.length,
    },
  }));
  return (
    <>
      <section className="team-banner panel">
        <div className="team-id">
          <Crest club={team} size={50} />
          <div>
            <div className="overline">Club intelligence</div>
            <h2>{team.name}</h2>
            <small>
              {seasonLabel(data.year)} · {report.window} · Rank {team.pos} of 18
            </small>
          </div>
        </div>
        <div className="team-actions">
          <Select label="Select club" value={id} onChange={choose}>
            {data.clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button className="export-btn" onClick={download}>
            <ArrowDownToLine size={14} />
            Download report
            <ChevronDown size={12} />
          </button>
        </div>
      </section>
      <div className="two-col">
        <section className="panel split-card">
          <div className="overline cyan">
            <Home size={15} />
            Home performance
          </div>
          <strong>
            {f(venueValues(home, true)[0], 2)} <small>pts / game</small>
          </strong>
          <div className="split-stats">
            <span>
              <b>{home.gf}</b>Goals
            </span>
            <span>
              <b>{f(home.xg)}</b>
              <Metric name="xG" value={f(home.xg, 3)} />
            </span>
            <span>
              <b>{home.cs}</b>Clean sheets
            </span>
            <span>
              <b>{home.mp}</b>Games
            </span>
          </div>
        </section>
        <section className="panel split-card">
          <div className="overline red">
            <MapPin size={15} />
            Away performance
          </div>
          <strong>
            {f(venueValues(away, true)[0], 2)} <small>pts / game</small>
          </strong>
          <div className="split-stats">
            <span>
              <b>{away.gf}</b>Goals
            </span>
            <span>
              <b>{f(away.xg)}</b>
              <Metric name="xG" value={f(away.xg, 3)} />
            </span>
            <span>
              <b>{away.cs}</b>Clean sheets
            </span>
            <span>
              <b>{away.mp}</b>Games
            </span>
          </div>
        </section>
      </div>
      <div className="two-col">
        <section className="panel venue-comparison">
          <PanelTitle
            title="Venue comparison"
            icon={<BarChart3 size={17} />}
            sub={`${perGame ? "Per-match averages" : "Cumulative totals"} · ${report.window}`}
            action={
              <Select label="Comparison scale" value={mode} onChange={setMode}>
                <option value="rate">Per game</option>
                <option value="total">Season totals</option>
              </Select>
            }
          />
          <div className="legend">
            <span>
              <i style={{ background: "#06B6D4" }} />
              Home · {home.mp} games
            </span>
            <span>
              <i style={{ background: "#D20515" }} />
              Away · {away.mp} games
            </span>
          </div>
          <Canvas
            label={`${team.name}: home versus away ${perGame ? "per game" : "totals"}, ${report.window}`}
            height={210}
            config={{
              type: "bar",
              data: {
                labels: venueLabels,
                datasets: [
                  {
                    label: "Home",
                    data: venueValues(home, perGame),
                    backgroundColor: "#06B6D4",
                    maxBarThickness: 26,
                    borderRadius: 3,
                  },
                  {
                    label: "Away",
                    data: venueValues(away, perGame),
                    backgroundColor: "#D20515",
                    maxBarThickness: 26,
                    borderRadius: 3,
                  },
                ],
              },
              options: {
                animation: false,
                interaction: { mode: "index", intersect: false },
                scales: {
                  x: {
                    ...chartScales().x,
                    type: "category",
                    grid: { display: false },
                    ticks: {
                      autoSkip: false,
                      maxRotation: 0,
                      callback: (_v, i) =>
                        i === 2 ? ["Expected Goals", "(xG)"] : venueLabels[i],
                    },
                  },
                  y: { ...chartScales().y, type: "linear", beginAtZero: true },
                },
                plugins: {
                  tooltip: {
                    callbacks: {
                      title: (items) => venueLabels[items[0].dataIndex],
                      label: (ctx) =>
                        `${ctx.dataset.label}: ${f(Number(ctx.raw), perGame || ctx.dataIndex === 2 ? 2 : 0)} ${perGame ? "per game" : "total"}`,
                      footer: () => `${team.name} · ${report.window}`,
                    },
                  },
                },
              },
            }}
          />
        </section>
        <section className="panel">
          <PanelTitle
            title="Shot Conversion"
            german="Torschuss-Effizienz"
            icon={<Crosshair size={17} />}
            sub="From chance creation to the back of the net"
          />
          <div className="shot-benchmarks">
            {metrics.map((metric) => (
              <div key={metric.label} className="shot-metric">
                <div className="between">
                  <Metric
                    name={metric.label}
                    value={metric.format(metric.value)}
                  />
                  <b>{metric.format(metric.value)}</b>
                </div>
                <div className="shot-track" aria-hidden="true">
                  <i
                    style={{ width: `${(100 * metric.value) / metric.max}%` }}
                  />
                  <em style={{ left: `${(100 * metric.avg) / metric.max}%` }} />
                </div>
                <small>vs. {metric.format(metric.avg, true)} avg</small>
              </div>
            ))}
          </div>
          <div className="chart-note">
            Bar: club relative to league high · Tick: league average
          </div>
        </section>
      </div>
      <div className="two-col">
        <section className="panel">
          <PanelTitle
            title="Pressing Intensity"
            german="Pressing-Intensität (PPDA)"
            sub="Observed PPDA · mean across selected fixtures"
            icon={<Activity size={17} />}
          />
          <div className="gauge">
            <div className="gauge-value">
              <b>{ppda === null ? "N/A" : f(ppda)}</b>{" "}
              <Metric
                name="PPDA"
                value={ppda === null ? "Not recorded" : f(ppda, 3)}
              />
              <span>League avg {leaguePP === null ? "N/A" : f(leaguePP)}</span>
            </div>
            <div className="gauge-track">
              {leaguePP !== null && (
                <i
                  className="league-marker"
                  style={{
                    left: `${Math.min(100, Math.max(0, ((leaguePP - 5) / 20) * 100))}%`,
                  }}
                  title={`League average ${f(leaguePP, 2)}`}
                />
              )}
              {ppda !== null && (
                <i
                  style={{
                    left: `${Math.max(0, Math.min(100, ((ppda - 5) / 20) * 100))}%`,
                  }}
                  title={`${team.name}: ${f(ppda)} observed PPDA`}
                />
              )}
            </div>
            <div className="between">
              <small>High press</small>
              <small>Low block</small>
            </div>
            <p className="pressing-helper">
              Passes allowed per defensive action (lower = higher pressing
              intensity)
            </p>
          </div>
        </section>
        <section className="panel">
          <PanelTitle title="Recent fixtures" icon={<Trophy size={17} />} />
          <div className="fixtures club-fixtures">
            {fixtures.slice(0, 4).map((g) => (
              <div key={g.date + g.h}>
                <small>MD {g.md}</small>
                <span>{data.clubs.find((c) => c.id === g.h)?.short}</span>
                <span className="fixture-score">
                  <b>
                    {g.hg} : {g.ag}
                  </b>
                  <small>
                    {f(g.hx, 2)} – {f(g.ax, 2)} xG
                  </small>
                </span>
                <span>{data.clubs.find((c) => c.id === g.a)?.short}</span>
                <span
                  className={`result-badge result-${clubResult(g, id)}`}
                  aria-label={`${team.name}: ${{ W: "win", D: "draw", L: "loss" }[clubResult(g, id)]}`}
                >
                  {clubResult(g, id)}
                </span>
                <small>{g.date}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="team-print-report" aria-label="Complete club report">
        <h3>Home / Away splits</h3>
        <table>
          <thead>
            <tr>
              {report.splitHeaders.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.splitRows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j}>{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <h3>Shot efficiency & pressing intensity</h3>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>{team.name}</th>
              <th>League average</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label}>
                <td>{m.label}</td>
                <td>{m.format(m.value)}</td>
                <td>{m.format(m.avg, true)}</td>
              </tr>
            ))}
            <tr>
              <td>PPDA</td>
              <td>{ppda === null ? "N/A" : f(ppda, 3)}</td>
              <td>{leaguePP === null ? "N/A" : f(leaguePP, 3)}</td>
            </tr>
          </tbody>
        </table>
        <h3>Fixture log · {fixtures.length} matches</h3>
        <table>
          <thead>
            <tr>
              {report.fixtureHeaders.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.fixtureRows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j}>{j === 6 || j === 7 ? f(Number(v), 2) : v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
export function PlayerView({
  data,
  matchdays,
}: {
  data: Season;
  matchdays: string;
}) {
  const archive = useMemo(
    () =>
      data.players
        .filter((p) => p.minutes > 0)
        .sort((a, b) => b.g - a.g || b.xg - a.xg),
    [data],
  );
  const [qualified, setQualified] = useState(true);
  const pool = useMemo(
    () => (qualified ? archive.filter((p) => p.minutes >= 900) : archive),
    [archive, qualified],
  );
  const [a, setA] = useState(pool[0]?.id || ""),
    [b, setB] = useState(
      pool.find((p) => p.name === "Florian Wirtz")?.id || pool[1]?.id || "",
    ),
    [q, setQ] = useState(""),
    [pos, setPos] = useState("ALL"),
    [page, setPage] = useState(0);
  const pa = pool.find((p) => p.id === a) || pool[0],
    pb = pool.find((p) => p.id === b) || pool[1] || pool[0];
  const profiles = useMemo(
    () =>
      [pa, pb].filter(Boolean).map((player) => ({
        player,
        rates: playerAxes(player),
        ranks: percentiles(player, pool, qualified ? 900 : 90),
      })),
    [pa, pb, pool, qualified],
  );
  const toggleMinutes = () => {
    const next = qualified ? archive : archive.filter((p) => p.minutes >= 900);
    const left = next.find((p) => p.id === a) ?? next.find((p) => p.id !== b);
    const right =
      next.find((p) => p.id === b && p.id !== left?.id) ??
      next.find((p) => p.id !== left?.id);
    setA(left?.id ?? "");
    setB(right?.id ?? "");
    setQualified(!qualified);
    setPage(0);
  };
  const minutesToggle = (
    <button
      type="button"
      className="scout-minutes"
      aria-pressed={qualified}
      onClick={toggleMinutes}
    >
      <span aria-hidden="true" className="minutes-switch" />
      Min. minutes: ≥ 900′
    </button>
  );
  const filtered = pool.filter(
    (p) =>
      (pos === "ALL" || p.pos === pos) &&
      (
        p.name +
        " " +
        p.club +
        " " +
        (data.clubs.find((c) => c.id === p.club)?.name ?? "")
      )
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .includes(
          q
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
        ),
  );
  const playerReport = (): Report => ({
    meta: {
      ...provenance(data, "Player scouting"),
      Matchdays: matchdays,
      Scope: "Season-level player profiles; matchday slicing does not apply",
      "Player source": data.playerSource,
      Search: q || "All",
      Position: pos,
      "Minimum minutes": qualified ? 900 : 1,
      "Player A": pa?.name ?? "",
      "Player B": pb?.name ?? "",
      "Matching players": filtered.length,
    },
    rows: [
      ["Player", "Club", "Position", "Goals", "xG", "xA", "Minutes"],
      ...filtered.map((p) => [
        p.name,
        data.clubs.find((c) => c.id === p.club)?.name ?? p.club,
        p.pos,
        p.g,
        p.xg,
        p.xa,
        p.minutes,
      ]),
    ],
  });
  useReport(playerReport);
  const choose = (side: string, id: string) => {
    if (side === "A") {
      if (id === b) setB(a);
      setA(id);
    } else {
      if (id === a) setA(b);
      setB(id);
    }
  };
  if (!pa || !pb)
    return (
      <section className="panel empty-state">
        <UsersRound />
        <h2>Player archive unavailable</h2>
        <p>
          Choose a completed season to explore the verified player database.
        </p>
      </section>
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  return (
    <>
      <section className="panel">
        <PanelTitle
          title="Comparison studio"
          sub="Season-level player profiles, benchmarked against positional peers"
          icon={<UsersRound size={18} />}
          action={minutesToggle}
        />
        {pa.pos !== pb.pos && (
          <div className="position-notice" role="status">
            <Info size={12} />
            <span>
              Different positions · {pa.pos} vs {pb.pos}. Each player is ranked
              against their own position.
            </span>
          </div>
        )}
        <div className="compare-selectors">
          {[pa, pb].map((p, i) => (
            <div className={"compare-card cmp-" + i} key={i}>
              <span className="overline">Player {i ? "B" : "A"}</span>
              <Select
                label={`Player ${i ? "B" : "A"}`}
                value={p.id}
                onChange={(v) => choose(i ? "B" : "A", v)}
              >
                {pool.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <small>
                {data.clubs.find((c) => c.id === p.club)?.name || p.club} ·{" "}
                {p.pos} · {p.minutes.toLocaleString()} min
              </small>
            </div>
          ))}
          <button
            className="swap iconbtn"
            aria-label="Swap compared players"
            onClick={() => {
              setA(b);
              setB(a);
            }}
          >
            <ArrowLeftRight size={16} />
          </button>
        </div>
      </section>
      <div className="two-col">
        <section className="panel fingerprint-panel">
          <PanelTitle
            title="Performance fingerprint"
            sub="Six-axis positional percentiles · P0–P99"
            icon={<Crosshair size={17} />}
          />
          <ScoutingRadar profiles={profiles} />
          <div className="legend bottom">
            <span>
              <i style={{ background: "#D20515" }} />
              {pa.name}
            </span>
            <span>
              <i style={{ background: "#06B6D4" }} />
              {pb.name}
            </span>
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            title="Positional percentiles"
            icon={<BarChart3 size={17} />}
            sub="Raw rate per 90 minutes · positional percentile rank"
          />
          <div className="percentile-list scouting-rates">
            <div className="scout-rate-line rate-heading">
              <span>Metric</span>
              <span>Player A</span>
              <span>Player B</span>
            </div>
            {axes.map((l, i) => (
              <div key={l}>
                <div className="scout-rate-line">
                  <Metric name={l} />
                  {profiles.map(({ player, rates, ranks }, j) => (
                    <code
                      key={player.id}
                      aria-label={`${player.name}: ${f(rates[i], 3)} per 90, percentile ${ranks[i]}`}
                    >
                      <span>{f(rates[i], 2)}</span>
                      <em className={j ? "rank-b" : "rank-a"}>P{ranks[i]}</em>
                    </code>
                  ))}
                </div>
                <div className="double-bars">
                  <i
                    style={{
                      width: profiles[0].ranks[i] + "%",
                      background: "#D20515",
                    }}
                  />
                  <i
                    style={{
                      width: profiles[1].ranks[i] + "%",
                      background: "#06B6D4",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="chart-note">
            Position cohorts ·{" "}
            {profiles
              .map(
                ({ player }, i) =>
                  `${i ? "B" : "A"}: ${player.pos} (n=${pool.filter((p) => p.pos === player.pos && p.minutes >= (qualified ? 900 : 90)).length})`,
              )
              .join(" · ")}
          </div>
        </section>
      </div>
      <section className="panel">
        <PanelTitle
          title="Player database"
          icon={<Database size={17} />}
          sub={`${pool.length} player profiles · ${data.playerSource}`}
          action={
            <button
              className="button"
              onClick={() => {
                const r = playerReport();
                csv("bundeslens-players-" + data.year, r.rows, r.meta);
              }}
            >
              <ArrowDownToLine size={13} />
              Export CSV
            </button>
          }
        />
        <div className="database-bar scouting-filters">
          <label className="search">
            <Search size={15} />
            <input
              aria-label="Search players"
              placeholder="Search player or club…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
            />
          </label>
          {minutesToggle}
          <div className="tabs">
            {["ALL", "FW", "MF", "DF", "GK"].map((v) => (
              <button
                className={pos === v ? "active" : ""}
                key={v}
                onClick={() => {
                  setPos(v);
                  setPage(0);
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="table-scroll">
          <table className="player-table">
            <thead>
              <tr>
                {[
                  "Player",
                  "Pos",
                  "Goals",
                  "xG",
                  "xA",
                  "Minutes",
                  "Compare",
                ].map((n) => (
                  <th key={n}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(page * 12, page * 12 + 12).map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                    <small>
                      {data.clubs.find((c) => c.id === p.club)?.name || p.club}
                    </small>
                  </td>
                  <td>
                    <span className="tag">{p.pos}</span>
                  </td>
                  <td>{p.g}</td>
                  <td>
                    <Metric name="xG" value={p.xg}>
                      {f(p.xg)}
                    </Metric>
                  </td>
                  <td>
                    <Metric name="xA" value={p.xa}>
                      {f(p.xa)}
                    </Metric>
                  </td>
                  <td>{p.minutes}</td>
                  <td>
                    <div className="pick-buttons">
                      {["A", "B"].map((v) => (
                        <button
                          key={v}
                          className={
                            (v === "A" ? a : b) === p.id ? "picked" : ""
                          }
                          onClick={() => choose(v, p.id)}
                        >
                          {(v === "A" ? a : b) === p.id ? (
                            <Check size={10} />
                          ) : null}
                          Compare {v}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <div className="empty-state">
              No players match this search. Try another name or position.
            </div>
          )}
        </div>
        <div className="table-foot">
          <span>
            {filtered.length} players · Page {page + 1} of {pageCount}
          </span>
          <div className="pagination">
            <button
              aria-label="Previous page"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              aria-label="Next page"
              disabled={page >= pageCount - 1}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </section>
      <p className="data-note">
        <Info size={14} />
        {data.year === "2024"
          ? "All six axes use recorded FBref player metrics."
          : data.year !== "2025"
            ? "Shot creation, recoveries, and missing progression statistics use directional proxies."
            : "Progressive passes and shot creation use directional proxies; recoveries are observed."}{" "}
        Per-90 rates use actual minutes played. Percentiles use same-season,
        same-position peers with at least {qualified ? 900 : 90} minutes; tied
        values share a midrank, rounded and capped at P99.
        {!qualified ? " Rates from short appearances can be unstable." : ""}
      </p>
    </>
  );
}
export function Predictor({
  data,
  rows,
  matches,
}: {
  data: Season;
  rows: Row[];
  matches: Match[];
}) {
  const [h, setH] = useState(rows[0].id),
    [a, setA] = useState(rows[1].id),
    [venue, setVenue] = useState(50),
    [form, setForm] = useState(100),
    [mode, setMode] = useState(0),
    [showOdds, setShowOdds] = useState(false);
  const home = rows.find((r) => r.id === h) || rows[0],
    away = rows.find((r) => r.id === a) || rows[1];
  const features = useMemo(
    () => vector(data.research, matches, data.matches, h, a, venue, form),
    [data, matches, h, a, venue, form],
  );
  const { lh, la, scores, calibrated, ci, drivers, baseline } = useMemo(
    () => forecast(data.research, features, mode, data.year),
    [data, features, mode],
  );
  const cutoff = matches
    .map((m) => m.date)
    .sort()
    .at(-1)!;
  const h2h = [...data.history, ...data.matches]
    .filter(
      (m) =>
        m.date <= cutoff &&
        ((m.h === h && m.a === a) || (m.h === a && m.a === h)),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const maxDriver = Math.max(0.001, ...drivers.map(Math.abs));
  // Use largest-remainder rounding only for display, so the six printed
  // contributions reconcile to the printed home-win percentage to 0.01 pp.
  const cents = drivers.map((v) => Math.floor(v * 100));
  const extra =
    Math.round(calibrated[0] * 10000) -
    Math.round(baseline * 10000) -
    cents.reduce((s, n) => s + n, 0);
  drivers
    .map((v, i) => ({ i, remainder: v * 100 - cents[i] }))
    .sort((a, b) => b.remainder - a.remainder)
    .slice(0, extra)
    .forEach(({ i }) => cents[i]++);
  const names = featureNames;
  useReport(() => ({
    meta: {
      "Home team": home.name,
      "Away team": away.name,
      Model: architectures[mode],
      "Venue advantage (%)": venue,
      "Recent form weight (%)": form,
      "Fair odds": showOdds ? "shown" : "hidden",
      "Data cutoff": cutoff,
      "Bootstrap refits": data.research.replicates.length,
    },
    rows: [
      [
        "Outcome",
        "Probability",
        "95% CI lower",
        "95% CI upper",
        ...(showOdds ? ["Fair decimal odds"] : []),
      ],
      ...["Home win", "Draw", "Away win"].map((s, i) => [
        s,
        calibrated[i],
        ci[i][0],
        ci[i][1],
        ...(showOdds ? [1 / calibrated[i]] : []),
      ]),
      [],
      ["Expected goals", "Home", "Away"],
      ["Lambda", lh, la],
      [],
      ["Home goals", "Away goals", "Scoreline probability"],
      ...scores.slice(0, 5).map((s) => [s.h, s.a, s.p]),
      [],
      ["SHAP feature", "Contribution (percentage points)"],
      ...names.map((s, i) => [s, drivers[i]]),
      ["Base home-win probability", baseline],
    ],
  }));
  return (
    <>
      <section className="panel">
        <PanelTitle
          title="Fixture simulator"
          sub="Choose a fixture. Adjust the assumptions. Explore the probabilities."
          icon={<FlaskConical size={18} />}
          action={
            <span className="live-label">
              <i />
              Model ready
            </span>
          }
        />
        <div
          className="model-picker"
          role="group"
          aria-label="Model architecture"
        >
          {architectures.map((name, i) => (
            <button
              key={name}
              aria-pressed={mode === i}
              onClick={() => setMode(i)}
            >
              <span>MODEL 0{i + 1}</span>
              {name}
            </button>
          ))}
        </div>
        <div className="fixture-select">
          {[home, away].map((r, i) => (
            <div key={i}>
              <div className="overline">{i ? "Away team" : "Home team"}</div>
              <Crest club={r} size={47} />
              <Select
                label={i ? "Away team" : "Home team"}
                value={r.id}
                onChange={(v) => {
                  if (i) {
                    if (v === h) setH(a);
                    setA(v);
                  } else {
                    if (v === a) setA(h);
                    setH(v);
                  }
                }}
              >
                {rows.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          <button
            type="button"
            className="versus venue-swap"
            aria-label="Swap home and away teams"
            title="Swap home and away teams"
            onClick={() => {
              setH(a);
              setA(h);
            }}
          >
            <ArrowLeftRight size={13} />
            Swap
          </button>
        </div>
        <div className="slider-pair">
          {[
            ["Venue advantage", venue, setVenue],
            ["Recent form weight", form, setForm],
          ].map(([label, v, set]) => (
            <label key={String(label)}>
              <span>
                {String(label)}
                <code>{Number(v)}%</code>
              </span>
              <input
                aria-label={String(label)}
                type="range"
                min="0"
                max="100"
                value={Number(v)}
                onChange={(e) => (set as (n: number) => void)(+e.target.value)}
              />
            </label>
          ))}
        </div>
      </section>
      <div className="two-col">
        <section className="panel">
          <PanelTitle
            title="Match probabilities"
            icon={<Activity size={17} />}
            sub={architectures[mode]}
            action={
              <button
                className="fair-odds-toggle"
                type="button"
                aria-pressed={showOdds}
                onClick={() => setShowOdds((v) => !v)}
              >
                Show Fair Odds (1/p)
              </button>
            }
          />
          {mode === 0 && (
            <details className="stack-metadata">
              <summary>
                Stacking blend: 0.55 Dixon-Coles + 0.45 XGBoost (minimizing
                out-of-sample RPS)
              </summary>
              <p>
                Weights are fixed at 55:45. Temperature calibration minimizes
                RPS on {data.research.calibration} held-out prior-season
                fixtures; the weights are not claimed to be a fitted optimum.
                Each bootstrap replicate uses its own recalibration.
              </p>
            </details>
          )}
          <div className="probabilities">
            {["Home win", "Draw", "Away win"].map((v, i) => (
              <div key={v}>
                <div className="between">
                  <span>{v}</span>
                  <span className="prob-reading">
                    <small>
                      <Metric name="95% CI" /> {f(ci[i][0] * 100)}–
                      {f(ci[i][1] * 100)}%
                    </small>
                    <b>{f(calibrated[i] * 100, 2)}%</b>
                    {showOdds && (
                      <code
                        className="fair-odds"
                        title="Decimal fair odds: reciprocal of the unrounded model probability, without margin"
                      >
                        {f(1 / calibrated[i], 2)}×
                      </code>
                    )}
                  </span>
                </div>
                <div className="bar-track">
                  <i
                    style={{
                      width: calibrated[i] * 100 + "%",
                      background: ["#ed5869", "#8b98ad", "#29bfcb"][i],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="ci-caption">
            95% percentile intervals · {data.research.replicates.length}{" "}
            matchday-block bootstrap refits
          </div>
          <div
            className="lambda"
            title="Mean home and away goals under the displayed score distribution"
          >
            <span>
              <Metric name="λ Home" value={f(lh, 3)} /> <b>{f(lh, 2)}</b>
            </span>
            <span>
              <Metric name="λ Away" value={f(la, 3)} /> <b>{f(la, 2)}</b>
            </span>
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            title="Top 5 most likely exact scorelines"
            sub={
              mode === 2
                ? "Tree goal rates · independent Poisson score grid"
                : "Dixon-Coles low-score correlation adjustment · ρ = −0.11"
            }
            icon={<Target size={17} />}
          />
          <div className="scorelines">
            {scores
              .sort((a, b) => b.p - a.p)
              .slice(0, 5)
              .map((s, i) => (
                <div key={i}>
                  <small>0{i + 1}</small>
                  <b>
                    {s.h} – {s.a}
                  </b>
                  <div className="bar-track">
                    <i style={{ width: s.p * 550 + "%" }} />
                  </div>
                  <code>{f(s.p * 100)}%</code>
                </div>
              ))}
          </div>
        </section>
      </div>
      <div className="two-col">
        <section className="panel">
          <PanelTitle
            title="SHAP Feature Attribution"
            sub={`Home-win probability · ${f(baseline * 100)}% league reference + six contributions`}
            icon={<SlidersHorizontal size={17} />}
          />
          <div className="drivers">
            {drivers
              .map((v, i) => ({ v, n: names[i], display: cents[i] / 100 }))
              .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
              .map((d) => (
                <div key={d.n}>
                  <div className="between">
                    <span>{d.n}</span>
                    <code className={d.v >= 0 ? "positive" : "red"}>
                      {signed(d.display, 2)} pp
                    </code>
                  </div>
                  <div className="bar-track">
                    <i
                      style={{
                        width: (Math.abs(d.v) / maxDriver) * 100 + "%",
                        background: d.v >= 0 ? "var(--green)" : "var(--red)",
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
          <div className="attribution-total">
            <span>
              {f(baseline * 100, 2)}%{" "}
              {signed(
                (Math.round(calibrated[0] * 10000) -
                  Math.round(baseline * 10000)) /
                  100,
                2,
              )}{" "}
              pp
            </span>
            <strong>= {f(calibrated[0] * 100, 2)}% home win</strong>
          </div>
          <div className="chart-note">
            Reference-weighted SHAP · separate model inputs, not causal effects.
            The 39.3% reference is fixed, not the selected season’s observed win
            rate.
          </div>
        </section>
        <section className="panel">
          <PanelTitle
            title="Head-to-head history"
            sub={`Recorded meetings through ${cutoff} · same cutoff as fixture inputs`}
            icon={<ShieldHalf size={17} />}
          />
          <div className="fixtures h2h">
            {h2h.length ? (
              h2h.map((m) => (
                <div key={m.date + m.h}>
                  <small>{m.date}</small>
                  <span>{rows.find((r) => r.id === m.h)?.short}</span>
                  <b>
                    {m.hg} : {m.ag}
                  </b>
                  <span>{rows.find((r) => r.id === m.a)?.short}</span>
                </div>
              ))
            ) : (
              <p>No previous meetings in the archive.</p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
export function Methodology({ data }: { data: Season }) {
  const [open, setOpen] = useState<number | null>(0);
  const docs = [
    [
      "Results, seasons & coverage",
      "Five complete seasons, 2021/22–2025/26: 1,530 recorded fixtures. Each archive is checked for 18 clubs, 34 matchdays and nine fixtures per round. Results and shots come from Football-Data.co.uk; matchdays and scoring events are joined against OpenLigaDB.",
    ],
    [
      "Expected goals & expected points",
      data.xgSource +
        " All five archives use Understat expected points where available; missing values use the match xG Poisson distribution. xPts Δ is actual points minus expected points.",
    ],
    [
      "Player scouting & tactical proxies",
      "The 2024/25 scouting archive uses observed FBref per-90 metrics on all six axes. Other archives use recorded Understat or FBref season totals. When event counts are missing, progression uses key passes and assists, creation uses shots and key passes, and recoveries use a position-and-minutes prior. The pipeline uses observed match PPDA, with a 12.0 neutral fallback for missing observations.",
    ],
    [
      "Model training & validation",
      "Dixon–Coles fits two goal rates with a low-score adjustment (ρ = −0.11); two XGBoost regressors estimate the alternative goal rates. The simulator uses a fixed 55:45 probability blend. Temperature is fitted to minimize held-out RPS before the selected season. Scoreline mass is recalibrated within each outcome, so it sums to the displayed 1X2 probabilities. The archived validation metrics and reliability curve describe the original 50:50 experiment over 34 expanding-window refits, not a new test score for the simulator.",
    ],
    [
      "Uncertainty, feature attribution & assumptions",
      "Intervals use the 2.5th and 97.5th percentiles of 120 matchday-block bootstrap refits, each with its own calibration. Team Elo difference excludes the venue slider. Venue independently shifts the two log goal rates in opposite directions; 50% restores the archived home setting. SHAP evaluates all 64 coalitions of the six inputs. Twelve neutral-venue background profiles are exponentially reweighted to the specified 39.3% reference; this is not a measured seasonal win rate. The contributions explain model behavior rather than causal effects. Rest includes league matches only, capped at 21 days; the hypothetical kickoff is seven days after the selected window. Injuries and lineups are not modeled.",
    ],
    [
      "Data attribution & intended use",
      "Independent educational and portfolio research. Football-Data.co.uk provides match records; Understat provides historical xG and PPDA, distributed by the European Football Leagues Match Statistics archive. OpenLigaDB supplies goal events. ESPN supplies club identities. FBref player archives supply progression, recoveries and shot-creation data through aggregated public datasets. Club crests belong to their owners. Stadium photography: ShotsBy Csongii / Pexels. Predictions are estimates, not guarantees.",
    ],
  ];
  return (
    <>
      <section className="panel">
        <PanelTitle
          title="From fixture to insight"
          icon={<Workflow size={18} />}
          sub="A reproducible pipeline from public match records to browser-side inference"
        />
        <Pipeline />
      </section>
      <section className="panel">
        <PanelTitle
          title="Measured out-of-sample validation"
          icon={<FlaskConical size={18} />}
          sub={`${seasonLabel(data.year)} · 306 held-out fixtures across 34 matchday folds · no random K-Fold`}
        />
        <div className="validation-grid">
          {["RPS", "Log-Loss", "Brier score"].map((l, i) => (
            <div key={l}>
              <Metric name={l} value={data.research.metrics[i]} />
              <strong>{f(data.research.metrics[i], 3)}</strong>
              <small>
                Reference target: {[0.184, 0.942, 0.541][i].toFixed(3)}
              </small>
            </div>
          ))}
          <div>
            <span>Validation</span>
            <strong>34 folds</strong>
            <small>Expanding time-series CV</small>
          </div>
        </div>
      </section>
      <ResearchReport data={data} />
      <section className="panel">
        <PanelTitle
          title="Research notes"
          icon={<BookOpen size={17} />}
          sub="Definitions, provenance and the limits of the model"
        />
        {docs.map(([title, text], i) => (
          <div className="accordion" key={title}>
            <button
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span>
                <code>0{i + 1}</code>
                {title}
              </span>
              <ChevronDown
                size={15}
                style={{ transform: open === i ? "rotate(180deg)" : "" }}
              />
            </button>
            {open === i && <p>{text}</p>}
          </div>
        ))}
      </section>
      <section className="panel sources">
        <PanelTitle title="Source library" icon={<Database size={17} />} />
        <div>
          {[
            ["Football-Data", "https://www.football-data.co.uk/germanym.php"],
            ["Understat", "https://understat.com/league/Bundesliga"],
            ["OpenLigaDB", "https://www.openligadb.de/"],
            [
              "FBref reference",
              "https://fbref.com/en/comps/20/Bundesliga-Stats",
            ],
          ].map(([n, u]) => (
            <a key={n} href={u} target="_blank" rel="noreferrer">
              {n}
              <ArrowUpRight size={13} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
