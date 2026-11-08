# Round Yoke Planner

A browser-only knitting calculator and color-pattern editor for round yokes.
Calculate an increase schedule, paint one repeating segment, and preview it as
an annular sector or a full circle.

Built with TypeScript, Vite, semantic HTML, and SVG, without an application
framework or a backend. Dense previews use a bounded canvas image.

## Getting started

Use Node.js 22.12 or newer and npm.

```sh
git clone https://github.com/fmeschbe/round-yoke-planner.git
cd round-yoke-planner
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173`.

## Using the planner

Use the header's flag selector: **🇬🇧 English**, **🇩🇪 Deutsch**, or
**🇳🇴 Norsk (bokmål)**. The flags are enlarged, with accessible language names
and no visible label. German browser locales start in German; Norwegian `nb`
and `no` locales start in Bokmål; other locales start in English.
Your manual selection is remembered locally when browser storage is available.
Switching languages preserves the current plan, unapplied inputs, and unsaved
changes. Plan names, SI/IP/SF abbreviations, and JSON field names are unchanged.
Controls, instructions, errors, confirmations, and accessibility labels are
translated.

1. Choose **IP** (increase points) first: **4, 8, 16, or 32**, initially **16**.
   Select **SI** (initial stitches) from valid multiples of IP in **16–100**,
   then **SF** (final stitches) from reachable targets in **100–300**.
   Optionally add **Initial plain rounds** and **Final plain rounds**.
   Select **Calculate / Apply** to update the pattern.
2. Choose the number of **repeating segments**. The chart edits one segment;
   its colors repeat around the yoke.
3. Choose a new color and select **Add color**. Click a real stitch in the
   chart to paint it with the selected color.
4. Adjust **Visible segments**, or select **Full circle**, to explore the preview.
   Change **Background** to set the color of unpainted stitches.

New plans start with IP = 16, SI = 64, and SF = 160. Changing IP or SI retains
valid dependent selections; otherwise it selects the smallest valid option.
Final options also respect the chart-size limit. Dropdown changes remain
unapplied until **Calculate / Apply**, including changes to plain-round counts.

Initial plain rounds have SI stitches; final plain rounds have SF stitches.
They do not change the increase cadence or TR. The whole chart is numbered
continuously, with smaller I/Y/F labels distinguishing initial, yoke, and final
sections and their local round numbers (translated with the interface).
Initial rounds are added before the existing top row and removed from the top;
final rounds are added and removed at the bottom.

Saved/imported plans outside the presets or ranges still open unchanged.
Their extra values are labeled **from current plan** and retained while their
upstream selections still match that plan. The JSON format and mathematical
validation rules are unchanged.

Clicking a stitch with the same selected color clears it; another selected
color replaces it. The **Clear** tool removes a stitch's color. Editing a
palette color updates all its stitches; removing it clears those stitches.

Round 1 is at the top of the chart; read down through the rounds. Hatched slots
have no stitch and cannot be painted. Dashed marks indicate schematic increase
points; thicker borders mark schematic added stitches on increase rounds.
Arrow keys move between real stitches, Home/End move to the ends of a row,
and Space/Enter paints.

### Chart editing tools

The full-screen button sits beside the columns/rounds indicator. The segment
selector and editing tools share one compact row, with vertical dividers
separating the selector, clear-all action, and selection tools. Supporting text
and selection announcements are hidden from view but retained for screen readers;
errors remain visible. On very narrow screens, the toolbar scrolls horizontally.

Use **🖥️** to fill the browser viewport with the chart, palette, and editing
tools. **↩️** returns to the normal layout. Escape first cancels an active
selection/paste operation, then exits the expanded view.

**🧹** clears all placed colors after confirmation, retaining the chart size,
palette, background, and selected paint color.

