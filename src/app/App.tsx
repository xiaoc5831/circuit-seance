/**
 * Circuit Séance — app shell and orchestration.
 *   séance table (drawing / classic / bench) → transcription (recorded or live vision LLM)
 *   → editable netlist → ngspice WASM worker → CRT scope → spirit (offline or live) + homework check
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageContext, getLocale, type LocaleKey } from './i18n';
import { SettingsDialog } from './SettingsDialog';
import { friendlySimError, type FriendlyError } from './sim-errors';
import { DEFAULT_LLM, forgetKey, introSeen, liveAdapter, llmStatus, loadLang, loadLlm, markIntroSeen, saveLang, saveLlm, type Lang } from './settings';
import { NetlistEditor } from '@/features/netlist';
import { useSimulation } from '@/features/simulate';
import { Scope, type ScopeStrings } from '@/features/scope';
import { DEMO_SAMPLES, type CircuitEntry } from '@/features/haunted/catalog';
import { IntroOverlay } from '@/features/demo/IntroOverlay';
import { SeanceTable, type TableTab } from '@/features/demo/SeanceTable';
import { TranscriptionStage, type TxView } from '@/features/transcribe/TranscriptionStage';
import { parseNetlistFromResponse } from '@/features/transcribe/llm-response-parser';
import { SpiritPanel, type SpiritView } from '@/features/spirit/SpiritPanel';
import { measure } from '@/features/spirit/measure';
import { hasCannedExplanation, offlineExplanation } from '@/features/spirit/offline-explainer';
import { fileToDataUrl } from '@/features/capture';
import { LLMError, PROVIDER_PRESETS } from '@/lib/llm';
import { useTranscribe } from '@/features/transcribe/use-transcribe';
import { PossessPanel, type PossessReadout } from '@/features/possess/PossessPanel';
import { findPossessable, SLIDER_MID, sliderToValue, withValue, type Possessable } from '@/features/possess/possess';
import { homeworkTargets } from '@/features/spirit/homework-check';
import { eng } from '@/features/scope/scope-math';
import type { SimResult } from '@/shared/types';
import { prefersReducedMotion } from '@/features/scope/scope-renderer';
import type { AnalysisType } from '@/shared/types';
import type { HomeworkField } from '@/features/spirit/homework-check';
import { sanitizeNetlist } from '@/features/simulate/sanitize';

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`;
const TYPE_MS = 1100; // how long the recorded transcription takes to "type"

export default function App() {
  const [lang, setLang] = useState<Lang>(loadLang);
  const locale = getLocale(lang);
  const t = useCallback((k: LocaleKey) => locale[k] ?? k, [locale]);

  // The API key is NOT held in React state: only whether one is saved. Adapters are built
  // per request by liveAdapter(), which reads localStorage at call time (spec 4.7).
  const [llm, setLlm] = useState(llmStatus);
  const hasKey = llm.hasKey;
  const providerLabel = PROVIDER_PRESETS[llm.provider]?.label ?? llm.baseUrl;
  const transcriber = useTranscribe({ getAdapter: liveAdapter });

  const [showIntro, setShowIntro] = useState(() => !introSeen());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<TableTab>('drawings');
  const [selected, setSelected] = useState<CircuitEntry | null>(null);
  const [tx, setTx] = useState<TxView>({ state: 'idle', text: '', live: false });
  const [netlist, setNetlist] = useState('');
  const [loadedNetlist, setLoadedNetlist] = useState('');
  const [simNetlist, setSimNetlist] = useState('');
  const [preError, setPreError] = useState<FriendlyError | null>(null);
  const [sweepKey, setSweepKey] = useState(0);
  const [live, setLive] = useState<SpiritView['live']>({ state: 'idle' });
  const runRef = useRef(0);
  const liveAbort = useRef<AbortController | null>(null);
  // "Possess a component"
  const [possess, setPossess] = useState<{ part: Possessable; base: string; baseResult: SimResult; pos: number; baseTarget: { field: HomeworkField; actual: number; unit: string } | null } | null>(null);
  const possessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sim = useSimulation();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = lang === 'zh-CN' ? '电路招魂 · Circuit Séance' : 'Circuit Séance · 电路招魂';
  }, [lang]);

  // start fetching/compiling the 20 MB engine while the intro plays
  useEffect(() => {
    if (showIntro) sim.warmUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------ simulation
  const hint: AnalysisType | null = useMemo(() => {
    const m = simNetlist.match(/^\s*\.(tran|ac|dc|op)\b/im);
    return m ? (m[1].toLowerCase() as AnalysisType) : null;
  }, [simNetlist]);

  const runSim = useCallback(
    (text: string, opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) {
        // a manual run / new circuit ends any possession
        if (possessTimer.current) clearTimeout(possessTimer.current);
        setPossess(null);
      }
      setLive({ state: 'idle' });
      liveAbort.current?.abort();
      const body = text.trim();
      if (!body) {
        setPreError({ title: t('net.empty'), detail: '' });
        return;
      }
      const lines = body.split('\n').slice(1); // first line is the title
      const usesGround = lines.some((l) => !/^\s*[*.;+]/.test(l) && /(^|\s)(0|gnd)(\s|$)/i.test(l.replace(/\(.*$/, '')));
      if (!usesGround) {
        setPreError({ title: t('net.noGround'), hint: t('err.singularHint'), detail: '' });
        return;
      }
      setPreError(null);
      setSimNetlist(text);
      if (!opts?.quiet) setSweepKey((k) => k + 1);
      void sim.simulate(text);
    },
    [sim, t],
  );

  // per-circuit probe choice (e.g. the 555 shows OUT and the timing capacitor, not the supply rail)
  const probes = useMemo(() => {
    if (!selected?.probes) return undefined;
    const bundled = selected.netlist.trim();
    return simNetlist.trim() === bundled || possess?.base.trim() === bundled ? selected.probes : undefined;
  }, [selected, simNetlist, possess]);

  const measurements = useMemo(() => {
    if (!sim.result) return null;
    try {
      return measure(sim.result, hint, probes);
    } catch {
      return null;
    }
  }, [sim.result, hint, probes]);

  // canned explanations only while the netlist is still the bundled one (edits → rule-based reading)
  const circuitId = useMemo(() => {
    if (!selected || !hasCannedExplanation(selected.id)) return null;
    return simNetlist.trim() === selected.netlist.trim() ? selected.id : null;
  }, [selected, simNetlist]);

  const offlineText = useMemo(
    () => (measurements ? offlineExplanation(circuitId, measurements, lang) : null),
    [measurements, circuitId, lang],
  );

  // ------------------------------------------------------------ summoning
  const summon = useCallback(
    (c: CircuitEntry) => {
      const run = ++runRef.current;
      setSelected(c);
      setPreError(null);
      if (possessTimer.current) clearTimeout(possessTimer.current);
      setPossess(null);
      // single-column layout: bring the scope into view so the waveform isn't off-screen
      if (window.matchMedia?.('(max-width: 1100px)').matches) {
        document.getElementById('scope-title')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
      if (!c.recordedVision) {
        setTx({ state: 'typed', text: '', live: false });
        setNetlist(c.netlist);
        setLoadedNetlist(c.netlist);
        runSim(c.netlist);
        return;
      }
      const full = c.recordedVision;
      const title = lang === 'zh-CN' ? c.title.zh : c.title.en;
      const base: TxView = { state: 'reading', text: '', live: false, image: c.drawing ? asset(c.drawing) : undefined, imageAlt: `${t('tx.drawingAlt')}: ${title}` };
      const done = () => {
        if (run !== runRef.current) return;
        const parsed = parseNetlistFromResponse(full);
        if ('error' in parsed) {
          setTx({ ...base, state: 'error', text: full, error: t('err.noFence') });
          return;
        }
        setTx({ ...base, state: 'done', text: full });
        setNetlist(parsed.netlist);
        setLoadedNetlist(parsed.netlist);
        runSim(parsed.netlist);
      };
      if (prefersReducedMotion()) {
        done();
        return;
      }
      setTx(base);
      setNetlist('');
      const t0 = performance.now();
      const step = () => {
        if (run !== runRef.current) return;
        const f = Math.min(1, (performance.now() - t0) / TYPE_MS);
        setTx({ ...base, text: full.slice(0, Math.floor(full.length * f)) });
        if (f < 1) setTimeout(step, 30);
        else done();
      };
      step();
    },
    [lang, runSim, t],
  );

  const onPhoto = useCallback(
    async (file: File) => {
      if (!hasKey) return;
      const run = ++runRef.current;
      setSelected(null);
      setPossess(null);
      let dataUrl: string;
      try {
        dataUrl = await fileToDataUrl(file);
      } catch {
        setTx({ state: 'error', text: '', live: true, provider: providerLabel, error: t('err.image') });
        return;
      }
      setTx({ state: 'reading', text: '', live: true, provider: providerLabel, image: dataUrl, imageAlt: file.name });
      const out = await transcriber.transcribe(dataUrl);
      if (!out || run !== runRef.current) return; // superseded
      if (out.ok) {
        setTx((s) => ({ ...s, state: 'done', text: out.raw }));
        setNetlist(out.netlist);
        setLoadedNetlist(out.netlist);
        runSim(out.netlist);
      } else if (out.kind === 'no-netlist') {
        setTx((s) => ({ ...s, state: 'error', text: out.raw, error: t('err.noFence') }));
      } else {
        setTx((s) => ({ ...s, state: 'error', error: out.kind === 'request' ? llmErrorText(out.cause, t) : t('err.llmBad') }));
      }
    },
    [hasKey, providerLabel, runSim, t, transcriber],
  );

  const askLive = useCallback(async () => {
    const adapter = liveAdapter();
    if (!adapter || !measurements) return;
    liveAbort.current?.abort();
    const ac = new AbortController();
    liveAbort.current = ac;
    setLive({ state: 'asking' });
    try {
      const digest = JSON.stringify(measurements).slice(0, 2000);
      const text = await adapter.explainWaveform(simNetlist, digest, lang, undefined, ac.signal);
      if (!ac.signal.aborted) setLive({ state: 'done', text });
    } catch (e) {
      if (!ac.signal.aborted) setLive({ state: 'error', error: llmErrorText(e, t) });
    }
  }, [measurements, simNetlist, lang, t]);

  // ------------------------------------------------------------ possession
  const possessParts = useMemo(() => (sim.result && !preError ? findPossessable(possess?.base ?? simNetlist) : []), [sim.result, preError, possess, simNetlist]);

  const onPossess = useCallback(
    (part: Possessable) => {
      if (!sim.result || !measurements) return;
      if (possessTimer.current) clearTimeout(possessTimer.current);
      const base = possess?.base ?? simNetlist;
      // switching parts: restore the previous one first
      if (possess && possess.pos !== SLIDER_MID) {
        setNetlist(base);
        runSim(base, { quiet: true });
      }
      const tg = homeworkTargets(measurements)[0] ?? null;
      setPossess({
        part,
        base,
        baseResult: possess?.baseResult ?? sim.result,
        pos: SLIDER_MID,
        baseTarget: possess?.baseTarget ?? (tg ? { field: tg.field, actual: tg.actual, unit: tg.unit } : null),
      });
    },
    [sim.result, measurements, possess, simNetlist, runSim],
  );

  const onSlide = useCallback(
    (pos: number) => {
      if (!possess) return;
      const next = withValue(possess.base, possess.part, sliderToValue(pos, possess.part.value));
      setPossess({ ...possess, pos });
      setNetlist(next);
      if (possessTimer.current) clearTimeout(possessTimer.current);
      // debounce: one engine, latest request wins inside useSimulation too
      possessTimer.current = setTimeout(() => runSim(next, { quiet: true }), 90);
    },
    [possess, runSim],
  );

  const onRelease = useCallback(() => {
    if (!possess) return;
    if (possessTimer.current) clearTimeout(possessTimer.current);
    setNetlist(possess.base);
    runSim(possess.base); // not quiet: ends the possession
  }, [possess, runSim]);

  const possessReadout: PossessReadout | null = useMemo(() => {
    if (!possess?.baseTarget || !measurements) return null;
    const bt = possess.baseTarget;
    const now = homeworkTargets(measurements).find((x) => x.field === bt.field);
    const fmt = (v: number) => (bt.unit ? eng(v, bt.unit, 3) : v.toPrecision(3));
    return {
      label: t(`hw.${bt.field}` as LocaleKey),
      before: fmt(bt.actual),
      now: now ? fmt(now.actual) : '—',
      ratio: now ? now.actual / bt.actual : null,
    };
  }, [possess, measurements, t]);

  const finishIntro = useCallback(() => {
    markIntroSeen();
    setShowIntro(false);
    setTab('drawings');
    summon(DEMO_SAMPLES[0]);
    setTimeout(() => document.getElementById('main')?.focus({ preventScroll: true }), 0);
  }, [summon]);

  const switchLang = () => {
    const next: Lang = lang === 'en' ? 'zh-CN' : 'en';
    setLang(next);
    saveLang(next);
    setLive({ state: 'idle' });
  };

  // ------------------------------------------------------------ derived view
  const busy = sim.state === 'loading' || sim.state === 'running';
  // while possessed, keep the last trace on screen (no "summoning" curtain between slider moves)
  const quietBusy = !!possess && busy && !!sim.result;
  const scopeStatus = preError ? 'error' : quietBusy ? 'complete' : sim.state;
  const scopeError = preError ?? (sim.error ? friendlySimError(sim.error, t) : null);
  const sanitised = useMemo(() => (netlist ? sanitizeNetlist(netlist).warnings : []), [netlist]);
  const edited = !!loadedNetlist && netlist.trim() !== loadedNetlist.trim();

  const scopeStrings: ScopeStrings = {
    noSignal: t('scope.noSignal'),
    noSignalHint: t('scope.noSignalHint'),
    summoning: t('scope.summoning'),
    summoningFirst: t('scope.summoningFirst'),
    running: t('scope.running'),
    restless: t('scope.restless'),
    showRaw: t('scope.showRaw'),
    opTitle: t('scope.opTitle'),
    channel: t('scope.channel'),
    timeDiv: t('scope.timeDiv'),
    voltsDiv: t('scope.voltsDiv'),
    auto: t('scope.auto'),
    cursorHint: t('scope.cursorHint'),
  };

  const statusText = (() => {
    if (preError) return `${t('status.error')}: ${preError.title}`;
    switch (sim.state) {
      case 'loading':
        return t('status.loading');
      case 'running':
        return t('status.running');
      case 'complete':
        return `${t('status.complete')}${sim.elapsedMs != null ? ` · ${sim.elapsedMs} ms` : ''}`;
      case 'error':
        return `${t('status.error')}: ${scopeError?.title ?? ''}`;
      default:
        return t('status.idle');
    }
  })();

  const selTitle = selected ? (lang === 'zh-CN' ? selected.title.zh : selected.title.en) : null;

  return (
    <LanguageContext.Provider value={{ language: lang, setLanguage: setLang, locale, t }}>
      <a className="skip-link" href="#main">
        {t('nav.skipToMain')}
      </a>
      <div className="app" aria-hidden={showIntro || undefined}>
        <header className="topbar">
          <div className="brand">
            <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
              <rect x="2" y="5" width="36" height="28" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M7 22 Q11 10 15 19 T23 19 T31 14 L34 14" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 33v3M27 33v3" stroke="currentColor" strokeWidth="2" />
            </svg>
            <div>
              <h1>
                {t('app.title')} <span className="brand-sub">{t('app.subtitle')}</span>
              </h1>
              <p className="tagline">{t('app.tagline')}</p>
            </div>
          </div>
          <div className="top-actions">
            <span className={`mode${hasKey ? ' live' : ''}`}>{hasKey ? `${t('mode.live')} · ${providerLabel}` : t('mode.demo')}</span>
            <button type="button" className="btn ghost small" onClick={() => setShowIntro(true)}>
              ▶ <span className="hide-sm">{t('nav.replayIntro')}</span>
              <span className="sr-only show-sm-sr">{t('nav.replayIntro')}</span>
            </button>
            <button type="button" className="btn ghost small" onClick={switchLang} aria-label={t('nav.language')} lang={lang === 'en' ? 'zh-CN' : 'en'}>
              {t('nav.languageToggle')}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog" data-testid="open-settings">
              ⚙ <span className="hide-sm">{t('nav.settings')}</span>
              <span className="sr-only show-sm-sr">{t('nav.settings')}</span>
            </button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="layout">
          <div className="col col-left">
            <SeanceTable
              tab={tab}
              onTab={setTab}
              selectedId={selected?.id ?? null}
              onSummon={summon}
              onPhoto={onPhoto}
              canUsePhoto={hasKey}
              onOpenSettings={() => setSettingsOpen(true)}
              busy={busy}
              t={t}
              lang={lang}
            />
            <TranscriptionStage tx={tx} t={t}>
              <div className="net-block">
                <div className="net-head">
                  <label htmlFor="netlist">
                    {t('net.title')}
                    {selTitle && <span className="net-for"> · {selTitle}</span>}
                    {edited && <span className="badge small amber">{t('net.edited')}</span>}
                  </label>
                  <span className="kbd-hint" id="net-hint">
                    <kbd>{t('net.shortcut')}</kbd>
                  </span>
                </div>
                <NetlistEditor value={netlist} onChange={setNetlist} onSimulate={() => runSim(netlist)} label={t('net.label')} describedBy="net-hint" />
                {sanitised.length > 0 && (
                  <p className="hint small">
                    {t('net.sanitised')} {sanitised.join(', ')}
                  </p>
                )}
                <button type="button" className="btn primary simulate" onClick={() => runSim(netlist)} disabled={busy || !netlist.trim()} data-testid="simulate">
                  {busy ? t('scope.summoning') : `▶ ${t('net.simulate')}`}
                </button>
              </div>
            </TranscriptionStage>
          </div>

          <div className="col col-right">
            <section className="panel scope-panel" aria-labelledby="scope-title">
              <header className="panel-head">
                <h2 id="scope-title">{t('scope.title')}</h2>
                <span className="scope-model" aria-hidden="true">
                  TEK-1973 · {selTitle ?? '—'}
                </span>
              </header>
              <div className="bezel">
                <Scope result={preError ? null : sim.result} analysisHint={hint} channels={probes} status={scopeStatus} error={scopeError} strings={scopeStrings} sweepKey={sweepKey} ghost={possess && possess.pos !== SLIDER_MID ? possess.baseResult : null} hold={!!possess} />
              </div>
            </section>
            <PossessPanel
              parts={possessParts}
              possessed={possess?.part ?? null}
              pos={possess?.pos ?? SLIDER_MID}
              readout={possessReadout}
              onPossess={onPossess}
              onSlide={onSlide}
              onRelease={onRelease}
              t={t}
            />
            <SpiritPanel
              view={{ offlineText: preError || sim.state === 'error' ? null : offlineText, live }}
              measurements={preError || sim.state === 'error' ? null : measurements}
              canAskLive={hasKey}
              onAskLive={askLive}
              onShowOffline={() => setLive({ state: 'idle' })}
              busy={busy}
              t={t}
            />
          </div>
        </main>

        <footer className="statusbar">
          <span className={`led ${scopeStatus}`} aria-hidden="true" />
          <span data-testid="sim-status" data-state={scopeStatus} aria-live="polite" aria-atomic="true">
            {statusText}
          </span>
          <span className="engine">{t('status.engine')}</span>
        </footer>
      </div>

      <SettingsDialog
        open={settingsOpen}
        value={settingsOpen ? loadLlm() : DEFAULT_LLM}
        t={t}
        onClose={() => setSettingsOpen(false)}
        onSave={(v) => {
          saveLlm(v);
          setLlm(llmStatus(v));
        }}
        onForget={() => {
          forgetKey();
          setLlm(llmStatus());
        }}
      />

      {showIntro && (
        <IntroOverlay
          lines={[t('intro.line1'), t('intro.line2'), t('intro.line3'), t('intro.line4')]}
          skipLabel={t('intro.skip')}
          label={t('intro.label')}
          title={t('app.title')}
          subtitle={t('app.subtitle')}
          onDone={finishIntro}
        />
      )}
    </LanguageContext.Provider>
  );
}

function llmErrorText(e: unknown, t: (k: LocaleKey) => string): string {
  if (e instanceof LLMError) {
    switch (e.kind) {
      case 'auth':
        return t('err.llmAuth');
      case 'rate-limit':
        return t('err.llmRate');
      case 'network':
        return t('err.llmNetwork');
      case 'timeout':
        return t('err.llmTimeout');
      default:
        return t('err.llmBad');
    }
  }
  return e instanceof Error ? e.message : String(e);
}

