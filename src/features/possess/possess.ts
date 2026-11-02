/**
 * "Possess a component": find the passive parts in a netlist whose value is a plain
 * number, and rewrite one of them. The slider is logarithmic, base/10 … base×10,
 * with the original value in the middle.
 * (Hand-written, polish round 3.)
 */

export interface Possessable {
  /** reference designator as written, e.g. "R1" */
  name: string;
  kind: 'R' | 'C' | 'L';
  unit: 'Ω' | 'F' | 'H';
  /** 0-based line index in the netlist text */
  line: number;
  /** the value token as written, e.g. "1u" */
  token: string;
  value: number;
}

const UNIT = { R: 'Ω', C: 'F', L: 'H' } as const;

const MULT: Record<string, number> = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };

/** SPICE number: "1k", "2.2u", "1meg", "1e7", "10uF" (trailing unit letters are ignored, as in SPICE). */
export function parseSpiceNumber(token: string): number | null {
  const m = token.trim().toLowerCase().match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(meg|[tgkmunpf])?[a-z]*$/);
  if (!m) return null;
  const v = parseFloat(m[1]) * (m[2] ? MULT[m[2]] : 1);
  return isFinite(v) ? v : null;
}

/** op-amp macro-model internals (input/output resistance) are not student parts */
const INTERNAL = /^r(in|out)$/i;

export function findPossessable(netlist: string): Possessable[] {
  const out: Possessable[] = [];
  const lines = netlist.split('\n');
  lines.forEach((raw, i) => {
    if (i === 0) return; // title line
    const line = raw.replace(/[;$].*$/, '').trim();
    const m = line.match(/^([RCLrcl][\w]*)\s+(\S+)\s+(\S+)\s+(\S+)/);
    if (!m) return;
    const token = m[4];
    if (/[={}()]/.test(token)) return; // expressions / models are not possessable
    if (INTERNAL.test(m[1])) return;
    const value = parseSpiceNumber(token);
    if (value == null || !(value > 0) || !isFinite(value)) return;
    const kind = m[1][0].toUpperCase() as 'R' | 'C' | 'L';
    out.push({ name: m[1], kind, unit: UNIT[kind], line: i, token, value });
  });
  return out;
}

const SUFFIXES: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'Meg'],
  [1e3, 'k'],
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'u'],
  [1e-9, 'n'],
  [1e-12, 'p'],
  [1e-15, 'f'],
];

/** SPICE-safe value text (note: SPICE "M" means milli, so mega is "Meg"). */
export function formatSpiceValue(v: number, sig = 3): string {
  if (!(v > 0) || !isFinite(v)) return String(v);
  for (const [scale, suf] of SUFFIXES) {
    if (v >= scale * 0.9995) {
      const n = Number((v / scale).toPrecision(sig));
      if (n >= 1000 && scale < 1e12) continue; // rounding pushed it up a decade
      return `${n}${suf}`;
    }
  }
  return `${Number((v / 1e-15).toPrecision(sig))}f`;
}

/** Human readout with the unit, e.g. "2.2 µF", "10 kΩ". */
export function formatHuman(v: number, unit: string): string {
  const s = formatSpiceValue(v);
  const m = s.match(/^([\d.e+-]+)(\w*)$/);
  if (!m) return `${s} ${unit}`;
  const suf = m[2] === 'u' ? 'µ' : m[2] === 'Meg' ? 'M' : m[2];
  return `${m[1]} ${suf}${unit}`;
}

export const SLIDER_STEPS = 100;
export const SLIDER_MID = SLIDER_STEPS / 2;

/** slider position (0…100) → value, log scale, base/10 … base×10 */
export function sliderToValue(pos: number, base: number): number {
  const p = Math.min(SLIDER_STEPS, Math.max(0, pos));
  const v = base * Math.pow(10, (p - SLIDER_MID) / SLIDER_MID);
  return Number(v.toPrecision(3));
}

export function valueToSlider(v: number, base: number): number {
  return Math.round(SLIDER_MID + SLIDER_MID * Math.log10(v / base));
}

/** Rewrite one component's value; every other byte of the netlist is kept. */
export function withValue(netlist: string, part: Possessable, value: number): string {
  const lines = netlist.split('\n');
  const raw = lines[part.line];
  if (raw == null) return netlist;
  const m = raw.match(/^(\s*\S+\s+\S+\s+\S+\s+)(\S+)(.*)$/);
  if (!m) return netlist;
  lines[part.line] = `${m[1]}${formatSpiceValue(value)}${m[3]}`;
  return lines.join('\n');
}
