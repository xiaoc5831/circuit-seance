/**
 * Settings: BYOK provider config. Qwen-VL (DashScope) is the default preset.
 * The key is kept only in localStorage (see settings.ts) and never rendered back
 * in clear text (password field with optional reveal).
 */
import { useEffect, useRef, useState } from 'react';
import { PROVIDER_PRESETS } from '@/lib/llm/presets';
import type { AdapterConfig } from '@/lib/llm/factory';
import type { LocaleKey } from './i18n';

interface Props {
  open: boolean;
  value: AdapterConfig;
  onSave: (v: AdapterConfig) => void;
  onForget: () => void;
  onClose: () => void;
  t: (k: LocaleKey) => string;
}

export function SettingsDialog({ open, value, onSave, onForget, onClose, t }: Props) {
  const [draft, setDraft] = useState(value);
  const [msg, setMsg] = useState('');
  const [reveal, setReveal] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLSelectElement>(null);
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    setDraft(value);
    setMsg('');
    setReveal(false);
    setTimeout(() => firstRef.current?.focus(), 0);
    return () => {
      (openerRef.current as HTMLElement | null)?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const f = dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, [tabindex]:not([tabindex="-1"])');
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const setPreset = (id: string) => {
    const p = PROVIDER_PRESETS[id];
    setDraft((d) => ({ ...d, provider: id, baseUrl: p.baseUrl, visionModel: p.visionModel, textModel: p.textModel }));
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onKeyDown={onKey}
        data-testid="settings"
      >
        <header className="panel-head">
          <h2 id="settings-title">{t('settings.title')}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('settings.close')}>
            ✕
          </button>
        </header>
        <p className="hint">{t('settings.intro')}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            setMsg(t('settings.saved'));
          }}
        >
          <label htmlFor="s-provider">{t('settings.provider')}</label>
          <select ref={firstRef} id="s-provider" value={draft.provider} onChange={(e) => setPreset(e.target.value)}>
            {Object.values(PROVIDER_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <label htmlFor="s-key">{t('settings.apiKey')}</label>
          <div className="key-row">
            <input
              id="s-key"
              type={reveal ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={draft.apiKey}
              placeholder="sk-…"
              onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
              aria-describedby="s-key-note"
            />
            <button type="button" className="btn small ghost" onClick={() => setReveal((r) => !r)} aria-pressed={reveal}>
              {reveal ? '◉' : '◎'}
              <span className="sr-only">show key</span>
            </button>
          </div>
          <p id="s-key-note" className="hint small">
            {t('settings.keyNote')}
          </p>

          <label htmlFor="s-base">{t('settings.baseUrl')}</label>
          <input id="s-base" value={draft.baseUrl} spellCheck={false} onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))} />
          <div className="two">
            <div>
              <label htmlFor="s-vm">{t('settings.visionModel')}</label>
              <input id="s-vm" value={draft.visionModel} spellCheck={false} onChange={(e) => setDraft((d) => ({ ...d, visionModel: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="s-tm">{t('settings.textModel')}</label>
              <input id="s-tm" value={draft.textModel} spellCheck={false} onChange={(e) => setDraft((d) => ({ ...d, textModel: e.target.value }))} />
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn">
              {t('settings.save')}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                onForget();
                setDraft((d) => ({ ...d, apiKey: '' }));
                setMsg(t('settings.forgotten'));
              }}
            >
              {t('settings.forget')}
            </button>
            <span className="modal-msg" role="status">
              {msg}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
