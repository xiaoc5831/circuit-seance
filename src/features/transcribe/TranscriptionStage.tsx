/**
 * Paper → SPICE: the drawing (or photo) beside what the vision model read,
 * then the editable netlist with the Simulate button underneath.
 */
import type { ReactNode } from 'react';
import type { LocaleKey } from '@/app/i18n';

export type TxState = 'idle' | 'reading' | 'done' | 'error' | 'typed';

export interface TxView {
  state: TxState;
  /** image URL: bundled SVG or a data: URL of the user's photo */
  image?: string;
  imageAlt?: string;
  /** raw model response as shown (may be mid-typing) */
  text: string;
  live: boolean;
  provider?: string;
  error?: string;
}

interface Props {
  tx: TxView;
  t: (k: LocaleKey) => string;
  children: ReactNode; // the netlist editor block
}

export function TranscriptionStage({ tx, t, children }: Props) {
  const confidence = tx.text.match(/confidence:\s*(high|medium|low)/i)?.[1]?.toLowerCase();
  const showPair = tx.state === 'reading' || tx.state === 'done' || tx.state === 'error';

  return (
    <section className="panel tx-panel" aria-labelledby="tx-title">
      <header className="panel-head">
        <h2 id="tx-title">{t('tx.title')}</h2>
        {showPair && (
          <span className={`badge${tx.live ? ' live' : ''}`}>{tx.live ? `${t('mode.live')}` : 'DEMO'}</span>
        )}
      </header>

      {tx.state === 'idle' && <p className="hint">{t('tx.empty')}</p>}
      {tx.state === 'typed' && <p className="hint">{t('tx.typed')}</p>}

      {showPair && (
        <div className="tx-pair">
          <figure className="tx-figure">
            <figcaption>{t('tx.drawing')}</figcaption>
            <div className="paper">
              {tx.image && <img src={tx.image} alt={tx.imageAlt ?? t('tx.drawingAlt')} data-testid="tx-drawing" />}
            </div>
          </figure>
          <div className="tx-read">
            <div className="tx-read-head">
              <span>{t('tx.reading')}</span>
              {confidence && (
                <span className={`conf conf-${confidence}`}>
                  {t('tx.confidence')}: {confidence}
                </span>
              )}
            </div>
            <pre className="tx-text" data-testid="tx-text" aria-busy={tx.state === 'reading'}>
              {tx.text}
              {tx.state === 'reading' && <span className="caret" aria-hidden="true">█</span>}
            </pre>
            <p className="tx-source">
              {tx.state === 'reading' && !tx.text && t('tx.transcribing')}
              {tx.state !== 'reading' && (tx.live ? `${t('tx.live')} ${tx.provider ?? ''}` : t('tx.recorded'))}
            </p>
            {tx.state === 'error' && (
              <div className="inline-error" role="alert">
                <strong>{t('tx.failed')}</strong> {tx.error} <span>{t('tx.failedHint')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {children}
    </section>
  );
}
