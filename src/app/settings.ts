/**
 * User settings. Owner decision (2026-11-03): the API key lives ONLY in
 * localStorage on this device — never in sessionStorage, cookies, URLs or logs —
 * and is sent only to the configured provider base URL.
 */
import { PROVIDER_PRESETS } from '@/lib/llm/presets';
import type { AdapterConfig } from '@/lib/llm/factory';

export type Lang = 'en' | 'zh-CN';

const KEY_LLM = 'seance.llm';
const KEY_LANG = 'seance.lang';
const KEY_INTRO = 'seance.intro-seen';

export const DEFAULT_LLM: AdapterConfig = {
  provider: 'qwen-dashscope',
  apiKey: '',
  baseUrl: PROVIDER_PRESETS['qwen-dashscope'].baseUrl,
  visionModel: PROVIDER_PRESETS['qwen-dashscope'].visionModel,
  textModel: PROVIDER_PRESETS['qwen-dashscope'].textModel,
};

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // privacy mode / disabled storage
  }
}

export function loadLlm(): AdapterConfig {
  try {
    const raw = store()?.getItem(KEY_LLM);
    if (!raw) return { ...DEFAULT_LLM };
    const v = JSON.parse(raw) as Partial<AdapterConfig>;
    return { ...DEFAULT_LLM, ...v };
  } catch {
    return { ...DEFAULT_LLM };
  }
}

export function saveLlm(cfg: AdapterConfig): void {
  store()?.setItem(KEY_LLM, JSON.stringify(cfg));
}

export function forgetKey(cfg: AdapterConfig): AdapterConfig {
  const next = { ...cfg, apiKey: '' };
  saveLlm(next);
  return next;
}

export function loadLang(): Lang {
  const v = store()?.getItem(KEY_LANG);
  if (v === 'en' || v === 'zh-CN') return v;
  if (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language)) return 'zh-CN';
  return 'en';
}

export function saveLang(l: Lang): void {
  store()?.setItem(KEY_LANG, l);
}

export function introSeen(): boolean {
  if (typeof window !== 'undefined' && /[?&]nointro\b/.test(window.location.search)) return true;
  return store()?.getItem(KEY_INTRO) === '1';
}

export function markIntroSeen(): void {
  store()?.setItem(KEY_INTRO, '1');
}
