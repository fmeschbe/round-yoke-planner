import { describe, expect, it } from 'vitest';
import { DEFAULT_INPUTS, stitchSelections } from './calculator';
import { calculate } from './yoke';

describe('guided stitch selections', () => {
  it('offers only in-range divisible and reachable choices for each preset', () => {
    for (const ip of [4, 8, 16, 32]) {
      const initial = stitchSelections({ ...DEFAULT_INPUTS, ip }, DEFAULT_INPUTS);
      for (const { value: si } of initial.options.si) {
        expect(si).toBeGreaterThanOrEqual(16);
        expect(si).toBeLessThanOrEqual(100);
        expect(si % ip).toBe(0);
        const final = stitchSelections({ ip, si, sf: 160 }, DEFAULT_INPUTS);
        expect(final.options.sf.length).toBeGreaterThan(0);
        for (const { value: sf } of final.options.sf) {
          expect(sf).toBeGreaterThanOrEqual(100);
          expect(sf).toBeLessThanOrEqual(300);
          expect(() => calculate({ ip, si, sf })).not.toThrow();
        }
      }
    }
  });

  it('retains valid dependent selections and otherwise uses the smallest option', () => {
    expect(stitchSelections({ ip: 8, si: 64, sf: 160 }, DEFAULT_INPUTS).values)
      .toEqual({ ip: 8, si: 64, sf: 160 });
    expect(stitchSelections({ ip: 32, si: 48, sf: 144 }, DEFAULT_INPUTS).values)
      .toEqual({ ip: 32, si: 32, sf: 160 });
    expect(stitchSelections({ ip: 16, si: 16, sf: 160 }, DEFAULT_INPUTS).values.sf).toBe(112);
  });

  it('retains legacy values only while their upstream selections still match the current plan', () => {
    const applied = { ip: 2, si: 8, sf: 16 };
    const legacy = stitchSelections(applied, applied);
    expect(legacy.values).toEqual(applied);
    for (const field of ['ip', 'si', 'sf'] as const) {
      expect(legacy.options[field]).toContainEqual({ value: applied[field], fromPlan: true });
    }
    const changed = stitchSelections({ ...applied, ip: 32 }, applied);
    expect(changed.values).toEqual({ ip: 32, si: 32, sf: 160 });
    expect(changed.options.si.some(option => option.value === 8)).toBe(false);
    expect(changed.options.sf.some(option => option.value === 16)).toBe(false);
    const large = { ip: 128, si: 256, sf: 512 };
    expect(stitchSelections(large, large).values).toEqual(large);
  });

  it('excludes otherwise reachable final counts when no chart fits the slot budget', () => {
    const result = stitchSelections({ ip: 4, si: 20, sf: 300 }, DEFAULT_INPUTS);
    expect(result.options.sf.some(option => option.value === 300)).toBe(false);
    expect(result.values.sf).toBe(100);
  });
});
