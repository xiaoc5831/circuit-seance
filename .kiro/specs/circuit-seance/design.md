# Circuit Séance — Design

**Feature:** Circuit Séance MVP  
**Version:** 1.1  
**Date:** 2026-11-02

---

## 1. Architecture Overview

Circuit Séance is a fully static single-page application. There is no back-end; all computation (WASM simulation, LLM calls) originates in the browser. The architecture is divided into six feature domains that communicate through typed public barrel APIs, a shared library layer (`src/lib/`), and a cross-cutting shared-types layer (`src/shared/`). A companion local MCP server (`tools/spice-mcp/`) runs inside the Kiro IDE during development only and is never deployed.

```
┌────────────────────────────────────────────────────────────────────────┐
│  Browser                                                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  src/app  — Shell, routing, i18n, Demo Séance intro              │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │  │
│  │  │  capture   │  │ transcribe  │  │        netlist           │  │  │
│  │  │  feature   │  │  feature    │  │        feature           │  │  │
│  │  └─────┬──────┘  └──────┬──────┘  └──────────┬──────────────┘  │  │
│  │        │                │                     │                 │  │
│  │        └────────────────┴─────────────────────┘                 │  │
│  │                         │ netlist string                         │  │
│  │              ┌──────────▼──────────┐                            │  │
│  │              │   simulate feature  │◄──── Web Worker            │  │
│  │              │ (useSimulation hook)│      (eecircuit-engine)     │  │
│  │              └──────────┬──────────┘                            │  │
│  │                         │ SimResult                             │  │
│  │           ┌─────────────▼────────────┐                          │  │
│  │           │     scope feature        │                          │  │
│  │           │  (ScopeCanvas + knobs)   │                          │  │
│  │           └─────────────┬────────────┘                          │  │
│  │                         │ compact summary                       │  │
│  │              ┌──────────▼──────────┐                            │  │
│  │              │   spirit feature    │──► LLMAdapter              │  │
│  │              │  + homework check   │   (openai-compat)          │  │
│  │              └─────────────────────┘                            │  │
│  │                                                                  │  │
│  │  src/lib/llm  — LLMAdapter interface + impls                     │  │
│  │  src/shared   — types, utils, constants                          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  External (user's own key, never project server)                       │
│  ┌──────────────────────────────────────────┐                         │
│  │  OpenAI-compatible endpoint              │                         │
│  │  (DashScope/Qwen-VL default, OpenAI,     │                         │
│  │   Gemini, or user-supplied)              │                         │
│  └──────────────────────────────────────────┘                         │
└────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Kiro IDE (dev-time only, never deployed)                    │
│  ┌────────────────────────────────────────────┐              │
│  │  tools/spice-mcp/  (Node ESM, stdio MCP)   │              │
│  │  simulate_netlist tool                     │              │
│  │  explain_waveform tool                     │              │
│  └────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Rationale |
|---|---|
| Web Worker for WASM | ~40 MB WASM + simulation CPU must never jank the UI thread |
| Provider-agnostic `LLMAdapter` | New providers added without touching feature code |
| Qwen-VL (DashScope) as default provider | Free-tier access for students; OpenAI-compatible API requires no new adapter code |
| Barrel-only imports between features | Prevents fragile internal coupling |
| Canvas 2D (not WebGL) | Sufficient for 60 fps at ≤10k points; avoids WebGL context management overhead |
| `sessionStorage` default for API keys | Keys survive page refresh but not browser close; opt-in `localStorage` for persistence |
| Compact summary instead of raw arrays to LLM | Keeps prompt tokens small; avoids exposing raw float arrays that add no pedagogical value |
| Demo Séance mode with canned assets | Zero-setup judge experience; exercises real sim + real parser pipeline |
| SPICE MCP server (dev-time) | Lets Kiro verify every bundled netlist simulates and matches its canned explanation |
| MVP netlist editor = styled textarea | Reduces initial scope; CodeMirror 6 is a stretch goal added after core loop is working |

---

## 2. Component Diagram

```mermaid
graph TD
    subgraph "src/app"
        App["App.tsx\n(Shell + layout)"]
        Router["router.tsx"]
        I18n["i18n/en.ts\ni18n/zh-CN.ts"]
        DemoIntro["DemoIntroOverlay.tsx"]
    end

    subgraph "features/capture"
        CapturePanel["CapturePanel.tsx"]
        useCapture["useCapture.ts"]
    end

    subgraph "features/transcribe"
        TranscribePanel["TranscribePanel.tsx"]
        useTranscribe["useTranscribe.ts"]
        LLMResponseParser["llm-response-parser.ts"]
    end

    subgraph "features/netlist"
        NetlistEditor["NetlistEditor.tsx\n(textarea MVP / CodeMirror stretch)"]
        SpiceMode["spice-mode.ts (stretch)"]
        NetlistParser["netlist-parser.ts"]
        NetlistValidator["netlist-validator.ts"]
    end

    subgraph "features/simulate"
        useSimulation["useSimulation.ts"]
        SimWorker["sim.worker.ts\n(Web Worker)"]
        ResultSummariser["result-summariser.ts"]
    end

    subgraph "features/scope"
        ScopeCanvas["ScopeCanvas.tsx"]
        ScopeRenderer["scope-renderer.ts\n(Canvas 2D)"]
        ScopeControls["ScopeControls.tsx\n(knobs, channel select)"]
        PhosphorEffects["phosphor-effects.ts"]
    end

    subgraph "features/spirit"
        SpiritPanel["SpiritPanel.tsx\n(+ homework check)"]
        useSpirit["useSpirit.ts"]
        OfflineExplainer["offline-explainer.ts"]
        HomeworkCheck["homework-check.ts"]
    end

    subgraph "features/demo"
        DemoSeance["use-demo-seance.ts"]
        SampleAssets["sample assets (public/samples/)"]
    end

    subgraph "features/haunted"
        HauntedGallery["HauntedGallery.tsx"]
        HauntedAssets["src/examples/haunted/*.md + *.net"]
    end

    subgraph "src/lib/llm"
        LLMAdapter["adapter.ts\n(interface)"]
        OpenAIAdapter["openai.ts\n(covers Qwen/DashScope,\nOpenAI, Gemini)"]
        AnthropicAdapter["anthropic.ts (stretch)"]
        LLMFactory["factory.ts"]
    end

    subgraph "src/shared"
        Types["types.ts"]
        Utils["utils.ts"]
    end

    subgraph "tools/spice-mcp (dev-time)"
        SpiceMCP["index.mjs\n(stdio MCP server)"]
        MCPSummariser["summariser (shared logic)"]
    end

    App --> CapturePanel
    App --> TranscribePanel
    App --> NetlistEditor
    App --> ScopeCanvas
    App --> ScopeControls
    App --> SpiritPanel
    App --> DemoIntro
    App --> HauntedGallery

    useTranscribe --> LLMAdapter
    useTranscribe --> LLMResponseParser
    useSpirit --> LLMAdapter
    useSpirit --> OfflineExplainer
    useSpirit --> HomeworkCheck

    NetlistEditor --> NetlistParser
    NetlistEditor --> NetlistValidator

    useSimulation --> SimWorker
    useSimulation --> ResultSummariser

    ScopeCanvas --> ScopeRenderer
    ScopeRenderer --> PhosphorEffects

    LLMAdapter <|.. OpenAIAdapter
    LLMAdapter <|.. AnthropicAdapter
    LLMFactory --> OpenAIAdapter
    LLMFactory --> AnthropicAdapter

    DemoSeance --> SampleAssets
    HauntedGallery --> HauntedAssets
    HauntedGallery --> LLMResponseParser

    SpiceMCP --> MCPSummariser
    ResultSummariser -.->|shared logic| MCPSummariser
