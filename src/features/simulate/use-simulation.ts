/**
 * React hook that owns the simulation Web Worker.
 * - Worker is created lazily on the first simulate() call (keeps first paint light).
 * - Latest request wins: a newer simulate() supersedes an in-flight one.
 * - Timeout (default 20 s): the worker is terminated and recreated on the next call.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SimResult, SimulateError } from '@/shared/types';
import type { SimulateRequest, WorkerOutbound } from './worker-protocol';

export type SimulationState = 'idle' | 'loading' | 'running' | 'complete' | 'error';

export interface SimulationOutcome {
  result: SimResult | null;
  error: SimulateError | null;
  warnings: string[];
  elapsedMs: number | null;
}

interface Pending {
  id: string;
  resolve: (o: SimulationOutcome) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function useSimulation(defaultTimeoutMs = 20000) {
  const [state, setState] = useState<SimulationState>('idle');
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<SimulateError | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const engineReadyRef = useRef(false);

  const finish = useCallback((id: string, outcome: SimulationOutcome) => {
    const p = pendingRef.current;
    if (!p || p.id !== id) return;
    clearTimeout(p.timer);
    pendingRef.current = null;
    setResult(outcome.result);
    setError(outcome.error);
    setWarnings(outcome.warnings);
    setElapsedMs(outcome.elapsedMs);
    setState(outcome.error ? 'error' : 'complete');
    p.resolve(outcome);
  }, []);

  const getWorker = useCallback((): Worker => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (ev: MessageEvent<WorkerOutbound>) => {
      const msg = ev.data;
      if (msg.type === 'progress') {
        if (pendingRef.current?.id !== msg.id) return;
        if (msg.state === 'running') engineReadyRef.current = true;
        setState(msg.state);
        return;
      }
      if (msg.success && msg.result) {
        finish(msg.id, {
          result: msg.result,
          error: null,
          warnings: msg.warnings ?? [],
          elapsedMs: msg.elapsedMs ?? null,
        });
      } else {
        const raw = msg.errors ?? [];
        finish(msg.id, {
          result: null,
          error: { message: raw[0] ?? 'Simulation failed', rawErrors: raw, rawInfo: msg.info ?? '' },
          warnings: msg.warnings ?? [],
          elapsedMs: null,
        });
      }
    };
    w.onerror = (ev) => {
      const id = pendingRef.current?.id;
      workerRef.current?.terminate();
      workerRef.current = null;
      engineReadyRef.current = false;
      if (id)
        finish(id, {
          result: null,
          error: { message: 'worker-crashed', rawErrors: [ev.message || 'Worker crashed'], rawInfo: '' },
          warnings: [],
          elapsedMs: null,
        });
    };
    workerRef.current = w;
    return w;
  }, [finish]);

  const simulate = useCallback(
    (netlist: string, timeoutMs = defaultTimeoutMs): Promise<SimulationOutcome> => {
      // supersede any in-flight request
      const prev = pendingRef.current;
      if (prev) {
        clearTimeout(prev.timer);
        pendingRef.current = null;
        prev.resolve({ result: null, error: null, warnings: [], elapsedMs: null });
      }
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      setState(engineReadyRef.current ? 'running' : 'loading');
      return new Promise<SimulationOutcome>((resolve) => {
        // first run also downloads + compiles the WASM engine, so give it longer
        const budget = engineReadyRef.current ? timeoutMs : timeoutMs + 40000;
        const timer = setTimeout(() => {
          workerRef.current?.terminate();
          workerRef.current = null;
          engineReadyRef.current = false;
          finish(id, {
            result: null,
            error: {
              message: 'timeout',
              rawErrors: [`No answer from ngspice after ${Math.round(budget / 1000)} s`],
              rawInfo: '',
            },
            warnings: [],
            elapsedMs: null,
          });
        }, budget);
        pendingRef.current = { id, resolve, timer };
        const req: SimulateRequest = { type: 'simulate', id, netlist };
        getWorker().postMessage(req);
      });
    },
    [defaultTimeoutMs, finish, getWorker],
  );

  /** Start downloading/compiling the engine in the background (no simulation). */
  const warmUp = useCallback(() => {
    if (workerRef.current) return;
    getWorker().postMessage({
      type: 'simulate',
      id: 'warmup',
      netlist: 'warmup\nV1 1 0 1\nR1 1 0 1k\n.op\n.end\n',
    } satisfies SimulateRequest);
  }, [getWorker]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      if (pendingRef.current) clearTimeout(pendingRef.current.timer);
    },
    [],
  );

  return { simulate, warmUp, state, result, error, warnings, elapsedMs };
}
