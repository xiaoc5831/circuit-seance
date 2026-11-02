# Circuit Séance — Requirements

**Feature:** Circuit Séance MVP  
**Hackathon:** Kiroween 2026 — "Resurrection" category  
**Version:** 1.1  
**Date:** 2026-11-02

---

## Overview

Circuit Séance (电路招魂) is a fully client-side browser application that lets EE students photograph or upload a hand-drawn schematic, transcribe it to SPICE via a vision LLM, simulate it in-browser with ngspice/WebAssembly, display results on a haunted green-phosphor CRT oscilloscope, and receive an AI "spirit" explanation of the waveform. Bundled example circuits and a Demo Séance mode make the app fully usable — and judge-ready — with no API key.

---

## User Stories and Acceptance Criteria

### 1. Project Bootstrap & Shell

**1.1** As a developer, I need a Vite + React 18 + TypeScript strict-mode project with all tooling configured so the team has a working build baseline.

- WHEN a developer runs `npm run dev` THEN THE SYSTEM SHALL start a Vite dev server that serves the app without errors.
- WHEN a developer runs `npm run build` THEN THE SYSTEM SHALL produce a production-ready static bundle in `dist/` without TypeScript errors; `vite.config.ts` SHALL expose a `base` option configurable via the `VITE_BASE_URL` env variable so the same build can be deployed to a sub-path (GitHub Pages) or root (Vercel/Netlify).
- WHEN a developer runs `npm run lint` THEN THE SYSTEM SHALL check ESLint and Prettier rules and exit non-zero on violations.
- WHEN a developer runs `npm test` THEN THE SYSTEM SHALL run Vitest in single-run mode and report pass/fail.
- WHERE TypeScript `strict: true` is set, THE SYSTEM SHALL reject any `any` type without an explanatory comment.

**1.2** As a user, I need a bilingual (English / Simplified Chinese) UI so I can use the app in my preferred language.

- WHEN the user selects Simplified Chinese in the language toggle THEN THE SYSTEM SHALL display all UI labels, buttons, error messages, and help text in Simplified Chinese.
- WHEN the user selects English THEN THE SYSTEM SHALL display all text in English.
- IF no explicit language has been selected THEN THE SYSTEM SHALL default to English.
- WHEN THE SYSTEM renders any text element THEN it SHALL use the string from the active i18n locale file (`en.ts` or `zh-CN.ts`), not hardcoded literals.

---

### 2. Example Circuits

**2.1** As a user with no API key, I need bundled example circuits so I can experience the full simulation loop without configuring any LLM.

- WHEN the user opens the app for the first time THEN THE SYSTEM SHALL display a list of at least six bundled example circuits: RC low-pass filter, RL circuit, RLC ringing, diode rectifier, BJT common-emitter amplifier, and op-amp inverting amplifier.
- WHEN the user selects an example circuit THEN THE SYSTEM SHALL load its netlist into the netlist editor without requiring any API key or network call.
- WHEN an example circuit is loaded THEN THE SYSTEM SHALL automatically run the simulation for that circuit and display results on the oscilloscope.
- WHERE an example circuit is active and no API key is configured THEN THE SYSTEM SHALL display a rule-based offline explanation instead of calling the LLM spirit.

**2.2** As a developer, I need each example circuit stored as a plain-text `.net` file in `src/examples/` so they can be bundled by Vite and updated independently.

- WHEN the project is built THEN THE SYSTEM SHALL include all `.net` files from `src/examples/` in the bundle and make them importable as strings.

---

### 3. Netlist Editor & Validation

**3.1** As a user, I need a SPICE netlist editor with syntax highlighting so I can read and edit netlists with clear visual feedback.

