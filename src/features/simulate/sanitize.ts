/**
 * ngspice (eecircuit-engine) hangs forever on any non-ASCII byte in a netlist.
 * LLM transcriptions love µ, Ω, τ, full-width punctuation and Chinese comments,
 * so every netlist is folded to ASCII before it reaches the engine.
 * It also appends any built-in library subckt/model (opamp, ne555, 1N4148, 2N3904, ...)
 * the netlist uses without defining (see ../netlist/stdlib.ts).
 */
// explicit .ts extension: tools/eval-vision.mjs imports this file straight into Node
import { withStdlib } from '../netlist/stdlib.ts';
const REPLACEMENTS: Array<[RegExp, string, string]> = [
  [/[µμ]/g, 'u', 'µ → u'],
  [/[Ωω]/g, '', 'Ω removed'],
  [/τ/g, 'tau', 'τ → tau'],
  [/×/g, '*', '× → *'],
  [/[−–—]/g, '-', 'dash → -'],
  [/[“”]/g, '"', 'quotes'],
  [/[‘’]/g, "'", 'quotes'],
  [/\u3000/g, ' ', 'full-width space'],
];

export function sanitizeNetlist(netlist: string): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];
  let s = netlist.replace(/\r\n?/g, '\n');
  // full-width ASCII (Ａ-ｚ, ０-９, punctuation) → half-width
  s = s.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  for (const [re, rep, label] of REPLACEMENTS) {
    if (re.test(s)) {
      s = s.replace(re, rep);
      warnings.push(label);
    }
  }
  // eslint-disable-next-line no-control-regex
  const rest = s.match(/[^\x00-\x7f]/g);
  if (rest) {
    // eslint-disable-next-line no-control-regex
    s = s.replace(/[^\x00-\x7f]/g, '');
    warnings.push(`${rest.length} non-ASCII character(s) removed`);
  }
  const lib = withStdlib(s);
  if (lib.added.length) {
    s = lib.netlist;
    warnings.push(`built-in ${lib.added.join(', ')} added`);
  }
  if (!/^\s*\.end\s*$/im.test(s)) s = s.trimEnd() + '\n.end\n';
  return { sanitized: s, warnings };
}

