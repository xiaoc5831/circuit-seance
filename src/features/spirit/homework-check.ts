/**
 * Homework check: compare a student's hand-calculated value with what the
 * simulation measured. Pass = within ±5 %.
 */
import type { Measurements } from './measure';

export type HomeworkField = 'tau' | 'freq' | 'f3db' | 'gain';

export interface HomeworkTarget {
  field: HomeworkField;
  /** channel / trace the value was measured on */
  on: string;
  actual: number;
  unit: string;
}

export interface HomeworkResult {
  field: HomeworkField;
  expected: number;
  actual: number;
  errorPct: number;
  pass: boolean;
}

export const TOLERANCE_PCT = 5;

const PREFIX: Record<string, number> = {
  t: 1e12,
  g: 1e9,
  meg: 1e6,
  M: 1e6,
  k: 1e3,
  K: 1e3,
  '': 1,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

/**
 * Parse "1m", "1 ms", "6.8kHz", "2.2e-3", "1meg", "4.7µs", "−10" → number.
 * SPICE convention: "m" is milli, "M"/"meg" is mega. Trailing units (s, Hz, V, A) are ignored.
 */
export function parseQuantity(input: string): number | null {
  const s = input.trim().replace(/[−–]/g, '-').replace(/,/g, '.').replace(/\s+/g, '');
  const m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[TGMKkmuµμnpf]?)(s|sec|hz|v|a|ohm|Ω)?$/i);
  if (!m) return null;
  const [, num, rawPrefix, unit] = m;
  let prefix = rawPrefix;
  // "M" alone is mega; "m" alone is milli; but "MHz" style needs case kept, "meg" any case
  if (/^meg$/i.test(prefix)) prefix = 'meg';
  else if (prefix === 'T' || prefix === 't') prefix = 't';
  else if (prefix === 'G' || prefix === 'g') prefix = 'g';
  // a bare "f" with no unit is femto; "f" can't be a unit here
  const v = parseFloat(num) * (PREFIX[prefix] ?? 1);
  void unit;
  return isFinite(v) ? v : null;
}

/** What can be checked on this result, primary output channel first. */
export function homeworkTargets(m: Measurements): HomeworkTarget[] {
  const out: HomeworkTarget[] = [];
  if (m.analysis === 'ac' && m.ac?.length) {
    const a = m.ac.find((x) => /out/i.test(x.name)) ?? m.ac[m.ac.length - 1];
    if (a.f3dbHz) out.push({ field: 'f3db', on: a.name, actual: a.f3dbHz, unit: 'Hz' });
    return out;
  }
  const chans = [...m.channels].sort((a, b) => Number(/out|coll|n2/i.test(b.name)) - Number(/out|coll|n2/i.test(a.name)));
  const tauCh = chans.find((c) => c.tau && !c.freq);
  if (tauCh?.tau) out.push({ field: 'tau', on: tauCh.name, actual: tauCh.tau, unit: 's' });
  const fCh = chans.find((c) => c.freq);
  if (fCh?.freq) out.push({ field: 'freq', on: fCh.name, actual: fCh.freq, unit: 'Hz' });
  const input = m.channels.find((c) => /v\((in|sig)\)/i.test(c.name));
  const output = m.channels.find((c) => /out|coll/i.test(c.name));
  if (input && output && input.freq && output.freq && input.pkpk > 0) {
    out.push({ field: 'gain', on: `${output.name}/${input.name}`, actual: output.pkpk / input.pkpk, unit: '' });
  }
  return out;
}

export function checkHomework(target: HomeworkTarget, expected: number): HomeworkResult {
  // gains are compared by magnitude so "−10" and "10" both count for an inverting stage
  const exp = target.field === 'gain' ? Math.abs(expected) : expected;
  const errorPct = ((exp - target.actual) / target.actual) * 100;
  return {
    field: target.field,
    expected: exp,
    actual: target.actual,
    errorPct,
    pass: Math.abs(errorPct) <= TOLERANCE_PCT,
  };
}
