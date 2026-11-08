export const MAX_CHART_SLOTS = 5000;

export interface Inputs {
  si: number;
  ip: number;
  sf: number;
}

export type InputField = keyof Inputs;

export class PlanError extends Error {
  constructor(message: string, public field?: InputField) {
    super(message);
  }
}

export interface Calculation extends Inputs {
  interval: number;
  rounds: number;
  increases: number;
  segmentOptions: { count: number; feasible: boolean }[];
}

export interface Row {
  round: number;
  stitches: number;
  columns: number[];
  increase: boolean;
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
    throw new PlanError(`The difference must be divisible by ${added} stitches per increase round.`, 'sf');
  }
  const interval = ip / 2;
  const increases = (sf - si) / added;
  const rounds = increases * interval;
  if (!Number.isSafeInteger(rounds)) throw new PlanError('The total rounds exceed safe integer arithmetic.');
  if (rounds > MAX_CHART_SLOTS) {
    throw new PlanError('No chart fits the 5,000-slot limit: reduce the number of rounds.');
  }
  const counts = divisors(rounds === 0 ? si : gcd(si, added));
  const segmentOptions = counts.map(count => ({
    count,
    feasible: rounds === 0 || sf / count <= MAX_CHART_SLOTS / rounds,
  }));
  if (!segmentOptions.some(option => option.feasible)) {
    throw new PlanError('No segment count fits the 5,000-slot chart limit. Use smaller stitch counts or fewer rounds.');
  }
  return { ...inputs, interval, increases, rounds, segmentOptions };
}

export function createGeometry(calculation: Calculation, segments: number): Geometry {
  if (!calculation.segmentOptions.some(option => option.count === segments && option.feasible)) {
    throw new PlanError('Choose an available segment count within the 5,000-slot limit.');
  }
  const width = calculation.sf / segments;
  const rows: Row[] = [];
  for (let round = 1; round <= calculation.rounds; round++) {
    const stitches = calculation.si + 2 * calculation.ip * Math.floor(round / calculation.interval);
    const count = stitches / segments;
    const columns = Array.from({ length: count }, (_, j) => Math.floor((j + 0.5) * width / count));
    rows.push({ round, stitches, columns, increase: round % calculation.interval === 0 });
  }
  return { calculation, segments, width, rows };
}

export function sameGeometry(a: Geometry, b: Geometry): boolean {
  return a.segments === b.segments && a.calculation.si === b.calculation.si
    && a.calculation.ip === b.calculation.ip && a.calculation.sf === b.calculation.sf;
}

export function isActive(geometry: Geometry, round: number, column: number): boolean {
  return geometry.rows[round - 1]?.columns.includes(column) ?? false;
}
