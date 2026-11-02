/**
 * React hook for managing simulation via Web Worker
 * Enforces timeout, recreates worker on hang, queues requests
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { SimResult, SimulateError } from '@/shared/types';
import {
  isSimulateProgress,
  isSimulateResponse,
  isSimulateError,
  SimulateRequest,
} from './worker-protocol';

export type SimulationState = 'idle' | 'loading' | 'running' | 'complete' | 'error';

interface PendingRequest {
  id: string;
  resolve: (result: SimResult) => void;
  reject: (error: SimulateError) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

export function useSimulation() {
  const [state, setState] = useState<SimulationState>('idle');
  const [result, setResult] = useState<SimResult | null>(null);
  const [error, setError] = useState<SimulateError | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const requestQueueRef = useRef<SimulateRequest[]>([]);
  const isProcessingRef = useRef(false);

  /**
   * Create or recreate the worker
   */
  const createWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (event: MessageEvent) => {
      const message = event.data;

      if (isSimulateProgress(message)) {
        const { state: progressState } = message;
        if (progressState === 'loading') {
          setState('loading');
        } else if (progressState === 'running') {
          setState('running');
        }
      } else if (isSimulateResponse(message)) {
        const { id, success, result: simResult, errors, info } = message;
        const pending = pendingRef.current.get(id);

        if (pending) {
          clearTimeout(pending.timeoutHandle);
          pendingRef.current.delete(id);

          if (success && simResult) {
            const result: SimResult = {
              header: simResult.header,
              numVariables: simResult.numVariables,
              variableNames: simResult.variableNames,
              numPoints: simResult.numPoints,
              dataType: simResult.dataType,
              data: simResult.data,
            };
            setResult(result);
            setError(null);
            setState('complete');
            pending.resolve(result);
          } else {
            const err: SimulateError = {
              message: errors?.join('; ') || info || 'Simulation failed',
              rawErrors: errors || [],
              rawInfo: info || '',
            };
            setError(err);
            setResult(null);
            setState('error');
            pending.reject(err);
          }
        }
      } else if (isSimulateError(message)) {
        const { id, message: errMsg } = message;
        const pending = pendingRef.current.get(id);

        if (pending) {
          clearTimeout(pending.timeoutHandle);
          pendingRef.current.delete(id);

          const err: SimulateError = {
            message: errMsg,
            rawErrors: [errMsg],
            rawInfo: '',
          };
          setError(err);
          setResult(null);
          setState('error');
          pending.reject(err);
        }
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      console.error('Worker error:', event.message);
      // Notify all pending requests
      pendingRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutHandle);
        pending.reject({
          message: 'The spirits went silent (worker crashed)',
          rawErrors: [event.message],
          rawInfo: '',
        });
      });
      pendingRef.current.clear();
      setState('error');
      setError({
        message: 'The spirits went silent (worker crashed)',
        rawErrors: [event.message],
        rawInfo: '',
      });

      // Recreate worker for next use
      workerRef.current = null;
    };

    workerRef.current = worker;
  }, []);

  /**
   * Process queued requests
   */
  const processQueue = useCallback(() => {
    if (isProcessingRef.current || requestQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    const request = requestQueueRef.current.shift();
    if (!request || !workerRef.current) {
      isProcessingRef.current = false;
      return;
    }

    const timeoutMs = (request as unknown as { timeoutMs?: number }).timeoutMs || 20000;

    let timeoutHandle: ReturnType<typeof setTimeout>;

    const cleanupTimeout = () => {
      clearTimeout(timeoutHandle);
    };

    timeoutHandle = setTimeout(() => {
      const pending = pendingRef.current.get(request.id);
      if (pending) {
        pendingRef.current.delete(request.id);
        pending.reject({
          message: 'The spirits went silent (timeout)',
          rawErrors: [`Simulation timed out after ${Math.round(timeoutMs / 1000)}s`],
          rawInfo: '',
        });
        setError({
          message: 'The spirits went silent (timeout)',
          rawErrors: [`Simulation timed out after ${Math.round(timeoutMs / 1000)}s`],
          rawInfo: '',
        });
        setState('error');

        // Recreate worker on timeout
        createWorker();
        isProcessingRef.current = false;
        processQueue();
      }
    }, timeoutMs);

    const promise = new Promise<SimResult>((resolve, reject) => {
      pendingRef.current.set(request.id, { id: request.id, resolve, reject, timeoutHandle });

      workerRef.current!.postMessage(request);
    });

    promise
      .then(() => {
        cleanupTimeout();
        isProcessingRef.current = false;
        processQueue();
      })
      .catch(() => {
        cleanupTimeout();
        isProcessingRef.current = false;
        processQueue();
      });
  }, [createWorker]);

  /**
   * Initialize worker on mount
   */
  useEffect(() => {
    createWorker();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      pendingRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutHandle);
      });
    };
  }, [createWorker]);

  /**
   * Main simulate function
   */
  const simulate = useCallback(
    (netlist: string, timeoutMs: number = 20000): Promise<SimResult> => {
      return new Promise((resolve, reject) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const request: SimulateRequest = {
          type: 'simulate',
          id,
          netlist,
          timeoutMs,
        };

        requestQueueRef.current.push(request);
        processQueue();

        // Store the promise handlers for this request
        const handle = setTimeout(() => {
          // Cleanup if not already handled
          pendingRef.current.delete(id);
        }, timeoutMs + 1000);

        pendingRef.current.set(id, {
          id,
          resolve,
          reject,
          timeoutHandle: handle,
        });
      });
    },
    [processQueue]
  );

  return {
    simulate,
    state,
    result,
    error,
  };
}
