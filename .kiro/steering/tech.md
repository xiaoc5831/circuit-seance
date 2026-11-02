---
inclusion: always
---

# Circuit Séance — Tech Steering

## Stack

| Layer | Choice |
|---|---|
| Bundler / dev server | Vite (latest) |
| UI framework | React 18 |
| Language | TypeScript — **strict mode** |
| Package manager | npm |
| License | MIT |
| Deployment target | Static site (GitHub Pages / Vercel / Netlify) |

## Simulation Engine

Package: `eecircuit-engine` (MIT, ngspice 45.2 compiled to WASM).

```ts
import { Simulation } from 'eecircuit-engine';

const sim = new Simulation();
await sim.start();
sim.setNetList(netlistText);
const result = await sim.runSim();
// result: { header, numVariables, variableNames, numPoints,
//            dataType: 'real' | 'complex',
//            data: [{ name, type, values }] }
```

- Always run `Simulation` inside a **Web Worker** so the UI thread never blocks.
- LLM-generated netlists must be validated (parse + ngspice dry run) before the full simulation is triggered.

## Scope Renderer

- HTML Canvas 2D (prefer) or WebGL if phosphor persistence demands it.
- No heavy charting libraries for the oscilloscope trace; the CRT aesthetic requires custom rendering.
- Effects to implement: phosphor persistence trails, green glow, subtle flicker, scanlines.

## Netlist Editor

- CodeMirror 6 with a custom lightweight SPICE syntax mode.
- Mode should cover: component lines, `.tran` / `.ac` / `.dc` / `.op` directives, `.model`, `.subckt`, comments (`;` and `*`).

## LLM Adapter Interface

Provider-agnostic; callers depend on the interface, not the concrete adapter.

```ts
interface LLMAdapter {
  transcribeSchematic(imageBase64: string, mimeType: string): Promise<string>; // returns netlist
  explainWaveform(netlist: string, simResult: SimResult): Promise<string>;     // returns markdown
}
```

First adapters to implement:
1. **OpenAI-compatible** — chat completions with image input (GPT-4o-class); base URL configurable.
2. **Anthropic Claude** — Messages API with image input.

All LLM calls originate in the browser using the user's own key, or via an optional thin serverless proxy.

## Testing

| Tool | Purpose |
|---|---|
| Vitest | Unit tests: netlist parsing/validation, result transforms |
| Playwright | One end-to-end smoke test |
| fast-check | Property tests for the netlist parser (welcome, not required) |

Run tests with `npm test` (Vitest in single-run mode for CI).

## Lint / Format

- ESLint with TypeScript rules.
- Prettier for formatting.
- Run `npm run lint` to check; CI must pass lint before merge.

## Common Commands

```sh
npm run dev      # Vite dev server
npm run build    # Production build
npm test         # Vitest (single run)
npm run lint     # ESLint + Prettier check
```

## Key Constraints

- **No server-side simulation** — WASM runs fully client-side.
- **No secrets in source** — API keys live in browser storage only; never commit keys.
- Prefer exact / pinned dependency versions over open ranges.
- TypeScript `strict: true` is non-negotiable; no `any` escapes without a comment explaining why.
