// @vitest-environment node
/**
 * Every bundled circuit through the real engine (ngspice-45 WASM via eecircuit-engine),
 * then through measure() and the offline spirit. Pins the numbers the explanations quote.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Simulation } from 'eecircuit-engine';
import { ALL_CIRCUITS, findCircuit } from '@/features/haunted/catalog';
import { measure, type Measurements } from '@/features/spirit/measure';
import { offlineExplanation } from '@/features/spirit/offline-explainer';
import type { SimResult } from '@/shared/types';
import { findPossessable, sliderToValue, withValue } from '@/features/possess/possess';

const results = new Map<string, Measurements>();
let sim: Simulation;

beforeAll(async () => {
  sim = new Simulation();
  await sim.start();
  for (const c of ALL_CIRCUITS) {
    sim.setNetList(c.netlist);
    const r = (await sim.runSim()) as unknown as SimResult;
    results.set(c.id, measure(r));
  }
}, 120_000);

const chan = (id: string, re: RegExp) => results.get(id)!.channels.find((c) => re.test(c.name))!;
const near = (x: number | null | undefined, target: number, tol: number) => {
  expect(x).not.toBeNull();
  expect(Math.abs((x as number) - target) / target).toBeLessThan(tol);
};

describe('bundled circuits simulate and measure as the spirit says', () => {
  it('every circuit produces data', () => {
    for (const c of ALL_CIRCUITS) {
      const m = results.get(c.id)!;
      expect(m.channels.length + (m.ac?.length ?? 0), c.id).toBeGreaterThan(0);
    }
  });
  it('RC low-pass: tau ≈ RC = 1 ms', () => near(chan('rc-lowpass', /out/).tau, 1e-3, 0.03));
  it('RL: tau ≈ L/R = 100 µs', () => near(chan('rl', /out/).tau, 100e-6, 0.1));
  it('RLC: rings near f0 = 1 kHz', () => near(chan('rlc-ringing', /n2/).freq, 1000, 0.1));
  it('op-amp inverting: gain ≈ -10', () => {
    const i = chan('opamp-inverting', /in\)/);
    const o = chan('opamp-inverting', /out/);
    near(o.pkpk / i.pkpk, 10, 0.03);
  });
  it('NE555: f ≈ 1.44/((RA+2RB)C) ≈ 6.86 kHz', () => near(chan('ne555-astable', /out/).freq, 6857, 0.12));
  it('Wien bridge: f ≈ 1/(2πRC) ≈ 995 Hz', () => near(chan('wien-bridge', /out/).freq, 995, 0.08));
  it('integrator: 5 V pk-pk triangle', () => near(chan('opamp-integrator', /out/).pkpk, 5, 0.1));
  it('RC ladder: low-pass with a −3 dB corner below 1.6 kHz', () => {
    const a = results.get('rc-ladder')!.ac!.find((x) => /out/.test(x.name))!;
    expect(a.kind).toBe('low-pass');
    expect(a.f3dbHz).toBeLessThan(1600);
  });
  it('offline spirit speaks both languages with three sections, no NaN', () => {
    for (const c of ALL_CIRCUITS) {
      for (const L of ['en', 'zh-CN'] as const) {
        const md = offlineExplanation(c.id, results.get(c.id)!, L);
        expect(md, `${c.id} ${L}`).not.toMatch(/NaN|undefined|Infinity/);
        expect(md.split('**').length, `${c.id} ${L}`).toBeGreaterThanOrEqual(7);
      }
    }
    expect(findCircuit('rc-lowpass')).toBeTruthy();
  });
});

describe('edited circuits: τ from an unsettled window', () => {
  it('RC with C = 2.2 µF in an 8 ms window → τ ≈ 2.2 ms (three-point fit)', async () => {
    const net = findCircuit('rc-lowpass')!.netlist.replace(/C1 out 0 1u/i, 'C1 out 0 2.2u');
    sim.setNetList(net);
    const m = measure((await sim.runSim()) as unknown as SimResult);
    near(m.channels.find((c) => /out/.test(c.name))!.tau, 2.2e-3, 0.03);
    expect(m.channels.find((c) => /in\)/.test(c.name))!.tau).toBeNull();
  });
});

describe('possess a component: the value change shows up in the measured physics', () => {
  const run = async (net: string) => {
    sim.setNetList(net);
    return measure((await sim.runSim()) as unknown as SimResult);
  };
  it('RC: possessing C1 at ×2.2 makes τ ≈ 2.2 ms (and ÷10 → 100 µs)', async () => {
    const net = findCircuit('rc-lowpass')!.netlist;
    const c1 = findPossessable(net).find((p) => p.name === 'C1')!;
    const up = await run(withValue(net, c1, sliderToValue(67, c1.value)));
    near(up.channels.find((c) => /out/.test(c.name))!.tau, 2.2e-3, 0.05);
    const down = await run(withValue(net, c1, sliderToValue(0, c1.value)));
    near(down.channels.find((c) => /out/.test(c.name))!.tau, 1e-4, 0.08);
  });
  it('NE555: RB 10k → 4.7k raises f to ≈ 1.44/((RA+2RB)C) ≈ 13.8 kHz', async () => {
    const net = findCircuit('ne555-astable')!.netlist;
    const rb = findPossessable(net).find((p) => p.name === 'RB')!;
    const m = await run(withValue(net, rb, 4.7e3));
    near(m.channels.find((c) => /out/.test(c.name))!.freq, 1.44 / ((1e3 + 2 * 4.7e3) * 10e-9), 0.15);
  });
});
