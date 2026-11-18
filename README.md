# BundesLens
A public, authentication-free Bundesliga research workspace built in React, TypeScript, Chart.js and Vite. A Vercel read-only API serves versioned Supabase Postgres snapshots. An identical local snapshot keeps the analysis available during service interruptions.

## Run
`npm install` and `npm run build`. Use `npm run dev` for local development. Local Vite uses the bundled data archive when Vercel functions are not present.

## Rebuild the archive
Install `analysis/requirements.txt`, then run `python etl/clean_bundesliga.py` and `OPENBLAS_NUM_THREADS=1 python models/ensemble_pipeline.py` from the repository root. `python analysis/package_sources.py` regenerates the same downloadable project archive. Optional database publication uses `node --env-file=.env analysis/publish.mjs` with server-side credentials and pre-created season rows. Never expose a service key in a web bundle.

## Data
- Football-Data.co.uk: observed historical results and match shooting statistics, 2021/22–2025/26. All five seasons have 18 clubs, 306 fixtures and 34 complete matchdays.
- OpenLigaDB: recorded matchday assignments and goal events.
- Understat match archive: European Football Leagues Match Statistics Dataset, compiled by Fahrisyaifullah on Kaggle. Historical xG, non-penalty xG, expected points, and PPDA.
- FBref season player archives: hubertsidorowicz, Football Players Stats 2024/2025, and mamounkabbaj, 2023/2024 Big 5 European Soccer Player Statistics (Kaggle). Observed goals, xG, xA, minutes, progressive passes, shot creation, and recoveries.
- 2025/26 scouting: chuongtrinh, Top 5 League Individual Stats; hiuhiuthen, Understat Player League 2025–26. Earlier seasons use the archived Understat player aggregates. Missing advanced player measures are labeled as proxies.
- Team crests: ESPN, property of their respective clubs. Player portrait: FotMob. Stadium photograph: ShotsBy Csongii / Pexels.

## Machine learning
`models/ensemble_pipeline.py` fits a Dixon–Coles joint likelihood (rho = −0.11) and paired XGBoost goal regressors. The archived report retains its original 50:50 experiment, with 34 forward-only test rounds and 306 held-out forecasts per season. Run `OPENBLAS_NUM_THREADS=1 python models/calibrate_predictor_stack.py` after that pipeline to regenerate the simulator’s 55:45 blend calibration, including all 120 matchday-block bootstrap temperatures. These fixed weights are not inferred optimal weights; temperature minimizes held-out RPS. Venue changes the log goal rates separately from intrinsic Elo. The six-input SHAP decomposition evaluates 64 coalitions against 12 neutral-venue profiles, exponentially reweighted to the requested 39.3% reference. It describes the model, not a causal estimate. Display rounding preserves the visible additive identity.

## Public API / schema
`GET /api/seasons?year=2024` returns a complete season snapshot. Table `bundeslens_seasons`: year (text primary key), label, payload (jsonb), updated_at. No public write routes, accounts, or session cookies.

## View scope
Club tables, goal-leader cards, matchday charts, team splits and the match simulator respond to the matchday slicer. Scouting profiles are season-level observations rather than invented per-fixture allocations. Rest days exclude cup fixtures and injuries; explanations are associative, not causal. There is no authentication, paywall, or account menu.

Developed by Swaraj Deshmukh · Data Analytics & Machine Learning Portfolio. Repository: https://github.com/swaraj710-jpeg/bundeslens.