```

---

## 3. Sequence Diagram — Photo → Netlist → Simulate → Explain

```mermaid
sequenceDiagram
    actor User
    participant CP as CapturePanel
    participant TP as TranscribePanel
    participant NE as NetlistEditor
    participant Val as NetlistValidator
    participant Hook as useSimulation
    participant W as sim.worker.ts (Web Worker)
    participant SC as ScopeCanvas
    participant SP as SpiritPanel
    participant LLM as LLMAdapter (Provider)

    User->>CP: Upload / capture image
    CP->>CP: Compress if > 5 MB
    CP->>TP: imageBase64, mimeType

    User->>TP: Click "Transcribe"
    TP->>LLM: transcribeSchematic(imageBase64, mimeType)
    LLM-->>TP: raw LLM response (markdown + fenced netlist)
    TP->>TP: parseNetlistFromResponse() → netlistText
    TP->>NE: setNetlist(netlistText)
    TP->>Val: validateNetlist(netlistText) [3-stage]
    Val-->>NE: error markers (if any)

    alt Validation passes
        User->>Hook: Click "Simulate" (or Ctrl+Enter, or auto-triggered)
        Hook->>W: postMessage SimulateRequest {netlist, id}
        W->>W: sim.start() + sim.setNetList()
        W-->>Hook: SimulateProgress {stage: 'running'}
        W->>W: sim.runSim()
        W-->>Hook: SimulateResponse {result: SimResult}
        Hook->>SC: pass SimResult
        SC->>SC: render traces with phosphor effects
        SC-->>User: Animated CRT waveform

        User->>SP: Click "Ask the Spirit"
        SP->>Hook: getCompactSummary(SimResult)
        Hook-->>SP: CompactSummary
        SP->>LLM: explainWaveform(netlist, compactSummary)
        LLM-->>SP: markdown explanation
        SP-->>User: Rendered markdown with "try next" suggestion
    else Validation fails
        Val-->>NE: highlight error lines
        NE-->>User: "Spirits are restless" error panel
    end
