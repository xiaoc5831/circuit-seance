# 👻 Circuit Séance · 电路招魂

> *Summon Berkeley SPICE (1973) back from the dead — in your browser.*

**Kiroween 2026 · Resurrection category**

Circuit Séance turns a photo of a hand-drawn circuit schematic into a live simulation:

1. 📷 **Capture** — photograph or upload your hand-drawn schematic.
2. 🔮 **Transcribe** — a vision LLM reads it and writes a SPICE netlist, which you can review and edit.
3. ⚡ **Resurrect** — [ngspice](https://ngspice.sourceforge.io/) compiled to WebAssembly runs the simulation entirely in your browser. No server, no license, no install.
4. 📺 **Haunt** — waveforms glow on a green-phosphor CRT oscilloscope (persistence, bloom, flicker).
5. 🕯️ **Explain** — the oscilloscope's resident spirit explains the waveform in plain language (English / 简体中文) and suggests what to try next.

Built for EE students learning circuits without access to lab gear or expensive tools.

## Status

🚧 **Spec phase.** The steering and the feature spec were written with [Kiro](https://kiro.dev) and live in [`.kiro/`](.kiro):

- `.kiro/steering/` — product, tech, and structure steering
- `.kiro/specs/circuit-seance/` — `requirements.md` (EARS), `design.md`, `tasks.md`

How Kiro was used is logged in [`docs/kiro-usage-log.md`](docs/kiro-usage-log.md).

## Tech

- Vite + React + TypeScript
- [`eecircuit-engine`](https://github.com/eelab-dev/EEcircuit-engine) (MIT) — ngspice 45.2 → WebAssembly, run in a Web Worker
- Bring-your-own-key vision LLM (OpenAI-compatible endpoints incl. Qwen-VL / Gemini, or Anthropic Claude); keys stay in your browser
- Bundled example circuits work with no API key

## Feasibility spike

`spikes/rc-transient.mjs` runs a 1 kΩ / 1 µF RC step response through ngspice-WASM in Node 22 and compares it with 5·(1−e^(−t/RC)):

```bash
npm i eecircuit-engine && node spikes/rc-transient.mjs
```

## License

[MIT](LICENSE) © 2026 Cao Xiaoqing