- WHEN the netlist editor is rendered THEN THE SYSTEM SHALL provide syntax highlighting covering: component lines (R, C, L, V, I, D, Q, M, E, F, G, H, X), `.tran`, `.ac`, `.dc`, `.op` directives, `.model`, `.subckt`, and comments (`;` and `*`). For MVP a styled `<textarea>` with a line-number gutter and error-highlight overlay is acceptable; full CodeMirror 6 integration is a stretch goal.
- WHEN the user types in the netlist editor THEN THE SYSTEM SHALL apply syntax highlighting in real time.
- WHEN the editor contains a line flagged as erroneous by validation THEN THE SYSTEM SHALL highlight that line with a visual marker (gutter icon or underline) distinct from the phosphor-green syntax colour.
- WHEN the user presses Ctrl+Enter (or Cmd+Enter on macOS) THEN THE SYSTEM SHALL trigger simulation (equivalent to clicking "Simulate").

**3.2** As a user, I need the netlist validated before simulation so broken circuits produce clear error messages instead of cryptic WASM failures.

- WHEN the user requests simulation THEN THE SYSTEM SHALL first run a syntax validation pass (parse) over the netlist; IF it finds unrecognised lines or missing required directives THEN THE SYSTEM SHALL display the specific errors and SHALL NOT start the simulation.
- WHEN the syntax validation passes THEN THE SYSTEM SHALL run an element/node check (at least: no floating nodes, ground node 0 present, all referenced models defined).
- WHEN the element/node check passes THEN THE SYSTEM SHALL submit the netlist to the Web Worker for an ngspice dry run; IF ngspice returns an error THEN THE SYSTEM SHALL surface a human-readable "spirits are restless" message that includes the raw ngspice error in a collapsible `<details>` section.
- WHEN all three validation stages pass THEN THE SYSTEM SHALL proceed to full simulation.
- WHEN validation identifies a problem line THEN THE SYSTEM SHALL scroll the editor to that line and apply an error marker.

**3.3** As a user, I need to paste or type a netlist directly so I can use the app as a quick netlist runner without a schematic image.

- WHEN the user clears the editor and types a netlist manually THEN THE SYSTEM SHALL treat it identically to a loaded example or LLM-transcribed netlist for the purposes of validation and simulation.

---

### 4. Simulation Engine (Web Worker)

**4.1** As a user, I need in-browser ngspice simulation so I can get results without any server or internet connection.

- WHEN the simulation is initiated THEN THE SYSTEM SHALL run `eecircuit-engine` exclusively inside a Web Worker so THE UI thread is never blocked.
- WHEN the Web Worker starts for the first time THEN THE SYSTEM SHALL lazy-load the ~40 MB WASM package; once loaded, THE SYSTEM SHALL cache it so subsequent simulations do not re-fetch it.
- WHILE the WASM package is loading THEN THE SYSTEM SHALL display a "Summoning…" loading indicator on the oscilloscope screen.
- WHEN `sim.runSim()` resolves THEN THE SYSTEM SHALL transfer the `SimResult` back to the main thread via structured clone.

**4.2** As a user, I need the simulation to handle errors gracefully so I learn what to fix rather than seeing a blank screen.

- WHEN ngspice returns an error (e.g. singular matrix, timestep too small, missing ground) THEN THE SYSTEM SHALL catch it in the Worker, translate it to a `SimError` message, and post it to the main thread.
- WHEN the main thread receives a `SimError` THEN THE SYSTEM SHALL display a "The spirits are restless" panel with a friendly short message, the raw ngspice error in a `<details>` block, and optionally a spirit-suggested fix if the error pattern is recognisable (e.g. "Add a ground node 0 to anchor your circuit.").
- IF the spirit key is configured THEN THE SYSTEM SHALL offer to ask the spirit for a fix suggestion automatically.

**4.3** As a developer, I need a typed Worker message protocol so the main thread and worker communicate safely.

