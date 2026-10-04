# Build-prerender handoff (2026-10-05)

**Builder:** build-prerender (Opus). **Finding:** B1 in `../2026-10-05-adsense-readiness.md`: every route served an 8-word SPA shell.
**Commits on `main`, not pushed:** `c6e1bfc` (prerender), `856b217` (deploy.sh + CLAUDE.md), then this file. Version not bumped.

## Result

The raw HTML now contains the page content and that route's own head. Counts are words after stripping scripts, styles, comments and tags. Both counting methods (the one in `scripts/prerender.mjs` and a separate Python one) agree to within 4 words.

| Route | File | Before (raw) | Rendered (audit) | After (raw) | After ÷ rendered |
|---|---|---|---|---|---|
| `/` | `dist/index.html` | 8 | 310 | **307** | 99% |
| `/lessons` | `dist/lessons/index.html` | 8 | 1,681 | **1,835** | 109% |
| `/components` | `dist/components/index.html` | 8 | 1,069 | **1,137** | 106% |
| `/privacy` | `dist/privacy/index.html` | 8 | 421 | **489** | 116% |
| `/playground` | `dist/playground/index.html` | 8 | 39 | 23 (shell) | n/a |

Some routes count above 100%. That is because the raw HTML includes text a rendered `innerText` count leaves out, such as the head title, and because Privacy grew in `5b343e0`.

Each file has its own `<title>`, meta description, canonical, `og:url`, `og:title`, `og:description`, `twitter:title` and `twitter:description`. The 3 JSON-LD blocks, the `google-adsense-account` meta and `adsbygoogle.js` from `index.html` are unchanged. The 300×250 `<ins>` slots are in the markup but are only pushed in an effect, so the server never pushes.

## What changed

- **Build:** `npm run build` = `tsc -b && vite build && vite build --ssr src/entry-server.tsx --outDir dist-server && node scripts/prerender.mjs`. This follows `arkynate-labs-web`: SSR `renderToString` plus template injection, no Puppeteer and no new dependencies. `dist-server/` is deleted after the prerender and is also gitignored and lint-ignored. CI needs no workflow change, because `ci.yml` and `deploy.yml` already run `npm run build`.
- **One source for head metadata:** `src/lib/routeMeta.ts` (`ROUTE_META`, `headTags`, `applyRouteHead`). The prerender bakes the tags in through `src/lib/prerenderHtml.ts`, which throws if the template loses a tag it rewrites. `App` applies the same values on navigation. The five per-page `document.title` effects, the NotFound title effect and the Navbar canonical/og:url effect are gone.
- **Lazy routes:** `src/routes.ts` replaces the `lazy()` calls in `App.tsx`. Each page is `React.lazy` plus a cache that `preloadRoute(path)` fills, so a preloaded page renders synchronously. The server needs this because `renderToString` can't wait for a chunk, and so does the client's first render. Pages reached by later navigation still load through `lazy` + Suspense as before.
- **Server safety:**
  - `useMediaQuery` (Navbar) and `useIsPhone` (Home) take a server snapshot of `() => false`, so the server renders the desktop layout.
  - `persistStorage` checks `window` before touching `localStorage`. In Node 25+, even `typeof localStorage` prints a warning.
  - `analytics.trackEvent` and `getEventCount` return early without `window`. Node 21+ has a `navigator` global, so the old `navigator` check alone didn't cover the server.
  - `themeStore` already uses zustand's default `window.localStorage` getter, which throws on the server and is caught. Theme, AdBanner push and analytics run only in effects.
  - React Flow is imported only by playground modules, and the server never loads them. `App` takes `playgroundShell`, which `entry-server` always sets, so `/playground` server-renders as the navbar plus `RouteFallback`.
- **`vite preview`:** a small plugin in `vite.config.ts` serves `dist/<route>/index.html` for `/<route>`, matching the production S3 keys. Without it, Vite 7 preview answers `/lessons` with Home.

## How start-up works (`src/main.tsx`)

1. `<body data-prerendered="/lessons">` names the route the file was rendered for.
2. **Before first paint**, an inline script in `index.html` (placed after `#root`) empties `#root` when `data-prerendered` doesn't match the address with trailing slashes removed. This covers unknown paths and any route CloudFront answers with the Home file, so Home never flashes. `main.tsx` repeats the check in case the inline script didn't run.
3. `preloadRoute(path)` loads the current page's chunk, then:
   - **Content routes** (data-prerendered matches, root not empty) call `hydrateRoot`. Nothing blanks: the prerendered DOM is kept and made interactive.
   - **`/playground`** calls `createRoot`. The shell (navbar plus empty canvas area) stays on screen until the first client commit replaces it. It does not hydrate, because the shell differs from the real page by design.
   - **Mismatch, dev server or no prerender** calls `createRoot` on the empty root, as before.
