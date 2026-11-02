---
inclusion: always
---

# Circuit Séance — Project Structure Steering

## Folder Layout

```
circuit-seance/
├── public/                        # Static assets (favicon, fonts, etc.)
├── src/
│   ├── app/                       # Shell: root component, routing, i18n setup
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── i18n/
│   │       ├── en.ts
│   │       └── zh-CN.ts
│   ├── features/
│   │   ├── capture/               # Camera capture and image file upload
│   │   ├── transcribe/            # Vision LLM → SPICE netlist
│   │   ├── netlist/               # CodeMirror editor, parser, validator
│   │   ├── simulate/              # Web Worker + eecircuit-engine wrapper
│   │   ├── scope/                 # CRT oscilloscope Canvas renderer
│   │   └── spirit/                # AI waveform explanation UI
│   ├── lib/
│   │   └── llm/                   # Provider-agnostic LLM adapter interface + impls
│   │       ├── adapter.ts         # LLMAdapter interface
│   │       ├── openai.ts          # OpenAI-compatible adapter
│   │       └── anthropic.ts       # Anthropic Claude adapter
│   ├── examples/                  # Bundled example netlists (*.net or *.sp)
│   │   ├── rc-lowpass.net
│   │   ├── rl.net
│   │   ├── rlc-ringing.net
│   │   ├── diode-rectifier.net
│   │   ├── bjt-common-emitter.net
│   │   └── opamp-inverting.net
│   └── shared/                    # Truly cross-cutting: types, utils, constants
│       ├── types.ts
│       └── utils.ts
├── tests/
│   ├── unit/                      # Vitest unit tests (mirrors src/ structure)
│   └── e2e/                       # Playwright end-to-end tests
├── docs/                          # Architecture notes, spike results, ADRs
│   └── kiro-runs/
├── .kiro/
│   ├── steering/
│   └── hooks/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── prettier.config.js
└── package.json
```

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files & folders | kebab-case | `scope-renderer.ts`, `capture/` |
| React components | PascalCase file + export | `ScopeCanvas.tsx` |
| Hooks | camelCase, `use` prefix | `useSimulation.ts` |
| Types / interfaces | PascalCase | `SimResult`, `LLMAdapter` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_NETLIST_BYTES` |
| Test files | same name + `.test.ts(x)` | `netlist-parser.test.ts` |

## Import Rules

- `features/*` may import from `src/lib/*` and `src/shared/*`.
- Features **must not** import directly from another feature's internals. Cross-feature communication goes through each feature's public `index.ts` barrel file.
- `src/lib/*` must not import from `src/features/*`.
- `src/app` may import from any feature's public index.
- Absolute imports use the `@/` alias (configured in `vite.config.ts` and `tsconfig.json`), e.g. `import { parse } from '@/features/netlist'`.

## Where Tests Live

- Unit tests: `tests/unit/` mirroring the `src/` structure (e.g. `tests/unit/features/netlist/parser.test.ts`).
- E2E tests: `tests/e2e/` (e.g. `tests/e2e/smoke.spec.ts`).
- Test utilities and fixtures: `tests/fixtures/` and `tests/helpers/`.

## Feature Public API Pattern

Each feature folder exposes a single barrel:

```ts
// src/features/netlist/index.ts
export { NetlistEditor } from './netlist-editor';
export { parseNetlist } from './parser';
export { validateNetlist } from './validator';
export type { ParsedNetlist } from './types';
```

Nothing outside `netlist/` imports from sub-paths like `./parser` directly.
