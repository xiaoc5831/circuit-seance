/**
 * Shared utility functions
 */
import { nanoid } from 'nanoid';

/**
 * Generate a unique ID for tracking simulation requests, etc.
 */
export function generateId(): string {
  return nanoid(16);
}

/**
 * Round a number to a specified number of decimal places
 */
export function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Format a number for display with optional unit suffix
 */
export function formatValue(
  value: number,
  decimals: number = 3,
  unit: string = '',
): string {
  return `${roundTo(value, decimals)}${unit}`;
}

/**
 * Format scientific notation for readability
 */
export function formatScientific(value: number, decimals: number = 2): string {
  return value.toExponential(decimals);
}