```

### 3.1 Demo Séance sequence (no key)

```mermaid
sequenceDiagram
    actor Judge
    participant App
    participant Demo as use-demo-seance.ts
    participant SC as ScopeCanvas
    participant SP as SpiritPanel

    Judge->>App: First load (no API key, no intro-seen flag)
    App->>App: CRT power-on animation
    App->>Demo: startDemoSeance('rc-lowpass')
    Demo->>Demo: 1-2 s simulated "transcribing…" delay (DEMO badge shown)
    Demo->>SC: pass precomputed netlist to real sim engine
    SC-->>Judge: Live RC waveform on CRT (within 10 s)
    Demo->>SP: inject canned bilingual explanation (DEMO badge)
    SP-->>Judge: Spirit explanation rendered
    Judge->>App: (optionally) Click "Skip" at any point to abort intro
```

---

## 4. Data Models / TypeScript Interfaces

All interfaces are defined in `src/shared/types.ts` unless noted.

### 4.1 Simulation types

```ts
// Raw result from eecircuit-engine
interface SimResult {
  header: string;
  numVariables: number;
  variableNames: string[];
  numPoints: number;
  dataType: 'real' | 'complex';
  data: Array<{
    name: string;
    type: string;
    values: number[] | [number, number][]; // real or complex pairs
  }>;
}

type AnalysisType = 'tran' | 'ac' | 'dc' | 'op';

// Compact numeric digest passed to the LLM spirit
interface CompactSummary {
  analysisType: AnalysisType;
  tran?: {
    channels: Array<{
      name: string;
      min: number;
      max: number;
      final: number;
      tauEstimate: number | null;    // 63.2% rise time constant
      riseTime: number | null;       // 10%–90%
      overshootPct: number | null;
    }>;
  };
  ac?: {
    dcGainDb: number;
    minusThreeDbFreq: number | null; // Hz
    peakGainDb: number | null;
    peakFreqHz: number | null;
  };
  dc?: {
    sweepVar: string;
    outputVar: string;
    min: number;
    max: number;
    midSlopePerUnit: number;
  };
  op?: {
    nodeVoltages: Record<string, number>; // node name → volts
  };
}
```

### 4.2 Netlist parsing

```ts
// src/features/netlist/types.ts
type ComponentType =
  | 'R' | 'C' | 'L' | 'V' | 'I'
  | 'D' | 'Q' | 'M' | 'E' | 'F' | 'G' | 'H' | 'X';

interface NetlistComponent {
  type: ComponentType;
  name: string;       // e.g. "R1"
  nodes: string[];    // e.g. ["1", "2"]
  value: string;      // e.g. "10k"
  params: Record<string, string>;
  lineNumber: number;
}

type DirectiveType = 'tran' | 'ac' | 'dc' | 'op' | 'model' | 'subckt' | 'ends' | 'end' | 'other';

interface NetlistDirective {
  type: DirectiveType;
  raw: string;
  lineNumber: number;
}

interface ParsedNetlist {
  title: string;
  components: NetlistComponent[];
  directives: NetlistDirective[];
  errors: ParseError[];
}

interface ParseError {
  lineNumber: number;
  message: string;
  severity: 'error' | 'warning';
}
```

### 4.3 Validation

```ts
interface ValidationResult {
  valid: boolean;
  stage: 'syntax' | 'elements' | 'ngspice-dry-run' | 'passed';
  errors: ValidationError[];
}

interface ValidationError {
  lineNumber: number | null;
  message: string;       // human-readable, friendly
  rawMessage: string;    // raw ngspice or parser output
  severity: 'error' | 'warning';
}
```

### 4.4 LLM Adapter

```ts
// src/lib/llm/adapter.ts
interface LLMAdapter {
  transcribeSchematic(imageBase64: string, mimeType: string): Promise<string>;
  explainWaveform(
    netlist: string,
    summary: CompactSummary,
    language: 'en' | 'zh-CN',
  ): Promise<string>; // returns markdown
}

