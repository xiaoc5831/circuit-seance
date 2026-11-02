# Judge pass 2: 2026-11-03 (after the pass-1 fixes)

Same method as pass 1: a fresh profile, the README quickstart, every tab, the broken-netlist path, Chinese, phone width with reduced motion, then `.kiro/` and the Kiro log. On top of that I re-ran the full verification:

- `npm test`: **105 / 105** pass (unit + an integration suite that runs every bundled circuit through real ngspice WASM)
- Playwright: **12 / 12** pass (10 smoke + 2 BYOK against a mocked provider). Waveform at **≈ 8.4–8.7 s after first load, intro included**. Zero non-localhost requests in demo mode.
- `npm run build`: clean (`tsc -b` strict). `npm run lint` (type-aware ESLint on `src/`): clean.
- `node scripts/verify-examples.mjs src/examples src/features/haunted/netlists`: all 10 netlists OK.
- CORS preflight from a GitHub Pages origin: DashScope (`*`), OpenAI and Gemini all allow `POST` with `authorization, content-type`.
- All 12 screenshots re-shot and inspected by eye: no overflow, truncation or low-contrast text. The NE555 now fills the screen.

## What changed since pass 1

| Gap (pass 1) | Status |
|---|---|
| Live BYOK path never exercised | **Fixed.** `tests/e2e/live-mock.spec.ts` uploads a photo, checks the vision request (model `qwen-vl-max`, `Bearer` key) and the text request (`qwen-plus`), simulates the returned netlist, and checks the live spirit renders with the model's `<script>` escaped. A 401 shows "The provider rejected the API key." Still not tested against a **real** key and a real photo. |
| No hosted demo | **Ready, not live.** `.github/workflows/pages.yml` (test → lint → build with the repo base path → Pages). A base-path build was verified locally. Goes live on the first push, which waits on the owner. |
| No video / Devpost story | **Drafted.** `docs/devpost-submission.md`, `docs/video/script.md` (2:52) and `docs/video/circuit-seance.en.srt` (27 cues, validated). Recording waits on the owner. |
| 555 filled 60 % of the screen | **Fixed** (1 ms window; numbers re-verified). |
| Built-during-event statement | **Drafted** in the Devpost doc (dates need a check against LaunchPad's window). |
| Historical blurbs over-claimed (555 "billions per year", "Hewlett's master's thesis", Disney bought the "200A") | **Fixed:** now "around a billion a year by the 2000s", "1939 Stanford thesis", and Disney bought eight **200B**s. |
| Spirit said "settles at 4.87 V" for a curve still rising | **Fixed:** "still settling at the end of the window". |
| MCP server, Kiro ownership review, tasks.md sync | **Deferred (credits).** Queued in `docs/next-kiro-passes.md`. |

## Kiroween 2026 (Resurrection), scores

| Criterion | Pass 1 | Pass 2 | Why it moved, or why it didn't |
|---|---:|---:|---|
| **Potential Impact** | 7 | **7** | The BYOK path is now proven against a mock, but a judge still sees only recorded transcriptions unless they bring a key. Real-photo accuracy of Qwen-VL on messy student drawings is *unmeasured*, and that's the claim that matters most. |
| **Technological Implementation** | 8 | **8** | More coverage (12 e2e, mocked live path, CORS checked) and one more correctness fix. Still missing the MCP server; the key sits in React state; `useTranscribe` is dead code. |
| **Design** | 8 | **8** | The 555 fixes a visible flaw, and the copy is more precise. The schematic thumbnails are still too small to read, and there's no phase trace on the Bode plot. |
| **Innovation** | 7 | **7** | Unchanged. The idea is the same. |
| **Presentation** | 5 | **6** | The README, Devpost story, video script, SRT and Pages workflow are all ready. But with no recorded video, no public repo and no live URL yet, a judge would still have nothing to click. Once those three exist I'd expect 8. |
| *Kiro use (weighted)* | 6 | **6** | Unchanged on purpose: no Kiro credits were spent on fixes. The honest disclosure helps credibility but not the score. The SPICE MCP server plus a Kiro review pass would be the biggest single lift (→ 8). |

**Weighted (Impact/Kiro/Design/Innovation/Presentation, 20 % each): 6.8 / 10** (pass 1: 6.6).

## LaunchPad Hacks

| Axis | Pass 1 | Pass 2 |
|---|---:|---:|
| Usefulness | 7 | 7 |
| Technical difficulty | 8 | 8 |
| Design / UX | 8 | 8 |
| Completeness | 6 | 7 (live path tested against a mock; deploy pipeline ready) |
| Presentation | 5 | 6 |
| Built-during-event statement | ⚠️ | Drafted; check the dates |

## What would move the scores most (in order)

1. **The owner records the video and pushes the public repo**, which makes Pages go live automatically → Presentation +2.
2. **One real-key session**: photograph 3–4 real hand-drawn circuits, run them through Qwen-VL, and put the honest hit rate in the README and video → Impact +1, and gives real footage for scene 8.
3. **Kiro pass 12 (SPICE MCP server) + pass 13 (ownership review)** on the credit grant → Kiro use +2, Technical +1.
4. Bigger, readable schematic thumbnails and a phase trace on the Bode plot → Design +1. Small; good for Kiro task waves.
