# BundesLens frontend
The existing Vite workspace stays at repository root. `src/Analysis.tsx` renders the ML Hub, `src/forecast.ts` performs inference, bootstrap interval calculation and five-feature SHAP attribution, and `src/ResearchReport.tsx` renders the temporal validation report. `src/Workspace.tsx` contains the public shell and read-only API client.

From the repository root: `npm install && npm run build`. No credentials are required to explore the bundled historical archive.