type ProviderPreset = 'qwen-dashscope' | 'openai' | 'gemini' | 'anthropic';

interface LLMConfig {
  provider: ProviderPreset;
  apiKey: string;
  baseUrl: string;    // default per preset; user-editable
  model: string;      // default per preset; user-editable
}

// Preset defaults
const PROVIDER_PRESETS: Record<ProviderPreset, { baseUrl: string; model: string }> = {
  'qwen-dashscope': {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-vl-max',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-1.5-pro',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
  },
};

class LLMError extends Error {
  provider: ProviderPreset;
  statusCode: number;
  // message inherited from Error
}
```

> **Note:** Qwen-VL, OpenAI, and Gemini all use the OpenAI-compatible chat completions format; a single `OpenAIAdapter` implementation covers all three. `AnthropicAdapter` remains a stretch goal.

### 4.5 Worker message protocol

```ts
// src/features/simulate/worker-protocol.ts

interface SimulateRequest {
  type: 'simulate';
  id: string;
  netlist: string;
}

interface SimulateResponse {
  type: 'result';
  id: string;
  result: SimResult;
}

interface SimulateError {
  type: 'error';
  id: string;
  message: string;  // friendly message
  raw: string;      // raw ngspice stderr/output
}

interface SimulateProgress {
  type: 'progress';
  id: string;
  stage: 'loading' | 'running';
}

type WorkerInbound = SimulateRequest;
type WorkerOutbound = SimulateResponse | SimulateError | SimulateProgress;
```

### 4.6 Scope display state

```ts
// src/features/scope/types.ts
interface ChannelConfig {
  variableName: string;        // matches SimResult.data[i].name
  color: PhosphorColor;
  voltsPerDiv: number;
  offsetDivisions: number;
  enabled: boolean;
}

type PhosphorColor = 'p31-green' | 'p31-yellow' | 'p31-blue' | 'p31-white';

interface ScopeViewState {
  analysisType: AnalysisType;
  channels: ChannelConfig[];   // up to 4
  timePerDiv: number;          // seconds (tran) | log-decade (ac)
  triggerChannel: number;
  graticule: boolean;
}
```

### 4.7 Application settings (persisted)

```ts
// src/shared/types.ts
interface AppSettings {
  llm: LLMConfig | null;
  storageMode: 'session' | 'local';   // where to persist the API key
  language: 'en' | 'zh-CN';
}
```

### 4.8 Demo & sample assets

```ts
// src/shared/types.ts
interface SampleAsset {
  id: string;                  // e.g. 'rc-lowpass'
  svgPath: string;             // e.g. '/samples/rc-lowpass.svg'
  netlistPath: string;         // e.g. '/samples/rc-lowpass.net'
  cannedExplanation: {
    en: string;                // Markdown
    'zh-CN': string;           // Markdown
  };
}

// Demo mode state
type DemoStep = 'idle' | 'intro-animation' | 'transcribing' | 'simulating' | 'done';
```

### 4.9 Homework check

```ts
// src/features/spirit/types.ts
interface HomeworkField {
  label: string;               // e.g. "Expected τ (ms)"
  key: keyof CompactSummaryNumericFields;
  unit: string;
}

interface HomeworkCheckResult {
  field: HomeworkField;
  expected: number;
  actual: number | null;
  errorPct: number | null;
  pass: boolean;               // within 5% tolerance
  explanation: {
    en: string;
    'zh-CN': string;
  };
}
```

---

## 5. Feature Module Details

### 5.1 `features/capture`

- `CapturePanel.tsx` — renders the image preview, "Capture" and "Upload" buttons, and file size warning.
- `useCapture.ts` — manages `File` → `dataURL` → `imageBase64` conversion; client-side compression via Canvas `toDataURL('image/jpeg', 0.85)` if size > 5 MB.
- Public API: `{ CapturePanel, useCapture }`, `type { CapturedImage }`.

### 5.2 `features/transcribe`

- `TranscribePanel.tsx` — side-by-side photo / netlist view; "Transcribe" button; confidence note badge; "DEMO" badge in demo mode.
- `useTranscribe.ts` — calls `LLMAdapter.transcribeSchematic`, owns loading / error state; in demo mode accepts a pre-recorded markdown string instead of making a network call.
- `llm-response-parser.ts` — `parseNetlistFromResponse(raw: string): { netlist: string; note: string } | ParseFailure`. Extracts first fenced block tagged `spice` or plain ` ``` `. Used by both live transcription and Haunted Classics demo replay.
- Public API: `{ TranscribePanel, useTranscribe }`, `type { TranscribeState }`.

### 5.3 `features/netlist`

