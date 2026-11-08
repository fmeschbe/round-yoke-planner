# Browser-only round-yoke pattern planner

## Problem and current state

Build a browser-only application that calculates a round yoke, lets the user
color a repeating stitch chart, and previews the pattern on an annular sector
or full circle.

At planning start, `/Volumes/src/scratch/knitting` was a greenfield workspace
with `NOTES.md` (101 lines), no implementation, dependency manifest, test suite,
build configuration, or Git repository. Phases 1 and 2 now supply the browser
application, local plan storage, JSON portability, development/build
configuration, and automated tests.

`NOTES.md` describes the calculator, screen layout, chart interaction, palette,
and preview. It contains conflicting rules about increase timing and chart
width, and leaves stitch alignment and configuration changes unspecified.
The decisions below resolve those issues and supersede the conflicting wording
for this implementation. Do not edit NOTES.md as part of implementation unless
separately requested.

## Delivery status and running the application

The public source repository is
[`fmeschbe/round-yoke-planner`](https://github.com/fmeschbe/round-yoke-planner).
The project uses Apache License 2.0; `README.md` provides setup, usage, and
development instructions. Local Git uses `main` and the GitHub repository as
`origin`.

**Phases 1 and 2 are complete.** Calculator validation, fixed-slot repeating chart,
palette, confirmed geometry resets, keyboard navigation, responsive layout,
and SVG/dense annular previews are implemented. The six Phase 1 implementation
todos below and the Phase 2 local-portability todo are complete; Phases 3 and 4
remain pending. The Phase 1 refinements were committed and pushed as `387dea0`;
Phase 2, including modal plan management, is committed locally. Further UI fine
tuning can follow before Phase 3.

Run `npm install` on a fresh checkout and `npm run dev` to open the application
at the local URL printed by Vite. Run `npm run build` for a production bundle
in `dist/`; `npm run preview` serves that bundle locally.

Verification completed: 44 Vitest cases, chart/preview browser acceptance,
39 library browser acceptance checks (including persistence permissions,
overlay focus and dismissal, creation choices, and narrow-screen scrolling)
across Chromium, Firefox, and WebKit, TypeScript checking, production
build, and visual inspection of the restored production plan and responsive
library controls.
Run `npm test` for model/state tests. Install browser engines with
`npx playwright install --only-shell chromium firefox webkit`, then run
`npm run test:browser -- --workers=3` for browser acceptance.

The initial browser-engine download timed out; the smaller headless Chromium
package installed successfully. Browser tests start and stop their own local
server. No server was left running after implementation.

Runtime plans remain entirely browser-local, with no remote runtime assets or
server plan-data storage. Saving is manual; the latest saved plan reopens on
reload. Without saved plans, the app opens with a valid 64/8/160 example and
only the clear tool selected. Unsaved changes are not retained on reload.

## Four-phase roadmap

1. **Phase 1 - Schematic planner:** implement the existing calculator, palette,
   repeating chart, and annular preview plan below, with session-only state.
2. **Phase 2 - Local storage and portable plans:** add IndexedDB and JSON
   import/export, without server storage.
3. **Phase 3 - Printable HTML:** add self-contained printable documents and
   browser Print / Save as PDF.
4. **Phase 4 - Stitch ancestry and increase technique:** add an explicit
   insertion model and ancestry-aware chart and preview.

Deliver and validate phases sequentially. Gauge, physical tension, and drape
simulation are excluded from every phase. Phase 4 improves stitch topology,
not physical garment prediction. The detailed existing implementation and
acceptance criteria below describe Phase 1 unless stated otherwise.

## Phase 1 - Confirmed decisions

- Use vanilla TypeScript and Vite, with no application framework or backend.
- State is session-only: no accounts, storage, import, export, or undo/redo in
  the first version.
- Increase every `IP / 2`-th round; the first increase is at round `IP / 2`.
  Thus there are `IP / 2 - 1` non-increase rounds between increase rounds.
- Inputs must be positive safe integers, IP must be even, SI must be divisible
  by IP, SF must be at least SI, and SF - SI must be divisible by `2 * IP`.
  Reject impossible targets rather than rounding them.
- Edit one repeating segment. Chart width is `SF / segmentCount`, not SF
  except when segmentCount is one.
- Use fixed stitch-to-column mapping. Only actual stitch cells are editable;
  unused slots are disabled from the outset.
- Distribute actual stitch slots uniformly across chart width and show
  schematic, evenly distributed increase markers. Do not model stitch ancestry,
  a particular increase technique, gauge, or physical knit tension.
- Confirm before clearing a nonempty pattern when a valid applied input or
  segment-count change changes its geometry. Retain the palette. Changing only
  the number of visible segments preserves the pattern.
- Limit the rectangular chart to **5,000 slots**, including disabled slots:
  `TR * (SF / segmentCount) <= 5000`.

## Proposed approach

Keep calculation and stitch layout as pure functions independent of the DOM.
Use one small application state object and explicit actions for inputs,
configuration, palette, and coloring. Render a semantic HTML chart and an SVG
annular preview, with a bounded raster fallback for extremely large repeated
previews. Use CSS for the two-row responsive layout. Avoid a custom component
framework, event bus, or generalized state-management abstraction.

Proposed files:

- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`: application
  entry, build, type checking, and test configuration.
- `src/main.ts`: bootstrap, application state, action handlers, and coordination.
- `src/yoke.ts`: validation, calculation, segment divisors, and row slot layout.
- `src/pattern.ts`: palette IDs, cell edits, palette updates, and pattern reset.
- `src/chart.ts`: accessible chart, increase overlays, and delegated events.
- `src/preview.ts`: annular geometry, SVG rendering, and bounded dense rendering.
- `src/styles.css`: responsive layout, palette, chart, focus, and disabled states.
- `src/yoke.test.ts`, `src/pattern.test.ts`, and `tests/planner.spec.ts`: focused
  mathematical, state-transition, and browser tests.

Use Vitest for pure-function tests and Playwright for browser acceptance tests.
Use TypeScript checking and the Vite production build as baseline checks; do
not add a standalone linter or formatter without a demonstrated need.

## Calculation and layout contract

Let `K = IP / 2`, `D = 2 * IP`, and `M = (SF - SI) / D`.

- Total rounds: `TR = M * K`.
- Rows are numbered from 1 through TR; SI is the starting circumference, not
  an extra chart row.
- Stitches in round r: `N(r) = SI + D * floor(r / K)`.
- Round r has increase markers when `r % K == 0`.
- The final round includes the final increase and has SF stitches. No trailing
  rounds are added.
- If SI equals SF, TR is zero: show a valid no-rounds result and an explanatory
  empty chart/preview, not an invented row.
- Guard computed values against unsafe-integer overflow before allocation.

For a positive-round calculation, valid segment counts are the positive
divisors of `gcd(SI, 2 * IP)`. This divides every actual round's circumference,
not merely SI and SF. For a zero-round calculation, use the divisors of SI.
Generate divisors without iterating to SI; use paired divisors through the
square root. The implementation instead factors the value and generates
divisors from its prime powers, avoiding a square-root scan for large smooth
inputs. Trial factorization has a 1,000,000-candidate budget and reports an
actionable error for unusually large hard-to-factor counts rather than blocking
the browser indefinitely.

Distinguish mathematically valid segments from feasible charts. Mark segment
options exceeding the 5,000-slot limit unavailable and explain why. On the
first calculation, choose one segment if feasible; otherwise choose the
smallest feasible segment count. If none is feasible, report a size error
without replacing the previous valid chart. Visible segments range from one
through the selected segment count and do not change the chart.

For a selected segment count S:

- Chart width is `W = SF / S`; row r has `n = N(r) / S` real stitch cells.
- Place stitch j, indexed from zero, in chart column
  `floor((j + 0.5) * W / n)`. This gives n unique, monotonically ordered
  columns; when n equals W every column is active.
- Store colors by stable `(round, column)` coordinates within the current
  geometry. Precompute active columns for chart rendering and preview lookup.
- Row 1 appears at the top of the chart, with stitch columns increasing
  left to right. Preview row 1 sits next to the inner edge.
- Disabled slots represent no stitch, not uncolored stitches. They never
  consume palette colors or appear as extra stitches in the preview.
- On increase rounds, mark exactly `2 * IP / S` active cells with a 2px border.
  Project the previous row's stitch centers into the new row's stitch indices;
  the remaining indices are representative added stitches. Use SI for the
  previous count when the first round is already an increase. These markings
  are schematic, not ancestry-based, and remain visible when coloring/clearing.
- Real uncolored stitches use the user-defined background color, initially
  white. This replaces the ambiguous "markee color" rule with an explicit
  background setting, separate from the clear tool.

Increase markers occur only on increase rounds, at global angles
`2 * pi * k / IP` for `k = 0 ... IP - 1`. Draw noninteractive overlays/annotations
projected into the chart's edited sector and the visible preview; do not
reserve or color extra chart cells for markers. A repeating segment can
intersect only part of an increase interval; its marker placement need not
repeat identically when S does not divide IP. Colors repeat; markers describe
the global knitting schedule.

The example SI=3, SF=6 is not valid under the confirmed calculator constraints.
Use it only to explain divisibility, not as a supported calculator example.
A useful complete example is SI=8, IP=2, SF=16: TR=2, row counts 12 and 16,
and segment options 1, 2, and 4. Segment count 8 divides both endpoints but
not the intermediate row, so it must not be offered.

## State and interaction

Maintain draft calculator values separately from the applied geometry. Use an
explicit Calculate/Apply action; typing incomplete or invalid values must not
destroy the displayed pattern.

Palette entries have stable IDs; cells reference IDs rather than color strings.
Initially only clear is available and selected. The clear tool cannot be
removed and is not a stored stitch color.

- Clicking an empty real stitch sets the selected palette ID; clear is a no-op.
- Clicking a stitch with its selected palette ID clears it.
- Clicking a stitch with a different selected palette ID replaces it.
- Selecting clear and clicking a colored stitch clears it.
- Disabled chart slots cannot be edited by pointer or keyboard.
- Adding a color creates and selects an entry.
- Editing a color preserves its ID and updates all corresponding stitches.
- Removing a color clears every referencing cell; if selected, select clear.
- Background-color changes affect uncolored stitches, not disabled slots.
- Confirmed geometry changes clear cell assignments, retain palette and
  background, and clamp visible segment count to its new range.
- Reapplying identical geometry or submitting invalid values preserves state.
- Canceling a reset preserves applied geometry and restores segment controls.

Show input labels, field-level errors, the calculated TR, stitch counts,
increase cadence, and the confirmed assumptions above the editor. Use a
collapsible explanation if needed rather than hiding the assumptions entirely.

The lower section has preview left, chart right, and palette beside the chart
when space allows. At narrow widths, place the palette below the chart and
stack editor sections as needed. Keep charts scrollable rather than compressing
stitches into unusable targets.

Instructions sit above each chart/preview in initially collapsed, expandable
panels. Palette deletion uses an accessible trash icon beside the color and
its editing control, not a separate text row. Chart arrow-key movement follows
the displayed order: Down moves to the next round and Up to the previous round.

Use semantic table cells, labeled palette controls, visible focus, and a roving
tab stop with arrow-key chart navigation. Space/Enter performs the same action
as clicking. Distinguish disabled slots and clear/background colors without
relying exclusively on color.

## Preview and performance

Render an annular sector with angular span `2 * pi * visibleSegments / S`.
Repeat the edited segment across that span. Real stitches divide each round
uniformly by angle, and their colors come from the row's active chart slots.

Center the complete visible sector span at 6 o'clock, with starting angle
`pi - span / 2`. Apply that rotation to vector stitches, increase overlays,
sector bounds, and inverse-polar raster lookup alike. Full-circle orientation
remains unchanged.

Normalize outer radius to the viewport and set inner radius to
`outerRadius * SI / SF`. Divide the radial band into TR row bands. This
preserves the requested circumference ratio but is explicitly a schematic
representation, not a gauge-correct prediction of a finished garment.

Use SVG annular cell paths for ordinary previews. Cache geometry and update
fills rather than reconstructing unrelated UI for each cell edit. Keep markers
separate from stitch coloring and fit partial sectors into the preview viewport.

The 5,000-slot chart limit does not bound full-circle preview work: repeating a
small segment can produce many more visible stitches. Estimate the visible
cell count before rendering. Above 5,000 visible stitch cells, render colors
into a size-bounded canvas and embed that raster image in the SVG; keep sparse
labels/markers as overlays. The dense renderer should use inverse polar lookup
per pixel, not loop over all repeated stitches, so its work is bounded by image
resolution. Bound both raster dimensions and device-pixel ratio. Dense increase
markers may merge into an annotated overlay rather than creating unbounded
SVG nodes. Full-circle mode remains available; do not silently cap the user's
visible-segment choice.

A raster fallback is limited to preview rendering. The editable chart remains
semantic HTML and requires no virtualization under the confirmed slot budget.
Provide a textual preview description for accessibility.

## Implementation todos and dependencies

1. **Scaffolding the browser application** (`app-scaffold`): create the minimal
   Vite/TypeScript entry, CSS shell, scripts, and Vitest/Playwright setup.
2. **Implementing yoke calculations and stitch layout** (`yoke-model`): validate
   numbers and overflow, compute rounds, enumerate segment options, enforce the
   chart budget, and derive deterministic row layouts. Depends on app-scaffold.
3. **Implementing palette and pattern state** (`pattern-state`): implement stable
   color IDs, clear/toggle/replace, palette edits/removal, draft/applied geometry,
   and confirmed resets. Depends on yoke-model.
4. **Building calculator and chart controls** (`chart-ui`): add inputs, results,
   assumptions, segment controls, semantic chart, increase annotations, palette,
   keyboard interaction, errors, and responsive layout. Depends on pattern-state.
5. **Building the annular preview** (`yoke-preview`): implement SVG geometry,
   segment repetition, background fills, markers, dense raster fallback, and
   display-only visible-segment changes. Depends on pattern-state.
6. **Integrating and validating the complete workflow** (`integration-checks`):
   connect chart edits and preview updates, add browser acceptance coverage,
   and resolve failures in type checking, tests, and production build.
   Depends on chart-ui and yoke-preview.

## Verification and acceptance

Pure-function tests:

- Correct increase cadence and final-round inclusion, including IP=2 and IP=8.
- SI=SF returns zero rows; malformed, odd-IP, uneven-distribution, decreasing,
  unreachable, and unsafe-integer inputs are rejected.
- Segment counts divide every row, including the SI=8/IP=2/SF=16 counterexample.
- Slot mappings have exactly n distinct in-range active columns and fill all
  columns in final-width rows.
- Charts at 5,000 slots are accepted; larger charts are rejected before allocation.
- Palette toggle, replacement, clear, selected-color removal, and stable-ID edits.

Browser acceptance:

- Apply a valid calculation and verify row counts, available segments, chart
  dimensions, disabled slots, results, and increase markers.
- Color a real stitch and verify the corresponding preview location and
  repeated sectors; disabled slots cannot change the pattern.
- Edit/remove palette colors and verify existing chart and preview colors update.
- Change background and visible segments without clearing the pattern.
- Confirm/cancel geometry changes, and preserve state after invalid submissions.
- Exercise zero rounds, size-limit feedback, and a dense full-circle preview.
- Navigate and edit the chart with the keyboard.
- Verify wide and narrow layouts and run browser flows in Chromium, Firefox,
  and WebKit.

Run the focused unit/browser tests, TypeScript checking, and production build.
Inspect a representative preview for row/angle orientation and increase overlays;
do not treat mathematical tests alone as proof of visual correctness.

## Phase 2 - Local storage and portable plans

Keep all plan data in the user's browser or explicitly downloaded files.
Static application hosting is allowed; no plan-data API, cloud synchronization,
accounts, or server-side storage is introduced.

Implement a versioned JSON document containing plan identity/name, SI, IP, SF,
segment configuration, palette with stable IDs, background, and colored stitch
assignments. Include a layout-model identifier so future ancestry-aware plans
can be distinguished from schematic plans. Recompute TR and other derived
geometry on load instead of trusting imported calculations.

Use IndexedDB for multiple named plans. Provide save, list/open, rename, and
delete operations, with confirmation for destructive operations and unsaved
changes. Confirmed behavior is manual Save and automatic reopening of the most
recently saved plan on startup. Rename by editing the active name and saving.
Keep plan management in a native modal dialog opened by the header's Your Plans
button, not a permanently visible panel. Close and Escape dismiss it and return
focus to the opener; successfully opening or creating a plan also dismisses it.
Separate current-plan actions from saved-entry actions. Label JSON export as
exporting the current applied editor plan, not the selected saved entry.
Offer New empty plan (default counts, no colors) and New plan from JSON.
Explain that both replace the current editor, confirm before losing unsaved
changes, and leave stored copies untouched. Validate imports before replacement.
Imports create a new unsaved plan; Save adds it to the library with a fresh ID.
Show saving/failure state accurately and preserve the active in-memory plan
when storage is unavailable or a transaction fails. Deleting the active saved
copy retains its current pattern in the tab as unsaved work.

Use format `round-yoke-planner`, document version 1, and layout model
`schematic-v1`. Names are trimmed and limited to 100 characters. Confirmed
file/document size limit is 1 MiB, measured in UTF-8 bytes; check File.size
before reading imports. Validate palette IDs, selected color, timestamps, and
duplicate coordinates as well as the geometry. Do not trust cached derived
calculations in imported files.

Resolve writes only after transaction completion, not individual request
success. Save an independent snapshot; edits made during a write remain
marked unsaved. Startup restoration respects intervening user edits and
overrides browser-restored form values with the authoritative saved model.

Request persistent storage where supported and explain that permission is not
guaranteed. Browser data can still be cleared; private sessions may be temporary.
Plans are local to the browser profile and application origin, not automatically
shared between devices. JSON downloads are the portable backup.

JSON export must round-trip all editable plan data. Import into a new local
plan, not an existing plan with a colliding ID. Validate document version,
numeric constraints, colors, palette references, cell coordinates, layout
model, and the 5,000-slot chart budget before replacing active state. Enforce
the 1 MiB import-file size limit before parsing. Reject unsupported versions
with actionable feedback; do not silently reinterpret them.

Implemented additions: `src/document.ts` for serialization/validation,
`src/storage.ts` for native IndexedDB transactions, and `src/library.ts` for
library/import/export actions and unsaved-change tracking. Document unit tests
and `tests/library.spec.ts` cover the new behavior. No dependencies were added.

Acceptance: save/open after reload, isolated named plans, rename/delete,
lossless JSON round trips, invalid/oversized imports, duplicate IDs, canceled
navigation, unavailable storage, and quota/transaction failures. Verify no
plan data is sent over the network. Verify modal visibility, focus isolation,
dismissal, narrow-screen scrolling, explicit creation options, and export of
the current editor when a different saved entry is selected.

## Phase 3 - Printable HTML

Generate a standalone HTML document from a validated plan snapshot, containing
inputs, TR, increase schedule, segment/repetition instructions, numbered chart,
palette legend, background, assumptions, and embedded annular preview.
Include document/layout version information and the schematic-preview caveat.

Embed styles and preview assets; require no remote scripts, fonts, images,
or application origin to view the downloaded document. Escape user-controlled
text and validate embedded colors instead of interpolating untrusted HTML.

Add print styles and browser Print / Save as PDF. Keep ordinary HTML viewing
useful as well. Split large charts into numbered panels with repeated row/
column labels and assembly guidance rather than shrinking cells beyond
readability. Do not split individual chart rows unintentionally.

Proposed addition: `src/print.ts` for snapshot-to-document generation and
print-specific styles. Prefer existing SVG preview geometry; embed a bounded
raster image when the dense-rendering path is necessary.

Acceptance: downloaded HTML opens without network access, content matches the
saved plan, user text renders literally, charts remain legible across page
breaks, and print preview works in Chromium, Firefox, and WebKit.
Browser PDF output is included; a dedicated PDF-generation dependency and
Markdown export are not part of the committed phase scope.

## Phase 4 - Stitch ancestry and increase technique

Before implementation, select and document the supported increase technique(s):
which stitch or boundary anchors an increase, where each of the two new
stitches enters, left/right orientation, round-start convention, and whether
increase anchors persist or move between increase rounds. Use worked examples
to confirm these rules; technique names alone are insufficient.

Introduce stable stitch IDs and explicit parent/anchor relationships. Preserve
existing stitches through non-increase rounds and create exactly two new
stitches at each of IP increase points. Distinguish a stitch's parent from the
anchor of an inserted stitch when the technique requires it.

Derive chart placement from insertion history instead of Phase 1's independent
uniform slot mapping. Keep stitch-count and cadence rules unchanged unless a
specific incompatibility is explicitly resolved. Determine repeatable segments
from both per-round divisibility and rotational symmetry of the selected
increase structure; divisibility alone no longer guarantees a valid repeat.

Keep existing documents in their schematic layout mode. Version the document
schema and IndexedDB migrations for ancestry-aware plans; do not silently
reinterpret older `(round, column)` colors. Before implementing conversion,
decide whether to offer explicit recoloring/reset or a documented stitch-order
mapping, with confirmation and retention of the original plan.

Update chart markers, preview alignment, JSON serialization/import, and
printable HTML to describe the chosen technique and lineage-aware layout.
The preview remains schematic: no gauge, yarn/material model, tension,
elasticity, or drape simulation.

Proposed addition: `src/ancestry.ts` with pure lineage/insertion functions.
Extend the existing layout model, document validators, chart, and preview;
avoid a generalized physical simulation engine.

Acceptance: hand-verified insertion examples, unchanged lineage on plain
rounds, exactly `2 * IP` additions on increase rounds, valid parent/anchor
references, round-boundary increases, repeat-symmetry filtering, palette edits
and color retention by stitch ID within an unchanged geometry, old-document
compatibility, and ancestry-aware JSON/print round trips. Preserve the chart
budget and bound ancestry computation before allocating a full-circle graph.

## Later-phase todos and dependencies

7. **Implementing local storage and JSON portability** (`local-portability`):
   finalize save policy and document limits, implement schema/validation,
   IndexedDB library, and JSON import/export, and validate persistence and
   failure cases. Depends on integration-checks.
8. **Implementing printable HTML documents** (`printable-html`): generate
   standalone documents, paginate charts, support browser printing/PDF, and
   verify offline output. Depends on local-portability.
9. **Defining stitch ancestry and increase rules** (`ancestry-contract`):
   confirm technique, anchors, orientation, symmetry, layout limits, and legacy
   conversion policy with worked examples. Depends on printable-html.
10. **Implementing ancestry-aware planning** (`ancestry-planner`): implement
    lineage, chart/preview alignment, document migrations, and updated exports
    with focused compatibility tests. Depends on ancestry-contract.

## Scope exclusions and considerations

No server storage, authentication, synchronization, undo/redo, gauge inputs,
physical tension/drape simulation, or advanced painting tools in this roadmap.
Persistence/import/export are deferred to Phase 2, printable HTML to Phase 3,
and stitch ancestry/increase technique to Phase 4.
No repository initialization, commits, or deployment setup without a separate
request. In Phase 1, a page reload intentionally loses session-only work.

Fixed active slots intentionally replace the notes' arbitrary placement and
capacity-based disabling behavior. This change was explicitly selected during
clarification and must remain visible in the UI explanation.

Exact physical knitting appearance cannot be inferred from stitch counts alone.
The schematic and uniformly distributed slot model are deliberate first-version
boundaries, not claims of physical accuracy. Phase 4 replaces uniform placement
with ancestry-aware placement but does not claim physical accuracy either.
