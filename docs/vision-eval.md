# Vision transcription eval — status: harness ready, accuracy NOT measured yet

**Short version (2026-11-03):** the eval set, the scorer and the call budget are built and checked. Only **2 of the planned 24 transcriptions** went through before the relay account ran out of credit (HTTP 403 `insufficient_user_quota`). Two answers are not an accuracy figure, so **this project makes no transcription-accuracy claim yet**. The README and the Devpost draft say the same.

## What was planned

| | |
|---|---|
| Images | 12 synthetic hand-drawn-style schematics (`eval/images/`, built by `tools/make-eval-images.sh`): the 8 bundled drawings (`public/samples/*.svg`, `public/classics/*.svg`) rendered to PNG at 1.5×, plus 4 photo-like variants: a 9° phone tilt with sensor noise, graphite pencil with grain, a notebook photo (keystone, lamp shading, defocus, 1000 px, JPEG q55), and a photo of a print (keystone, heavy vignette, blur, 900 px, JPEG q50). |
| Ground truth | The verified netlist each drawing was made from (`eval/manifest.json` → `src/examples/*.net`, `src/features/haunted/netlists/*.net`). |
| Models | `gpt-5.6-terra` and `gpt-6.1-sol`, through an OpenAI-compatible relay: exactly the request the app sends (`TRANSCRIBE_SYSTEM_PROMPT`, the same JPEG ≤ 1600 px downscale as `compress.ts`, temperature 0.3, max_tokens 1024). Timeout 90 s, 1 retry. |
| Budget | A hard cap of 60 HTTP attempts, retries included, enforced by the script across runs. |

**These are synthetic drawings, not photos of real paper.** Real phone photos of hand-drawn homework are still to come from the owner. Add them to `eval/images/` and `eval/manifest.json` with their ground-truth netlist.

## What actually happened (every HTTP attempt, from `eval/results/calls.jsonl`)

**25 attempts in total.** All were made 2026-11-03 between 09:21 and 09:23 CST.

| # | Model | Image | Result |
|---|---|---|---|
| 1 | gpt-5.6-terra | rc-lowpass | 401 "Invalid token". This was my setup error: Node's `fetch` ignores `HTTPS_PROXY`, so the request bypassed the sandbox proxy that adds the key. Fixed with `NODE_USE_ENV_PROXY=1`. |
| 2 | gpt-5.6-terra | rc-lowpass | **200 OK, 80.1 s** (5,829 prompt + 201 completion tokens) |
| 3–24 | both | the other 21 image/model pairs | **403 `insufficient_user_quota`**, rejected in < 1.1 s. The relay pre-charges about $0.09–0.11 per call and the balance was about $0.07. |
| 25 | gpt-6.1-sol | rlc-ringing | **200 OK, 4.8 s** (7,145 prompt + 187 completion tokens). It had been sent before the balance ran out. |
| (26) | gpt-6.1-sol | rc-lowpass | Was in flight when I stopped the run. It was killed with no answer recorded, and it may still have been billed. |

Since then the script stops all workers on the first quota or billing refusal (402, `insufficient_*quota`, 额度). It no longer walks through the rest of the set.

### The two answers that did come back (scored offline, `node tools/eval-vision.mjs score`)

| Model | Image | Netlist | Behaviour vs truth (ngspice) | R/L/C values | Latency |
|---|---|---|---|---|---|
| gpt-5.6-terra | rc-lowpass (clean) | R1 1k, C1 1u, 0→5 V pulse, `.tran 0 5m 0 10u` | ✓ τ63 0.0 %, final 0.0 % | 2/2 | 80.1 s |
| gpt-6.1-sol | rlc-ringing (clean) | R1 100, L1 100m, C1 253n, own node names (1/2/3) | ✓ ring frequency 0.0 %, peak 0.0 % (after the stimulus swap below) | 3/3 | 4.8 s |

Both are correct. That is **n = 1 per model, on the two easiest clean drawings**. It shows that the pipeline works with real model output. It says nothing about accuracy. Observations worth keeping:

- **Both models answered in Chinese around the fenced block** ("我先按图确认元件连接…"), even with an English system prompt. The relay's hidden prompt (about 4.5k tokens; prompt_tokens was 5.8k–7.1k for one image) probably causes this. The app's parser takes the fenced block regardless, and an e2e test now pins that.
- **Sol guessed the stimulus**: the drawing shows only a pulse symbol, so it chose 0→1 V, 1 kHz. That is a sensible guess, but scoring it raw against the 5 V / 10 ms ground truth "failed" a perfect transcription by 97 %. That is why the scorer swaps in the ground-truth stimulus (see Method).
- **Latency varies a lot on this relay**: 80 s for terra against 5 s for sol, on one sample each. That is why the OpenAI-compatible preset waits 90 s rather than 60 s.

