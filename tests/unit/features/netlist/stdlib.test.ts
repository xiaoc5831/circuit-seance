import { describe, expect, it } from 'vitest';
import { STDLIB, stdlibRefs, withStdlib } from '@/features/netlist/stdlib';
import { sanitizeNetlist } from '@/features/simulate/sanitize';

const INV =
  'Inverting amp\nV1 in 0 SIN(0 0.5 1k)\nR1 in inv 1k\nRf inv out 10k\nX1 0 inv out opamp\n.tran 5u 3m\n.end\n';

describe('built-in subckt/model library (auto-include)', () => {
  it('appends the opamp subckt before .end when the netlist uses it without defining it', () => {
    const { netlist, added } = withStdlib(INV);
    expect(added).toEqual(['opamp']);
    expect(netlist).toMatch(/\.subckt opamp inp inn out[\s\S]*\.ends opamp\n\.end\n$/);
    expect(netlist.startsWith('Inverting amp\nV1 in 0')).toBe(true);
  });

  it("keeps the netlist's own definition (case-insensitive)", () => {
    const own = INV.replace(
      '.tran',
      '.SUBCKT OpAmp a b c\nRin a b 1e6\nE1 c 0 a b 1e4\n.ENDS\n.tran'
    );
    expect(withStdlib(own)).toEqual({ netlist: own, added: [] });
  });

  it('matches the ne555 instance by its last token, whatever the case, and ignores parameters', () => {
    const n =
      't\nVCC vcc 0 5\nX1 0 thr out vcc ctl thr dis vcc NE555 foo=1\nRA vcc dis 1k\n.tran 1u 1m\n.end\n';
    expect(withStdlib(n).added).toEqual(['ne555']);
  });

  it('adds diode and BJT models referenced by D and Q lines (3- and 4-node Q)', () => {
    const n = 't\nD1 a k 1N4148\nQ1 c b e 2N3904\nQ2 c b e s BC557\nD2 a 0 d1n4148\n.op\n.end\n';
    const { netlist, added } = withStdlib(n);
    expect(added.sort()).toEqual(['1n4148', '2n3904', 'bc557', 'd1n4148']);
    expect(netlist).toContain('.model 2N3904 NPN(');
    expect(netlist).toContain('.model BC557 PNP(');
  });

  it('does not add anything for a defined model or an unknown part', () => {
    const n = 't\n.model 1N4148 D(IS=1n)\nD1 a 0 1N4148\nX2 a b c LM741\n.op\n.end\n';
    expect(withStdlib(n).added).toEqual([]);
  });

  it('ignores the title line, comments and node names that happen to match a library name', () => {
    const n = 'opamp ne555 1N4148 demo\n* X1 a b c opamp\nR1 opamp 0 1k\nV1 opamp 0 1\n.op\n.end\n';
    expect(stdlibRefs(n).referenced).toEqual([]);
  });

  it('appends at the end when there is no .end, and sanitizeNetlist then closes it', () => {
    const { sanitized, warnings } = sanitizeNetlist('t\nX1 0 n out opamp\nR1 n out 1k\n.op');
    expect(warnings).toContain('built-in opamp added');
    expect(sanitized).toMatch(/\.ends opamp\n\.end\n$/);
  });

  it('every library entry is pure ASCII (ngspice hangs on anything else)', () => {
    // eslint-disable-next-line no-control-regex
    for (const e of STDLIB) expect(e.text, e.name).toMatch(/^[\x00-\x7f]*$/);
  });
});
