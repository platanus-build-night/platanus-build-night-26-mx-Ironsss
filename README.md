# RehabMotion

<img src="./project-logo.png" alt="RehabMotion Logo" width="200" />

Biomechanical analysis of therapeutic exercises using computer vision. **100% client-side** — no servers, no API keys, everything runs in the browser.

Hacker: **David Alexis Garcia Espinosa** ([@Ironsss](https://github.com/Ironsss))

---

## What it does

Upload a video of a **bicep curl** and get:

- **8 clinical metrics** with automatic evaluation
- **Rep detection** via elbow angle analysis
- **Interactive charts** — time series and per-rep breakdown
- **Radar profile** of movement quality
- **Session history** (localStorage + demo mode)

## Clinical Metrics

| Metric | What it measures | Clinical use |
|--------|-----------------|-------------|
| ROM | Elbow range of motion | Joint recovery |
| Angular Velocity | Neuromuscular control | Spasticity, power |
| TUT | Time under tension | Exercise dosage |
| C:E Ratio | Concentric vs eccentric tempo | Tendinopathies |
| Fatigue Index | ROM degradation across the set | Load prescription |
| Trunk Compensation | Torso lean angle | Technique, excessive load |
| CV (Consistency) | Variability between reps | Motor control |
| Hold Time | Pause at peak contraction | Isometric strength |

Full documentation with formulas and references: [`docs/CLINICAL_METRICS.md`](docs/CLINICAL_METRICS.md)

## Stack

- **React 18** + **Vite 5** — fast builds, instant HMR
- **MediaPipe Pose Landmarker** (WASM) — 33 landmarks, runs on browser GPU
- **Recharts** — interactive, responsive charts
- **Tailwind CSS** (CDN) — responsive out of the box
- **localStorage** — session history without a backend

## Quick Start

```bash
git clone https://github.com/platanus-build-night/platanus-build-night-26-mx-Ironsss.git
cd platanus-build-night-26-mx-Ironsss
npm install
npm run dev
```

Open `http://localhost:5173/rehab-motion/` in your browser.

## Deploy to GitHub Pages

1. Go to **Settings > Pages > Source** and select **GitHub Actions**
2. Push to `main` — the workflow in `.github/workflows/deploy.yml` handles the rest
3. Your app will be at `https://platanus-build-night.github.io/platanus-build-night-26-mx-Ironsss/`

## Architecture

```
src/
├── main.jsx              # Entry point
├── App.jsx               # Main app with all views
├── index.css             # Global styles
├── analysis/
│   └── engine.js         # Analysis engine: MediaPipe + angles + reps + metrics
└── data/
    └── demoHistory.js    # Demo data: 6-week progression
```

## Tips for recording videos

- Film from the **side** (lateral view) for best detection
- Good **lighting** — avoid backlight
- The active arm should be **fully visible**
- **15-30 seconds** is enough for 8-12 reps
- Use a tripod or prop your phone for stability
