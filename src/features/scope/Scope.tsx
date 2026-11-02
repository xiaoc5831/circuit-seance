/**
 * <Scope/> — the haunted CRT oscilloscope.
 * Canvas trace + DOM readouts (crisp text), measurement cursor, channel buttons,
 * V/div and time/div knobs (buttons, wheel and arrow keys), .op readout table,
 * and the empty / summoning / error states.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AnalysisType, SimResult } from '@/shared/types';
import {
  CHANNEL_COLORS,
  DIVS_X,
  autoScale,
  autoTimePerDiv,
  buildPlot,
  defaultChannelNames,
  eng,
  sampleAt,
  stepNice,
  type ChannelScale,
} from './scope-math';
import { ScopeRenderer } from './scope-renderer';

export interface ScopeStrings {
  noSignal: string;
  noSignalHint: string;
  summoning: string;
  summoningFirst: string;
  running: string;
  restless: string;
  showRaw: string;
  opTitle: string;
  channel: string;
  timeDiv: string;
  voltsDiv: string;
  auto: string;
  cursorHint: string;
}

export interface ScopeProps {
  result: SimResult | null;
  analysisHint?: AnalysisType | null;
  status: 'idle' | 'loading' | 'running' | 'complete' | 'error';
  error?: { title: string; detail: string; hint?: string } | null;
  strings: ScopeStrings;
  /** bump to replay the beam sweep on the same result */
  sweepKey?: number;
  /** preferred probes (variable names); falls back to automatic choice */
  channels?: string[];
}

