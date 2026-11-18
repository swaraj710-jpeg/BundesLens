import { useMemo } from "react";
import type { ChartConfiguration, Plugin } from "chart.js";
import { Canvas, chartScales } from "./ui";
import { f, signed, type Row } from "./data";
import { chartPalette } from "./chartTheme";

type Rect = { x: number; y: number; w: number; h: number };
const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w + 1 &&
  a.x + a.w + 1 > b.x &&
  a.y < b.y + b.h + 1 &&
  a.y + a.h + 1 > b.y;
const raceColors = ["#f05263", "#28beca", "#efbb53", "#a88ae5"];
const dotColors = [
  "#ed5367",
  "#29bfd0",
  "#ffbf53",
  "#d5d94d",
  "#b38be9",
  "#71bca9",
];
const crosshair: Plugin = {
  id: "expandedMatchdayCursor",
  beforeDatasetsDraw(chart) {
    const active = chart.getActiveElements()[0];
    if (!active) return;
    const { ctx, chartArea: a } = chart,
      x = active.element.x;
    ctx.save();
    ctx.strokeStyle = chartPalette(
      document.documentElement.dataset.theme ?? "dark",
    ).ticks;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, a.top);
    ctx.lineTo(x, a.bottom);
    ctx.stroke();
    ctx.restore();
  },
};
function scatterAnnotations(
  rows: Row[],
  average: { x: number; y: number },
  theme: string,
): Plugin {
  return {
    id: "expandedClubAnnotations",
    beforeDatasetsDraw(chart) {
      const { ctx, chartArea: a, scales } = chart,
        x = scales.x.getPixelForValue(average.x),
        y = scales.y.getPixelForValue(average.y);
      ctx.save();
      ctx.fillStyle = "rgba(16,185,129,.055)";
      ctx.fillRect(x, a.top, a.right - x, y - a.top);
      ctx.fillStyle = "rgba(210,5,21,.035)";
      ctx.fillRect(a.left, y, x - a.left, a.bottom - y);
      ctx.strokeStyle = chartPalette(theme).edge;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(x, a.top);
      ctx.lineTo(x, a.bottom);
      ctx.moveTo(a.left, y);
      ctx.lineTo(a.right, y);
      ctx.stroke();
      ctx.restore();
    },
    afterDatasetsDraw(chart) {
      const { ctx, chartArea: a } = chart,
        points = chart.getDatasetMeta(0).data;
      const blocked: Rect[] = points.map((p) => ({
        x: p.x - 6,
        y: p.y - 6,
        w: 12,
        h: 12,
      }));
      ctx.save();
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.font = '9px "IBM Plex Mono", monospace';
      for (const [label, right, bottom] of [
        ["DEFENSIVE", false, false],
        ["ELITE BALANCE", true, false],
        ["STRUGGLING", false, true],
        ["HIGH-EVENT ATTACK", true, true],
      ] as const) {
        const w = ctx.measureText(label).width,
          x = right ? a.right - w - 5 : a.left + 5,
          y = bottom ? a.bottom - 9 : a.top + 9;
        ctx.fillStyle =
          label === "ELITE BALANCE"
            ? chartPalette(theme).accent
            : chartPalette(theme).ticks;
        ctx.fillText(label, x, y);
        blocked.push({ x: x - 3, y: y - 7, w: w + 6, h: 14 });
      }
      ctx.font = '10px "IBM Plex Mono", monospace';
      const text = theme === "dark" ? "#d4dde7" : "#26394a";
      // Search the chart's free space, not just eight fixed offsets, so densely
      // clustered clubs retain separate labels even on narrow mobile canvases.
      points.forEach((p, i) => {
        const name = rows[i].short,
          w = Math.ceil(ctx.measureText(name).width) + 6,
          h = 14;
        let best: Rect | undefined,
          distance = Infinity;
        for (let y = a.top + 2; y + h <= a.bottom - 2; y += 4) {
          for (let x = a.left + 2; x + w <= a.right - 2; x += 4) {
            const d = (x + w / 2 - p.x) ** 2 + (y + h / 2 - p.y) ** 2;
            if (d >= distance) continue;
            const box = { x, y, w, h };
            if (!blocked.some((b) => intersects(b, box))) {
              best = box;
              distance = d;
            }
          }
        }
        if (!best) return;
        blocked.push(best);
        const tx = Math.max(best.x, Math.min(best.x + w, p.x)),
          ty = Math.max(best.y, Math.min(best.y + h, p.y));
        ctx.strokeStyle = "#8395a680";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.fillStyle = theme === "dark" ? "#141a24ee" : "#ffffffee";
        ctx.fillRect(best.x, best.y, w, h);
        ctx.fillStyle = text;
        ctx.fillText(name, best.x + 3, best.y + h / 2);
      });
      ctx.restore();
    },
  };
}
export function ExpandedOverviewChart({
  kind,
  rows,
  contenders,
  labels,
  average,
  venueLabel,
  theme,
  scope,
}: {
  kind: string;
  rows: Row[];
  contenders: Row[];
  labels: string[];
  average: { x: number; y: number };
  venueLabel: string;
  theme: string;
  scope: string;
}) {
  const efficiency = kind === "efficiency";
  const config = useMemo<ChartConfiguration>(() => {
    if (!efficiency)
      return {
        type: "line",
        data: {
          labels,
          datasets: contenders.map((r, i) => ({
            label: r.name,
            data: [...r.trajectory],
            borderColor: raceColors[i],
            backgroundColor: raceColors[i],
            borderWidth: 2.3,
            pointRadius: 1.7,
            pointHoverRadius: 5,
            tension: 0.2,
          })),
        },
        options: {
          animation: false,
          interaction: { mode: "index", axis: "x", intersect: false },
          scales: {
            ...chartScales(
              venueLabel === "Overall"
                ? "Matchday"
                : `${venueLabel === "Away only" ? "Away" : "Home"} fixture in selected window`,
              "Cumulative points",
            ),
            y: {
              ...chartScales().y,
              beginAtZero: true,
              title: { display: true, text: "Cumulative points" },
            },
          },
          plugins: {
            tooltip: {
              mode: "index",
              intersect: false,
              callbacks: {
                label: (c) => `${c.dataset.label}: ${c.parsed.y} pts`,
              },
            },
          },
        },
        plugins: [crosshair],
      };
    const dots = rows.map((r) => ({ x: r.xg / r.mp, y: r.xga / r.mp }));
    return {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Club efficiency",
            data: dots,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointHitRadius: 6,
            pointBackgroundColor: rows.map(
              (_, i) => dotColors[i % dotColors.length],
            ),
            pointBorderColor: "#111925",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        animation: false,
        parsing: false,
        layout: { padding: { top: 8, right: 8 } },
        interaction: { mode: "nearest", intersect: true },
        scales: {
          x: {
            ...chartScales().x,
            type: "linear",
            grace: "12%",
            title: { display: true, text: "Attacking output · xG / 90 →" },
          },
          y: {
            ...chartScales().y,
            type: "linear",
            reverse: true,
            grace: "12%",
            title: { display: true, text: "xGA / 90 · lower is better" },
          },
        },
        plugins: {
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (items) => `Club: ${rows[items[0].dataIndex].name}`,
              label: (c) => {
                const p = dots[c.dataIndex];
                return [
                  `xG/90: ${f(p.x, 2)}`,
                  `xGA/90: ${f(p.y, 2)}`,
                  `Net xGD/90: ${signed(p.x - p.y, 2)}`,
                ];
              },
            },
          },
        },
      },
      plugins: [scatterAnnotations(rows, average, theme)],
    };
  }, [efficiency, labels, average, venueLabel, contenders, rows, theme]);
  return (
    <div className="expanded-overview">
      <p className="expanded-scope">
        {scope} · <span className="tag">{venueLabel}</span>
      </p>
      {!efficiency && (
        <div className="legend">
          {contenders.map((r, i) => (
            <span key={r.id}>
              <i style={{ background: raceColors[i] }} />
              {r.short}
            </span>
          ))}
        </div>
      )}
      <Canvas
        config={config}
        label={
          efficiency
            ? "Expanded attack vs. defense scatter plot, all 18 clubs"
            : "Expanded title race trajectory, matchday points comparison"
        }
        height={460}
        theme={theme}
      />
      <p className="chart-note">
        {efficiency
          ? "Hover or tap a club dot to inspect its attacking, defensive and net expected goals per 90."
          : "Hover or tap a fixture to compare cumulative points for the four contenders."}
      </p>
    </div>
  );
}
