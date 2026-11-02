/**
 * Séance intro: ≤ 6.5 s. CRT power-on, four typed lines (1973 Berkeley SPICE →
 * ngspice in WebAssembly), then fade out into the app, which auto-summons the RC demo.
 * Skippable at any moment (button, Esc, Enter). Under prefers-reduced-motion
 * the lines appear at once with no animation and it ends after ~5 s.
 */
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/features/scope/scope-renderer';

interface Props {
  lines: [string, string, string, string];
  skipLabel: string;
  label: string;
  title: string;
  subtitle: string;
  onDone: () => void;
}

const LINE_AT = [700, 1900, 3100, 4300];
const CHAR_MS = 26;
const FADE_AT = 6000;
const DONE_AT = 6500;
const REDUCED_DONE_AT = 5000;

export function IntroOverlay({ lines, skipLabel, label, title, subtitle, onDone }: Props) {
  const reduced = useRef(prefersReducedMotion()).current;
  const [now, setNow] = useState(reduced ? FADE_AT - 1 : 0);
  const [closing, setClosing] = useState(false);
  const doneRef = useRef(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    skipRef.current?.focus();
    if (reduced) {
      const t = setTimeout(finish, REDUCED_DONE_AT);
      return () => clearTimeout(t);
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const t = performance.now() - t0;
      setNow(t);
      if (t >= FADE_AT) setClosing(true);
      if (t >= DONE_AT) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = lines.map((l, i) => {
    if (reduced) return l;
    const n = Math.floor((now - LINE_AT[i]) / CHAR_MS);
    return n <= 0 ? '' : l.slice(0, n);
  });
  const activeLine = shown.findIndex((s, i) => s.length < lines[i].length);

  return (
    <div
      className={`intro${closing ? ' closing' : ''}${reduced ? ' reduced' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-testid="intro"
    >
      <div className="intro-tube">
        <div className="intro-screen">
          <div className="intro-title" aria-hidden={!reduced && now < 600}>
            <span className="intro-title-en">{title}</span>
            <span className="intro-title-zh">{subtitle}</span>
          </div>
          <ol className="intro-lines">
            {shown.map((s, i) => (
              <li key={i} className={i === 3 ? 'summon' : ''} aria-label={lines[i]}>
                <span aria-hidden="true">
                  {s}
                  {!reduced && i === activeLine && s.length > 0 && <span className="caret">█</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <button ref={skipRef} type="button" className="btn intro-skip" onClick={finish}>
        {skipLabel} <kbd>Esc</kbd>
      </button>
    </div>
  );
}
