/**
 * Unit tests for OpenAI-compatible adapter.
 * Mocked fetch: success, 401 auth error, 429 rate-limit, malformed JSON, timeout.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIAdapter } from '@/lib/llm/openai';
import { LLMError } from '@/lib/llm/adapter';

// Mock fetch globally
global.fetch = vi.fn();

describe('OpenAIAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transcribeSchematic', () => {
    it('should successfully transcribe with vision model', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '```spice\nRC Lowpass\nR1 1 2 10k\nC1 2 0 100n\nV1 1 0 pulse(0 5 0 1u 1u 1u 2u)\n.tran 0 10m\n.end\n```\nConfidence: high',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      const result = await adapter.transcribeSchematic('data:image/png;base64,abc123');

      expect(result).toContain('```spice');
      expect(result).toContain('RC Lowpass');
      expect(result).toContain('Confidence: high');

      // Verify fetch was called with correct headers and body
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle 401 authentication error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('{"error": {"message": "Invalid authentication"}}', {
          status: 401,
        })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'invalid-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      try {
        await adapter.transcribeSchematic('data:image/png;base64,abc');
        expect.fail('Should have thrown LLMError');
      } catch (err) {
        expect(err).toBeInstanceOf(LLMError);
        if (err instanceof LLMError) {
          expect(err.kind).toBe('auth');
          expect(err.statusCode).toBe(401);
        }
      }
    });

    it('should handle 429 rate-limit error', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('{"error": {"message": "Rate limit exceeded"}}', {
          status: 429,
        })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      try {
        await adapter.transcribeSchematic('data:image/png;base64,abc');
      } catch (err) {
        expect(err).toBeInstanceOf(LLMError);
        if (err instanceof LLMError) {
          expect(err.kind).toBe('rate-limit');
          expect(err.statusCode).toBe(429);
        }
      }
    });

    it('should handle malformed JSON response', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response('invalid json {', { status: 200 })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      try {
        await adapter.transcribeSchematic('data:image/png;base64,abc');
      } catch (err) {
        expect(err).toBeInstanceOf(LLMError);
        if (err instanceof LLMError) {
          expect(err.kind).toBe('bad-response');
        }
      }
    });

    it('should handle empty response content', async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), {
          status: 200,
        })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      try {
        await adapter.transcribeSchematic('data:image/png;base64,abc');
      } catch (err) {
        expect(err).toBeInstanceOf(LLMError);
        if (err instanceof LLMError) {
          expect(err.kind).toBe('bad-response');
        }
      }
    });

    it('should support AbortSignal for cancellation', async () => {
      vi.mocked(global.fetch).mockImplementation(() => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      const abortController = new AbortController();
      try {
        await adapter.transcribeSchematic('data:image/png;base64,abc', abortController.signal);
        expect.fail('Should have thrown');
      } catch (err) {
        // AbortError → LLMError with 'timeout' kind
        expect(err).toBeInstanceOf(LLMError);
        if (err instanceof LLMError) {
          expect(err.kind).toBe('timeout');
        }
      }
    });

    it('should convert base64 string to data URL', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '```spice\ntest\n.end\n```\nConfidence: low',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      await adapter.transcribeSchematic('abc123def');

      // Verify the base64 string was converted to a data URL
      const callArgs = vi.mocked(global.fetch).mock.calls[0][1];
      if (callArgs && typeof callArgs === 'object' && 'body' in callArgs) {
        const body = JSON.parse(callArgs.body as string);
        const imageUrlContent = body.messages[1].content.find(
          (c: { type: string }) => c.type === 'image_url'
        );
        expect(imageUrlContent?.image_url?.url).toMatch(/^data:image/);
      }
    });
  });

  describe('explainWaveform', () => {
    it('should explain waveform in English', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content:
                '**What the trace shows:** The capacitor charges through the resistor...\n**Why:** RC time constant...\n**Try next:** Double the capacitor.',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      const summary = JSON.stringify({
        analysisType: 'tran',
        minValue: 0,
        maxValue: 5,
        finalValue: 5,
        tau: 0.001,
      });

      const result = await adapter.explainWaveform(
        'R1 1 2 10k\nC1 2 0 100n\n.end',
        summary,
        'en'
      );

      expect(result).toContain('What the trace shows');
      expect(result).toContain('Why');
      expect(result).toContain('Try next');
    });

    it('should explain waveform in Simplified Chinese', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '**波形表现:** 电容通过电阻充电...\n**原因:** RC时间常数...\n**尝试:** 加倍电容。',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      const summary = JSON.stringify({
        analysisType: 'tran',
        minValue: 0,
        maxValue: 5,
        finalValue: 5,
      });

      const result = await adapter.explainWaveform(
        'R1 1 2 10k\n.end',
        summary,
        'zh-CN'
      );

      expect(result).toContain('波形表现');
    });

    it('should include homework expected values in prompt', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '**What the trace shows:** ...\n**Why:** ...\n**Try next:** ...',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      const summary = JSON.stringify({
        analysisType: 'tran',
        tau: 0.001,
      });

      await adapter.explainWaveform(
        'R1 1 2 10k\n.end',
        summary,
        'en',
        { expectedTau: 0.0009 }
      );

      // Verify fetch was called
      expect(global.fetch).toHaveBeenCalled();

      // Verify the homework values are in the request body
      const callArgs = vi.mocked(global.fetch).mock.calls[0][1];
      if (callArgs && typeof callArgs === 'object' && 'body' in callArgs) {
        const body = JSON.parse(callArgs.body as string);
        const userContent = body.messages[1].content;
        expect(userContent).toContain('expectedTau');
      }
    });

    it('should never log or expose API key', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const mockResponse = {
        choices: [
          {
            message: {
              content: '**What the trace shows:** ...',
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'super-secret-key-12345',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      await adapter.explainWaveform(
        'R1 1 2 10k\n.end',
        JSON.stringify({ analysisType: 'tran' }),
        'en'
      );

      // Verify key is not logged
      const logs = consoleSpy.mock.calls.map((c) => c.join(' ')).join('\n');
      expect(logs).not.toContain('super-secret-key');

      // Verify key is only in Authorization header, never in body
      const callArgs = vi.mocked(global.fetch).mock.calls[0][1];
      if (callArgs && typeof callArgs === 'object' && 'body' in callArgs) {
        const body = callArgs.body as string;
        expect(body).not.toContain('super-secret-key');
      }

      consoleSpy.mockRestore();
    });
  });

  describe('timeout handling', () => {
    it('should handle timeout errors gracefully', async () => {
      // Simulate a timeout by rejecting with an AbortError
      vi.mocked(global.fetch).mockImplementation(() => {
        const err = new Error('Abort due to timeout');
        err.name = 'AbortError';
        return Promise.reject(err);
      });

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      try {
        await adapter.transcribeSchematic('data:image/png;base64,abc');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(LLMError);
        if (err instanceof LLMError) {
          expect(err.kind).toBe('timeout');
        }
      }
    });
  });

  describe('network error handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new TypeError('Failed to fetch')
      );

      const adapter = new OpenAIAdapter(
        'https://api.openai.com/v1',
        'test-key',
        'gpt-4o-mini',
        'gpt-4o-mini'
      );

      try {
        await adapter.transcribeSchematic('data:image/png;base64,abc');
      } catch (err) {
        expect(err).toBeInstanceOf(LLMError);
        if (err instanceof LLMError) {
          expect(err.kind).toBe('network');
        }
      }
    });
  });
});
