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

1. Enter **SI** (initial stitches), **IP** (increase points per increase round),
   and **SF** (final stitches), then select **Calculate / Apply**.
2. Choose the number of **repeating segments**. The chart edits one segment;
   its colors repeat around the yoke.
3. Choose a new color and select **Add color**. Click a real stitch in the
   chart to paint it with the selected color.
4. Adjust **Visible segments**, or select **Full circle**, to explore the preview.
   Change **Background** to set the color of unpainted stitches.

Clicking a stitch with the same selected color clears it; another selected
color replaces it. The **Clear** tool removes a stitch's color. Editing a
palette color updates all its stitches; removing it clears those stitches.

Round 1 is at the top of the chart; read down through the rounds. Hatched slots
have no stitch and cannot be painted. Dashed marks indicate schematic increase
points; thicker borders mark schematic added stitches on increase rounds. Arrow keys move
between real stitches, Home/End move to the ends of a row, and Space/Enter paints.

Changing the applied inputs or repeating-segment count asks for confirmation
before clearing a nonempty pattern. The palette is retained. Changing only the
visible-segment count preserves the pattern.

**Plans are not saved yet.** All work stays in the current tab and is lost on
reload or closing the page. No plan data is sent to a server.

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
views can be collapsed to leave more room for the pattern.

## Development

```sh
npm test                 # Calculator and pattern-state tests
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

The generated `dist/` directory can be served by a static web host. Static
hosting does not require a plan-storage service.

## Roadmap

Phase 1, the schematic planner, is implemented. Later phases add:

1. IndexedDB storage and JSON import/export.
2. Standalone printable HTML and browser Save as PDF.
3. Stitch ancestry and explicit increase techniques.

Gauge and physical tension/drape modeling are outside the roadmap.
See [the implementation plan](docs/implementation-plan.md) for scope and
acceptance criteria.

## License

Licensed under the [Apache License, Version 2.0](LICENSE) (Apache-2.0).
