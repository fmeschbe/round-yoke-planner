import { isActive, sameGeometry } from './yoke';
import type { Geometry } from './yoke';

export interface Color {
  id: string;
  value: string;
}

export interface Pattern {
  geometry: Geometry;
  cells: Map<string, string>;
  colors: Color[];
  selected: string | null;
  background: string;
  visibleSegments: number;
}

export function cellKey(round: number, column: number): string {
  return `${round}:${column}`;
}

export function createPattern(geometry: Geometry): Pattern {
  return {
    geometry, cells: new Map(), colors: [], selected: null,
    background: '#ffffff', visibleSegments: 1,
  };
}

export function paint(pattern: Pattern, round: number, column: number): boolean {
  if (!isActive(pattern.geometry, round, column)) return false;
  const key = cellKey(round, column);
  const previous = pattern.cells.get(key);
  if (pattern.selected === null || previous === pattern.selected) {
    return pattern.cells.delete(key);
  }
  if (!pattern.colors.some(color => color.id === pattern.selected)) return false;
  pattern.cells.set(key, pattern.selected);
  return true;
}

export function addColor(pattern: Pattern, value: string): Color {
  const color = { id: crypto.randomUUID(), value };
  pattern.colors.push(color);
  pattern.selected = color.id;
  return color;
}

export function removeColor(pattern: Pattern, id: string): void {
  pattern.colors = pattern.colors.filter(color => color.id !== id);
  for (const [key, value] of pattern.cells) {
    if (value === id) pattern.cells.delete(key);
  }
  if (pattern.selected === id) pattern.selected = null;
}

export function changeColor(pattern: Pattern, id: string, value: string): void {
  const color = pattern.colors.find(color => color.id === id);
  if (color) color.value = value;
}

export function remapCells(pattern: Pattern, geometry: Geometry): { cells: Map<string, string>; lost: number } {
  const cells = new Map<string, string>();
  let lost = 0;
  for (const row of pattern.geometry.rows) {
    const round = row.section === 'initial'
      ? row.round + geometry.calculation.initialRounds - pattern.geometry.calculation.initialRounds
      : row.section === 'yoke' ? geometry.calculation.initialRounds + row.sectionRound
        : geometry.calculation.initialRounds + geometry.calculation.rounds + row.sectionRound;
    const target = geometry.rows[round - 1];
    const columns = target?.section === row.section ? target.columns : undefined;
    for (const [index, column] of row.columns.entries()) {
      const color = pattern.cells.get(cellKey(row.round, column));
      if (color === undefined) continue;
      const next = columns?.[index];
      if (next === undefined) lost++;
      else cells.set(cellKey(round, next), color);
    }
  }
  return { cells, lost };
}

export function applyGeometry(pattern: Pattern, geometry: Geometry): boolean {
  if (sameGeometry(pattern.geometry, geometry)) return false;
  const { cells } = remapCells(pattern, geometry);
  pattern.geometry = geometry;
  pattern.cells = cells;
  pattern.visibleSegments = Math.min(pattern.visibleSegments, geometry.segments);
  return true;
}

export function colorAt(pattern: Pattern, round: number, column: number): string {
  const id = pattern.cells.get(cellKey(round, column));
  return pattern.colors.find(color => color.id === id)?.value ?? pattern.background;
}
