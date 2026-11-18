import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  FileSpreadsheet,
  FileText,
  Github,
  Menu,
  Moon,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import {
  csv,
  rangeNames,
  ranges,
  seasonLabel,
  standings,
  type Season,
} from "./data";
import { Modal, navigation, Repo, Select, Sidebar, type View } from "./ui";
import { EmptyRange, Loading, Overview } from "./Overview";
import { Methodology, PlayerView, Predictor, TeamView } from "./Analysis";
import { canonicalClubs } from "./clubNames";
import { repositoryUrl } from "./repository";
import { ChartTheme } from "./chartTheme";
import { ReportContext, provenance, type Report } from "./reportContext";
import "./workspace.css";
import "./refinements.css";
const meta: Record<View, [string, string, string]> = {
  overview: [
    "League overview",
    "Bundesliga Overview",
    "League-wide performance, expected goals, and the title race.",
  ],
  teams: [
    "Team deep-dive",
    "Team Deep-Dive",
    "The numbers behind each club, home and away.",
  ],
  players: [
    "Player scouting",
    "Player Scouting",
    "Explore individual output and compare positional fingerprints.",
  ],
  predictor: [
    "Match predictor",
    "Match Predictor",
    "Simulate a fixture with an explainable goal model.",
  ],
  methodology: [
    "Methodology",
    "Methodology & Pipeline",
    "The data, assumptions, and models behind BundesLens.",
  ],
};
function initialView(): View {
  const s = location.hash.slice(1);
  return navigation.some((n) => n.id === s) ? (s as View) : "overview";
}
export default function Workspace() {
  const [view, setView] = useState<View>(initialView),
    [year, setYear] = useState("2025"),
    [phase, setPhase] = useState(0),
    [theme, setTheme] = useState(
      () => localStorage.getItem("bl-theme") || "dark",
    ),
    [collapsed, setCollapsed] = useState(
      () => localStorage.getItem("bl-rail") === "1",
    ),
    [mobile, setMobile] = useState(false),
    [data, setData] = useState<Season | null>(null),
    [loading, setLoading] = useState(true),
    [transition, setTransition] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [modal, setModal] = useState(""),
    [club, setClub] = useState("Bayern Munich"),
    [toast, setToast] = useState("");
  const cache = useRef(new Map<string, Season>());
  const report = useRef<(() => Report) | null>(null);
  const closeModal = useCallback(() => setModal(""), []);
  const [start, end] = ranges[phase];
  useEffect(() => {
    const on = () => setView(initialView());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bl-theme", theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("bl-rail", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    const ctrl = new AbortController();
    let alive = true;
    (async () => {
      try {
        let next = cache.current.get(year);
        if (!next) {
          try {
            const r = await fetch(`/api/seasons?year=${year}`, {
              signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(7500)]),
            });
            if (!r.ok) throw Error("Archive mode");
            const obj = await r.json();
            if (!obj.matches || !obj.research) throw Error("Archive mode");
            next = obj as Season;
          } catch {
            const r = await fetch(`/data/${year}.json`, {
              signal: ctrl.signal,
            });
            if (!r.ok)
              throw Error(
                "The season archive could not be loaded. Please try again.",
              );
            next = (await r.json()) as Season;
          }
          next = { ...next, clubs: canonicalClubs(next.clubs) };
          cache.current.set(year, next);
        }
        if (alive) {
          setData(next);
          setLoading(false);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Unable to load archive");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [year, retry]);
  useEffect(() => {
    const timeout = setTimeout(() => setTransition(false), 210);
    return () => clearTimeout(timeout);
  }, [view, phase]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2300);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!mobile) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobile(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [mobile]);
  const matches = useMemo(
    () => data?.matches.filter((m) => m.md >= start && m.md <= end) || [],
    [data, start, end],
  );
  const rows = useMemo(
    () => (data ? standings(data.clubs, matches) : []),
    [data, matches],
  );
  const go = (v: View) => {
    if (view !== v) setTransition(true);
    setView(v);
    location.hash = v;
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const selectedClub = (id: string) => {
    setClub(id);
    go("teams");
  };
  const maxDay = Math.max(0, ...(data?.matches.map((m) => m.md) || []));
  const exportCSV = () => {
    if (!data || !report.current) return;
    const active = report.current();
    csv(`BundesLens-${view}-${year}-MD${start}-${end}`, active.rows, {
      ...provenance(data, meta[view][0]),
      Matchdays: `${rangeNames[phase]} · MD ${start}–${end}`,
      ...active.meta,
    });
    setModal("");
    setToast("CSV report downloaded");
  };
  return (
    <ChartTheme.Provider value={theme}>
      <ReportContext.Provider value={report}>
        <div className={"app " + (collapsed ? "rail" : "")}>
          <a className="skip" href="#workspace">
            Skip to analytics
          </a>
          <Sidebar
            view={view}
            go={go}
            collapsed={collapsed}
            toggle={() => setCollapsed(!collapsed)}
            mobile={mobile}
            close={() => setMobile(false)}
          />
          <div className="main-shell">
            <header className="topbar">
              <button
                className="mobile-menu iconbtn"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu size={20} />
              </button>
              <div className="control-group">
                <CalendarDays size={15} />
                <span className="control-label">Season</span>
                <Select
                  label="Season"
                  value={year}
                  onChange={(v) => {
                    setLoading(true);
                    setError("");
                    setYear(v);
                  }}
                >
                  {["2025", "2024", "2023", "2022", "2021"].map((y) => (
                    <option key={y} value={y}>
                      {seasonLabel(y)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="control-divider" />
              <div className="control-group phase">
                <SlidersHorizontal size={15} />
                <span className="control-label">
                  Matchday{" "}
                  <span className="domain-de" lang="de">
                    · Spieltag
                  </span>
                </span>
                <Select
                  label="Matchday range"
                  value={String(phase)}
                  onChange={(v) => {
                    setTransition(true);
                    setPhase(+v);
                  }}
                >
                  {rangeNames.map((s, i) => (
                    <option value={i} key={s}>
                      {s} (MD {ranges[i][0]}–{ranges[i][1]})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="topbar-end">
                <button
                  className="theme-button iconbtn"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  title="Toggle display theme"
                >
                  {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </button>
                <div className="control-divider" />
                <a
                  className="repo-button"
                  href={repositoryUrl}
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
                      event.preventDefault();
                      setModal("repo");
                    }
                  }}
                >
                  <Github size={16} />
                  <span>GitHub Repo</span>
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </header>
            <main id="workspace">
              <div className="breadcrumb">
                <span>Workspace</span>
                <ChevronRight size={11} />
                {meta[view][0]}
                <span className="workspace-id source-badge">
                  Source: Football-Data.co.uk · FBref · Understat
                </span>
              </div>
              <section
                className={"hero " + (view !== "overview" ? "hero-small" : "")}
              >
                <div className="hero-photo" />
                <div className="hero-grid" />
                <div className="hero-content">
                  <div className="hero-eyebrow">
                    <i />
                    <i />
                    <i />
                    <span>BUNDESLIGA INTELLIGENCE</span>
                  </div>
                  <h1>{meta[view][1]}</h1>
                  <p>{meta[view][2]}</p>
                  <div className="hero-meta">
                    <span className="league-flag">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>Germany · Bundesliga</span>
                    <b /> <span>Season {seasonLabel(year)}</span>
                  </div>
                </div>
                <div className="hero-code">
                  <span className="focus-corner" />
                  DEU <b>/</b> BL1
                </div>
              </section>
              <div className="section-strip">
                <div>
                  <span className="section-tick" />
                  <h2>
                    {view === "overview" ? "Season snapshot" : meta[view][0]}
                  </h2>
                  {data && (
                    <span className="season-state">
                      <i />
                      {maxDay === 34 ? "Season complete" : `Matchday ${maxDay}`}
                    </span>
                  )}
                </div>
                {view !== "methodology" && view !== "teams" && (
                  <button
                    className="export-btn"
                    disabled={loading || !data}
                    onClick={() => setModal("export")}
                  >
                    <ArrowDownToLine size={14} />
                    <span>Download report</span>
                    <ChevronDown size={12} />
                  </button>
                )}
              </div>
              {error ? (
                <div className="panel empty-state">
                  <CircleAlert />
                  <h2>Archive unavailable</h2>
                  <p>{error}</p>
                  <button
                    className="button"
                    onClick={() => {
                      setLoading(true);
                      setError("");
                      setRetry(retry + 1);
                    }}
                  >
                    Retry connection
                  </button>
                </div>
              ) : loading || transition || !data ? (
                <Loading />
              ) : (
                <div className="view-content" key={view + year + phase}>
                  {!matches.length &&
                  view !== "methodology" &&
                  view !== "players" ? (
                    <EmptyRange />
                  ) : view === "overview" ? (
                    <Overview
                      data={data}
                      matches={matches}
                      rows={rows}
                      theme={theme}
                      onTeam={selectedClub}
                      phase={phase}
                    />
                  ) : view === "teams" ? (
                    <TeamView
                      data={data}
                      matches={matches}
                      rows={rows}
                      selected={club}
                      choose={setClub}
                      download={() => setModal("export")}
                    />
                  ) : view === "players" ? (
                    <PlayerView data={data} matchdays={`MD ${start}–${end}`} />
                  ) : view === "predictor" ? (
                    <Predictor data={data} rows={rows} matches={matches} />
                  ) : (
                    <Methodology data={data} />
                  )}
                </div>
              )}
              <footer>
                <div className="author-footer">
                  <strong>
                    BundesLens · Bundesliga Quantitative Analytics &amp; Match
                    Forecasting
                  </strong>
                  <span>
                    Developed by Swaraj Deshmukh · Data Analytics &amp; Machine
                    Learning Portfolio
                  </span>
                  <small>
                    Open Data Attribution: Football-Data.co.uk, FBref, and
                    Understat · Independent Academic Research Project
                  </small>
                </div>
                <button onClick={() => go("methodology")}>
                  Sources & methodology
                  <ArrowUpRight size={12} />
                </button>
              </footer>
            </main>
          </div>
          {modal === "repo" && (
            <Modal
              title="Inside BundesLens"
              kicker="Project repository"
              close={closeModal}
            >
              <Repo />
            </Modal>
          )}
          {modal === "export" && (
            <Modal
              title="Download report"
              kicker="Workspace export"
              close={closeModal}
            >
              <p className="muted">
                {view === "teams"
                  ? (rows.find((r) => r.id === club) ?? rows[0])?.name
                  : meta[view][0]}{" "}
                · {seasonLabel(year)} · {rangeNames[phase]}, MD {start}–{end}
              </p>
              <button className="export-option" onClick={exportCSV}>
                <FileSpreadsheet />
                <span>
                  <b>CSV dataset</b>
                  <small>Analysis-ready values for your spreadsheet</small>
                </span>
                <ArrowDownToLine size={16} />
              </button>
              <button
                className="export-option"
                onClick={() => {
                  setModal("");
                  setTimeout(() => window.print(), 120);
                }}
              >
                <FileText />
                <span>
                  <b>Print / Save as PDF</b>
                  <small>A clean print layout of the current view</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            </Modal>
          )}
          {toast && (
            <div className="toast" role="status">
              <Check size={15} />
              {toast}
            </div>
          )}
        </div>
      </ReportContext.Provider>
    </ChartTheme.Provider>
  );
}
