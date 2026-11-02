/**
 * Provider-agnostic LLM adapter interface.
 */

export type LLMErrorKind = 'auth' | 'rate-limit' | 'network' | 'bad-response' | 'timeout';

/**
 * Typed LLM error with HTTP status and error kind.
 * Never logs or echoes the API key.
 */
export class LLMError extends Error {
  constructor(
    public kind: LLMErrorKind,
    public statusCode: number | null,
    message: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * Provider-agnostic adapter interface.
 */
export interface LLMAdapter {
  /**
   * Transcribe a hand-drawn circuit schematic image to a SPICE netlist.
   * @param imageDataUrl - Data URL (data:image/png;base64,...) or base64 string of the image
   * @param signal - Optional AbortSignal for cancellation
   * @returns Raw LLM response containing a fenced SPICE block + confidence note
   */
  transcribeSchematic(imageDataUrl: string, signal?: AbortSignal): Promise<string>;

  /**
   * Explain the waveform using the ghost of a 1970s oscilloscope.
   * @param netlist - The SPICE netlist (text)
   * @param summary - Compact JSON summary of simulation results
   * @param language - 'en' or 'zh-CN'
   * @param homework - Optional expected values for homework check
   * @param signal - Optional AbortSignal for cancellation
   * @returns Markdown explanation (≤180 words, bilingual when language is zh-CN)
   */
  explainWaveform(
    netlist: string,
    summary: string, // JSON stringified CompactSummary
    language: 'en' | 'zh-CN',
    homework?: Record<string, number>,
    signal?: AbortSignal
  ): Promise<string>;
}
