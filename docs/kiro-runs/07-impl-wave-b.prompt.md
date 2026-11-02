Implement spec `circuit-seance` tasks **5 (MVP textarea editor path, not CodeMirror), 6, 7, 8** plus their unit tests **22.1, 22.3, 23**. Headless: no questions, no git, no dev server. Mark finished sub-tasks `[x]` in `.kiro/specs/circuit-seance/tasks.md`. Do not touch App.tsx wiring yet beyond what's needed to compile (wiring is task 18).

Hard facts you must design around (found by experiment, see docs/kiro-runs/hand-fixes.md):
1. `eecircuit-engine@1.9.0` API: `new Simulation(); await sim.start(); sim.setNetList(txt); const r = await sim.runSim();` plus `sim.getError(): string[]`, `sim.getInfo(): string`, `sim.isInitialized()`. `r.dataType` is `'real'` (values `number[]`) or `'complex'` (values `{real,img}[]`). Parse failures do NOT throw: you get `numPoints` ≤ 1 / empty data and messages in `getError()` / `getInfo()` (e.g. "Error on line 12", "circuit not parsed", "singular matrix", "timestep too small"). Treat those as `SimulateError` with the raw text.
2. **Any non-ASCII character in the netlist (e.g. `τ`, Chinese comments) makes `runSim()` hang forever.** The worker must sanitise input: replace common symbols (µ→u, Ω→ drop, τ→tau, ×→*, full-width chars → ASCII) and strip remaining non-ASCII, and report a warning. The validator should flag non-ASCII as a warning with line number.
3. `runSim()` can hang: `use-simulation.ts` must enforce a timeout (default 20 s) — on timeout terminate the worker, recreate it lazily, and surface a friendly "the spirits went silent" error.
4. Only ONE `Simulation` instance per worker (multiple instances exhaust WASM memory). Lazy `import('eecircuit-engine')` inside the worker on first request. Worker via `new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' })`.
5. Analysis type: detect from directives (`.tran/.ac/.dc/.op`). For `.op`, eecircuit returns one point; summarise as node voltages.

Summariser τ estimate must work on the RC example (`src/examples/rc-lowpass.net`, τ = 1 ms): make test fixtures by generating synthetic arrays (5·(1−e^(−t/τ))) rather than JSON dumps; add a damped-sine fixture for overshoot and a synthetic first-order AC magnitude for −3 dB.

Keep functions pure and typed (strict TS, no `any`). Tests go under `tests/unit/...` per steering. Finish with `npx vitest run` and `npm run build` passing; reply with a short summary.
