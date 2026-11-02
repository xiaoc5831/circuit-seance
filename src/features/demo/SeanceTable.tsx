/**
 * The séance table: three tabs (hand-drawn samples, Haunted Classics, bench netlists).
 * Proper ARIA tabs: arrow keys move between tabs, Home/End jump.
 */
import { useRef } from 'react';
import type { CircuitEntry } from '@/features/haunted/catalog';
import { CLASSICS, DEMO_SAMPLES, EXAMPLES } from '@/features/haunted/catalog';
import type { LocaleKey } from '@/app/i18n';
import type { Lang } from '@/app/settings';

export type TableTab = 'drawings' | 'classics' | 'bench';

interface Props {
  tab: TableTab;
  onTab: (t: TableTab) => void;
  selectedId: string | null;
  onSummon: (c: CircuitEntry) => void;
  onPhoto: (file: File) => void;
  canUsePhoto: boolean;
  onOpenSettings: () => void;
  busy: boolean;
  t: (k: LocaleKey) => string;
  lang: Lang;
}

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;
const TABS: TableTab[] = ['drawings', 'classics', 'bench'];

export function SeanceTable({ tab, onTab, selectedId, onSummon, onPhoto, canUsePhoto, onOpenSettings, busy, t, lang }: Props) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const L = (b: { en: string; zh: string }) => (lang === 'zh-CN' ? b.zh : b.en);
  const fileRef = useRef<HTMLInputElement>(null);

  const label: Record<TableTab, LocaleKey> = {
    drawings: 'table.tabDrawings',
    classics: 'table.tabClassics',
    bench: 'table.tabBench',
  };

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    let j = -1;
    if (e.key === 'ArrowRight') j = (i + 1) % TABS.length;
    if (e.key === 'ArrowLeft') j = (i - 1 + TABS.length) % TABS.length;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = TABS.length - 1;
    if (j >= 0) {
      e.preventDefault();
      onTab(TABS[j]);
      tabRefs.current[j]?.focus();
    }
  };

  return (
    <section className="panel table-panel" aria-labelledby="table-title">
      <header className="panel-head">
        <h2 id="table-title">{t('table.title')}</h2>
      </header>
      <div className="tabs" role="tablist" aria-label={t('table.title')}>
        {TABS.map((id, i) => (
          <button
            key={id}
            ref={(el) => (tabRefs.current[i] = el)}
            role="tab"
            id={`tab-${id}`}
            type="button"
            aria-selected={tab === id}
            aria-controls={`tabpanel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            className={`tab${tab === id ? ' on' : ''}`}
            onClick={() => onTab(id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t(label[id])}
          </button>
        ))}
      </div>

      {tab === 'drawings' && (
        <div role="tabpanel" id="tabpanel-drawings" aria-labelledby="tab-drawings" className="tabpanel">
          <p className="hint">{t('table.drawingsHint')}</p>
          <ul className="thumbs">
            {DEMO_SAMPLES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`thumb${selectedId === c.id ? ' on' : ''}`}
                  aria-pressed={selectedId === c.id}
                  onClick={() => onSummon(c)}
                  disabled={busy && selectedId === c.id}
                  data-testid={`sample-${c.id}`}
                >
                  <span className="thumb-paper">
                    <img src={asset(c.drawing!)} alt="" loading="lazy" />
                  </span>
                  <span className="thumb-title">{L(c.title)}</span>
                </button>
              </li>
            ))}
            <li>
              <div className={`thumb photo${canUsePhoto ? '' : ' locked'}`}>
                <span className="thumb-paper photo-paper" aria-hidden="true">
                  <svg viewBox="0 0 48 48" width="40" height="40">
                    <rect x="6" y="13" width="36" height="26" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <circle cx="24" cy="26" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M17 13l3-5h8l3 5" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  </svg>
                </span>
                <span className="thumb-title">{t('table.yourPhoto')}</span>
                <span className="thumb-sub">{canUsePhoto ? t('table.yourPhotoHint') : t('table.needsKey')}</span>
                {canUsePhoto ? (
                  <>
                    <input
                      ref={fileRef}
                      id="photo-input"
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onPhoto(f);
                        e.target.value = '';
                      }}
                    />
                    <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
                      {t('table.upload')}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn small ghost" onClick={onOpenSettings}>
                    {t('nav.settings')}
                  </button>
                )}
              </div>
            </li>
          </ul>
        </div>
      )}

      {tab === 'classics' && (
        <div role="tabpanel" id="tabpanel-classics" aria-labelledby="tab-classics" className="tabpanel">
          <p className="hint">{t('table.classicsHint')}</p>
          <ul className="classics">
            {CLASSICS.map((c) => (
              <li key={c.id} className={`classic${selectedId === c.id ? ' on' : ''}`}>
                <span className="classic-paper">
                  <img src={asset(c.drawing!)} alt="" loading="lazy" />
                  <span className="classic-year">{c.year}</span>
                </span>
                <div className="classic-body">
                  <h3>{L(c.title)}</h3>
                  {c.blurb && <p>{L(c.blurb)}</p>}
                  <button
                    type="button"
                    className="btn small"
                    onClick={() => onSummon(c)}
                    aria-label={`${t('table.resurrect')}: ${L(c.title)}`}
                    data-testid={`classic-${c.id}`}
                  >
                    {t('table.resurrect')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === 'bench' && (
        <div role="tabpanel" id="tabpanel-bench" aria-labelledby="tab-bench" className="tabpanel">
          <p className="hint">{t('table.benchHint')}</p>
          <ul className="bench">
            {EXAMPLES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`bench-btn${selectedId === c.id ? ' on' : ''}`}
                  aria-pressed={selectedId === c.id}
                  onClick={() => onSummon({ ...c, recordedVision: undefined, drawing: undefined })}
                  data-testid={`bench-${c.id}`}
                >
                  <span className="bench-title">{L(c.title)}</span>
                  <span className="bench-meta">{analysisOf(c.netlist)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function analysisOf(net: string): string {
  const m = net.match(/^\s*\.(tran|ac|dc|op)\b/im);
  return m ? `.${m[1].toLowerCase()}` : '';
}
