import { describe, expect, it } from 'vitest';
import { sanitizeNetlist } from '@/features/simulate/sanitize';

describe('sanitizeNetlist (ngspice hangs on non-ASCII)', () => {
  it('folds µ, Ω, τ, dashes and full-width characters to ASCII', () => {
    const { sanitized, warnings } = sanitizeNetlist('RC 滤波 τ=1ms\r\nR1 in out 1kΩ\nC1 out 0 1µ\nV1 in 0 PULSE(0 5 0 1n 1n 1 2)\n．tran 10u 8m\n.end\n');
    // eslint-disable-next-line no-control-regex
    expect(sanitized).toMatch(/^[\x00-\x7f]*$/);
    expect(sanitized).toContain('C1 out 0 1u');
    expect(sanitized).toContain('R1 in out 1k\n');
    expect(sanitized).toContain('.tran 10u 8m');
    expect(warnings.length).toBeGreaterThan(0);
  });
  it('appends a missing .end', () => {
    expect(sanitizeNetlist('t\nR1 1 0 1k\n.op').sanitized.trimEnd().endsWith('.end')).toBe(true);
  });
  it('leaves clean netlists untouched', () => {
    const n = 'title\nR1 1 0 1k\nV1 1 0 1\n.op\n.end\n';
    expect(sanitizeNetlist(n)).toEqual({ sanitized: n, warnings: [] });
  });
});
