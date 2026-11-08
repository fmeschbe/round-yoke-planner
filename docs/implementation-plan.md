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

**Phases 1–3 are complete.** Calculator validation, fixed-slot repeating chart,
palette, color-preserving geometry edits, keyboard navigation, responsive layout,
and SVG/dense annular previews are implemented. The six Phase 1 implementation
todos below, the Phase 2 local-portability todo, and English/German/Bokmål localization
and printable HTML are complete; Phase 4 remains pending. Phases 1 and 2, including modal plan
management and collapsed instructions, were pushed through `529728b`.
English/German/Bokmål localization and the flag-only selector were committed
as `0229173`. Guided stitch selections are also implemented, and these
refinements were published in `ba15450`. Phase 3 was added in
`a3e3c5b`, header save/print shortcuts in `d42219f`, and the hamburger menu in
`4a03a28`. Color-preserving geometry changes and optional initial/final plain
rounds were added in `7c1b0d9`. The preview's angular stitch direction was
reversed in `1a7e94e`,
so bottom-centered sectors match the chart's left-to-right order.
Full-screen chart editing, confirmed clearing, and rectangular cut/copy/paste
are implemented and published on `main`, together with the preceding refinements.
The chart header now combines the segment selector and tools in a compact row,
without visible supporting text or reserved selection-feedback space.
The full-screen button sits to the right of the columns/rounds indicator;
vertical dividers separate the segment selector, clear-all action, and selection tools.
The yoke preview also supports expanded viewing through a top-right button
beside its mode indicator; this addition is also published on `main`.
Phase 4 requires confirmation of the ancestry
contract before implementation.

Run `npm install` on a fresh checkout and `npm run dev` to open the application
at the local URL printed by Vite. Run `npm run build` for a production bundle
in `dist/`; `npm run preview` serves that bundle locally.

Verification completed: 71 Vitest cases and 214 browser acceptance checks across
Chromium, Firefox, and WebKit. Coverage includes cascading stitch selections,
explicit Apply/color-loss confirmation, legacy-plan restoration, language switching,
and existing planner/library workflows. Print coverage includes offline localized
documents, literal user text, dense previews, panel boundaries, zero rounds,
draft/popup errors, isolated print tabs, and A4/US Letter PDF output in Chromium.
Two PDF-generation checks are skipped because Playwright does not expose that
API for Firefox/WebKit; both engines exercise print styles and the native button.
TypeScript checking, production build, desktop/mobile layout inspection, and
representative printed chart inspection also passed.
Menu coverage includes keyboard navigation, lightweight dismissal, focused
dialogs, Save-as copies/cancellation, active/inactive renaming, filesystem and
drag/drop imports, and preservation of existing storage, localization, and
print behavior.
Resize coverage includes ordinal remapping, lossless growth/reduction, exact
loss counts, cancellation, irreversible truncation, zero rounds, unchanged or
growing rectangles with fewer real stitches, preview updates, and JSON round trips.
Plain-round coverage includes independent increase timing, continuous/section
numbering, edge-anchored remapping, exact truncation losses, equal-count previews,
validation/budgets, localized drafts, persistence/New reset, and offline panels.
Preview-direction verification passed 100 affected browser checks across all
three engines, with two PDF API skips. Coverage includes colored vector repeats,
raster pixels at repeat boundaries, mirrored markers, centered bounds, and
localized printable preview orientation. Unit cases and production build pass.
Chart editing coverage includes modal expansion/focus/mobile layout, confirmed
clearing, mouse dragging/two-corner taps/keyboard selection, blocked slots,
copied blanks, exact clipping/cancellation, palette-limit rejection, cross-plan
clipboard colors, saved/dirty state, localized selections, and persistence.
Compact-header verification passed 51 chart-editing/localization checks across
all three engines, plus production build and German desktop/mobile inspection.
Expanded-preview verification passed 88 preview/chart/localization/print checks
across all engines, with two PDF API skips. Coverage includes placement, scaling,
controls, saved-state retention, focus restoration, translations, empty previews,
and unchanged printable output; German desktop/mobile layouts were inspected.
Run `npm test` for model/state tests. Install browser engines with
`npx playwright install --only-shell chromium firefox webkit`, then run
`npm run test:browser -- --workers=3` for browser acceptance.

The initial browser-engine download timed out; the smaller headless Chromium
package installed successfully. Browser tests start and stop their own local
server. No server was left running after implementation.