Choose **🔲**, then drag or click/tap two opposite corners to select a rectangle,
including no-stitch slots. You can scroll between corner selections.
**Shift + arrow keys** also selects a rectangle. **📑** copies and **✂️** copies
then immediately clears the selected colors. **📋** starts paste mode; click/tap
the top-left destination, even if that slot is blocked. Ctrl/Cmd + C, X, and V
work within the chart; keyboard paste uses the current selection's top-left
corner, or the focused stitch when no rectangle is selected.

Paste preserves real-stitch order within each row, starting at the first
possible destination stitch at or after the chosen column and skipping blocked
slots. Uncolored source stitches clear their corresponding destination colors.
If colored stitches would fall beyond available rows/stitches, confirm the
exact omitted count or cancel. The clipboard keeps the whole original copy.
Matching palette colors are reused, missing colors are added, and the selected
paint color is unchanged. Pastes exceeding the 5,000-color palette limit are rejected.

The clipboard stays in this browser tab and works between plans; it is not the
system clipboard and is lost on reload. Selection, clipboard, and expanded-view
state are not saved or exported. Only resulting pattern edits mark a plan unsaved.

Changing the applied inputs or repeating-segment count preserves colors by
**section round and real-stitch position**, not grid column. The fifth real
stitch stays the fifth real stitch in its round, even if blocked-cell
rearrangement moves it left or right. The chart stays anchored top-left,
expanding/reducing on its right and bottom edges, except initial plain rounds
are prepended/removed at the top; new stitches are uncolored. Initial colors
stay anchored nearest the yoke; yoke and final colors retain their local round
positions when preceding sections change length.

Lossless changes apply without confirmation, including reductions. If colored
stitch positions or rounds disappear, the planner reports the exact number
before applying. Cancel preserves the applied chart; confirming removes only
those colors. Expanding again does **not** restore lost placements. Palette,
background, and selected color remain unchanged.

A larger rectangle can still lose real-stitch positions when SI, IP, or segment
count changes. Changing segments also changes how the retained repeat appears
around the yoke. JSON exports use the updated coordinates with the same format.
Changing only visible segments preserves the pattern.

### Saving, opening, and backing up plans

Saving is **manual**, using IndexedDB in your browser. No plan data is sent to
a server, and there is no automatic synchronization between devices.

Open the header's **☰ Your Plans** popup menu. Arrow keys move through its
entries; Escape or clicking outside dismisses it. Dialogs also close with
Cancel/Close or Escape.

The header's **💾** button saves a named plan directly. Its tooltip and accessible
description show whether the plan has unsaved changes or is already saved. For an
unnamed plan, it opens the naming dialog with the default name selected so you can
name it and save. Automatic default names count as unnamed; saved and imported
names count as named. The button is disabled while saving or when already saved.

- **New plan** starts with default stitch counts and no colors.
- **New plan from JSON** opens a file chooser/drop dialog. Select a file from
  your filesystem or drop one JSON plan into the drop area. Imports validate
  before replacing the editor, remain unsaved until Save, and receive a fresh
  ID rather than overwriting matching saved entries. File limit: **1 MiB**.
- **Load plan** shows saved plans. Choose an entry and select **Open plan**.
  The most recently saved plan reopens automatically on your next visit.
- **Save as** opens the naming dialog and saves a separate copy of the current
  applied yoke, palette, pattern, background, and preview settings. The original
  saved plan stays untouched; the copy becomes the active plan. Canceling leaves
  the current name and plan unchanged. Apply calculator changes before saving.
- **Export current plan as JSON** downloads the current applied editor plan,
  not the selected saved entry, without saving to IndexedDB.
- **Download printable HTML** downloads an offline reading/printing document.
- **Manage plans** lists saved entries for **Rename plan** or **Delete saved
  plan**. Renaming an inactive plan does not replace the editor. Deletion asks
  for confirmation; deleting the active saved copy keeps its pattern in the
  editor, unsaved.

Opening or starting another plan asks before discarding unsaved changes.
Unsaved changes are not retained on reload. Saving errors leave the current
pattern available for editing and JSON export.

