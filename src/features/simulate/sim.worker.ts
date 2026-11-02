/**
 * Web Worker for SPICE simulation
 * Singleton Simulation instance with lazy WASM import
 */

import type { Simulation } from 'eecircuit-engine';

let sim: Simulation | null = null;

/**
 * Sanitize netlist: replace common symbols and strip non-ASCII
 */
function sanitizeNetlist(netlist: string): { sanitized: string; warnings: string[] } {
  const warnings: string[] = [];
  let sanitized = netlist;

  // Replace common symbols
  const replacements: [RegExp, string][] = [
    [/µ/g, 'u'], // micro → u
    [/Ω/g, ''], // ohm → nothing
    [/τ/g, 'tau'], // tau → tau
    [/×/g, '*'], // × → *
    [/−/g, '-'], // minus → -
  ];

  for (const [regex, replacement] of replacements) {
    if (regex.test(sanitized)) {
      sanitized = sanitized.replace(regex, replacement);
      warnings.push(`Replaced character: ${regex.source}`);
    }
  }

  // Strip remaining non-ASCII
  const nonAsciiMatches = [...sanitized.matchAll(/[^\x00-\x7F]/g)];
  if (nonAsciiMatches.length > 0) {
    sanitized = sanitized.replace(/[^\x00-\x7F]/g, '');
    warnings.push(`Stripped ${nonAsciiMatches.length} non-ASCII characters`);
  }

  return { sanitized, warnings };
}

/**
 * Lazy-load eecircuit-engine and create Simulation instance
 */
async function initSimulation(): Promise<Simulation> {
  if (sim) {
    return sim;
  }

  // Lazy import (handled by Vite's dynamic import)
  const { Simulation: SimClass } = await import('eecircuit-engine');
  sim = new SimClass();

  // Start the simulation engine
  await sim.start();

  return sim;
}

/**
 * Handle a simulation request
 */
async function handleSimulate(request: {
  id: string;
  netlist: string;
  timeoutMs?: number;
}): Promise<{
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
  message?: string;
}> {
  const { id, netlist, timeoutMs = 20000 } = request;

  try {
    // Sanitize netlist
    const { sanitized, warnings } = sanitizeNetlist(netlist);
    if (warnings.length > 0) {
      console.warn(`Netlist sanitization warnings:`, warnings);
    }

    // Initialize simulation
    postMessage({
      type: 'progress',
      id,
      state: 'loading',
      message: 'Loading WASM...',
    });

    const simInstance = await initSimulation();

    // Set the netlist
    simInstance.setNetList(sanitized);

    // Check for parse errors
    const parseErrors = simInstance.getError();
    const parseInfo = simInstance.getInfo();

    if (parseErrors.length > 0 || !simInstance.isInitialized()) {
      return {
        id,
        success: false,
        errors: parseErrors,
        info: parseInfo,
        message: 'Parse error',
      };
    }

    // Run simulation with timeout
    postMessage({
      type: 'progress',
      id,
      state: 'running',
      message: 'Running simulation...',
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let terminated = false;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        terminated = true;
        reject(new Error('Simulation timeout'));
      }, timeoutMs);
    });

    const simPromise = (async () => {
      try {
        const result = await simInstance.runSim();
        return { success: true, result };
      } catch (err) {
        return { success: false, error: err };
      }
    })();

    let simResult: { success: boolean; result?: unknown; error?: unknown };

    try {
      simResult = await Promise.race([simPromise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }

    if (terminated) {
      // Restart the worker by recreating the simulation
      sim = null;

      return {
        id,
        success: false,
        message: 'The spirits went silent (timeout)',
        errors: [`Simulation timed out after ${Math.round(timeoutMs / 1000)}s`],
      };
    }

    if (!simResult.success) {
      const errors = simInstance.getError();
      const info = simInstance.getInfo();

      return {
        id,
        success: false,
        errors,
        info,
        message: 'Simulation error',
      };
    }

    const result = simResult.result as {
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

    return {
      id,
      success: true,
      result: {
        header: result.header,
        numVariables: result.numVariables,
        variableNames: result.variableNames,
        numPoints: result.numPoints,
        dataType: result.dataType,
        data: result.data,
      },
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      id,
      success: false,
      message: error.message || 'Unknown error',
      errors: [error.message || 'Unknown error'],
    };
  }
}

// Message handler
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;

  if (message.type === 'simulate') {
    const response = await handleSimulate(message);
    postMessage({
      type: 'response',
      ...response,
    });
  }
};

self.onerror = (err) => {
  console.error('Worker error:', err);
};