- `NetlistEditor.tsx` — **MVP:** a styled `<textarea>` with a line-number gutter (CSS counter) and error-highlight overlay using absolutely-positioned markers. CodeMirror 6 is a stretch upgrade path behind a feature flag.
- `netlist-parser.ts` — `parseNetlist(text: string): ParsedNetlist`. Pure function, no side effects.
- `netlist-validator.ts` — `validateNetlist(parsed: ParsedNetlist, dryRun: (nl: string) => Promise<string>): Promise<ValidationResult>`. Three-stage pipeline.
- `spice-mode.ts` — CodeMirror 6 `StreamLanguage` tokeniser (stretch; not required for MVP).
- Public API: `{ NetlistEditor, parseNetlist, validateNetlist }`, `type { ParsedNetlist, ValidationResult }`.

### 5.4 `features/simulate`

- `useSimulation.ts` — React hook that manages a singleton `Worker` reference, request queuing (only one simulation at a time), progress state, and result caching keyed by netlist hash.
- `sim.worker.ts` — Web Worker entry point; lazy-imports `eecircuit-engine`, runs `Simulation`, posts typed messages back.
- `result-summariser.ts` — `summariseResult(result: SimResult, type: AnalysisType): CompactSummary`. Pure function; logic is also mirrored (or imported via shared module) in `tools/spice-mcp/`.
- Public API: `{ useSimulation, summariseResult }`, `type { SimResult, CompactSummary, SimulationState }`.

### 5.5 `features/scope`

- `ScopeCanvas.tsx` — React wrapper; owns canvas ref, ResizeObserver, RAF loop, keyboard/touch handler for knobs; sets `data-has-trace="true"` after first draw; `data-testid="scope-canvas"`.
- `scope-renderer.ts` — `ScopeRenderer` class; `draw(state, simResult, timestamp)` called from RAF. Owns off-screen buffer for persistence/afterglow. Renders "No signal — summon a circuit" when `simResult` is null. Plays CRT power-on animation on first render.
- `phosphor-effects.ts` — `applyGlow`, `applyPersistence`, `applyScanlines`, `applyFlicker`. Each is a pure canvas operation, togglable. Exports `motionAllowed(): boolean`.
- `ScopeControls.tsx` — volts/div and time/div knobs (scroll wheel + drag + arrow-key keyboard support); channel enable/color pickers; aria-labels on all controls; min 44×44 px touch targets.
- Public API: `{ ScopeCanvas, ScopeControls }`, `type { ScopeViewState, ChannelConfig }`.

### 5.6 `features/spirit`

- `SpiritPanel.tsx` — Markdown renderer, "Ask the Spirit" button, offline badge, "DEMO" badge, loading skeleton, error with retry, homework check section.
- `useSpirit.ts` — calls `LLMAdapter.explainWaveform`, tracks loading / error state, falls back to offline explainer.
- `offline-explainer.ts` — `getOfflineExplanation(exampleId: string, language: 'en' | 'zh-CN'): string | null`. Returns pre-written Markdown for the six standard examples plus four Haunted Classics.
- `homework-check.ts` — `checkHomework(expected: Record<string, number>, summary: CompactSummary): HomeworkCheckResult[]`. Pure, offline rule-based comparison.
- Public API: `{ SpiritPanel, useSpirit }`.

### 5.7 `features/demo`

- `use-demo-seance.ts` — hook that orchestrates the Demo Séance: manages `DemoStep` state, injects canned assets into the transcribe/netlist/spirit pipeline, shows/hides DEMO badges.
- `DemoIntroOverlay.tsx` — CRT power-on animation overlay; "Skip" button; respects `prefers-reduced-motion`.
- `SAMPLE_ASSETS: SampleAsset[]` — manifest of the four sample SVGs + precomputed netlists + canned explanations.
- Public API: `{ useDemoSeance, DemoIntroOverlay }`.

### 5.8 `features/haunted`

- `HauntedGallery.tsx` — grid of four Haunted Classic cards; each shows aged-paper SVG thumbnail, title, historical blurb (bilingual), "Resurrect" button.
- `haunted-assets.ts` — manifest of the four classics: id, aged SVG path, recorded LLM response path, netlist path, bilingual blurb, canned explanation.
- Public API: `{ HauntedGallery }`.

---

## 6. Web Worker Architecture

