# Kiro usage log — Circuit Séance

Every file under `.kiro/` was written by Kiro itself (kiro-cli), not by hand. This log records the exact commands and prompts so the process can be reproduced and shown in the Kiroween write-up.

- Tool: `kiro-cli 2.37.1` (Kiro Agent Server 0.66.70), V3 engine, headless (`--no-interactive`)
- Account: signed in with Google (xiaoc5831@gmail.com)
- Model: `auto` (1.00× credits) unless noted
- Date: 2026-11-02 (Asia/Shanghai)
- Raw transcripts: `docs/kiro-runs/<run>.jsonl` (ACP event stream; includes every tool call Kiro made)
- Prompts: `docs/kiro-runs/<run>.prompt.md` (verbatim)

## Wrapper

`docs/kiro-runs/run.sh <label> <prompt-file> [extra flags]` runs:

```bash
kiro-cli chat --v3 --no-interactive --trust-workspace --trust-all-tools \
  --output-format stream-json [extra flags] < <prompt-file>
```

It then sums `promptTurnSummaries[].usage` (unit: credits) from the stream to report credits per run.

## Runs

| # | Purpose | Command | Kiro mode | Output | Credits | Time |
|---|---------|---------|-----------|--------|---------|------|
| 0 | Auth smoke test | `kiro-cli chat --v3 --no-interactive --trust-workspace --model qwen3-coder-next "Reply with just the word READY."` (and once more with `--output-format stream-json`) | default | — | ≈0.05 | 2 s |
| 1 | Foundation steering | `run.sh 01-steering docs/kiro-runs/01-steering.prompt.md` | default (vibe) | `.kiro/steering/product.md`, `tech.md`, `structure.md` | 0.761 | 39 s |
| 2 | Feature spec | `run.sh 02-spec docs/kiro-runs/02-spec.prompt.md --mode spec` | **spec** (Quick Spec style, answers to clarifying questions supplied in the prompt) | `.kiro/specs/circuit-seance/requirements.md` (EARS, 11 story groups, 98 SHALL criteria), `design.md` (2 mermaid diagrams, TS interfaces, worker protocol), `tasks.md` (27 tasks / ~108 sub-tasks with `_Requirements:_` links) | 3.969 | 5 m 17 s |
| 3 | Agent hooks | `run.sh 03-hooks docs/kiro-runs/03-hooks.prompt.md` | default | `.kiro/hooks/lint-on-save.json`, `netlist-guard.json` (command hooks), `i18n-sync.json`, `spirit-tone.json` (agent-prompt hooks) | 1.180 | 46 s |
| 4 | Hook bug fix (review found commands read `$KIRO_HOOK_INPUT` instead of STDIN) | `run.sh 04-hooks-fix docs/kiro-runs/04-hooks-fix.prompt.md` | default | `scripts/hooks/lint-on-save.mjs`, `scripts/hooks/netlist-guard.mjs`; both command hooks now call `node scripts/hooks/<name>.mjs` | 1.167 | 53 s |
| 5 | Tried `/usage` headless to read the credit balance | `kiro-cli chat --v3 --no-interactive --model qwen3-coder-next "/usage"` (run in /tmp) | default | Nothing: headless runs send slash commands as a normal prompt, so the balance isn't available this way | 0.376 | 49 s |

**Total ≈ 7.5 credits.** The remaining balance can't be read from the CLI in headless mode. Check it at https://app.kiro.dev (account → usage).

## Runs, continued (implementation phase)

| # | Purpose | Kiro mode / model | Output | Credits (reported) |
|---|---------|-------------------|--------|--------------------|
| 5 | Spec amendment v1.1: Demo Séance, Qwen-VL default, SPICE MCP, Haunted Classics, homework check | `--mode spec`, auto | requirements / design / tasks v1.1 | 5.110 |
| 5a | Same, first attempt (killed) | spec | none | 0 (not reported) |
| 6 | Wave A: tasks 1–4 (scaffold, i18n, examples, shell) | auto | Vite/React/TS scaffold, i18n, example netlists, CRT shell | 4.936 |
| 7, 7b | Wave B, `qwen3-coder-next` | default | stalled after a file write + hooks; killed | not reported |
| 7c | Wave B finish, `claude-haiku-4.5` | default | netlist parser/validator, textarea editor, sim worker, summariser, unit tests | 9.423 |
| 8 | Wave C: tasks 9–11 (scope) | auto | renderer + controls; killed after ~25 min on type errors | not reported |
| 9 | Tasks 13.1–13.2, 14, 15.1, 24 (LLM layer) | auto | `src/lib/llm/*`, response parser, `useTranscribe`, 35 unit tests | 2.632 |
| 10 | tasks.md status sync after the hand-written UI | auto | ticks through 27.6; killed by my wrapper's 110 s timeout before it finished | not reported (est. 1–2) |

**Reported total ≈ 29.6 credits** (runs 0–10). Runs 7, 7b, 8 and 10 were killed before Kiro emitted a turn summary, so their usage isn't in the stream. The real total is roughly **31–36**. The exact figure is at https://app.kiro.dev.

## Hooks fired headless

The `stream-json` transcripts record a `hook_update` event every time an agent hook fires during a headless run. Counts per run:

| Run | lint-on-save (command) | netlist-guard (command) | spirit-tone (agent) | i18n-sync (agent) |
|-----|------|------|------|------|
| 06 | 11 | 11 | – | 1 |
| 07 / 07b | 3 | 3 | – | – |
| 07c | 28 | 26 | – | – |
| 08 | 25 | – | – | – |
| 09 | 11 | – | 7 | – |

In run 09 you can see the agent hook working: after each save under `src/lib/llm/`, Kiro re-reviewed the file for API-key leakage, raw waveform arrays in prompts, and spirit voice (summary in `09-impl-llm.summary.txt`).

## What was not done by Kiro

The free-tier credits ran out partway through implementation. From wave C on, most of the app was written by hand: the worker rewrite, the scope, the spirit, the whole UI wiring, the tests, and the docs. Every such file is listed in [`docs/kiro-runs/hand-fixes.md`](kiro-runs/hand-fixes.md). Everything under `.kiro/` is still 100 % kiro-cli output.

## Kiro features used so far

- **Steering**: 3 foundation files, `inclusion: always`.
- **Specs**: a feature spec made with `--mode spec` that has requirements in EARS form, a design, and tasks that each link back to their requirements.
- **Hooks**: 4 hooks. Two are `PostFileSave` shell-command hooks (lint/format, run related netlist tests). Two are `PostFileSave` agent-prompt hooks (keep the zh-CN i18n in sync, and an LLM-prompt privacy/tone review).
- **Headless automation**: `--no-interactive` + `stream-json`, with per-run credit accounting.

## Planned next

See [`docs/next-kiro-passes.md`](next-kiro-passes.md): these are queued for when the 4,000-credit grant lands.

## Notes / known issues

- Run 3 put `"timeout": 60` for netlist-guard inside `action`. The documented schema puts `timeout` at hook level (`hooks[].timeout`). Have Kiro fix this during implementation. The default is 60 s, so it changes nothing yet.
- What the docs say about `PostFileSave` STDIN doesn't name the field that holds the file path, so the hook scripts check several candidate fields. Confirm the real field once a real save event fires.
