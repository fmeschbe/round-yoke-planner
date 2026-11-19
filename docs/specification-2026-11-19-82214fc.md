# Round Yoke Planner: implementation specification, 2026-11-19, 82214fc

## Status and scope

This document describes the implemented application as of November 19, 2026,
including commit `82214fc` (initial stitches up to 200). It is an as-built
product and technical specification, not a proposal or a release announcement.
It does not assert which version is running in any external deployment.

The planner calculates a round-yoke increase schedule, edits the colors of one
repeating segment, and previews that segment repeated around an annulus.
It runs entirely in the browser. The server delivers static application files
and does not store plans or perform calculations.

Implemented scope includes the schematic planner, browser-local library, JSON
portability, printable HTML/browser PDF, localization, rectangular editing,
expanded views, and static/container deployment configurations.

Stitch ancestry and explicit increase techniques are **parked**, not implemented.
Gauge, physical tension, drape simulation, accounts, synchronization, server-side
plan storage, undo/redo, and Markdown export are outside the current product.

## 1. Inputs and guided calculator

| Input | Meaning | Guided choices/default |
| --- | --- | --- |
| IP | Increase points around the full yoke | 4, 8, 16, 32; default 16 |
| SI | Initial stitches around the full yoke | Multiples of IP in 16–200; default 64 |
| SF | Final stitches around the full yoke | Reachable values in 100–300; default 160 |
| Initial plain rounds | Plain rounds before the increase section | Nonnegative integer; default 0 |
| Final plain rounds | Plain rounds after the increase section | Nonnegative integer; default 0 |

The controls are ordered IP, SI, SF. Changing an upstream choice retains a valid
dependent selection; otherwise the smallest available choice is selected.
Final choices also satisfy the calculation/chart feasibility checks.
Changes remain drafts until **Calculate / Apply**.

Saved/imported plans can contain mathematically valid counts outside the guided
ranges and IP presets. Such choices are labeled as coming from the current plan.
An exceptional SI remains available while its IP matches the applied plan;
an exceptional SF remains available while both IP and SI match.
The guided ranges are not hard limits on the document format.

Applying a calculation retains the current segment count if feasible; otherwise
a feasible count is selected. Invalid inputs produce localized feedback without
replacing the applied pattern.

## 2. Calculation model

SI, IP, and SF are positive JavaScript safe integers. IP is even and divides SI.
SF is at least SI. Define:

```text
A  = 2 * IP                         stitches added per increase round
K  = IP / 2                         increase interval
M  = (SF - SI) / A                  number of increase rounds
TR = M * K = (SF - SI) / 4          rounds in the increase section
T  = initialRounds + TR + finalRounds
```

SF − SI is divisible by A. Arithmetic results and total round counts remain
safe integers. The optional plain-round counts are nonnegative safe integers.

Increase-section round `r`, numbered from 1, has:

```text
stitches(r) = SI + A * floor(r / K)
increase(r) = (r mod K == 0)
```

The first increase is round K. There are K − 1 plain rounds between increases;
the last increase-section round is an increase round and reaches SF.
Initial plain rounds have SI stitches; final plain rounds have SF stitches.
Neither alters K, M, or TR.

If SI equals SF, TR is zero. Optional plain rounds can still form a chart and
preview; with no plain rounds there are no rows to display.

For example, SI = 64, IP = 8, SF = 160 gives K = 4, M = 6, TR = 24.
With two initial and three final plain rounds, T = 29.

## 3. Repeating-segment geometry

The editor displays one of S identical repeating segments.
When TR is nonzero, S is a divisor of `gcd(SI, 2 * IP)`.
When TR is zero, S is a divisor of SI.
Thus each displayed row contains an integral number of stitches per segment.

The fixed chart width is `W = SF / S`. Every row has W rectangular slots.
For a row with n real stitches per segment, the zero-based real stitch j occupies:

```text
column(j) = floor((j + 0.5) * W / n),  0 <= j < n
```

Unoccupied slots are blocked/no-stitch cells. They are not editable stitches.
Rows and stored round coordinates start at 1; columns start at 0.
The chart reads left-to-right and top-to-bottom.

A feasible chart has at most **5,000 rectangular slots**, including blocked
slots and all plain rounds: `W * T <= 5000`.
Infeasible segment counts are unavailable for editing. Calculations with no
feasible segment count are rejected. Divisor discovery is bounded to avoid
unlimited trial division on unusually large imported counts.

Rows carry a global round number, section (`initial`, `yoke`, `final`), and
section-local round number. The UI shows continuous global numbering with
localized section labels.

Increase markers and added-stitch borders are schematic. Added positions are
derived by projecting previous-row stitch centers into the new row and marking
the remaining positions. They do not encode actual stitch parents or a
particular knitting increase technique.