```
Main Thread                          sim.worker.ts
────────────────────────────────     ───────────────────────────────────
useSimulation                        (lazy import eecircuit-engine)
  ├─ new Worker('./sim.worker.ts')
  │
  ├─ postMessage(SimulateRequest)  →  onmessage: SimulateRequest
  │                                    │
  │  ← SimulateProgress('loading')  ←  postMessage if WASM not yet loaded
  │                                    │  await import('eecircuit-engine')
  │  ← SimulateProgress('running')  ←  sim.start() + sim.setNetList()
  │                                    │  sim.runSim()
  │  ← SimulateResponse             ←  postMessage SimulateResponse
  │    OR SimulateError             ←  catch → postMessage SimulateError
```

The Worker keeps a single `Simulation` instance alive between runs. When a new netlist arrives it calls `sim.setNetList(netlist)` and `sim.runSim()` without re-creating the WASM instance.

---

## 7. CRT Oscilloscope Rendering

### 7.1 Rendering pipeline (per animation frame)

```
1. Clear back-buffer (with slight alpha < 1 for persistence decay)
2. If simResult is null: draw "No signal — summon a circuit" centred text
3. Draw graticule (10×8 divisions, centre ticks, phosphor tint grid)
4. For each enabled channel:
   a. Project data points into canvas coordinates (volts/div, time/div)
   b. Stroke path with phosphor colour
   c. Apply glow: two radial shadow passes (inner bright, outer dim halo)
5. Copy back-buffer to screen canvas
6. Overlay scanlines (horizontal semi-transparent lines every 2px)
7. Apply flicker: slight global alpha oscillation at ~0.5–2 Hz random walk
8. Draw labels and channel indicators
```

### 7.2 Phosphor colours

| Channel | Base hex | Glow colour |
|---|---|---|
| CH1 | `#39ff14` | `#39ff14` at 40% alpha |
| CH2 | `#aaff44` | `#aaff44` at 35% alpha |
| CH3 | `#ccff88` | `#ccff88` at 30% alpha |
| CH4 | `#e8ffbb` | `#e8ffbb` at 25% alpha |

### 7.3 Persistence / afterglow

The renderer maintains a secondary off-screen canvas (`persistCanvas`). Each frame, `persistCanvas` is drawn to `screenCanvas` with `globalAlpha = 0.85` before the new trace. When `prefers-reduced-motion` is active, `persistCanvas` is not used.

### 7.4 Performance budget

- 10k points × 4 channels = 40k `lineTo` calls per frame.
- Path is batched into a single `beginPath` / `stroke` per channel.
- If frame time exceeds 16 ms for two consecutive frames, `shadowBlur` is halved automatically.

### 7.5 Analysis-type views

| Analysis | X axis | Y axis | Notes |
|---|---|---|---|
| `.tran` | time (s) | voltage / current | up to 4 channels — **MVP required** |
| `.op` | — | — | node-voltage table — **MVP required** |
| `.ac` | log₁₀ frequency (Hz) | magnitude (dB) + phase (°) | dual-pane — nice to have |
| `.dc` | sweep variable | output variable | single channel — nice to have |

### 7.6 Empty and loading states

- **No result:** "No signal — summon a circuit" centred with phosphor styling; gentle CRT idle glow.
- **Loading:** "Summoning…" text with a CRT warm-up line animation.
- **Error:** "The spirits are restless" panel overlaid on the canvas with `<details>` for raw ngspice output.

---

## 8. LLM Adapter Design

### 8.1 Interface (`src/lib/llm/adapter.ts`)

```ts
interface LLMAdapter {
  transcribeSchematic(imageBase64: string, mimeType: string): Promise<string>;
  explainWaveform(
    netlist: string,
    summary: CompactSummary,
    language: 'en' | 'zh-CN',
  ): Promise<string>;
}
```

### 8.2 OpenAI-compatible adapter (covers Qwen-VL, OpenAI, Gemini)

- POST to `${baseUrl}/chat/completions`
- System prompt: instructs model to output exactly one fenced `spice` code block followed by a confidence note.
- Image passed as `{ type: 'image_url', image_url: { url: 'data:{mimeType};base64,{imageBase64}' } }`.
- `explainWaveform` sends netlist + JSON-serialised summary; system prompt requests undergraduate-level explanation + one "try next" suggestion, in the requested language.
- `model` field defaults to preset value; user can override.

### 8.3 Anthropic adapter (stretch)

- POST to `https://api.anthropic.com/v1/messages`
- Image passed as `{ type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } }`.
- Same prompt structure as OpenAI adapter.

### 8.4 LLM response parsing (`features/transcribe/llm-response-parser.ts`)

```
1. Find first occurrence of ```spice or ``` (case-insensitive)
2. Extract content up to closing ```
3. Trim whitespace
4. Look for any text after the closing ``` as the confidence note
5. Return { netlist: string, note: string } | { error: 'no-fence' | 'empty-fence' }
```

