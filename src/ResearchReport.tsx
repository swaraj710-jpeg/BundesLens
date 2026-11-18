import { useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  FlaskConical,
  ShieldCheck,
  ChevronDown,
  ArrowDownToLine,
} from "lucide-react";
import { Canvas, PanelTitle, Metric } from "./ui";
import { provenance } from "./reportContext";
import { csv, seasonLabel, type Season } from "./data";
const benchmarks = [
  ["Baseline: Dynamic Elo Rating", "0.209", "1.018", "0.604"],
  ["+ Rolling 5-Match xG & xGA Features", "0.194", "0.971", "0.568"],
  ["+ PPDA Pressing & Rest-Day Fatigue Features", "0.189", "0.955", "0.553"],
  [
    "Final: Dixon-Coles + XGBoost Calibrated Ensemble",
    "0.184",
    "0.942",
    "0.541",
  ],
];
export function ResearchReport({ data }: { data: Season }) {
  const [expanded, setExpanded] = useState(false),
    r = data.research;
  return (
    <>
      <section className="panel leakage">
        <PanelTitle
          title="Temporal leakage prevention"
          icon={<ShieldCheck size={18} />}
          sub="Expanding-window time-series cross-validation"
        />
        <div className="research-copy">
          <p>
            Random K-Fold mixes past and future fixtures: a model can learn a
            club’s later form before forecasting its earlier matches. Here,
            matchday <code>t</code> is never used to train its own forecast.
          </p>
          <div className="temporal-strip">
            <span>01 · Fit on prior matchdays</span>
            <i>→</i>
            <span>02 · Calibrate on the latest prior block</span>
            <i>→</i>
            <b>03 · Evaluate MD t</b>
          </div>
          <p>
            Each of the 34 test rounds expands the training history using only
            matchdays 1 … t−1 and earlier seasons. Results after the round’s
            first kickoff date are excluded, including postponed fixtures.
            Rolling features, Elo, preprocessing and calibration use prior
            information only.
          </p>
          <button
            className="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide" : "Inspect"} fold boundaries{" "}
            <ChevronDown size={13} />
          </button>
          {expanded && (
            <div className="table-scroll fold-report">
              <table>
                <thead>
                  <tr>
                    {[
                      "Test MD",
                      "Cutoff (exclusive)",
                      "Training",
                      "Calibration",
                      "Held out",
                    ].map((s) => (
                      <th key={s}>{s}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.folds.map((f) => (
                    <tr key={f.md}>
                      <td>{f.md}</td>
                      <td>{f.cutoff}</td>
                      <td>{f.train}</td>
                      <td>{f.calibrate}</td>
                      <td>{f.test}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      <section className="panel">
        <PanelTitle
          title="Model ablation & validation benchmarks"
          icon={<FlaskConical size={18} />}
          sub="Reference experiment ladder · lower scores are better"
        />
        <div className="table-scroll">
          <table className="ablation">
            <thead>
              <tr>
                {[
                  "Experiment",
                  "RPS",
                  "Multi-class log-loss",
                  "Brier score",
                ].map((s) => (
                  <th key={s}>
                    <Metric
                      name={s === "Multi-class log-loss" ? "Log-Loss" : s}
                    >
                      {s}
                    </Metric>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benchmarks.map((row) => (
                <tr key={row[0]}>
                  {row.map((s, i) => (
                    <td key={i}>{s}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="chart-note">
          Supplied reference benchmarks, not measured results from this run. The
          season’s independently measured scores appear above.
        </div>
      </section>
      <section className="panel">
        <PanelTitle
          title="Probability calibration"
          sub={`Reliability diagram · ${seasonLabel(data.year)} · ${r.heldout} held-out home-win predictions`}
          icon={<ChartNoAxesCombined size={17} />}
          action={
            <button
              className="button"
              onClick={() =>
                csv(
                  `BundesLens-calibration-${data.year}`,
                  [
                    [
                      "Mean predicted home win",
                      "Observed home win frequency",
                      "Fixtures",
                    ],
                    ...r.bins.map((b) => [b.x, b.y, b.n]),
                  ],
                  {
                    ...provenance(data, "Probability calibration"),
                    Scope: "Full-season temporal validation · MD 1–34",
                    "Held-out fixtures": r.heldout,
                    Model: "Archived 50:50 ensemble",
                    "Bin width": 0.1,
                  },
                )
              }
            >
              <ArrowDownToLine size={13} />
              CSV
            </button>
          }
        />
        <div className="legend">
          <span>
            <i style={{ background: "#06B6D4" }} />
            Observed home wins
          </span>
          <span>
            <i style={{ height: 0, borderTop: "1px dashed #8191a8" }} />
            Perfect calibration
          </span>
        </div>
        <Canvas
          label="Held-out home-win reliability diagram against the ideal diagonal"
          height={265}
          config={{
            type: "line",
            data: {
              datasets: [
                {
                  label: "Observed home wins",
                  data: r.bins.map(({ x, y }) => ({ x, y })),
                  borderColor: "#06B6D4",
                  backgroundColor: "#06B6D4",
                  pointRadius: 4,
                  pointStyle: "circle",
                  pointHoverRadius: 6,
                  pointHitRadius: 10,
                  showLine: true,
                  tension: 0,
                  borderWidth: 2,
                },
                {
                  label: "Perfect calibration",
                  data: [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ],
                  borderColor: "#8191a8",
                  borderDash: [5, 5],
                  pointRadius: 0,
                  pointHoverRadius: 0,
                  order: 1,
                  borderWidth: 1,
                },
              ],
            },
            options: {
              animation: false,
              responsive: true,
              maintainAspectRatio: false,
              parsing: false,
              interaction: { mode: "nearest", axis: "xy", intersect: true },
              plugins: {
                tooltip: {
                  filter: (item) => item.datasetIndex === 0,
                  displayColors: false,
                  callbacks: {
                    title: (items) => {
                      if (!items.length) return "";
                      const decile = Math.min(
                        9,
                        Math.floor(10 * r.bins[items[0].dataIndex].x),
                      );
                      return `Predicted bin: ${(decile / 10).toFixed(1)}–${((decile + 1) / 10).toFixed(1)}`;
                    },
                    label: (c) =>
                      `Observed win rate: ${(100 * r.bins[c.dataIndex].y).toFixed(1)}%`,
                    afterLabel: (c) =>
                      `Sample size: ${r.bins[c.dataIndex].n} fixtures`,
                  },
                },
              },
              scales: {
                x: {
                  type: "linear",
                  min: 0,
                  max: 1,
                  ticks: { stepSize: 0.1, maxRotation: 0 },
                  grid: { color: "rgba(148,163,184,.12)" },
                  title: { display: true, text: "Mean Predicted Probability" },
                },
                y: {
                  type: "linear",
                  min: 0,
                  max: 1,
                  ticks: { stepSize: 0.2 },
                  grid: { color: "rgba(148,163,184,.12)" },
                  title: {
                    display: true,
                    text: "Observed Empirical Win Frequency",
                  },
                },
              },
            },
          }}
        />
        <div className="chart-note">
          Ten equal-width probability bins; empty bins are omitted. Hover a
          point for its sample size. Small bins have higher sampling
          uncertainty.
        </div>
      </section>
      <section className="panel">
        <PanelTitle
          title="Theoretical Foundations"
          icon={<BookOpen size={17} />}
          sub="Statistical football forecasting & proper scoring rules"
        />
        <div className="citations">
          <p>
            <b>01</b>
            <span>
              Dixon, M. J., & Coles, S. G. (1997). “Modelling Association
              Football Scores and Inefficiencies in the Football Betting
              Market.”{" "}
              <em>
                Journal of the Royal Statistical Society: Series C (Applied
                Statistics)
              </em>
              , 46(2), 265–280.
            </span>
          </p>
          <p>
            <b>02</b>
            <span>
              Constantinou, A. C., & Fenton, N. E. (2012). “Solving the Problem
              of Inadequate Scoring Rules for Assessing Probabilistic Football
              Forecast Models.”{" "}
              <em>Journal of Quantitative Analysis in Sports</em>, 8(1).
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
