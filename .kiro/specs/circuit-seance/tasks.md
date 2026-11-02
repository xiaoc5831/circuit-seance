# Circuit Séance — Implementation Tasks

**Feature:** Circuit Séance MVP  
**Version:** 1.0  
**Date:** 2026-11-02

Tasks are ordered so the app is demoable as early as possible: project shell → examples → simulation → scope → LLM features → spirit → testing. Sub-tasks within each group are sequenced by dependency.

---

## Phase 1 — Project Scaffold

- [ ] 1. Initialise the Vite + React 18 + TypeScript project with all tooling
  _Requirements: 1.1_
  - [ ] 1.1 Run `npm create vite@latest circuit-seance -- --template react-ts` and commit the baseline; verify `npm run dev` starts cleanly.
  - [ ] 1.2 Configure TypeScript `strict: true` in `tsconfig.json`; add `@/` path alias in `tsconfig.json` and `vite.config.ts`.
  - [ ] 1.3 Install and configure ESLint with `@typescript-eslint/recommended` and `eslint-plugin-react-hooks`; add `eslint.config.js`.
  - [ ] 1.4 Install and configure Prettier; add `prettier.config.js` and `.prettierignore`; wire `npm run lint` to run both ESLint and Prettier check.
  - [ ] 1.5 Install Vitest and configure `npm test` (single-run mode); add a trivial passing test to confirm the runner works.
  - [ ] 1.6 Create the full `src/` folder skeleton: `app/`, `features/{capture,transcribe,netlist,simulate,scope,spirit}/`, `lib/llm/`, `examples/`, `shared/`; add an `index.ts` stub barrel in each feature folder.
  - [ ] 1.7 Create `src/shared/types.ts` with the core interfaces: `SimResult`, `AnalysisType`, `CompactSummary`, `AppSettings`, `LLMConfig`, `LLMError`.
  - [ ] 1.8 Create `src/shared/utils.ts` with at minimum a `generateId()` (nanoid-style) helper.

- [ ] 2. Set up i18n string system
  _Requirements: 1.2_
  - [ ] 2.1 Create `src/app/i18n/en.ts` with all English UI strings as a typed `Record<string, string>` export; cover: nav labels, button labels, error messages, loading states, settings labels, scope labels, spirit labels.
  - [ ] 2.2 Create `src/app/i18n/zh-CN.ts` mirroring every key from `en.ts` with Simplified Chinese values.
  - [ ] 2.3 Create `src/app/i18n/index.ts` exporting a `useTranslation()` hook that reads `AppSettings.language` from a React context and returns the active locale map.
  - [ ] 2.4 Create a `LanguageContext` (in `src/app/`) that provides the language state and a toggle function; wrap `App.tsx` in it.

---

## Phase 2 — Bundled Examples & Shell Layout

- [ ] 3. Add bundled example netlists
  _Requirements: 2.1, 2.2_
  - [ ] 3.1 Write `src/examples/rc-lowpass.net` — RC low-pass filter with `.tran` directive.
  - [ ] 3.2 Write `src/examples/rl.net` — RL circuit with `.tran` directive.
  - [ ] 3.3 Write `src/examples/rlc-ringing.net` — RLC series with under-damped ringing, `.tran` directive.
  - [ ] 3.4 Write `src/examples/diode-rectifier.net` — half-wave diode rectifier, `.tran` directive.
  - [ ] 3.5 Write `src/examples/bjt-common-emitter.net` — BJT common-emitter amplifier, `.tran` directive.
  - [ ] 3.6 Write `src/examples/opamp-inverting.net` — op-amp inverting amplifier, `.ac` directive.
  - [ ] 3.7 Create `src/examples/index.ts` exporting an `EXAMPLE_CIRCUITS` array of `{ id, label, labelZh, net: string }` where `net` is the bundled netlist imported as a string (`?raw` Vite import).