This same parser is used by Haunted Classics demo replay (replaying a stored `.md` response file) so the full parsing pipeline is exercised without a real LLM call.

---

## 9. SPICE MCP Server (`tools/spice-mcp/`)

The MCP server is a dev-time tool only; it is never bundled into the static build.

```
tools/spice-mcp/
├── index.mjs          # MCP server entry point (Node ESM)
├── simulate.mjs       # wraps eecircuit-engine (Node build or child process)
├── summarise.mjs      # summariser logic (mirrors result-summariser.ts)
├── explain.mjs        # rule-based bilingual explainer
└── package.json       # { "type": "module", "dependencies": { "@modelcontextprotocol/sdk": "..." } }
```

Registered in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "spice": {
      "command": "node",
      "args": ["tools/spice-mcp/index.mjs"],
      "disabled": false
    }
  }
}
```

**Tool schemas:**

```ts
// simulate_netlist
input:  { netlist: string }
output: { analysisType: string; variableNames: string[]; summary: CompactSummary; errors: string[] }

// explain_waveform
input:  { netlist: string; summary: CompactSummary }
output: { en: string; 'zh-CN': string }
```

Kiro uses these tools during development to verify every bundled/example netlist simulates correctly and that its compact summary matches its canned explanation within expected tolerances.

---

## 10. Haunted Classics Assets

```
src/examples/haunted/
├── 555-astable/
│   ├── recorded-response.md    # LLM-style markdown: ```spice ... ``` + confidence note
│   ├── netlist.net             # ngspice-compatible (behavioural model)
│   ├── schematic.svg           # aged-paper SVG
│   ├── blurb-en.md
│   └── blurb-zh.md
├── passive-rc/
│   └── ...
├── wien-bridge/
│   └── ...
└── opamp-integrator/
    └── ...
```

The aged-paper SVG style uses: sepia `<feColorMatrix>` filter, slight `skewX` + `rotate` transform (≤ 2°), typewriter-style font (e.g. `Courier New`), coffee-stain texture as an `<feTurbulence>` + `<feComposite>` overlay.

---

## 11. i18n Strategy

- String keys are defined once in `src/app/i18n/en.ts` and mirrored in `zh-CN.ts`.
- A lightweight `useTranslation()` hook reads the active locale from `AppSettings.language`.
- No external i18n library is required for the MVP (plain `Record<string, string>` lookup).
- All user-visible strings — including error messages, ARIA labels, spirit prompts, and homework check feedback — must have entries in both locale files.

---

## 12. Error Handling Strategy

| Error source | Handler location | User presentation |
|---|---|---|
| Netlist syntax error | `netlist-validator.ts` | Error markers in editor + validation panel |
| ngspice element/node error | `netlist-validator.ts` | "Spirits are restless" panel, collapsible raw error |
| ngspice runtime error | `sim.worker.ts` → `SimulateError` | Same panel; if pattern recognised → suggest fix |
| LLM network / auth error | `useTranscribe` / `useSpirit` | Toast or inline error message with specific reason |
| LLM response parse failure | `llm-response-parser.ts` → typed error | "Spirit could not read circuit" + manual entry prompt |
| Image too large | `useCapture.ts` | Warning in capture panel; auto-compress |
| Browser unsupported (no File API) | `CapturePanel.tsx` | Static unsupported-feature notice |
| Empty scope (no result) | `scope-renderer.ts` | "No signal — summon a circuit" on canvas |

All errors must be logged to `console.error` in development mode and shown as friendly messages in production. An `aria-live="polite"` region in `App.tsx` receives all status/error updates.

---

## 13. Settings & Key Storage

- `sessionStorage` (default): key survives page refresh but not browser close.
- `localStorage` (opt-in): persists across sessions; user explicitly enables with "Remember across sessions" toggle.
- Default provider preset: **Qwen-VL (DashScope)** with pre-filled `baseUrl` and `model`.
- The key is never included in URLs, query strings, Vite env files, or source code.
- The key is masked after entry (`sk-…last4`). The full key is read from storage only at the moment of an LLM request.

---

## 14. Folder / File Checklist

```
src/
├── app/
│   ├── App.tsx
│   ├── router.tsx
│   └── i18n/
│       ├── en.ts
│       └── zh-CN.ts
├── features/
│   ├── capture/
│   │   ├── index.ts
│   │   ├── CapturePanel.tsx
│   │   └── use-capture.ts
│   ├── transcribe/
│   │   ├── index.ts
│   │   ├── TranscribePanel.tsx
│   │   ├── use-transcribe.ts
│   │   └── llm-response-parser.ts
│   ├── netlist/
│   │   ├── index.ts
│   │   ├── NetlistEditor.tsx      ← MVP: styled textarea; CM6 stretch
│   │   ├── spice-mode.ts          ← stretch
│   │   ├── netlist-parser.ts
│   │   ├── netlist-validator.ts
│   │   └── types.ts
│   ├── simulate/
│   │   ├── index.ts
│   │   ├── use-simulation.ts
│   │   ├── sim.worker.ts
│   │   ├── result-summariser.ts
│   │   └── worker-protocol.ts
│   ├── scope/
│   │   ├── index.ts
│   │   ├── ScopeCanvas.tsx
│   │   ├── ScopeControls.tsx
│   │   ├── scope-renderer.ts
│   │   ├── phosphor-effects.ts
│   │   └── types.ts
│   ├── spirit/
│   │   ├── index.ts
│   │   ├── SpiritPanel.tsx
│   │   ├── use-spirit.ts
│   │   ├── offline-explainer.ts
│   │   ├── homework-check.ts
│   │   └── types.ts
│   ├── demo/
│   │   ├── index.ts
│   │   ├── use-demo-seance.ts
│   │   ├── DemoIntroOverlay.tsx
│   │   └── sample-assets.ts
│   └── haunted/
│       ├── index.ts
│       ├── HauntedGallery.tsx
│       └── haunted-assets.ts
├── lib/
│   └── llm/
│       ├── adapter.ts
│       ├── openai.ts              ← covers Qwen/DashScope, OpenAI, Gemini
│       ├── anthropic.ts           ← stretch
│       └── factory.ts
├── examples/
│   ├── rc-lowpass.net
│   ├── rl.net
│   ├── rlc-ringing.net
│   ├── diode-rectifier.net
│   ├── bjt-common-emitter.net
│   ├── opamp-inverting.net
│   └── haunted/
│       ├── 555-astable/
│       │   ├── recorded-response.md
│       │   ├── netlist.net
│       │   ├── schematic.svg
│       │   ├── blurb-en.md
│       │   └── blurb-zh.md
│       ├── passive-rc/
│       ├── wien-bridge/
│       └── opamp-integrator/
└── shared/
    ├── types.ts
    └── utils.ts
