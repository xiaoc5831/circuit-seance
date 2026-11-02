import { describe, expect, it } from 'vitest';
import {
  findPossessable,
  formatHuman,
  formatSpiceValue,
  parseSpiceNumber,
  sliderToValue,
  valueToSlider,
  withValue,
  SLIDER_MID,
} from '@/features/possess/possess';
import { ALL_CIRCUITS, findCircuit } from '@/features/haunted/catalog';

const RC = 'RC low-pass step response, tau = RC = 1 ms\nV1 in 0 PULSE(0 5 0 1n 1n 10m 20m)\nR1 in out 1k\nC1 out 0 1u ; timing cap\n.tran 5u 8m\n.end\n';

describe('possess: finding parts', () => {
  it('finds R, C, L with plain values and skips the title, sources and directives', () => {
    const parts = findPossessable(RC);
    expect(parts.map((p) => [p.name, p.kind, p.unit, p.line, p.value])).toEqual([
      ['R1', 'R', 'Ω', 2, 1000],
      ['C1', 'C', 'F', 3, 1e-6],
    ]);
  });
  it('a title line that starts with R (e.g. "RC low-pass") is never a part', () => {
    expect(findPossessable('RL circuit 10m 100\nR1 a 0 1k\n.op').map((p) => p.name)).toEqual(['R1']);
  });
  it('skips expressions, models and op-amp macro-model internals', () => {
    const net = 'x\nR1 a 0 {rval}\nRin inp inn 1e7\nC2 a 0 cmod\nL1 a b 10m\n';
    expect(findPossessable(net).map((p) => p.name)).toEqual(['L1']);
  });
  it('every bundled circuit offers at least one part', () => {
    for (const c of ALL_CIRCUITS) expect(findPossessable(c.netlist).length, c.id).toBeGreaterThan(0);
  });
});

describe('possess: SPICE numbers', () => {
  it.each([
    ['1k', 1e3],
    ['2.2u', 2.2e-6],
    ['10uF', 10e-6],
    ['1meg', 1e6],
    ['1Meg', 1e6],
    ['1M', 1e-3], // SPICE: M is milli
    ['1e7', 1e7],
    ['.5n', 0.5e-9],
  ])('%s → %d', (s, v) => expect(parseSpiceNumber(s)!).toBeCloseTo(v, 15));
  it('rejects junk', () => expect(parseSpiceNumber('cmod')).toBeNull());
  it.each([
    [1000, '1k'],
    [2.2e-6, '2.2u'],
    [1e6, '1Meg'],
    [4.7e3, '4.7k'],
    [253e-9, '253n'],
    [0.9999e-6, '1u'],
    [100, '100'],
  ])('format %d → %s', (v, s) => expect(formatSpiceValue(v)).toBe(s));
  it('formatted values round-trip through the parser', () => {
    for (let e = -14; e <= 11; e += 0.37) {
      const v = Number(Math.pow(10, e).toPrecision(3));
      expect(parseSpiceNumber(formatSpiceValue(v))! / v).toBeCloseTo(1, 6);
    }
  });
  it('human readout uses µ and M', () => {
    expect(formatHuman(2.2e-6, 'F')).toBe('2.2 µF');
    expect(formatHuman(1e6, 'Ω')).toBe('1 MΩ');
    expect(formatHuman(10e3, 'Ω')).toBe('10 kΩ');
  });
});

describe('possess: slider + rewrite', () => {
  it('log slider: middle is the original value, ends are ÷10 and ×10', () => {
    expect(sliderToValue(SLIDER_MID, 1e-6)).toBeCloseTo(1e-6, 15);
    expect(sliderToValue(0, 1e-6)).toBeCloseTo(1e-7, 15);
    expect(sliderToValue(100, 1e-6)).toBeCloseTo(1e-5, 15);
    expect(valueToSlider(2.2e-6, 1e-6)).toBe(67);
  });
  it('withValue rewrites only the value token and keeps the rest of the netlist byte for byte', () => {
    const c1 = findPossessable(RC).find((p) => p.name === 'C1')!;
    const out = withValue(RC, c1, 2.2e-6);
    expect(out).toBe(RC.replace('C1 out 0 1u ;', 'C1 out 0 2.2u ;'));
    // the rewritten part is still found, with the new value
    expect(findPossessable(out).find((p) => p.name === 'C1')!.value).toBeCloseTo(2.2e-6, 15);
  });
  it('works on a bundled classic (NE555 timing capacitor)', () => {
    const net = findCircuit('ne555-astable')!.netlist;
    const c1 = findPossessable(net).find((p) => p.name === 'C1')!;
    expect(withValue(net, c1, 22e-9)).toMatch(/^C1 thr 0 22n$/m);
  });
});
