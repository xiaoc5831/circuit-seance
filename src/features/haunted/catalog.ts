/**
 * The circuit catalogue: bundled examples, the four Demo Séance "photos"
 * (each with a recorded vision-LLM response that runs through the real parser),
 * and the Haunted Classics gallery.
 *
 * Every netlist here was verified in ngspice-45 (eecircuit-engine) — see
 * scripts/verify-examples.mjs and docs/classics-verified.md.
 */
import rcLowpassNet from '@/examples/rc-lowpass.net?raw';
import rlNet from '@/examples/rl.net?raw';
import rlcRingingNet from '@/examples/rlc-ringing.net?raw';
import diodeRectifierNet from '@/examples/diode-rectifier.net?raw';
import bjtNet from '@/examples/bjt-common-emitter.net?raw';
import opampInvNet from '@/examples/opamp-inverting.net?raw';
import ne555Net from './netlists/ne555-astable.net?raw';
import rcLadderNet from './netlists/rc-ladder.net?raw';
import wienNet from './netlists/wien-bridge.net?raw';
import integratorNet from './netlists/opamp-integrator.net?raw';

export type Bilingual = { en: string; zh: string };

export interface CircuitEntry {
  id: string;
  kind: 'example' | 'classic';
  title: Bilingual;
  netlist: string;
  /** schematic drawing in /public (relative, joined with import.meta.env.BASE_URL) */
  drawing?: string;
  /** what a vision model returned for the drawing (fenced spice block + confidence) */
  recordedVision?: string;
  /** preferred scope probes for the bundled netlist */
  probes?: string[];
  /** Haunted Classics: year + short history */
  year?: string;
  blurb?: Bilingual;
}

const fence = (net: string, confidence: string, notes: string[]) =>
  `I read the schematic as follows.\n\n\`\`\`spice\n${net.trim()}\n\`\`\`\n\nConfidence: ${confidence}\n${notes.map((n) => `- ${n}`).join('\n')}\n`;

export const EXAMPLES: CircuitEntry[] = [
  {
    id: 'rc-lowpass',
    kind: 'example',
    title: { en: 'RC low-pass · step', zh: 'RC 低通 · 阶跃响应' },
    netlist: rcLowpassNet,
    drawing: 'samples/rc-lowpass.svg',
    recordedVision: fence(rcLowpassNet, 'high', [
      'Source drawn as a pulse: assumed a 0→5 V step with 1 ns edges.',
      'Simulation window set to 8 ms (≈ 8 τ) so the curve fully settles.',
    ]),
  },
  {
    id: 'rlc-ringing',
    kind: 'example',
    title: { en: 'Series RLC · ringing', zh: '串联 RLC · 振铃' },
    netlist: rlcRingingNet,
    drawing: 'samples/rlc-ringing.svg',
    recordedVision: fence(rlcRingingNet, 'high', [
      'Read the capacitor as 253 nF (the "5" is slightly smudged).',
      'Probing the capacitor node n2 — that is where the ringing is largest.',
    ]),
  },
  {
    id: 'diode-rectifier',
    kind: 'example',
    title: { en: 'Half-wave rectifier', zh: '半波整流' },
    netlist: diodeRectifierNet,
    drawing: 'samples/diode-rectifier.svg',
    recordedVision: fence(diodeRectifierNet, 'medium', [
      'Diode labelled 1N4148: used a typical small-signal model card.',
      'Five mains cycles (100 ms) simulated so the ripple reaches steady state.',
    ]),
  },
  {
    id: 'opamp-inverting',
    kind: 'example',
    title: { en: 'Inverting amplifier', zh: '反相放大器' },
    netlist: opampInvNet,
    drawing: 'samples/opamp-inverting.svg',
    recordedVision: fence(opampInvNet, 'high', [
      'Op-amp modelled as a behavioural subcircuit (gain 1e5, ±14 V soft rails).',
      'Non-inverting input tied to ground as drawn.',
    ]),
  },
  {
    id: 'rl',
    kind: 'example',
    title: { en: 'RL · inductor kick', zh: 'RL · 电感反冲' },
    netlist: rlNet,
  },
  {
    id: 'bjt-common-emitter',
    kind: 'example',
    title: { en: 'BJT common-emitter', zh: 'BJT 共射放大' },
    netlist: bjtNet,
  },
];

