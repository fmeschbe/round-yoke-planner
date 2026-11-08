import { describe, expect, it } from 'vitest';
import { calculate, createGeometry, divisors, isActive, PlanError } from './yoke';

describe('round calculations', () => {
  it('starts on the interval and ends on the final increase', () => {
    const calculation = calculate({ si: 64, ip: 8, sf: 96 });
    const geometry = createGeometry(calculation, 1);
    expect(calculation.rounds).toBe(8);
    expect(geometry.rows.map(row => row.stitches)).toEqual([64, 64, 64, 80, 80, 80, 80, 96]);
    expect(geometry.rows.filter(row => row.increase).map(row => row.round)).toEqual([4, 8]);
  });

  it('increases on every round with two increase points', () => {
    const calculation = calculate({ si: 8, ip: 2, sf: 16 });
    expect(calculation.rounds).toBe(2);
    expect(createGeometry(calculation, 1).rows.map(row => row.stitches)).toEqual([12, 16]);
  });

  it('represents equal initial/final stitches without inventing a row', () => {
    const calculation = calculate({ si: 24, ip: 8, sf: 24 });
    expect(calculation.rounds).toBe(0);
    expect(calculation.segmentOptions.map(option => option.count)).toEqual([1, 2, 3, 4, 6, 8, 12, 24]);
    expect(createGeometry(calculation, 24).rows).toEqual([]);
  });

  it.each([
    [{ si: 0, ip: 2, sf: 16 }, 'si'],
    [{ si: 8.5, ip: 2, sf: 16 }, 'si'],
    [{ si: NaN, ip: 2, sf: 16 }, 'si'],
    [{ si: 8, ip: 0, sf: 16 }, 'ip'],
    [{ si: 9, ip: 3, sf: 15 }, 'ip'],
    [{ si: 9, ip: 2, sf: 17 }, 'si'],
    [{ si: 8, ip: 2, sf: 4 }, 'sf'],
    [{ si: 8, ip: 2, sf: 15 }, 'sf'],
    [{ si: 8, ip: 2, sf: Infinity }, 'sf'],
    [{ si: Number.MAX_SAFE_INTEGER + 1, ip: 2, sf: 16 }, 'si'],
    [{ si: 2 ** 52 + 2, ip: 2 ** 52 + 2, sf: 2 ** 52 + 2 }, 'ip'],
  ] as const)('rejects invalid inputs %j', (inputs, field) => {
    try {
      calculate(inputs);
      expect.fail('Expected invalid calculation to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(PlanError);
      expect((error as PlanError).field).toBe(field);
    }
  });
});

describe('segment and slot layout', () => {
  it('filters divisors using intermediate rounds, not just endpoints', () => {
    const calculation = calculate({ si: 8, ip: 2, sf: 16 });
    expect(calculation.segmentOptions.map(option => option.count)).toEqual([1, 2, 4]);
    expect(() => createGeometry(calculation, 8)).toThrow();
  });

  it('marks large charts unavailable while retaining feasible repeated charts', () => {
    const calculation = calculate({ si: 4000, ip: 2, sf: 4008 });
    expect(calculation.segmentOptions.find(option => option.count === 1)?.feasible).toBe(false);
    expect(() => createGeometry(calculation, 1)).toThrow();
    expect(() => calculate({ si: 2, ip: 2, sf: 20006 })).toThrow(/5,000/);
  });

  it('accepts exactly 5000 slots and rejects the next larger width', () => {
    const exact = createGeometry(calculate({ si: 4996, ip: 2, sf: 5000 }), 1);
    expect(exact.width * exact.rows.length).toBe(5000);
    const larger = calculate({ si: 4998, ip: 2, sf: 5002 });
    expect(() => createGeometry(larger, 1)).toThrow(/5,000/);
    expect(createGeometry(larger, 2).width).toBe(2501);
  });

  it('places the exact number of unique active columns in every row', () => {
    const calculation = calculate({ si: 64, ip: 8, sf: 160 });
    for (const option of calculation.segmentOptions.filter(option => option.feasible)) {
      const geometry = createGeometry(calculation, option.count);
      for (const row of geometry.rows) {
        expect(row.columns).toHaveLength(row.stitches / option.count);
        expect(new Set(row.columns).size).toBe(row.columns.length);
        expect(row.columns.every(column => column >= 0 && column < geometry.width)).toBe(true);
        expect(row.columns).toEqual([...row.columns].sort((a, b) => a - b));
      }
      expect(geometry.rows.at(-1)?.columns).toEqual(Array.from({ length: geometry.width }, (_, j) => j));
    }
  });

  it('keeps gaps inactive and rejects out-of-range coordinates', () => {
    const geometry = createGeometry(calculate({ si: 8, ip: 2, sf: 16 }), 4);
    expect(geometry.rows[0].columns).toEqual([0, 2, 3]);
    expect(isActive(geometry, 1, 1)).toBe(false);
    expect(isActive(geometry, 1, 2)).toBe(true);
    expect(isActive(geometry, 0, 0)).toBe(false);
    expect(isActive(geometry, 3, 0)).toBe(false);
  });

  it('factors large smooth integers without scanning their square root', () => {
    expect(divisors(2 ** 40)).toEqual(Array.from({ length: 41 }, (_, index) => 2 ** index));
  });
});
