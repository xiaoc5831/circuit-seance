/**
 * Waveform measurements per channel — what a lab TA would read off the screen.
 * Feeds the offline spirit, the LLM spirit (as a compact JSON digest, never raw arrays)
 * and the homework checker.
 */
import type { AnalysisType, SimResult } from '@/shared/types';
import { buildPlot, defaultChannelNames, sampleAt, type Trace } from '@/features/scope/scope-math';

export interface ChannelMeasure {
  name: string;
  unit: string;
  min: number;
  max: number;
  pkpk: number;
  initial: number;
  final: number;
  mean: number;
  /** dominant period from mean-crossings, if periodic */
  period: number | null;
  freq: number | null;
  /** first-order time constant estimate (63.2 % of a step) */
  tau: number | null;
  /** 10–90 % rise time */
  riseTime: number | null;
  /** overshoot above final value, % of step */
  overshootPct: number | null;
  /** ripple in the last 30 % of the run (pk-pk) */
  ripple: number | null;
}

export interface AcMeasure {
  name: string;
  passbandDb: number;
  peakDb: number;
  peakHz: number;
  f3dbHz: number | null;
  slopeDbPerDecade: number | null;
  kind: 'low-pass' | 'high-pass' | 'band-pass' | 'flat';
}

export interface Measurements {
  analysis: AnalysisType;
  span: number; // seconds or Hz range
  channels: ChannelMeasure[];
  ac?: AcMeasure[];
  op?: Record<string, number>;
}

const round = (x: number | null, sig = 4): number | null =>
  x == null || !isFinite(x) ? null : Number(x.toPrecision(sig));

function crossings(xs: Float64Array, ys: Float64Array, level: number, from = 0): number[] {
  const out: number[] = [];
  for (let i = Math.max(1, from); i < ys.length; i++) {
    if (ys[i - 1] < level && ys[i] >= level) {
      const f = (level - ys[i - 1]) / (ys[i] - ys[i - 1] || 1);
      out.push(xs[i - 1] + f * (xs[i] - xs[i - 1]));
    }
  }
  return out;
}

function firstCross(xs: Float64Array, ys: Float64Array, level: number, rising: boolean): number | null {
  for (let i = 1; i < ys.length; i++) {
    const a = ys[i - 1];
    const b = ys[i];
    if (rising ? a < level && b >= level : a > level && b <= level) {
      const f = (level - a) / (b - a || 1);
      return xs[i - 1] + f * (xs[i] - xs[i - 1]);
    }
  }
  return null;
}

export function measureTrace(t: Trace): ChannelMeasure {
  const { xs, ys } = t;
  const n = ys.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += ys[i];
  const mean = sum / Math.max(1, n);
  const initial = ys[0];
  const final = ys[n - 1];
  const pkpk = t.max - t.min;
  const tStart = xs[0];
  const tEnd = xs[n - 1];

  // periodicity: rising mean-crossings after the first 20 % of the run (skips start-up)
  let period: number | null = null;
  const settleIdx = Math.floor(n * 0.2);
  const cr = crossings(xs, ys, mean, settleIdx);
  if (cr.length >= 3 && pkpk > 1e-6) {
    const p = (cr[cr.length - 1] - cr[0]) / (cr.length - 1);
    if (p > 0 && p < (tEnd - tStart) / 2) period = p;
  }

  // step-like response: monotone-ish settle from initial to final
  let tau: number | null = null;
  let riseTime: number | null = null;
  let overshootPct: number | null = null;
  const step = final - initial;
  if (!period && Math.abs(step) > 0.2 * pkpk && Math.abs(step) > 1e-9) {
    const rising = step > 0;
    const t63 = firstCross(xs, ys, initial + 0.632 * step, rising);
    const t10 = firstCross(xs, ys, initial + 0.1 * step, rising);
    const t90 = firstCross(xs, ys, initial + 0.9 * step, rising);
    if (t63 != null) tau = t63 - tStart;
    // Window shorter than ~5τ: the trace has not settled, so 63 % of the *last* value
    // underestimates τ. Use the three-point exponential fit instead (exact for
    // y = V∞ − (V∞ − V0)·e^(−t/τ)): equally spaced samples y1, y2, y3 → τ = D / ln((y2−y1)/(y3−y2)).
    if (tau != null && tau * 5 > tEnd - tStart) {
      const t2 = firstCross(xs, ys, initial + 0.02 * step, rising) ?? tStart;
      const D = Math.min(tau, (tEnd - t2) / 2.05);
      const y1 = sampleAt(t, t2);
      const y2 = sampleAt(t, t2 + D);
      const y3 = sampleAt(t, t2 + 2 * D);
      if (y1 != null && y2 != null && y3 != null) {
        const r = (y2 - y1) / (y3 - y2);
        if (isFinite(r) && r > 1.05) tau = D / Math.log(r);
      }
    }
    if (t10 != null && t90 != null) riseTime = t90 - t10;
    const peak = rising ? t.max : t.min;
    const os = ((peak - final) / step) * 100;
    overshootPct = os > 0.5 ? os : 0;
  }

  // decaying step response that comes back (e.g. RL inductor voltage): tau from the peak
  if (!period && tau == null && pkpk > 1e-9) {
    const peakIsMax = Math.abs(t.max - final) >= Math.abs(t.min - final);
    const peak = peakIsMax ? t.max : t.min;
    let ip = 0;
    for (let i = 0; i < n; i++) if (ys[i] === peak) { ip = i; break; }
    const target = final + (peak - final) * 0.368;
    for (let i = ip + 1; i < n; i++) {
      if (peakIsMax ? ys[i] <= target : ys[i] >= target) {
        tau = xs[i] - xs[ip];
        break;
      }
    }
  }

  // edge of an ideal source (ns rise in a ms window) is not a time constant
  if (tau != null && tau < (tEnd - tStart) * 1e-3) tau = null;
  if (riseTime != null && riseTime < (tEnd - tStart) * 1e-3) riseTime = null;

  let ripple: number | null = null;
  const tailFrom = Math.floor(n * 0.7);
  if (n > 10) {
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = tailFrom; i < n; i++) {
      mn = Math.min(mn, ys[i]);
      mx = Math.max(mx, ys[i]);
    }
    ripple = mx - mn;
  }

  return {
    name: t.name,
    unit: t.unit,
    min: round(t.min)!,
    max: round(t.max)!,
    pkpk: round(pkpk)!,
    initial: round(initial)!,
    final: round(final)!,
    mean: round(mean)!,
    period: round(period),
    freq: period ? round(1 / period) : null,
    tau: round(tau),
    riseTime: round(riseTime),
    overshootPct: round(overshootPct, 3),
    ripple: round(ripple),
  };
}

