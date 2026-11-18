import type { Match } from "./data";
import stackCalibration from "./stackCalibration.json";
const leagueReference = 0.393;
const dcWeight = 0.55;
export const architectures = [
  "Calibrated Ensemble (Dixon-Coles + XGBoost)",
  "Dixon-Coles Bivariate Poisson",
  "XGBoost Gradient Boosted Trees",
] as const;
export const featureNames = [
  "Rolling 5-Match xG Differential",
  "PPDA Pressing Intensity Delta",
  "Club Elo Rating Differential",
  "Home Venue Advantage",
  "Squad Rest Days Delta",
  "Non-Penalty xG/Shot",
];
type Fit = { dc: number[][]; trees: number[][][]; temp: number };
export type Research = {
  fit: Fit;
  replicates: Fit[];
  background: number[][];
  elo: Record<string, number>;
  metrics: number[];
  bins: { x: number; y: number; n: number }[];
  samples: number;
  calibration: number;
  heldout: number;
  rho: number;
  folds: {
    md: number;
    cutoff: string;
    train: number;
    calibrate: number;
    test: number;
  }[];
};
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export function vector(
  research: Research,
  matches: Match[],
  history: Match[],
  home: string,
  away: string,
  venue: number,
  form: number,
) {
  const end = matches
    .map((m) => m.date)
    .sort()
    .at(-1)!;
  const cutoff = Date.parse(end) + 7 * 86400000;
  const elo = { ...research.elo };
  for (const m of [...history]
    .filter((m) => m.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    const h = elo[m.h] ?? 1500,
      a = elo[m.a] ?? 1500;
    const d =
      20 *
      ((m.hg > m.ag ? 1 : m.hg === m.ag ? 0.5 : 0) -
        1 / (1 + 10 ** ((a - h - 60) / 400)));
    elo[m.h] = h + d;
    elo[m.a] = a - d;
  }
  const profile = (team: string) => {
    const ms = matches
      .filter((m) => m.h === team || m.a === team)
      .sort((a, b) => a.date.localeCompare(b.date));
    const five = ms.slice(-5);
    const avg = (a: Match[], g: (m: Match) => number) =>
      a.reduce((s, m) => s + g(m), 0) / Math.max(1, a.length);
    const differential = (m: Match) => (m.h === team ? 1 : -1) * (m.hx - m.ax);
    return [
      (avg(five, differential) * form) / 100 +
        avg(ms, differential) * (1 - form / 100),
      avg(five, (m) => (m.h === team ? m.hpp : m.app) ?? 12),
      five.length
        ? Math.min(21, (cutoff - Date.parse(five.at(-1)!.date)) / 86400000)
        : 7,
      five.reduce((s, m) => s + ((m.h === team ? m.hnp : m.anp) ?? 0), 0) /
        Math.max(
          1,
          five.reduce((s, m) => s + (m.h === team ? m.hs : m.as), 0),
        ),
    ];
  };
  const h = profile(home),
    a = profile(away);
  return [
    h[0] - a[0],
    a[1] - h[1],
    ((elo[home] ?? 1500) - (elo[away] ?? 1500)) / 400,
    1.2 * venue,
    h[2] - a[2],
    h[3] - a[3],
  ];
}
function distribution(
  fit: Fit,
  inputs: number[],
  mode: number,
  temperature: number,
) {
  const [form, press, elo, venue, rest, quality] = inputs;
  // The historical fits used a constant +60 Elo coding offset. Restore that
  // encoding without feeding the adjustable venue input into team strength.
  const v = [form, press, elo + 60 / 400, rest, quality];
  // A separate log-rate offset; 60 venue Elo reproduces the fitted rates.
  const venueShift = ((venue - 60) * Math.LN10) / 800;
  const dc = fit.dc.map((b) =>
    Math.exp(clamp(b[0] + v.reduce((s, x, i) => s + x * b[i + 1], 0), -2, 1.7)),
  );
  const tree = fit.trees.map((ts) =>
    clamp(
      ts.reduce((s, [i, t, l, r]) => s + (v[i] < t ? l : r), 1.5),
      0.14,
      5.5,
    ),
  );
  for (const rates of [dc, tree]) {
    rates[0] *= Math.exp(venueShift);
    rates[1] *= Math.exp(-venueShift);
  }
  const mass = (l: number) => {
    const a = [Math.exp(-l)];
    for (let i = 1; i <= 20; i++) a.push((a[i - 1] * l) / i);
    return a;
  };
  const [dh, da, th, ta] = [...dc, ...tree].map(mass);
  const prob = [0, 0, 0],
    scores = new Float64Array(441);
  let total = 0;
  for (let h = 0; h <= 20; h++)
    for (let a = 0; a <= 20; a++) {
      const rho = -0.11,
        tau =
          h === 0 && a === 0
            ? 1 - dc[0] * dc[1] * rho
            : h === 0 && a === 1
              ? 1 + dc[0] * rho
              : h === 1 && a === 0
                ? 1 + dc[1] * rho
                : h === 1 && a === 1
                  ? 1 - rho
                  : 1;
      const d = dh[h] * da[a] * tau,
        t = th[h] * ta[a];
      const p =
        mode === 1 ? d : mode === 2 ? t : dcWeight * d + (1 - dcWeight) * t;
      scores[h * 21 + a] = p;
      prob[h > a ? 0 : h === a ? 1 : 2] += p;
      total += p;
    }
  const scaled = prob.map(
      (p) => (p / total) ** (mode === 0 ? 1 / temperature : 1),
    ),
    sum = scaled.reduce((a, b) => a + b, 0),
    calibrated = scaled.map((p) => p / sum);
  return { scores, prob, calibrated };
}
export function forecast(m: Research, v: number[], mode: number, year: string) {
  const calibration = stackCalibration[year as keyof typeof stackCalibration];
  const { scores, prob, calibrated } = distribution(
    m.fit,
    v,
    mode,
    calibration.temperature,
  );
  let lh = 0,
    la = 0;
  const ranked = Array.from(scores, (p, i) => {
    const h = Math.floor(i / 21),
      a = i % 21,
      k = h > a ? 0 : h === a ? 1 : 2,
      value = (p * calibrated[k]) / prob[k];
    lh += h * value;
    la += a * value;
    return { h, a, p: value };
  }).sort((a, b) => b.p - a.p);
  const reps = m.replicates.map(
    (r, i) =>
      distribution(r, v, mode, calibration.replicateTemperatures[i]).calibrated,
  );
  const ci = [0, 1, 2].map((i) => {
    const a = reps.map((r) => r[i]).sort((a, b) => a - b);
    const quantile = (q: number) => {
      const n = q * (a.length - 1),
        k = Math.floor(n);
      return a[k] + (n - k) * (a[Math.min(k + 1, a.length - 1)] - a[k]);
    };
    return [quantile(0.025), quantile(0.975)];
  });
  // Keep a single reference distribution for all 64 coalitions. Exponential
  // tilting gives the minimum-KL change from uniform weights for the specified
  // reference probability. No residual is distributed over the feature bars.
  const background = m.background.map(
    ([form, press, encodedElo, rest, quality]) => [
      form,
      press,
      encodedElo - 60 / 400,
      0,
      rest,
      quality,
    ],
  );
  const baseP = background.map(
    (b) => distribution(m.fit, b, mode, calibration.temperature).calibrated[0],
  );
  const weightsAt = (tilt: number) => {
    const logits = baseP.map((p) => tilt * p),
      mx = Math.max(...logits);
    const w = logits.map((l) => Math.exp(l - mx)),
      z = w.reduce((s, n) => s + n, 0);
    return w.map((n) => n / z);
  };
  let lo = -4096,
    hi = 4096;
  for (let i = 0; i < 64; i++) {
    const mid = (lo + hi) / 2;
    const mean = weightsAt(mid).reduce((s, w, j) => s + w * baseP[j], 0);
    if (mean < leagueReference) lo = mid;
    else hi = mid;
  }
  const weights = weightsAt((lo + hi) / 2);
  const worth = Array.from({ length: 64 }, (_, mask) =>
    background.reduce(
      (s, b, j) =>
        s +
        weights[j] *
          distribution(
            m.fit,
            v.map((x, i) => (mask & (1 << i) ? x : b[i])),
            mode,
            calibration.temperature,
          ).calibrated[0],
      0,
    ),
  );
  const fac = [1, 1, 2, 6, 24, 120, 720];
  const drivers = v.map((_, i) => {
    let sum = 0;
    for (let mask = 0; mask < 64; mask++)
      if (!(mask & (1 << i))) {
        const k = mask.toString(2).replaceAll("0", "").length;
        sum +=
          ((fac[k] * fac[5 - k]) / 720) *
          (worth[mask | (1 << i)] - worth[mask]);
      }
    return sum * 100;
  });
  return {
    scores: ranked,
    calibrated,
    ci,
    drivers,
    lh,
    la,
    baseline: worth[0],
  };
}