- WHEN the main thread posts a `SimulateRequest` message THEN THE SYSTEM SHALL include the fields: `type: 'simulate'`, `netlist: string`, `id: string`.
- WHEN the Worker posts a success response THEN THE SYSTEM SHALL use type `SimulateResponse` with fields: `type: 'result'`, `id: string`, `result: SimResult`.
- WHEN the Worker posts an error response THEN THE SYSTEM SHALL use type `SimulateError` with fields: `type: 'error'`, `id: string`, `message: string`, `raw: string`.
- WHEN the Worker posts a progress update THEN THE SYSTEM SHALL use type `SimulateProgress` with fields: `type: 'progress'`, `id: string`, `stage: 'loading' | 'running'`.

---

### 5. CRT Oscilloscope Display

**5.1** As a user, I need a green-phosphor CRT oscilloscope display so simulation results feel authentic and visually distinctive.

- WHEN a simulation result is available THEN THE SYSTEM SHALL render the output on an HTML Canvas 2D element styled to look like a P31 green-phosphor CRT oscilloscope.
- WHEN rendering traces THEN THE SYSTEM SHALL apply: phosphor glow/bloom effect, persistence/afterglow trails that decay over ~0.5 s, subtle scanline overlay, and a low-frequency brightness flicker effect.
- WHEN `prefers-reduced-motion` is active THEN THE SYSTEM SHALL disable the flicker and afterglow animations and render a static trace with glow only.
- WHEN rendering text labels (axis labels, voltage/time values) THEN THE SYSTEM SHALL maintain WCAG AA contrast ratio (≥ 4.5:1) against the dark CRT background.
- WHEN a simulation result with ≤ 10 000 data points is displayed THEN THE SYSTEM SHALL render at 60 fps on a mid-range laptop without dropped frames.
- WHEN the oscilloscope has no simulation result to display THEN THE SYSTEM SHALL show the message "No signal — summon a circuit" (bilingual) centred on the CRT screen with phosphor-green styling.
- WHEN a CRT power-on animation is triggered (on first load or after clearing the result) THEN THE SYSTEM SHALL play a smooth brightness-ramp + horizontal-line-expand animation (≤ 1 s); this animation SHALL be suppressed when `prefers-reduced-motion` is active.

**5.2** As a user, I need a graticule and channel controls so I can read waveform values accurately.

- WHEN the oscilloscope is rendered THEN THE SYSTEM SHALL draw a graticule of 10 × 8 divisions with tick marks and centre-line subdivisions.
- WHEN a transient simulation result is active THEN THE SYSTEM SHALL show time on the x-axis and allow the user to select up to 4 probe signals from the simulation output variables as channels.
- WHEN an AC simulation result is active THEN THE SYSTEM SHALL display Bode magnitude (dB) and phase (degrees) on a log-frequency x-axis.
- WHEN a DC sweep result is active THEN THE SYSTEM SHALL display the sweep variable on the x-axis and the output variable on the y-axis.
- WHEN an operating-point result is active THEN THE SYSTEM SHALL display a node-voltage readout panel (table of node names and DC voltages) instead of a waveform canvas.
- WHEN the oscilloscope is displayed THEN THE SYSTEM SHALL provide volts/div and time/div (or freq/div for AC) controls that rescale the trace in real time.
- WHEN the user changes the channel or div controls THEN THE SYSTEM SHALL update the display within one animation frame.
- WHEN the user focuses a knob control and presses an arrow key THEN THE SYSTEM SHALL increment or decrement the knob value by one step, with a visible phosphor-style focus ring on the control.

**5.3** As a user on a mobile phone, I want the oscilloscope to be usable in landscape orientation so I can capture circuits with the camera and still read the scope.

- WHEN the viewport width is < 768 px and orientation is landscape THEN THE SYSTEM SHALL render the scope canvas full-width and stack controls below.
- WHEN the viewport width is < 768 px THEN THE SYSTEM SHALL make all interactive controls (knobs, channel selectors) large enough to tap accurately (minimum 44 × 44 px touch target per WCAG 2.5.5).

**5.4** As a user waiting for simulation, I need clear loading and error states on the scope panel.