Runtime plans remain entirely browser-local, with no remote runtime assets or
server plan-data storage. Saving is manual; the latest saved plan reopens on
reload. Without saved plans, the app opens with SI=64, IP=16, SF=160 and
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
- Preserve colors by round and real-stitch ordinal when applied input or
  segment-count changes alter geometry; confirm only actual color losses.
  Retain the palette. Changing only
  the number of visible segments preserves the pattern.
- Limit the rectangular chart to **5,000 slots**, including disabled slots:
  `(initialRounds + TR + finalRounds) * (SF / segmentCount) <= 5000`.

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
- `src/pattern.ts`: palette IDs, cell edits, palette updates, and geometry remapping.
- `src/clipboard.ts`: rectangle snapshots, cuts, ordinal paste candidates, and palette reuse.
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

- Increase-section rounds: `TR = M * K`.
- Optional initial and final plain rounds default to zero and must be
  nonnegative safe integers. Total chart rounds are `initialRounds + TR + finalRounds`.
- Rows are numbered continuously from 1 through total chart rounds. Each row
  also has a section and local section round, shown in compact translated labels.
- Within the increase section, local round r has `N(r) = SI + D * floor(r / K)`.
- Only increase-section round r has increase markers when `r % K == 0`.
- The final round includes the final increase and has SF stitches. No trailing
  increase-section rounds are added. Initial/final plain rows use SI/SF stitches.
- If SI equals SF, TR is zero. Optional plain rows remain valid; only zero
  total chart rounds produce an empty chart/preview.
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
explicit Calculate/Apply action; changing draft selections must not destroy the
displayed pattern. The guided dropdowns below supersede the initial freeform
numeric controls, while the mathematical/document validation contract remains.

### Guided stitch selections before Phase 3

Order the calculator fields IP, SI, SF. Offer increase-point presets 4, 8, 16,
and 32, with 16 selected by default. New plans use SI=64 and SF=160.
Initial choices are multiples of the selected IP in the inclusive range 16–100.
Final choices are reachable values in the inclusive range 100–300, with
`SF >= SI` and `(SF - SI) % (2 * IP) === 0`. Filter final choices through the
existing calculator so a feasible chart must also exist.

When an upstream selection changes, retain dependent values if they remain
available; otherwise choose the smallest available value. Continue to require
Calculate / Apply, preserve current pattern data until application, and keep
confirmation only when applying would remove colored stitch positions.

Saved and imported plans outside these UI presets/ranges remain supported by
the unchanged document schema and validation rules. Add their current values
as labeled extra options. Retain a legacy SI option only while its IP matches
the applied plan, and a legacy SF option only while both IP and SI match.
Restore all selected values on open/reload. Translate extra-option labels
without changing selections or dirtying a saved plan.

Implemented in `src/calculator.ts`, integrated with `src/main.ts` and new-plan
creation in `src/library.ts`. Focused unit/browser coverage includes cascading,
chart-budget exclusions, canceled Apply, legacy imports/reloads, and defaults.
Older browser examples now enter through JSON import when outside the guided
ranges rather than requiring freeform numeric entry.

### Color-preserving geometry changes

Preserve each assigned color's section round and zero-based ordinal among that
round's real stitches. Find the ordinal in the old active-column array and map
it into the new array for its corresponding section round. Do not preserve raw grid columns,
scale fractional positions, or infer ancestry. This gives a unique mapping
without collisions, while allowing left/right shifts as blocked slots change.

The chart remains top-left anchored, adding/removing columns at the right.
Increase-section and final rounds grow/shrink at their section's bottom;
initial rounds grow/shrink at the top. New real stitches use the background. A removed round or
missing target ordinal loses its assigned color; unused palette entries remain.
Compute a candidate map and exact loss count before modifying applied state.
Lossless changes require no confirmation, even if the rectangle shrinks.
Actual losses require a localized confirmation with their count and a warning
that later expansion cannot restore them. Cancel retains geometry and colors,
restores a canceled segment selection, and leaves calculator drafts unapplied.

Check actual per-round positions, not just rectangular dimensions: changing SI,
IP, or segments can reduce real stitches inside an unchanged or growing chart.
Keep existing calculation validation, the 5,000-slot budget, explicit Apply for
calculator drafts, and immediate segment changes. Retain palette/background/
selection and clamp visible segments. Rebuild chart/preview geometry and mark
applied changes unsaved.

Implemented with pure `remapCells` and `applyGeometry` in `src/pattern.ts`,
integrated into `confirmGeometry` in `src/main.ts`. No JSON change is needed:
stored cells still use current `(round, column)` coordinates, remapped at Apply.
Imports, saving, and printable exports receive only current assignments; no
hidden recovery history is stored. Backwards compatibility is not a constraint
if future changes require a format revision.

### Optional initial and final plain rounds

