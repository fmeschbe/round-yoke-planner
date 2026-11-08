import { patternFromDocument, validateDocument } from './document';
import type { PlanDocument } from './document';
import { getLanguage, t } from './i18n';
import type { Language, Message, Parameters } from './i18n';
import { colorAt } from './pattern';
import { Preview } from './preview';

export interface ChartPanel {
  firstColumn: number;
  lastColumn: number;
  firstRound: number;
  lastRound: number;
}

export function chartPanels(width: number, rounds: number): ChartPanel[] {
  const panels: ChartPanel[] = [];
  if (!rounds) return panels;
  for (let firstRound = 1; firstRound <= rounds; firstRound += 40) {
    for (let firstColumn = 1; firstColumn <= width; firstColumn += 40) {
      panels.push({
        firstColumn, lastColumn: Math.min(width, firstColumn + 39),
        firstRound, lastRound: Math.min(rounds, firstRound + 39),
      });
    }
  }
  return panels;
}

export function escapeHTML(value: string | number): string {
  const escapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, character => escapes[character]);
}

const styles = `
* { box-sizing: border-box; }
body { margin: 0 auto; padding: 24px; max-width: 960px; color: #263b35; background: #fff; font: 14px/1.5 system-ui, sans-serif; }
h1, h2, h3, p { margin-top: 0; }
h1 { overflow-wrap: anywhere; }
h2 { margin-top: 24px; }
.toolbar { padding: 12px; margin-bottom: 24px; border: 1px solid #bbc5bd; }
button { font: inherit; padding: 8px 12px; cursor: pointer; }
.metadata { font-size: 11px; overflow-wrap: anywhere; }
.inputs { display: flex; flex-wrap: wrap; gap: 16px; }
.inputs div { min-width: 120px; }
dt { font-weight: 600; } dd { margin: 0; }
.preview svg { display: block; width: 100%; height: 80mm; }
.legend { display: flex; flex-wrap: wrap; gap: 8px 20px; padding: 0; list-style: none; }
.legend li { display: inline-flex; align-items: center; gap: 8px; break-inside: avoid; }
.swatch { display: inline-block; width: 5mm; height: 5mm; border: .2mm solid #555; flex: none; }
.schedule { border-collapse: collapse; }
.schedule th, .schedule td { text-align: left; padding: 2px 16px 2px 0; }
thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; }
.chart-panel { margin: 24px 0; overflow-x: auto; }
.chart { table-layout: fixed; border-collapse: collapse; font-size: 6pt; }
.chart caption { text-align: left; margin-bottom: 8px; font-size: 10pt; }
.chart th { font-weight: 500; text-align: center; height: 4mm; padding: 0; }
.chart thead th { font-size: 5pt; }
.chart td { position: relative; height: 4mm; padding: 0; border: .15mm solid #8a958d; text-align: center; }
.chart .no-stitch { background: repeating-linear-gradient(135deg, #e5e8e0, #e5e8e0 1mm, #bec7bc 1mm, #bec7bc 1.2mm); }
.chart .added-stitch { border: .6mm solid #285c4c; }
.chart .increase-point::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; border-left: .4mm dashed #285c4c; }
@page { margin: 12mm; }
@media print {
  body { max-width: none; margin: 0; padding: 0; font-size: 10pt; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .toolbar { display: none; }
  .chart-panel { break-before: page; page-break-before: always; break-inside: avoid; page-break-inside: avoid; margin: 0; overflow: visible; }
  .chart-panel h3 { font-size: 12pt; margin: 0 0 3mm; }
  .chart-panels-heading { break-after: avoid; }
  .preview { break-inside: avoid; }
}`;

