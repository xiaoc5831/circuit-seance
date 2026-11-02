/**
 * Unit tests for LLM response parser.
 * Tests: fence extraction, confidence parsing, non-ASCII stripping.
 */

import { describe, it, expect } from 'vitest';
import { parseNetlistFromResponse } from '@/features/transcribe';

describe('parseNetlistFromResponse', () => {
  describe('fence extraction', () => {
    it('should extract ```spice fenced block', () => {
      const response = `Here is your netlist:
\`\`\`spice
RC Lowpass
R1 1 2 10k
C1 2 0 100n
V1 1 0 pulse(0 5 0 1u 1u 1u 2u)
.tran 0 10m
.end
\`\`\`
Confidence: high`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.netlist).toContain('RC Lowpass');
        expect(result.netlist).toContain('R1 1 2 10k');
        expect(result.netlist).toContain('.end');
      }
    });

    it('should extract ```cir fenced block', () => {
      const response = `\`\`\`cir
RL Circuit
R1 1 2 1k
L1 2 0 1m
.tran 0 1
.end
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.netlist).toContain('RL Circuit');
        expect(result.netlist).toContain('L1 2 0 1m');
      }
    });

    it('should extract ```text fenced block', () => {
      const response = `\`\`\`text
RLC Series
R1 1 2 100
L1 2 3 1m
C1 3 0 1u
.tran 0 100m
.end
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.netlist).toContain('RLC Series');
      }
    });

    it('should extract plain ``` fenced block (no language)', () => {
      const response = `\`\`\`
Simple Circuit
R1 1 0 1k
.end
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.netlist).toContain('Simple Circuit');
      }
    });

    it('should be case-insensitive for fence identifier', () => {
      const response = `\`\`\`SPICE
Diode Rectifier
D1 1 2 1N4148
.tran 0 100m
.end
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.netlist).toContain('Diode Rectifier');
      }
    });

    it('should return error when no fence found', () => {
      const response = `This is a response without a fenced block.
Here is your netlist:
R1 1 0 1k`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('no-fence');
      }
    });

    it('should return error when fence is empty', () => {
      const response = `\`\`\`spice
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('empty-fence');
      }
    });

    it('should handle whitespace-only fence', () => {
      const response = `\`\`\`spice
   
\t

\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('empty-fence');
      }
    });
  });

  describe('confidence parsing', () => {
    it('should parse Confidence: high', () => {
      const response = `\`\`\`spice
Test Circuit
R1 1 0 1k
.end
\`\`\`
Confidence: high`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.confidence).toBe('high');
      }
    });

    it('should parse Confidence: medium', () => {
      const response = `\`\`\`spice
Test Circuit
R1 1 0 1k
.end
\`\`\`
Confidence: medium`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.confidence).toBe('medium');
      }
    });

    it('should parse Confidence: low', () => {
      const response = `\`\`\`spice
Test Circuit
R1 1 0 1k
.end
\`\`\`
Confidence: low`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.confidence).toBe('low');
      }
    });

    it('should be case-insensitive for confidence level', () => {
      const response = `\`\`\`spice
Test
.end
\`\`\`
Confidence: HIGH`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.confidence).toBe('high');
      }
    });

    it('should leave confidence undefined if not present', () => {
      const response = `\`\`\`spice
Test Circuit
R1 1 0 1k
.end
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.confidence).toBeUndefined();
      }
    });
  });

  describe('note parsing', () => {
    it('should capture notes after Confidence line', () => {
      const response = `\`\`\`spice
Test
R1 1 0 1k
.end
\`\`\`
Confidence: medium
- Node 2 label was illegible
- Assumed 10k resistor (could be 12k)`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.note).toContain('Node 2 label was illegible');
        expect(result.note).toContain('Assumed 10k');
      }
    });

    it('should leave note undefined if no trailing text', () => {
      const response = `\`\`\`spice
Test
.end
\`\`\`
Confidence: high`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.note).toBeUndefined();
      }
    });
  });

  describe('non-ASCII stripping', () => {
    it('should strip non-ASCII characters and report them', () => {
      const response = `\`\`\`spice
Test Circuit µ Ω
R1 1 0 10kΩ
C1 0 2 100µF
.end
\`\`\`
Confidence: low`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        // Non-ASCII stripped from netlist
        expect(result.netlist).not.toContain('µ');
        expect(result.netlist).not.toContain('Ω');
        // But the netlist still has valid content
        expect(result.netlist).toContain('R1 1 0 10k');
        expect(result.netlist).toContain('C1 0 2 100');
        // Note includes stripped characters
        expect(result.note).toContain('Stripped non-ASCII');
      }
    });

    it('should combine non-ASCII stripping with existing notes', () => {
      const response = `\`\`\`spice
Test Ω
.end
\`\`\`
Confidence: high
- Some ambiguity in the schematic`;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.note).toContain('ambiguity');
        expect(result.note).toContain('Stripped non-ASCII');
      }
    });

    it('should handle emoji and special Unicode', () => {
      const response = `\`\`\`spice
Circuit 🔌
R1 1 0 1k
.end
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.netlist).not.toContain('🔌');
        expect(result.netlist).toContain('R1 1 0 1k');
        expect(result.note).toContain('Stripped non-ASCII');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle null input', () => {
      const result = parseNetlistFromResponse(null as any);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('no-fence');
      }
    });

    it('should handle undefined input', () => {
      const result = parseNetlistFromResponse(undefined as any);
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('no-fence');
      }
    });

    it('should handle empty string', () => {
      const result = parseNetlistFromResponse('');
      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toBe('no-fence');
      }
    });

    it('should handle multiple fence blocks (first one wins)', () => {
      const response = `\`\`\`spice
First Circuit
R1 1 0 1k
.end
\`\`\`

\`\`\`spice
Second Circuit
R2 1 0 2k
.end
\`\`\``;

      const result = parseNetlistFromResponse(response);

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.netlist).toContain('First Circuit');
        expect(result.netlist).not.toContain('Second Circuit');
      }
    });
  });
});
