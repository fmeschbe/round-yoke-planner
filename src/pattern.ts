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

export function applyGeometry(pattern: Pattern, geometry: Geometry): boolean {
  if (sameGeometry(pattern.geometry, geometry)) return false;
  pattern.geometry = geometry;
  pattern.cells.clear();
  pattern.visibleSegments = Math.min(pattern.visibleSegments, geometry.segments);
  return true;
}

export function colorAt(pattern: Pattern, round: number, column: number): string {
  const id = pattern.cells.get(cellKey(round, column));
  return pattern.colors.find(color => color.id === id)?.value ?? pattern.background;
}
