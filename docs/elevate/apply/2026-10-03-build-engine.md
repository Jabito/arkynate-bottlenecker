# build-engine — 2026-10-03 elevate apply

Lane: simulation engine, types, lessons/templates/defaults data, node cards, ConfigPanel, AnalysisBar, Components page.
Verification at the last commit: `npx tsc -b` clean (whole repo), `npx eslint` clean on every file in this lane, `npm test` 6 files / 107 tests passing (78 of them in this lane: `src/engine/analyze.test.ts` 57, `src/engine/lessons.test.ts` 21). The 500-node / 1,450-edge benchmark runs in about 3 ms (with and without retries). Browser check on `:5181`: Retry Storm lesson (DB 200%, ∞ latency, success 85.3%), the notes popover, a chip click that selects and centres the node, the Stress dialog (focus moved to the close button, Esc closes, focus returns to the opener, max sustainable load 0.87×), ConfigPanel clamping (an empty field keeps 3000; −5 shows "Allowed 1–10,000,000; using 1" and blurs to 1), and the Light theme. No console errors.

## Engine model (owner decisions applied)

A node serves `min(in, capacity)`. Configured errors fail a share of what it serves, and the overload is shed. Total error rate is `1 − (served/in)(1 − e)`, and only successful output continues downstream.

**Capacity** comes from one `capacityOf` (src/engine/capacity.ts):
- Server: `maxQPS × instances`.
- Database: the incoming rate at which the busier of reads (`in·r` against `maxRead·(1+replicas)`) and writes (`in·(1−r)` against `maxWrite`) reaches 100%.
- Queue: `consumers × maxThroughput`.

**Queues.** Input above the drain rate is backlog (msg/s), not errors. A queue ends the synchronous request, so nodes behind it are `async` and are left out of latency and success rate.

**Edges.** Absolute caps are filled first (scaled together if they exceed the output). Percent edges then take their share of the remainder (scaled to 100% and warned about when they sum higher). Auto edges split what is left. Anything still left with no auto edge is reported as `unallocated` on the source.

**Retries** multiply load by `Σₖ₌₀ʳ eᵏ`, where e is the target's total error rate. The whole graph is iterated to a fixed point: at most 500 rounds, damped after 40, relative tolerance 1e-9, with a `convergence` warning if it does not settle. Absolute caps apply after retries.

**Cycles** are SCCs evaluated in id-sorted order, so results never depend on the order of the nodes or edges arrays. A `cycle` warning names the feedback edge.

**Status and inputs.** 100% utilisation is critical (`statusOf`, `STATUS_THRESHOLDS`). Load generators get no status and are left out of `results`. Inputs are clamped through `NODE_FIELD_LIMITS`; a missing required field falls back to the palette default and raises an `invalid` warning.

**Meta** carries:
- `criticalPath`: argmax predecessor over traffic-carrying sync edges.
- `endToEndLatencyMs`: Σ visits × M/M/1 latency ÷ generated; ∞ when a node on the path is at or over 100%.
- `successRatePct`, `generatedQPS`, `converged`, `saturated`, `warnings`.

## Items

