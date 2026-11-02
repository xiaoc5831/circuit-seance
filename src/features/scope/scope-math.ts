/**
 * Pure helpers for the CRT scope: turning a SimResult into plottable traces,
 * 1-2-5 auto-scaling, decimation and engineering-unit formatting.
 * Everything here is DOM-free so it can be unit-tested.
 */
import type { AnalysisType, SimResult } from '@/shared/types';

export const CHANNEL_COLORS = ['#39ff14', '#ffb000', '#4df3ff', '#ff5fd2'] as const;
export const DIVS_X = 10;
export const DIVS_Y = 8;

export interface Trace {
  name: string; // e.g. v(out)
  unit: 'V' | 'A' | 'dB' | '°';
  xs: Float64Array;
  ys: Float64Array;
  min: number;
  max: number;
}

export interface PlotModel {
  analysis: AnalysisType;
  xLabel: string; // 's' | 'Hz' | 'V'
  xLog: boolean;
  xMin: number;
  xMax: number;
  traces: Trace[];
}

export interface ChannelScale {
  perDiv: number;
  /** value shown at the vertical centre line */
  center: number;
}

const SEQ = [1, 2, 5];

/** Smallest 1-2-5 step ≥ x */
export function niceCeil(x: number): number {
  if (!isFinite(x) || x <= 0) return 1;
  const exp = Math.floor(Math.log10(x));
  for (let e = exp - 1; e <= exp + 1; e++) {
    for (const m of SEQ) {
      const v = m * Math.pow(10, e);
      if (v >= x * (1 - 1e-9)) return v;
    }
  }
  return 10 * Math.pow(10, exp);
}

/** Next/previous 1-2-5 step from the current one (for knobs). */
export function stepNice(current: number, dir: 1 | -1): number {
  const exp = Math.floor(Math.log10(current) + 1e-9);
  const mant = current / Math.pow(10, exp);
  const idx = SEQ.findIndex((m) => Math.abs(m - mant) < 1e-6);
  let i = (idx < 0 ? 0 : idx) + dir;
  let e = exp;
  if (i >= SEQ.length) {
    i = 0;
    e++;
  } else if (i < 0) {
    i = SEQ.length - 1;
    e--;
  }
  return SEQ[i] * Math.pow(10, e);
}

/** Auto scale so the trace fills ~6 of the 8 vertical divisions. */
export function autoScale(min: number, max: number): ChannelScale {
  let span = max - min;
  if (!isFinite(span)) return { perDiv: 1, center: 0 };
  if (span < 1e-12) span = Math.max(Math.abs(max) * 0.2, 1e-3);
  const perDiv = niceCeil(span / 6);
  const mid = (max + min) / 2;
  // snap the centre to half a division so the grid lines land on round numbers
  const center = Math.round(mid / (perDiv / 2)) * (perDiv / 2);
  return { perDiv, center };
}

