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
unapplied until **Calculate / Apply**.

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

Changing the applied inputs or repeating-segment count asks for confirmation
before clearing a nonempty pattern. The palette is retained. Changing only the
visible-segment count preserves the pattern.

### Saving, opening, and backing up plans

Saving is **manual**, using IndexedDB in your browser. No plan data is sent to
a server, and there is no automatic synchronization between devices.

Open **Your Plans** in the header to manage plans in an overlay dialog.
Select **Close** or press Escape to return to the editor.

- Enter a **Plan name** and select **Save plan** to store the applied yoke,
  palette, pattern, background, and preview settings. Apply changed calculator
  inputs before saving. Edit the name and Save again to rename that saved plan.
- Choose a saved entry and select **Open plan** to load it.
  The most recently saved plan reopens automatically
  on your next visit.
- Select **Delete saved plan** to delete its stored copy, after confirmation.
  Deleting the active saved copy keeps the current pattern in the tab, unsaved.
- **Export current plan as JSON** downloads the current applied editor plan,
  not the selected saved entry, without saving to IndexedDB.
- Under **New plan**, choose **New empty plan** for default stitch counts and
  no colors, or **New plan from JSON** to import a validated file. Both replace
  the current editor plan, confirming before discarding unsaved changes.
  Saved copies remain untouched. Imports remain unsaved until Save and never
  overwrite a saved plan with a matching ID. Documents are limited to **1 MiB**.

Opening or starting another plan asks before discarding unsaved changes.
Unsaved changes are not retained on reload. Saving errors leave the current
pattern available for editing and JSON export.

Plans belong to the current browser profile and website origin (including its
port). Clearing browser data can delete them; private-browsing storage may be
temporary. Use **Request persistent storage** under the local-storage
explanation to ask the browser to reduce eviction risk, but keep JSON backups
even if permission is granted.

### Calculation rules

- Inputs must be positive safe whole numbers; IP must be even and divide SI.
- Every increase point adds two stitches.
- Increase every `IP / 2` rounds, starting at round `IP / 2`. There are
  `IP / 2 - 1` plain rounds between increase rounds.
- SF must be at least SI, and `SF - SI` must be divisible by `2 * IP`.
- Total rounds are `TR = ((SF - SI) / (2 * IP)) * (IP / 2)`.
  The last round is the final increase; SI is not an extra chart row.
- Equal SI and SF give zero rounds.
- Repeating segments must evenly divide every round's stitch count.
- Charts are limited to 5,000 rectangular slots, including disabled slots.
  The planner selects a feasible segment count when one segment is too large.

For example, SI = 64, IP = 8, and SF = 160 give **24 rounds**, with six increase
rounds spaced four rounds apart.

The preview and fixed chart slots are schematic. They do not model stitch
ancestry, a specific increase technique, gauge, tension, or physical drape.
Visible preview sectors are centered at 6 o'clock. Instructions above both
views are collapsed by default and can be expanded when needed.

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

## Roadmap

Phases 1 and 2, the schematic planner and browser-local plan library with JSON
import/export, are implemented. Later phases add:

- **Phase 3:** Standalone printable HTML and browser Save as PDF.
- **Phase 4:** Stitch ancestry and explicit increase techniques.

Gauge and physical tension/drape modeling are outside the roadmap.
See [the implementation plan](docs/implementation-plan.md) for scope and
acceptance criteria.

## License

Licensed under the [Apache License, Version 2.0](LICENSE) (Apache-2.0).