- WHEN simulation is in progress THEN THE SYSTEM SHALL display "Summoning…" with a CRT warm-up animation on the scope canvas.
- WHEN a simulation or validation error occurs THEN THE SYSTEM SHALL display a friendly "spirits are restless" error message with the raw detail in a collapsible `<details>` element; THE SYSTEM SHALL NOT leave the scope canvas blank without explanation.
- WHEN an `aria-live` region is present THEN THE SYSTEM SHALL post status updates ("Summoning…", "Simulation complete", error messages) to it so screen-reader users are informed without a focus change.

---

### 6. Image Capture & Upload

**6.1** As a student, I need to photograph my hand-drawn schematic with my phone camera so I can transcribe it without retyping.

- WHEN the user taps the "Capture" button on a mobile device THEN THE SYSTEM SHALL open the device camera via `<input type="file" accept="image/*" capture="environment">`.
- WHEN the user selects "Upload" THEN THE SYSTEM SHALL open a standard file picker accepting `image/jpeg`, `image/png`, `image/webp`, and `image/gif`.
- WHEN an image is selected or captured THEN THE SYSTEM SHALL display a preview of the image in the capture panel.
- WHEN an image exceeds 5 MB THEN THE SYSTEM SHALL resize/compress it client-side to ≤ 5 MB before sending to the LLM.
- IF the browser does not support the File API THEN THE SYSTEM SHALL display an unsupported-feature warning.

---

### 7. Vision LLM Transcription

**7.1** As a user, I need the app to convert my schematic photo to a SPICE netlist using a vision LLM so I don't have to write SPICE by hand.

- WHEN the user clicks "Transcribe" with an image loaded and an API key configured THEN THE SYSTEM SHALL call `LLMAdapter.transcribeSchematic(imageBase64, mimeType)` and display a loading indicator.
- WHEN the LLM returns a response THEN THE SYSTEM SHALL extract the netlist from within a fenced code block (` ```spice ` or ` ``` `), and SHALL also capture any confidence/caveat note the model appended.
- WHEN the extracted netlist is displayed THEN THE SYSTEM SHALL show it side-by-side with the original schematic photo (two-pane layout).
- WHEN the transcription completes THEN THE SYSTEM SHALL automatically run the three-stage validation on the returned netlist and display any errors in the editor.
- IF no fenced code block is found in the LLM response THEN THE SYSTEM SHALL display an error "The spirit could not read the circuit" and prompt the user to retry or enter the netlist manually.
- WHEN the LLM call fails (network error, auth error, rate limit) THEN THE SYSTEM SHALL display a specific error message indicating the failure type and SHALL NOT overwrite any existing netlist in the editor.

**7.2** As a user, I need to configure my LLM provider and API key so I control which service is used and my key stays private.

- WHEN the user opens the Settings panel THEN THE SYSTEM SHALL present provider presets: "Qwen-VL (DashScope)" (default), "OpenAI-compatible", and "Gemini (OpenAI-compatible)"; Anthropic Claude SHALL be listed as an optional/stretch provider.
- WHEN "Qwen-VL (DashScope)" is selected THEN THE SYSTEM SHALL pre-fill the base URL with `https://dashscope.aliyuncs.com/compatible-mode/v1` and the model with `qwen-vl-max`; both fields SHALL remain editable.
- WHEN "OpenAI-compatible" is selected THEN THE SYSTEM SHALL pre-fill the base URL with `https://api.openai.com/v1` and leave the model field blank (user-supplied).
- WHEN "Gemini (OpenAI-compatible)" is selected THEN THE SYSTEM SHALL pre-fill the base URL with `https://generativelanguage.googleapis.com/v1beta/openai` and model with `gemini-1.5-pro`.
- WHEN the user saves an API key THEN THE SYSTEM SHALL store it in `sessionStorage` by default; a "Remember across sessions" toggle SHALL move it to `localStorage`; THE SYSTEM SHALL NEVER transmit the key to any server except the user-chosen provider endpoint.
- WHEN an API key is stored THEN THE SYSTEM SHALL display it masked (e.g. `sk-…abc4`) in the settings UI.
- WHEN no API key is configured THEN THE SYSTEM SHALL disable the "Transcribe" and "Ask Spirit" buttons and display a prompt to configure a key.