function measureAc(t: Trace): AcMeasure {
  const { xs, ys } = t;
  const n = ys.length;
  let peakDb = -Infinity;
  let peakHz = xs[0];
  for (let i = 0; i < n; i++)
    if (ys[i] > peakDb) {
      peakDb = ys[i];
      peakHz = xs[i];
    }
  const lowDb = ys[0];
  const highDb = ys[n - 1];
  let kind: AcMeasure['kind'] = 'flat';
  if (lowDb - highDb > 6) kind = 'low-pass';
  else if (highDb - lowDb > 6) kind = 'high-pass';
  else if (peakDb - Math.max(lowDb, highDb) > 6) kind = 'band-pass';
  const passbandDb = kind === 'high-pass' ? highDb : kind === 'band-pass' ? peakDb : lowDb;
  let f3: number | null = null;
  const target = passbandDb - 3;
  if (kind === 'low-pass' || kind === 'flat' || kind === 'band-pass') {
    const startIdx = kind === 'band-pass' ? xs.indexOf(peakHz) : 0;
    for (let i = Math.max(1, startIdx); i < n; i++)
      if (ys[i - 1] >= target && ys[i] < target) {
        const f = (target - ys[i - 1]) / (ys[i] - ys[i - 1]);
        f3 = Math.pow(10, Math.log10(xs[i - 1]) + f * (Math.log10(xs[i]) - Math.log10(xs[i - 1])));
        break;
      }
  } else {
    for (let i = 1; i < n; i++)
      if (ys[i - 1] < target && ys[i] >= target) {
        const f = (target - ys[i - 1]) / (ys[i] - ys[i - 1]);
        f3 = Math.pow(10, Math.log10(xs[i - 1]) + f * (Math.log10(xs[i]) - Math.log10(xs[i - 1])));
        break;
      }
  }
  // roll-off slope over the last decade
  let slope: number | null = null;
  const fEnd = xs[n - 1];
  let j = n - 1;
  while (j > 0 && xs[j] > fEnd / 10) j--;
  if (j < n - 1 && xs[j] > 0) slope = (ys[n - 1] - ys[j]) / Math.log10(fEnd / xs[j]);
  return {
    name: t.name,
    passbandDb: round(passbandDb)!,
    peakDb: round(peakDb)!,
    peakHz: round(peakHz)!,
    f3dbHz: round(f3),
    slopeDbPerDecade: round(slope, 3),
    kind,
  };
}

export function measure(result: SimResult, hint?: AnalysisType | null, preferred?: string[]): Measurements {
  const names = defaultChannelNames(result, 4, preferred);
  const plot = buildPlot(result, names, hint);
  if (plot.analysis === 'op') {
    const op: Record<string, number> = {};
    for (const d of result.data) {
      const v = (d.values as unknown[])[0];
      if (typeof v === 'number') op[d.name] = round(v)!;
    }
    return { analysis: 'op', span: 0, channels: [], op };
  }
  if (plot.analysis === 'ac') {
    return {
      analysis: 'ac',
      span: plot.xMax - plot.xMin,
      channels: [],
      ac: plot.traces.map(measureAc),
    };
  }
  return {
    analysis: plot.analysis,
    span: round(plot.xMax - plot.xMin)!,
    channels: plot.traces.map(measureTrace),
  };
}
