# Circuit Séance — Implementation Tasks

**Feature:** Circuit Séance MVP  
**Version:** 1.1  
**Date:** 2026-11-02

---

## MVP Core Path

The following tasks form the minimum viable demo (judge sees a live waveform in ≤ 10 s with no API key):

> **Scaffold** (1) → **i18n** (2) → **Examples** (3) → **Shell** (4) → **Parser/Validator** (5–6) → **Worker + Sim** (7–8) → **Scope** (9–10) → **Controls** (11) → **Capture** (12) → **OpenAI-compat adapter** (13) → **Response parser** (14) → **Transcribe panel** (15) → **Offline spirit** (16) → **Spirit panel** (17) → **Wiring** (18) → **Unit tests** (22–24) → **Demo mode** (28) → **Build verify** (27)

CodeMirror 6 (`spice-mode.ts`, full CM6 editor) and the Anthropic adapter are **stretch goals** — implement them after the core path is green.

Tasks are ordered so the app is demoable as early as possible. Sub-tasks within each group are sequenced by dependency.

---

## Phase 1 — Project Scaffold

- [x] 1. Initialise the Vite + React 18 + TypeScript project with all tooling
  _Requirements: 1.1_
  - [x] 1.1 Run `npm create vite@latest circuit-seance -- --template react-ts` and commit the baseline; verify `npm run dev` starts cleanly.
  - [x] 1.2 Configure TypeScript `strict: true` in `tsconfig.json`; add `@/` path alias in `tsconfig.json` and `vite.config.ts`; expose `VITE_BASE_URL` env variable as the Vite `base` option.
  - [x] 1.3 Install and configure ESLint with `@typescript-eslint/recommended` and `eslint-plugin-react-hooks`; add `eslint.config.js`.
  - [x] 1.4 Install and configure Prettier; add `prettier.config.js` and `.prettierignore`; wire `npm run lint` to run both ESLint and Prettier check.
  - [x] 1.5 Install Vitest and configure `npm test` (single-run mode); add a trivial passing test to confirm the runner works.
  - [x] 1.6 Create the full `src/` folder skeleton: `app/`, `features/{capture,transcribe,netlist,simulate,scope,spirit,demo,haunted}/`, `lib/llm/`, `examples/`, `shared/`; add an `index.ts` stub barrel in each feature folder.
  - [x] 1.7 Create `src/shared/types.ts` with the core interfaces: `SimResult`, `AnalysisType`, `CompactSummary`, `AppSettings`, `LLMConfig`, `LLMError`, `SampleAsset`, `DemoStep`, `HomeworkCheckResult`.
  - [x] 1.8 Create `src/shared/utils.ts` with at minimum a `generateId()` (nanoid-style) helper.

- [x] 2. Set up i18n string system
  _Requirements: 1.2_
  - [x] 2.1 Create `src/app/i18n/en.ts` with all English UI strings as a typed `Record<string, string>` export; cover: nav labels, button labels, error messages, loading states, settings labels, scope labels, spirit labels, demo badge text, homework check labels.
  - [x] 2.2 Create `src/app/i18n/zh-CN.ts` mirroring every key from `en.ts` with Simplified Chinese values.
  - [x] 2.3 Create `src/app/i18n/index.ts` exporting a `useTranslation()` hook that reads `AppSettings.language` from a React context and returns the active locale map.
  - [x] 2.4 Create a `LanguageContext` (in `src/app/`) that provides the language state and a toggle function; wrap `App.tsx` in it.

---

## Phase 2 — Bundled Examples & Shell Layout

- [x] 3. Add bundled example netlists
  _Requirements: 2.1, 2.2_
  - [x] 3.1 Write `src/examples/rc-lowpass.net` — RC low-pass filter with `.tran` directive.
  - [x] 3.2 Write `src/examples/rl.net` — RL circuit with `.tran` directive.
  - [x] 3.3 Write `src/examples/rlc-ringing.net` — RLC series with under-damped ringing, `.tran` directive.
  - [x] 3.4 Write `src/examples/diode-rectifier.net` — half-wave diode rectifier, `.tran` directive.
  - [x] 3.5 Write `src/examples/bjt-common-emitter.net` — BJT common-emitter amplifier, `.tran` directive.
  - [x] 3.6 Write `src/examples/opamp-inverting.net` — op-amp inverting amplifier, `.ac` directive.
  - [x] 3.7 Create `src/examples/index.ts` exporting an `EXAMPLE_CIRCUITS` array of `{ id, label, labelZh, net: string }` where `net` is the bundled netlist imported as a string (`?raw` Vite import).

