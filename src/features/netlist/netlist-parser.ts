/**
 * SPICE netlist parser
 * Handles: title, components (R/C/L/V/I/D/Q/M/E/F/G/H/X), directives, comments, continuation
 */

import type { AnalysisType } from '@/shared/types';

// Value suffix mapping
const VALUE_SUFFIX: Record<string, number> = {
  // Multipliers
  t: 1e12, // tera
  g: 1e9, // giga
  meg: 1e6, // mega
  k: 1e3, // kilo
  m: 1e-3, // milli
  u: 1e-6, // micro
  n: 1e-9, // nano
  p: 1e-12, // pico
  f: 1e-15, // femto
  a: 1e-18, // atto
};

// Component types by category


export interface ParsedLine {
  type: 'title' | 'component' | 'directive' | 'comment' | 'continuation' | 'empty';
  text: string;
  raw: string;
  lineNumber: number;
  // For components
  refdes?: string;
  nodes?: string[];
  value?: string;
  model?: string;
  // For directives
  directiveType?: AnalysisType | 'model' | 'subckt' | 'ends' | 'end' | 'save' | 'print' | 'probe';
  directiveParams?: string;
}

export interface ParsedNetlist {
  title: string | null;
  lines: ParsedLine[];
  components: Array<{
    refdes: string;
    nodes: string[];
    value: string;
    model?: string;
    lineNumber: number;
  }>;
  directives: Array<{
    type: AnalysisType | 'model' | 'subckt' | 'ends' | 'end';
    params: string;
    lineNumber: number;
  }>;
  comments: Array<{ text: string; lineNumber: number }>;
  hasTran: boolean;
  hasAc: boolean;
  hasDc: boolean;
  hasOp: boolean;
}

/**
 * Parse a value string like "1k", "100n", "2.5e-3"
 */
export function parseValue(valueStr: string): number | null {
  if (!valueStr) return null;

  const trimmed = valueStr.trim().toLowerCase();
  if (!trimmed) return null;

  // Try to match number + optional suffix
  const match = trimmed.match(/^([+-]?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*([a-z]*)$/);
  if (!match) return null;

  const [, numStr, suffix] = match;
  let value = parseFloat(numStr);
  if (isNaN(value)) return null;

  if (suffix in VALUE_SUFFIX) {
    value *= VALUE_SUFFIX[suffix];
  }

  return value;
}

/**
 * Detect analysis type from directive
 */
export function detectAnalysisType(lines: ParsedLine[]): AnalysisType | null {
  for (const line of lines) {
    if (line.type === 'directive' && line.directiveType) {
      if (
        line.directiveType === 'model' ||
        line.directiveType === 'subckt' ||
        line.directiveType === 'ends' ||
        line.directiveType === 'end' ||
        line.directiveType === 'save' ||
        line.directiveType === 'print' ||
        line.directiveType === 'probe'
      ) {
        continue;
      }
      if (['tran', 'ac', 'dc', 'op'].includes(line.directiveType)) {
        return line.directiveType as AnalysisType;
      }
    }
  }
  return null;
}

/**
 * Check if netlist has ground node (node 0)
 */
export function hasGroundNode(parsed: ParsedNetlist): boolean {
  const nodes = new Set<string>();
  for (const comp of parsed.components) {
    for (const node of comp.nodes) {
      nodes.add(node);
    }
  }
  return nodes.has('0');
}

/**
 * Parse a SPICE netlist into structured data
 */
export function parseNetlist(text: string): ParsedNetlist {
  const lines = text.split('\n');
  const parsedLines: ParsedLine[] = [];
  const components: Array<{
    refdes: string;
    nodes: string[];
    value: string;
    model?: string;
    lineNumber: number;
  }> = [];
  const directives: Array<{
    type: AnalysisType | 'model' | 'subckt' | 'ends' | 'end';
    params: string;
    lineNumber: number;
  }> = [];
  const comments: Array<{ text: string; lineNumber: number }> = [];

  let title: string | null = null;
  let hasTran = false;
  let hasAc = false;
  let hasDc = false;
  let hasOp = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const lineNum = i + 1;
    const trimmed = raw.trim();

    // Empty line
    if (!trimmed) {
      parsedLines.push({ type: 'empty', text: '', raw, lineNumber: lineNum });
      continue;
    }

    // Comment (starts with * or ;)
    if (trimmed.startsWith('*') || trimmed.startsWith(';')) {
      const commentText = trimmed.startsWith('*') ? trimmed.slice(1) : trimmed.slice(1);
      comments.push({ text: commentText, lineNumber: lineNum });
      parsedLines.push({ type: 'comment', text: commentText, raw, lineNumber: lineNum });
      continue;
    }

    // Continuation line (starts with +)
    if (trimmed.startsWith('+')) {
      parsedLines.push({ type: 'continuation', text: trimmed.slice(1), raw, lineNumber: lineNum });
      continue;
    }

    // Directive (starts with .)
    if (trimmed.startsWith('.')) {
      const rest = trimmed.slice(1);
      const parts = rest.split(/\s+/);
      const directiveName = parts[0].toLowerCase();

      let directiveType: ParsedLine['directiveType'] = directiveName as any;

      if (directiveName === 'tran') {
        hasTran = true;
      } else if (directiveName === 'ac') {
        hasAc = true;
      } else if (directiveName === 'dc') {
        hasDc = true;
      } else if (directiveName === 'op') {
        hasOp = true;
      } else if (
        ['model', 'subckt', 'ends', 'end', 'save', 'print', 'probe'].includes(directiveName)
      ) {
        // Known directive types
      } else {
        directiveType = undefined;
      }

      directives.push({
        type: directiveType as any,
        params: rest.slice(parts[0].length).trim(),
        lineNumber: lineNum,
      });

      parsedLines.push({
        type: 'directive',
        text: rest,
        raw,
        lineNumber: lineNum,
        directiveType,
        directiveParams: rest.slice(parts[0].length).trim(),
      });
      continue;
    }

    // Component line (starts with letter)
    const firstChar = trimmed.charAt(0);
    if (firstChar.match(/[a-zA-Z]/)) {
      const parts = trimmed.split(/\s+/);
      const refdes = parts[0];
      const nodes = parts.slice(1, -1); // All but first (refdes) and last (value/model)
      const value = parts.slice(-1)[0];

      // Extract model for devices that have it (D, Q, M, X)
      let model: string | undefined;
      if (['D', 'Q', 'M', 'X'].includes(firstChar.toUpperCase())) {
        // Model is typically the second-to-last or third-to-last token
        // For complex models, we need to handle quoted strings
        if (parts.length >= 3) {
          model = parts[parts.length - 2];
        }
      }

      components.push({
        refdes,
        nodes,
        value,
        model,
        lineNumber: lineNum,
      });

      parsedLines.push({
        type: 'component',
        text: trimmed,
        raw,
        lineNumber: lineNum,
        refdes,
        nodes,
        value,
        model,
      });
      continue;
    }

    // Unknown line - treat as comment
    comments.push({ text: trimmed, lineNumber: lineNum });
    parsedLines.push({ type: 'comment', text: trimmed, raw, lineNumber: lineNum });
  }

  // Extract title (first non-comment, non-empty line)
  for (const line of parsedLines) {
    if (line.type === 'component' || line.type === 'directive') {
      title = line.raw.trim();
      break;
    }
  }

  return {
    title,
    lines: parsedLines,
    components,
    directives,
    comments,
    hasTran,
    hasAc,
    hasDc,
    hasOp,
  };
}