export function printableHTML(value: PlanDocument, locale: Language = getLanguage()): string {
  const snapshot = validateDocument(value);
  const pattern = patternFromDocument(snapshot);
  const { geometry } = pattern;
  const calculation = geometry.calculation;
  const message = (key: Message, parameters: Parameters = {}) => t(key, parameters, locale);
  const text = (key: Message, parameters: Parameters = {}) => escapeHTML(message(key, parameters));
  const container = document.createElement('div');
  const description = document.createElement('p');
  new Preview(container, description, document.createElement('span'), pattern, locale).render();
  const panels = chartPanels(geometry.width, calculation.rounds);
  const schedule = geometry.rows.filter(row => row.increase).map(row =>
    `<tr><td>${row.round}</td><td>${row.stitches}</td></tr>`).join('');
  const legend = [
    `<li><span class="swatch" style="background:${pattern.background}"></span>${text('Background')}: ${pattern.background}</li>`,
    ...pattern.colors.map((color, index) =>
      `<li><span class="swatch" style="background:${color.value}"></span>${text('Color {number}: {color}', { number: index + 1, color: color.value })}</li>`),
  ].join('');
  const chart = panels.map((panel, index) => {
    const count = panel.lastColumn - panel.firstColumn + 1;
    const columns = Array.from({ length: count }, (_, i) => panel.firstColumn + i);
    const rows = geometry.rows.slice(panel.firstRound - 1, panel.lastRound).map(row => {
      const active = new Set(row.columns);
      const added = new Set(row.addedColumns);
      const markers = new Set<number>();
      if (row.increase) {
        const points = Math.ceil(calculation.ip / geometry.segments);
        for (let k = 0; k < Math.min(points, geometry.width); k++) {
          markers.add(points > geometry.width ? k : Math.floor(k * geometry.segments / calculation.ip * geometry.width));
        }
      }
      const cells = columns.map(number => {
        const column = number - 1;
        const exists = active.has(column);
        const addition = added.has(column) ? message('; schematic added stitch') : '';
        const color = colorAt(pattern, row.round, column);
        const label = exists
          ? text('Round {round}, column {column}: {color}{addition}', {
            round: row.round, column: number,
            color: pattern.cells.has(`${row.round}:${column}`) ? message('color {color}', { color }) : message('uncolored stitch'),
            addition,
          })
          : text('Round {round}, column {column}: no stitch', { round: row.round, column: number });
        const classes = ['stitch', !exists ? 'no-stitch' : '', added.has(column) ? 'added-stitch' : '', markers.has(column) ? 'increase-point' : '']
          .filter(Boolean).join(' ');
        return `<td class="${classes}" data-round="${row.round}" data-column="${column}" aria-label="${label}" title="${label}"${exists ? ` style="background-color:${color}"` : ''}>${exists ? '' : '×'}</td>`;
      }).join('');
      const label = text(row.increase ? '{stitches} stitches around the yoke; increase round' : '{stitches} stitches around the yoke; plain round', { stitches: row.stitches });
      return `<tr><th scope="row" title="${label}">${row.round}${row.increase ? ' +' : ''}</th>${cells}</tr>`;
    }).join('');
    return `<section class="chart-panel" data-panel="${index + 1}">
      <h3>${text('Panel {number} of {total}', { number: index + 1, total: panels.length })}</h3>
      <table class="chart" style="width:${10 + count * 4}mm">
        <caption>${text('Columns {firstColumn}–{lastColumn}; rounds {firstRound}–{lastRound}.', { ...panel })}</caption>
        <colgroup><col style="width:10mm"><col span="${count}" style="width:4mm"></colgroup>
        <thead><tr><th scope="col">${text('Round')}</th>${columns.map(column => `<th scope="col">${column}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
  }).join('');
  const fields = [
    ['Increase points', 'IP', calculation.ip], ['Initial stitches', 'SI', calculation.si],
    ['Final stitches', 'SF', calculation.sf], ['Total rounds', 'TR', calculation.rounds],
  ] as const;
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>${escapeHTML(snapshot.name)} - Round Yoke</title>
  <style>${styles}</style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">${text('Print / Save as PDF')}</button></div>
  <h1>${escapeHTML(snapshot.name)}</h1>
  <p class="metadata">${text('Document format: {format}; version {version}; layout {layout}.', { format: snapshot.format, version: snapshot.version, layout: snapshot.layoutModel })}<br>${text('Plan snapshot: {date}.', { date: new Date(snapshot.updatedAt).toISOString() })}</p>
  <dl class="inputs">${fields.map(([key, abbreviation, value]) => `<div><dt>${text(key)} (${abbreviation})</dt><dd>${value}</dd></div>`).join('')}</dl>
  <p>${text(calculation.interval === 1 ? '{si} to {sf} stitches. {increases} increase rounds, every {interval} round.' : '{si} to {sf} stitches. {increases} increase rounds, every {interval} rounds.', { si: calculation.si, sf: calculation.sf, increases: calculation.increases, interval: calculation.interval })}</p>
  <p>${text('Increase points are evenly spaced; each adds two stitches.')}</p>
  <p>${text('Repeat this chart {count} times around the yoke.', { count: geometry.segments })}</p>
  <p>${text('The preview is schematic, not a model of gauge, stitch ancestry, or tension.')}</p>
  <h2>${text('Yoke preview')}</h2>
  <div class="preview">${container.innerHTML}</div>
  <p>${escapeHTML(description.textContent ?? '')}</p>
  <h2>${text('Palette legend')}</h2>
  <ul class="legend">${legend}</ul>
  <h2>${text('Increase schedule')}</h2>
  ${schedule ? `<table class="schedule"><thead><tr><th scope="col">${text('Round')}</th><th scope="col">${text('Stitches')}</th></tr></thead><tbody>${schedule}</tbody></table>` : `<p>${text('No rounds to knit: initial and final stitches are equal.')}</p>`}
  <h2 class="chart-panels-heading">${text('Chart panels')}</h2>
  <p>${text('Print at 100% scale in portrait on A4 or US Letter. Enable background graphics and turn off browser headers and footers.')}</p>
  <p>${text('Arrange column panels left to right, then continue with the next round band. Match the repeated round and column labels. Round 1 is at the top.')}</p>
  <p>${text('Hatched cells have no stitch. Dashed marks show increase points. Thick borders mark schematic added stitches, not exact ancestry.')}</p>
  ${chart || `<p>${text('No rounds to knit: initial and final stitches are equal.')}</p>`}
</body>
</html>`;
}
