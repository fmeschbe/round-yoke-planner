import { addColor, cellKey } from './pattern';
import type { Pattern } from './pattern';
import { LocalizedError } from './i18n';

export interface Rectangle {
  firstRound: number;
  lastRound: number;
  firstColumn: number;
  lastColumn: number;
}

export interface StitchClipboard {
  rows: (string | null)[][];
}

export function copyRectangle(pattern: Pattern, rectangle: Rectangle): StitchClipboard {
  return {
    rows: pattern.geometry.rows.slice(rectangle.firstRound - 1, rectangle.lastRound).map(row =>
      row.columns.filter(column => column >= rectangle.firstColumn && column <= rectangle.lastColumn).map(column => {
        const id = pattern.cells.get(cellKey(row.round, column));
        return pattern.colors.find(color => color.id === id)?.value ?? null;
      })),
  };
}

export function clearRectangle(pattern: Pattern, rectangle: Rectangle): boolean {
  let changed = false;
  for (const row of pattern.geometry.rows.slice(rectangle.firstRound - 1, rectangle.lastRound)) {
    for (const column of row.columns) {
      if (column >= rectangle.firstColumn && column <= rectangle.lastColumn) {
        if (pattern.cells.delete(cellKey(row.round, column))) changed = true;
      }
    }
  }
  return changed;
}

export function preparePaste(pattern: Pattern, clipboard: StitchClipboard, round: number, column: number) {
  const assignments: { round: number; column: number; color: string | null }[] = [];
  let omittedColors = 0;
  for (const [offset, colors] of clipboard.rows.entries()) {
    const target = pattern.geometry.rows[round + offset - 1];
    const columns = target?.columns.filter(candidate => candidate >= column) ?? [];
    for (const [index, color] of colors.entries()) {
      const destination = columns[index];
      if (destination === undefined) {
        if (color !== null) omittedColors++;
      } else {
        assignments.push({ round: round + offset, column: destination, color });
      }
    }
  }
  const available = new Set(pattern.colors.map(color => color.value));
  const missing = new Set(assignments.flatMap(cell => cell.color !== null && !available.has(cell.color) ? [cell.color] : []));
  return { assignments, omittedColors, paletteOverflow: missing.size > 0 && pattern.colors.length + missing.size > 5000 };
}

export function applyPaste(pattern: Pattern, paste: ReturnType<typeof preparePaste>): boolean {
  if (paste.paletteOverflow) throw new LocalizedError('Pasting would exceed 5,000 palette colors. Remove unused colors first.');
  let changed = false;
  const selected = pattern.selected;
  for (const { round, column, color } of paste.assignments) {
    const key = cellKey(round, column);
    if (color === null) {
      if (pattern.cells.delete(key)) changed = true;
      continue;
    }
    const previous = pattern.cells.get(key);
    const matching = pattern.colors.find(entry => entry.id === previous && entry.value === color)
      ?? pattern.colors.find(entry => entry.value === color)
      ?? addColor(pattern, color);
    if (previous !== matching.id) {
      pattern.cells.set(key, matching.id);
      changed = true;
    }
  }
  pattern.selected = selected;
  return changed;
}