- [ ] 4. Build the application shell layout
  _Requirements: 9.1, 9.2, 10.1_
  - [ ] 4.1 Create `src/app/App.tsx` with the two-panel layout: left panel (capture + netlist) and right panel (scope + spirit); use CSS Grid or Flexbox.
  - [ ] 4.2 Add the top toolbar with: app title ("Circuit Séance / 电路招魂"), language toggle button (EN / 中文), and settings icon button.
  - [ ] 4.3 Add a status bar at the bottom showing current simulation status.
  - [ ] 4.4 Implement responsive breakpoint: `< 1024 px` collapses to single-column stacked layout.
  - [ ] 4.5 Add CSS custom properties for the CRT colour palette: background `#0a0f0a`, phosphor greens, graticule grey; import a monospace web font (e.g. `Share Tech Mono` from Google Fonts or self-hosted) for the scope labels.
  - [ ] 4.6 Create a `SettingsPanel` component (modal or drawer) with: provider selector, API key field (masked), base URL field (OpenAI only), model field, storage mode toggle, close button.
  - [ ] 4.7 Wire settings state to `localStorage` / `sessionStorage` per `AppSettings.storageMode`; never store the key in a React state tree that could be serialised to DevTools.

---

## Phase 3 — Netlist Editor

- [ ] 5. Implement the SPICE netlist parser
  _Requirements: 3.1, 3.2, 3.3_
  - [ ] 5.1 Install CodeMirror 6 packages: `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/lint`; pin exact versions in `package.json`.
  - [ ] 5.2 Create `src/features/netlist/netlist-parser.ts` implementing `parseNetlist(text: string): ParsedNetlist`; handle: title line, component lines (R/C/L/V/I/D/Q/M/E/F/G/H/X), directives (`.tran`, `.ac`, `.dc`, `.op`, `.model`, `.subckt`, `.ends`, `.end`), comments (`;` prefix and `*` first-char), continuation lines (`+`).
  - [ ] 5.3 Create `src/features/netlist/spice-mode.ts` implementing a CodeMirror `StreamLanguage` (or lezer grammar) that tokens: `comment`, `directive`, `component-type`, `node`, `value`, `model-name`; export as a CM6 `LanguageSupport`.
  - [ ] 5.4 Create `src/features/netlist/NetlistEditor.tsx` wrapping a CodeMirror 6 `EditorView`; accept `value: string`, `onChange: (v: string) => void`, `errors: ValidationError[]` props; render error markers via CM6 `linter` extension.
  - [ ] 5.5 Update `src/features/netlist/index.ts` barrel to export `NetlistEditor`, `parseNetlist`, and types.

- [ ] 6. Implement the netlist validator
  _Requirements: 3.2_
  - [ ] 6.1 Create `src/features/netlist/netlist-validator.ts` implementing `validateNetlist(text: string, dryRun: (nl: string) => Promise<string>): Promise<ValidationResult>` with three stages: (1) syntax parse, (2) element/node checks (ground node 0 present, no floating nodes, all `.model` refs resolved), (3) ngspice dry-run via `dryRun` callback.
  - [ ] 6.2 Add `friendlyMessage(rawNgspiceError: string): string` mapping recognisable ngspice error patterns (singular matrix, timestep too small, no ground) to human-readable strings in both languages.
  - [ ] 6.3 Update `NetlistEditor.tsx` to display a validation summary panel below the editor showing counts of errors/warnings with "Spirits are restless" flavour copy.

---

## Phase 4 — Simulation Engine

- [ ] 7. Implement the Web Worker simulation wrapper
  _Requirements: 4.1, 4.2, 4.3_
  - [ ] 7.1 Create `src/features/simulate/worker-protocol.ts` with all four typed message interfaces: `SimulateRequest`, `SimulateResponse`, `SimulateError`, `SimulateProgress`.
  - [ ] 7.2 Create `src/features/simulate/sim.worker.ts`; lazy-import `eecircuit-engine` on first message; maintain a singleton `Simulation` instance; handle `SimulateRequest`, post `SimulateProgress('loading')` during WASM init, `SimulateProgress('running')` during `runSim()`, then `SimulateResponse` or `SimulateError`.
  - [ ] 7.3 Create `src/features/simulate/use-simulation.ts` React hook: creates the Worker once, queues requests with a UUID `id`, exposes `simulate(netlist)`, `state: SimulationState`, `result: SimResult | null`, `error: SimulateError | null`.
  - [ ] 7.4 Wire `dryRun` callback in `netlist-validator.ts` to use a secondary `useSimulation`-style call with a `type: 'dry-run'` flag (or re-use the same worker with a special no-output flag in the netlist).
  - [ ] 7.5 Add a "Summoning…" loading overlay on the scope canvas area while `SimulationState` is `'loading'` or `'running'`, using the CRT aesthetic (flickering text, green glow).