## 4. Geometry changes and color retention

Changing SI, IP, SF, plain-round counts, or S preserves surviving colors by
**section round and real-stitch ordinal**, not by grid column.
The fifth real stitch remains the fifth real stitch even if its column moves.
Changing S also changes the repetition of the retained segment around the yoke.

The chart stays anchored top-left. Width grows/shrinks at the right edge.
Increase-section and final-round retention use section-local row positions.
Initial rounds are inserted before row 1 and removed from the top; their colors
stay anchored nearest the yoke boundary. Final rounds are appended/removed at
the bottom.

The application computes the exact number of colored assignments that would
be lost before applying a change. Lossless changes need no confirmation.
Actual loss requires confirmation; cancel leaves the applied chart unchanged.
Confirmed removal is permanent: expanding later does not recover lost colors.
Palette, background, and selected paint tool survive geometry changes.
The visible-segment count is clamped if necessary.

## 5. Palette, painting, and chart editing

A new plan has an empty palette, white background, no colored assignments,
and one visible segment. Colors use six-digit hexadecimal RGB values and
independent identifiers.

Adding a color selects it. Painting assigns the selected palette entry.
Painting an already matching stitch clears its assignment; the Clear tool
also clears assignments. Unassigned stitches show the background color.
Editing a palette entry updates every stitch referencing it. Removing an entry
removes its assignments and clears its selection if necessary.

Arrow keys navigate real stitches; Home/End move to row boundaries, and
Space/Enter paints. Blocked slots cannot be painted.

### Rectangle clipboard

Rectangle selection supports mouse dragging, two corner clicks/taps, and
Shift + arrow keys. The visible rectangle may include blocked slots.
Copy records each selected row's real stitches in order as color values or
uncolored entries; empty selected rows remain represented. Blocked columns
do not become stitch entries in the clipboard.

Cut copies, then immediately clears assignments in the selected rectangle.
Paste starts at a selected destination, including a blocked slot, and maps each
source row onto real destination stitches at or after that column, skipping
blocked slots. It does not proportionally stretch or preserve blocked gaps.

Uncolored source entries clear destination assignments. Missing palette values
are added; matching values are reused. The selected paint tool is retained.
If colored entries do not fit, the exact omitted count requires confirmation.
The original clipboard remains intact. A paste that would exceed 5,000 palette
entries is rejected before mutation.

Ctrl/Cmd X/C/V work within the chart, without replacing normal text-input
shortcuts. Keyboard paste uses the selection's top-left corner or the focused
stitch. The clipboard stays in the current tab, works between plans, and is
neither the system clipboard nor saved/exported state.

Clear-all requires confirmation and removes assignments only, retaining the
geometry, palette, background, and selected tool.

### Expanded views and compact controls

The chart toolbar places the labeled segment selector and editing icons on one
row, separated into groups by vertical dividers. Narrow layouts can scroll the
toolbar horizontally. Supporting announcements remain accessible without
occupying visible header space; errors remain visible.

The chart's expand button sits right of its columns/rounds indicator.
Its modal view contains the existing chart, palette, and tools.
Escape cancels active selection/paste before exiting the expanded chart.
Return/Escape restores the panel and focus.
Expansion, selection, and copying do not themselves alter saved pattern data.

## 6. Yoke preview

The preview displays V consecutive segments, where `1 <= V <= S`.
Full circle sets V to S; partial sectors are centered at 6 o'clock.
Stitches progress counterclockwise, so bottom-centered sectors match the
chart's left-to-right order. A full circle starts at 12 o'clock.
Round 1 is the innermost band; rounds progress outward with equal radial depth.

For unequal SI/SF, inner radius / outer radius is SI/SF.
Equal counts use an explicitly arbitrary inner radius of 70% of the outer
radius to make plain rounds visible. Neither case models physical drape.
With no rows, an empty-state message replaces the drawing.

Up to 5,000 visible stitch instances are rendered as SVG paths. Denser displays
use a canvas-generated image embedded in SVG, bounded to 1,024 pixels per side.
Dense increase markers fall back to dashed increase-round bands rather than
unbounded individual markers.

The preview's expand button is right of the Sector/Full circle indicator.
Its modal view preserves visible-segment controls, aspect ratio, and state.
Returning or pressing Escape restores the original panel/focus.
Changing V is a saved plan setting; expansion alone is not.

## 7. Local library and unsaved state

The application stores plans manually in IndexedDB database
`round-yoke-planner`, version 1, in object store `plans`, keyed by plan ID.
Entries are listed by descending update time, with an ID tie-breaker.
The most recently saved plan reopens during initialization.