- [x] 4. Build the application shell layout
  _Requirements: 9.1, 9.2, 10.1_
  - [x] 4.1 Create `src/app/App.tsx` with the two-panel layout: left panel (capture + netlist) and right panel (scope + spirit); use CSS Grid or Flexbox.
  - [x] 4.2 Add the top toolbar with: app title ("Circuit Séance / 电路招魂"), language toggle button (EN / 中文), and settings icon button.
  - [x] 4.3 Add a status bar at the bottom showing current simulation status; wire it to an `aria-live="polite"` region so screen readers announce status changes.
  - [x] 4.4 Implement responsive breakpoint: `< 1024 px` collapses to single-column stacked layout.
  - [x] 4.5 Add CSS custom properties for the CRT colour palette: background `#0a0f0a`, phosphor greens, graticule grey; import a monospace web font (e.g. `Share Tech Mono`) for the scope labels.
  - [x] 4.6 Create a `SettingsPanel` component (modal or drawer) with: provider preset selector (Qwen-VL default, OpenAI-compatible, Gemini, Anthropic stretch), API key field (masked), base URL field (editable, pre-filled by preset), model field (editable, pre-filled by preset), storage mode toggle ("Remember across sessions"), close button. _SettingsDialog.tsx; key kept only in localStorage by owner decision_
  - [x] 4.7 Wire settings state to `localStorage` / `sessionStorage` per `AppSettings.storageMode`; default storage is `sessionStorage`; never store the key in a React state tree that could be serialised to DevTools.

---

## Phase 3 — Netlist Editor

