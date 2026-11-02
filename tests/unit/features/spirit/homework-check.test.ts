import { describe, expect, it } from 'vitest';
import { checkHomework, homeworkTargets, parseQuantity } from '@/features/spirit/homework-check';
import type { Measurements } from '@/features/spirit/measure';
import { renderMarkdown } from '@/features/spirit/markdown';

const ch = (name: string, extra: Partial<Measurements['channels'][number]> = {}) => ({
  name, unit: 'V', min: 0, max: 5, pkpk: 5, initial: 0, final: 5, mean: 2.5,
  period: null, freq: null, tau: null, riseTime: null, overshootPct: null, ripple: null, ...extra,
});

describe('parseQuantity', () => {
  it.each([
    ['1m', 1e-3], ['1 ms', 1e-3], ['1ms', 1e-3], ['6.8k', 6800], ['6.8kHz', 6800], ['1meg', 1e6],
    ['1MHz', 1e6], ['2.2e-3', 2.2e-3], ['4.7u', 4.7e-6], ['4.7µs', 4.7e-6], ['100n', 1e-7],
    ['−10', -10], ['.5', 0.5], ['0,001', 0.001],
  ])('%s → %d', (s, v) => expect(parseQuantity(s)).toBeCloseTo(v as number, 12));
  it.each(['', 'abc', '1x', '--1'])('rejects %s', (s) => expect(parseQuantity(s)).toBeNull());
});

describe('homework check', () => {
  const m: Measurements = { analysis: 'tran', span: 8e-3, channels: [ch('v(in)'), ch('v(out)', { tau: 1.002e-3 })] };
  it('finds tau on the output channel', () => {
    const t = homeworkTargets(m);
    expect(t[0]).toMatchObject({ field: 'tau', on: 'v(out)' });
  });
  it('τ within ±5 % passes', () => {
    const r = checkHomework(homeworkTargets(m)[0], 1e-3);
    expect(r.pass).toBe(true);
    expect(Math.abs(r.errorPct)).toBeLessThan(1);
  });
  it('τ 20 % off fails with the right error', () => {
    const r = checkHomework(homeworkTargets(m)[0], 1.2e-3);
    expect(r.pass).toBe(false);
    expect(r.errorPct).toBeCloseTo(19.76, 1);
  });
  it('−3 dB frequency on AC results', () => {
    const ac: Measurements = { analysis: 'ac', span: 1e6, channels: [], ac: [{ name: 'v(out)', passbandDb: 0, peakDb: 0, peakHz: 10, f3dbHz: 1000, slopeDbPerDecade: -40, kind: 'low-pass' }] };
    const [t] = homeworkTargets(ac);
    expect(t.field).toBe('f3db');
    expect(checkHomework(t, 1020).pass).toBe(true);
  });
  it('gain compares magnitudes (inverting −10 counts)', () => {
    const g: Measurements = { analysis: 'tran', span: 3e-3, channels: [ch('v(in)', { pkpk: 1, freq: 1000 }), ch('v(out)', { pkpk: 10, freq: 1000 })] };
    const t = homeworkTargets(g).find((x) => x.field === 'gain')!;
    expect(checkHomework(t, -10).pass).toBe(true);
  });
  it('nothing measurable → no targets', () => {
    expect(homeworkTargets({ analysis: 'op', span: 0, channels: [], op: { 'v(1)': 1 } })).toEqual([]);
  });
});

describe('renderMarkdown', () => {
  it('escapes raw HTML from model output', () => {
    const html = renderMarkdown('**hi** <img src=x onerror=alert(1)>');
    expect(html).toContain('<strong>hi</strong>');
    expect(html).not.toContain('<img');
  });
});
