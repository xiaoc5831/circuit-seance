/**
 * OpenAI-compatible LLM adapter.
 * Covers: Qwen-VL (DashScope), OpenAI, Gemini, and any OpenAI-compatible API.
 */

import { LLMAdapter, LLMError } from './adapter';
import { TRANSCRIBE_SYSTEM_PROMPT, SPIRIT_SYSTEM_PROMPT } from './prompts';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<{ type: 'text' | 'image_url'; text?: string; image_url?: { url: string } }>;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const REQUEST_TIMEOUT_MS = 60_000; // default; the OpenAI-compatible preset passes 90 s

/**
 * OpenAI-compatible adapter supporting image input via image_url content part.
 */
export class OpenAIAdapter implements LLMAdapter {
  constructor(
    private baseUrl: string,
    private apiKey: string,
    private visionModel: string,
    private textModel: string,
    private timeoutMs: number = REQUEST_TIMEOUT_MS
  ) {}

  async transcribeSchematic(imageDataUrl: string, signal?: AbortSignal): Promise<string> {
    // Ensure imageDataUrl is a proper data URL
    let url = imageDataUrl;
    if (!url.startsWith('data:')) {
      // If it's a raw base64 string, convert to data URL
      url = `data:image/png;base64,${url}`;
    }

    const request: ChatCompletionRequest = {
      model: this.visionModel,
      messages: [
        {
          role: 'system',
          content: TRANSCRIBE_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url },
            },
            {
              type: 'text',
              text: 'Please transcribe this circuit schematic into a SPICE netlist.',
            },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    };

    return this._makeRequest(request, signal);
  }

  async explainWaveform(
    netlist: string,
    summary: string,
    language: 'en' | 'zh-CN',
    homework?: Record<string, number>,
    signal?: AbortSignal
  ): Promise<string> {
    let userPrompt = `Here is a SPICE netlist:\n\`\`\`\n${netlist}\n\`\`\`\n\nSimulation summary (JSON):\n\`\`\`json\n${summary}\n\`\`\`\n\nExplain this waveform for an undergraduate student.`;

    if (homework && Object.keys(homework).length > 0) {
      userPrompt += `\n\nHomework expected values:\n${JSON.stringify(homework, null, 2)}\n\nCompare the actual results with the expected values and state matches/mismatches with percentage error.`;
    }

    const systemPrompt =
      language === 'zh-CN'
        ? SPIRIT_SYSTEM_PROMPT + '\n\n(Response must be entirely in Simplified Chinese.)'
        : SPIRIT_SYSTEM_PROMPT;

    const request: ChatCompletionRequest = {
      model: this.textModel,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 512,
    };

    return this._makeRequest(request, signal);
  }

  private async _makeRequest(
    request: ChatCompletionRequest,
    signal?: AbortSignal
  ): Promise<string> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Set up timeout to abort the request after 60s
    timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    // Abort on either the caller's signal or the 60 s timeout (hand fix: the
    // original ignored the timeout whenever a caller signal was passed)
    if (signal) {
      if (signal.aborted) controller.abort();
      else signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    const mergedSignal = controller.signal;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: mergedSignal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        let kind: 'auth' | 'rate-limit' | 'network' | 'bad-response' = 'bad-response';
        if (response.status === 401 || response.status === 403) {
          kind = 'auth';
        } else if (response.status === 429) {
          kind = 'rate-limit';
        }

        const text = await response.text();
        throw new LLMError(
          kind,
          response.status,
          `LLM request failed (${response.status}): ${text.substring(0, 200)}`
        );
      }

      let data: ChatCompletionResponse;
      try {
        data = await response.json();
      } catch {
        throw new LLMError('bad-response', response.status, 'Failed to parse LLM response JSON');
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new LLMError('bad-response', 200, 'Empty response from LLM');
      }

      return content;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      // Rethrow LLMError as-is
      if (err instanceof LLMError) {
        throw err;
      }

      // Handle AbortError (timeout or cancellation)
      // DOMException is the runtime type for AbortError
      if (err instanceof DOMException || (err instanceof Error && err.name === 'AbortError')) {
        throw new LLMError('timeout', null, `LLM request timed out or was cancelled (${Math.round(this.timeoutMs / 1000)}s)`);
      }

      // Network error
      if (err instanceof TypeError) {
        throw new LLMError('network', null, `Network error: ${err.message}`);
      }

      throw err;
    }
  }
}