export function Scope({ result, analysisHint, status, error, strings: s, sweepKey = 0, channels }: ScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ScopeRenderer | null>(null);
  const [hasTrace, setHasTrace] = useState(false);
  const [names, setNames] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<boolean[]>([true, true, true, true]);
  const [scales, setScales] = useState<ChannelScale[]>([]);
  const [xPerDiv, setXPerDiv] = useState(1);
  const [active, setActive] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null); // 0..1 across screen

  // choose channels + auto-scale whenever a new result arrives
  const plotAll = useMemo(() => {
    if (!result) return null;
    const ch = defaultChannelNames(result, 4, channels);
    return { ch, plot: buildPlot(result, ch, analysisHint) };
  }, [result, analysisHint, channels]);

  useEffect(() => {
    if (!plotAll) {
      setNames([]);
      return;
    }
    setNames(plotAll.ch);
    setEnabled([true, true, true, true]);
    setActive(0);
    const p = plotAll.plot;
    if (p.analysis === 'ac') {
      // shared dB scale across channels so magnitudes compare directly
      const mn = Math.min(...p.traces.map((t) => t.min));
      const mx = Math.max(...p.traces.map((t) => t.max));
      const sc = autoScale(Math.max(mn, mx - 120), mx);
      setScales(p.traces.map(() => sc));
    } else {
      setScales(p.traces.map((t) => autoScale(t.min, t.max)));
    }
    setXPerDiv(autoTimePerDiv(p.xMin, p.xMax));
  }, [plotAll]);

  const plot = plotAll?.plot ?? null;
  const isOp = plot?.analysis === 'op';

  // renderer lifecycle
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const r = new ScopeRenderer(c);
    r.onFirstTrace = () => setHasTrace(true);
    rendererRef.current = r;
    const ro = new ResizeObserver(() => r.resize());
    ro.observe(c);
    return () => {
      ro.disconnect();
      r.destroy();
      rendererRef.current = null;
    };
  }, []);

  // push data to the renderer (sweep animation only when the result itself changes)
  const lastResultRef = useRef<SimResult | null>(null);
  const lastSweepRef = useRef(sweepKey);
  useEffect(() => {
    const r = rendererRef.current;
    if (!r) return;
    const fresh = result !== lastResultRef.current || sweepKey !== lastSweepRef.current;
    lastResultRef.current = result;
    lastSweepRef.current = sweepKey;
    if (!plot || isOp || scales.length !== plot.traces.length) {
      r.setInput({ plot: null, enabled, scales: [], xPerDiv: 1, xStart: 0 }, false);
      return;
    }
    r.setInput({ plot, enabled, scales, xPerDiv, xStart: plot.xMin }, fresh);
  }, [plot, isOp, enabled, scales, xPerDiv, result, sweepKey]);

  const nudgeV = useCallback(
    (ch: number, dir: 1 | -1) =>
      setScales((sc) => sc.map((x, i) => (i === ch ? { ...x, perDiv: stepNice(x.perDiv, dir) } : x))),
    [],
  );
  const shiftV = useCallback(
    (ch: number, dir: 1 | -1) =>
      setScales((sc) => sc.map((x, i) => (i === ch ? { ...x, center: x.center - dir * (x.perDiv / 2) } : x))),
    [],
  );
  const nudgeT = useCallback((dir: 1 | -1) => setXPerDiv((v) => stepNice(v, dir)), []);
  const reAuto = useCallback(() => {
    if (!plot) return;
    setScales(plot.traces.map((t) => autoScale(t.min, t.max)));
    setXPerDiv(autoTimePerDiv(plot.xMin, plot.xMax));
  }, [plot]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!plot || isOp) return;
    const map: Record<string, () => void> = {
      ArrowUp: () => nudgeV(active, -1),
      ArrowDown: () => nudgeV(active, 1),
      ArrowLeft: () => nudgeT(-1),
      ArrowRight: () => nudgeT(1),
      PageUp: () => shiftV(active, 1),
      PageDown: () => shiftV(active, -1),
      a: reAuto,
      A: reAuto,
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
    if (/^[1-4]$/.test(e.key)) {
      const i = Number(e.key) - 1;
      if (i < names.length) setActive(i);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!plot || isOp) return;
    if (e.shiftKey) nudgeT(e.deltaY > 0 ? 1 : -1);
    else nudgeV(active, e.deltaY > 0 ? 1 : -1);
  };

  const onMove = (e: React.PointerEvent) => {
    const el = screenRef.current;
    if (!el || !plot || isOp) return;
    const rect = el.getBoundingClientRect();
    setCursor(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  };

  const cursorX = useMemo(() => {
    if (cursor == null || !plot) return null;
    if (plot.xLog) {
      const a = Math.log10(plot.xMin);
      const b = Math.log10(plot.xMax);
      return Math.pow(10, a + cursor * (b - a));
    }
    return plot.xMin + cursor * xPerDiv * DIVS_X;
  }, [cursor, plot, xPerDiv]);

  const xUnit = plot?.xLabel === 's' ? 's' : plot?.xLabel === 'Hz' ? 'Hz' : 'V';
  const busy = status === 'loading' || status === 'running';

  return (
    <div className="scope">
      <div
        ref={screenRef}
        className={`scope-screen${busy ? ' is-busy' : ''}`}
        tabIndex={0}
        role="img"
        aria-label={
          plot && !isOp
            ? `${plot.analysis} plot: ${plot.traces.map((t) => `${t.name} from ${eng(t.min, t.unit)} to ${eng(t.max, t.unit)}`).join('; ')}`
            : s.noSignal
        }
        aria-describedby="scope-help"
        onKeyDown={onKey}
        onWheel={onWheel}
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
      >
        <canvas
          ref={canvasRef}
          className="scope-canvas"
          data-testid="scope-canvas"
          data-has-trace={hasTrace && !!plot ? 'true' : 'false'}
        />
        <div className="crt-overlay" aria-hidden="true" />

        {/* corner readouts */}
        {plot && !isOp && (
          <>
            <div className="ro ro-tl" aria-hidden="true">
              {plot.analysis.toUpperCase()}
              {plot.analysis === 'ac' ? ' · BODE |H|' : ''}
            </div>
            <div className="ro ro-bl" aria-hidden="true">
              {plot.xLog ? `${eng(plot.xMin, 'Hz')} → ${eng(plot.xMax, 'Hz')} (log)` : `${eng(xPerDiv, xUnit)}/div`}
            </div>
            <div className="ro ro-tr" aria-hidden="true">
              {plot.traces.map((t, i) =>
                enabled[i] ? (
                  <span key={t.name} style={{ color: CHANNEL_COLORS[i] }}>
                    CH{i + 1} {eng(scales[i]?.perDiv ?? 1, t.unit)}/div
                  </span>
                ) : null,
              )}
            </div>
          </>
        )}

        {/* measurement cursor */}
        {cursor != null && plot && !isOp && cursorX != null && (
          <>
            <div className="cursor-line" style={{ left: `${cursor * 100}%` }} aria-hidden="true" />
            <div className={`cursor-box ${cursor > 0.62 ? 'left' : ''}`} style={{ left: `${cursor * 100}%` }}>
              <div>{eng(cursorX, xUnit, 4)}</div>
              {plot.traces.map((t, i) => {
                if (!enabled[i]) return null;
                const v = sampleAt(t, cursorX);
                return (
                  <div key={t.name} style={{ color: CHANNEL_COLORS[i] }}>
                    {t.name} {v == null ? '—' : eng(v, t.unit, 4)}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* .op readout */}
        {isOp && result && (
          <div className="op-readout">
            <div className="op-title">{s.opTitle}</div>
            <table>
              <tbody>
                {result.data.map((d) => {
                  const v = (d.values as unknown[])[0];
                  if (typeof v !== 'number') return null;
                  return (
                    <tr key={d.name}>
                      <th>{d.name}</th>
                      <td>{eng(v, /^i\(/.test(d.name) ? 'A' : 'V', 4)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* empty state */}
        {!plot && !busy && status !== 'error' && (
          <div className="scope-msg">
            <div className="scope-msg-title flicker">{s.noSignal}</div>
            <div className="scope-msg-sub">{s.noSignalHint}</div>
          </div>
        )}

        {/* summoning */}
        {busy && (
          <div className="scope-msg busy" role="status">
            <div className="planchette" aria-hidden="true">
              <span />
            </div>
            <div className="scope-msg-title">{status === 'loading' ? s.summoningFirst : s.running}</div>
          </div>
        )}

        {/* error */}
        {status === 'error' && error && !busy && (
          <div className="scope-msg error" role="alert">
            <div className="scope-msg-title">{s.restless}</div>
            <div className="scope-msg-sub">{error.title}</div>
            {error.hint && <div className="scope-msg-hint">{error.hint}</div>}
            {error.detail && (
              <details>
                <summary>{s.showRaw}</summary>
                <pre>{error.detail}</pre>
              </details>
            )}
          </div>
        )}
      </div>

      <p id="scope-help" className="sr-only">
        {s.cursorHint}
      </p>

      {/* controls */}
      {plot && !isOp && (
        <div className="scope-controls">
          <div className="ch-row" role="group" aria-label={s.channel}>
            {plot.traces.map((t, i) => (
              <button
                key={t.name}
                type="button"
                className={`ch-btn${enabled[i] ? ' on' : ''}${active === i ? ' active' : ''}`}
                style={{ ['--ch' as string]: CHANNEL_COLORS[i] }}
                aria-pressed={enabled[i]}
                onClick={() => {
                  if (active === i || !enabled[i]) setEnabled((en) => en.map((x, j) => (j === i ? !x : x)));
                  setActive(i);
                }}
                title={`${s.channel} ${i + 1}: ${t.name}`}
              >
                <span className="swatch" />
                CH{i + 1} <span className="ch-name">{t.name}</span>
              </button>
            ))}
          </div>
          <div className="knobs">
            <Knob
              label={`${s.voltsDiv} · CH${active + 1}`}
              value={eng(scales[active]?.perDiv ?? 1, plot.traces[active]?.unit ?? 'V')}
              onDec={() => nudgeV(active, -1)}
              onInc={() => nudgeV(active, 1)}
            />
            {!plot.xLog && (
              <Knob
                label={s.timeDiv}
                value={eng(xPerDiv, xUnit)}
                onDec={() => nudgeT(-1)}
                onInc={() => nudgeT(1)}
              />
            )}
            <button type="button" className="btn ghost auto-btn" onClick={reAuto}>
              {s.auto}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Knob({ label, value, onDec, onInc }: { label: string; value: string; onDec: () => void; onInc: () => void }) {
  return (
    <div
      className="knob"
      role="group"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
          e.preventDefault();
          onInc();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
          e.preventDefault();
          onDec();
        }
      }}
    >
      <span className="knob-label">{label}</span>
      <div className="knob-body">
        <button type="button" className="knob-btn" onClick={onDec} aria-label={`${label} −`} tabIndex={-1}>
          −
        </button>
        <span className="knob-dial" aria-live="polite">
          {value}
        </span>
        <button type="button" className="knob-btn" onClick={onInc} aria-label={`${label} +`} tabIndex={-1}>
          +
        </button>
      </div>
    </div>
  );
}
