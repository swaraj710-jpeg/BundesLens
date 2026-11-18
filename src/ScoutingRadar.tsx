import { useMemo } from "react";
import type { ChartConfiguration } from "chart.js";
import { Canvas } from "./ui";
import { axes, f, type Player } from "./data";

export type ScoutingProfile = {
  player: Player;
  ranks: number[];
  rates: number[];
};
export function ScoutingRadar({ profiles }: { profiles: ScoutingProfile[] }) {
  const config = useMemo<ChartConfiguration>(
    () => ({
      type: "radar",
      data: {
        labels: axes,
        datasets: profiles.map(({ player, ranks }, i) => ({
          label: player.name,
          data: ranks,
          fill: true,
          backgroundColor: i ? "#06B6D428" : "#D2051533",
          borderColor: i ? "#06B6D4" : "#D20515",
          pointBackgroundColor: i ? "#06B6D4" : "#D20515",
          pointBorderColor: i ? "#06B6D4" : "#D20515",
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          pointHitRadius: 10,
        })),
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 3, bottom: 8, left: 3 } },
        interaction: { mode: "index", axis: "xy", intersect: false },
        plugins: {
          tooltip: {
            callbacks: {
              title: (items) => axes[items[0].dataIndex],
              label: (ctx) => {
                const { player, ranks, rates } = profiles[ctx.datasetIndex];
                const j = ctx.dataIndex;
                const estimated =
                  (j === 3 && player.prog == null) ||
                  (j === 4 && player.sca == null) ||
                  (j === 5 && player.rec == null);
                return `${player.name}: P${ranks[j]} · ${f(rates[j], 3)} / 90${estimated ? " (proxy)" : ""}`;
              },
            },
          },
        },
        scales: {
          r: {
            type: "radialLinear",
            min: 0,
            max: 100,
            beginAtZero: true,
            ticks: {
              stepSize: 20,
              display: true,
              showLabelBackdrop: false,
              color: "#91a0b2",
              font: { size: 8 },
              callback: (v) => (Number(v) === 0 ? "" : v),
            },
            grid: { color: "rgba(148,163,184,.25)", lineWidth: 1 },
            angleLines: { color: "rgba(148,163,184,.22)" },
            pointLabels: {
              display: true,
              color: "#91a0b2",
              font: { size: 10 },
              padding: 6,
              callback: (_s, i) =>
                i === 3
                  ? ["Progressive", "passes/90"]
                  : i === 4
                    ? ["Shot", "creation/90"]
                    : axes[i],
            },
          },
        },
      },
    }),
    [profiles],
  );
  return (
    <Canvas
      config={config}
      label={`Six-axis positional percentile radar: ${profiles[0].player.name} versus ${profiles[1].player.name}. Raw rates and ranks follow in Positional percentiles.`}
      height={260}
    />
  );
}