Add two numeric draft controls, applied through Calculate / Apply. Initial
rows have SI stitches and are inserted before the existing top row or removed
from the top. Their colors preserve distance from the yoke boundary, rather
than their local top-based number. Final rows have SF stitches, append/remove
at the bottom, and preserve their local round number. Yoke rows preserve their
increase-section round when initial rows are inserted/removed; final rows move
with changes to either preceding section. Preserve real-stitch ordinals and
confirm only actual losses using the existing exact-loss prompt.

Global round numbers remain continuous while compact I/Y/F labels (localized)
show section/local numbers separately. TR and increase cadence remain confined
to the yoke section; plain rows have no increases or added-stitch borders.
The 5,000-slot budget includes every section. Equal SI/SF permits plain-only
charts; their preview uses explicitly arbitrary ring thickness.

Persist/export `inputs.initialRounds` and `inputs.finalRounds` in document
version 1; missing fields normalize to zero. Recompute global geometry on
import. Print all global rows, section labels, total/section counts, and both
global and local increase-round numbers, with existing panel and cell sizes.
New plans reset both counts to zero. No recovery history or gauge is added.

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
- Geometry changes remap surviving cell assignments, retain palette and
  background, and clamp visible segment count to its new range.
- Reapplying identical geometry or submitting invalid values preserves state.
- Canceling color loss preserves applied geometry and restores segment controls.

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

### Chart editing tools

Provide emoji controls with localized accessible names/tooltips for expanded
view, clear, rectangle selection, cut, copy, and paste. Expanded view uses a
native modal covering the browser viewport with the existing chart/palette/tools,
not duplicate editor state. Restore the same panel and opener focus on exit.
Escape first cancels active selection/paste, then exits the modal.

Clear removes only color assignments after confirmation. Rectangles include
blocked slots and support dragging, two corner clicks/taps with scrolling,
and Shift + arrows. Keep ordinary paint/navigation behavior outside selection
mode and retain selections on language switches. Geometry changes reset selection.
Combine the labeled segment selector and emoji tools in one responsive,
non-wrapping row, with dividers before and after clear-all. Keep full-screen
in the heading beside the columns/rounds badge. Compact controls on narrow screens and allow horizontal
toolbar scrolling where needed. Keep segment descriptions and selection/action
announcements screen-reader-only, so they consume no space and cannot shift
the chart during selection. Show paste errors separately as visible alerts.

Copy snapshots each selected row's real-stitch sequence as color values or
uncolored entries, omitting blocked slots without compressing away empty rows.
Cut snapshots first and immediately clears selected assignments. Use an in-tab
clipboard retained between plans, not the system clipboard or persisted data.
Paste-button mode chooses a top-left destination by click/tap; Ctrl/Cmd + V
uses the selection's top-left corner or focused stitch. Ctrl/Cmd + C/X copy/cut;
do not intercept text-input shortcuts.

Map each row to real destination stitches at or after the chosen column.
Uncolored entries clear destination colors. Compute the candidate and exact
colored-omission count before applying; confirm clipped colors, but omit
out-of-bounds blanks without prompting. Cancel changes nothing and retains
paste mode; the clipboard always retains the full snapshot. Reuse matching
palette values, add missing colors, retain paint selection/background, and
reject palette overflow before changing cells. Rebuild preview colors and mark
only actual pattern changes unsaved. Selection/clipboard/modal state never
enters saved JSON or printed documents; no undo/redo or system clipboard is added.

## Preview and performance

Render an annular sector with angular span `2 * pi * visibleSegments / S`.
Repeat the edited segment across that span. Real stitches divide each round
uniformly by angle, and their colors come from the row's active chart slots.

Center the complete visible sector span at 6 o'clock, with starting angle
`pi - span / 2`. Apply that rotation to vector stitches, increase overlays,
sector bounds, and inverse-polar raster lookup alike. Map stitches
counterclockwise from the sector's ending angle so bottom-centered sectors
match the chart's left-to-right order. Reflect increase markers in the same
direction. Full circles keep their round start at 12 o'clock and proceed
counterclockwise. This changes only rendering, not stored chart coordinates.

Normalize outer radius to the viewport and set inner radius to
`outerRadius * SI / SF`, or an explicitly arbitrary 70% inner radius when
SI equals SF and plain rows exist. Divide the radial band into total chart row bands. This
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

Provide a localized top-right expansion button beside the preview-mode badge,
matching the chart's icon and header styling. Move the existing preview panel
into a native viewport-filling modal, preserving its controls, renderer, colors,
and aspect ratio; do not clone editor state or alter detached printable previews.
Scale the SVG to the available space and retain the existing bounded raster
resolution. Expanded-view toggles do not mark plans dirty; visible-segment edits
retain their existing save behavior. Close through the return icon or Escape,
restoring the same panel and opener focus. Empty previews can also be expanded.