**7.3** As a developer, I need a provider-agnostic LLM adapter interface so new providers can be added without modifying feature code.

- WHEN any feature calls the LLM THEN THE SYSTEM SHALL do so through the `LLMAdapter` interface (`transcribeSchematic` and `explainWaveform` methods only); it SHALL NOT import provider-specific code directly.
- WHEN the OpenAI-compatible adapter is active THEN THE SYSTEM SHALL construct a chat-completions request with a base64-encoded image in the `image_url` content part and the model name configurable by the user.
- WHEN the Anthropic adapter is active THEN THE SYSTEM SHALL use the Anthropic Messages API with the image in an `image` content block.
- WHEN either adapter receives an HTTP error response THEN THE SYSTEM SHALL throw a typed `LLMError` with `provider`, `statusCode`, and `message` fields.

---

### 8. AI Spirit — Waveform Explanation

**8.1** As a user, I need the AI spirit to explain my simulation results in plain language so I understand what the waveform shows.

- WHEN the user clicks "Ask the Spirit" after a successful simulation THEN THE SYSTEM SHALL call `LLMAdapter.explainWaveform(netlist, compactSummary)` where `compactSummary` contains the analysis type and numeric digest (see §8.2), NOT raw data arrays.
- WHEN the spirit response arrives THEN THE SYSTEM SHALL render it as formatted Markdown in the spirit panel, including the suggested "try next" experiment.
- WHEN the UI language is Simplified Chinese THEN THE SYSTEM SHALL instruct the LLM adapter to request a Simplified Chinese explanation.
- WHEN THE SYSTEM calls explainWaveform THEN it SHALL include in the prompt: netlist text, analysis type, and the compact numeric summary.

**8.2** As a developer, I need a result summariser that compresses `SimResult` to a compact numeric digest so LLM prompts stay small.

- WHEN a transient result is summarised THEN THE SYSTEM SHALL compute and include: min, max, and final value per channel; estimated time constant (τ from 63.2% rise); rise time (10%–90%); percentage overshoot if present.
- WHEN an AC result is summarised THEN THE SYSTEM SHALL include: –3 dB frequency, DC gain (dB), peak gain (dB) and frequency if present.
- WHEN a DC sweep result is summarised THEN THE SYSTEM SHALL include: min/max output, slope at mid-point.
- WHEN an operating-point result is summarised THEN THE SYSTEM SHALL include: all node voltages as key-value pairs.
- WHEN the summary is computed THEN THE SYSTEM SHALL cap it at 500 tokens (approximately 2 000 characters) by truncating the least significant digits.

**8.3** As a user with no API key, I need an offline spirit explanation for the bundled examples so the "Resurrection" narrative is complete even without an LLM.

- WHEN an example circuit is active AND no API key is set AND the user clicks "Ask the Spirit" THEN THE SYSTEM SHALL display a pre-written, rule-based explanation for that example, formatted identically to a live LLM explanation.
- WHERE a rule-based explanation is shown THEN THE SYSTEM SHALL display a small "offline mode" badge so the user knows it is pre-written.

---

### 9. Application Shell & Settings

**9.1** As a user, I need a coherent single-page layout so all features are accessible without confusing navigation.

- WHEN the app loads THEN THE SYSTEM SHALL display: a top toolbar (app title, language toggle, settings icon); a main area split into a left panel (capture/netlist) and a right panel (oscilloscope + spirit); and a status bar.
- WHEN the viewport is < 1024 px wide THEN THE SYSTEM SHALL collapse the split layout into a single-column stacked layout with the capture/netlist panel above the scope panel.
- WHEN the app is loaded on a mobile browser THEN THE SYSTEM SHALL be usable for the full core loop (capture → simulate → scope) within a single scroll.

