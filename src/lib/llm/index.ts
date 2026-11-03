/**
 * Public barrel for LLM adapter layer.
 */

export type { LLMAdapter, LLMErrorKind } from './adapter';
export { LLMError } from './adapter';
export { OpenAIAdapter } from './openai';
export { PROVIDER_PRESETS, resolvePresetId, DEFAULT_TIMEOUT_MS, COMPAT_TIMEOUT_MS } from './presets';
export type { ProviderPreset } from './presets';
export { TRANSCRIBE_SYSTEM_PROMPT, SPIRIT_SYSTEM_PROMPT } from './prompts';
export { createAdapter, type AdapterConfig } from './factory';
