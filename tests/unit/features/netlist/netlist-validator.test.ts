import { describe, it, expect } from 'vitest';
import { validateNetlist, hasGroundNode, findFloatingNodes } from '@/features/netlist';

describe('netlist-validator', () => {
  describe('validateNetlist', () => {
    it('should accept a valid RC netlist', async () => {
      const netlist = `RC low-pass
V1 in 0 DC 5
R1 in out 1k
C1 out 0 1u
.tran 0 1m
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject netlist missing ground node', async () => {
      const netlist = `Bad circuit
V1 in 1 DC 5
R1 1 out 1k
C1 out 2 1u
.tran 0 1m
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('ground');
    });

    it('should reject netlist with no analysis directive', async () => {
      const netlist = `No analysis
V1 in 0 DC 5
R1 in out 1k
C1 out 0 1u
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('analysis');
    });

    it('should detect non-ASCII characters as warning', async () => {
      const netlist = `RC τ filter
V1 in 0 DC 5
R1 in out 1k
C1 out 0 1u
.tran 0 1m
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(false); // non-ASCII is a warning that makes it invalid
      expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
    });

    it('should reject empty netlist', async () => {
      const netlist = '';
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject netlist with only comments', async () => {
      const netlist = `; This is a comment
* Another comment
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(false);
    });

    it('should warn about floating nodes', async () => {
      const netlist = `Floating node test
V1 in 0 DC 5
R1 in out 1k
C1 floating 0 1u
.tran 0 1m
.end`;
      const result = await validateNetlist(netlist);
      // Should have warnings about floating nodes
      expect(result.warnings.length + result.errors.length).toBeGreaterThan(0);
    });

    it('should accept netlist with .ac directive', async () => {
      const netlist = `AC analysis
V1 in 0 AC 1
R1 in out 1k
C1 out 0 1u
.ac dec 10 1 1meg
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept netlist with .dc directive', async () => {
      const netlist = `DC sweep
V1 in 0 DC 0
R1 in out 1k
C1 out 0 1u
.dc V1 0 5 0.1
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept netlist with .op directive', async () => {
      const netlist = `Operating point
V1 in 0 DC 5
R1 in out 1k
C1 out 0 1u
.op
.end`;
      const result = await validateNetlist(netlist);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('hasGroundNode', () => {
    it('should detect ground node 0', () => {
      const netlist = `Test
V1 in 0 DC 5
R1 in out 1k
.tran 0 1m
.end`;
      expect(hasGroundNode(netlist)).toBe(true);
    });

    it('should return false when no ground node', () => {
      const netlist = `Test
V1 in out DC 5
R1 out 1 1k
.tran 0 1m
.end`;
      expect(hasGroundNode(netlist)).toBe(false);
    });
  });

  describe('findFloatingNodes', () => {
    it('should find floating nodes', () => {
      const netlist = `Test
V1 in 0 DC 5
R1 in out 1k
C1 floating 0 1u
.tran 0 1m
.end`;
      const floating = findFloatingNodes(netlist);
      expect(floating).toContain('floating');
    });

    it('should return empty array for well-connected circuit', () => {
      const netlist = `Test
V1 in 0 5
R1 in out 1k
C1 out 0 1u
.tran 0 1m
.end`;
      const floating = findFloatingNodes(netlist);
      expect(floating).toEqual([]);
    });
  });
});
