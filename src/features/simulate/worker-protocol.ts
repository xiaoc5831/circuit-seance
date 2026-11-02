/**
 * Worker protocol types for simulation
 */

export type SimulationProgressState = 'loading' | 'running' | 'complete' | 'error';

export interface SimulateRequest {
  type: 'simulate';
  id: string;
  netlist: string;
  timeoutMs?: number;
}

export interface SimulateProgress {
  type: 'progress';
  id: string;
  state: SimulationProgressState;
  message?: string;
}

export interface SimulateResponse {
  type: 'response';
  id: string;
  success: boolean;
  result?: {
    header: string;
    numVariables: number;
    variableNames: string[];
    numPoints: number;
    dataType: 'real' | 'complex';
    data: Array<{
      name: string;
      type: string;
      values: number[] | Array<{ real: number; img: number }>;
    }>;
  };
  errors?: string[];
  info?: string;
}

export interface SimulateError {
  type: 'error';
  id: string;
  message: string;
  code?: string;
}

export type WorkerMessage = SimulateRequest | SimulateProgress | SimulateResponse | SimulateError;

export function isSimulateRequest(msg: WorkerMessage): msg is SimulateRequest {
  return msg.type === 'simulate';
}

export function isSimulateProgress(msg: WorkerMessage): msg is SimulateProgress {
  return msg.type === 'progress';
}

export function isSimulateResponse(msg: WorkerMessage): msg is SimulateResponse {
  return msg.type === 'response';
}

export function isSimulateError(msg: WorkerMessage): msg is SimulateError {
  return msg.type === 'error';
}

// Message event types
export interface SimulateRequestEvent extends MessageEvent {
  data: SimulateRequest;
}

export interface SimulateProgressEvent extends MessageEvent {
  data: SimulateProgress;
}

export interface SimulateResponseEvent extends MessageEvent {
  data: SimulateResponse;
}

export interface SimulateErrorEvent extends MessageEvent {
  data: SimulateError;
}

export type SimulateMessageEvent = 
  | SimulateRequestEvent 
  | SimulateProgressEvent 
  | SimulateResponseEvent 
  | SimulateErrorEvent;