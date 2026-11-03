/**
 * Built-in SPICE library: subcircuits and device models a netlist may use without defining.
 *
 * Vision models (and students) write `X1 0 inv out opamp` or `D1 a k 1N4148` and forget the
 * definition, and ngspice then stops with "unknown subckt" / "unknown model". Before a netlist is
 * simulated, `withStdlib` appends the definition of every library entry the netlist references
 * but does not define itself. A netlist's own `.subckt` / `.model` always wins.
 *
 * Pin orders (also stated in the transcription prompt, src/lib/llm/prompts.ts):
 *   opamp  inp inn out                                   (+in, -in, out; no supply pins)
 *   ne555  gnd trig out rst ctrl thr dis vcc              (datasheet pins 1..8 in order)
 *
 * Dependency-free on purpose: tools/eval-vision.mjs imports it straight into Node.
 */

export interface StdlibEntry {
  kind: 'subckt' | 'model';
  name: string; // lower case
  text: string;
}

/** Same macro-model as src/examples/opamp-inverting.net: open-loop gain 1e5, rails +-14 V, 10 MOhm input. */
const OPAMP = `.subckt opamp inp inn out
* built-in ideal-ish op-amp: A=1e5, output clips softly at +-14 V, no supply pins
Rin inp inn 1e7
B1 out 0 V = 14*tanh(1e5*(v(inp)-v(inn))/14)
.ends opamp`;

/**
 * Behavioural NE555. Internal 5k/5k/5k divider sets the thresholds (ctrl = 2/3 Vcc, trigger 1/3 Vcc).
 * A smooth SR latch with positive feedback holds the state: trigger below 1/3 Vcc sets it (output high,
 * discharge off), threshold above ctrl resets it (output low, discharge 10 Ohm to gnd); trigger wins
 * over threshold, and reset below 0.7 V forces the reset state. All B-sources are smooth (tanh) so the
 * transient solver never sees a discontinuity. Astable 1k/10k/10n at 5 V: 6.79 kHz, same as
 * src/features/haunted/netlists/ne555-astable.net.
 */
const NE555 = `.subckt ne555 gnd trig out rst ctrl thr dis vcc
* built-in behavioural NE555; pins in datasheet order 1..8
R1 vcc ctrl 5k
R2 ctrl lo 5k
R3 lo gnd 5k
Rtrig trig gnd 1g
Rthr thr gnd 1g
Rrst rst gnd 1g
Bq qd gnd V = 0.5*(1+tanh(100*(v(rst,gnd)-0.7))) * (0.5*(1+tanh(100*(v(lo,gnd)-v(trig,gnd)))) + 0.5*(1-tanh(100*(v(lo,gnd)-v(trig,gnd)))) * 0.5*(1-tanh(100*(v(thr,gnd)-v(ctrl,gnd)))) * 0.5*(1+tanh(50*(v(q,gnd)-0.5))))
Rq qd q 1k
Cq q gnd 10p
Bs s gnd V = 0.5*(1+tanh(200*(v(q,gnd)-0.5)))
Bout out gnd V = v(vcc,gnd)*v(s,gnd)
Bdis dis gnd I = v(dis,gnd)*(1-v(s,gnd))/10 + v(dis,gnd)*1e-9
.ends ne555`;

