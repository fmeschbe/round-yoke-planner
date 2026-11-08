import { describe, expect, it } from 'vitest';
import {
  documentFromPattern, MAX_DOCUMENT_BYTES, parseDocument, patternFromDocument,
  serializeDocument, validateDocument,
} from './document';
import { addColor, createPattern, paint } from './pattern';
import { calculate, createGeometry } from './yoke';

function fixture() {
  const pattern = createPattern(createGeometry(calculate({ si: 8, ip: 2, sf: 16 }), 4));
  addColor(pattern, '#123456');
  paint(pattern, 1, 0);
  paint(pattern, 2, 2);
  pattern.background = '#ffeedd';
  pattern.visibleSegments = 2;
  return documentFromPattern(pattern, { id: 'plan-1', name: 'My yoke', createdAt: 1000, updatedAt: 2000 });
}

describe('portable plan documents', () => {
  it('round-trips plain-section counts and their continuously numbered colored cells', () => {
    const pattern = createPattern(createGeometry(calculate({ si: 8, ip: 2, sf: 16, initialRounds: 2, finalRounds: 3 }), 4));
    addColor(pattern, '#123456');
    paint(pattern, 1, 1);
    paint(pattern, 3, 2);
    paint(pattern, 7, 3);
    const document = documentFromPattern(pattern, { id: 'plain-plan', name: 'Plain rounds', createdAt: 1000, updatedAt: 2000 });
    const restored = patternFromDocument(parseDocument(serializeDocument(document)));
    expect(restored.geometry.calculation.initialRounds).toBe(2);
    expect(restored.geometry.calculation.finalRounds).toBe(3);
    expect(restored.geometry.rows).toHaveLength(7);
    expect([...restored.cells]).toEqual([...pattern.cells]);
    expect(() => validateDocument({ ...document, inputs: { ...document.inputs, initialRounds: -1 } })).toThrow(/whole number/);
  });

  it('round-trips all editable data, with derived geometry recomputed', () => {
    const original = fixture();
    const parsed = parseDocument(serializeDocument(original));
    expect(parsed).toEqual(original);
    const restored = patternFromDocument(parsed);
    expect(restored.geometry.calculation.rounds).toBe(2);
    expect(restored.geometry.segments).toBe(4);
    expect(restored.colors).toEqual(original.colors);
    expect(restored.background).toBe('#ffeedd');
    expect(restored.visibleSegments).toBe(2);
    expect(restored.selected).toBe(original.selected);
    expect([...restored.cells]).toEqual(original.cells.map(cell => [`${cell.round}:${cell.column}`, cell.colorId]));
    expect(validateDocument({ ...original, rounds: 99999 })).not.toHaveProperty('rounds');
  });

  it('does not alias the active palette when capturing a save snapshot', () => {
    const original = fixture();
    const restored = patternFromDocument(original);
    const saved = documentFromPattern(restored, original);
    restored.colors[0].value = '#ffffff';
    expect(saved.colors[0].value).toBe('#123456');
  });

  it.each([
    ['version', 99, /version/],
    ['layoutModel', 'ancestry-v1', /layout model/],
    ['format', 'another-application', /not a Round/],
    ['selected', 'missing-color', /selected color/],
    ['background', '<script>', /hexadecimal/],
    ['segments', 8, /segment count/],
    ['visibleSegments', 5, /Visible segments/],
    ['name', ' ', /plan name/],
    ['createdAt', -1, /whole number/],
    ['updatedAt', 10, /whole number/],
  ])('rejects invalid %s', (key, value, message) => {
    expect(() => validateDocument({ ...fixture(), [key as string]: value })).toThrow(message as RegExp);
  });

  it('validates numerical reachability and the chart budget before accepting assignments', () => {
    const data = fixture();
    expect(() => validateDocument({ ...data, inputs: { si: 8, ip: 2, sf: 15 } })).toThrow(/divisible/);
    expect(() => validateDocument({ ...data, inputs: { si: 4998, ip: 2, sf: 5002 }, segments: 1 }))
      .toThrow(/5,000/);
  });

  it('rejects duplicate palette IDs, missing references, inactive cells and duplicate coordinates', () => {
    const data = fixture();
    expect(() => validateDocument({ ...data, colors: [data.colors[0], data.colors[0]] })).toThrow(/unique/);
    expect(() => validateDocument({ ...data, cells: [{ ...data.cells[0], colorId: 'missing' }] })).toThrow(/missing/);
    expect(() => validateDocument({ ...data, cells: [{ ...data.cells[0], column: 1 }] })).toThrow(/nonexistent/);
    expect(() => validateDocument({ ...data, cells: [{ ...data.cells[0], round: 100 }] })).toThrow(/nonexistent/);
    expect(() => validateDocument({ ...data, cells: [data.cells[0], data.cells[0]] })).toThrow(/unique/);
  });

  it('rejects malformed JSON and oversized files using UTF-8 byte size', () => {
    expect(() => parseDocument('{')).toThrow(/valid JSON/);
    expect(() => parseDocument('null')).toThrow(/objects/);
    expect(() => parseDocument(' '.repeat(MAX_DOCUMENT_BYTES + 1))).toThrow(/1 MiB/);
    expect(() => parseDocument('\u00e9'.repeat(MAX_DOCUMENT_BYTES / 2 + 1))).toThrow(/1 MiB/);
  });
});