Plans belong to the current browser profile and website origin (including its
port). Clearing browser data can delete them; private-browsing storage may be
temporary. Use **Request persistent storage** under the local-storage
explanation to ask the browser to reduce eviction risk, but keep JSON backups
even if permission is granted.

### Printing and PDF

Select the header's **🖨️** button to open the print view in a new tab.
In the **☰ menu**, select **Download printable HTML** for a standalone,
offline document. Both use the current
applied plan and interface language without saving it. Apply any draft
calculator changes first.

The document includes the increase schedule, palette and background, repeated
segment instructions, embedded preview, and numbered chart panels. Panels use
**4 mm cells**, with at most **40 columns × 40 rounds**, repeated labels, and
assembly guidance. Round 1 remains at the top; no-stitch cells, increase points,
and schematic added-stitch borders remain distinguishable.

Select **Print / Save as PDF** in the document. Choose portrait A4 or US Letter,
100% scale, background graphics enabled, and browser headers/footers disabled.
If pop-ups are blocked, allow them or download the HTML and open it locally.
Keep JSON backups for editable plans; printable HTML is a reading/printing
document, not an import format.

### Calculation rules

- Inputs must be positive safe whole numbers; IP must be even and divide SI.
- Every increase point adds two stitches.
- Increase every `IP / 2` rounds, starting at round `IP / 2`. There are
  `IP / 2 - 1` plain rounds between increase rounds.
- SF must be at least SI, and `SF - SI` must be divisible by `2 * IP`.
- Increase-section rounds are `TR = ((SF - SI) / (2 * IP)) * (IP / 2)`.
  Its last round is the final increase.
- Total chart rounds are `initialRounds + TR + finalRounds`. Both optional
  plain-round counts are nonnegative safe whole numbers and default to zero.
  JSON exports include these counts under `inputs`; omitted counts import as zero.
- Equal SI and SF give zero increase-section rounds; optional plain rounds
  still produce a chart and preview with explicitly arbitrary ring thickness.
- Repeating segments must evenly divide every round's stitch count.
- Charts are limited to 5,000 rectangular slots, including all plain rounds
  and disabled slots.
  The planner selects a feasible segment count when one segment is too large.

For example, SI = 64, IP = 8, and SF = 160 give **24 rounds**, with six increase
rounds spaced four rounds apart.

The preview and fixed chart slots are schematic. They do not model stitch
ancestry, a specific increase technique, gauge, tension, or physical drape.
Visible preview sectors are centered at 6 o'clock. Instructions above both
views are collapsed by default and can be expanded when needed.
Stitches progress counterclockwise, so bottom-centered sectors match the
chart's left-to-right order. Full circles start at 12 o'clock. Increase markers
and printable previews use the same orientation; stored colors are unchanged.

The preview's **🖥️** button sits to the right of its Sector/Full circle indicator.
It expands the preview with its visible-segment controls into the browser
viewport. **↩️** or Escape restores the normal layout without changing the pattern.

## Development

```sh
npm test                 # Calculator, pattern-state, and document tests
npm run typecheck        # TypeScript checks
npm run build            # Type-check and build into dist/
npm run preview          # Serve the production build locally
```

For browser acceptance tests:

```sh
npx playwright install --only-shell chromium firefox webkit
npm run test:browser -- --workers=3
```

The browser suite covers Chromium, Firefox, and WebKit and manages its own
local development server. No test server needs to be started manually.

### Adding translations

`src/i18n.ts` supplies typed message lookup, parameter interpolation, live UI
updates, and language-preference handling. English source messages are the
canonical keys; `src/locales/de.ts` and `src/locales/nb.ts` contain the German
and Norwegian Bokmål translations.
Static HTML text and labels are localized from those keys; generated content
uses `t`, and persistent status/error messages retain bindings for live updates.
Localized errors retain their key and parameters rather than relying on
browser-generated error text.