The header provides a floppy-disk Save button, a Print button, and a hamburger
menu with exactly these operations:

| Operation | Behavior |
| --- | --- |
| New | Default inputs and empty pattern; confirm discarding unsaved work |
| New from JSON | File chooser or single-file drop; validate before replacement |
| Load | Open an entry from the browser-local library |
| Save as | Name and save an independent copy; leave the original saved entry intact |
| Export JSON | Download the current applied editor plan without saving it |
| Export HTML | Download a standalone printable document |
| Manage plans | Rename or delete saved entries |

Save opens a naming dialog for unnamed plans; otherwise it writes the active
plan. The button is disabled while saving or already saved. Names are trimmed,
nonempty, and at most 100 characters. Calculator drafts must be applied before
saving/exporting the applied plan through the library actions.

Imports obtain a fresh identity and remain unsaved until saved locally.
Invalid imports leave the editor intact. Renaming a saved entry is transactional;
renaming another entry does not replace the editor. Deletion requires
confirmation. Deleting the active saved entry leaves its pattern in the editor
as unsaved work.

Save state tracks edits/revisions so a completed asynchronous save does not
silently mark newer edits as saved. Storage failures leave the pattern available
for editing/export. New/open/import operations guard against discarding unsaved
changes, and page unload requests a browser warning for dirty state or drafts.
No automatic draft recovery is provided.

Storage belongs to the browser profile and origin, including scheme and port.
There is no server copy or cross-device synchronization. A persistent-storage
request is available where supported, but browser data clearing, private mode,
or eviction can still affect availability. JSON backups remain necessary.

## 8. JSON document contract

Documents are UTF-8 JSON with a maximum serialized size of **1 MiB**.
The current discriminators are:

```json
{
  "format": "round-yoke-planner",
  "version": 1,
  "layoutModel": "schematic-v1",
  "id": "example-plan",
  "name": "Example yoke",
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000,
  "inputs": {
    "si": 64,
    "ip": 8,
    "sf": 160,
    "initialRounds": 0,
    "finalRounds": 0
  },
  "segments": 8,
  "visibleSegments": 1,
  "background": "#ffffff",
  "selected": null,
  "colors": [],
  "cells": []
}
```

`colors` entries contain `id` and `value`. `cells` entries contain `round`,
`column`, and `colorId`. Only assigned real stitches are stored.
Coordinates are global chart coordinates, not stitch ancestry or ordinals.

Validation checks supported discriminators, all calculation/geometry rules,
feasible segments, visible-segment bounds, and the following constraints:

- IDs contain 1–128 ASCII letters, digits, underscores, or hyphens.
- Palette IDs and assigned coordinates are unique.
- Colors are six-digit hexadecimal values, normalized to lowercase.
- The selected color is null or references an existing palette entry.
- Every assignment references an existing palette entry and an active stitch.
- Palette and assignment arrays contain at most 5,000 entries each.
- Timestamps are positive safe integers, updatedAt is at least createdAt, and
  timestamps fit the supported JavaScript date range.

Omitted initial/final plain-round counts normalize to zero.
Unsupported versions/layout models, malformed JSON, oversized files, and invalid
references are rejected. Serialization validates and emits pretty-printed JSON.
Selection rectangles, clipboard content, expanded views, interface language,
and unapplied calculator drafts are not part of this document.

## 9. Printable output

The header Print operation opens an HTML print view in a new tab.
HTML export downloads a self-contained offline document in the selected
interface language, using the current applied plan without saving it.

The document includes inputs, increase schedule, palette/background, repeated
segment instructions, embedded preview, and numbered chart panels.
Panels use 4 mm cells, at most 40 columns by 40 rounds, repeated labels, and
assembly instructions. Round order, blocked slots, section labels, and
schematic increase markings are preserved.

Printing targets portrait A4 or US Letter at 100% scale with background graphics
enabled and browser headers/footers disabled. PDF is produced by the browser's
Save as PDF facility, not a PDF service/library. If pop-ups are blocked, the
downloaded HTML remains an alternative. Printable HTML/PDF is not editable
import data; JSON is the portable editable format.

## 10. Localization and browser interface

Supported interface languages are English, German, and Norwegian Bokmål.
German browser locales initially choose German; `nb` and `no` choose Bokmål;
other locales choose English. Manual preference is remembered locally when
available. The header uses accessible, flag-only language controls.

Language changes preserve the current plan, drafts, colors, scroll position,
and disclosure state. Controls, generated instructions, validation, confirmations,
and accessibility labels are localized. Plan names, JSON field names, and
SI/IP/SF abbreviations remain language-independent.

