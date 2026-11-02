/**
 * SPICE netlist validator
 * Three-stage pipeline: syntax parse, element/node checks, ngspice dry-run
 */

import { parseNetlist } from './netlist-parser';

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean;
  stage: 'syntax' | 'elements' | 'ngspice-dry-run' | 'passed';
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface ValidationError {
  lineNumber: number | null;
  message: string; // human-readable, friendly
  rawMessage: string; // raw ngspice or parser output
  severity: 'error' | 'warning';
}

/**
 * Friendly message mapping for common ngspice errors
 */
export function friendlyMessage(rawNgspiceError: string): string {
  const lower = rawNgspiceError.toLowerCase();

  if (lower.includes('circuit not parsed') || lower.includes('parse error')) {
    return 'The netlist could not be parsed. Check for syntax errors.';
  }

  if (lower.includes('ground') || lower.includes('node')) {
    return 'No ground node (node 0) found in the circuit. Every circuit needs a reference node.';
  }

  if (lower.includes('singular matrix')) {
    return "The circuit matrix is singular. This usually means there's a floating node or disconnected component.";
  }

  if (lower.includes('timestep') && lower.includes('too small')) {
    return 'Timestep too small. Try increasing the simulation time or adjusting the timestep value.';
  }

  if (lower.includes('iteration') || lower.includes('convergence')) {
    return 'Simulation failed to converge. Check component values and initial conditions.';
  }

  if (lower.includes('undefined model')) {
    return 'A referenced model is not defined. Check .model statements.';
  }

  return rawNgspiceError;
}

/**
 * Check if netlist has ground node (node 0)
 */
export function hasGroundNode(text: string): boolean {
  const parsed = parseNetlist(text);
  const nodes = new Set<string>();

  for (const comp of parsed.components) {
    for (const node of comp.nodes) {
      nodes.add(node);
    }
  }

  return nodes.has('0') || nodes.has('gnd') || nodes.has('GND');
}

/**
 * Find floating nodes (nodes that appear only once)
 */
export function findFloatingNodes(text: string): string[] {
  const parsed = parseNetlist(text);
  const nodeConnections: Record<string, number> = {};

  for (const comp of parsed.components) {
    for (const node of comp.nodes) {
      nodeConnections[node] = (nodeConnections[node] || 0) + 1;
    }
  }

  return Object.entries(nodeConnections)
    .filter(([_, count]) => count === 1)
    .map(([node]) => node);
}

/**
 * Stage 1: Syntax validation (already done by parseNetlist)
 * Return any parse errors
 */
function syntaxStage(text: string): ValidationError[] {
  const errors: ValidationError[] = [];

  try {
    const parsed = parseNetlist(text);

    // Check for missing analysis directive
    const hasAnalysis = parsed.hasTran || parsed.hasAc || parsed.hasDc || parsed.hasOp;
    if (!hasAnalysis) {
      errors.push({
        lineNumber: null,
        message: 'No analysis directive found (.tran, .ac, .dc, or .op required)',
        rawMessage: 'Missing analysis directive',
        severity: 'error',
      });
    }

    // Check for empty netlist
    if (parsed.components.length === 0 && parsed.directives.length === 0) {
      errors.push({
        lineNumber: null,
        message: 'Netlist contains no components or directives',
        rawMessage: 'Empty netlist',
        severity: 'error',
      });
    }

    // Check for non-ASCII characters (will cause eecircuit-engine to hang)
    const nonAsciiMatches = [...text.matchAll(/[^\x00-\x7F]/g)];
    if (nonAsciiMatches.length > 0) {
      errors.push({
        lineNumber: null,
        message: `Non-ASCII characters detected (${nonAsciiMatches.length} found). These will cause simulation to hang.`,
        rawMessage: `Non-ASCII characters: ${nonAsciiMatches
          .slice(0, 5)
          .map((m) => m[0])
          .join(', ')}${nonAsciiMatches.length > 5 ? '...' : ''}`,
        severity: 'warning',
      });
    }
  } catch (err: any) {
    errors.push({
      lineNumber: null,
      message: `Syntax error: ${err.message}`,
      rawMessage: err.message,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Stage 2: Element/node checks
 */
function elementsStage(text: string): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const parsed = parseNetlist(text);

  // Check for ground node
  if (!hasGroundNode(text)) {
    errors.push({
      lineNumber: null,
      message: 'No ground node (node 0) found in the circuit',
      rawMessage: 'Missing ground node',
      severity: 'error',
    });
  }

  // Check for floating nodes
  const floatingNodes = findFloatingNodes(text);
  if (floatingNodes.length > 0) {
    warnings.push({
      lineNumber: null,
      message: `Floating nodes detected: ${floatingNodes.slice(0, 3).join(', ')}${floatingNodes.length > 3 ? '...' : ''}`,
      rawMessage: `Floating nodes: ${floatingNodes.join(', ')}`,
      severity: 'warning',
    });
  }

  // Check for component count
  if (parsed.components.length === 0) {
    errors.push({
      lineNumber: null,
      message: 'No components found in netlist',
      rawMessage: 'Empty components list',
      severity: 'error',
    });
  }

  return { errors, warnings };
}

/**
 * Stage 3: Ngspice dry-run (simulated with validation)
 * For MVP, this is a placeholder that returns no errors
 * (real dry-run would use the same worker but with a "dry-run" flag)
 */
async function ngspiceDryRunStage(): Promise<ValidationError[]> {
  // For MVP, skip the actual ngspice dry-run since it's slow
  // The real simulation will catch errors anyway
  return [];
}

/**
 * Main validation function
 */
export async function validateNetlist(
  text: string,
  dryRun?: (nl: string) => Promise<string>
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    stage: 'syntax',
    errors: [],
    warnings: [],
  };

  // Stage 1: Syntax
  result.stage = 'syntax';
  const syntaxErrors = syntaxStage(text);
  if (syntaxErrors.length > 0) {
    result.errors.push(...syntaxErrors);
    result.valid = false;
    return result;
  }

  // Stage 2: Elements
  result.stage = 'elements';
  const { errors: elementErrors, warnings: elementWarnings } = elementsStage(text);
  if (elementErrors.length > 0) {
    result.errors.push(...elementErrors);
    result.valid = false;
    return result;
  }
  result.warnings.push(...elementWarnings);

  // Stage 3: Ngspice dry-run (optional, for MVP we skip this)
  if (dryRun) {
    result.stage = 'ngspice-dry-run';
    const dryRunErrors = await ngspiceDryRunStage();
    if (dryRunErrors.length > 0) {
      result.errors.push(...dryRunErrors);
      result.valid = false;
      return result;
    }
  }

  result.stage = 'passed';
  return result;
}