- [ ] 8. Implement the result summariser
  _Requirements: 4.1, 8.2_
  - [ ] 8.1 Create `src/features/simulate/result-summariser.ts` implementing `summariseResult(result: SimResult, type: AnalysisType): CompactSummary`.
  - [ ] 8.2 Implement transient summary: iterate each channel's `values` array to find min, max, final; estimate τ (time to reach 63.2% of final from start); estimate 10%–90% rise time; detect overshoot if `max > final * 1.02`.
  - [ ] 8.3 Implement AC summary: find –3 dB point (relative to DC or max gain); find peak gain and frequency.
  - [ ] 8.4 Implement DC sweep and `.op` summaries per spec §4.1.
  - [ ] 8.5 Add a token-budget guard: `trimSummary(s: CompactSummary): CompactSummary` that truncates decimal precision until the JSON serialisation is ≤ 2 000 characters.

---

## Phase 5 — CRT Oscilloscope

- [ ] 9. Implement the phosphor effects utilities
  _Requirements: 5.1, 5.3_
  - [ ] 9.1 Create `src/features/scope/phosphor-effects.ts` with: `applyGlow(ctx, color, blurRadius)`, `applyPersistence(screenCtx, persistCtx, decayAlpha)`, `applyScanlines(ctx, canvasHeight)`, `applyFlicker(ctx, timestamp)`. Each function is pure (no internal state; state lives in the renderer).
  - [ ] 9.2 Implement `prefers-reduced-motion` detection in `phosphor-effects.ts`; export a `motionAllowed(): boolean` helper that the renderer checks each frame.

- [ ] 10. Implement the scope renderer
  _Requirements: 5.1, 5.2, 7.5_
  - [ ] 10.1 Create `src/features/scope/scope-renderer.ts` with a `ScopeRenderer` class: constructor takes canvas ref; `draw(viewState, simResult, timestamp)` is the RAF callback.
  - [ ] 10.2 Implement graticule drawing: 10 × 8 divisions, centre-line ticks (5 sub-divisions), phosphor-tint grid lines, outer border.
  - [ ] 10.3 Implement transient trace rendering: project time/voltage to canvas coordinates per `voltsPerDiv` and `timePerDiv`; batch per channel into a single `beginPath/stroke`; apply glow via `shadowBlur`.
  - [ ] 10.4 Implement the off-screen persistence buffer (`persistCanvas`): each frame, draw `persistCanvas` onto `screenCanvas` at `globalAlpha = 0.85` before current trace; copy current trace onto `persistCanvas` for next frame.
  - [ ] 10.5 Implement AC Bode rendering: log₁₀ x-axis transform; dual traces (magnitude dB, phase °) in two different phosphor tints.
  - [ ] 10.6 Implement DC sweep trace rendering (single X-Y path).
  - [ ] 10.7 Implement `.op` node-voltage table view (replaces canvas; rendered as a styled HTML table overlay).
  - [ ] 10.8 Add adaptive quality: if frame time > 16 ms for 2 consecutive frames, halve `shadowBlur`; restore when frame time drops back below 14 ms.
  - [ ] 10.9 Create `src/features/scope/ScopeCanvas.tsx`: owns canvas ref and `ResizeObserver`; instantiates `ScopeRenderer`; drives RAF loop; sets `data-has-trace="true"` after first successful draw; adds `data-testid="scope-canvas"`.