**9.2** As a developer, I need the app to be deployable as a static site so there is no hosting infrastructure to manage.

- WHEN `npm run build` is run THEN THE SYSTEM SHALL produce a `dist/` directory containing only static files (HTML, JS, CSS, WASM, assets) with no server-side code.
- WHEN the static files are served from any CDN or static host (GitHub Pages, Vercel, Netlify) THEN THE SYSTEM SHALL function without any back-end.
- WHEN no API key is configured THEN THE SYSTEM SHALL still be fully usable via Demo Séance mode and example circuits (zero-setup judge mode).

---

### 10. Accessibility & Performance

**10.1** As a user with accessibility needs, I need the app to respect motion preferences, support keyboard operation, and maintain readable contrast.

- WHEN `prefers-reduced-motion: reduce` is set THEN THE SYSTEM SHALL suppress all CSS animations, canvas flicker, and phosphor persistence animation.
- WHERE any text is rendered over a background THEN THE SYSTEM SHALL maintain ≥ 4.5:1 contrast ratio (WCAG AA).
- WHEN the user interacts with the app using a keyboard only THEN THE SYSTEM SHALL support focus traversal of all primary controls (tab order, visible phosphor-style focus ring on each focused element).
- WHEN any button or icon-only control exists THEN THE SYSTEM SHALL provide an accessible label (`aria-label` or visible label text).
- WHEN the user focuses a scope knob and presses an arrow key THEN THE SYSTEM SHALL adjust the knob value by one step (as described in §5.2).
- WHEN any asynchronous operation starts or completes THEN THE SYSTEM SHALL update an `aria-live` region with the status so screen readers announce it.

**10.2** As a user, I need fast initial load and smooth runtime performance.

- WHEN the app is first loaded THEN THE SYSTEM SHALL display a usable shell (title, example list, empty scope) within 3 seconds on a broadband connection before WASM is fetched.
- WHEN the WASM engine is not yet loaded THEN THE SYSTEM SHALL show a progress/loading state; it SHALL NOT block rendering of the rest of the UI.
- WHEN rendering a simulation result of ≤ 10 000 points THEN THE SYSTEM SHALL sustain 60 fps on the scope canvas.

---

### 11. Testing

**11.1** As a developer, I need unit tests for the netlist parser and validator so regressions are caught automatically.

- WHEN unit tests are run THEN THE SYSTEM SHALL verify that the netlist parser correctly identifies component types, node names, and directive parameters for at least 20 representative netlist lines.
- WHEN unit tests are run THEN THE SYSTEM SHALL verify that the validator correctly accepts valid netlists and rejects netlists with: missing ground, floating nodes, unrecognised directives, and malformed component lines.
- WHEN property tests (fast-check) are run THEN THE SYSTEM SHALL verify the parser round-trip property: `serialise(parse(netlist)) === normalise(netlist)` for arbitrary well-formed netlists.

**11.2** As a developer, I need a unit test for the result summariser so its numeric outputs are correct.

- WHEN unit tests are run THEN THE SYSTEM SHALL verify that summarising a known transient result produces the correct τ, rise time, overshoot, min, max, and final values within ±1% tolerance.
- WHEN unit tests are run THEN THE SYSTEM SHALL verify that summarising a known AC result produces the correct –3 dB frequency within ±0.5 dB tolerance.

**11.3** As a developer, I need a unit test for LLM response parsing so malformed model outputs are handled gracefully.

- WHEN unit tests are run THEN THE SYSTEM SHALL verify that a response containing a fenced code block yields the correct netlist string.
- WHEN unit tests are run THEN THE SYSTEM SHALL verify that a response with no fenced block returns a typed parse error rather than throwing.

