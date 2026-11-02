# Hand fixes (outside Kiro) — logged for transparency

| After run | Fix | Why |
|---|---|---|
| 06 | Removed scaffold leftovers (`package.json.vite`, `tsconfig.json.vite`, `vite.config.ts.new`); gitignored `tsc -b` emit (`vite.config.js/.d.ts`, `*.tsbuildinfo`) | Kiro merged create-vite output into the existing repo and left temp copies |
| 06 | Rewrote `src/examples/{rl,rlc-ringing,bjt-common-emitter,opamp-inverting,diode-rectifier}.net` | Run ended before Kiro verified them: RL had a floating node, BJT input shorted the bias network, op-amp wiring wrong. All six now verified in ngspice |
| 06 | `scripts/verify-examples.mjs` now reuses one engine instance | Spawning a `Simulation` per file exhausted WASM memory (`realloc 1 GB`) |
| 06 | **Finding:** a non-ASCII char (`τ`) in a netlist title makes eecircuit-engine's `runSim()` hang forever (no error). Replaced with ASCII. The worker must sanitise to ASCII and enforce a timeout (fed to Kiro in the next run). | Real bug that would bite LLM-transcribed netlists with Chinese comments |
