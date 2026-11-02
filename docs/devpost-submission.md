# Devpost submission draft: Circuit Séance · 电路招魂

> Draft for Kiroween 2026 (category: **Resurrection**) and LaunchPad Hacks. Fill in the `TODO` links before submitting.

**Tagline (≤ 60 chars):** Berkeley SPICE (1973), resurrected in your browser.

**Links:** Demo: `TODO (GitHub Pages URL after push)` · Repo: `TODO (public GitHub, MIT, /.kiro at root)` · Video: `TODO (YouTube, < 3 min)`. Upload `docs/demo/circuit-seance-demo.mp4` (2:12, English captions burned in, no third-party music) and also attach `docs/demo/circuit-seance-demo.en.srt` as YouTube subtitles.

**Bonus prizes to tick on the form** (rules read 2026-11-03):
- **Best Student Project (Resurrection):** needs LinkedIn, **student email**, year + degree (M.Eng./M.S. year 2, Electrical Engineering), and school name (Zhongyuan University of Technology). All team members must be students.
- **Bonus Blog:** publish `docs/blog-post.md` on dev.to / Medium / Hashnode during the Submission Period (it already says it was written for Kiroween 2026) and paste the URL.
- **Social Blitz:** the post must *start with* `#KiroweenHackathon26`. Drafts are in `docs/social-posts.md`; rewrite them in your own words, since judging favours original writing.
- **Best Demo:** automatic (Presentation score + top 10 % overall).

---

## Inspiration

In 1973, Laurence Nagel and Donald Pederson at UC Berkeley released **SPICE**, the circuit simulator that every chip since has been checked against. You wrote it on punch cards, ran it on a mainframe and read the answer off a line printer. Then you went to the lab and watched the real waveform on a green phosphor oscilloscope while a TA explained it.

Fifty years on, plenty of EE students still don't get the second half of that experience. Many of us have the textbook and a pencil, but no bench scope, no simulator licence, and sometimes not even a laptop that will install one. We wanted to bring both ghosts back, the simulator *and* the oscilloscope with someone explaining it, in a browser tab that works on a phone.

## Who it's for

EE students checking homework and lab circuits. You solve it by hand, then draw it, simulate it, and let the spirit grade you. It works in English and Chinese, offline, and in mainland China, where many web tools fail silently on blocked fonts and CDNs. There's nothing to install and no account.

## What it does

1. **Draw a circuit** (or pick one of ours). A vision model reads the drawing and writes a SPICE netlist, along with a confidence note.
2. **Edit the netlist** if the model got something wrong. Ctrl+Enter re-runs it.
3. **ngspice 45**, the open-source descendant of Berkeley SPICE compiled to **WebAssembly**, simulates it on your own device. There's no server.
4. The waveform sweeps onto a **haunted green-phosphor CRT**, with phosphor persistence, scanlines, a measurement cursor and real 1-2-5 volts/div and time/div knobs. Transient, AC (Bode) and DC operating-point analyses all work.
5. **The Spirit**, the ghost of a 1970s oscilloscope, explains what the trace shows, why, and what to try next, in **English or 简体中文**. Its numbers are *measured* from the simulation (τ, frequency, overshoot, ripple, −3 dB corner, gain) and compared with textbook theory.
6. **Homework check:** type your hand-calculated τ or corner frequency and see if you're within ±5 %. A wrong answer gets caught with how far off it is (a τ = RC/2 slip shows "off by −50 %").
7. **Possess a component:** click any R, C or L and drag its value from ÷10 to ×10 on a log slider. ngspice re-runs on every move (debounced, one engine, latest wins). The CRT holds its scales, the pre-possession trace stays as a dashed ghost, and the readout shows the measured physics following the part: τ 1.00 ms → 2.19 ms, ×2.19. A textbook says τ = RC; this lets you *watch* it.
8. **Haunted Classics:** four circuits from old pages, re-simulated with their history attached. The **NE555** astable (1972), **Bill Hewlett's Wien-bridge oscillator** (1939; it became the HP 200A, HP's first product, and Disney bought eight of its 200B siblings for *Fantasia*), a 1950s two-section RC filter, and the 1970s op-amp integrator.

**Zero-setup judge mode:** with no API key, a 6.5 s séance intro auto-plays a demo. A hand-drawn RC schematic is "read" (a recorded vision response that goes through the real parser), simulated and explained, and the waveform is on screen about **8.4 s after page load**. Everything in demo mode runs offline, and our e2e suite checks that it makes zero external requests. Add your own key (**Qwen-VL** by default, or OpenAI, Gemini or any OpenAI-compatible endpoint) to read your own photos and ask the live spirit. The key never leaves your browser except to go to that provider.

## How we built it

