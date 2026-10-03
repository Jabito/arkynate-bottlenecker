# build-state — 2026-10-03 elevate apply

Lane: store, persistence, share links, validation, analytics client, playground page shell, app shell.
Verification at the last commit: `npx tsc -b` clean (whole repo), `npx eslint` clean on every file in this lane, `npm test` 6 files / 107 tests passing (40 of them in this lane: validateDiagram 8, shareCodec 6, flowChanges 2, diagramStore 13, plus the engine suites). Browser check on `:5182`: template, lesson, `#d=` and legacy `?diagram=` links (one with a `+` and a CSS-injection payload), restore after reload, the empty state, Enter on a focused edge opening Edge Config, the not-found page, and a PNG export with visible edge labels.

| # | item | status | commit | note |
|---|---|---|---|---|
| 4 | loadDiagram keeps the previous undo stack | done | 3e935d4 | Snapshots carry the name. Undo after Load restores the previous canvas **and** its name, so Save can't overwrite "A" with unrelated content. Test included. |
| 5 | working canvas not persisted | done | 3e935d4 | nodes, edges, diagramName and isDirty are persisted. Computed and transient keys are stripped at write time. Restored silently (owner ruling 8). |
| 6 | share links with `+` open empty | done | 264cfab, 26ea6ac | New links are base64url in the `#fragment`. Legacy `?diagram=` is read from the raw query (a `+` turned into a space is restored). A damaged link shows a notice instead of an empty canvas. |
| 10 | replace paths without confirmation or undo (store side) | done | 3e935d4 | Template/load/import/share/lesson/new push an undo snapshot, set `notice` ("Loaded “X” — press ⌘Z to undo") and `isDirty=false`. The confirm UI is build-ui's (Navbar, committed). `{"name":"package"}` is rejected and the canvas is untouched. |
| 19 | phone strips the share param before Desktop Required | done | 26ea6ac | Deep links run only in the desktop workspace. On narrow screens the URL is left as is and "Open this link on a desktop" offers Copy link. |
| 22 | black edge-label boxes in PNG/JPG | done | 264cfab | html-to-image deep-clones `<svg>` without computed styles. Computed fill and stroke are now inlined during the capture and restored afterwards. Verified in an exported PNG. |
| 26 | stale analysis results | done | 3e935d4 | Analysis re-runs on every content change. Computed keys are stripped before each run, so unreached or deleted nodes can't keep old status. |
| 27 | share links break at about 10 nodes | done | 264cfab | Fields stripped, deflate-raw, base64url. The Cached API link is 658 chars (was about 2k). A 40-node / 77-edge diagram is under 4 KB (test). |
| 28 | no validation, no ErrorBoundary | done | 264cfab, c6c8042 | `validateDiagram` is used by import, share decode, saved-diagram load and rehydrate. ErrorBoundary at the root and per route (keyed by path). Hostile-input tests included. |
| 29 | consent (client side) | done | a784f85 | Analytics never sends outside `import.meta.env.PROD` and honours GPC and DNT. The AdSense CMP is the owner's console action, and the privacy page is build-ui's. |
| 30 | tokens in my files | done | 26ea6ac, c6c8042 | Playground, desktop-required screen, empty state, ErrorBoundary, NotFound and the minimap use only theme tokens. |
| 32 | counters can be inflated (client side) | done | a784f85 | Allow-listed event names. The server-side RPC/RLS is out of scope (lead documents it). |
| 33 | count=exact on every visit | done | a784f85 | `count=estimated`, a 10-min sessionStorage cache, in-flight de-duplication. |
| 38 | soft 404 | done | c6c8042 | The catch-all renders NotFound with `<meta name="robots" content="noindex">`, which React 19 hoists to head (verified). The CloudFront 404 function is the lead's to document. |
| 43 | whole-store subscriptions (my files) | done | 26ea6ac | PlaygroundPage reads with selectors. The other consumers were converted by their owners. |
| 44 | coarse undo | done | 3e935d4 | One step per action. A delete batches edge and node removals, a drag snapshots once at drag end, keyboard moves coalesce, and config edits coalesce per node+field within 1 s. Rename is undoable. Tests included. |
| 45 | analyze_click undebounced, no PROD guard | done | a784f85, 3e935d4 | Only `runAnalysis({explicit:true})` records it, and repeats within 1.5 s collapse into one. |
| 47 | selected edge looks unselected | done | 26ea6ac | Edges carry no inline style. Stroke and label colours come from `--xy-edge-*` vars mapped to `--edge`, `--edge-selected` and `--edge-label-*`. |
| 48 | selection tracked twice | done | 26ea6ac | The config panel follows `onSelectionChange` (click, box, drag, keyboard). |
| 50 | fitView before measure | done | 26ea6ac | fitView runs on each `loadId` change and xyflow queues it until the nodes are measured. `minZoom 0.2` lets large templates fit. |
| 57 | export has no progress (store side) | done | 264cfab | `exportPNG`/`exportJPG` resolve after the download starts and reject on failure. build-ui shows progress. |
| 58 | revokeObjectURL too early | done | 264cfab | Revoked after 10 s. |
| 66 | panning undiscoverable | done | 26ea6ac | `panOnScroll`, plus a one-line hint ("Scroll to pan · ⌘+scroll or pinch to zoom · Space+drag…"). |
| 68 | edges not keyboard-reachable | partial | 26ea6ac | Edges and nodes are focusable, and Enter on a focused edge opens Edge Config (verified). There is no keyboard-only way to create a connection. xyflow offers click-to-connect on handles, but handles aren't focusable. |
| 69 | Desktop Required screen (Playground side) | done | 26ea6ac | Tokenised, with context-aware copy and actions. Hiding the toolbar on mobile is build-ui's (Navbar). |
| 74 | bottom ad shifts the canvas | done | 26ea6ac | Fixed 90 px slot that is always reserved. |
| 77 | one bundle for every route | done | c6c8042, 6234771 | `React.lazy` routes, html-to-image imported on demand, and the store uses local `applyNodeChanges`/`addEdge` (`src/lib/flowChanges.ts`), so React Flow and d3 leave the main chunk: 467 → 292 kB (151 → 94 kB gzip). The Playground chunk is 213 kB. Deploy retention of old chunks is build-ui's (62a1a44). |
| 80 | persist rewrites every frame, no version | done | 264cfab, 3e935d4, 5a4ceb6 | Debounced 400 ms, try/catch with a one-time "storage full" notice, flushed on pagehide and when the tab is hidden. `version: 1` + `migrate` (v0 drops analyzeCount, savedAt is set to the migration time). Merge validates everything. |
| 82 | analyzeCount (store side) | done | 3e935d4 | Removed. |
| 83 | duplicated export code | done | 264cfab | One `renderViewport(format)`, px units, and no deprecated `getNodesBounds` (bounds come from measured sizes). |
| 89 | percent edges show only "80%" | done | 3e935d4 | "80% · 4.0k/s" and "≤500/s · 480/s" via `formatQPS`. |
| 93 | auto-analyze | done | 3e935d4 | Synchronous inside each store action (the engine takes ≈1–2 ms at 500 nodes), so no frame ever shows stale results. Drag frames and selection don't re-run it. |
| 95 | `?template=` deep links | done | 26ea6ac | `?template=<id or name slug>` and `?lesson=<id>` (lessons are imported lazily). Re-applied when the URL changes in an open tab. Helpers are in `src/lib/deepLinks.ts`. |
| 97 | empty-canvas state | done | 26ea6ac | Template buttons and a 3-step "60 seconds" walkthrough. |