**11.4** As a developer, I need one end-to-end smoke test so the critical happy path is validated in a real browser.

- WHEN the Playwright smoke test runs THEN THE SYSTEM SHALL: load the app, select the RC low-pass example, wait for the simulation to complete, and assert that a canvas element with a non-blank trace is visible on screen.

---

### 12. Demo Séance Mode (no key needed)

**12.1** As a judge or first-time visitor with no API key, I need a one-click demo that runs the full photo→netlist→simulate→explain loop so I can evaluate the app immediately.

- WHEN no API key is configured THEN THE SYSTEM SHALL offer a "Demo Séance" entry point (button or auto-start) that runs through the full loop using sample assets.
- WHEN Demo Séance is triggered THEN THE SYSTEM SHALL simulate a "transcribing…" delay (1–2 s, using a canned netlist), run the real simulation engine, and display a canned bilingual spirit explanation; all demo steps SHALL be clearly badged "DEMO".
- WHEN the app loads for the first time (no previous session data) THEN THE SYSTEM SHALL play a first-run "séance" intro: a CRT power-on animation that boots the oscilloscope and auto-loads the RC low-pass sample, so a live waveform is visible within 10 seconds of page load.
- WHEN the intro plays THEN THE SYSTEM SHALL be skippable via a "Skip" button at any point.
- WHEN `prefers-reduced-motion` is active THEN THE SYSTEM SHALL skip all intro animations and go directly to the static waveform.
- WHEN the intro is complete THEN THE SYSTEM SHALL not repeat on subsequent page loads (persist a `seance-intro-seen` flag in `localStorage`).

**12.2** As a developer, I need four sample schematic images paired with precomputed assets so the demo loop requires no network calls.

- WHEN the project is built THEN THE SYSTEM SHALL include in `public/samples/` at least four hand-drawn-style SVG schematic images: `rc-lowpass.svg`, `rlc-ringing.svg`, `diode-rectifier.svg`, `opamp-inverting.svg`.
- WHEN the project is built THEN THE SYSTEM SHALL include for each sample a precomputed netlist (`.net`) and a canned spirit explanation (`.md`, bilingual EN/中文) bundled with the app.
- WHEN a sample is active in demo mode THEN THE SYSTEM SHALL use its precomputed netlist directly (no LLM call) and display its canned explanation after simulation.

---

### 13. Circuit Séance SPICE MCP Server

**13.1** As a developer using Kiro, I need a local MCP server that can simulate netlists and explain waveforms so Kiro can verify every bundled example during development.

- WHEN the MCP server is running THEN THE SYSTEM SHALL expose a `simulate_netlist` tool that accepts a SPICE netlist string and returns: analysis type detected, variable names, a compact numeric summary, and any ngspice error strings.
- WHEN the MCP server is running THEN THE SYSTEM SHALL expose an `explain_waveform` tool that accepts a netlist and a compact summary and returns a rule-based plain-language explanation in both English and Simplified Chinese.
- WHEN the MCP server is registered in `.kiro/settings/mcp.json` THEN Kiro SHALL be able to call `simulate_netlist` and `explain_waveform` directly from the IDE during development.
- WHEN `explain_waveform` is called THEN THE SYSTEM SHALL use the same summariser logic as `src/features/simulate/result-summariser.ts` (shared or copied) so explanations are consistent with the browser app.

**13.2** As a developer, I need the MCP server implemented as a local stdio Node ESM package so it requires no additional server infrastructure.

- WHEN the MCP server is started (e.g. via `node tools/spice-mcp/index.mjs`) THEN THE SYSTEM SHALL communicate over stdio using the Model Context Protocol (`@modelcontextprotocol/sdk`).
- WHEN the MCP server processes a `simulate_netlist` call THEN THE SYSTEM SHALL run `eecircuit-engine` (Node-compatible build or via a child process) and return results within 30 seconds.
- WHEN the MCP server is used to validate a bundled example THEN THE SYSTEM SHALL confirm the simulation completes without error and the compact summary matches its paired canned explanation within reasonable tolerance.
- WHEN the MCP server is documented THEN THE SYSTEM SHALL include a usage section in `docs/spice-mcp.md` explaining how to register it in `.kiro/settings/mcp.json` and how Kiro uses it during development.

