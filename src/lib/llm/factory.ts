/**
 * createAdapter(config) → LLMAdapter. Every bundled preset speaks the
 * OpenAI chat-completions dialect, so they all map to OpenAIAdapter.
 */
import type { LLMAdapter } from './adapter';
import { OpenAIAdapter } from './openai';
import { DEFAULT_TIMEOUT_MS, PROVIDER_PRESETS, resolvePresetId } from './presets';

export interface AdapterConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  textModel: string;
}

export function createAdapter(config: AdapterConfig): LLMAdapter | null {
  const key = config.apiKey.trim();
  if (!key || !config.baseUrl.trim() || !config.visionModel.trim()) return null;
  const preset = PROVIDER_PRESETS[resolvePresetId(config.provider)];
  return new OpenAIAdapter(
    config.baseUrl.trim().replace(/\/+$/, ''),
    key,
    config.visionModel.trim(),
    // a gateway that only serves one model: reuse the vision model for the spirit
    config.textModel.trim() || config.visionModel.trim(),
    preset?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
}
