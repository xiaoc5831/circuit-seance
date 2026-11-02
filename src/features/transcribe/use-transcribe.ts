/**
 * React hook for circuit image transcription.
 * State machine: idle → loading → done/error
 * Supports: live LLM call OR demo mode (preRecordedResponse) with ~1.6s delay
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LLMAdapter } from '@/lib/llm';
import { parseNetlistFromResponse } from './llm-response-parser';

export type TranscribeState = 'idle' | 'loading' | 'done' | 'error';

export interface UseTranscribeOptions {
  adapter?: LLMAdapter | null;
  recordedResponse?: string; // demo/judge mode
}

export interface UseTranscribeResult {
  transcribe: (imageDataUrl: string) => Promise<void>;
  state: TranscribeState;
  netlist: string | null;
  note: string | null;
  error: string | null;
  abort: () => void;
}

/**
 * Hook for transcribing circuit schematics to SPICE netlists.
 * Accepts either a live adapter or a preRecordedResponse for demo mode.
 */
export function useTranscribe(options?: UseTranscribeOptions): UseTranscribeResult {
  const [state, setState] = useState<TranscribeState>('idle');
  const [netlist, setNetlist] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Cleanup on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (demoTimeoutRef.current) {
        clearTimeout(demoTimeoutRef.current);
      }
    };
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (demoTimeoutRef.current) {
      clearTimeout(demoTimeoutRef.current);
    }
    if (isMountedRef.current) {
      setState('idle');
      setError(null);
    }
  }, []);

  const transcribe = useCallback(
    async (imageDataUrl: string) => {
      // Reset state
      setNetlist(null);
      setNote(null);
      setError(null);

      if (!isMountedRef.current) return;

      // Demo mode: simulated transcription with delay
      if (options?.recordedResponse) {
        setState('loading');

        // Simulate ~1.6s latency
        demoTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;

          const result = parseNetlistFromResponse(options.recordedResponse!);
          if ('error' in result) {
            setError(`Transcription failed: ${result.error}`);
            setState('error');
          } else {
            setNetlist(result.netlist);
            setNote(result.note || null);
            setState('done');
          }
        }, 1600);

        return;
      }

      // Live mode: call adapter
      if (!options?.adapter) {
        setError('No LLM adapter configured');
        setState('error');
        return;
      }

      setState('loading');
      abortControllerRef.current = new AbortController();

      try {
        const response = await options.adapter.transcribeSchematic(
          imageDataUrl,
          abortControllerRef.current.signal
        );

        if (!isMountedRef.current) return;

        const result = parseNetlistFromResponse(response);
        if ('error' in result) {
          setError(`Transcription failed: ${result.error}`);
          setState('error');
        } else {
          setNetlist(result.netlist);
          setNote(result.note || null);
          setState('done');
        }
      } catch (err) {
        if (!isMountedRef.current) return;

        // Check if it was an abort
        if (err instanceof Error && err.name === 'AbortError') {
          setState('idle');
          return;
        }

        const message = err instanceof Error ? err.message : 'Unknown transcription error';
        setError(message);
        setState('error');
      } finally {
        abortControllerRef.current = null;
      }
    },
    [options?.adapter, options?.recordedResponse]
  );

  return {
    transcribe,
    state,
    netlist,
    note,
    error,
    abort,
  };
}
