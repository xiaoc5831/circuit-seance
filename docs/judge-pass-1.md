# Judge pass 1: 2026-11-03 (after the UI landed, before fixes)

I played a strict judge: read the README cold, ran the judge quickstart in a fresh Chromium profile, clicked every tab, broke the netlist, switched to Chinese, ran it at 390 px with reduced motion, and read `.kiro/` plus the Kiro log. The scores below are for the repo **as it stood at commit `b9d0c01` plus the README**.

## Kiroween 2026 (Resurrection)

Per the Kiroween page as researched on 2026-11-02, judging weights Impact, Kiro use, Design, Innovation and Presentation at 20 % each. The brief asked for the five criteria below; I score Kiro use separately because it is weighted.

| Criterion | Score | Why |
|---|---:|---|
| **Potential Impact** | 7 | A real gap: EE students with a textbook but no scope or SPICE licence. It works on a phone, bilingual EN/中文, needs no install, and the homework check makes it a study tool rather than a toy. Held back because the headline promise (*photo of your own drawing → netlist*) is shown only with **recorded** responses. The live path had never run end-to-end, not even against a mock, so a judge has to take it on trust. |
| **Technological Implementation** | 8 | Real ngspice 45 in WASM, in a worker that handles the engine's nasty failure modes (non-ASCII hang, double-engine hang, silent failure, timeouts). Measurement with a three-point τ fit, an integration test that checks every number the spirit quotes against the real engine, 105 unit/integration tests, 10 Playwright tests including a zero-external-request assertion. Held back: SPICE MCP server not built (deferred), the API key lives in React state, `useTranscribe` is dead code, and the 555 trace filled only 60 % of the screen (time window vs 1-2-5 time/div). |
| **Design** | 8 | A coherent green-phosphor CRT language: persistence, beam sweep, bezel, scanlines, VT323 display type, amber/cyan channel colours, aged-paper classics. Every state is designed (intro, NO SIGNAL, waking, summoning, restless spirits with hint + raw output, live-LLM loading and error). Keyboard, reduced motion and contrast all handled. Held back: schematic thumbnails are too small to read, and mobile needs a scroll to reach the netlist. |
| **Innovation** | 7 | The parts exist separately (SPICE in the browser, vision LLMs, CRT shaders). The new things are the full loop *drawing → SPICE → explained waveform → check your homework*, and **Haunted Classics** (historic circuits re-simulated with their history attached). An LLM explainer is a familiar idea, but an offline spirit that quotes measured numbers is less so. |
| **Presentation** | 5 | The README is strong and honest, with screenshots. But there is **no video, no hosted URL, no public repo yet**, and no Devpost story. A judge can't try it without cloning and building, which takes about 2 minutes plus a 20 MB engine download. |
| *Kiro use (weighted)* | 6 | Steering, `--mode spec` with EARS, an amendment run, headless task waves, four hooks with 126 recorded hook events (including an agent hook reviewing LLM code), and transcripts for every run. But a **large share of the shipped code is hand-written** (disclosed), the MCP server is deferred, and `tasks.md` is only partly synced (run 10 was killed). |

**Weighted (6 × 20 %, Impact/Kiro/Design/Innovation/Presentation): 6.6 / 10.**

## LaunchPad Hacks

Students only, beginner-friendly. Entries must state what was built **during** the event and what came **before**. I haven't checked LaunchPad's exact rubric, so I scored the usual Devpost axes.

| Axis | Score | Note |
|---|---:|---|
| Usefulness | 7 | Same as Impact |
| Technical difficulty | 8 | WASM SPICE + worker + Canvas renderer + LLM BYOK |
| Design / UX | 8 | |
| Completeness | 6 | The demo path is complete. The live path is unverified, and there's no hosted demo |
| Presentation | 5 | No video or Devpost text yet |
| Built-during-event statement | ⚠️ | Must be written. Everything here was created from 2026-11-02 on. Check that this is inside LaunchPad's submission window. |

## Top gaps and what I can fix now (not blocked on credits or keys)

| # | Gap | Fixable now? | Action |
|---|-----|--------------|--------|
| 1 | Live BYOK path never exercised | **Yes** (without a real key) | Playwright test with a mocked OpenAI-compatible DashScope endpoint: upload photo → vision request (checks model, auth header) → netlist → simulate → live spirit (checks the model's `<script>` is escaped). Plus a 401 → friendly error test. Also check that DashScope, OpenAI and Gemini all allow browser CORS (preflight from a GitHub Pages origin). |
| 2 | No hosted demo | Partly | Add a GitHub Pages workflow (test + lint + build with the right base path) so the site goes live the moment the repo is pushed. Pushing waits on the owner. |
| 3 | No video or Devpost story | **Yes** | Write the Devpost story, a < 3 min video script and an English `.srt`. |
| 4 | 555 trace fills 60 % of the screen | **Yes** | Lengthen the transient to 1 ms so 100 µs/div fills all 10 divisions. Re-verify the numbers. |
| 5 | Built-during-event statement | **Yes** | Put it in the Devpost draft. |
| 6 | MCP server, Kiro ownership review, tasks.md sync | No: needs credits | Queued in `docs/next-kiro-passes.md`. |
| 7 | Real-key smoke test of Qwen-VL on a real photo | No: needs the owner's key | Listed for the owner. |
| 8 | API key in React state; dead `useTranscribe` | Could, low value | Disclosed; left for Kiro pass 13. |
