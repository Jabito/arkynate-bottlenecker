# Bottlenecker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)

**Browser-based system architecture load simulator by [Arkynate Labs](https://labs.arkynate.com).**

Model your system with visual nodes, wire them together, simulate traffic, and find bottlenecks. The simulation runs entirely in your browser; your diagrams never leave it.

Live at: **https://bottlenecker.arkynate.com**

---

## Features

- **Visual canvas** — drag-and-drop nodes for load generators, load balancers, servers, databases, caches and queues
- **Load simulation** — a load generator emits QPS that propagates through your architecture; the simulation re-runs on every change
- **Bottleneck detection** — nodes turn yellow (> 70 %), orange (> 90 %) and red (≥ 100 % of capacity); the analysis bar lists results and warnings
- **Overload, errors and retries** — saturated nodes shed what they can't serve, configured error rates and retries amplify upstream load
- **Edge distribution** — split traffic by percentage, absolute QPS, or an even split of what is left
- **Lessons** — real-world bottleneck scenarios you can open on the canvas
- **Save, export, share** — saved diagrams live in browser storage; export JSON/PNG/JPG; share a diagram as a link
- **Themes** — Dark, Light and Matrix on the playground

## Node Types

| Node | Key config |
|------|-----------|
| Load Generator | Output QPS |
| Load Balancer | Max QPS (weight targets with per-edge distribution) |
| Server | Max QPS per instance, instances (capacity = max QPS × instances), error rate, base latency |
| Database | Max read / write QPS, read ratio, read replicas (reads scale with replicas, writes don't) |
| Cache | Hit rate %, max QPS (misses go downstream) |
| Queue | Throughput per consumer, consumers (input above the drain rate becomes backlog) |

## Tech Stack

- React 19 + TypeScript, Vite, Tailwind CSS v4
- [@xyflow/react](https://reactflow.dev) v12 — canvas and node graph
- Zustand — diagram state (persisted to `localStorage`)
- Vitest — engine and state tests

## Getting Started

Requires Node 22 (see `.nvmrc`).

```bash
git clone https://github.com/Jabito/arkynate-bottlenecker.git
cd arkynate-bottlenecker
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). All environment variables are optional; see `.env.example`.

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server on :5173 |
| `npm run build` | Typecheck + production build to `dist/` (stamps version/date into `index.html`, generates `sitemap.xml`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest, run once |
| `npm run preview` | Serve the built `dist/` |

## Deployment

Production is a static site on S3 behind CloudFront. Every pull request runs CI (`.github/workflows/ci.yml`: lint, typecheck, test, build). A push to `main` runs the same checks and then deploys (`.github/workflows/deploy.yml` → `deploy.sh`): hashed `assets/` are cached for a year and kept for 30 days after they leave the build (open tabs can still lazy-load them), root files are cached for an hour, and `index.html` is never cached; then CloudFront is invalidated.

`deploy.sh` can also be run by hand with `S3_BUCKET` and `CF_DISTRIBUTION_ID` set.

## Privacy

No accounts and no diagram data leave the browser. The site counts anonymous events (page views, Analyze clicks, template opens, exports) in Supabase and shows Google AdSense ads; see [/privacy](https://bottlenecker.arkynate.com/privacy).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md). Please do not open public issues for security concerns.

## License

[MIT](LICENSE)

---

Made with love by [Arkynate Labs](https://labs.arkynate.com)