## Default model for the OpenAI-compatible preset

**Not picked.** One answer per model can't decide it. The preset ships with an empty model field, which the user fills in with what their gateway serves. Rerun the eval to choose one.

## Method (what `tools/eval-vision.mjs score` does, no network)

1. Each answer goes through the app's own `parseNetlistFromResponse` and then `sanitizeNetlist`, exactly like the app.
2. **Values:** the top-level R/L/C elements (subcircuit internals and the title line are excluded) are matched one-to-one by type and value within ±1 %. The scorer also reports extra components and an "exact component set" flag.
3. **Behaviour (topology):** both netlists run in ngspice (eecircuit-engine, one child process each, 40 s timeout). To compare circuits and not guesses, three things are normalised:
   - The candidate's analysis directive is replaced by the ground truth's.
   - When both have the same number of independent V sources, each candidate source keeps its own nodes but takes the ground-truth stimulus. Most drawings show only a source symbol. A side effect: a misread source label such as "10 V 50 Hz" would not be caught. This is a known gap.
   - When the truth uses `.ic` and the candidate has none, a 10 mV kick is added so oscillators start.
4. Key measurements per circuit (manifest): RC τ63 and final value; RLC ring frequency and peak; rectifier late max and min (ripple); inverting amp p-p; 555 and Wien oscillation frequency; integrator ramp slope; ladder −3 dB frequency and gain at 10 kHz. The candidate passes when every measurement is within **±5 %** on some node, because node names may differ.
5. **"Fully right"** = behaviour ✓ **and** every R/L/C value right. This is the headline number to report once there is data.

**Scorer self-check (no model involved):** feeding the 12 ground truths back with renamed nodes scores 12/12 behaviour, 38/38 values. Tripling the last R/L/C value in each of the 8 distinct circuits is caught on 7/8 by behaviour and 8/8 by values. The behaviour miss is the integrator's 1 MΩ DC-feedback resistor, where ×3 barely changes the ramp slope; the value check catches it. So "behaviour ✓" alone is not enough, which is why the headline is "fully right".

## Found while building this

- **Parser bug, fixed:** `parseNetlistFromResponse` stripped every non-ASCII character *before* the sanitiser could map `µ` → `u`, so `1µF` silently became `1F` (off by 10⁶). It now folds µ/μ first. A unit test covers it.

## Rerun (when the relay has credit)

```bash
bash tools/make-eval-images.sh                     # only if images changed
rm eval/results/calls.jsonl                        # start a fresh 60-attempt budget (or set EVAL_MAX_CALLS)
export NODE_USE_ENV_PROXY=1                        # only behind an HTTPS proxy
export EVAL_BASE_URL=https://<gateway>/v1 EVAL_API_KEY=<key>   # env only, never committed
node tools/eval-vision.mjs call --model gpt-5.6-terra --concurrency 4
node tools/eval-vision.mjs call --model gpt-6.1-sol  --concurrency 4
node tools/eval-vision.mjs score                   # → eval/results/summary.md + scores.json
```

Answers are cached per model and image in `eval/results/raw/`, so a rerun only sends what is missing. The 2 successful answers above are kept, which leaves 22 calls for the full set. The key is read only from the environment and sent only in the `Authorization` header. It is never printed, logged or written to disk.

## Run 2026-11-03 (AMD Radeon Token Factory, free tier)

Endpoint `https://developer.amd.com.cn/radeon/api/v1` (OpenAI-compatible). Same 12 synthetic images, same scorer.

| Model | Fully right | R/L/C values | Exact component set | Median latency |
|---|---|---|---|---|
| Gemma-4-31B-IT | **7/12 (58 %)** | 38/38 (100 %) | 12/12 | 18.4 s |
| MiniCPM-V-4.7-35B-A3B | 3/12 (25 %) | 36/38 (95 %) | 11/12 | 19.7 s |

