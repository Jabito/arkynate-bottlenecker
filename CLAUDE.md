# arkynate-bottlenecker — AI Development Guide

## What It Is

React 19 + Vite + TypeScript SPA — interactive architecture load simulator. `@xyflow/react` canvas, Zustand state, Tailwind 4. No backend: the simulation runs client-side; the only network calls are anonymous Supabase event counts (`src/lib/analytics.ts`) and Google AdSense.

## Commands (npm — the repo has package-lock.json; Node from `.nvmrc`)

```bash
npm install
npm run dev        # localhost:5173
npm run build      # tsc -b + vite build → dist/
npm run lint       # eslint
npm run typecheck  # tsc -b
npm test           # vitest run
```

## Where Things Are

| Path | What |
|---|---|
| `src/engine/` | Simulation (`analyze.ts` fixed-point solver, `capacity.ts`, `allocation.ts`, `format.ts` thresholds/formatters, `limits.ts` field ranges) + `*.test.ts` |
| `src/store/diagramStore.ts` | Canvas state, undo, persistence (`bottlenecker-diagrams`), auto-analysis, import/export/share |
| `src/lib/` | Analytics, share-link codec (URL `#fragment`), diagram validation, image export |
| `src/nodes/`, `src/components/` | Node cards, palette, config panel, analysis bar, navbar |
| `src/pages/` | Home, Components, Lessons, Playground, Privacy |
| `src/data/` | Templates, lessons, node defaults |
| `src/index.css` | Theme tokens (`--bg-*`, `--text-*`, `--st-*`, `--edge-*`) for Dark / `body.theme-light` / `body.theme-matrix` |

## Conventions

- Colours come from the tokens in `src/index.css` — no hex for text, surfaces, borders, status or edges in components. Themes apply on `/playground` only (Navbar calls `applyTheme`).
- Read the store with selectors (`useDiagramStore(s => s.x)` or `useShallow`), never the whole store.
- Engine-computed node fields are listed in `COMPUTED_NODE_KEYS` (`src/types`) and stripped on save/export/share.
- Wrap anything that calls `useReactFlow()` in `ReactFlowProvider` (PlaygroundPage does).

## Ads (Google AdSense)

- Publisher `ca-pub-4792941984956312`. AdSense approves the root domain `arkynate.com`, which covers this subdomain. `ads.txt` lives on both `arkynate.com` (repo `arkynate-labs-web`, with a `subdomain=` line) and here in `public/ads.txt`.
- `src/components/AdBanner.tsx`: slots are **fixed-size** (`AD_SIZES`) and collapse with `height: 0` until Google reports them filled. Never hide a slot with `display: none`, because AdSense then measures width 0 and never requests an ad (that's why no ads served between 2026-03-17 and 2026-10-03). Never use responsive units (`data-ad-format`, `data-full-width-responsive`) inside the playground, because they rewrite parent heights with `height: auto !important` and break the full-height layout.
- Filled slots show an "Advertisement" label (`.bn-ad-label`).
- **Playground ads are OFF during AdSense review** (`PLAYGROUND_ADS_ENABLED = false` in `AdBanner.tsx`). A tool screen with little text and three ads risks the "ads on screens without publisher content" policy. Once AdSense shows `arkynate.com` as **Ready**, re-enable them:
  1. Set `PLAYGROUND_ADS_ENABLED = true`. That restores the palette slot (`6844543977`), the config-panel slot (`5483690415`) and the band under the canvas (`1205058699`, 728×90; the band takes 116 px only once filled).
  2. Check `/playground` at 1100 and 1440 px: canvas full height, no page scroll, ads clear of the palette items and config inputs (16 px gap plus label).
  3. In AdSense → Auto ads, exclude `/playground` so anchor and vignette ads never cover the canvas.
  4. Bump the patch version and deploy. Then confirm on live that each slot's `data-ad-status` becomes `filled` or `unfilled`, never `null`.
- Content pages (Home, Lessons, Components) keep their 300×250 slots at all times.

## Deploy

S3 + CloudFront via GitHub Actions: `ci.yml` (lint, typecheck, test, build) gates `deploy.yml`, which runs `deploy.sh --skip-build`. Manual: `S3_BUCKET=… CF_DISTRIBUTION_ID=… ./deploy.sh`. Never deploy from an agent session.

## SEO

`softwareVersion`/`dateModified` in `index.html` JSON-LD and `sitemap.xml` `lastmod` are stamped at build time by the plugin in `vite.config.ts` — bump `package.json` version per release; no manual date edits. The Navbar sets per-route canonical/og:url. `public/banner.png` is the og/twitter image.

## Known Errors & Fixes

- **`useReactFlow must be used inside ReactFlow`**: wrap the component in `ReactFlowProvider`.
- **CloudFront cache not clearing after deploy**: invalidation is async — allow 2–3 minutes; check with `aws cloudfront list-invalidations`.
- **xyflow controls/minimap look unthemed**: theme them through the `--xy-*` variables on `.react-flow` in `index.css`, not by overriding its classes (its stylesheet loads after ours).