**Counts:** 33 done, 1 partial (#68), 0 skipped.

## Owed to other builders
- None outstanding. The contract changes were sent and adopted. build-engine's AnalysisBar uses `runAnalysis({explicit:true})` and async `getShareURL`. build-ui's Navbar uses `importJSON` results, `isDirty`, `notice`/`notify` and export promises, and it now renders the only toast (I removed mine from PlaygroundPage).
- Optional for build-ui and build-engine: `src/lib/deepLinks.ts` exports `templateHref(t)` and `lessonHref(id)` for Home/Lessons/docs links. LessonsPage can link to `/playground?lesson=<id>` instead of calling `loadTemplate`.

## Owed after integration (the lead's browser pass)
- Light and Matrix themes: edge, selected-edge and label colours on the canvas and in an exported PNG (the vars are set; I only checked the colours in Dark).
- Phone width (<768 px) with a `#d=` link: the URL stays intact and "Copy link" works. Not exercised, because the shared browser window couldn't be resized safely.
- The ErrorBoundary fallback in a real crash, and its "Clear canvas and reload" action.
- Export timing in a foreground tab. It was about 13 s in a hidden tab, where rAF is throttled.
- PROD build: no analytics requests when GPC is on; a single `analyze_click` for a held ⌘Enter.

## Behaviour changes the owner will notice
- Reloading restores the last canvas, and analysis results are always live. The Analyze button now only records the click.
- Share links look like `/playground#d=…` and are about 10× shorter. Old `?diagram=` links still open.
- Undo covers config edits, moves, renames and every load/import/template/share. Replacing the canvas no longer clears history.
- Invalid imports are refused with a reason (no `alert()`). Invalid parts of a file or link are skipped and counted in the notice.
- Connections into a load generator, and self-loops, are refused.
- Unknown URLs show "Page not found" instead of redirecting home.
- The playground canvas is 90 px shorter (a reserved ad slot), scrolling pans the canvas (⌘/Ctrl+scroll or pinch zooms), and the minimap is smaller.
- `/playground?template=cached-api` and `/playground?lesson=<id>` open those diagrams directly.