4. Hydration has no mismatches. Media queries use the server snapshot while hydrating and then re-render, the Home counters start `null` on both sides, and content pages render no persisted-store values.

## Deploy key mapping (`deploy.sh`)

Production is the S3 REST origin, so `/lessons` asks for the key `lessons`. CloudFront maps 403/404 to `/index.html` (200). Upload order:

| Order | Local file | S3 key | Content-Type | Cache-Control |
|---|---|---|---|---|
| 1 | `dist/assets/*` | `assets/*` (no delete; 30-day prune unchanged) | inferred | `public, max-age=31536000, immutable` |
| 2 | other root files | same names, `--delete` | inferred | `public, max-age=3600` |
| 3 | `dist/components/index.html` | `components` | `text/html; charset=utf-8` | `no-cache, no-store, must-revalidate` |
| 3 | `dist/lessons/index.html` | `lessons` | same | same |
| 3 | `dist/playground/index.html` | `playground` | same | same |
| 3 | `dist/privacy/index.html` | `privacy` | same | same |
| 4 | `dist/index.html` | `index.html` | same | same |

- Routes are discovered from `dist/*/index.html`. The script exits if there are none.
- The root sync uses `--exclude <route> --exclude <route>/*`. Without it, `--delete` would remove the extension-less keys, because they have no same-named local file. The route files are also not uploaded a second time with the 1 h TTL.
- No AWS or CloudFront config changed. Nothing was deployed and no AWS call was made. Only `bash -n` and a dry run of the route and exclude expansion were run.

## Verification (all local)

- `npm run lint`: clean. `npx tsc -b`: clean. `npm test`: **169 passed** (161 existing + 8 in `src/prerender.test.ts`, covering h1, title, description, canonical, og:url/title, `data-prerendered`, JSON-LD ×3 and AdSense tags per route, Home's social description, and a throw on template drift). `npm run build`: clean. The prerender also fails the build if a file lacks its canonical, og:url, `data-prerendered`, JSON-LD, AdSense meta or an `<h1>` (content routes).
- **Hydration proven with dev React:** I made a development build (`NODE_ENV=development`), prerendered it and served it with `vite preview` in Chrome.
  - Probe: I planted a text change in the prerendered `/lessons` and `/privacy` h1. React reported "Hydration failed…", which proves the hydrate path runs and that mismatches would surface.
  - With the real files, there were zero errors or warnings at 1280 px and 390 px (iframes with `console.error`/`warn` and window `error` hooks installed before load). The 390 px case covers the phone path that re-renders after hydrating. Routes checked: `/`, `/lessons`, `/lessons/`, `/lessons#server-cpu-saturation` (card scrolled into view and focused), `/components`, `/privacy`, `/playground?template=retry-storm` (5 nodes, "Retry Storm"), `/playground?lesson=server-cpu-saturation` (lesson loaded; at 390 px it shows Desktop Required with the link kept, as before), and `/no-such-page` (Not Found, `noindex`, own canonical, no Home content left).
- **Production build** in Chrome: the same 8 URLs gave zero console errors or warnings, and each had the correct title and h1.
- **Client navigation** Home → Components → Lessons → Playground → Home updated the title, description, canonical and og tags each time. Phone width (390 px) shows the Menu layout on all content routes, with no sideways scroll.

## What only a live check can prove

- **S3 extension-less keys:** that `curl -A Mediapartners-Google https://bottlenecker.arkynate.com/lessons` returns the Lessons HTML with `content-type: text/html` and the no-cache header, rather than the Home fallback. `vite preview` only imitates this mapping, through the plugin. Repeat for `/components`, `/privacy` and `/playground?template=retry-storm`.
- **CloudFront:** that it passes through S3's `Content-Type` and `Cache-Control` for the new keys, and that the `/*` invalidation covers them.
- **Unknown paths still return the Home file with HTTP 200** (B7 unchanged). The client shows Not Found without a Home flash. Fixing the status code is the CloudFront owner action.
- **AdSense:** that the content-page slots still fill after hydration (`data-ad-status` becomes `filled`/`unfilled`, never `null`). If Auto ads injects in-page units into `#root` before hydration, React would log a recoverable hydration error and re-render the page. Locally nothing injected, and I don't expect it, because the app bundle runs well before Auto ads places units.
- **Search Console URL Inspection** of the four routes, to see the rendered HTML Google gets.

## Notes for the lead

- `/lessons/` (trailing slash) in production asks S3 for `lessons/`, which doesn't exist, so it gets the Home file. It still works: the mismatch guard clears it and the client renders Lessons. Only the four exact paths serve prerendered content.
- The `/playground` shell's navbar shows "Untitled Diagram" until the client render, which then shows the visitor's own saved diagram name. This takes a fraction of a second on load.
- On Node 26 (local) Vite prints a `module.register()` deprecation warning during the SSR build. It comes from tooling, not this change. CI uses Node 22 from `.nvmrc`.