public/
└── samples/
    ├── rc-lowpass.svg
    ├── rlc-ringing.svg
    ├── diode-rectifier.svg
    └── opamp-inverting.svg
tools/
└── spice-mcp/
    ├── index.mjs
    ├── simulate.mjs
    ├── summarise.mjs
    ├── explain.mjs
    └── package.json
tests/
├── unit/
│   ├── features/
│   │   ├── netlist/
│   │   │   ├── netlist-parser.test.ts
│   │   │   ├── netlist-parser.property.test.ts  (fast-check)
│   │   │   └── netlist-validator.test.ts
│   │   ├── simulate/
│   │   │   └── result-summariser.test.ts
│   │   ├── transcribe/
│   │   │   └── llm-response-parser.test.ts
│   │   └── spirit/
│   │       └── homework-check.test.ts
│   └── lib/
│       └── llm/
│           └── adapters.test.ts
├── e2e/
│   └── smoke.spec.ts
└── fixtures/
    └── netlists/
        └── (example netlists for tests)
docs/
└── spice-mcp.md
```

---

## 15. Testing Strategy

### Unit tests (Vitest)

| File | Coverage target |
|---|---|
| `netlist-parser.test.ts` | ≥ 20 representative lines; component types, node names, directives, comments |
| `netlist-parser.property.test.ts` | fast-check: `serialise(parse(nl)) === normalise(nl)` for well-formed inputs |
| `netlist-validator.test.ts` | accepts valid; rejects missing-ground, floating nodes, bad directives |
| `result-summariser.test.ts` | τ, rise-time, overshoot, –3 dB freq against known fixtures |
| `llm-response-parser.test.ts` | fenced-block extraction, no-fence error, empty-fence error |
| `homework-check.test.ts` | correct pass/fail for τ, −3 dB freq within ±5%; error percentage calculation |

### End-to-end (Playwright)

`smoke.spec.ts`:
1. Navigate to `http://localhost:5173`.
2. Click the RC low-pass example.
3. Wait for `[data-testid="scope-canvas"]` to be visible and for `[data-testid="sim-status"]` to contain "complete".
4. Assert the canvas `data-has-trace="true"` attribute is set.

### CI requirements

- `npm test` (Vitest single-run) must pass before merge.
- `npm run lint` must pass before merge.
- Playwright smoke test runs on the built bundle.
