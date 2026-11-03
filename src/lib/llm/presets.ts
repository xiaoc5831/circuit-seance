/**
 * LLM provider presets for Circuit Séance.
 * Qwen-VL (DashScope) is the default; OpenAI and Gemini via OpenAI-compatible API.
 * 'openai-compatible' is for any relay / self-hosted gateway that speaks
 * /chat/completions: the user supplies the base URL and model names.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  visionModel: string;
  textModel: string;
  /** request timeout; relays add queueing, so the custom preset waits longer */
  timeoutMs?: number;
  /** base URL (and model) must be typed by the user before a key is usable */
  needsBaseUrl?: boolean;
}

export const DEFAULT_TIMEOUT_MS = 60_000;
export const COMPAT_TIMEOUT_MS = 90_000;

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  'qwen-dashscope': {
    id: 'qwen-dashscope',
    label: 'Qwen-VL (DashScope)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    visionModel: 'qwen-vl-max',
    textModel: 'qwen-plus',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    visionModel: 'gpt-4o-mini',
    textModel: 'gpt-4o-mini',
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini (OpenAI-compatible)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    visionModel: 'gemini-2.0-flash',
    textModel: 'gemini-2.0-flash',
  },
  'openai-compatible': {
    id: 'openai-compatible',
    label: 'OpenAI-compatible (custom base URL)',
    baseUrl: '',
    // No default model yet: the vision eval that would pick one (docs/vision-eval.md)
    // is waiting on relay quota. The user types the model their gateway serves.
    visionModel: '',
    textModel: '',
    timeoutMs: COMPAT_TIMEOUT_MS,
    needsBaseUrl: true,
  },
};

/** Saved settings from before the rename ('custom') map onto the new preset. */
export function resolvePresetId(id: string): string {
  return id === 'custom' ? 'openai-compatible' : id;
}
