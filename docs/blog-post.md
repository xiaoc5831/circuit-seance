<!--
Draft for dev.to / Medium / Hashnode (Bonus Blog prize).
Rules check (https://kiroween.devpost.com/rules, read 2026-11-03):
  - must be a PUBLIC post on a third-party blog platform, published during the Submission Period
    (Oct 30 – Dec 4, 2026, 2:00 pm PT), and its URL goes in the Devpost form;
  - must say it was written as part of the Kiroween 2026 hackathon (first paragraph below does).
Before publishing: owner to replace <REPO_URL>, <DEMO_URL>, <VIDEO_URL>, rewrite anything that doesn't sound like you,
and attach 2–3 images from docs/screenshots/ (01-intro.png, 02-rc-demo.png, the possess screenshot).
Suggested tags: kiro, webassembly, electronics, hackathon
-->

# How Kiro resurrected 1973 SPICE in a browser

*I wrote this as part of the **Kiroween 2026 hackathon** (Resurrection category). The project is Circuit Séance (电路招魂), and it's open source: <REPO_URL>.*

In 1973 Laurence Nagel and Donald Pederson presented SPICE at UC Berkeley. It was Fortran on punch cards, and the results came back on a line printer. Half a century later almost every circuit simulator still descends from it. Meanwhile a lot of EE students, me included, check their homework the old way: solve it by hand, hope, and wait a week for the grade. Lab time is short, licensed simulators are clunky on a laptop, and if you study in mainland China, half the web tools you find load Google Fonts or a CDN that never arrives.

So for Kiroween I tried to bring SPICE back as a ghost that lives in a browser tab:

1. You draw a circuit on paper. A vision model (Qwen-VL by default, bring your own key) reads the photo and writes a SPICE netlist.
2. **ngspice 45**, the open-source heir of Berkeley SPICE3, compiled to WebAssembly, simulates it in a Web Worker on your own device. No server.
3. The waveform lands on a green-phosphor CRT oscilloscope with afterglow, cursors and 1-2-5 knobs.
4. A "spirit" explains the trace using numbers **measured from the simulation**, in English or Chinese, and a homework check tells you if your hand calculation is within ±5 %.

The whole demo runs with no key, no account, no install, and zero network requests. It works offline and behind the Great Firewall.

## Spec first, then waves

I drove Kiro from the CLI (`kiro-cli chat --v3 --no-interactive`, streaming JSON so every run left a transcript in the repo). The order mattered more than I expected:

- **Steering first.** Three short files (`product.md`, `tech.md`, `structure.md`) pinned down the boring decisions: Vite + React + TypeScript strict, one engine per worker, both languages for every string, nothing leaves the device without a key. I didn't have to repeat them in later prompts, and later runs stopped "helpfully" adding a backend.
- **Then a spec in spec mode.** Kiro wrote `requirements.md` in EARS notation ("WHEN the user presses Ctrl+Enter THEN THE SYSTEM SHALL…"), a `design.md` with the worker protocol and TypeScript interfaces, and a `tasks.md` where every task links back to the requirements it satisfies. When I changed my mind (Qwen-VL as the default model, a no-key "Demo Séance", Haunted Classics), I amended the spec with Kiro instead of editing code, and the tasks re-flowed.
- **Then implementation in headless task waves** (A: scaffold + i18n, B: parser + worker, C: scope, then the LLM adapter). Each wave was a single prompt: "implement tasks 5–8, run the tests, tick the boxes".

Compared with vibe-coding, the spec stopped two classic hackathon failures: features nobody asked for, and forgetting the requirement you wrote at 2 a.m. When I later reviewed my own code, I checked it against the EARS lines rather than my memory.

## Hooks that actually fired

I asked Kiro to write four agent hooks: lint-on-save and a netlist guard (command hooks that run Node scripts), plus two agent-prompt hooks. One checks that every i18n key exists in both languages. The other, *spirit-tone*, re-reads anything under `src/lib/llm/` for leaked API keys, raw waveform arrays in prompts, and a spirit voice that stays spooky but correct.

Hooks are easy to write and forget, so I counted. The headless transcripts record a `hook_update` event every time one fires, and across the implementation runs they fired **126 times**. In run 09 you can watch spirit-tone re-review the LLM adapter after every save. The first version of the hooks had a real bug (they read the hook input from an env var instead of STDIN). Kiro found and fixed it in its own follow-up run, and that run is in the log too.

## What Kiro got wrong, and what I wrote by hand

This is the part I want to be honest about. The free tier ran out partway through, at about 31–36 credits. Some runs also went sideways. One model stalled for seven minutes after a save, and a wave-C run spent 25 minutes grinding on type errors before I killed it. So a big share of the final app is hand-written: the worker rewrite, the CRT scope, the spirit's measurements and explanations, the UI wiring, and most of the tests. Every hand-written file is listed in `docs/kiro-runs/hand-fixes.md`, and `.kiro/` itself is 100 % kiro-cli output. I even reverted a hand edit I'd made to `tasks.md`.

Some of the hand fixes were real bugs, the kind I'd want a reviewer to know about:

- **A Greek letter hung the simulator.** A `τ` in a netlist *title* made the WASM engine's `runSim()` wait forever, with no error. LLM-transcribed netlists with Chinese comments would hit this constantly, so the worker now sanitises to ASCII and enforces a timeout.
- **Two engines, one worker.** The intro warms the engine up in the background. If you clicked during the intro, a second `start()` raced the first and ngspice hung. The fix: share one start promise and serialise runs.
- **τ from "63 % of the last sample" is wrong** when the simulation window is shorter than 5τ. The spirit was reporting 2.1 ms for a 2.2 ms circuit, so I replaced it with a three-point exponential fit. An integration test now runs every bundled circuit through the real engine and pins each number the spirit quotes.

## The new trick: possess a component

The feature I'm proudest of is the newest one. Pick a part in the netlist, say C1, and its "spirit" takes over a log-scale slider (÷10 to ×10). Drag it and ngspice re-runs on every move: one engine, debounced, with the latest request winning. The CRT keeps its scales and draws the pre-possession trace as a dashed ghost, and a readout shows the measured physics follow: τ 1.00 ms → 2.19 ms, ×2.19. It sounds like a toy, but it's the thing a textbook can't do. You *see* why τ = RC instead of memorising it.

## Numbers

- 134 unit + integration tests (the integration suite runs every circuit through real ngspice WASM)
- 13 Playwright end-to-end tests, passing in **Chromium and Firefox**, including a mocked-provider test of the bring-your-own-key path and a check that demo mode makes zero external requests
- Waveform on screen about 8.5 s after first load, with the 20 MB engine and the intro included

## What's next

When the hackathon credit grant arrives, the queued Kiro passes are: a **SPICE MCP server**, so Kiro can simulate circuits itself and re-verify every netlist; a Kiro review of every hand-written file against the EARS requirements; and a property-based test for the netlist parser. There's one thing I still need to measure honestly: how well Qwen-VL reads *messy* real student drawings. The demo uses recorded transcriptions of clean drawings, and I'll publish the real hit rate when I have it.

If you're an EE student, try it on your next problem set: <DEMO_URL>. The 2:12 demo video is here: <VIDEO_URL>.

*Built for Kiroween 2026 with Kiro. MIT licensed.*
