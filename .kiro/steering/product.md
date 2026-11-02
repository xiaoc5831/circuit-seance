---
inclusion: always
---

# Circuit Séance — Product Steering

**Chinese name:** 电路招魂  
**Hackathon:** Kiroween 2026, "Resurrection" category  
**Author:** Cao Xiaoqing (EE master's student)

## Problem

EE students learning circuit analysis often lack access to real lab equipment or affordable simulation tools — LTspice on aging laptops, paid licenses, no oscilloscope at home. Circuit Séance removes those barriers entirely by running simulation in the browser.

## Core Loop

1. Student photographs or uploads a hand-drawn circuit schematic.
2. A vision-capable LLM transcribes it into a SPICE netlist.
3. Student reviews and edits the netlist in a built-in editor.
4. ngspice (compiled to WebAssembly) simulates the circuit entirely client-side — no server required.
5. Results render on a haunted green-phosphor CRT oscilloscope UI (phosphor glow, persistence trails, subtle flicker, scanlines).
6. An AI "spirit" (the ghost of the oscilloscope) explains the waveform in plain language: time constants, steady state, why the curve looks the way it does, and what to try next.

## Resurrection Theme

The "Resurrection" metaphor is literal: Berkeley SPICE (1973) and the analog CRT oscilloscope are brought back to life inside a modern browser. The haunted aesthetic is intentional and central to the identity.

## Supported Features

- **Image-to-netlist:** camera capture or file upload → LLM transcription → netlist editor.
- **Example circuits:** RC low-pass, RL, RLC ringing, diode rectifier, BJT common-emitter, op-amp inverting amp — the app is fully usable without any API key.
- **Manual netlist entry:** power users can type or paste netlists directly.
- **Analysis types:** transient (`.tran`), AC (`.ac`), DC sweep (`.dc`), operating point (`.op`).
- **AI spirit:** waveform explanation, pedagogical commentary, suggestions for next experiments.
- **Bilingual UI:** English primary; Simplified Chinese supported throughout.

## Privacy Principles

- User images and API keys are **never** sent to or stored on a server owned by this project.
- LLM API keys live in browser storage only (sessionStorage preferred, localStorage opt-in).
- Vision and explanation calls go directly from the browser to the user's chosen LLM provider, or through an optional thin serverless proxy the user controls.

## Non-Goals (Hackathon Scope)

- No PCB layout or schematic capture editor.
- No user accounts or hosted backend database.
- No server-side simulation.

## Judging Criteria (keep in mind)

Impact, technical depth (especially Kiro usage), design polish, innovation, and presentation quality all matter. Lean into the CRT aesthetic and the "resurrection" narrative in all copy and UI decisions.
