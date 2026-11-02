# Social posts (Social Blitz bonus): drafts for the owner

**Rules (https://kiroween.devpost.com/rules, read 2026-11-03):**
- The post must **start with `#KiroweenHackathon26`**, before any other text.
- It must share **your favourite thing about Kiro** and **how it changed the way you approached development**.
- Post on any platform (X, LinkedIn, Instagram, TikTok) **during the Submission Period** (Oct 30 – Dec 4, 2026, 2:00 pm PT), and paste the post URL into the Devpost form.
- Judging looks at the quality of the content ("original thoughts vs AI writing", real insights about Kiro) and of the image or video. Only 5 win, so **rewrite these in your own words** and attach a real asset: a 15–20 s clip of the possess-a-component slider cut from `docs/demo/circuit-seance-demo.mp4`, or `docs/screenshots/02-rc-demo.png`.
- Tag `@kirodotdev` (X) or Kiro's LinkedIn page. Extra tags are optional; the required one comes first.

Replace `<REPO_URL>`, `<VIDEO_URL>` and `<DEMO_URL>` before posting.

---

## 1 · X (≤ 280 characters): favourite feature

> #KiroweenHackathon26 My favourite thing about @kirodotdev: specs in EARS ("WHEN… THE SYSTEM SHALL…"). I stopped prompting features and started amending requirements. Kiro re-flowed the tasks. Result: 1973 Berkeley SPICE as WebAssembly in a browser tab 👻 <VIDEO_URL>

(≈ 270 characters on X, counting the link as 23 and the emoji as 2. Check in the composer.)

## 2 · X thread opener + clip: the hooks insight

> #KiroweenHackathon26 What changed how I build: @kirodotdev agent hooks. One reviews every save under src/lib/llm for leaked API keys, and it fired 7 times in one headless run without me asking. 126 hook fires across the transcripts. Clip: drag a capacitor, watch τ follow 👇

(Attach the possess-slider clip. Reply in the thread with the repo link: `Circuit Séance: draw a circuit → ngspice WASM → CRT scope → a spirit that explains it. EN + 中文, works offline. <REPO_URL>`)

## 3 · LinkedIn (longer, student angle)

> #KiroweenHackathon26
>
> I'm a master's student in electrical engineering, and for Kiroween I resurrected a piece of my field's history: SPICE, the circuit simulator Berkeley released in 1973. Now it runs as WebAssembly inside a browser tab.
>
> Circuit Séance reads a hand-drawn circuit, simulates it with ngspice on your own device, and draws the result on a haunted green-phosphor oscilloscope. A "spirit" explains the waveform in English or Chinese using measured numbers, and a homework check tells you if your hand calculation is within 5 %. No install and no account, and it works offline, which matters for students in China, where many web tools quietly fail.
>
> My favourite thing about Kiro: **spec-driven development**. I wrote no feature prompts after day one. When I changed my mind, I amended the EARS requirements, and Kiro re-planned the task list and implemented it in headless waves. Agent hooks re-checked every save for lint, broken netlists and leaked API keys.
>
> It changed how I approach a build. I now write the requirement before the code, even for a hackathon. I also kept an honest ledger of what I finished by hand after my free credits ran out.
>
> Demo (2:12): <VIDEO_URL>
> Code (MIT, with the full .kiro/ folder): <REPO_URL>
>
> @Kiro #Kiroween #ElectricalEngineering #WebAssembly