- **Vite + React + TypeScript (strict).** The ngspice engine ([`eecircuit-engine`](https://github.com/eelab-dev/EEcircuit-engine)) runs in a **Web Worker** and is loaded lazily (a ~20 MB chunk), warmed up during the intro.
- **The CRT** is a Canvas 2D renderer with an off-screen phosphor buffer that fades each frame (afterglow), a two-pass glow (halo plus hot core), and a beam sweep with a bright leading dot. Text readouts are DOM so they stay crisp and accessible. Under `prefers-reduced-motion` it draws one static frame.
- **Measurement:** τ from the 63 % crossing, or a **three-point exponential fit** when the window is shorter than 5τ. Period from mean-crossings after start-up, 10–90 % rise, overshoot, tail ripple, and for AC the −3 dB corner and roll-off slope.
- **Safety:** model output is HTML-escaped before Markdown rendering, and the LLM only ever sees a compact measurement digest, never raw arrays.
- **Tests:** 134 unit + integration tests. The integration test runs every bundled circuit through the real engine and checks every number the spirit quotes, including possessed values (C1 × 2.2 → τ 2.2 ms; NE555 RB 4.7 k → f ≈ 1.44/((RA+2RB)C)). There are also 13 Playwright tests, passing in **Chromium and Firefox**. They cover the intro, Haunted Classics, edit + homework, possess (English and Chinese), the error state, settings storage, keyboard, reduced motion with no phone overflow, zero external requests, and the BYOK path against a mocked provider.
- **Privacy:** the API key is never held in React state. It's read from `localStorage` when a request is made and sent only to the provider's base URL.
- **The demo video records itself:** `tools/record-demo.mjs` drives the real app with Playwright, renders the real `.kiro/` files into a viewer page, times English captions to the measured scene starts and burns them in with ffmpeg.

## How we used Kiro

Everything in `/.kiro` was written by **kiro-cli**, run headless (`--no-interactive --output-format stream-json`). The prompt and full event stream for every run are in `docs/kiro-runs/`.

- **Steering:** product, tech and structure files, always included.
- **Spec-driven:** `--mode spec` turned our one-paragraph idea plus answers to its clarifying questions into `requirements.md` with **EARS** acceptance criteria (~98 SHALL statements), a `design.md` with mermaid diagrams, TypeScript interfaces and the worker protocol, and a `tasks.md` of 31 task groups, each linked to its requirements. A second spec run amended it to v1.1 (demo séance, Qwen-VL default, Haunted Classics, homework check, a SPICE MCP server).
- **Headless task waves:** "implement tasks 1–4", "5–8", "9–11", "13–15 + 24". Kiro scaffolded the project and wrote the i18n, the example circuits, the netlist parser and validator, the first simulation worker, the result summariser, and the whole LLM adapter layer with its prompts and response parser (66 unit tests).
- **Agent hooks that fire during headless runs:** two `PostFileSave` command hooks (lint + format the saved file; run the related netlist tests) and two agent-prompt hooks. One keeps the Chinese strings in sync. The other, **`spirit-tone`**, reviews every save under `src/lib/llm` and `src/features/spirit` for API-key leakage, raw waveform arrays in prompts, and the spirit's voice. The transcripts record **126 hook events**.
- **Credits as a design constraint:** a wrapper sums the credits used per run from the stream.

**Honest disclosure.** The free-tier credits (~31–36 used) ran out partway through implementation. The final worker, the CRT scope, the measurement and offline spirit, the Haunted Classics catalogue, the whole UI wiring and most tests were written by hand, and every such file is listed in `docs/kiro-runs/hand-fixes.md`. Kiro's spec stayed the plan we built against. Once the 4,000-credit grant arrives, Kiro builds the **SPICE MCP server** (spec task 29) so it can simulate netlists itself, then does an ownership review of every hand-written file against the EARS requirements (`docs/next-kiro-passes.md`).

## Challenges we ran into

- **ngspice hangs forever on a single non-ASCII byte.** Vision models love `µ`, `Ω` and Chinese comments. Every netlist is now folded to ASCII before it reaches the engine, and the worker has a hard timeout.
- **Two engine instances in one worker also hang.** Our e2e test caught this: the intro's warm-up raced an early click. The fix is one shared `start()` promise and a queue so ngspice runs one simulation at a time.
- **Kiro wrote electrically wrong circuits.** Its RL example had a floating node, the BJT input shorted the bias network, and the op-amp was mis-wired. We verified every netlist in ngspice and fixed four by hand. That's why the integration test now pins the physics.
- **"63 % of the final value" is wrong when the curve hasn't settled.** An edited RC with 2.2 µF read 2.1 ms. The three-point fit now gives 2.2 ms.
- **Fonts:** Google Fonts hangs or is blocked in mainland China, so the fonts are self-hosted.
- **Canvas glow vs. no GPU:** `shadowBlur` cost 100–300 ms per frame on a GPU-less machine, so dragging the possess slider ran at ~2 fps. The renderer now notices slow frames and switches to a blur-free stacked-stroke glow that looks almost the same.

## Accomplishments we're proud of

- A real 1973-lineage simulator running on a phone, offline, with no install.
- Every number the spirit says is measured, and it's tested against the real engine.
- A complete, accessible, bilingual UI with every state designed, including reduced motion.

## What we learned

Spec-first with EARS made the hand-written half easier, not harder: the requirements told us what "done" meant even when Kiro wasn't the one typing. And WebAssembly ports of decades-old C code have sharp edges that only show up when you test the unhappy paths.

## What's next

The SPICE MCP server and the Kiro review pass (credits), CodeMirror SPICE mode, full-wave and filter design challenges for coursework, phase on the Bode plot, and a classroom mode where a teacher shares a circuit link.

## Built with

`kiro` · `typescript` · `react` · `vite` · `webassembly` · `ngspice` · `eecircuit-engine` · `canvas` · `web-workers` · `qwen-vl` · `openai-compatible-api` · `playwright` · `vitest`

## Built during the event (LaunchPad requirement)

Everything in this repository was created **from 2026-11-02 (Asia/Shanghai) onward**: the idea, Kiro steering and spec, all code, drawings, tests and docs. The git history starts with the spec commit. Nothing pre-existing was reused except open-source dependencies (ngspice via `eecircuit-engine`, React, Vite, fonts). *(TODO: confirm 2026-11-02 falls inside LaunchPad's official hacking window.)*