To add a language, provide a complete catalog with the same keys and parameter
placeholders, register it in `Language` and `catalogs`, and add its selector
option. Keep plan documents language-independent. Tests check static-copy
coverage, matching placeholders, language preferences, and plan preservation.

The generated `dist/` directory can be served by a static web host over HTTPS
(or localhost for development). Static hosting does not require a plan-storage
service.

## Container deployment

The multi-stage `Dockerfile` uses Node.js 24 LTS to install locked dependencies,
run unit tests, and type-check/build the application. The runtime contains only
the static bundle and unprivileged Nginx, listening on **8080** as UID/GID 101.
There is no Node.js runtime, plan-data backend, or persistent volume.
Nginx uses one worker, logs to standard output/error, and exposes `/healthz`.
HTML is revalidated on each visit; hashed assets can be cached for a year.

### Build and run locally

From the repository root, with Docker running:

```sh
docker build --pull -t round-yoke-planner:local .
docker run --rm --name round-yoke-planner \
  -p 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL --security-opt no-new-privileges \
  round-yoke-planner:local
```

Open `http://127.0.0.1:8080`; stop with Ctrl+C. For **Podman**, build with:

```sh
podman build --format docker --pull -t round-yoke-planner:local .
```

Then substitute `podman` for `docker` in the run command. Docker image format
retains the declared health check; Podman's default OCI format drops it.
On macOS, start your Podman machine first.
Neither build requires Node.js installed on the host.
The build targets your local architecture; the release workflow builds both
Linux AMD64 and ARM64. `--pull` refreshes the supported Node/Nginx base images.

### Publish a release to GHCR

[The container workflow](.github/workflows/container.yml) runs **only when a
GitHub Release is published**, including prereleases. Ordinary pushes, pushed
tags alone, draft releases, and release-note edits do not publish images.
It builds and validates both architectures, then pushes a multi-platform image
to `ghcr.io/fmeschbe/round-yoke-planner`. It does **not** deploy anything.
Actions are SHA-pinned; authentication uses `GITHUB_TOKEN` with repository-read
and package-write permissions, without a separate registry secret.

1. Commit and push the container/workflow changes so the release's commit
   contains them.
2. In GitHub, open **Releases → Draft a new release**, create a version tag
   such as `v0.1.0` targeting `main`, and generate/edit the release notes.
3. Select **Publish release**, then check the **Publish container** Actions run.

Alternatively, from an authenticated checkout:

```sh
gh release create v0.1.0 --target main --generate-notes
```

A release tagged `v0.1.0` produces tags `0.1.0`, `v0.1.0`, and
`sha-<full-commit-SHA>`. A stable release also updates `latest`.
For prereleases such as `v0.2.0-beta.1`, mark the GitHub release as
**a prerelease** (or use `gh release create ... --prerelease`); these do not
update `latest`.

**One-time public access:** new GHCR packages can be private even when their
source repository is public. After the first successful publication, open
your GitHub profile's **Packages → round-yoke-planner → Package settings**
and change its visibility to **Public**. Anonymous Docker/Kubernetes pulls
then need no registry credentials.

### Run a published image

After publishing and making the package public:

```sh
docker pull ghcr.io/fmeschbe/round-yoke-planner:0.1.0
docker run --rm --name round-yoke-planner \
  -p 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=32m \
  --cap-drop ALL --security-opt no-new-privileges \
  ghcr.io/fmeschbe/round-yoke-planner:0.1.0
```

Use an explicit release version for upgrades, or
`ghcr.io/fmeschbe/round-yoke-planner@sha256:<digest>` for an exact image.
The published digest appears in the Actions build summary.
Avoid `latest` for reproducible deployments. Docker/Podman automatically select
the matching architecture. Put the container behind your existing HTTPS reverse
proxy; the loopback binding above intentionally avoids exposing it directly.

### Kubernetes

[`deployment/kubernetes.yaml`](deployment/kubernetes.yaml) provides a Deployment
and ClusterIP Service, with non-root/read-only execution, resource limits,
health probes, and a memory-backed temporary directory. No persistent storage,
Ingress controller, TLS configuration, or cluster credentials are supplied.