Gemma-4-31B-IT is the recommended free vision model. Passive circuits (RC, RLC, ladder, rectifier, Wien photo) pass; the remaining failures are op-amp/555 modelling (non-ideal op-amp gain, unknown `ne555` subckt), not reading errors — every component value was read correctly. Next fix: give the prompt a built-in `opamp`/`ne555` subckt library. n=12 synthetic images; real hand-drawn photos not yet measured.

## Run 2026-11-03 (2): built-in subckt library + prompt change

**What changed**

- `src/features/netlist/stdlib.ts`: built-in `opamp` (pins `inp inn out`, same macro-model as the examples), a behavioural `ne555` (pins `gnd trig out rst ctrl thr dis vcc`, datasheet pins 1..8 in order; smooth SR latch, 1k/10k/10n at 5 V runs at 6.79 kHz like the hand-written SW555 model), and diode/BJT `.model`s (1N4148, D1N4148, 1N4001, 1N4007, 1N5819, 2N3904, 2N3906, 2N2222, BC547, BC557; the BC parts are approximate). `sanitizeNetlist` appends any of these the netlist uses but doesn't define, so the app's sim worker and this scorer both get it. A netlist's own definition wins.
- Transcription prompt: "these parts are built in, don't define them", the op-amp pin order (+in, -in, out) with one inverting-amp example, the 555 pin order with one astable example, the model names, and "add `.ic v(<loop node>)=0.01` to oscillators".
- Scorer: cache entries carry a hash of the prompt and stale ones are re-sent (the old answers move to `raw/<model>/superseded/`). One scorer fix: the 10 mV `.ic` kick the scorer adds on *every* node, combined with the truth's `UIC`, made ngspice abort on a correct integrator (op-amp output can't be both 10 mV and 1e5 x its input difference). When the kicked run fails, the scorer now retries without its own kick. It only changes the integrator row below.

**Gemma-4-31B-IT, before → after** (12 synthetic images, ±5 % behaviour + every R/L/C value)

| Image | Before (old prompt, 83394b8) | Library only, cached answers | After (new prompt for these 5) |
|---|---|---|---|
| opamp-inverting | ✗ ppLate 90 %: `X1 3 2 3` (output on +in) | ✗ same | ✓ 0.0 %: `X1 0 2 3 opamp` |
| opamp-inverting--photo | ✗ ppLate 90 %: `X1 3 0 2` (pins rotated) | ✗ same | ✓ 0.0 % |
| opamp-integrator | ✗ rampSlope 77 %: `X1 2 0 3` (+/- swapped) | ✗ same | ✓ 0.0 % (needed the kick fix above) |
| ne555-astable | ✗ unknown subckt `ne555` (7 pins, own order) | ✗ too few pins for library `ne555` | ✗ the answer contains **two** `X1` lines (the model "corrected itself" inside the netlist) plus `R_DIS 2 6 0` → ngspice: device already exists |
| wien-bridge | ✗ oscFreq ∞: output wired to -in | ✗ same | ✗ oscFreq ∞: R1 drawn from out to the RC arm is read as `R1 1 2`, onto the -in node, so the loop is wrong |
| the other 7 | 7/7 ✓ | 7/7 ✓ | 7/7 ✓ (not re-sent) |
| **Fully right** | **7/12** | **7/12** | **10/12** |

MiniCPM-V-4.7-35B-A3B, cached answers only (not re-sent): 3/12 → **5/12**. Both op-amp inverting answers were right but used the subckt without defining it; the library makes them run.

**Read this with care**

- n = 12 synthetic renders of the app's own drawings. One answer per image, temperature 0.3, no repeats, so a single image flipping is within run-to-run noise. Real phone photos of hand drawings are still not measured.
- The "after" column mixes prompts: the 5 failing images were re-sent with the new prompt, the 7 passing ones keep their old-prompt answers. A full re-run on the new prompt (12 calls) would remove that caveat; it was not done to stay inside the call budget.
- The prompt's two examples (inverting amp `X1 0 inv out opamp`, 555 astable pin-out) are the same textbook topologies as two eval circuits. They teach pin order, but they also make those two rows easier than an unseen circuit would be. The integrator and Wien rows got no example.
- The earlier note ("non-ideal op-amp gain") was wrong: the 90 % / 77 % op-amp misses were **pin-order errors in the `X` line**, not the model.
- The ne555 library model is fine on Gemma's pin-out: with only its corrected `X1` line kept, the netlist runs at 6787 Hz (0.0 % off). That was a diagnostic, not a score; the scored answer still fails.
- 5 API calls used (calls log 51 → 56 of the 66 cap), no retries.
