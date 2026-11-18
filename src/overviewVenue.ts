import type { Row } from "./data";

// Both canvas sizes consume the same venue-filtered standings and axis labels.
export function overviewVenue(rows: Row[], venue: string, days: number[]) {
  const label =
    venue === "home" ? "Home only" : venue === "away" ? "Away only" : "Overall";
  const appearances = rows.reduce((sum, r) => sum + r.mp, 0);
  const average = {
    x: rows.reduce((sum, r) => sum + r.xg, 0) / Math.max(1, appearances),
    y: rows.reduce((sum, r) => sum + r.xga, 0) / Math.max(1, appearances),
  };
  const contenders = rows.slice(0, 4);
  const labels =
    venue === "all"
      ? days.map((d) => `MD ${d}`)
      : Array.from(
          { length: Math.max(0, ...contenders.map((r) => r.mp)) },
          (_, i) => `${venue === "home" ? "Home" : "Away"} fixture ${i + 1}`,
        );
  // The footer measures league-match equivalents (one match = two team appearances).
  // For one venue, each fixture contributes only its selected side to the analysis.
  return { label, average, contenders, labels, matchCount: appearances / 2 };
}
