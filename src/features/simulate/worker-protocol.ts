/**
 * Typed message protocol between the main thread and sim.worker.ts
 */
import type { SimResult } from '@/shared/types';

export type SimulationProgressState = 'loading' | 'running';

export interface SimulateRequest {
  type: 'simulate';
  id: string;
  netlist: string;
}

export interface SimulateProgress {
  type: 'progress';
  id: string;
  state: SimulationProgressState;
}

export interface SimulateResponse {
  type: 'response';
  id: string;
  success: boolean;
  result?: SimResult;
  /** ngspice error lines (failure only) */
  errors?: string[];
  /** tail of ngspice info output (failure only) */
  info?: string;
  /** sanitiser notes + ngspice warnings */
  warnings?: string[];
  elapsedMs?: number;
}

export type SimulateError = { type: 'error'; id: string; message: string };

export type WorkerOutbound = SimulateProgress | SimulateResponse;

export function isSimulateProgress(msg: WorkerOutbound): msg is SimulateProgress {
  return msg.type === 'progress';
}

export function isSimulateResponse(msg: WorkerOutbound): msg is SimulateResponse {
  return msg.type === 'response';
}
