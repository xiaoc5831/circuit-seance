/**
 * Core type definitions for Circuit Séance
 */

// Analysis types supported by SPICE
export type AnalysisType = 'tran' | 'ac' | 'dc' | 'op';

// Raw result from eecircuit-engine
export interface SimResult {
  header: string;
  numVariables: number;
  variableNames: string[];
  numPoints: number;
  dataType: 'real' | 'complex';
  data: Array<{
    name: string;
    type: string;
    values: number[] | [number, number][]; // real or complex pairs
  }>;
}

// Compact numeric digest passed to the LLM spirit
export interface CompactSummary {
  analysisType: AnalysisType;
  tran?: {
    channels: Array<{
      name: string;
      min: number;
      max: number;
      final: number;
      tauEstimate: number | null; // 63.2% rise time constant
      riseTime: number | null; // 10%–90%
      overshootPct: number | null;
    }>;
  };
  ac?: {
    dcGainDb: number;
    minusThreeDbFreq: number | null; // Hz
    peakGainDb: number | null;
    peakFreqHz: number | null;
  };
  dc?: {
    sweepVar: string;
    outputVar: string;
    min: number;
    max: number;
    midSlopePerUnit: number;
  };
  op?: {
    nodeVoltages: Record<string, number>; // node name → volts
  };
}

// LLM configuration and preset types
export type ProviderPreset = 'qwen-dashscope' | 'openai' | 'gemini' | 'anthropic';

export interface LLMConfig {
  provider: ProviderPreset;
  apiKey: string;
  baseUrl: string; // user-editable
  model: string; // user-editable
}

export interface ProviderPresetInfo {
  baseUrl: string;
  model: string;
  displayName: string;
}

export const PROVIDER_PRESETS: Record<ProviderPreset, ProviderPresetInfo> = {
  'qwen-dashscope': {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max',
    displayName: 'Qwen-VL (DashScope)',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    displayName: 'OpenAI',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-1.5-pro',
    displayName: 'Gemini (OpenAI-compatible)',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    displayName: 'Anthropic Claude',
  },
};

// Application settings (persisted)
export interface AppSettings {
  llm: LLMConfig | null;
  storageMode: 'session' | 'local';
  language: 'en' | 'zh-CN';
}

// Captured image data
export interface CapturedImage {
  base64: string;
  mimeType: string;
  filename?: string;
  sizeBytes: number;
}

// Demo and sample assets
export interface SampleAsset {
  id: string;
  svgPath: string;
  netlistPath?: string;
  cannedExplanation?: {
    en: string;
    'zh-CN': string;
  };
  netlistText?: string; // inline for bundled examples
}

export type DemoStep = 'idle' | 'intro-animation' | 'transcribing' | 'simulating' | 'done';

// Homework check result
export interface HomeworkCheckResult {
  field: string;
  expected: number;
  actual: number | null;
  errorPct: number | null;
  pass: boolean;
  explanation: {
    en: string;
    'zh-CN': string;
  };
}

// Simulation state machine
export type SimulationState = 'idle' | 'loading' | 'running' | 'complete' | 'error';

// Error types
export class LLMError extends Error {
  constructor(
    public provider: ProviderPreset,
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}
