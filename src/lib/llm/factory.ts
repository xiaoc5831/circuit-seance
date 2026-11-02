/**
 * createAdapter(config) → LLMAdapter. Every bundled preset speaks the
 * OpenAI chat-completions dialect, so they all map to OpenAIAdapter.
 */
import type { LLMAdapter } from './adapter';
import { OpenAIAdapter } from './openai';

export interface AdapterConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  visionModel: string;
  textModel: string;
}

export function createAdapter(config: AdapterConfig): LLMAdapter | null {
  const key = config.apiKey.trim();
  if (!key || !config.baseUrl.trim()) return null;
  return new OpenAIAdapter(
    config.baseUrl.trim().replace(/\/+$/, ''),
    key,
    config.visionModel.trim(),
    config.textModel.trim(),
  );
}
