import { createContext } from "react";
import type { ChartConfiguration } from "chart.js";
import { merge } from "chart.js/helpers";
export const ChartTheme = createContext("dark");
export function chartPalette(theme: string) {
  return theme === "light"
    ? {
        text: "#26364a",
        ticks: "#435469",
        grid: "rgba(71,85,105,.19)",
        edge: "#a4afbd",
        tip: "#ffffff",
        ink: "#172331",
        accent: "#176a57",
      }
    : {
        text: "#dbe4ef",
        ticks: "#a9b7c9",
        grid: "rgba(148,163,184,.16)",
        edge: "#475569",
        tip: "#202c3c",
        ink: "#edf3fa",
        accent: "#83bda9",
      };
}
export function themedConfig(
  config: ChartConfiguration,
  theme: string,
): ChartConfiguration {
  const p = chartPalette(theme),
    scales = Object.fromEntries(
      Object.keys(config.options?.scales ?? {}).map((k) => [
        k,
        {
          ticks: { color: p.ticks },
          grid: { color: p.grid },
          border: { color: p.edge },
          title: { color: p.text },
          ...(k === "r"
            ? { angleLines: { color: p.grid }, pointLabels: { color: p.text } }
            : {}),
        },
      ]),
    );
  const options: NonNullable<ChartConfiguration['options']> = {};
  merge(options, [
    config.options ?? {},
    {
      responsive: true,
      maintainAspectRatio: false,
      color: p.text,
      borderColor: p.edge,
      scales,
      plugins: {
        legend: { labels: { color: p.text } },
        title: { color: p.text },
        subtitle: { color: p.ticks },
        tooltip: {
          backgroundColor: p.tip,
          borderColor: p.edge,
          borderWidth: 1,
          titleColor: p.ink,
          bodyColor: p.text,
          footerColor: p.ticks,
        },
      },
    },
  ]);
  return { ...config, options };
}
