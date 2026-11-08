import { calculate, createGeometry } from './yoke';
import type { Inputs } from './yoke';
import { createPattern } from './pattern';
import type { Color, Pattern } from './pattern';

export const MAX_DOCUMENT_BYTES = 1024 * 1024;
export const MAX_PLAN_NAME = 100;

export interface PlanDocument {
  format: 'round-yoke-planner';
  version: 1;
  layoutModel: 'schematic-v1';
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  inputs: Inputs;
  segments: number;
  visibleSegments: number;
  background: string;
  selected: string | null;
  colors: Color[];
  cells: { round: number; column: number; colorId: string }[];
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The plan must contain valid JSON objects.');
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new Error('The plan contains an invalid whole number.');
  }
  return value;
}

function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new Error('The plan contains an invalid identifier.');
  }
  return value;
}

function hexColor(value: unknown): string {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new Error('Colors must use six-digit hexadecimal values.');
  }
  return value.toLowerCase();
}

export function planName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > MAX_PLAN_NAME) {
    throw new Error(`Enter a plan name from 1 to ${MAX_PLAN_NAME} characters.`);
  }
  return value.trim();
}

export function validateDocument(value: unknown): PlanDocument {
  const data = object(value);
  if (data.format !== 'round-yoke-planner') throw new Error('This is not a Round Yoke Planner document.');
  if (data.version !== 1) throw new Error('Unsupported plan version. Use a compatible version of the planner.');
  if (data.layoutModel !== 'schematic-v1') throw new Error('This planner cannot open that stitch layout model.');
  const inputs = object(data.inputs);
  const validatedInputs = {
    si: integer(inputs.si, 1), ip: integer(inputs.ip, 1), sf: integer(inputs.sf, 1),
  };
  const calculation = calculate(validatedInputs);
  const segments = integer(data.segments, 1);
  const geometry = createGeometry(calculation, segments);
  const visibleSegments = integer(data.visibleSegments, 1);
  if (visibleSegments > segments) throw new Error('Visible segments exceed the repeating segment count.');
  if (!Array.isArray(data.colors) || data.colors.length > 5000) {
    throw new Error('The palette must be an array with no more than 5,000 colors.');
  }
  const colorIds = new Set<string>();
  const colors = data.colors.map(value => {
    const entry = object(value);
    const id = identifier(entry.id);
    if (colorIds.has(id)) throw new Error('Palette color identifiers must be unique.');
    colorIds.add(id);
    return { id, value: hexColor(entry.value) };
  });
  const selected = data.selected === null ? null : identifier(data.selected);
  if (selected !== null && !colorIds.has(selected)) throw new Error('The selected color is missing from the palette.');
  if (!Array.isArray(data.cells) || data.cells.length > 5000) {
    throw new Error('Stitch assignments must be an array with no more than 5,000 entries.');
  }
  const active = geometry.rows.map(row => new Set(row.columns));
  const coordinates = new Set<string>();
  const cells = data.cells.map(value => {
    const cell = object(value);
    const round = integer(cell.round, 1);
    const column = integer(cell.column);
    const colorId = identifier(cell.colorId);
    if (!active[round - 1]?.has(column)) throw new Error('A color is assigned to a nonexistent stitch.');
    if (!colorIds.has(colorId)) throw new Error('A stitch references a missing palette color.');
    const key = `${round}:${column}`;
    if (coordinates.has(key)) throw new Error('Stitch coordinates must be unique.');
    coordinates.add(key);
    return { round, column, colorId };
  });
  const createdAt = integer(data.createdAt, 1);
  const updatedAt = integer(data.updatedAt, createdAt);
  if (updatedAt > 8_640_000_000_000_000) throw new Error('The plan contains an invalid timestamp.');
  return {
    format: 'round-yoke-planner', version: 1, layoutModel: 'schematic-v1',
    id: identifier(data.id), name: planName(data.name), createdAt, updatedAt,
    inputs: validatedInputs, segments, visibleSegments, background: hexColor(data.background),
    selected, colors, cells,
  };
}

export function serializeDocument(document: PlanDocument): string {
  const text = JSON.stringify(validateDocument(document), null, 2);
  if (new TextEncoder().encode(text).byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error('This plan exceeds the 1 MiB document limit. Reduce its palette before saving or exporting.');
  }
  return text;
}

export function parseDocument(text: string): PlanDocument {
  if (new TextEncoder().encode(text).byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error('Plan files must be no larger than 1 MiB.');
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('The file does not contain valid JSON.');
  }
  return validateDocument(value);
}

export function documentFromPattern(
  pattern: Pattern, metadata: Pick<PlanDocument, 'id' | 'name' | 'createdAt' | 'updatedAt'>,
): PlanDocument {
  return validateDocument({
    format: 'round-yoke-planner', version: 1, layoutModel: 'schematic-v1', ...metadata,
    inputs: {
      si: pattern.geometry.calculation.si,
      ip: pattern.geometry.calculation.ip,
      sf: pattern.geometry.calculation.sf,
    },
    segments: pattern.geometry.segments, visibleSegments: pattern.visibleSegments,
    background: pattern.background, selected: pattern.selected, colors: pattern.colors,
    cells: [...pattern.cells].map(([key, colorId]) => {
      const [round, column] = key.split(':').map(Number);
      return { round, column, colorId };
    }),
  });
}

export function patternFromDocument(document: PlanDocument): Pattern {
  const data = validateDocument(document);
  const pattern = createPattern(createGeometry(calculate(data.inputs), data.segments));
  pattern.colors = data.colors;
  pattern.cells = new Map(data.cells.map(cell => [`${cell.round}:${cell.column}`, cell.colorId]));
  pattern.background = data.background;
  pattern.selected = data.selected;
  pattern.visibleSegments = data.visibleSegments;
  return pattern;
}