---

### 14. Haunted Classics Gallery

**14.1** As a user, I need a gallery of historically significant circuits presented as aged scanned drawings so I can explore classic circuit designs with the full séance experience.

- WHEN the user opens the Haunted Classics gallery THEN THE SYSTEM SHALL display at least four classic circuits: 555 astable (behavioural/transistor-level ngspice-compatible model), passive RC filter, Wien-bridge oscillator, and an inverting/integrator op-amp circuit in the style of a 1970s application note.
- WHEN a Haunted Classic is selected THEN THE SYSTEM SHALL display its schematic as an aged-paper-style SVG (sepia tint, slight geometric skew, typewriter-style labels, coffee-stain texture overlay).
- WHEN a Haunted Classic is selected THEN THE SYSTEM SHALL display a short bilingual historical blurb (EN/中文, ≤ 80 words each) about the circuit's origin or significance.
- WHEN a Haunted Classic is selected THEN THE SYSTEM SHALL run its bundled netlist through the real simulation engine and display the result on the CRT scope.

**14.2** As a developer, I need each Haunted Classic to include a recorded "vision transcription" response that exercises the real LLM response parser in judge mode.

- WHEN a Haunted Classic is loaded in demo/judge mode THEN THE SYSTEM SHALL replay its stored LLM-style markdown response (fenced ` ```spice ` block + confidence note) through `parseNetlistFromResponse()`, producing the netlist as if a real LLM had responded.
- WHEN the recorded response is parsed THEN THE SYSTEM SHALL show the same confidence note and "DEMO" badge as a real transcription session, so the judge sees the complete pipeline exercised.
- WHERE the recorded response is stored THEN THE SYSTEM SHALL keep it as a raw `.md` file in `src/examples/haunted/` (one file per circuit) with the full LLM-style markdown text.

**14.3** As a developer, I need ngspice-compatible SPICE models for every Haunted Classic netlist so all circuits actually simulate.

- WHEN the 555 astable netlist is simulated THEN THE SYSTEM SHALL use a behavioural switch/comparator model (or transistor-level discrete model) that is ngspice-compatible and bundled in `src/examples/haunted/`.
- WHEN the Wien-bridge oscillator netlist is simulated THEN THE SYSTEM SHALL use an ideal/behavioural op-amp subcircuit that is ngspice-compatible.
- WHEN any Haunted Classic netlist is simulated in CI (via the SPICE MCP server) THEN THE SYSTEM SHALL produce a non-error result and a valid compact summary.

---

### 15. Educational Homework Check

**15.1** As a student, I need to enter expected values (time constant, −3 dB frequency) and have the spirit compare them to the simulation so I can check my hand calculations.

- WHEN the spirit panel is visible after a simulation THEN THE SYSTEM SHALL display a "Homework check" section where the student can enter one or more expected values (e.g. expected τ, expected −3 dB frequency, expected DC gain).
- WHEN the student submits expected values THEN THE SYSTEM SHALL compare them to the corresponding values in the compact summary using offline rule-based logic and display a pass/fail result with a percentage error.
- WHEN the comparison result is displayed THEN THE SYSTEM SHALL provide a bilingual (EN/中文) explanation of whether the expected value is correct, close, or significantly off, and suggest what to check if it is wrong.
- IF an LLM key is configured THEN THE SYSTEM SHALL optionally offer to ask the LLM spirit for a deeper explanation of any discrepancy.
- WHEN the homework check section is rendered THEN it SHALL be fully keyboard operable and have appropriate `aria-label` attributes on all inputs.
