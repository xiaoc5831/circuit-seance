/**
 * "Possess a component": pick a part, drag its value (log slider, ÷10 … ×10) and the
 * CRT redraws live. The original trace stays on screen as a dashed ghost and the
 * headline measurement shows before → now. (Hand-written, polish round 3.)
 */
import type { LocaleKey } from '@/app/i18n';
import { formatHuman, SLIDER_STEPS, sliderToValue, type Possessable } from './possess';

export interface PossessReadout {
  label: string;
  before: string;
  now: string;
  /** now / before */
  ratio: number | null;
}

interface Props {
  parts: Possessable[];
  possessed: Possessable | null;
  pos: number;
  readout: PossessReadout | null;
  onPossess: (p: Possessable) => void;
  onSlide: (pos: number) => void;
  onRelease: () => void;
  t: (k: LocaleKey) => string;
}

const fmtRatio = (r: number) => `×${r >= 10 ? r.toFixed(0) : r >= 1 ? r.toFixed(2).replace(/\.?0+$/, '') : r.toPrecision(2)}`;

export function PossessPanel({ parts, possessed, pos, readout, onPossess, onSlide, onRelease, t }: Props) {
  if (!parts.length) return null;
  const value = possessed ? sliderToValue(pos, possessed.value) : null;
  const human = possessed && value != null ? formatHuman(value, possessed.unit) : '';
  const partRatio = possessed && value != null ? value / possessed.value : null;

  return (
    <section className="panel possess-panel" aria-labelledby="possess-title" data-testid="possess-panel">
      <header className="panel-head possess-head">
        <h2 id="possess-title">
          <svg className="possess-glyph" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 21V11a7 7 0 0 1 14 0v10l-2.3-1.6L14.3 21 12 19.4 9.7 21l-2.4-1.6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="9.5" cy="11" r="1.3" fill="currentColor" />
            <circle cx="14.5" cy="11" r="1.3" fill="currentColor" />
          </svg>{' '}
          {t('possess.title')}
        </h2>
        <div className="possess-parts" role="group" aria-label={t('possess.parts')}>
          {parts.map((p) => {
            const on = possessed?.name === p.name;
            return (
              <button
                key={`${p.line}-${p.name}`}
                type="button"
                className={`possess-chip${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => (on ? onRelease() : onPossess(p))}
                data-testid={`possess-${p.name}`}
              >
                <span className="chip-name">{p.name}</span> <span className="chip-val">{formatHuman(p.value, p.unit)}</span>
              </button>
            );
          })}
        </div>
      </header>
      {!possessed && <p className="hint small possess-hint">{t('possess.hint')}</p>}

      {possessed && value != null && (
        <div className="possess-live">
          <div className="possess-row">
            <label className="possess-label" htmlFor="possess-slider">
              <span className="possess-part">{possessed.name}</span>
              <span className="possess-value" data-testid="possess-value">
                {human}
              </span>
              {partRatio != null && Math.abs(partRatio - 1) > 0.005 && <span className="possess-ratio">{fmtRatio(partRatio)}</span>}
            </label>
            <div className="possess-track">
              <input
                id="possess-slider"
                className="possess-slider"
                type="range"
                min={0}
                max={SLIDER_STEPS}
                step={1}
                value={pos}
                aria-valuetext={`${possessed.name} ${human}`}
                aria-describedby="possess-help"
                onChange={(e) => onSlide(Number(e.target.value))}
                data-testid="possess-slider"
              />
              <div className="possess-scale" aria-hidden="true">
                <span>÷10</span>
                <span>{formatHuman(possessed.value, possessed.unit)}</span>
                <span>×10</span>
              </div>
            </div>
          </div>
          <p id="possess-help" className="sr-only">
            {t('possess.hintActive')}
          </p>
          <div className="possess-row foot">
            {readout ? (
              <p className="possess-readout" data-testid="possess-readout" aria-live="polite">
                <span className="ro-label">{readout.label}</span> <span className="ro-before">{readout.before}</span>
                <span aria-hidden="true"> → </span>
                <span className="sr-only">{t('possess.to')}</span>
                <span className="ro-now">{readout.now}</span>
                {readout.ratio != null && Math.abs(readout.ratio - 1) > 0.005 && <span className="possess-ratio"> {fmtRatio(readout.ratio)}</span>}
              </p>
            ) : (
              <span />
            )}
            <span className="hint small legend">
              <span className="ghost-swatch" aria-hidden="true" /> {t('possess.legend')}
            </span>
            <button type="button" className="btn ghost small" onClick={onRelease} data-testid="possess-release">
              {t('possess.release')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