## Implementation todos and dependencies

1. **Scaffolding the browser application** (`app-scaffold`): create the minimal
   Vite/TypeScript entry, CSS shell, scripts, and Vitest/Playwright setup.
2. **Implementing yoke calculations and stitch layout** (`yoke-model`): validate
   numbers and overflow, compute rounds, enumerate segment options, enforce the
   chart budget, and derive deterministic row layouts. Depends on app-scaffold.
3. **Implementing palette and pattern state** (`pattern-state`): implement stable
   color IDs, clear/toggle/replace, palette edits/removal, draft/applied geometry,
   and confirmed color-loss remapping. Depends on yoke-model.
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
recently saved plan on startup. Use a hamburger popup menu with exactly seven
entries: New plan, New plan from JSON, Load plan, Save as, Export current plan
as JSON, Download printable HTML, and Manage plans. Save and Print remain
explicit header icon buttons, not duplicated menu items.

Use native popovers for the accessible, keyboard-navigable menu, with arrow,
Home/End, Escape/Tab, and light dismissal. Load and Manage open a native modal
list of saved plans; Manage supports renaming or deleting any selected entry
without replacing the editor. Rename preserves active unsaved pattern edits.
Save as opens a focused naming dialog and creates an independent saved copy,
leaving the original untouched and making the copy active. Canceling the naming
dialog does not mutate the current name, dirty state, or stored plans.
New from JSON opens a filesystem chooser and drag/drop dialog. Validate before
discard confirmation; reject multiple dropped files and oversized documents.
Close/Cancel and Escape dismiss dialogs and restore appropriate opener focus.
Separate current-plan actions from saved-entry actions. Label JSON export as
exporting the current applied editor plan, not the selected saved entry.
Offer New empty plan (default counts, no colors) and New plan from JSON.
Explain that both replace the current editor, confirm before losing unsaved
changes, and leave stored copies untouched. Validate imports before replacement.
Imports create a new unsaved plan; Save adds it to the library with a fresh ID.
Show saving/failure state accurately and preserve the active in-memory plan
when storage is unavailable or a transaction fails. Deleting the active saved
copy retains its current pattern in the tab as unsaved work.

The header's floppy-disk emoji is a quick-save button: save named plans directly
without opening the library; prompt unnamed plans in the same naming dialog
used by Save as, with the name selected.
Automatic default names count as unnamed, while saved/imported names count as
named. Name changes commit only after a successful save or rename.
Disable the shortcut during operations and when already saved. Preserve draft
validation and show failures outside the modal; restore focus to the actual
opener on dismissal.
Keep save status in its localized tooltip and accessible live description,
without visible text between the header icons.

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

## Localization before Phase 3

Provide English, German, and Norwegian Bokmål translations for the entire application,
including static controls/instructions, results, confirmations, storage and
JSON validation errors, chart tooltips, and accessibility labels. Keep the
Round Yoke product name, SI/IP/SF abbreviations, user-entered plan names, and
JSON fields unchanged.

Use an enlarged, flag-only header selector (UK, Germany, Norway) without a
visible label. Retain a localized accessible selector name and language names
for its options. Initially honor German browser locales and Norwegian `nb`/`no`
locales (Bokmål); otherwise fall back to English. Remember manual choices in localStorage when
available; denied preference storage must not prevent using the app.
Switch languages live without saving or dirtying plans, discarding unapplied
input, resetting instruction disclosure state, or changing pattern data.
Update already-visible errors and status messages in the chosen language.

Implemented: typed English-source message keys with German and Norwegian Bokmål
catalogs in `src/locales/de.ts` and `src/locales/nb.ts`, shared localization helpers
in `src/i18n.ts`, and structured
localized errors retaining message keys and parameters. Static HTML copy is
localized once registered; dynamic views redraw their labels on language changes.
Status/error bindings preserve live translation without changing plan state.
No dependency or plan-document migration is needed. Further languages add a
complete typed catalog and selector option.

Acceptance: browser detection, English fallback, remembered overrides,
unavailable preference storage, complete static-copy coverage, matching
translation placeholders, German/Bokmål confirmations/validation/accessibility,
unchanged JSON and saved status when switching, retained drafts and pattern
colors, accessible flag-only selection, and readable multilingual desktop/mobile layouts.

Phase 3 must reuse localization for printable headings, instructions, and
legends without translating user data or JSON schema fields.

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

