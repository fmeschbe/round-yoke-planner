import { describe, expect, it } from 'vitest';
import { applyPaste, clearRectangle, copyRectangle, preparePaste } from './clipboard';
import { addColor, cellKey, createPattern, paint } from './pattern';
import { calculate, createGeometry } from './yoke';

function fixture() {
  const pattern = createPattern(createGeometry(calculate({ si: 8, ip: 2, sf: 16 }), 4));
  addColor(pattern, '#ff0000');
  paint(pattern, 1, 0);
  addColor(pattern, '#0000ff');
  paint(pattern, 1, 3);
  paint(pattern, 2, 3);
  return pattern;
}
const rectangle = { firstRound: 1, lastRound: 2, firstColumn: 0, lastColumn: 3 };

describe('rectangle clipboard', () => {
  it('rejects palette overflow before changing any destination stitch', () => {
    const pattern = createPattern(fixture().geometry);
    pattern.colors = Array.from({ length: 5000 }, (_, index) => ({
      id: `color-${index}`, value: `#${index.toString(16).padStart(6, '0')}`,
    }));
    pattern.cells.set('1:0', 'color-1');
    const paste = preparePaste(pattern, { rows: [['#000000', '#abcdef']] }, 1, 0);
    expect(() => applyPaste(pattern, paste)).toThrow(/5,000 palette/);
    expect([...pattern.cells]).toEqual([['1:0', 'color-1']]);
    expect(pattern.colors).toHaveLength(5000);
  });

  it('snapshots real-stitch order and blanks without consuming blocked columns', () => {
    const pattern = fixture();
    const clipboard = copyRectangle(pattern, rectangle);
    expect(clipboard.rows).toEqual([['#ff0000', null, '#0000ff'], [null, null, null, '#0000ff']]);
    pattern.colors[0].value = '#112233';
    expect(clipboard.rows[0][0]).toBe('#ff0000');
  });

  it('cuts only colored stitches inside the rectangle and retains palette and geometry', () => {
    const pattern = fixture();
    const geometry = pattern.geometry;
    expect(clearRectangle(pattern, { ...rectangle, lastRound: 1, lastColumn: 2 })).toBe(true);
    expect([...pattern.cells.keys()]).toEqual(['1:3', '2:3']);
    expect(pattern.colors).toHaveLength(2);
    expect(pattern.geometry).toBe(geometry);
    expect(clearRectangle(pattern, { ...rectangle, lastRound: 1, lastColumn: 2 })).toBe(false);
  });

  it('maps onto possible destination stitches and counts only omitted colors', () => {
    const pattern = fixture();
    const clipboard = copyRectangle(pattern, rectangle);
    const paste = preparePaste(pattern, clipboard, 1, 1);
    expect(paste.assignments).toEqual([
      { round: 1, column: 2, color: '#ff0000' }, { round: 1, column: 3, color: null },
      { round: 2, column: 1, color: null }, { round: 2, column: 2, color: null }, { round: 2, column: 3, color: null },
    ]);
    expect(paste.omittedColors).toBe(2);
    expect(pattern.cells.size).toBe(3);
    expect(applyPaste(pattern, paste)).toBe(true);
    expect([...pattern.cells.keys()]).toEqual(['1:0', '1:2']);
    expect(applyPaste(pattern, paste)).toBe(false);
  });

  it('keeps empty source rows and clips below the chart without mutating the clipboard', () => {
    const pattern = fixture();
    const clipboard = copyRectangle(pattern, { ...rectangle, lastColumn: 1 });
    expect(clipboard.rows).toEqual([['#ff0000'], [null, null]]);
    expect(copyRectangle(pattern, { ...rectangle, firstColumn: 1, lastColumn: 1 }).rows).toEqual([[], [null]]);
    expect(preparePaste(pattern, clipboard, 2, 0).omittedColors).toBe(0);
    expect(preparePaste(pattern, copyRectangle(pattern, rectangle), 2, 0).omittedColors).toBe(1);
    expect(clipboard.rows).toEqual([['#ff0000'], [null, null]]);
  });

  it('reuses matching colors and imports missing colors between plans without changing selection', () => {
    const source = fixture();
    const target = createPattern(source.geometry);
    const red = addColor(target, '#ff0000');
    const selected = target.selected;
    applyPaste(target, preparePaste(target, copyRectangle(source, rectangle), 1, 0));
    expect(target.colors.map(color => color.value)).toEqual(['#ff0000', '#0000ff']);
    expect(target.cells.get(cellKey(1, 0))).toBe(red.id);
    expect(target.selected).toBe(selected);
    expect(target.cells.size).toBe(3);
  });
});
