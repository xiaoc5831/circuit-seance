/**
 * The Spirit: explains the current waveform.
 *  - offline (default, no key): offline-explainer with measured numbers
 *  - live (key set): LLM explanation from netlist + compact measurement digest
 * Plus the homework check (±5 %).
 */
import { useMemo, useState } from 'react';
import type { LocaleKey } from '@/app/i18n';
import { eng } from '@/features/scope/scope-math';
import { renderMarkdown } from './markdown';
import { checkHomework, homeworkTargets, parseQuantity, type HomeworkField, type HomeworkResult } from './homework-check';
import type { Measurements } from './measure';

export interface SpiritView {
  offlineText: string | null;
  live: { state: 'idle' | 'asking' | 'done' | 'error'; text?: string; error?: string };
}

interface Props {
  view: SpiritView;
  measurements: Measurements | null;
  canAskLive: boolean;
  onAskLive: () => void;
  onShowOffline: () => void;
  busy: boolean;
  t: (k: LocaleKey) => string;
}

const FIELD_LABEL: Record<HomeworkField, LocaleKey> = {
  tau: 'hw.tau',
  freq: 'hw.freq',
  f3db: 'hw.f3db',
  gain: 'hw.gain',
};

export function SpiritPanel({ view, measurements, canAskLive, onAskLive, onShowOffline, busy, t }: Props) {
  const showingLive = view.live.state === 'done' && !!view.live.text;
  const md = showingLive ? view.live.text! : view.offlineText;
  const html = useMemo(() => (md ? renderMarkdown(md) : ''), [md]);

  return (
    <section className="panel spirit-panel" aria-labelledby="spirit-title" aria-busy={busy || view.live.state === 'asking'}>
      <header className="panel-head">
        <h2 id="spirit-title">
          <span className="spirit-glyph" aria-hidden="true">
            ☾
          </span>{' '}
          {t('spirit.title')}
        </h2>
        {md && <span className={`badge${showingLive ? ' live' : ''}`}>{showingLive ? t('spirit.liveBadge') : 'OFFLINE'}</span>}
      </header>

      {busy && !md && (
        <div className="skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {!busy && !md && <p className="hint">{t('spirit.empty')}</p>}

      {md && (
        <>
          <div className={`spirit-text${busy ? ' stale' : ''}`} data-testid="spirit-text" dangerouslySetInnerHTML={{ __html: html }} />
          {!showingLive && <p className="tx-source">{t('spirit.offline')}</p>}
        </>
      )}

      <div className="spirit-actions">
        {view.live.state === 'asking' ? (
          <span className="asking" role="status">
            <span className="dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {t('spirit.asking')}
          </span>
        ) : canAskLive ? (
          <>
            <button type="button" className="btn" onClick={onAskLive} disabled={!measurements || busy}>
              {view.live.state === 'error' ? t('spirit.retry') : t('spirit.ask')}
            </button>
            {showingLive && (
              <button type="button" className="btn ghost" onClick={onShowOffline}>
                {t('spirit.backToOffline')}
              </button>
            )}
          </>
        ) : (
          md && <p className="hint small">{t('spirit.needsKey')}</p>
        )}
        {view.live.state === 'error' && (
          <div className="inline-error" role="alert">
            <strong>{t('spirit.failed')}</strong> {view.live.error}
          </div>
        )}
      </div>

      {measurements && !busy && <Homework measurements={measurements} t={t} />}
    </section>
  );
}

function Homework({ measurements, t }: { measurements: Measurements; t: (k: LocaleKey) => string }) {
  const targets = useMemo(() => homeworkTargets(measurements), [measurements]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, HomeworkResult | 'bad'>>({});

  if (!targets.length) return null;

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, HomeworkResult | 'bad'> = {};
    for (const tg of targets) {
      const raw = inputs[tg.field];
      if (!raw?.trim()) continue;
      const v = parseQuantity(raw);
      next[tg.field] = v == null ? 'bad' : checkHomework(tg, v);
    }
    setResults(next);
  };

  return (
    <details className="homework">
      <summary>{t('hw.title')}</summary>
      <form onSubmit={check}>
        <p className="hint small">{t('hw.hint')}</p>
        {targets.map((tg) => {
          const r = results[tg.field];
          const id = `hw-${tg.field}`;
          return (
            <div className="hw-row" key={tg.field}>
              <label htmlFor={id}>
                {t(FIELD_LABEL[tg.field])} <span className="hw-on">{tg.on}</span>
              </label>
              <div className="hw-input">
                <input
                  id={id}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={t('hw.placeholder')}
                  value={inputs[tg.field] ?? ''}
                  onChange={(e) => setInputs((s) => ({ ...s, [tg.field]: e.target.value }))}
                  aria-describedby={r ? `${id}-r` : undefined}
                />
                <span className="hw-unit">{tg.unit}</span>
              </div>
              {r && (
                <p id={`${id}-r`} className={`hw-result ${r === 'bad' ? 'bad' : r.pass ? 'pass' : 'fail'}`} role="status">
                  {r === 'bad'
                    ? t('hw.bad')
                    : `${r.pass ? '✓ ' + t('hw.pass') : '✗ ' + t('hw.fail')}: ${t('hw.sim')} ${eng(r.actual, tg.unit, 4)}, ${t('hw.off')} ${r.errorPct >= 0 ? '+' : ''}${r.errorPct.toFixed(1)} %`}
                </p>
              )}
            </div>
          );
        })}
        <button type="submit" className="btn small">
          {t('hw.check')}
        </button>
      </form>
    </details>
  );
}
