# Hand fixes (outside Kiro) — logged for transparency

| After run | Fix | Why |
|---|---|---|
| 06 | Removed scaffold leftovers (`package.json.vite`, `tsconfig.json.vite`, `vite.config.ts.new`); gitignored `tsc -b` emit (`vite.config.js/.d.ts`, `*.tsbuildinfo`) | Kiro merged create-vite output into the existing repo and left temp copies |
| 06 | Rewrote `src/examples/{rl,rlc-ringing,bjt-common-emitter,opamp-inverting,diode-rectifier}.net` | Run ended before Kiro verified them: RL had a floating node, BJT input shorted the bias network, op-amp wiring wrong. All six now verified in ngspice |
| 06 | `scripts/verify-examples.mjs` now reuses one engine instance | Spawning a `Simulation` per file exhausted WASM memory (`realloc 1 GB`) |
| 06 | **Finding:** a non-ASCII char (`τ`) in a netlist title makes eecircuit-engine's `runSim()` hang forever (no error). Replaced with ASCII. The worker must sanitise to ASCII and enforce a timeout (fed to Kiro in the next run). | Real bug that would bite LLM-transcribed netlists with Chinese comments |
| 07/07b | Two `qwen3-coder-next` runs stalled (no events for >7 min after a file write + hooks); killed and re-ran with `claude-haiku-4.5` (run 07c). First 07 run died in a sandbox reset (kiro-cli + login wiped; reinstalled, re-authenticated with Google, and persisted under `/workspace/work/kiro-persist`). | Model experiment / infra |
| 08 | Run killed after ~25 min of grinding on trivial type errors (to save credits). Hand fixes: `App.tsx` narrowed `example.netlistText` (TS2345); `vite.config.ts` `worker.format: 'es'` + `build.target: 'es2022'` (IIFE worker can't code-split); `sim.worker.ts` static import → `import type` so the 20 MB engine is a lazy chunk. | Build blockers |
| 08 | Schematic drawings: `scripts/gen-schematics.py` (hand-written generator, not Kiro) → `public/samples/*.svg`, `public/classics/*.svg`. Netlists for the classics verified in ngspice by hand (`docs/classics-verified.md`). | Assets |
