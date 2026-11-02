Create the Kiro foundation steering files for this new (empty) repository in `.kiro/steering/`: `product.md`, `tech.md`, and `structure.md`. Use `inclusion: always` front matter on all three. Do not create any application code yet. Do not run git commands.

Project: **Circuit Séance** (Chinese name: 电路招魂), built for the Kiroween 2026 hackathon, "Resurrection" category. Author: Cao Xiaoqing, an Electrical Engineering master's student.

Product (for product.md):
- Audience: EE students learning circuit analysis who lack access to lab gear or expensive simulation tools (LTspice on old laptops, paid licenses, no oscilloscope at home).
- Core loop: the student photographs or uploads a hand-drawn circuit schematic -> a vision-capable LLM transcribes it into a SPICE netlist -> the student reviews/edits the netlist in an editor -> ngspice compiled to WebAssembly runs the simulation entirely in the browser (no server-side simulation) -> results render on a haunted green-phosphor CRT oscilloscope UI (phosphor glow, persistence trails, subtle flicker, scanlines) -> an AI "spirit" (the ghost of the oscilloscope) explains the waveform in plain language: time constants, steady state, why the curve looks the way it does, and what to try next.
- The "resurrection" theme: bringing Berkeley SPICE (1973) and the analog CRT scope back to life in a modern browser.
- Also supports: built-in example circuits (RC low-pass, RL, RLC ringing, diode rectifier, BJT common-emitter, op-amp inverting amp) so the app works without an API key; manual netlist entry; transient (.tran), AC (.ac), DC sweep (.dc), and operating point (.op) analyses.
- Bilingual UI copy: English first, Simplified Chinese supported.
- Privacy: user images and API keys are never stored server-side; bring-your-own LLM API key kept in browser storage only.
- Non-goals for the hackathon: PCB layout, schematic capture editor, user accounts, a hosted backend database.
- Judging criteria to keep in mind: potential impact, technical implementation (depth of Kiro use), design, innovation, presentation.

Tech (for tech.md):
- Vite + React 18 + TypeScript (strict mode). Package manager: npm.
- Simulation: `eecircuit-engine` npm package (MIT, ngspice 45.2 compiled to WASM, verified working in Node 22: an RC transient matched the analytic 5(1-e^(-t/RC)) curve). Run it inside a Web Worker so the UI never blocks. API: `new Simulation()`, `await sim.start()`, `sim.setNetList(text)`, `await sim.runSim()` returning `{header, numVariables, variableNames, numPoints, dataType: 'real'|'complex', data:[{name,type,values}]}`.
- Rendering the scope: HTML Canvas 2D (or WebGL if needed) with phosphor persistence; no heavy chart libraries for the scope trace.
- Netlist editor: CodeMirror 6 with a small SPICE syntax mode.
- Vision + explanation LLM: provider-agnostic adapter interface; first adapters OpenAI-compatible chat completions with image input (e.g. GPT-4o-class) and Anthropic Claude Messages API with image input. Calls made from the browser with the user's own key, or optionally through a tiny serverless proxy. LLM output for netlists must be validated (parse + ngspice dry run) before simulation.
- Testing: Vitest for unit tests (netlist parsing/validation, result transforms), Playwright for one end-to-end smoke test. Fast-check property tests welcome for the netlist parser.
- Lint/format: ESLint + Prettier.
- Deployment: static site (GitHub Pages / Vercel / Netlify). License: MIT.
- Common commands: `npm run dev`, `npm run build`, `npm test`, `npm run lint`.

Structure (for structure.md): propose a clear folder layout, e.g. `src/app` (shell, routing, i18n), `src/features/capture` (camera/upload), `src/features/transcribe` (vision LLM -> netlist), `src/features/netlist` (editor, parser, validator), `src/features/simulate` (worker + eecircuit-engine wrapper), `src/features/scope` (CRT oscilloscope renderer), `src/features/spirit` (AI explanation), `src/lib/llm` (provider adapters), `src/examples` (bundled example netlists), `public/`, `tests/`, `docs/`, `.kiro/`. Include naming conventions (kebab-case files, PascalCase components), import rules (features may import from lib, not from each other except through public index files), and where tests live.

Keep each file concise and practical (roughly 40-90 lines each).
