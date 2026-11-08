import { describe, expect, it } from 'vitest';
import { chartPanels, escapeHTML, printableHTML } from './print';
import type { PlanDocument } from './document';

describe('printable plans', () => {
  it('covers every chart coordinate once with bounded, labeled panels', () => {
    const panels = chartPanels(71, 70);
    expect(panels).toEqual([
      { firstColumn: 1, lastColumn: 40, firstRound: 1, lastRound: 40 },
      { firstColumn: 41, lastColumn: 71, firstRound: 1, lastRound: 40 },
      { firstColumn: 1, lastColumn: 40, firstRound: 41, lastRound: 70 },
      { firstColumn: 41, lastColumn: 71, firstRound: 41, lastRound: 70 },
    ]);
    const coordinates = panels.flatMap(panel =>
      Array.from({ length: panel.lastRound - panel.firstRound + 1 }, (_, row) =>
        Array.from({ length: panel.lastColumn - panel.firstColumn + 1 }, (_, column) =>
          `${panel.firstRound + row}:${panel.firstColumn + column}`)).flat());
    expect(new Set(coordinates).size).toBe(71 * 70);
    expect(coordinates.length).toBe(71 * 70);
    expect(chartPanels(5000, 1)).toHaveLength(125);
    expect(chartPanels(1, 5000)).toHaveLength(125);
    expect(chartPanels(Number.MAX_SAFE_INTEGER, 0)).toEqual([]);
  });

  it('escapes user-controlled text without interpreting markup or quotes', () => {
    expect(escapeHTML('<script>"Rød" & \'blue\'</script>'))
      .toBe('&lt;script&gt;&quot;Rød&quot; &amp; &#39;blue&#39;&lt;/script&gt;');
  });

  it('rejects incompatible snapshots before creating DOM or preview assets', () => {
    expect(() => printableHTML({ format: 'round-yoke-planner', version: 99 } as unknown as PlanDocument))
      .toThrow(/Unsupported plan version/);
  });
});