- [x] 5. Implement the SPICE netlist parser
  _Requirements: 3.1, 3.2, 3.3_
  - [x] 5.1 **MVP editor:** create `src/features/netlist/NetlistEditor.tsx` as a styled `<textarea>` with a line-number gutter (CSS counter overlay) and absolutely-positioned error-highlight markers; accept `value`, `onChange`, `errors` props. _(CodeMirror 6 is a stretch upgrade — see 5.1-stretch.)_
  - [x] 5.2 Create `src/features/netlist/netlist-parser.ts` implementing `parseNetlist(text: string): ParsedNetlist`; handle: title line, component lines (R/C/L/V/I/D/Q/M/E/F/G/H/X), directives (`.tran`, `.ac`, `.dc`, `.op`, `.model`, `.subckt`, `.ends`, `.end`), comments (`;` prefix and `*` first-char), continuation lines (`+`).
  - [x] 5.3 Add keyboard shortcut handling in `NetlistEditor.tsx`: intercept Ctrl+Enter / Cmd+Enter and call an `onSimulate` callback prop.
  - [ ] 5.4 **(Stretch) 5.1-stretch:** install CodeMirror 6 packages (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lint`; pin exact versions) and create `spice-mode.ts`; swap `NetlistEditor.tsx` to use CM6 behind a `USE_CODEMIRROR` feature flag.
  - [x] 5.5 Update `src/features/netlist/index.ts` barrel to export `NetlistEditor`, `parseNetlist`, and types.

- [x] 6. Implement the netlist validator
  _Requirements: 3.2_
  - [x] 6.1 Create `src/features/netlist/netlist-validator.ts` implementing `validateNetlist(text: string, dryRun: (nl: string) => Promise<string>): Promise<ValidationResult>` with three stages: (1) syntax parse, (2) element/node checks (ground node 0 present, no floating nodes, all `.model` refs resolved), (3) ngspice dry-run via `dryRun` callback.
  - [x] 6.2 Add `friendlyMessage(rawNgspiceError: string): string` mapping recognisable ngspice error patterns to human-readable strings in both languages.
  - [ ] 6.3 Update `NetlistEditor.tsx` to display a validation summary panel below the editor showing counts of errors/warnings with "Spirits are restless" flavour copy.

---

## Phase 4 — Simulation Engine

- [x] 7. Implement the Web Worker simulation wrapper
  _Requirements: 4.1, 4.2, 4.3_
  - [x] 7.1 Create `src/features/simulate/worker-protocol.ts` with all four typed message interfaces: `SimulateRequest`, `SimulateResponse`, `SimulateError`, `SimulateProgress`.
  - [x] 7.2 Create `src/features/simulate/sim.worker.ts`; lazy-import `eecircuit-engine` on first message; maintain a singleton `Simulation` instance; handle `SimulateRequest`, post `SimulateProgress('loading')` during WASM init, `SimulateProgress('running')` during `runSim()`, then `SimulateResponse` or `SimulateError`.
  - [x] 7.3 Create `src/features/simulate/use-simulation.ts` React hook: creates the Worker once, queues requests with a UUID `id`, exposes `simulate(netlist)`, `state: SimulationState`, `result: SimResult | null`, `error: SimulateError | null`.
  - [ ] 7.4 Wire `dryRun` callback in `netlist-validator.ts` to use the same worker with a special no-output flag in the netlist.
  - [x] 7.5 Add a "Summoning…" loading overlay on the scope canvas area while `SimulationState` is `'loading'` or `'running'`, using the CRT aesthetic (flickering text, green glow). _Scope.tsx overlay_

- [x] 8. Implement the result summariser
  _Requirements: 4.1, 8.2_
  - [x] 8.1 Create `src/features/simulate/result-summariser.ts` implementing `summariseResult(result: SimResult, type: AnalysisType): CompactSummary`.
  - [x] 8.2 Implement transient summary: iterate each channel's `values` array to find min, max, final; estimate τ (time to reach 63.2% of final from start); estimate 10%–90% rise time; detect overshoot if `max > final * 1.02`.
  - [x] 8.3 Implement AC summary: find –3 dB point (relative to DC or max gain); find peak gain and frequency.
  - [x] 8.4 Implement DC sweep and `.op` summaries per spec §4.1.
  - [x] 8.5 Add a token-budget guard: `trimSummary(s: CompactSummary): CompactSummary` that truncates decimal precision until the JSON serialisation is ≤ 2 000 characters.

---

## Phase 5 — CRT Oscilloscope

- [x] 9. Implement the phosphor effects utilities
  _Requirements: 5.1, 5.4_
  - [x] 9.1 Create `src/features/scope/phosphor-effects.ts` with: `applyGlow(ctx, color, blurRadius)`, `applyPersistence(screenCtx, persistCtx, decayAlpha)`, `applyScanlines(ctx, canvasHeight)`, `applyFlicker(ctx, timestamp)`. Each function is pure (no internal state; state lives in the renderer).
  - [x] 9.2 Implement `prefers-reduced-motion` detection in `phosphor-effects.ts`; export a `motionAllowed(): boolean` helper that the renderer checks each frame.
  - [x] 9.3 Implement `playCRTPowerOn(ctx: CanvasRenderingContext2D): Promise<void>`: brightness-ramp + horizontal-line-expand animation (≤ 1 s); resolves immediately (no animation) when `!motionAllowed()`.

- [x] 10. Implement the scope renderer
  _Requirements: 5.1, 5.2, 5.4, 7.5_
  - [x] 10.1 Create `src/features/scope/scope-renderer.ts` with a `ScopeRenderer` class: constructor takes canvas ref; `draw(viewState, simResult, timestamp)` is the RAF callback.
  - [x] 10.2 Implement graticule drawing: 10 × 8 divisions, centre-line ticks (5 sub-divisions), phosphor-tint grid lines, outer border.
  - [x] 10.3 Implement transient trace rendering: project time/voltage to canvas coordinates per `voltsPerDiv` and `timePerDiv`; batch per channel into a single `beginPath/stroke`; apply glow via `shadowBlur`.
  - [x] 10.4 Implement the off-screen persistence buffer (`persistCanvas`): each frame, draw `persistCanvas` onto `screenCanvas` at `globalAlpha = 0.85` before current trace; copy current trace onto `persistCanvas` for next frame.
  - [x] 10.5 Implement empty-state rendering: when `simResult` is null, draw "No signal — summon a circuit" (bilingual, from i18n) centred on the canvas with phosphor-green styling and gentle idle glow.
  - [x] 10.6 Implement AC Bode rendering: log₁₀ x-axis transform; dual traces (magnitude dB, phase °) in two different phosphor tints. _magnitude only; phase not drawn_
  - [ ] 10.7 Implement DC sweep trace rendering (single X-Y path). _(nice to have)_
  - [x] 10.8 Implement `.op` node-voltage table view (replaces canvas; rendered as a styled HTML table overlay). _Scope.tsx .op table_
  - [x] 10.9 Add adaptive quality: if frame time > 16 ms for 2 consecutive frames, halve `shadowBlur`; restore when frame time drops back below 14 ms.
  - [x] 10.10 Create `src/features/scope/ScopeCanvas.tsx`: owns canvas ref and `ResizeObserver`; instantiates `ScopeRenderer`; drives RAF loop; calls `playCRTPowerOn` on mount; sets `data-has-trace="true"` after first successful draw; adds `data-testid="scope-canvas"`.

- [x] 11. Implement scope controls
  _Requirements: 5.2, 5.3_
  - [x] 11.1 Create `src/features/scope/ScopeControls.tsx`: volts/div selector (dropdown or scroll knob) per channel, time/div selector, channel enable checkboxes with colour swatches, channel variable-name selector (populated from `SimResult.variableNames`).
  - [x] 11.2 Add arrow-key support to each knob: when focused, Up/Right increments by one step, Down/Left decrements; apply a phosphor-style CSS `outline` as the focus ring.
  - [x] 11.3 Ensure all control touch targets are ≥ 44 × 44 px; add `aria-label` to icon controls.
  - [x] 11.4 Add a `data-testid="sim-status"` element that reflects the current simulation status string (idle / loading / running / complete / error).

---

## Phase 6 — Image Capture & Upload

- [x] 12. Implement the capture panel
  _Requirements: 6.1_
  - [x] 12.1 Create `src/features/capture/use-capture.ts` hook: manages `capturedImage: CapturedImage | null` state; `captureFromCamera()` triggers a hidden `<input type="file" capture="environment">`; `uploadFromFile()` triggers a standard file picker; both paths call `compressIfNeeded(file)`. _capture/compress.ts + "Your own drawing" card in SeanceTable.tsx; ≤1600 px JPEG instead of 5 MB loop_
  - [x] 12.2 Implement `compressIfNeeded(file: File): Promise<string>` in `use-capture.ts`: if `file.size > 5_242_880` bytes, draw to a canvas at reduced JPEG quality until size ≤ 5 MB, return base64 data URL; otherwise return raw base64.
  - [x] 12.3 Create `src/features/capture/CapturePanel.tsx`: image preview (`<img>` with `alt` describing the schematic), "Capture" button (camera icon, `aria-label`), "Upload" button, file-size warning banner, unsupported-feature notice when `File` API absent.

---

## Phase 7 — LLM Adapter (OpenAI-compatible — MVP)

- [x] 13. Implement the LLM adapter layer
  _Requirements: 7.3_
  - [x] 13.1 Create `src/lib/llm/adapter.ts` exporting the `LLMAdapter` interface, `LLMError` class, `ProviderPreset` type, and `PROVIDER_PRESETS` defaults map.
  - [x] 13.2 Create `src/lib/llm/openai.ts` implementing `OpenAIAdapter` (covers Qwen-VL/DashScope, OpenAI, Gemini): `transcribeSchematic` builds a chat-completions request with a system prompt + image `image_url` content part; `explainWaveform` sends netlist + serialised `CompactSummary`; configurable `baseUrl` and `model`; throws `LLMError` on HTTP errors.
  - [x] 13.3 Create `src/lib/llm/factory.ts` exporting `createAdapter(config: LLMConfig): LLMAdapter` that returns `OpenAIAdapter` for all OpenAI-compatible presets. _lib/llm/factory.ts_
  - [ ] 13.4 **(Stretch)** Create `src/lib/llm/anthropic.ts` implementing `AnthropicAdapter`; update `factory.ts` to return it for `provider === 'anthropic'`.

- [x] 14. Implement LLM response parsing
  _Requirements: 7.1_
  - [x] 14.1 Create `src/features/transcribe/llm-response-parser.ts` implementing `parseNetlistFromResponse(raw: string): { netlist: string; note: string } | { error: 'no-fence' | 'empty-fence' }`.
  - [x] 14.2 Implement extraction logic: find first ` ```spice ` or plain ` ``` ` block (case-insensitive); extract content; capture any trailing text as `note`; return error variant if no block found or block is empty.

- [x] 15. Implement the transcribe panel
  _Requirements: 7.1, 7.2_
  - [x] 15.1 Create `src/features/transcribe/use-transcribe.ts` hook: accepts `LLMAdapter | null` and `capturedImage`; exposes `transcribe()`, `state: 'idle' | 'loading' | 'done' | 'error'`, `netlist: string | null`, `note: string | null`, `error: string | null`; in demo mode accepts a `preRecordedResponse: string` option that bypasses the LLM call.
  - [x] 15.2 Create `src/features/transcribe/TranscribePanel.tsx`: side-by-side two-pane layout (photo on left, netlist text on right); "Transcribe" button (disabled when no image or no API key); confidence note badge; "DEMO" badge when in demo mode; error message with "Enter manually" fallback prompt. _TranscriptionStage.tsx_
  - [x] 15.3 Wire transcription result into `NetlistEditor` (pass `netlist` as the editor's controlled value after transcription).
  - [ ] 15.4 On transcription complete, automatically call `validateNetlist()` and surface errors in the editor.

---

## Phase 8 — AI Spirit

- [x] 16. Implement the offline spirit explainer
  _Requirements: 2.1, 8.3_
  - [x] 16.1 Create `src/features/spirit/offline-explainer.ts` with pre-written Markdown explanations for each of the six standard example circuits (keyed by `exampleId`); each explanation must include: what the waveform shows, the key time constant or frequency, and one "try next" suggestion; provide both English and Simplified Chinese text.
  - [x] 16.2 Export `getOfflineExplanation(exampleId: string, language: 'en' | 'zh-CN'): string | null`. _offline-explainer.ts `offlineExplanation()`; quotes measured numbers_

- [x] 17. Implement the spirit panel
  _Requirements: 8.1, 8.2, 8.3, 15.1_
  - [x] 17.1 Create `src/features/spirit/use-spirit.ts` hook: accepts `LLMAdapter | null`, `netlist`, `summary`, `exampleId | null`, `language`; exposes `explain()`, `state`, `explanation: string | null`; falls back to `getOfflineExplanation` when `adapter` is null and `exampleId` is set; adds "offline mode" flag to state. _logic lives in App.tsx, no separate hook_
  - [x] 17.2 Install `marked` (or `remark` + `rehype`) for Markdown rendering; pin exact version.
  - [x] 17.3 Create `src/features/spirit/SpiritPanel.tsx`: renders explanation Markdown in a styled panel with CRT-inspired typography; shows "Ask the Spirit" button; shows offline badge and "DEMO" badge as appropriate; shows loading skeleton during fetch; shows error message with retry on failure.
  - [x] 17.4 Add the "Homework check" section to `SpiritPanel.tsx`: one or more labelled numeric input fields (expected τ, expected −3 dB freq, expected DC gain — show relevant fields based on `analysisType`); "Check" button; pass/fail result with percentage error and bilingual explanation; all inputs keyboard-operable with `aria-label`.
  - [x] 17.5 Create `src/features/spirit/homework-check.ts` implementing `checkHomework(expected: Record<string, number>, summary: CompactSummary): HomeworkCheckResult[]`; pass threshold ±5%; include bilingual EN/中文 feedback strings. _homework-check.ts_

---

## Phase 9 — Integration & Wiring

- [x] 18. Wire all features together in App.tsx
  _Requirements: 9.1, 9.2_
  - [x] 18.1 Connect `useCapture` → `TranscribePanel` → `NetlistEditor` data flow: captured image flows to transcribe; transcribed netlist flows to editor.
  - [x] 18.2 Connect `NetlistEditor` → `useSimulation` → `ScopeCanvas` data flow: on "Simulate" click (or Ctrl+Enter, or example load), run validation then simulation; pass `SimResult` to scope.
  - [x] 18.3 Connect `useSimulation` → `summariseResult` → `useSpirit` data flow: after simulation completes, compute summary; pass to spirit hook.
  - [x] 18.4 Wire example selector: clicking an example sets the netlist in the editor, sets `exampleId`, and auto-triggers simulation.
  - [x] 18.5 Wire language toggle to `LanguageContext` and propagate to LLM adapter calls and all i18n strings.
  - [x] 18.6 Wire settings panel to `createAdapter(config)`: when config changes, recreate the adapter and pass to `useTranscribe` and `useSpirit`.
  - [x] 18.7 Ensure the "Simulate" button is disabled when validation has errors; "Transcribe" and "Ask Spirit" buttons are disabled when no API key is configured. _Simulate disabled when empty/busy; live features hidden without key_
  - [x] 18.8 Wire status bar and `aria-live` region to simulation state changes ("idle", "Summoning…", "Simulation complete", error messages).

- [x] 19. Mobile & responsive polish
  _Requirements: 5.3, 9.1_
  - [x] 19.1 Verify the capture flow on a mobile-viewport layout (375 × 667 px): all buttons reachable, camera input works, scope readable in landscape. _e2e at 390×844, no horizontal overflow_
  - [x] 19.2 Add a CSS media query for `(orientation: landscape) and (max-width: 767px)`: scope canvas full-width, controls below.
  - [x] 19.3 Verify touch targets ≥ 44 × 44 px on all primary controls; add `min-height`/`min-width` CSS where needed.

---

## Phase 10 — Accessibility & Performance

- [x] 20. Accessibility pass
  _Requirements: 10.1_
  - [x] 20.1 Add `aria-label` to all icon-only buttons (settings gear, language toggle, close button, Transcribe, Ask Spirit, Simulate).
  - [x] 20.2 Verify keyboard tab order through the primary controls (example list → editor → simulate button → scope controls → ask spirit button → homework check → settings).
  - [x] 20.3 Verify WCAG AA contrast (≥ 4.5:1) for all text labels, axis labels, and status messages over the dark CRT background; adjust colours as needed.
  - [x] 20.4 Implement `prefers-reduced-motion` media query in `scope-renderer.ts` and `phosphor-effects.ts`: disable flicker, scanlines animation, and persistence trail; keep static glow; skip CRT power-on animation.
  - [x] 20.5 Confirm all knob controls respond to arrow-key input and show a visible phosphor-style focus ring (CSS `outline` matching phosphor-green).

- [ ] 21. Performance optimisation
  _Requirements: 4.1, 10.2_
  - [ ] 21.1 Verify the WASM package is fetched only once and cached by the browser; add `vite-plugin-pwa` or manual service worker if needed for offline WASM caching.
  - [x] 21.2 Add a "Summoning…" spinner / progress bar to the scope area that appears immediately on page load while WASM is being fetched; confirm the rest of the UI (example list, editor) renders before WASM finishes loading. _engine warm-up during intro_
  - [ ] 21.3 Profile the scope RAF loop with 10k points × 4 channels; verify ≥ 60 fps on Chrome on a mid-range machine; apply path batching or offscreen canvas if needed.

---

## Phase 11 — Tests

- [x] 22. Unit tests — netlist parser
  _Requirements: 11.1_
  - [x] 22.1 Create `tests/unit/features/netlist/netlist-parser.test.ts`; write ≥ 20 test cases covering: component types R/C/L/V/I/D/Q/M/X; multi-node components; SPICE values (1k, 100n, 2.5e-3); `.tran`, `.ac`, `.dc`, `.op` directives; `.model` and `.subckt` directives; `;` and `*` comments; continuation `+` lines; title line handling.
  - [ ] 22.2 Create `tests/unit/features/netlist/netlist-parser.property.test.ts`; use `fast-check` to generate well-formed netlists and verify the round-trip property `serialise(parse(nl)) === normalise(nl)`.
  - [x] 22.3 Create `tests/unit/features/netlist/netlist-validator.test.ts`; test: valid netlist passes all three stages; missing ground (no node 0) fails element check; floating node fails element check; unknown directive fails syntax stage.

- [x] 23. Unit tests — result summariser
  _Requirements: 11.2_
  - [x] 23.1 Create `tests/fixtures/sim-results/` with at least two fixture JSON files: one RC transient result (known τ, rise time) and one RLC AC result (known –3 dB frequency).
  - [x] 23.2 Create `tests/unit/features/simulate/result-summariser.test.ts`; verify τ within ±1%, rise time within ±1%, overshoot within ±1% against RC transient fixture; verify –3 dB frequency within ±0.5 dB against AC fixture.

- [x] 24. Unit tests — LLM response parser
  _Requirements: 11.3_
  - [x] 24.1 Create `tests/unit/features/transcribe/llm-response-parser.test.ts`; test: response with ` ```spice ` block returns correct netlist and note; response with plain ` ``` ` block returns correct netlist; response with no fenced block returns `{ error: 'no-fence' }`; response with empty fenced block returns `{ error: 'empty-fence' }`.

- [x] 25. End-to-end smoke test
  _Requirements: 11.4_
  - [x] 25.1 Install Playwright (`@playwright/test`); add `playwright.config.ts` targeting `http://localhost:5173`; add `npm run test:e2e` script. _tests/e2e/smoke.spec.ts, 10 tests, run via scripts/e2e.sh_
  - [x] 25.2 Create `tests/e2e/smoke.spec.ts`: navigate to app; click RC low-pass example; wait for `[data-testid="sim-status"]` to have text "complete" (timeout 30 s for WASM load); assert `[data-testid="scope-canvas"][data-has-trace="true"]` is visible.
  - [ ] 25.3 Add Playwright smoke test to CI: `npm run build && npx serve dist & npx playwright test`.

- [x] 26. Unit tests — homework check
  _Requirements: 15.1_
  - [x] 26.1 Create `tests/unit/features/spirit/homework-check.test.ts`; test: expected τ within ±5% of actual → pass; expected τ 20% off → fail with correct error percentage; expected −3 dB freq correct → pass; missing field in summary → graceful null result.

---

## Phase 12 — Demo Séance Mode

- [ ] 28. Implement Demo Séance mode
  _Requirements: 12.1, 12.2_
  - [ ] 28.1 Create `public/samples/` and add four hand-drawn-style SVG schematics: `rc-lowpass.svg`, `rlc-ringing.svg`, `diode-rectifier.svg`, `opamp-inverting.svg`. Each should be a clean, minimal line-art SVG (no external rasters).
  - [ ] 28.2 For each sample, write a precomputed netlist (`.net`) and a canned bilingual spirit explanation (`.md`) in `src/features/demo/` (imported as strings via `?raw`).
  - [ ] 28.3 Create `src/features/demo/sample-assets.ts` exporting `SAMPLE_ASSETS: SampleAsset[]` manifest.
  - [ ] 28.4 Create `src/features/demo/DemoIntroOverlay.tsx`: full-viewport overlay with CRT power-on animation; "Skip" button always visible; auto-dismisses after animation completes; suppresses animation when `!motionAllowed()`.
  - [ ] 28.5 Create `src/features/demo/use-demo-seance.ts` hook: checks `localStorage` for `seance-intro-seen`; if not set, schedules the intro overlay and auto-loads the RC sample; orchestrates `DemoStep` state machine (`idle → intro-animation → transcribing → simulating → done`); injects canned assets into transcribe/spirit pipelines; shows "DEMO" badges.
  - [ ] 28.6 Wire `useDemoSeance` into `App.tsx`: on first load with no API key, trigger the demo; ensure the demo is skippable at any step; after intro, set `seance-intro-seen` in `localStorage`.
  - [ ] 28.7 Verify end-to-end: from a fresh browser session with no API key, the RC waveform appears on screen within 10 seconds of page load.

---

## Phase 13 — SPICE MCP Server

- [ ] 29. Implement the SPICE MCP server
  _Requirements: 13.1, 13.2_
  - [ ] 29.1 Create `tools/spice-mcp/package.json` with `"type": "module"` and pinned dependency `@modelcontextprotocol/sdk`.
  - [ ] 29.2 Create `tools/spice-mcp/summarise.mjs` mirroring the `summariseResult` logic from `result-summariser.ts` (or importing a shared CJS/ESM build of it if the module format allows).
  - [ ] 29.3 Create `tools/spice-mcp/simulate.mjs`: wraps `eecircuit-engine` (Node-compatible build) or spawns a child process to run ngspice; returns `{ analysisType, variableNames, summary, errors }`.
  - [ ] 29.4 Create `tools/spice-mcp/explain.mjs`: rule-based bilingual explainer using `summarise.mjs` output; returns `{ en: string; 'zh-CN': string }`.
  - [ ] 29.5 Create `tools/spice-mcp/index.mjs`: MCP stdio server using `@modelcontextprotocol/sdk`; registers `simulate_netlist` and `explain_waveform` tools with typed input/output schemas.
  - [ ] 29.6 Create `.kiro/settings/mcp.json` registering the server: `{ "mcpServers": { "spice": { "command": "node", "args": ["tools/spice-mcp/index.mjs"] } } }`.
  - [ ] 29.7 Manually test via Kiro: use `simulate_netlist` to verify each of the six standard netlists simulates without error; use `explain_waveform` to verify each explanation is non-empty and bilingual.
  - [ ] 29.8 Create `docs/spice-mcp.md` documenting: purpose, registration in `.kiro/settings/mcp.json`, available tools with schemas, example calls, and how Kiro uses it during development.

---

## Phase 14 — Haunted Classics Gallery

- [ ] 30. Create Haunted Classics assets and gallery
  _Requirements: 14.1, 14.2, 14.3_
  - [ ] 30.1 Create `src/examples/haunted/` directory structure with four sub-folders: `555-astable/`, `passive-rc/`, `wien-bridge/`, `opamp-integrator/`.
  - [ ] 30.2 For each classic, write an ngspice-compatible netlist: 555 astable uses a behavioural switch/comparator model; Wien-bridge uses an ideal op-amp subcircuit; passive RC and op-amp integrator use standard components.
  - [ ] 30.3 For each classic, write the aged-paper SVG schematic: apply `<feColorMatrix>` sepia filter, slight skew/rotate transform (≤ 2°), typewriter-style font, `<feTurbulence>` coffee-stain overlay.
  - [ ] 30.4 For each classic, write the recorded LLM-style markdown response (`recorded-response.md`): a fenced ` ```spice ` block followed by a confidence note, formatted exactly as a real model would respond.
  - [ ] 30.5 For each classic, write bilingual blurbs (`blurb-en.md`, `blurb-zh.md`, ≤ 80 words each) describing the circuit's historical significance.
  - [ ] 30.6 For each classic, write the canned bilingual spirit explanation covering waveform interpretation, key parameters, and a "try next" suggestion.
  - [ ] 30.7 Create `src/features/haunted/haunted-assets.ts` exporting `HAUNTED_CLASSICS` manifest (id, svgPath, recordedResponsePath, netlistPath, blurbs, cannedExplanation) with all strings imported via `?raw`.
  - [ ] 30.8 Create `src/features/haunted/HauntedGallery.tsx`: grid of four cards; aged-paper SVG thumbnail; title and bilingual blurb; "Resurrect" button; on click: parse `recorded-response.md` through `parseNetlistFromResponse()`, show "DEMO" badge, load netlist into editor, run simulation, display canned explanation in spirit panel.
  - [ ] 30.9 Add "Haunted Classics" entry to the example selector / navigation in `App.tsx`.
  - [ ] 30.10 Verify all four classic netlists simulate without error using the SPICE MCP server (task 29.7).

---

## Phase 15 — Final Polish & Build Verification

- [ ] 27. Production build verification
  _Requirements: 9.2_
  - [x] 27.1 Run `npm run build`; confirm `dist/` contains only static files; confirm no TypeScript errors; confirm no ESLint errors.
  - [ ] 27.2 Serve `dist/` locally (`npx serve dist`) and manually smoke-test the RC example end-to-end in Chrome and Firefox.
  - [x] 27.3 Verify the WASM binary is included in `dist/` and loads correctly from the static origin (no CORS issues).
  - [x] 27.4 Add a `public/` favicon (CRT green oscilloscope icon or a ghost icon) and update `index.html` `<title>` to "Circuit Séance — 电路招魂".
  - [x] 27.5 Verify Demo Séance plays correctly in a fresh browser profile (no localStorage); verify the intro is skippable; verify the "DEMO" badge appears on all demo steps.
  - [x] 27.6 Test zero-setup judge mode: with no API key, confirm Demo Séance, Haunted Classics, and all six example circuits are fully functional; confirm no network calls are made (use browser DevTools Network panel). _e2e asserts zero non-localhost requests_

- [ ] 31. Copy and flavour text
  _Requirements: 1.2, 9.1_
  - [ ] 31.1 Review all i18n strings for the "Resurrection" / haunted tone: "Summoning the spirits…", "The spirits are restless", "No signal — summon a circuit", "Ask the Spirit", "电路招魂", etc.; ensure English and Chinese versions are both present and thematically consistent.
  - [ ] 31.2 Add a brief hero tagline to the top toolbar or a splash overlay on first load: "Berkeley SPICE, resurrected in your browser."
