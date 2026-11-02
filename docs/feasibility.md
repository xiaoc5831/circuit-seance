# Feasibility notes (2026-11-02)

## ngspice in WebAssembly: confirmed

- Package: [`eecircuit-engine`](https://www.npmjs.com/package/eecircuit-engine) v1.9.0, MIT, by Danial Chitnis (repo: https://github.com/eelab-dev/EEcircuit-engine). It is about 43 MB unpacked, mostly the WASM and model cards.
- Engine string reported: `ngspice-45.2`.
- Test: `spikes/rc-transient.mjs` on Node 22.23. The circuit is a 5 V pulse into 1 kΩ / 1 µF (τ = 1 ms), `.tran 10u 5m`.
  - Init plus run took about 670 ms. Output had 527 points and the variables `time, v(in), v(out), i(v1)`.

| t | v(out) ngspice | 5(1−e^(−t/τ)) |
|---|---|---|
| 1 ms | 3.1746 | 3.1606 |
| 2 ms | 4.3285 | 4.3233 |
| 3 ms | 4.7530 | 4.7511 |
| 5 ms | 4.9663 | 4.9663 |

  The small differences come from sampling the first point at or after t, not from the solver.
- API: `new Simulation(); await sim.start(); sim.setNetList(txt); await sim.runSim()`. It returns `{header, numVariables, variableNames, numPoints, dataType, data[{name,type,values}]}`. AC results are complex `{real, img}`.
- The same package runs EEcircuit (https://eecircuit.com) in the browser, so it works in browsers too. Wrap it in a Web Worker and lazy-load it.

## Vision LLM options (bring your own key; nothing purchased)

All of these accept an image together with text. One OpenAI-compatible adapter covers most of them:

| Provider | API style | Notes |
|---|---|---|
| Alibaba Qwen-VL (DashScope / Model Studio) | OpenAI-compatible (`/compatible-mode/v1`) | Reachable directly from mainland China, low cost (Qwen3-VL-Plus listed at about $0.20 in / $1.60 out per 1M tokens), strong OCR. **Recommended default for CN users.** https://www.alibabacloud.com/help/en/model-studio/qwen-vl-compatible-with-openai |
| OpenAI GPT-4o-class / GPT-5-class | OpenAI chat completions with `image_url` | The most widely compatible option. https://developers.openai.com/api/docs/guides/images-vision |
| Google Gemini | OpenAI-compatible endpoint or native API | Good vision quality; has a free tier. |
| Anthropic Claude (Sonnet) | Messages API with image blocks | Strong at reasoning over diagrams. Browser calls need the `anthropic-dangerous-direct-browser-access` header, or a proxy. |

Prices are from third-party listings (therouter.ai, aimlapi.com) seen on 2026-11-02. Check them before relying on them. Model names change quickly, so the adapter takes model id and base URL as settings.
