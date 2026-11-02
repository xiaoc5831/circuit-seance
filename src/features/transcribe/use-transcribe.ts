/**
 * React hook for circuit image transcription.
 * State machine: idle → loading → done/error
 * Supports: live LLM call OR demo mode (recordedResponse) with ~1.6s delay.
 *
 * Kiro run 09 wrote the original; hand-extended in polish round 3 so App.tsx can use it
 * for the upload-your-own-photo flow:
 *  - `getAdapter` builds the adapter at call time (the API key is read from storage
 *    only when a request is made, never held in React state);
 *  - `transcribe()` resolves with the outcome (raw model text + parsed netlist, or the
 *    error and its cause) so the caller can show the raw response beside the drawing;
 *  - a new call aborts the previous one (latest wins), and stale results resolve `null`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LLMAdapter } from '@/lib/llm';
import { parseNetlistFromResponse } from './llm-response-parser';

export type TranscribeState = 'idle' | 'loading' | 'done' | 'error';

export interface UseTranscribeOptions {
  adapter?: LLMAdapter | null;
  /** preferred: build the adapter when the request is made */
  getAdapter?: () => LLMAdapter | null;
  recordedResponse?: string; // demo/judge mode
}

export type TranscribeOutcome =
  | { ok: true; raw: string; netlist: string; note: string | null }
  | { ok: false; raw: string; error: string; kind: 'no-adapter' | 'no-netlist' | 'request'; cause?: unknown };

export interface UseTranscribeResult {
  /** resolves with the outcome, or null when superseded/aborted */
  transcribe: (imageDataUrl: string) => Promise<TranscribeOutcome | null>;
  state: TranscribeState;
  raw: string | null;
  netlist: string | null;
  note: string | null;
  error: string | null;
  abort: () => void;
}

export function useTranscribe(options?: UseTranscribeOptions): UseTranscribeResult {
  const [state, setState] = useState<TranscribeState>('idle');
  const [raw, setRaw] = useState<string | null>(null);
  const [netlist, setNetlist] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const demoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const callRef = useRef(0);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
      if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    };
  }, []);

  const abort = useCallback(() => {
    callRef.current++;
    abortControllerRef.current?.abort();
    if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    if (isMountedRef.current) {
      setState('idle');
      setError(null);
    }
  }, []);

  const transcribe = useCallback(async (imageDataUrl: string): Promise<TranscribeOutcome | null> => {
    const call = ++callRef.current;
    abortControllerRef.current?.abort();
    if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    setRaw(null);
    setNetlist(null);
    setNote(null);
    setError(null);
    if (!isMountedRef.current) return null;

    const finish = (o: TranscribeOutcome): TranscribeOutcome | null => {
      if (call !== callRef.current || !isMountedRef.current) return null;
      setRaw(o.raw);
      if (o.ok) {
        setNetlist(o.netlist);
        setNote(o.note);
        setState('done');
      } else {
        setError(o.error);
        setState('error');
      }
      return o;
    };
    const fromText = (text: string): TranscribeOutcome => {
      const result = parseNetlistFromResponse(text);
      return 'error' in result
        ? { ok: false, raw: text, error: `Transcription failed: ${result.error}`, kind: 'no-netlist' }
        : { ok: true, raw: text, netlist: result.netlist, note: result.note || null };
    };

    const opts = optsRef.current;
    // Demo mode: simulated transcription with delay
    if (opts?.recordedResponse) {
      const text = opts.recordedResponse;
      setState('loading');
      await new Promise<void>((r) => {
        demoTimeoutRef.current = setTimeout(r, 1600);
      });
      return finish(fromText(text));
    }

    const adapter = opts?.getAdapter ? opts.getAdapter() : opts?.adapter;
    if (!adapter) return finish({ ok: false, raw: '', error: 'No LLM adapter configured', kind: 'no-adapter' });

    setState('loading');
    const ac = new AbortController();
    abortControllerRef.current = ac;
    try {
      const response = await adapter.transcribeSchematic(imageDataUrl, ac.signal);
      return finish(fromText(response));
    } catch (err) {
      if (ac.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
        if (call === callRef.current && isMountedRef.current) setState('idle');
        return null;
      }
      const message = err instanceof Error ? err.message : 'Unknown transcription error';
      return finish({ ok: false, raw: '', error: message, kind: 'request', cause: err });
    } finally {
      if (abortControllerRef.current === ac) abortControllerRef.current = null;
    }
  }, []);

  return { transcribe, state, raw, netlist, note, error, abort };
}