Replace the example image `:0.1.0` with your published version or digest, then:

```sh
kubectl apply -f deployment/kubernetes.yaml
kubectl rollout status deployment/round-yoke-planner
kubectl port-forward service/round-yoke-planner 8080:80
```

The port-forward is for local verification. For normal access, connect your
existing Ingress/TLS setup to Service `round-yoke-planner`, port **80**, at the
website root. Use your usual namespace and deployment process.

### Helm

As an alternative to the raw Kubernetes manifest, install the local chart:

```sh
helm upgrade --install round-yoke-planner deployment/helm/round-yoke-planner \
  --namespace knitting --create-namespace \
  --set-string image.tag=0.1.0 \
  --wait
```

For local access, run
`kubectl -n knitting port-forward service/round-yoke-planner 8080:80`.
Do not apply the raw manifest and Helm chart to the same resources. The chart
defaults to its `appVersion` image tag, one replica, and a ClusterIP Service on
port 80, with the same health probes and restricted runtime.
[`values.yaml`](deployment/helm/round-yoke-planner/values.yaml) configures replicas,
image repository/tag/digest, pull policy/secrets, resources, and Service type/port.
An `image.digest` takes precedence over the tag.

Optional Ingress uses your existing controller and TLS secret:

```sh
helm upgrade --install round-yoke-planner deployment/helm/round-yoke-planner \
  --namespace knitting --create-namespace \
  --set-string image.tag=0.1.0 \
  --set ingress.enabled=true \
  --set-string ingress.className=nginx \
  --set-string ingress.host=knitting.example.org \
  --set-string ingress.tlsSecretName=round-yoke-tls \
  --wait
```

Replace the example hostname/class/secret with your environment's settings.
Ingress is disabled by default and serves the website root when enabled;
the chart does not install an Ingress controller or issue certificates.
The chart is supplied in the repository, not published by the container workflow.

### Docker Compose

[`docker-compose.yml`](docker-compose.yml) builds the local source by default:

```sh
docker compose build --pull
docker compose up -d --wait
docker compose logs -f
```

Open `http://127.0.0.1:8080`; stop/remove the deployment with
`docker compose down`. The service has a read-only filesystem, temporary `/tmp`,
non-root user, dropped capabilities, CPU/memory limits, and a health check.
It restarts unless explicitly stopped; no persistent volume is created.

To use a published image without building:

```sh
ROUND_YOKE_IMAGE=ghcr.io/fmeschbe/round-yoke-planner:0.1.0 \
  docker compose up -d --no-build --pull always --wait
```

`ROUND_YOKE_IMAGE` also accepts a full image digest reference.
`ROUND_YOKE_PORT` overrides the host port, and `ROUND_YOKE_BIND_ADDRESS`
overrides the default loopback address. Keep the service behind your existing
HTTPS reverse proxy. Use the same environment overrides for later Compose
commands. With a standalone Compose installation, use `docker-compose`
instead of `docker compose`; Podman users can use their configured Compose
provider. The explicit Compose health check also works with OCI-format images.

**Keep a stable website origin** (scheme, hostname, and port) across upgrades.
Plans remain in each browser's IndexedDB, not in these containers; changing
the origin makes the old browser library inaccessible from the new address.
Export JSON backups before moving to another origin. Use HTTPS outside localhost.

## Roadmap

Phases 1–3 are implemented: the schematic planner, browser-local library and
JSON portability, and standalone printable HTML with browser Save as PDF.
**Phase 4** (stitch ancestry and explicit increase techniques) is parked.
Container delivery is independent of that phase.

Gauge and physical tension/drape modeling are outside the roadmap.
See [the implementation plan](docs/implementation-plan.md) for scope and
acceptance criteria.

## License

Licensed under the [Apache License, Version 2.0](LICENSE) (Apache-2.0).