The interface uses semantic HTML, native dialogs/popovers, accessible labels,
keyboard navigation, focus restoration, and live status/error announcements.
Chart/preview explanatory disclosures begin collapsed.
The supported browser acceptance suite exercises Chromium, Firefox, and WebKit.

Favicons, an Apple touch icon, and a minimal web manifest with standalone display
metadata are present in the source tree. No service-worker/offline application
cache is implemented. Offline printable HTML is separate from application
installation or offline availability.

## 11. Architecture and build

The implementation uses vanilla TypeScript and Vite without a UI framework.
Pure modules implement calculations, geometry, pattern remapping, document
validation, and clipboard mapping; DOM modules coordinate editing, library,
localization, preview, and print rendering.

Production output is generated into `dist/` with relative Vite asset references.
A static HTTPS host, or localhost for development, is sufficient; no application
API, database server, or server runtime is required.
The web manifest's icon URLs are root-relative, so arbitrary subpath hosting is
not universally covered by the relative Vite base setting.

The build command type-checks before bundling. Unit tests use Vitest, and browser
acceptance tests use Playwright. Setup and commands are documented in
[`README.md`](../README.md). The project is Apache-2.0 licensed.

## 12. Deployment and publishing

### Container

The multi-stage Dockerfile installs locked dependencies with npm in Node.js 24
Alpine, runs unit tests and the production build, and copies the generated
bundle into unprivileged Nginx. The runtime runs as UID/GID 101 on port 8080,
uses one worker, and logs to standard output/error.

`/healthz` returns HTTP 200. HTML uses `Cache-Control: no-cache`;
hashed `/assets/` responses use `public, max-age=31536000, immutable`.
Unknown paths return 404 rather than a client-router fallback.
The image declares a health check and supports a read-only root filesystem
with writable temporary `/tmp`. No persistent plan volume is required.
Podman Docker-format builds retain the image health check; Compose also defines
one explicitly.

The current Dockerfile copies `src/` and the build configuration but does not
copy `public/` into its build stage. Public-directory manifest/PWA assets present
in a normal repository build are consequently not included by that container
build. This records the current packaging boundary, not a guarantee of
equivalent installation metadata across hosting methods.

### Kubernetes and Helm

The raw manifest provides a Deployment and ClusterIP Service on port 80,
forwarding to container port 8080. It uses non-root/read-only execution,
dropped capabilities, no privilege escalation, RuntimeDefault seccomp, HTTP
health probes, and a 32 MiB memory-backed `/tmp`.
Default resources request 10m CPU/32 MiB memory and limit 250m CPU/64 MiB memory.

The local Helm chart is an alternative owner of these resources, not something
to apply on top of the raw manifest. It configures replicas, image repository/
tag/digest, pull policy/secrets, Service settings, and resources. A digest takes
precedence over a tag; an empty tag uses chart appVersion.
Ingress is off by default; enabling it requires a hostname and can reference an
existing Ingress class and TLS secret. The chart installs no controller or
certificate issuer and disables pod service-account-token mounting.

### Compose

Root `docker-compose.yml` builds the repository by default with image
`round-yoke-planner:local`. It binds 127.0.0.1:8080 to container port 8080.
`ROUND_YOKE_IMAGE`, `ROUND_YOKE_BIND_ADDRESS`, and `ROUND_YOKE_PORT` override
the image reference and host binding. Published images can be used without
building; full digest references are supported.

The service uses UID/GID 101, read-only root, temporary `/tmp`, dropped
capabilities, no-new-privileges, 64 MiB memory, 0.25 CPU, a health check, and
restart-unless-stopped. It creates no persistent volume.

### Release workflow

The GitHub workflow publishes multi-platform Linux AMD64/ARM64 images to
`ghcr.io/fmeschbe/round-yoke-planner` on **published GitHub Releases**, including
prereleases. Ordinary pushes, tags alone, draft releases, and release-note edits
do not trigger publication. Actions are SHA-pinned; authentication uses
`GITHUB_TOKEN` with contents-read/packages-write.

Tags include the release tag, semantic version when applicable, and full commit
SHA. Releases not marked as prereleases also update `latest`.
The workflow publishes containers only, not Helm packages, and never deploys
to a cluster or host. GHCR public visibility can require a one-time operator
setting after initial publication.

Operators provide HTTPS, reverse proxy/Ingress, cluster credentials, rollout
policy, and published version/digest selection. A stable origin is important:
container replacement preserves browser-local plans, whereas changing scheme,
hostname, or port changes access to that browser library.

## Related documents

- [README and operating instructions](../README.md)
- [Implementation plan and historical decisions](implementation-plan.md)
- [Original specification](initial-spec.md)
- [Consolidated session record](session-2026-11-19.md)
