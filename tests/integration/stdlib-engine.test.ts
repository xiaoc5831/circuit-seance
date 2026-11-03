// @vitest-environment node
/**
 * The built-in library through the real engine: a netlist that only *instantiates* opamp / ne555 /
 * 1N4148 / 2N3904 must simulate after sanitizeNetlist, and behave like the hand-written models.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { Simulation } from 'eecircuit-engine';
import { sanitizeNetlist } from '@/features/simulate/sanitize';

let sim: Simulation;
beforeAll(async () => {
  sim = new Simulation();
  await sim.start();
}, 120_000);

async function run(net: string) {
  sim.setNetList(sanitizeNetlist(net).sanitized);
  const r = await sim.runSim();
  expect(r && r.numPoints > 0).toBe(true);
  const x = r.data[0].values as number[];
  const v = (name: string) => r.data.find((d) => d.name === `v(${name})`)!.values as number[];
  return { x, v };
}

function freq(x: number[], y: number[]) {
  const h = Math.floor(y.length / 2);
  const w = y.slice(h);
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const ts: number[] = [];
  for (let i = h + 1; i < y.length; i++) if (y[i - 1] < mean && y[i] >= mean) ts.push(x[i]);
  return (ts.length - 1) / (ts[ts.length - 1] - ts[0]);
}

describe('built-in library simulates', () => {
  it('opamp: inverting amplifier gain -10 (1 V p-p in, 10 V p-p out)', async () => {
    const { v } = await run(
      'inv\nV1 in 0 SIN(0 0.5 1k)\nR1 in inv 1k\nRf inv out 10k\nX1 0 inv out opamp\n.tran 5u 3m\n.end\n'
    );
    const out = v('out').slice(-300);
    expect(Math.max(...out) - Math.min(...out)).toBeGreaterThan(9.9);
    expect(Math.max(...out) - Math.min(...out)).toBeLessThan(10.1);
  });

  it('ne555 astable 1k/10k/10n at 5 V oscillates at ~6.8 kHz between 1/3 and 2/3 Vcc', async () => {
    const { x, v } = await run(
      'astable\nVCC vcc 0 DC 5\nRA vcc dis 1k\nRB dis thr 10k\nC1 thr 0 10n\nX1 0 thr out vcc ctl thr dis vcc ne555\n.tran 0.5u 1m\n.end\n'
    );
    const f = freq(x, v('thr'));
    expect(Math.abs(f - 6787) / 6787).toBeLessThan(0.03); // hand-written SW555 model: 6787 Hz
    const late = v('thr').slice(Math.floor(x.length / 2));
    expect(Math.min(...late)).toBeGreaterThan(1.6);
    expect(Math.max(...late)).toBeLessThan(3.4);
  }, 30_000);

  it('1N4148 rectifier and 2N3904 switch run with library models', async () => {
    const { v } = await run(
      'rect\nV1 in 0 SIN(0 5 1k)\nD1 in out 1N4148\nR1 out 0 1k\nVB b0 0 5\nRB b0 b 10k\nRC vcc c 1k\nVC vcc 0 5\nQ1 c b 0 2N3904\n.tran 10u 3m\n.end\n'
    );
    expect(Math.max(...v('out'))).toBeGreaterThan(4);
    expect(Math.max(...v('out'))).toBeLessThan(4.6);
    expect(v('c')[v('c').length - 1]).toBeLessThan(0.3); // saturated
  });
});