- [ ] 11. Implement scope controls
  _Requirements: 5.2, 5.3_
  - [ ] 11.1 Create `src/features/scope/ScopeControls.tsx`: volts/div selector (dropdown or scroll knob) per channel, time/div selector, channel enable checkboxes with colour swatches, channel variable-name selector (populated from `SimResult.variableNames`).
  - [ ] 11.2 Ensure all control touch targets are ≥ 44 × 44 px; add `aria-label` to icon controls.
  - [ ] 11.3 Add a `data-testid="sim-status"` element that reflects the current simulation status string (idle / loading / running / complete / error).

---

## Phase 6 — Image Capture & Upload

- [ ] 12. Implement the capture panel
  _Requirements: 6.1_
  - [ ] 12.1 Create `src/features/capture/use-capture.ts` hook: manages `capturedImage: CapturedImage | null` state; `captureFromCamera()` triggers a hidden `<input type="file" capture="environment">`; `uploadFromFile()` triggers a standard file picker; both paths call `compressIfNeeded(file)`.
  - [ ] 12.2 Implement `compressIfNeeded(file: File): Promise<string>` in `use-capture.ts`: if `file.size > 5_242_880` bytes, draw to a canvas at reduced JPEG quality until size ≤ 5 MB, return base64 data URL; otherwise return raw base64.
  - [ ] 12.3 Create `src/features/capture/CapturePanel.tsx`: image preview (`<img>` with `alt` describing the schematic), "Capture" button (camera icon, `aria-label`), "Upload" button, file-size warning banner, unsupported-feature notice when `File` API absent.

---

## Phase 7 — LLM Transcription

- [ ] 13. Implement the LLM adapter layer
  _Requirements: 7.3_
  - [ ] 13.1 Create `src/lib/llm/adapter.ts` exporting the `LLMAdapter` interface and `LLMError` class.
  - [ ] 13.2 Create `src/lib/llm/openai.ts` implementing `OpenAIAdapter`: `transcribeSchematic` builds a chat-completions request with a system prompt + image `image_url` content part; `explainWaveform` sends netlist + serialised `CompactSummary`; configurable `baseUrl` and `model`; throws `LLMError` on HTTP errors.
  - [ ] 13.3 Create `src/lib/llm/anthropic.ts` implementing `AnthropicAdapter`: uses the Anthropic Messages API; image in `image` content block with `source.type = 'base64'`; same prompt structure; throws `LLMError` on HTTP errors.
  - [ ] 13.4 Create `src/lib/llm/factory.ts` exporting `createAdapter(config: LLMConfig): LLMAdapter` that returns the correct concrete adapter.

- [ ] 14. Implement LLM response parsing
  _Requirements: 7.1_
  - [ ] 14.1 Create `src/features/transcribe/llm-response-parser.ts` implementing `parseNetlistFromResponse(raw: string): { netlist: string; note: string } | { error: 'no-fence' | 'empty-fence' }`.
  - [ ] 14.2 Implement extraction logic: find first ` ```spice ` or plain ` ``` ` block (case-insensitive); extract content; capture any trailing text as `note`; return error variant if no block found or block is empty.