function unitOf(name: string): Trace['unit'] {
  return /^i\(/i.test(name) ? 'A' : 'V';
}

function rangeOf(a: Float64Array): [number, number] {
  let mn = Infinity;
  let mx = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  return [mn, mx];
}

/** Detect analysis type from the result itself (time/frequency/sweep axis). */
export function analysisFromResult(r: SimResult, hint?: AnalysisType | null): AnalysisType {
  const first = r.data[0];
  if (r.numPoints <= 1) return 'op';
  if (first?.type === 'time' || first?.name === 'time') return 'tran';
  if (first?.type === 'frequency' || first?.name === 'frequency' || r.dataType === 'complex')
    return 'ac';
  return hint && hint !== 'op' ? hint : 'dc';
}

/** Node voltages first (skipping supply rails that never move), then currents. */
export function defaultChannelNames(r: SimResult, max = 4, preferred?: string[]): string[] {
  if (preferred?.length) {
    const have = new Set(r.data.map((d) => d.name.toLowerCase()));
    const ok = preferred.filter((p) => have.has(p.toLowerCase()));
    if (ok.length) return ok.slice(0, max);
  }
  const vars = r.data.slice(1);
  const scored = vars.map((d) => {
    const vals = d.values as unknown[];
    let spread = 0;
    if (typeof vals[0] === 'number') {
      const [mn, mx] = rangeOf(Float64Array.from(vals as number[]));
      spread = mx - mn;
    } else {
      spread = 1;
    }
    const isV = /^v\(/i.test(d.name);
    const internal = /\./.test(d.name); // subcircuit internals like v(x1.x)
    const preferOut = /out/i.test(d.name) ? 2 : /in\b|in\)/i.test(d.name) ? 1 : 0;
    return { name: d.name, score: (isV ? 10 : 0) + (spread > 1e-9 ? 5 : 0) + preferOut - (internal ? 20 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  // drop flat supply rails when something is actually moving
  const moving = scored.filter((s) => s.score >= 15);
  const picked = (moving.length ? moving : scored.filter((s) => s.score >= 10)).slice(0, max);
  // keep "in" before "out" for readability when both are picked
  return picked
    .map((p) => p.name)
    .sort((a, b) => (/in/i.test(a) && /out/i.test(b) ? -1 : /out/i.test(a) && /in/i.test(b) ? 1 : 0));
}

/** Build plottable traces for the selected variable names. */
export function buildPlot(r: SimResult, names: string[], hint?: AnalysisType | null): PlotModel {
  const analysis = analysisFromResult(r, hint);
  const axis = r.data[0];
  const traces: Trace[] = [];
  if (analysis === 'ac') {
    const freq = Float64Array.from(
      (axis.values as Array<number | { real: number; img: number }>).map((v) =>
        typeof v === 'number' ? v : v.real,
      ),
    );
    for (const name of names) {
      const d = r.data.find((x) => x.name === name);
      if (!d) continue;
      const vals = d.values as Array<number | { real: number; img: number }>;
      const ys = new Float64Array(vals.length);
      for (let i = 0; i < vals.length; i++) {
        const v = vals[i];
        const mag = typeof v === 'number' ? Math.abs(v) : Math.hypot(v.real, v.img);
        ys[i] = 20 * Math.log10(Math.max(mag, 1e-15));
      }
      const [mn, mx] = rangeOf(ys);
      traces.push({ name, unit: 'dB', xs: freq, ys, min: mn, max: mx });
    }
    const [fmin, fmax] = rangeOf(freq);
    return { analysis, xLabel: 'Hz', xLog: true, xMin: fmin, xMax: fmax, traces };
  }
  const xs = Float64Array.from(axis.values as number[]);
  for (const name of names) {
    const d = r.data.find((x) => x.name === name);
    if (!d || typeof (d.values as unknown[])[0] !== 'number') continue;
    const ys = Float64Array.from(d.values as number[]);
    const [mn, mx] = rangeOf(ys);
    traces.push({ name, unit: unitOf(name), xs, ys, min: mn, max: mx });
  }
  const [xMin, xMax] = rangeOf(xs);
  return {
    analysis,
    xLabel: analysis === 'tran' ? 's' : axis.name.startsWith('v') ? 'V' : axis.name,
    xLog: false,
    xMin,
    xMax,
    traces,
  };
}

/** Time/div (or sweep units/div) so the whole run fits in 10 divisions. */
export function autoTimePerDiv(xMin: number, xMax: number): number {
  return niceCeil((xMax - xMin) / DIVS_X);
}

/** Value of a trace at x (linear interpolation; xs must be ascending). */
export function sampleAt(t: Trace, x: number): number | null {
  const xs = t.xs;
  const n = xs.length;
  if (n === 0 || x < xs[0] || x > xs[n - 1]) return null;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid;
    else hi = mid;
  }
  const span = xs[hi] - xs[lo];
  if (span <= 0) return t.ys[lo];
  const f = (x - xs[lo]) / span;
  return t.ys[lo] + f * (t.ys[hi] - t.ys[lo]);
}

const PREFIXES: Array<[number, string]> = [
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];

/** 0.001 → "1 m", 2500 → "2.5 k" */
export function eng(value: number, unit = '', digits = 3): string {
  if (!isFinite(value)) return '—';
  if (value === 0) return `0 ${unit}`.trim();
  const a = Math.abs(value);
  for (const [scale, p] of PREFIXES) {
    if (a >= scale * 0.9995) {
      const v = value / scale;
      const s = Number(v.toPrecision(digits)).toString();
      return `${s} ${p}${unit}`.trim();
    }
  }
  return `${value.toExponential(2)} ${unit}`.trim();
}
