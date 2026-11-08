import { calculate } from './yoke';
import type { Inputs } from './yoke';

export const DEFAULT_INPUTS: Inputs = { ip: 16, si: 64, sf: 160 };

interface Choice {
  value: number;
  fromPlan: boolean;
}

function choices(values: number[], fromPlan?: number): Choice[] {
  const result = values.map(value => ({ value, fromPlan: false }));
  if (fromPlan !== undefined && !values.includes(fromPlan)) result.push({ value: fromPlan, fromPlan: true });
  return result.sort((a, b) => a.value - b.value);
}

function retain(value: number, options: Choice[]): number {
  return options.some(option => option.value === value) ? value : options[0].value;
}

export function stitchSelections(draft: Inputs, applied: Inputs) {
  const ipOptions = choices([4, 8, 16, 32], applied.ip);
  const ip = retain(draft.ip, ipOptions);
  const siOptions = choices(
    Array.from({ length: 85 }, (_, i) => i + 16).filter(si => si % ip === 0),
    ip === applied.ip ? applied.si : undefined,
  );
  const si = retain(draft.si, siOptions);
  const sfOptions = choices(
    Array.from({ length: 201 }, (_, i) => i + 100).filter(sf => {
      if (sf < si || (sf - si) % (2 * ip) !== 0) return false;
      try {
        calculate({ ip, si, sf });
        return true;
      } catch {
        return false;
      }
    }),
    ip === applied.ip && si === applied.si ? applied.sf : undefined,
  );
  const sf = retain(draft.sf, sfOptions);
  return { values: { ip, si, sf }, options: { ip: ipOptions, si: siOptions, sf: sfOptions } };
}
