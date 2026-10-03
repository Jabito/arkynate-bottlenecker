# build-lessons — 2026-10-03 elevate apply (wave 2)

Lane: interactive lessons (#100) and the critical path on the canvas (#79, owed by build-engine).
Verification at the last code commit (`d8e8af3`): `npx tsc -b` clean, `npm run lint` clean, `npm test` 8 files / 161 tests passing (54 new: `src/lib/lessonChecks.test.ts` 40, `src/lib/criticalPath.test.ts` 5, `src/store/diagramStore.test.ts` +4 lesson tests, plus build-engine's `lessons.test.ts` unchanged and green), `npm run build` passes. Lesson data stays in its own lazy chunk (`lessons-*.js` 7.3 kB gzip). `LessonPanel-*.js` is 2.8 kB gzip and loads only when a lesson is open.

## Items

| # | item | status | commits | note |
|---|---|---|---|---|
| 100 | Interactive lessons (FE69) | done | 3ccec83, 8d3d354, d8e8af3 | Lesson panel on /playground with the goal, steps, live success checks, a completion state, Next lesson and Back to lessons. Every lesson has data and tests. Cards link to `/playground?lesson=<id>` and have `/lessons#<id>` anchors. |
| 79 | Critical path on the canvas | done | a6fc058, d8e8af3 | Edges along `meta.criticalPath` are drawn in `--st-critical` at 3 px, but only while the path runs through a critical node and only on edges that carry traffic. The class is added at render time and never stored, saved or shared. |

Counts: 2 done, 0 partial, 0 skipped.

## How it works

**Data (`src/data/lessons.ts`).** Each lesson now has:
- `goal`: why this breaks.
- `steps`: 2–4 steps, each with an optional `check` that ticks it.
- `checks`: the success check. Every condition must hold.
- `solution`: the documented fix, as node or edge patches.

Conditions are declarative:
- `below`: a node's utilisation, read path or write path is under a threshold. The node must exist and carry traffic.
- `noCritical`
- `successAtLeast`
- `loadAtLeast`: generated QPS is at least the lesson's load. Every lesson has this check, so turning the load generator down never passes.

**Evaluation (`src/lib/lessonChecks.ts`).**
- `evaluateCondition` reads the store's analysed nodes, results and meta, and returns `{ ok, now }`. `now` is the live value shown next to each check (for example "400%", "78.4%", "2.0k/s", "1 critical").
- `lessonComplete` is true when every check holds.
- `applySolution` applies a lesson's `solution` (used by the tests).
- The panel subscribes through `useShallow` over a flat `[ok, now, …]` array, so it re-renders only when a tick or a shown value changes, not on drag frames.

**Fixes per lesson (every one verified by the engine in tests):**
- Server CPU: Instances 2 on both servers.
- Database write: Max write QPS 2,000. Read replicas do not complete it.
- Cache Miss Storm: hit rate 95%. Four replicas tick the read step but not the lesson.
- Load Balancer: LB Max QPS 12,000. More server instances do not complete it.
- Queue Consumer Lag: 5 consumers, plus Instances 2 on both consumer servers. With 5 consumers alone, each consumer gets 4,000 msg/s against 2,500.
- Retry Storm: retries 0 on both DB edges (DB 92%, but success falls to 78.4%), then DB error rate 2%. Fixing only the error rate also completes it.

**Lesson state (store).**
- `activeLessonId` lives in the persisted store (`bottlenecker-diagrams`), not the URL. The deep link `?lesson=` is applied once and the URL is cleaned (build-state's behaviour). A reload keeps the lesson and the learner's edits, and does not reload the lesson's starting diagram.
- `loadLesson(lesson)` replaces the canvas (undoable, with the "Opened lesson … press ⌘Z to undo" notice) and starts the lesson.
- Every other replacement ends the lesson: template, saved diagram, import, share link and New.
- Closing the panel (✕) calls `endLesson()`. The diagram stays.
- Undo snapshots carry the lesson id. Undoing the load that started a lesson ends it, and redo brings it back. `endLesson` removes the id from history, so undo/redo never reopen a lesson the user closed.
- On restore, an id that isn't a valid slug, or one restored with an empty canvas, is dropped. An id that doesn't match any lesson is ended by the panel.

**Panel (`src/components/LessonPanel.tsx`).**
- Placed between the palette and the canvas: 264 px wide, collapsible to a 48 px rail that shows the icon and the passed/total checks.
- Order:
  1. Header: ← All lessons, collapse and end buttons.
  2. Lesson number and title.
  3. Completion box (or a "Success check · n of m passing" button that scrolls to the checks). It sits at the top so it shows without scrolling.
  4. Goal.
  5. Steps.
  6. Checks with live values.
- Theme tokens only, plus `.bn-lesson-*` classes in `index.css`.
- `role=status` with `aria-live=polite` announces completion.
- Focus: on collapse or expand, focus moves to the other toggle. Next lesson moves focus to the new title.
- When the panel mounts or toggles, it re-fits the view two frames later, because xyflow learns the new pane width from a ResizeObserver.

**Lessons page.**
- "Start the lesson in the Playground →" is a real link to `/playground?lesson=<id>`, so it works with middle-click and copy.
- With a dirty canvas, a plain click still shows build-ui's inline confirm. Confirming navigates to the link.
- Each card has a `#` permalink and `tabIndex=-1`.
- `/lessons#<id>` scrolls the card into view under the sticky header (`scroll-margin-top: 96px`) and focuses it. This is needed because the lazy route renders after the browser's own anchor jump.

## Browser check (:5184, own tab, closed; test localStorage removed; window 1100 × 679 CSS px)

- `/lessons#retry-storm` scrolled to the card, below the sticky header.
- **Database Write Bottleneck, end to end:** started from the card link. The panel showed 1/3 passing. Edges into PostgreSQL were red (the critical path). After a reload, the lesson and canvas were restored. I set Max write QPS to 2,000 in the config panel: 3/3 passing, "✓ Lesson complete", and the critical-path highlight cleared.
- **Cache Miss Storm, end to end:** opened with Next lesson →. Hit rate 95% gave "Lesson complete": DB 25%, success 100%.
- **Load Balancer Saturation, end to end:** reached with Next lesson → pressed by keyboard (Enter). Focus landed on the new title. Two path edges had stroke `rgb(239,68,68)` and the off-path edge kept `--edge`. Max QPS 12,000 completed it.
- Light and Matrix were checked by eye, with the panel, ticks and completion box in Matrix. The theme was switched with the body class only, then restored.
- At 1100 px: no horizontal scroll (scrollWidth 1100), canvas 386 px wide (602 px when collapsed), and the analysis bar and the 90 px ad band are unchanged.
- Collapse and expand by click and by Enter moved focus between the toggles. ✕ ended the lesson, kept the 4 nodes, and set the persisted `activeLessonId` to null.
- With a dirty canvas, the card link showed the confirm. "Open lesson" opened the Retry Storm panel.
- No console errors after a fresh load.
- Fixed during the check:
  - The panel mounted after the load's fit and clipped the right-most node. Fixed by the re-fit on mount and toggle.
  - The load check read "2.0k/s/s".
  - Completion was below the fold at 679 px tall, so it moved to the top.

## Owed / not done

- None owed to other builders. AnalysisBar is unchanged: the path is still listed in its popover, and the canvas highlight is additional.
- The critical-path highlight is shown by colour only. Its text equivalent is the existing "Path" popover in the bar. If the lead wants a legend line ("red edges = slowest path through the bottleneck"), it belongs in AnalysisBar's legend, which is outside my lane.
- After ✕, focus goes to the document body. The panel is gone and no natural target remains.
- I did not walk Server CPU, Queue Consumer Lag or Retry Storm by hand in the browser. They are covered by the start/solution tests.

## Behaviour changes the owner will notice

- Opening a lesson now shows a lesson panel next to the canvas. The lesson ticks off as you fix it and congratulates you at the end. ✕ closes it and keeps the diagram. Loading anything else also ends the lesson.
- Reloading during a lesson keeps the lesson and your edits.
- Lesson cards say "Start the lesson in the Playground →". They are real links, and each card has a `#` permalink.
- When a component is critical, the slowest request path through it is drawn in red on the canvas.
- Lesson openings count as `template_used`, the same as before. No new analytics event was added, because the server allow-list is unknown.
