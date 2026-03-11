# arkynate-bottlenecker — AI Development Guide

## What It Is

React + Vite SPA — interactive architecture load simulator. Uses `@xyflow/react` for node-graph canvas and Zustand for state. No backend required.

---

## Commands

```bash
pnpm install
pnpm dev        # localhost:5173
pnpm build      # dist/
pnpm deploy     # S3 + CloudFront invalidation (set CF_DISTRIBUTION_ID first)
```

---

## Key Libraries

| Library | Purpose |
|---|---|
| `@xyflow/react` | Node-graph canvas (services, edges, traffic flows) |
| `zustand` | Global state (node configs, simulation state) |
| `recharts` | Throughput/latency charts |

---

## Architecture Patterns

- **Nodes** represent services (API, DB, cache, queue); **edges** represent traffic flows with configurable RPS + latency.
- Simulation runs entirely client-side — no backend required.
- State is serializable JSON — persist to `localStorage` for session restore.
- Wrap the root app with `ReactFlowProvider` — required for any hook that calls `useReactFlow()`.

---

## Deploy

S3 bucket + CloudFront distribution.

```bash
pnpm build
pnpm deploy   # requires CF_DISTRIBUTION_ID env var
```

---

## Known Errors & Fixes

- **`useReactFlow must be used inside ReactFlow`**: `@xyflow/react` requires an explicit `ReactFlowProvider` wrapper around any component that calls `useReactFlow()`. Wrap the root layout or the canvas component.
- **CloudFront cache not clearing after deploy**: CloudFront invalidation is async — allow 2–3 minutes for the cache to clear. The deploy script should trigger an invalidation (`/*`) automatically; verify it ran with `aws cloudfront list-invalidations`.
