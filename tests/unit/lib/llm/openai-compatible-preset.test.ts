/**
 * 'OpenAI-compatible (custom base URL)' preset: user-supplied base URL + model,
 * 90 s timeout, legacy 'custom' settings migrate, and the key only goes to that URL.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMPAT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, PROVIDER_PRESETS, resolvePresetId } from '@/lib/llm/presets';
import { createAdapter } from '@/lib/llm/factory';
import { LLMError } from '@/lib/llm/adapter';
import { DEFAULT_LLM, liveAdapter, llmStatus, loadLlm, saveLlm } from '@/app/settings';
import { parseNetlistFromResponse } from '@/features/transcribe/llm-response-parser';

const ok = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const compat = { provider: 'openai-compatible', apiKey: 'sk-relay', baseUrl: 'https://gw.example/v1/', visionModel: 'vis-1', textModel: '' };

describe('OpenAI-compatible preset', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('is offered next to the Qwen-VL default, with no base URL of its own', () => {
    const p = PROVIDER_PRESETS['openai-compatible'];
    expect(p.label).toBe('OpenAI-compatible (custom base URL)');
    expect(p.baseUrl).toBe('');
    expect(p.needsBaseUrl).toBe(true);
    expect(p.timeoutMs).toBe(COMPAT_TIMEOUT_MS);
    expect(DEFAULT_LLM.provider).toBe('qwen-dashscope');
    expect(PROVIDER_PRESETS['custom']).toBeUndefined();
  });

  it('is not usable until base URL and vision model are filled in', () => {
    expect(createAdapter({ ...compat, baseUrl: '' })).toBeNull();
    expect(createAdapter({ ...compat, visionModel: '  ' })).toBeNull();
    expect(createAdapter(compat)).not.toBeNull();
    saveLlm({ ...compat, visionModel: '' });
    expect(llmStatus().hasKey).toBe(false);
    expect(liveAdapter()).toBeNull();
  });

  it('posts to the custom base URL (trailing slash trimmed) with the typed model, key only in the header', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok('```spice\nt\nR1 1 0 1k\n.op\n.end\n```'));
    await createAdapter(compat)!.transcribeSchematic('data:image/jpeg;base64,AAAA');
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://gw.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-relay');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('vis-1');
    expect(String(init.body)).not.toContain('sk-relay');
  });

  it('uses the vision model for the spirit when no text model is given', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok('**What the trace shows:** ok'));
    await createAdapter(compat)!.explainWaveform('t\n.end', '{}', 'en');
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body)).model).toBe('vis-1');
  });

  it('waits 90 s (not 60 s) before giving up on a slow relay', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_u, init) =>
        new Promise((_res, rej) =>
          (init as RequestInit).signal!.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))),
        ),
    );
    let settled: unknown = 'pending';
    const p = createAdapter(compat)!
      .transcribeSchematic('data:image/jpeg;base64,AAAA')
      .catch((e) => (settled = e));
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS + 1_000);
    expect(settled).toBe('pending');
    await vi.advanceTimersByTimeAsync(COMPAT_TIMEOUT_MS - DEFAULT_TIMEOUT_MS);
    await p;
    expect(settled).toBeInstanceOf(LLMError);
    expect((settled as LLMError).kind).toBe('timeout');
    expect((settled as LLMError).message).toContain('90s');
  });

  it('keeps the 60 s timeout for the bundled presets', () => {
    expect(PROVIDER_PRESETS['qwen-dashscope'].timeoutMs ?? DEFAULT_TIMEOUT_MS).toBe(60_000);
  });

  it("migrates settings saved under the old 'custom' id", () => {
    expect(resolvePresetId('custom')).toBe('openai-compatible');
    expect(resolvePresetId('qwen-dashscope')).toBe('qwen-dashscope');
    localStorage.setItem('seance.llm', JSON.stringify({ ...compat, provider: 'custom' }));
    expect(loadLlm().provider).toBe('openai-compatible');
  });
});

describe('parser keeps micro values (found by the vision eval)', () => {
  it('1µF stays 1uF instead of silently becoming 1F', () => {
    const r = parseNetlistFromResponse('```spice\nt\nC1 out 0 1µF\nC2 a 0 4.7μ\n.end\n```');
    expect('netlist' in r && r.netlist).toContain('C1 out 0 1uF');
    expect('netlist' in r && r.netlist).toContain('C2 a 0 4.7u');
  });
});
