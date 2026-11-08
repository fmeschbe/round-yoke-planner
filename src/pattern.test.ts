import { describe, expect, it } from 'vitest';
import { calculate, createGeometry } from './yoke';
import { addColor, applyGeometry, cellKey, changeColor, colorAt, createPattern, paint, removeColor } from './pattern';

function fixture() {
  return createPattern(createGeometry(calculate({ si: 8, ip: 2, sf: 16 }), 4));
}

describe('pattern editing', () => {
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

  it('retains identical geometry, but clears changed geometry while keeping the palette', () => {
    const pattern = fixture();
    const color = addColor(pattern, '#aabbcc');
    paint(pattern, 1, 0);
    pattern.visibleSegments = 4;
    expect(applyGeometry(pattern, fixture().geometry)).toBe(false);
    expect(pattern.cells.size).toBe(1);
    const next = createGeometry(pattern.geometry.calculation, 2);
    expect(applyGeometry(pattern, next)).toBe(true);
    expect(pattern.cells.size).toBe(0);
    expect(pattern.colors).toEqual([color]);
    expect(pattern.selected).toBe(color.id);
    expect(pattern.visibleSegments).toBe(2);
  });
});
