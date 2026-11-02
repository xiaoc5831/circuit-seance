# Judge pass 3: 2026-11-03 (polish round 3, no Kiro runs)

Same method as passes 1 and 2: a fresh profile, the README quickstart, every tab, the broken-netlist path, Chinese, phone width with reduced motion, then `.kiro/` and the Kiro log. This time I also watched the auto-recorded video end to end (and checked 30+ extracted frames), and judged against the rules page as published (https://kiroween.devpost.com/rules, read 2026-11-03).

## Verification

- `npm test`: **134 / 134** (was 105): +25 possess unit tests, +2 settings tests, +2 engine-backed possess cases in the integration suite (C1 × 2.2 → τ 2.2 ms; ÷10 → 100 µs; NE555 RB 4.7 k → f ≈ 1.44/((RA+2RB)C)).
- Playwright, Chromium: **13 / 13** (9 smoke + 2 BYOK-mock + 2 possess). **Firefox 131: 13 / 13** (new; `PW_FIREFOX=1`). The phone test drops `isMobile` there because Playwright's Firefox has no mobile emulation.
- `npm run build` (strict `tsc -b`) and `npm run lint`: clean.
- Demo mode: still zero non-localhost requests, both in the e2e guard and during the video recording (`docs/demo/scenes.json` → `"external": []`).
- Video: `docs/demo/circuit-seance-demo.mp4`, **2:12**, 1920×1080 H.264 + AAC (a quiet generated drone, no third-party music), English captions burned in. I checked the frames at every caption: readable, nothing important under a caption (the possess and homework captions sit at the top because their action is at the bottom), and the numbers on screen match the captions (C1 2.19 µF → τ 2.19 ms ×2.19; 100 nF → 100 µs; "off by −50.0 %").

## What changed since pass 2

| Gap (pass 2) | Status |
|---|---|
| No recorded video | **Fixed.** `tools/record-demo.mjs` records the real app with Playwright: séance intro → hand-drawn RC read into a netlist → CRT → cursor → spirit → **possess C1** → homework catches a wrong τ, then passes → NE555 + Wien bridge → 中文 → BYOK settings → a Kiro viewer rendered from the real `.kiro/` files and transcript hook counts → title card. Captions use the measured scene times. Re-runnable: `node tools/record-demo.mjs` (or `--encode-only`). |
| Innovation unchanged (same idea) | **New feature: possess a component.** Click any R, C or L and drag it ÷10 … ×10. ngspice re-runs live through the one worker, the CRT holds its scales, the original trace stays as a dashed ghost, and a before → now readout of the measured τ / f / f₋₃dB follows. Works for all 10 bundled circuits, in both languages, and on a phone. |
| Key sat in React state | **Fixed.** App state holds only `hasKey` + provider; `liveAdapter()` reads `localStorage` per request. Unit-tested. |
| `useTranscribe` dead code | **Fixed by wiring it in** (photo flow). It now aborts a superseded request, which the old inline code didn't. |
| Firefox untested | **Fixed.** Full e2e suite green in Firefox 131. Safari is still unchecked. |
| Story for the audience | README + Devpost now lead with the EE-student case (homework/lab self-check, ±5 %, EN + 中文, offline / works in China, zero install). |
| Bonus prizes | `docs/blog-post.md` (mentions Kiroween 2026, honest about hand-written parts), `docs/social-posts.md` (3 drafts, each **starting with `#KiroweenHackathon26`**), plus a bonus checklist in the Devpost draft that flags **Best Student Project**, which the owner qualifies for and which pass 2 missed. |
| Found in this pass: slider drag ran at ~2 fps without a GPU (canvas `shadowBlur` = 100–300 ms per frame) | **Fixed.** Adaptive blur-free glow after 3 slow frames (drag step 420 → 135 ms in the sandbox). |
| Found in this pass: on a 900 px-tall laptop the scope pushed the possess slider off-screen | **Fixed.** Screen width is capped by viewport height, so screen, knobs and slider fit one view. |
| Found in this pass: if a possessed value made a run fail, the possess panel vanished and you couldn't release | **Fixed.** The panel stays while possessed. |
| SPICE MCP server, Kiro review pass, tasks.md sync | **Still deferred (credits).** Unchanged on purpose, see `docs/next-kiro-passes.md`. |

## Kiroween 2026 (Resurrection) scores

| Criterion | P1 | P2 | **P3** | Why |
|---|---:|---:|---:|---|
| **Potential Impact** | 7 | 7 | **8** | Now a specific, credible use: an EE student checks a homework answer and sees *why* by possessing the part. Works offline and in China, in both languages, with no install. Not 9 because the vision path (photo → netlist) is still unmeasured on real, messy student drawings, and that's the step that makes it "your own homework". |
| **Technological Implementation** | 8 | 8 | **8** | Solid engineering (one engine, latest-wins, measured physics pinned by engine tests, two browsers, adaptive rendering). But the rubric's emphasis is *how Kiro was used*, and no new Kiro work happened. |
| **Design** | 8 | 8 | **8** | Possess UI is coherent with the CRT (amber = possessed, dashed ghost, before → now readout), and the laptop-height fit helps. Holding at 8: the schematic thumbnails are still small and there's no Bode phase trace. |
| **Innovation** | 7 | 7 | **8** | "Possess a component" with a ghost of the previous trace plus a measured readout is a genuinely new interaction for browser SPICE, and it fits the séance theme instead of being bolted on. |
| **Presentation** | 5 | 6 | **8\*** | A real end-to-end video now exists: memorable opening, every feature, the Kiro story, and an honest ledger, all inside 2:12. \*Conditional: it only counts once it's on YouTube with a public repo + live URL. Without those, 6. Not 9: captions only, no voice-over, and no real-photo footage. |
| *Kiro use (weighted)* | 6 | 6 | **6** | Unchanged by design (credits reserved). The MCP server + a review pass remain the biggest lift (→ 8). |

**Weighted (Impact / Kiro / Design / Innovation / Presentation, 20 % each): 7.6 / 10** (P1 6.6, P2 6.8). If the video isn't uploaded: 7.2.

LaunchPad Hacks: Usefulness 8, Technical difficulty 8, Design/UX 8, Completeness 8 (video + two browsers + deploy pipeline), Presentation 8\*. Built-during-event statement: still needs the owner to check the dates.

## Top gaps left (in order of score gain per hour)

1. **Owner: push the public repo, let Pages deploy, upload the video to YouTube** (attach the SRT as subtitles). Presentation 8 depends on this.
2. **Owner: one real-key session.** Photograph 3–4 real hand-drawn homework circuits, run them through Qwen-VL, and put the honest hit rate in the README. Then optionally record a 15 s insert for the video. → Impact 9 is plausible.
3. **Kiro passes 11–13 on the 4,000-credit grant** (tasks sync, SPICE MCP server, review pass over the hand-written files incl. possess + recorder) → Kiro use 8, Technical +1. Add a parser **property-based test** in the same pass: PBT is named in the rules' Kiro-feature list.
4. **Voice-over** over the existing cut (the script in `docs/video/script.md` fits the timings), or keep the captions-only version. A real voice tends to read as "original" to judges.
5. Small design wins: bigger schematic thumbnails, Bode phase trace.
