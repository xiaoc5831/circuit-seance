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

let sim: Simulation | null = null;

const REPLACEMENTS: Array<[RegExp, string, string]> = [
  [/[µμ]/g, 'u', 'µ → u'],
  [/[Ωω]/g, '', 'Ω removed'],
  [/τ/g, 'tau', 'τ → tau'],
  [/×/g, '*', '× → *'],
  [/[−–—]/g, '-', 'dash → -'],
  [/[“”]/g, '"', 'quotes'],
  [/[‘’]/g, "'", 'quotes'],
  [/\u3000/g, ' ', 'full-width space'],
];

export function sanitizeNetlist(netlist: string): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];
  let s = netlist.replace(/\r\n?/g, '\n');
  // full-width ASCII (Ａ-ｚ, ０-９, punctuation) → half-width
  s = s.replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  for (const [re, rep, label] of REPLACEMENTS) {
    if (re.test(s)) {
      s = s.replace(re, rep);
      warnings.push(label);
    }
  }
  // eslint-disable-next-line no-control-regex
  const rest = s.match(/[^\x00-\x7f]/g);
  if (rest) {
    // eslint-disable-next-line no-control-regex
    s = s.replace(/[^\x00-\x7f]/g, '');
    warnings.push(`${rest.length} non-ASCII character(s) removed`);
  }
  if (!/^\s*\.end\s*$/im.test(s)) s = s.trimEnd() + '\n.end\n';
  return { sanitized: s, warnings };
}

async function getSim(id: string): Promise<Simulation> {
  if (sim) return sim;
  const progress: SimulateProgress = { type: 'progress', id, state: 'loading' };
  postMessage(progress);
  const { Simulation: SimClass } = await import('eecircuit-engine');
  const instance = new SimClass();
  await instance.start();
  sim = instance;
  return instance;
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

self.onmessage = async (event: MessageEvent<SimulateRequest>) => {
  if (event.data?.type !== 'simulate') return;
  postMessage(await handle(event.data));
};
