import { beforeEach, describe, expect, it } from 'vitest';
import { forgetKey, liveAdapter, llmStatus, loadLlm, saveLlm, DEFAULT_LLM } from '@/app/settings';

describe('settings: the key stays in storage, not in app state', () => {
  beforeEach(() => localStorage.clear());
  it('llmStatus never carries the key', () => {
    saveLlm({ ...DEFAULT_LLM, apiKey: 'sk-secret' });
    const st = llmStatus();
    expect(st.hasKey).toBe(true);
    expect(JSON.stringify(st)).not.toContain('sk-secret');
  });
  it('liveAdapter reads the key at call time; null without one', () => {
    expect(liveAdapter()).toBeNull();
    saveLlm({ ...DEFAULT_LLM, apiKey: 'sk-1' });
    expect(liveAdapter()).not.toBeNull();
    forgetKey();
    expect(loadLlm().apiKey).toBe('');
    expect(liveAdapter()).toBeNull();
    expect(llmStatus().hasKey).toBe(false);
  });
});