/**
 * Validate the netlist and return warnings/errors
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  parsed?: ParsedNetlist;
}

export function validateNetlist(text: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Parse the netlist
  const parsed = parseNetlist(text);
  result.parsed = parsed;

  // Check for ground node
  if (!hasGroundNode(parsed)) {
    result.valid = false;
    result.errors.push('No ground node (node 0) found in the circuit');
  }

  // Check for analysis type
  const hasAnalysis = parsed.hasTran || parsed.hasAc || parsed.hasDc || parsed.hasOp;
  if (!hasAnalysis) {
    result.valid = false;
    result.errors.push('No analysis directive found (.tran, .ac, .dc, or .op required)');
  }

  // Check for component count
  if (parsed.components.length === 0) {
    result.valid = false;
    result.errors.push('No components found in netlist');
  }

  // Check for floating nodes (nodes that appear only once)
  const nodeConnections: Record<string, number> = {};
  for (const comp of parsed.components) {
    for (const node of comp.nodes) {
      nodeConnections[node] = (nodeConnections[node] || 0) + 1;
    }
  }

  const floatingNodes = Object.entries(nodeConnections)
    .filter(([_, count]) => count === 1)
    .map(([node]) => node);

  if (floatingNodes.length > 0) {
    result.warnings.push(`Floating nodes detected: ${floatingNodes.join(', ')}`);
  }

  // Check for non-ASCII characters (will cause eecircuit-engine to hang)
  const nonAsciiMatches = [...text.matchAll(/[^\x00-\x7F]/g)];
  if (nonAsciiMatches.length > 0) {
    result.warnings.push(
      `Non-ASCII characters detected (${nonAsciiMatches.length} found). These will cause simulation to hang.`
    );
  }

  // Check for .model references
  const modelRefs = new Set<string>();
  for (const comp of parsed.components) {
    if (comp.model) {
      modelRefs.add(comp.model.toLowerCase());
    }
  }

  const definedModels = new Set<string>();
  for (const dir of parsed.directives) {
    if (dir.type === 'model') {
      const parts = dir.params.split(/\s+/);
      if (parts.length > 0) {
        definedModels.add(parts[0].toLowerCase());
      }
    }
  }

  const undefinedModels = [...modelRefs].filter((m) => !definedModels.has(m));
  if (undefinedModels.length > 0) {
    result.warnings.push(`Undefined model(s): ${undefinedModels.join(', ')}`);
  }

  return result;
}
