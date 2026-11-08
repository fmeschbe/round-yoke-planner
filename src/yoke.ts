import { LocalizedError } from './i18n';
import type { Message, Parameters } from './i18n';

export const MAX_CHART_SLOTS = 5000;

export interface Inputs {
  si: number;
  ip: number;
  sf: number;
  initialRounds?: number;
  finalRounds?: number;
}

export type InputField = keyof Inputs;

export class PlanError extends LocalizedError {
  constructor(message: Message, public field?: InputField, parameters: Parameters = {}) {
    super(message, parameters);
  }
}

export interface Calculation extends Inputs {
  initialRounds: number;
  finalRounds: number;
  interval: number;
  rounds: number;
  totalRounds: number;
  increases: number;
  segmentOptions: { count: number; feasible: boolean }[];
}

export interface Row {
  round: number;
  section: 'initial' | 'yoke' | 'final';
  sectionRound: number;
  stitches: number;
  columns: number[];
  increase: boolean;
  addedColumns: number[];
}

export interface Geometry {
  calculation: Calculation;
  segments: number;
  width: number;
  rows: Row[];
}

export function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function divisors(value: number): number[] {
  const factors: { prime: number; exponent: number }[] = [];
  let remaining = value;
  let attempts = 0;
  for (let p = 2; p <= remaining / p; p = p === 2 ? 3 : p + 2) {
    // Avoid unbounded trial division for unusually large safe-integer inputs.
    if (++attempts > 1_000_000) {
      throw new PlanError('These counts are too large to find segment options quickly. Use smaller stitch counts.');
    }
    if (remaining % p !== 0) continue;
    let exponent = 0;
    while (remaining % p === 0) {
      remaining /= p;
      exponent++;
    }
    factors.push({ prime: p, exponent });
  }
  if (remaining > 1) factors.push({ prime: remaining, exponent: 1 });
  let result = [1];
  for (const { prime, exponent } of factors) {
    const previous = result;
    result = [];
    let power = 1;
    for (let e = 0; e <= exponent; e++) {
      result.push(...previous.map(d => d * power));
      if (e < exponent) power *= prime;
    }
  }
  return result.sort((a, b) => a - b);
}

export function calculate(inputs: Inputs): Calculation {
  const { si, ip, sf } = inputs;
  const initialRounds = inputs.initialRounds === undefined ? 0 : inputs.initialRounds;
  const finalRounds = inputs.finalRounds === undefined ? 0 : inputs.finalRounds;
  for (const [field, value] of [['initialRounds', initialRounds], ['finalRounds', finalRounds]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new PlanError('Enter a nonnegative, safe whole number of plain rounds.', field);
    }
  }
  for (const field of ['si', 'ip', 'sf'] as const) {
    if (!Number.isSafeInteger(inputs[field]) || inputs[field] <= 0) {
      throw new PlanError('Enter a positive, safe whole number.', field);
    }
  }
  if (ip % 2 !== 0) throw new PlanError('Increase points must be even.', 'ip');
  if (si % ip !== 0) throw new PlanError('Initial stitches must divide evenly among increase points.', 'si');
  if (sf < si) throw new PlanError('Final stitches cannot be less than initial stitches.', 'sf');
  const added = ip * 2;
  if (!Number.isSafeInteger(added)) throw new PlanError('The increase count exceeds safe integer arithmetic.', 'ip');
  if ((sf - si) % added !== 0) {
    throw new PlanError('The difference must be divisible by {added} stitches per increase round.', 'sf', { added });
  }
  const interval = ip / 2;
  const increases = (sf - si) / added;
  const rounds = increases * interval;
  if (!Number.isSafeInteger(rounds)) throw new PlanError('The total rounds exceed safe integer arithmetic.');
  const totalRounds = rounds + initialRounds + finalRounds;
  if (!Number.isSafeInteger(totalRounds)) throw new PlanError('The total rounds exceed safe integer arithmetic.');
  if (totalRounds > MAX_CHART_SLOTS) {
    throw new PlanError('No chart fits the 5,000-slot limit: reduce the number of rounds.');
  }
  const counts = divisors(rounds === 0 ? si : gcd(si, added));
  const segmentOptions = counts.map(count => ({
    count,
    feasible: totalRounds === 0 || sf / count <= MAX_CHART_SLOTS / totalRounds,
  }));
  if (!segmentOptions.some(option => option.feasible)) {
    throw new PlanError('No segment count fits the 5,000-slot chart limit. Use smaller stitch counts or fewer rounds.');
  }
  return { ...inputs, initialRounds, finalRounds, interval, increases, rounds, totalRounds, segmentOptions };
}

export function createGeometry(calculation: Calculation, segments: number): Geometry {
  if (!calculation.segmentOptions.some(option => option.count === segments && option.feasible)) {
    throw new PlanError('Choose an available segment count within the 5,000-slot limit.');
  }
  const width = calculation.sf / segments;
  const rows: Row[] = [];
  for (let round = 1; round <= calculation.totalRounds; round++) {
    const section = round <= calculation.initialRounds ? 'initial'
      : round <= calculation.initialRounds + calculation.rounds ? 'yoke' : 'final';
    const sectionRound = section === 'initial' ? round : section === 'yoke'
      ? round - calculation.initialRounds : round - calculation.initialRounds - calculation.rounds;
    const stitches = section === 'initial' ? calculation.si : section === 'final' ? calculation.sf
      : calculation.si + 2 * calculation.ip * Math.floor(sectionRound / calculation.interval);
    const count = stitches / segments;
    const columns = Array.from({ length: count }, (_, j) => Math.floor((j + 0.5) * width / count));
    const increase = section === 'yoke' && sectionRound % calculation.interval === 0;
    let addedColumns: number[] = [];
    if (increase) {
      const previousCount = (stitches - 2 * calculation.ip) / segments;
      // Project previous stitch centers into the new row; the remaining slots are schematic additions.
      const inherited = new Set(Array.from(
        { length: previousCount }, (_, j) => Math.floor((j + 0.5) * count / previousCount),
      ));
      addedColumns = columns.filter((_, index) => !inherited.has(index));
    }
    rows.push({ round, section, sectionRound, stitches, columns, increase, addedColumns });
  }
  return { calculation, segments, width, rows };
}

export function sameGeometry(a: Geometry, b: Geometry): boolean {
  return a.segments === b.segments && a.calculation.si === b.calculation.si
    && a.calculation.ip === b.calculation.ip && a.calculation.sf === b.calculation.sf
    && a.calculation.initialRounds === b.calculation.initialRounds
    && a.calculation.finalRounds === b.calculation.finalRounds;
}

export function isActive(geometry: Geometry, round: number, column: number): boolean {
  return geometry.rows[round - 1]?.columns.includes(column) ?? false;
}
