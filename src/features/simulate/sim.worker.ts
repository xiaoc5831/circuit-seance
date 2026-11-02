/**
 * Web Worker for SPICE simulation.
 * - One Simulation instance per worker (several instances exhaust WASM memory).
 * - eecircuit-engine is imported lazily on the first request (20 MB chunk).
 * - Netlists are sanitised to ASCII first: any non-ASCII byte makes runSim() hang forever.
 * - getError() is reset by the engine on every run; a run failed when it produced no variables.
 */
import type { Simulation } from 'eecircuit-engine';
import type { SimResult } from '@/shared/types';
import type { SimulateRequest, SimulateResponse, SimulateProgress } from './worker-protocol';
import { sanitizeNetlist } from './sanitize';

let sim: Simulation | null = null;

// One engine per worker, created once. Concurrent first requests (e.g. the intro's
// warm-up + an early click) must share the same start() promise: a second
// Simulation instance in the same worker hangs ngspice forever.
let simPromise: Promise<Simulation> | null = null;

function getSim(id: string): Promise<Simulation> {
  if (sim) return Promise.resolve(sim);
  if (!simPromise) {
    postMessage({ type: 'progress', id, state: 'loading' } satisfies SimulateProgress);
    simPromise = (async () => {
      const { Simulation: SimClass } = await import('eecircuit-engine');
      const instance = new SimClass();
      await instance.start();
      sim = instance;
      return instance;
    })();
    simPromise.catch(() => {
      simPromise = null;
    });
  }
  return simPromise;
}

async function handle(req: SimulateRequest): Promise<SimulateResponse> {
  const { id } = req;
  const { sanitized, warnings } = sanitizeNetlist(req.netlist);
  try {
    const s = await getSim(id);
    postMessage({ type: 'progress', id, state: 'running' } satisfies SimulateProgress);
    s.setNetList(sanitized);
    const t0 = performance.now();
    const r = await s.runSim();
    const elapsedMs = Math.round(performance.now() - t0);
    const log = s.getError().filter((l) => l.trim().length > 0);
    const errors = log.filter((l) => /^\s*error/i.test(l) || /interrupted/i.test(l));
    if (!r || r.variableNames.length === 0 || r.numPoints < 1) {
      return {
        type: 'response',
        id,
        success: false,
        errors: errors.length ? errors : log.length ? log : ['ngspice produced no output'],
        info: s.getInfo().slice(-2000),
        warnings,
      };
    }
    return {
      type: 'response',
      id,
      success: true,
      result: {
        header: r.header,
        numVariables: r.numVariables,
        variableNames: r.variableNames,
        numPoints: r.numPoints,
        dataType: r.dataType,
        data: r.data as SimResult['data'],
      },
      warnings: [...warnings, ...log.filter((l) => /warning/i.test(l)).slice(0, 5)],
      elapsedMs,
    };
  } catch (err) {
    return {
      type: 'response',
      id,
      success: false,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings,
    };
  }
}

// ngspice is not re-entrant: run requests strictly one after another.
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<SimulateRequest>) => {
  if (event.data?.type !== 'simulate') return;
  const req = event.data;
  queue = queue.then(async () => {
    postMessage(await handle(req));
  });
};