| # | item | status | commit | note |
|---|---|---|---|---|
| 1 | Server instances have no effect | done | 6f5d8b0, a1bc2bf, 3a40e7a, e3a3e2c | Capacity = maxQPS × instances. Labels read "Max QPS (per instance)" (config), "Max / instance" + "Capacity" (card) and "Max QPS (per instance)" (docs). |
| 2 | Overload error = util − 100 | done | 6f5d8b0 | `1 − capacity/in`, combined with configured errors as `1 − (cap/in)(1 − e)`. 200% sheds 50%. |
| 3 | Percent edges from full output, no sum check, negatives | done | 6f5d8b0, 3a40e7a | Percent applies to the remainder after absolute edges. A sum over 100% is scaled down with an `overallocated` warning. Negatives are clamped to 0. Edge Config shows the percent total and the remaining share. |
| 7 | DB ignores replicas/readRatio | done | 6f5d8b0, a1bc2bf, 3a40e7a | Read/write split with replicas. Util is the busier path, and the card shows the read and write path %. Read Ratio is editable. |
| 8 | Saturated node forwards 100% | done | 6f5d8b0 | Forwards `min(in, cap) × (1 − e)`. Repro 2000 → cap 1000 → cap 1500 gives the second tier 66.7%, healthy. |
| 9 | Cycles silent, order-dependent | done | 6f5d8b0 | SCC fixed point, deterministic. A `cycle` warning names the edge (e.g. `b->a`). Tests reverse node and edge order for every template and lesson. |
| 11 | Unallocated traffic vanishes; "excess is absorbed" text | done | 6f5d8b0, a1bc2bf, 3a40e7a | `unallocatedQPS` on the source node ("Unsent 700/s" on the card), an `unallocated` warning, and corrected Edge Config text. Sinks are not flagged. |
| 12 | Load generators always "near" | done | 6f5d8b0, a1bc2bf | No status, no meter, not in results or chips. The card says "Emitting". |
| 13 | Zero/negative capacity healthy; empty field → 0 | done | 6f5d8b0, 3a40e7a | The engine clamps inputs and raises an `invalid` warning. Capacity ≤ 0 with traffic is critical. ConfigPanel clamps as you type, keeps the last good value while a field is empty, and shows the allowed range. |
| 14 | Lessons/docs promise missing behaviour | done | b7e171c, e3a3e2c | `lessons.test.ts` asserts every stated number and simulates every claimed mitigation. Copy was rewritten where the old figures were bug artefacts, and each lesson keeps its teaching point. index.html FAQ and llms.txt (build-ui) were confirmed accurate by message. |
| 16 | LB strategy cosmetic | done | 6f5d8b0, a1bc2bf, 3a40e7a, e3a3e2c | Removed from UI, card, docs, defaults and data. The type field stays optional for old saves and the engine ignores it. The panel says to weight with percent connections. |
| 23 | Retry model | done | 6f5d8b0 | Expected attempts over total error (configured + overload), fixed point, caps after retries. |
| 24 | Queues as request/response | done | 6f5d8b0, a1bc2bf | Backlog semantics. Forwards the drain rate only; consumers are not counted twice. The async hop is outside request latency. A `backlog` warning, plus "Backlog +4.0k msg/s" on the card. |
| 25 | "Est. P50" wrong | done | 6f5d8b0, 77a5e1b | "Mean latency" from `meta.endToEndLatencyMs`: traffic-weighted, sync path only, unreached nodes ignored, "∞ saturated" past 100%. |
| 30 | Tokens (my files) | done | a1bc2bf, 3a40e7a, 77a5e1b, e3a3e2c | Only node-kind brand tints remain as literals (handles and the Components page card accent). The inline edge stroke was removed from templates and lessons. |
| 43 | Selectors (my files) | done | 3a40e7a, 77a5e1b | ConfigPanel and AnalysisBar use per-field selectors. The bar no longer subscribes to `nodes`; labels load only while the notes popover is open. |
| 51 | No undo/redo buttons or shortcut sheet | done | 77a5e1b | ↶/↷ buttons (enabled from history length). The "?" button or key opens shortcuts plus the legend. |
| 52 | Stress overlay a11y | done | 77a5e1b | role=dialog, aria-modal, labelled title, focus moved in and trapped, Esc and backdrop close, "Close stress test" button, focus restored. |
| 56 | Config labels not linked (ConfigPanel part) | done | 3a40e7a | Every field has `htmlFor`/`id`. The navbar name label belongs to build-ui. |
| 59 | Status by colour only | done | a1bc2bf | Text status pill in the node header, plus `aria-label` with status and %. |
| 60 | No legend | done | 77a5e1b, 9da47b9 | The legend sits in the bar (chips row) and in the "?" popover, with thresholds from `STATUS_THRESHOLDS`. |
| 61 | "All clear" while nodes are stressed | done | 77a5e1b | "✅ No bottlenecks · N warnings". |
| 62 | Inconsistent formatting (nodes) | done | a1bc2bf | One `formatQPS`/`formatLatency`. Edge labels are build-state's (#89). |
| 63 | Capacity labels read as traffic | done | a1bc2bf | "Max read", "Max write", "Per consumer", "Drain rate", "Emitting", "Max / instance". |
| 64 | Cache icon 🔴 | done | a1bc2bf, e3a3e2c | 🗃️ (memcached 📇, so it no longer looks like the yellow warning). Palette updated by build-ui (1a0eac5). |
| 71 | Features grid overflows on phones | done | e3a3e2c | `minmax(min(380px, 100%), 1fr)`. |
| 73 | Config ad remounts on deselect | done | 3a40e7a | One persistent `AdBanner` at the panel bottom, outside the selection conditional. |
| 76 | No engine tests | done | 6f5d8b0, b7e171c | 78 tests: every BE/FE repro, the "fine" list (fan-in, multiple LGs, disconnected = 0), determinism, the COMPUTED_NODE_KEYS contract, performance, defaults, lessons and templates. |
| 78 | Duplicated capacity/status/format logic | done | 6f5d8b0, a1bc2bf | `capacityOf`, `statusOf`, `STATUS_THRESHOLDS` and formatters live in src/engine. Node cards render engine output only. |
| 79 | Critical path never computed | done | 6f5d8b0, 77a5e1b | `meta.criticalPath` is listed (clickable) in the notes popover. It is not drawn on the canvas (see "owed"). |
| 81 | Stress overlay perf | done | 77a5e1b | `useMemo` on nodes/edges with Map lookups per run. |
| 88 | Stale NEW badges | done | e3a3e2c | Removed. |
| 94 | Clickable chips | done | 77a5e1b | Clicking a chip selects the node (`setSelectedNode`) and runs `fitView({ nodes: [{ id }] })`. Path entries and warnings in the popover work the same way. |
| 96 | Exact headroom / max sustainable QPS | done | 6f5d8b0, 77a5e1b | `maxSustainableMultiplier` (doubling then bisection). The dialog shows the headline (multiplier, QPS, first component to reach 100%) and a per-node Headroom column. Cached API breaks at 1.20×, matching FE67. |
| 97 | Palette defaults fail at once | done | 6f5d8b0 | Server 1,500, DB 2,000/500. Default LG→LB→Server→DB, LG→Server→Cache→DB and LG→Queue→Server are all healthy (tests). The empty-state UI belongs to build-state. |
| 99 | Fixed-point solver | done | 6f5d8b0 | See the engine model above. |

