/**
 * Parse LLM responses for transcribed netlists.
 * Handles: ```spice, ```cir, ```text fences; strips non-ASCII; parses Confidence level.
 */

export interface ParsedNetlist {
  netlist: string;
  confidence?: 'high' | 'medium' | 'low';
  note?: string;
}

export interface ParseError {
  error: 'no-fence' | 'empty-fence';
}

/**
 * Extract netlist from LLM response.
 * Accepts ```spice, ```cir, ```text fenced blocks (case-insensitive).
 * Captures trailing text and Confidence level.
 * Strips non-ASCII characters and reports them in note.
 */
export function parseNetlistFromResponse(raw: string): ParsedNetlist | ParseError {
  if (!raw || typeof raw !== 'string') {
    return { error: 'no-fence' };
  }

  // Match any fenced code block: ```spice, ```cir, ```text, or plain ```
  // Case-insensitive fence identifier. Handle various newline patterns.
  const fenceMatch = raw.match(/```(?:spice|cir|text)?\s*\n?([\s\S]*?)\n?```/i);

  if (!fenceMatch) {
    return { error: 'no-fence' };
  }

  let netlist = fenceMatch[1].trim();

  if (!netlist) {
    return { error: 'empty-fence' };
  }

  // Strip non-ASCII characters and track what was removed
  const nonAsciiChars = new Set<string>();
  let cleaned = '';
  for (const char of netlist) {
    if (char.charCodeAt(0) > 127) {
      nonAsciiChars.add(char);
    } else {
      cleaned += char;
    }
  }

  netlist = cleaned;

  // Parse Confidence level from trailing text
  let confidence: 'high' | 'medium' | 'low' | undefined;
  const confidenceMatch = raw.match(/Confidence:\s*(high|medium|low)/i);
  if (confidenceMatch) {
    confidence = confidenceMatch[1].toLowerCase() as 'high' | 'medium' | 'low';
  }

  // Capture any notes after Confidence line
  let note: string | undefined;
  const noteMatch = raw.match(/Confidence:.*?\n([\s\S]*?)$/);
  if (noteMatch && noteMatch[1].trim()) {
    note = noteMatch[1].trim();
  }

  // Add non-ASCII stripping info to note
  if (nonAsciiChars.size > 0) {
    const strippedChars = Array.from(nonAsciiChars).join('');
    const stripNote = `Stripped non-ASCII characters: ${strippedChars}`;
    note = note ? `${note}\n${stripNote}` : stripNote;
  }

  return {
    netlist,
    confidence,
    note,
  };
}