export const CLASSICS: CircuitEntry[] = [
  {
    id: 'ne555-astable',
    kind: 'classic',
    year: '1972',
    title: { en: 'NE555 astable', zh: 'NE555 多谐振荡器' },
    netlist: ne555Net,
    drawing: 'classics/ne555-astable.svg',
    probes: ['v(out)', 'v(thr)'],
    blurb: {
      en: 'Hans Camenzind designed the 555 for Signetics in 1971; it shipped in 1972 and became one of the best-selling chips ever, around a billion a year by the 2000s. Its classic astable circuit makes an LED blink.',
      zh: '1971 年 Hans Camenzind 为 Signetics 设计了 555，1972 年上市，此后成为史上最畅销的芯片之一，到 2000 年代每年约十亿颗。经典的多谐振荡电路让 LED 闪烁。',
    },
    recordedVision: fence(ne555Net, 'medium', [
      'No NE555 model in the netlist library: replaced the chip with a behavioural equivalent — a hysteretic switch on THR (trips at 2/3 VCC, releases at 1/3 VCC) as the discharge transistor, and a B-source as the output stage.',
      'Pins 2 and 6 tied together as drawn (classic astable).',
    ]),
  },
  {
    id: 'rc-ladder',
    kind: 'classic',
    year: '1950s',
    title: { en: 'Two-section RC filter', zh: '两节 RC 滤波器' },
    netlist: rcLadderNet,
    drawing: 'classics/rc-ladder.svg',
    blurb: {
      en: 'Valve-radio servicing handbooks were full of RC "ladders" for tone control and hum filtering. Two sections give a steeper −40 dB/decade roll-off — but the second section loads the first, so the corner is not where naïve 1/(2πRC) says.',
      zh: '电子管收音机维修手册里到处是用于音调控制和滤除交流声的 RC "梯形" 网络。两节级联可得 −40 dB/十倍频 的陡峭衰减——但第二节会加载第一节，所以转折频率并不在简单的 1/(2πRC) 处。',
    },
    recordedVision: fence(rcLadderNet, 'high', [
      'Swept 10 Hz – 1 MHz (.ac) to show the Bode magnitude.',
    ]),
  },
  {
    id: 'wien-bridge',
    kind: 'classic',
    year: '1939',
    title: { en: 'Wien-bridge oscillator', zh: '文氏桥振荡器' },
    netlist: wienNet,
    drawing: 'classics/wien-bridge.svg',
    blurb: {
      en: "Bill Hewlett's 1939 Stanford thesis turned Max Wien's bridge into a clean audio oscillator. It became the HP 200A, HP's first product, built in a Palo Alto garage; Disney bought eight of its 200B siblings for Fantasia.",
      zh: '1939 年 Bill Hewlett 的斯坦福学位论文把 Max Wien 的电桥变成了纯净的音频振荡器。它成为惠普的第一款产品 HP 200A，在帕洛阿尔托的车库里造出；迪士尼还为《幻想曲》买了八台同系列的 200B。',
    },
    recordedVision: fence(wienNet, 'medium', [
      'Hewlett stabilised the amplitude with a light bulb; here the op-amp’s soft rails (tanh) limit it instead.',
      'Rf/Rg = 2.1 (slightly above the critical 2) so oscillation can start; seeded with a 10 mV initial condition.',
    ]),
  },
  {
    id: 'opamp-integrator',
    kind: 'classic',
    year: '1970s',
    title: { en: 'Op-amp integrator', zh: '运放积分器' },
    netlist: integratorNet,
    drawing: 'classics/opamp-integrator.svg',
    blurb: {
      en: 'Before microcontrollers, op-amps did calculus. 1970s linear-applications handbooks (National, Philbrick) opened with the integrator: a square wave in, a triangle out — the heart of every analog computer and function generator.',
      zh: '在单片机出现之前，运放负责"做微积分"。1970 年代的线性应用手册（National、Philbrick）开篇就是积分器：输入方波，输出三角波——模拟计算机和函数发生器的核心。',
    },
    recordedVision: fence(integratorNet, 'high', [
      'Rf = 1 MΩ across C1 drawn faintly: kept it (prevents DC drift to the rails).',
      'Input delayed by a quarter period so the triangle is centred on 0 V.',
    ]),
  },
];

export const ALL_CIRCUITS = [...EXAMPLES, ...CLASSICS];
export const DEMO_SAMPLES = EXAMPLES.filter((e) => e.recordedVision);

export function findCircuit(id: string | null | undefined): CircuitEntry | undefined {
  return ALL_CIRCUITS.find((c) => c.id === id);
}

/** Identify a bundled circuit from netlist text (so explanations survive small edits). */
export function matchCircuit(netlist: string): CircuitEntry | undefined {
  const title = netlist.split('\n')[0]?.trim().toLowerCase();
  return ALL_CIRCUITS.find((c) => c.netlist.split('\n')[0]?.trim().toLowerCase() === title);
}
