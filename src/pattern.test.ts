import { describe, expect, it } from 'vitest';
import { calculate, createGeometry } from './yoke';
import { addColor, applyGeometry, cellKey, changeColor, colorAt, createPattern, paint, remapCells, removeColor } from './pattern';

function fixture() {
  return createPattern(createGeometry(calculate({ si: 8, ip: 2, sf: 16 }), 4));
}

describe('pattern editing', () => {
  it('keeps final-section colors after the yoke when its length changes', () => {
    const inputs = { si: 8, ip: 2, sf: 16, initialRounds: 2, finalRounds: 2 };
    const pattern = createPattern(createGeometry(calculate(inputs), 4));
    addColor(pattern, '#aabbcc');
    paint(pattern, 3, 2);
    paint(pattern, 5, 0);
    paint(pattern, 6, 3);
    const expanded = createGeometry(calculate({ ...inputs, sf: 24 }), 4);
    expect(remapCells(pattern, expanded).lost).toBe(0);
    applyGeometry(pattern, expanded);
    expect([...pattern.cells.keys()]).toEqual(['3:3', '7:0', '8:3']);
  });

  it('prepends initial rows, appends final rows, and truncates only their outer edges', () => {
    const inputs = { si: 8, ip: 2, sf: 16, initialRounds: 2, finalRounds: 2 };
    const pattern = createPattern(createGeometry(calculate(inputs), 4));
    const color = addColor(pattern, '#aabbcc');
    for (const [round, column] of [[1, 1], [2, 3], [3, 2], [4, 3], [5, 0], [6, 3]]) paint(pattern, round, column);
    const expanded = createGeometry(calculate({ ...inputs, initialRounds: 3, finalRounds: 3 }), 4);
    expect(remapCells(pattern, expanded).lost).toBe(0);
    applyGeometry(pattern, expanded);
    expect([...pattern.cells.keys()]).toEqual(['2:1', '3:3', '4:2', '5:3', '6:0', '7:3']);
    const reduced = createGeometry(calculate({ ...inputs, initialRounds: 1, finalRounds: 1 }), 4);
    expect(remapCells(pattern, reduced).lost).toBe(2);
    applyGeometry(pattern, reduced);
    expect([...pattern.cells.keys()]).toEqual(['1:3', '2:2', '3:3', '4:0']);
    applyGeometry(pattern, expanded);
    expect([...pattern.cells.keys()]).toEqual(['3:3', '4:2', '5:3', '6:0']);
    expect(pattern.colors).toEqual([color]);
  });

  it('treats clear on an empty stitch as a no-op, and disables gaps', () => {
    const pattern = fixture();
    expect(paint(pattern, 1, 0)).toBe(false);
    addColor(pattern, '#aabbcc');
    expect(paint(pattern, 1, 1)).toBe(false);
    expect(pattern.cells.size).toBe(0);
  });

  it('sets, toggles, replaces, and explicitly clears colors', () => {
    const pattern = fixture();
    const first = addColor(pattern, '#aabbcc');
    expect(paint(pattern, 1, 0)).toBe(true);
    expect(pattern.cells.get(cellKey(1, 0))).toBe(first.id);
    paint(pattern, 1, 0);
    expect(pattern.cells.size).toBe(0);
    paint(pattern, 1, 0);
    const second = addColor(pattern, '#112233');
    paint(pattern, 1, 0);
    expect(pattern.cells.get(cellKey(1, 0))).toBe(second.id);
    pattern.selected = null;
    paint(pattern, 1, 0);
    expect(pattern.cells.size).toBe(0);
  });

  it('edits colors by ID and clears all references when removing a selected color', () => {
    const pattern = fixture();
    const color = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 0);
    paint(pattern, 2, 0);
    changeColor(pattern, color.id, '#112233');
    expect(colorAt(pattern, 1, 0)).toBe('#112233');
    expect(colorAt(pattern, 2, 0)).toBe('#112233');
    removeColor(pattern, color.id);
    expect(pattern.cells.size).toBe(0);
    expect(pattern.selected).toBeNull();
    expect(colorAt(pattern, 1, 0)).toBe('#ffffff');
  });

  it('preserves another selected color and its cells during removal', () => {
    const pattern = fixture();
    const first = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 0);
    const second = addColor(pattern, '#112233');
    paint(pattern, 2, 0);
    removeColor(pattern, first.id);
    expect(pattern.selected).toBe(second.id);
    expect(pattern.cells.size).toBe(1);
  });

  it('retains identical geometry and colors when expanding segments while keeping the palette', () => {
    const pattern = fixture();
    const color = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 0);
    pattern.visibleSegments = 4;
    expect(applyGeometry(pattern, fixture().geometry)).toBe(false);
    expect(pattern.cells.size).toBe(1);
    const next = createGeometry(pattern.geometry.calculation, 2);
    expect(applyGeometry(pattern, next)).toBe(true);
    expect(pattern.cells.get(cellKey(1, 0))).toBe(color.id);
    expect(pattern.colors).toEqual([color]);
    expect(pattern.selected).toBe(color.id);
    expect(pattern.visibleSegments).toBe(2);
  });

  it('moves colors by real-stitch position when expanding right and down, leaving new stitches clear', () => {
    const pattern = fixture();
    const first = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 2);
    const second = addColor(pattern, '#112233');
    paint(pattern, 2, 3);
    const next = createGeometry(calculate({ si: 8, ip: 2, sf: 24 }), 4);
    expect(remapCells(pattern, next).lost).toBe(0);
    expect(pattern.cells.get(cellKey(1, 2))).toBe(first.id);
    applyGeometry(pattern, next);
    expect([...pattern.cells]).toEqual([[cellKey(1, 3), first.id], [cellKey(2, 5), second.id]]);
    expect(pattern.geometry.rows).toHaveLength(4);
    expect(colorAt(pattern, 3, next.rows[2].columns[0])).toBe('#ffffff');
  });

  it('allows a lossless shrink even when an old grid column lies beyond the new chart edge', () => {
    const pattern = createPattern(createGeometry(calculate({ si: 8, ip: 2, sf: 24 }), 4));
    const color = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 5);
    expect(remapCells(pattern, fixture().geometry).lost).toBe(0);
    applyGeometry(pattern, fixture().geometry);
    expect([...pattern.cells]).toEqual([[cellKey(1, 3), color.id]]);
  });

  it('counts lost real-stitch positions even when the chart rectangle grows', () => {
    const pattern = createPattern(createGeometry(calculate({ si: 16, ip: 2, sf: 24 }), 4));
    const color = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 0);
    paint(pattern, 1, 5);
    paint(pattern, 2, 5);
    const next = createGeometry(calculate({ si: 8, ip: 2, sf: 24 }), 4);
    const result = remapCells(pattern, next);
    expect(result.lost).toBe(2);
    expect([...result.cells]).toEqual([[cellKey(1, 1), color.id]]);
    expect(pattern.cells.size).toBe(3);
    expect(pattern.geometry.rows).toHaveLength(2);
  });

  it('detects color loss from changed increase timing even with unchanged chart dimensions', () => {
    const pattern = createPattern(createGeometry(calculate({ si: 64, ip: 16, sf: 192 }), 4));
    const color = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 46);
    paint(pattern, 8, 47);
    const next = createGeometry(calculate({ si: 64, ip: 32, sf: 192 }), 4);
    expect(next.width).toBe(pattern.geometry.width);
    expect(next.rows.length).toBe(pattern.geometry.rows.length);
    const result = remapCells(pattern, next);
    expect(result.lost).toBe(1);
    expect([...result.cells]).toEqual([[cellKey(1, 46), color.id]]);
  });

  it('drops only removed positions and bottom rows, without restoring them when expanded again', () => {
    const geometry = createGeometry(calculate({ si: 8, ip: 2, sf: 24 }), 4);
    const pattern = createPattern(geometry);
    const color = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 3);
    paint(pattern, 3, 5);
    paint(pattern, 4, 5);
    expect(remapCells(pattern, fixture().geometry).lost).toBe(2);
    applyGeometry(pattern, fixture().geometry);
    expect([...pattern.cells]).toEqual([[cellKey(1, 2), color.id]]);
    applyGeometry(pattern, geometry);
    expect([...pattern.cells]).toEqual([[cellKey(1, 3), color.id]]);
    const empty = createGeometry(calculate({ si: 8, ip: 2, sf: 8 }), 4);
    expect(remapCells(pattern, empty).lost).toBe(1);
    applyGeometry(pattern, empty);
    applyGeometry(pattern, geometry);
    expect(pattern.cells.size).toBe(0);
    expect(pattern.colors).toEqual([color]);
  });
});
