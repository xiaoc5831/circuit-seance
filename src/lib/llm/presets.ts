/**
 * LLM provider presets for Circuit Séance.
 * Qwen-VL (DashScope) is the default; OpenAI and Gemini via OpenAI-compatible API.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  visionModel: string;
  textModel: string;
}

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
  custom: {
    id: 'custom',
    label: 'Custom',
    baseUrl: 'https://api.example.com/v1',
    visionModel: 'model-name',
    textModel: 'model-name',
  },
};