Counts: 36 done, 0 partial, 0 skipped.

## Owed to other builders

- Nothing outstanding. build-state already marks the node `selected` in `setSelectedNode`, dropped the inline edge stroke in `onConnect`, and formats edge labels with `formatQPS` (#89). build-ui landed the cache palette glyph (1a0eac5), and the index.html/llms.txt claims match the engine.

## Owed after integration (lead's browser pass)

- Drawing `meta.criticalPath` on the canvas (edge highlight) needs a class on edges in the store or PlaygroundPage. The engine provides the path, and the bar lists it.
- The bar is now two rows: 48 px controls plus a 36 px chips/legend row. Check that the playground layout (build-state's height math, the 90 px ad band) still fits at 1100 px and 768 px.
- Dark and Light were checked. Matrix theme status colours on the node pill, chips and stress table still need a look.
- Auto-analysis end to end: editing a config field should update the cards, chips and Edge Config hints within a frame.

## Behaviour changes the owner will notice

- Numbers change everywhere. Instances multiply capacity. Database utilisation is the busier of reads and writes. A saturated tier passes on only what it serves, so tiers behind it look calmer. Overload errors are smaller (200% → 50%, not 100%). Queues show backlog, not errors.
- **100% utilisation is now critical**, not "near" (M/M/1 latency is unbounded there).
- Retry storms compound. The Retry Storm template DB goes from 92% without retries to 178% with them, at 1.94× load; the lesson goes to 200% at 2.2×.
- Latency reads "Mean latency" and shows "∞ saturated" when any node on the request path is at or over 100%. A new "Success %" figure appears.
- Load generators have no status border or chip. Nodes carry a text status pill.
- Templates were retuned: Simple Web App and Cached API DB write capacity raised, and Retry Storm servers 3,000 with DB 5,000/1,600, so starters are healthy and the storm shows retries causing the overload. Lesson diagrams set intermediate error rates to 0 where they only blurred the numbers. Palette defaults changed (server 1,500, DB 2,000/500, no LB strategy).
- The LB Strategy selector is gone. Read Ratio is editable.
- Config fields can no longer hold invalid values: out-of-range input is clamped, with a note.
- The analysis bar is taller (two rows), and the Stress Test shows a max-sustainable-load headline and a headroom column.
