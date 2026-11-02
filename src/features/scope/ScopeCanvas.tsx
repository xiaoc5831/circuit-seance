/**
 * Oscilloscope canvas component
 * Owns RAF loop, ResizeObserver, and ScopeRenderer instance
 */

import { useEffect, useRef } from 'react';
import type { SimResult, AnalysisType } from '@/shared/types';
import { ScopeRenderer, type ScopeViewState } from './scope-renderer';
import { playCRTPowerOn } from './phosphor-effects';

interface ScopeCanvasProps {
  simResult: SimResult | null;
  locale: Record<string, string>;
  analysisType: AnalysisType;
  voltsPerDiv?: number;
  timePerDiv?: number;
  channels?: ScopeViewState['channels'];
}

export function ScopeCanvas({
  simResult,
  locale,
  analysisType,
  voltsPerDiv = 1,
  timePerDiv = 0.1,
  channels = [
    { enabled: true, variableIndex: 1, color: '#39ff14' },
    { enabled: false, variableIndex: 2, color: '#00ff00' },
    { enabled: false, variableIndex: 3, color: '#00aa00' },
    { enabled: false, variableIndex: 4, color: '#005500' },
  ],
}: ScopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ScopeRenderer | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const powerOnDoneRef = useRef(false);

  // Initialize renderer and start RAF loop
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const renderer = new ScopeRenderer(canvas);
    rendererRef.current = renderer;

    // Play power-on animation once
    if (!powerOnDoneRef.current) {
      powerOnDoneRef.current = true;
      playCRTPowerOn(renderer['ctx']).catch(() => {
        // Silently fail if animation fails
      });
    }

    // ResizeObserver to handle canvas resizing
    const resizeObserver = new ResizeObserver(() => {
      renderer.onResize();
    });
    resizeObserver.observe(canvas);
    resizeObserverRef.current = resizeObserver;

    // RAF loop
    function raf(now: DOMHighResTimeStamp) {
      const viewState: ScopeViewState = {
        voltsPerDiv,
        timePerDiv,
        channels,
        analysisType,
      };
      renderer.draw(viewState, simResult, now);
      rafIdRef.current = requestAnimationFrame(raf);
    }

    rafIdRef.current = requestAnimationFrame(raf);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [simResult, analysisType, voltsPerDiv, timePerDiv, channels, locale]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="scope-canvas"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        background: '#0a0f0a',
        border: '1px solid #39ff14',
        boxSizing: 'border-box',
      }}
    />
  );
}
