import { createPortal } from "react-dom";
import { repositoryPath, repositoryUrl } from "./repository";
import {
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChartTheme, themedConfig } from "./chartTheme";
import { Chart, registerables, type ChartConfiguration } from "chart.js";
import {
  ChevronDown,
  X,
  Database,
  Activity,
  GitBranch,
  Layers3,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  ShieldHalf,
  UsersRound,
  ScanLine,
  BookOpen,
  ArrowUpRight,
  Check,
  Server,
  Braces,
  Workflow,
  FileCode2,
} from "lucide-react";
import { definitions, type Club } from "./data";
Chart.register(...registerables);
Chart.defaults.font.family = '"IBM Plex Mono",monospace';
Chart.defaults.font.size = 10;
Chart.defaults.color = "#8f9cae";
Chart.defaults.plugins.legend.display = false;
Chart.defaults.animation = { duration: 450 };
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 6;
Chart.defaults.plugins.tooltip.backgroundColor = "#202a39";
export type View =
  | "overview"
  | "teams"
  | "players"
  | "predictor"
  | "methodology";
// Shared navigation schema is static across refreshes.
// eslint-disable-next-line react-refresh/only-export-components
export const navigation = [
  { id: "overview", text: "League Overview", icon: LayoutDashboard },
  { id: "teams", text: "Team Deep-Dive", icon: ShieldHalf },
  { id: "players", text: "Player Scouting", icon: UsersRound },
  { id: "predictor", text: "Match Predictor", icon: ScanLine },
  { id: "methodology", text: "Methodology", icon: BookOpen },
] as const;
export function Mark() {
  return (
    <svg viewBox="0 0 40 42" className="brandmark" aria-hidden="true">
      <path
        d="M7 3h16l-7 9H1zM19 14h18l-7 9H12zM8 25h18l-9 13H0z"
        fill="currentColor"
      />
      <path d="M26 3h12l-7 9H19z" fill="currentColor" opacity=".72" />
    </svg>
  );
}
export function Pitch() {
  return (
    <svg viewBox="0 0 220 93" className="pitch" aria-hidden="true">
      <defs>
        <pattern id="pg" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" fill="none" stroke="#36434a" strokeWidth=".4" />
        </pattern>
      </defs>
      <rect width="220" height="93" fill="url(#pg)" />
      <g fill="none" stroke="#52626b" strokeWidth=".8">
        <rect x="20" y="9" width="180" height="74" rx="1" />
        <path d="M110 9v74M20 23h27v46H20m180-46h-27v46h27M20 34h11v24H20m180-24h-11v24h11" />
        <circle cx="110" cy="46" r="15" />
      </g>
      <path
        d="m45 57 38-28 32 27 37-24 27 19"
        fill="none"
        stroke="#e65a69"
        strokeDasharray="3 3"
      />
      {[
        [45, 57],
        [83, 29],
        [115, 56],
        [152, 32],
        [179, 51],
      ].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="7" fill="#d94e63" opacity=".12" />
          <circle cx={x} cy={y} r="2.5" fill="#f66a77" />
        </g>
      ))}
    </svg>
  );
}
export function Sidebar({
  view,
  go,
  collapsed,
  toggle,
  mobile,
  close,
}: {
  view: View;
  go: (v: View) => void;
  collapsed: boolean;
  toggle: () => void;
  mobile: boolean;
  close: () => void;
}) {
  return (
    <>
      {mobile && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={close}
        />
      )}
      <aside
        className={
          "sidebar " +
          (mobile ? "mobile-open " : "") +
          (collapsed ? "is-collapsed" : "")
        }
      >
        <div className="brand">
          <Mark />
          <div className="brand-copy">
            <b>
              Bundes<span>Lens</span>
            </b>
            <small>FOOTBALL INTELLIGENCE</small>
          </div>
          <button
            className="mobile-close iconbtn"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="side-nav">
          <div className="overline nav-caption">Workspace</div>
          {navigation.slice(0, 4).map((n) => (
            <button
              key={n.id}
              title={n.text}
              onClick={() => go(n.id)}
              className={"nav-item " + (view === n.id ? "selected" : "")}
            >
              <n.icon size={18} />
              <span>{n.text}</span>
              {n.id === "predictor" && <em>ML</em>}
            </button>
          ))}
          <div className="nav-rule" />
          <div className="overline nav-caption">Resources</div>
          {navigation.slice(4).map((n) => (
            <button
              key={n.id}
              title={n.text}
              onClick={() => go(n.id)}
              className={"nav-item " + (view === n.id ? "selected" : "")}
            >
              <n.icon size={18} />
              <span>{n.text}</span>
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="engine-box">
            <div className="overline">
              <span className="online-dot" />
              System status
            </div>
            <Pitch />
            <div className="engine-line">
              <Activity size={13} />
              Analytics engine online
            </div>
            <div className="engine-ver">
              BUNDESLENS <span>v1.0</span>
            </div>
          </div>
          <button
            onClick={toggle}
            className="collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight size={16} />
            ) : (
              <ChevronsLeft size={16} />
            )}
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
export function Metric({
  name,
  value,
  children,
}: {
  name: string;
  value?: string | number;
  children?: ReactNode;
}) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const tooltipId = useId();
  const text = definitions[name];
  const show = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPoint({
      x: Math.min(
        window.innerWidth - 286,
        Math.max(8, rect.left + rect.width / 2 - 136),
      ),
      y:
        rect.bottom + 84 < window.innerHeight ? rect.bottom + 8 : rect.top - 79,
    });
  };
  if (!text) return <span>{children || name}</span>;
  return (
    <span
      className="metric-tip"
      tabIndex={0}
      aria-describedby={point ? tooltipId : undefined}
      aria-label={`${name}${value !== undefined ? ": " + value : ""}. ${text}`}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={() => setPoint(null)}
      onFocus={(e) => show(e.currentTarget)}
      onBlur={() => setPoint(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") setPoint(null);
      }}
    >
      {children || name}
      {point &&
        createPortal(
          <span
            role="tooltip"
            id={tooltipId}
            className="metric-floating"
            style={{ left: point.x, top: point.y }}
          >
            <b>
              {name}
              {value !== undefined && ` · ${value}`}
            </b>
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={"selectwrap " + className}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
      <ChevronDown size={13} />
    </span>
  );
}
export function Crest({ club, size = 24 }: { club: Club; size?: number }) {
  return (
    <img
      className="crest"
      src={club.logo}
      width={size}
      height={size}
      alt=""
      loading="lazy"
    />
  );
}
export function PanelTitle({
  title,
  german,
  sub,
  icon,
  action,
}: {
  title: string;
  german?: string;
  sub?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="panel-head">
      <div>
        <h2>
          {icon && <span className="head-symbol">{icon}</span>}
          {title}
          {german && (
            <span className="domain-de" lang="de">
              · {german}
            </span>
          )}
        </h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
export function Canvas({
  config,
  label,
  theme,
  height = 220,
}: {
  config: ChartConfiguration;
  label: string;
  theme?: string;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const currentTheme = useContext(ChartTheme);
  useEffect(() => {
    if (!ref.current) return;
    const c = themedConfig(config, theme ?? currentTheme);
    const chart = new Chart(ref.current, c);
    return () => chart.destroy();
  }, [config, theme, currentTheme]);
  return (
    <div className="chart-wrap" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function chartScales(xname?: string, yname?: string) {
  return {
    x: {
      grid: { color: "rgba(142,157,175,.09)" },
      ticks: { maxTicksLimit: 8 },
      title: { display: !!xname, text: xname, color: "#8c99aa" },
    },
    y: {
      grid: { color: "rgba(142,157,175,.11)" },
      border: { dash: [3, 4] },
      ticks: { maxTicksLimit: 6 },
      title: { display: !!yname, text: yname, color: "#8c99aa" },
    },
  };
}
export function Spark({
  values,
  color,
  id,
  bars = false,
}: {
  values: number[];
  color: string;
  id: string;
  bars?: boolean;
}) {
  const w = 112,
    h = 38,
    min = Math.min(...values) * 0.8,
    max = Math.max(...values) || 1;
  const ps = values.map(
    (v, i) =>
      `${(i * w) / Math.max(1, values.length - 1)},${h - 4 - ((v - min) / (max - min || 1)) * (h - 8)}`,
  );
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".26" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {bars ? (
        values.map((v, i) => (
          <rect
            key={i}
            x={(i * w) / values.length}
            y={h - (v / max) * (h - 3)}
            width={w / values.length - 2}
            height={(v / max) * (h - 3)}
            rx="1"
            fill={color}
            opacity={0.35 + (i / values.length) * 0.65}
          />
        ))
      ) : (
        <>
          <polygon
            points={`0,${h} ${ps.join(" ")} ${w},${h}`}
            fill={`url(#${id})`}
          />
          <polyline
            points={ps.join(" ")}
            fill="none"
            stroke={color}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
export function Modal({
  title,
  kicker,
  close,
  children,
}: {
  title: string;
  kicker: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button, a, select, input, [tabindex="0"]',
          ) || [],
        );
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = "";
      old?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-top">
          <span className="overline red">{kicker}</span>
          <button className="iconbtn" aria-label="Close dialog" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
export function Repo() {
  const [selected, select] = useState(0);
  const entries = [
    [
      "/etl/clean_bundesliga.py",
      "Data preparation",
      "Normalizes team identities, joins match statistics and verifies 306 fixtures and 34 complete matchdays per season.",
    ],
    [
      "/notebooks/01_eda_feature_engineering.ipynb",
      "Exploratory analysis",
      "Audits season coverage, examines team-level distributions and inspects lagged rolling-window features.",
    ],
    [
      "/notebooks/02_dixon_coles_xgboost_cv.ipynb",
      "Validation notebook",
      "Inspects chronological fold boundaries, measured scoring rules and observed reliability bins.",
    ],
    [
      "/models/ensemble_pipeline.py",
      "Model training",
      "Fits the Dixon–Coles and XGBoost components, resamples matchday blocks and exports calibrated forecasts.",
    ],
    [
      "/frontend/",
      "Interactive workspace",
      "Implementation guide for the existing React / Vite interface, score distributions and local SHAP explanations.",
    ],
  ];
  return (
    <>
      <p className="muted">
        An open analytical workspace. Explore the data pipeline and download the
        reproducible project sources.
      </p>
      <div className="repo-tree">
        <div>
          <GitBranch size={16} /> {repositoryPath}
        </div>
        {entries.map(([path], i) => (
          <button
            key={path}
            className="repo-file"
            aria-pressed={i === selected}
            onClick={() => select(i)}
          >
            <FileCode2 size={14} />
            {path}
          </button>
        ))}
        <section className="file-preview" aria-live="polite">
          <b>{entries[selected][1]}</b>
          <p>{entries[selected][2]}</p>
        </section>
        <code style={{ overflowWrap: "anywhere" }}>{`git clone ${repositoryUrl}.git`}</code>
      </div>
      <div className="repo-stack" aria-label="Technology stack">
        {[
          "Python",
          "Pandas",
          "XGBoost",
          "Supabase",
          "React",
          "TypeScript",
          "Chart.js",
          "Vite",
        ].map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="repo-links">
        <a
          className="primary-btn"
          href={repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          <GitBranch size={15} />
          Open GitHub repository
          <ArrowUpRight size={14} />
        </a>
        <a className="button" href="/downloads/bundeslens-source.zip" download>
          <Braces size={16} />
          Download source archive
          <ArrowUpRight size={15} />
        </a>
      </div>
    </>
  );
}
export function Pipeline() {
  return (
    <div className="pipeline">
      {[
        [
          Database,
          "01",
          "Raw CSV Ingestion",
          "Football-Data · FBref · Understat",
        ],
        [
          Workflow,
          "02",
          "Pandas Schema & Team Name Normalization",
          "Canonical club IDs · fixture joins",
        ],
        [
          Layers3,
          "03",
          "Rolling Window Feature Engineering",
          "Prior-five xG · PPDA · fatigue",
        ],
        [
          Activity,
          "04",
          "Expanding-Window Time-Series CV",
          "34 chronological matchday holdouts",
        ],
        [
          Server,
          "05",
          "Calibrated Ensemble & FastAPI/JSON Export",
          "Serving path: FastAPI · Precomputed Static JSON",
        ],
      ].map(([Icon, n, name, desc]) => {
        const I = Icon as typeof Database;
        return (
          <div className="pipeline-step" key={String(n)}>
            <span className="step-n">{String(n)}</span>
            <I size={22} />
            <strong>{String(name)}</strong>
            <small>{String(desc)}</small>
          </div>
        );
      })}
    </div>
  );
}
export function CopyFeedback({
  label = "Export CSV",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  const [done, set] = useState(false);
  return (
    <button
      className="button"
      onClick={() => {
        onClick();
        set(true);
        setTimeout(() => set(false), 1800);
      }}
    >
      {done ? <Check size={14} /> : <Database size={14} />}{" "}
      {done ? "Exported" : label}
    </button>
  );
}