- [ ] 15. Implement the transcribe panel
  _Requirements: 7.1, 7.2_
  - [ ] 15.1 Create `src/features/transcribe/use-transcribe.ts` hook: accepts `LLMAdapter | null` and `capturedImage`; exposes `transcribe()`, `state: 'idle' | 'loading' | 'done' | 'error'`, `netlist: string | null`, `note: string | null`, `error: string | null`.
  - [ ] 15.2 Create `src/features/transcribe/TranscribePanel.tsx`: side-by-side two-pane layout (photo on left, netlist text on right); "Transcribe" button (disabled when no image or no API key); confidence note badge; error message with "Enter manually" fallback prompt.
  - [ ] 15.3 Wire transcription result into `NetlistEditor` (pass `netlist` as the editor's controlled value after transcription).
  - [ ] 15.4 On transcription complete, automatically call `validateNetlist()` and surface errors in the editor.

---

## Phase 8 — AI Spirit

- [ ] 16. Implement the offline spirit explainer
  _Requirements: 2.1, 8.3_
  - [ ] 16.1 Create `src/features/spirit/offline-explainer.ts` with pre-written Markdown explanations for each of the six example circuits (keyed by `exampleId`); each explanation must include: what the waveform shows, the key time constant or frequency, and one "try next" suggestion; provide both English and Simplified Chinese text.
  - [ ] 16.2 Export `getOfflineExplanation(exampleId: string, language: 'en' | 'zh-CN'): string | null`.

- [ ] 17. Implement the spirit panel
  _Requirements: 8.1, 8.2, 8.3_
  - [ ] 17.1 Create `src/features/spirit/use-spirit.ts` hook: accepts `LLMAdapter | null`, `netlist`, `summary`, `exampleId | null`, `language`; exposes `explain()`, `state`, `explanation: string | null`; falls back to `getOfflineExplanation` when `adapter` is null and `exampleId` is set; adds "offline mode" flag to state.
  - [ ] 17.2 Install `marked` (or `remark` + `rehype`) for Markdown rendering; pin exact version.
  - [ ] 17.3 Create `src/features/spirit/SpiritPanel.tsx`: renders explanation Markdown in a styled panel with CRT-inspired typography (monospace, green tint); shows "Ask the Spirit" button; shows offline badge when applicable; shows loading skeleton during fetch; shows error message with retry on failure.

---

## Phase 9 — Integration & Wiring

- [ ] 18. Wire all features together in App.tsx
  _Requirements: 9.1, 9.2_
  - [ ] 18.1 Connect `useCapture` → `TranscribePanel` → `NetlistEditor` data flow: captured image flows to transcribe; transcribed netlist flows to editor.
  - [ ] 18.2 Connect `NetlistEditor` → `useSimulation` → `ScopeCanvas` data flow: on "Simulate" click (or example load), run validation then simulation; pass `SimResult` to scope.
  - [ ] 18.3 Connect `useSimulation` → `summariseResult` → `useSpirit` data flow: after simulation completes, compute summary; pass to spirit hook.
  - [ ] 18.4 Wire example selector: clicking an example sets the netlist in the editor, sets `exampleId`, and auto-triggers simulation.
  - [ ] 18.5 Wire language toggle to `LanguageContext` and propagate to LLM adapter calls.
  - [ ] 18.6 Wire settings panel to `createAdapter(config)`: when config changes, recreate the adapter and pass to `useTranscribe` and `useSpirit`.
  - [ ] 18.7 Ensure the "Simulate" button is disabled when validation has errors; "Transcribe" and "Ask Spirit" buttons are disabled when no API key is configured.

- [ ] 19. Mobile & responsive polish
  _Requirements: 5.3, 9.1_
  - [ ] 19.1 Verify the capture flow on a mobile-viewport layout (375 × 667 px): all buttons reachable, camera input works, scope readable in landscape.
  - [ ] 19.2 Add a CSS media query for `(orientation: landscape) and (max-width: 767px)`: scope canvas full-width, controls below.
  - [ ] 19.3 Verify touch targets ≥ 44 × 44 px on all primary controls; add `min-height`/`min-width` CSS where needed.

---

## Phase 10 — Accessibility & Performance

- [ ] 20. Accessibility pass
  _Requirements: 10.1_
  - [ ] 20.1 Add `aria-label` to all icon-only buttons (settings gear, language toggle, close button, Transcribe, Ask Spirit, Simulate).
  - [ ] 20.2 Verify keyboard tab order through the primary controls (example list → editor → simulate button → scope controls → ask spirit button → settings).
  - [ ] 20.3 Verify WCAG AA contrast (≥ 4.5:1) for all text labels, axis labels, and status messages over the dark CRT background; adjust colours as needed.
  - [ ] 20.4 Implement `prefers-reduced-motion` media query in `scope-renderer.ts` and `phosphor-effects.ts`: disable flicker, scanlines animation, and persistence trail; keep static glow.

- [ ] 21. Performance optimisation
  _Requirements: 4.1, 10.2_
  - [ ] 21.1 Verify the WASM package is fetched only once and cached by the browser (confirm `Cache-Control` headers in Vite build output; add `vite-plugin-pwa` or manual service worker if needed for offline WASM caching).
  - [ ] 21.2 Add a "Summoning…" spinner / progress bar to the scope area that appears immediately on page load while WASM is being fetched; confirm the rest of the UI (example list, editor) renders before WASM finishes loading.
  - [ ] 21.3 Profile the scope RAF loop with 10k points × 4 channels; verify ≥ 60 fps on Chrome on a mid-range machine; apply path batching or offscreen canvas if needed.

---

## Phase 11 — Tests

- [ ] 22. Unit tests — netlist parser
  _Requirements: 11.1_
  - [ ] 22.1 Create `tests/unit/features/netlist/netlist-parser.test.ts`; write ≥ 20 test cases covering: component types R/C/L/V/I/D/Q/M/X; multi-node components; SPICE values (1k, 100n, 2.5e-3); `.tran`, `.ac`, `.dc`, `.op` directives; `.model` and `.subckt` directives; `;` and `*` comments; continuation `+` lines; title line handling.
  - [ ] 22.2 Create `tests/unit/features/netlist/netlist-parser.property.test.ts`; use `fast-check` to generate well-formed netlists and verify the round-trip property `serialise(parse(nl)) === normalise(nl)`.
  - [ ] 22.3 Create `tests/unit/features/netlist/netlist-validator.test.ts`; test: valid netlist passes all three stages; missing ground (no node 0) fails element check; floating node fails element check; unknown directive fails syntax stage.

- [ ] 23. Unit tests — result summariser
  _Requirements: 11.2_
  - [ ] 23.1 Create `tests/fixtures/sim-results/` with at least two fixture JSON files: one RC transient result (known τ, rise time) and one RLC AC result (known –3 dB frequency).
  - [ ] 23.2 Create `tests/unit/features/simulate/result-summariser.test.ts`; verify τ within ±1%, rise time within ±1%, overshoot within ±1% against RC transient fixture; verify –3 dB frequency within ±0.5 dB against AC fixture.

- [ ] 24. Unit tests — LLM response parser
  _Requirements: 11.3_
  - [ ] 24.1 Create `tests/unit/features/transcribe/llm-response-parser.test.ts`; test: response with ` ```spice ` block returns correct netlist and note; response with plain ` ``` ` block returns correct netlist; response with no fenced block returns `{ error: 'no-fence' }`; response with empty fenced block returns `{ error: 'empty-fence' }`.

- [ ] 25. End-to-end smoke test
  _Requirements: 11.4_
  - [ ] 25.1 Install Playwright (`@playwright/test`); add `playwright.config.ts` targeting `http://localhost:5173`; add `npm run test:e2e` script.
  - [ ] 25.2 Create `tests/e2e/smoke.spec.ts`: navigate to app; click RC low-pass example; wait for `[data-testid="sim-status"]` to have text "complete" (timeout 30 s for WASM load); assert `[data-testid="scope-canvas"][data-has-trace="true"]` is visible.
  - [ ] 25.3 Add Playwright smoke test to CI: `npm run build && npx serve dist & npx playwright test`.

---

## Phase 12 — Final Polish & Build Verification

- [ ] 26. Copy and flavour text
  _Requirements: 1.2, 9.1_
  - [ ] 26.1 Review all i18n strings for the "Resurrection" / haunted tone: "Summoning the spirits…", "The spirits are restless", "Ask the Spirit", "电路招魂", etc.; ensure English and Chinese versions are both present.
  - [ ] 26.2 Add a brief hero tagline to the top toolbar or a splash overlay on first load: "Berkeley SPICE, resurrected in your browser."

- [ ] 27. Production build verification
  _Requirements: 9.2_
  - [ ] 27.1 Run `npm run build`; confirm `dist/` contains only static files; confirm no TypeScript errors; confirm no ESLint errors.
  - [ ] 27.2 Serve `dist/` locally (`npx serve dist`) and manually smoke-test the RC example end-to-end in Chrome and Firefox.
  - [ ] 27.3 Verify the WASM binary is included in `dist/` and loads correctly from the static origin (no CORS issues).
  - [ ] 27.4 Add a `public/` favicon (CRT green oscilloscope icon or a ghost icon) and update `index.html` `<title>` to "Circuit Séance — 电路招魂".