/** Common discrete parts (vendor / PSpice-library parameters; BC547/BC557 are approximate). */
const MODELS: Array<[string, string]> = [
  ['1n4148', '.model 1N4148 D(IS=2.52n RS=0.568 N=1.752 CJO=4p M=0.4 TT=20n BV=100 IBV=100u)'],
  ['d1n4148', '.model D1N4148 D(IS=2.52n RS=0.568 N=1.752 CJO=4p M=0.4 TT=20n BV=100 IBV=100u)'],
  ['1n4001', '.model 1N4001 D(IS=29.5n RS=73.5m N=1.984 CJO=25.9p M=0.44 TT=5.7u BV=50 IBV=10u)'],
  ['1n4007', '.model 1N4007 D(IS=29.5n RS=73.5m N=1.984 CJO=25.9p M=0.44 TT=5.7u BV=1000 IBV=10u)'],
  ['1n5819', '.model 1N5819 D(IS=31.7u RS=51m N=1.373 CJO=110p M=0.35 EG=0.69 XTI=2 BV=40 IBV=1m)'],
  [
    '2n3904',
    '.model 2N3904 NPN(IS=6.734f XTI=3 EG=1.11 VAF=74.03 BF=416.4 NE=1.259 ISE=6.734f IKF=66.78m XTB=1.5 BR=0.7371 NC=2 RC=1 CJC=3.638p MJC=0.3085 VJC=0.75 FC=0.5 CJE=4.493p MJE=0.2593 VJE=0.75 TR=239.5n TF=301.2p ITF=0.4 VTF=4 XTF=2 RB=10)',
  ],
  [
    '2n3906',
    '.model 2N3906 PNP(IS=1.41f XTI=3 EG=1.11 VAF=18.7 BF=180.7 NE=1.5 IKF=80m XTB=1.5 BR=4.977 NC=2 RC=2.5 CJC=9.728p MJC=0.5776 VJC=0.75 FC=0.5 CJE=8.063p MJE=0.3677 VJE=0.75 TR=33.42n TF=179.3p ITF=0.4 VTF=4 XTF=6 RB=10)',
  ],
  [
    '2n2222',
    '.model 2N2222 NPN(IS=14.34f XTI=3 EG=1.11 VAF=74.03 BF=255.9 NE=1.307 ISE=14.34f IKF=0.2847 XTB=1.5 BR=6.092 NC=2 RC=1 CJC=7.306p MJC=0.3416 VJC=0.75 FC=0.5 CJE=22.01p MJE=0.377 VJE=0.75 TR=46.91n TF=411.1p ITF=0.6 VTF=1.7 XTF=3 RB=10)',
  ],
  [
    'bc547',
    '.model BC547 NPN(IS=7.05f BF=290 VAF=60 IKF=80m ISE=68f NE=1.58 BR=7 RB=10 RC=1 CJE=11.5p CJC=5.25p TF=410p TR=10n)',
  ],
  [
    'bc557',
    '.model BC557 PNP(IS=10f BF=250 VAF=40 IKF=80m ISE=50f NE=1.6 BR=7 RB=10 RC=1 CJE=12p CJC=9p TF=500p TR=10n)',
  ],
];

export const STDLIB: StdlibEntry[] = [
  { kind: 'subckt', name: 'opamp', text: OPAMP },
  { kind: 'subckt', name: 'ne555', text: NE555 },
  ...MODELS.map(([name, text]): StdlibEntry => ({ kind: 'model', name, text })),
];

const BY_NAME = new Map(STDLIB.map((e) => [e.name, e]));

/** Strip a trailing `$`/`;` comment and split into tokens. */
function tokens(line: string): string[] {
  return line
    .replace(/[$;].*$/, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Library names a netlist references (subckt of X lines, model of D/Q lines) and names it defines itself. */
export function stdlibRefs(netlist: string): { referenced: string[]; defined: string[] } {
  const referenced = new Set<string>();
  const defined = new Set<string>();
  const lines = netlist.replace(/\r\n?/g, '\n').split('\n');
  const first = lines.findIndex((l) => l.trim());
  lines.forEach((raw, i) => {
    if (i === first) return; // SPICE: the first line is the title, whatever it says
    const t = tokens(raw);
    if (!t.length || t[0].startsWith('*') || t[0] === '+') return;
    const head = t[0].toLowerCase();
    if (head === '.subckt' || head === '.model' || head === '.macromodel') {
      if (t[1]) defined.add(t[1].toLowerCase());
      return;
    }
    const kind = head[0];
    let cands: string[] = [];
    if (kind === 'x') {
      // the subckt name is the last token that is not a parameter (params: name=value, or after "params:")
      const plain = t.slice(1).filter((x) => !x.includes('='));
      const p = plain.findIndex((x) => /^params:?$/i.test(x));
      const names = p >= 0 ? plain.slice(0, p) : plain;
      cands = names.length ? [names[names.length - 1]] : [];
    } else if (kind === 'd') cands = [t[3]];
    else if (kind === 'q') cands = [t[4], t[5]]; // 3 or 4 nodes
    for (const c of cands) if (c && BY_NAME.has(c.toLowerCase())) referenced.add(c.toLowerCase());
  });
  return { referenced: [...referenced], defined: [...defined] };
}

/**
 * Append every library subckt/model the netlist uses but does not define, just before its `.end`
 * (or at the end when there is none). Returns the netlist unchanged when nothing is missing.
 */
export function withStdlib(netlist: string): { netlist: string; added: string[] } {
  const { referenced, defined } = stdlibRefs(netlist);
  const missing = referenced.filter((n) => !defined.includes(n));
  if (!missing.length) return { netlist, added: [] };
  const block = [
    '* --- built-in library (auto-included) ---',
    ...missing.map((n) => BY_NAME.get(n)!.text),
  ].join('\n');
  const lines = netlist.split('\n');
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--)
    if (/^\s*\.end\s*$/i.test(lines[i])) {
      end = i;
      break;
    }
  if (end < 0)
    return { netlist: netlist.replace(/\s*$/, '') + '\n' + block + '\n', added: missing };
  lines.splice(end, 0, block);
  return { netlist: lines.join('\n'), added: missing };
}
