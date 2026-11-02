/**
 * Unit tests for shared utilities
 */
import { describe, it, expect } from 'vitest';
import { generateId, roundTo, formatValue } from '@/shared/utils';

describe('shared/utils', () => {
  describe('generateId', () => {
    it('generates a 16-character string', () => {
      const id = generateId();
      expect(id).toHaveLength(16);
      expect(typeof id).toBe('string');
    });

    it('generates unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('roundTo', () => {
    it('rounds to the specified number of decimals', () => {
      expect(roundTo(3.14159, 2)).toBe(3.14);
      expect(roundTo(3.14159, 3)).toBe(3.142);
    });

    it('handles zero decimals', () => {
      expect(roundTo(3.7, 0)).toBe(4);
    });
  });

  describe('formatValue', () => {
    it('formats a number with decimals and unit', () => {
      expect(formatValue(1234.5678, 2, ' V')).toBe('1234.57 V');
    });

    it('formats with default decimals', () => {
      const result = formatValue(1.23456);
      expect(result).toMatch(/^1\.235/);
    });
  });
});