Implemented in `src/print.ts`, integrated through `src/library.ts`. Download
printable HTML in the hamburger menu or use the accessible, localized header printer
emoji button to open an isolated print tab; neither
saves the plan. Reject unapplied calculator drafts, and provide download guidance
if the browser blocks pop-ups. Reuse the SVG preview with an explicit locale;
embed a bounded data-PNG for dense previews. All document copy is translated
into English, German, and Bokmål; user data remains unchanged.

Confirmed layout: portrait A4/US Letter-compatible panels, at most 40 columns
by 40 rounds, with 4 mm cells. Print each panel on a separate page, ordered
left-to-right within a round band and then top-to-bottom through round bands.
Repeat global row/column labels and include assembly guidance. Use 12 mm page
margins, 100% scale, background graphics, and no browser headers/footers.
Overview and long schedules can paginate naturally with repeated table headers.
Standalone documents include an inline native Print / Save as PDF button,
embedded styles/assets, escaped text, and a restrictive content security policy.

Acceptance: downloaded HTML opens without network access, content matches the
current applied plan, user text renders literally, charts remain legible across page
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
8. **Adding English, German, and Bokmål localization** (`multilingual-ui`): implement
   typed catalogs, browser detection, remembered live language switching, and
   a flag-only selector and translated UI/errors/accessibility, preserving plan state and JSON.
   Complete before Phase 3.
9. **Implementing printable HTML documents** (`printable-html`): generate
   standalone documents, paginate charts, support browser printing/PDF, and
   verify offline output. Depends on local-portability, multilingual-ui, and guided-calculator.
10. **Defining stitch ancestry and increase rules** (`ancestry-contract`):
   confirm technique, anchors, orientation, symmetry, layout limits, and legacy
   conversion policy with worked examples. Depends on printable-html.
11. **Implementing ancestry-aware planning** (`ancestry-planner`): implement
    lineage, chart/preview alignment, document migrations, and updated exports
    with focused compatibility tests. Depends on ancestry-contract.
12. **Adding guided stitch selections** (`guided-calculator`): implement IP
    presets and constrained SI/SF dropdowns, cascade to smallest valid choices,
    preserve explicit Apply and legacy plans, and validate complete workflows.
    Complete before Phase 3.
13. **Adding header save and print shortcuts** (`header-shortcuts`): enable
    direct saving of named plans, prompt unnamed plans, move the printer emoji
    action to the header, and validate focus, errors, imports/reloads, and
    localization. Complete; depends on local-portability and printable-html.
14. **Adding the plan menu and focused dialogs** (`plan-menu`): implement the
    seven-entry hamburger menu, Load/Manage lists, independent Save-as copies,
    transactional naming, filesystem/drop imports, and browser verification.
    Complete; depends on header-shortcuts.
15. **Preserving colors across geometry changes** (`preserve-chart-colors`):
    remap by round/real-stitch ordinal, confirm exact losses, allow lossless
    reductions and growth, retain no recovery history, and validate model,
    browser, preview, and JSON behavior. Complete; depends on pattern-state
    and guided-calculator.
16. **Adding initial and final plain rounds** (`plain-rounds`): implement
    optional SI/SF sections, independent increase timing, continuous/section
    numbering, edge-aware color remapping, persistence, printing, and focused
    validation. Complete; depends on preserve-chart-colors and printable-html.
17. **Reversing preview stitch direction** (`preview-direction`): reverse
    vector/raster mapping and markers, retain sector centering and stored
    colors, and verify chart/preview and printable orientation. Complete;
    depends on plain-rounds.
18. **Adding chart editing tools** (`chart-editing`): implement expanded modal
    editing, confirmed clearing, pointer/touch/keyboard rectangle selection,
    in-tab ordinal cut/copy/paste with clipping confirmation, palette reuse,
    localization, and persistence/regression validation. Complete; depends on
    preview-direction.
19. **Compacting the chart header** (`compact-chart-header`): combine segment
    controls and icons in one row, remove visible supporting text and feedback
    reservation, retain accessibility/errors, and verify multilingual layouts.
    Complete; depends on chart-editing.
20. **Adding expanded yoke preview** (`preview-fullscreen`): add top-right
    expansion beside the mode badge, preserve controls/state and aspect ratio,
    restore panel/focus, localize, and verify mobile, empty, and printed previews.
    Complete; depends on compact-chart-header.

## Scope exclusions and considerations

No server storage, authentication, synchronization, undo/redo, gauge inputs,
physical tension/drape simulation, or painting tools beyond the confirmed
rectangle clipboard operations in this roadmap.
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
