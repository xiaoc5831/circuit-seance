#!/usr/bin/env node
/**
 * Vision transcription eval for Circuit Séance.
 *
 *   NODE_USE_ENV_PROXY=1 EVAL_BASE_URL=https://relay.example/v1 EVAL_API_KEY=… \
 *     node tools/eval-vision.mjs call  --model gpt-5.6-terra [--only id,id] [--concurrency 4]
 *   node tools/eval-vision.mjs score [--models a,b]
 *
 * `call` sends each eval image through the app's own transcription request (same system
 * prompt, same JPEG ≤1600 px downscale as src/features/capture/compress.ts) and caches the
 * raw answer + latency in eval/results/raw/<model>/<id>.json, tagged with a hash of the system + user
 * prompt. A cached answer only counts when its hash matches the current prompt (answers from before
 * the hash existed count as stale too); a stale one is moved to raw/<model>/superseded/ and re-sent. Every HTTP attempt is logged
 * to eval/results/calls.jsonl (gitignored) and a hard cap (EVAL_MAX_CALLS, default 60) is enforced
 * across runs; delete that file to start a new budget. A quota/billing refusal stops the run at once.
 * (NODE_USE_ENV_PROXY=1 only matters behind an HTTPS proxy: Node's fetch ignores HTTPS_PROXY otherwise.)
 * The key is only read from the environment and only sent in the Authorization header;
 * it is never printed, logged or written to disk.
 *
 * `score` needs no network: it runs ground truth and transcription through the app's parser
 * and sanitiser, simulates both in ngspice (eecircuit-engine, one child process per netlist,
 * 40 s timeout), compares the manifest's key measurements within ±5 %, and matches R/L/C
 * values (±1 %). Output: eval/results/scores.json + eval/results/summary.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVAL = path.join(ROOT, 'eval');
const RES = path.join(EVAL, 'results');
const CALL_LOG = path.join(RES, 'calls.jsonl');
const MAX_CALLS = Number(process.env.EVAL_MAX_CALLS ?? 60);
const TIMEOUT_MS = 90_000;
const RETRIES = 1;

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const USER_TEXT = 'Please transcribe this circuit schematic into a SPICE netlist.';
const promptHash = (system) => createHash('sha256').update(system + '\n---\n' + USER_TEXT).digest('hex').slice(0, 12);
const manifest = () => JSON.parse(fs.readFileSync(path.join(EVAL, 'manifest.json'), 'utf8'));

// ------------------------------------------------------------------ app code reuse
async function appModules() {
  // Node ≥22 strips TS types from these dependency-free modules.
  const parser = await import(path.join(ROOT, 'src/features/transcribe/llm-response-parser.ts'));
  const sanitize = await import(path.join(ROOT, 'src/features/simulate/sanitize.ts'));
  const prompts = await import(path.join(ROOT, 'src/lib/llm/prompts.ts'));
  return { ...parser, ...sanitize, ...prompts };
}

// ------------------------------------------------------------------ call
function callsSoFar() {
  if (!fs.existsSync(CALL_LOG)) return 0;
  return fs.readFileSync(CALL_LOG, 'utf8').split('\n').filter((l) => l.includes('"phase":"start"')).length;
}

function imageDataUrl(file) {
  // mimic compress.ts: ≤1600 px long side, white background, JPEG q85
  const buf = execFileSync('magick', [file, '-background', 'white', '-flatten', '-resize', '1600x1600>', '-quality', '85', 'jpg:-'], {
    maxBuffer: 50 * 1024 * 1024,
  });
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function callOnce(model, item, system, dataUrl) {
  if (callsSoFar() >= MAX_CALLS) throw new Error(`call cap reached (${MAX_CALLS})`);
  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: dataUrl } },
          { type: 'text', text: USER_TEXT },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 1024,
  };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  const entry = { ts: new Date().toISOString(), model, image: item.id };
  // reserve the slot before the request so concurrent workers can't overshoot the cap
  fs.appendFileSync(CALL_LOG, JSON.stringify({ ...entry, phase: 'start' }) + '\n');
  try {
    const r = await fetch(`${process.env.EVAL_BASE_URL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.EVAL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await r.text();
    const ms = Date.now() - t0;
    if (!r.ok) return { ok: false, status: r.status, ms, error: text.slice(0, 300) };
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return { ok: false, status: r.status, ms, error: 'non-JSON body: ' + text.slice(0, 200) };
    }
    const content = j?.choices?.[0]?.message?.content ?? '';
    return { ok: !!content, status: r.status, ms, content, finish: j?.choices?.[0]?.finish_reason, usage: j?.usage, error: content ? undefined : 'empty content' };
  } catch (e) {
    return { ok: false, status: null, ms: Date.now() - t0, error: e.name === 'AbortError' ? `timeout ${TIMEOUT_MS / 1000}s` : String(e.message) };
  } finally {
    clearTimeout(timer);
  }
}

async function cmdCall() {
  const model = opt('model');
  if (!model) throw new Error('--model required');
  if (!process.env.EVAL_BASE_URL || !process.env.EVAL_API_KEY) throw new Error('set EVAL_BASE_URL and EVAL_API_KEY');
  const only = opt('only')?.split(',');
  const conc = Number(opt('concurrency', 4));
  const { TRANSCRIBE_SYSTEM_PROMPT } = await appModules();
  const outDir = path.join(RES, 'raw', model);
  fs.mkdirSync(outDir, { recursive: true });
  const hash = promptHash(TRANSCRIBE_SYSTEM_PROMPT);
  const fresh = (id) => {
    const f = path.join(outDir, `${id}.json`);
    return fs.existsSync(f) && JSON.parse(fs.readFileSync(f, 'utf8')).promptHash === hash;
  };
  const todo = manifest().items.filter((it) => (!only || only.includes(it.id)) && !fresh(it.id));
  console.log(`${model}: ${todo.length} image(s) to send (prompt ${hash}); calls so far ${callsSoFar()}/${MAX_CALLS}`);
  const queue = [...todo];
  let stop = null; // a quota / billing refusal stops every worker: retrying only burns attempts
  const worker = async () => {
    for (let it = queue.shift(); it && !stop; it = queue.shift()) {
      const dataUrl = imageDataUrl(path.join(EVAL, 'images', it.image));
      const attempts = [];
      let res;
      for (let a = 0; a <= RETRIES; a++) {
        res = await callOnce(model, it, TRANSCRIBE_SYSTEM_PROMPT, dataUrl);
        attempts.push({ status: res.status, ms: res.ms, error: res.error });
        fs.appendFileSync(CALL_LOG, JSON.stringify({ ts: new Date().toISOString(), model, image: it.id, phase: 'end', status: res.status, ms: res.ms, error: res.error }) + '\n');
        if (res.status === 402 || /insufficient_user_quota|insufficient_quota|额度/.test(res.error ?? '')) stop = 'quota exhausted on the provider';
        if (stop || res.ok || (res.status && res.status < 500 && res.status !== 429)) break;
      }
      if (stop) {
        console.log(`${it.id}: STOP (${stop}); nothing cached, will be resent next run`);
        break;
      }
      const prev = path.join(outDir, `${it.id}.json`);
      if (fs.existsSync(prev)) {
        const old = JSON.parse(fs.readFileSync(prev, 'utf8'));
        fs.mkdirSync(path.join(outDir, 'superseded'), { recursive: true });
        fs.renameSync(prev, path.join(outDir, 'superseded', `${it.id}.${old.promptHash ?? 'nohash'}.json`));
      }
      const rec = { model, id: it.id, image: it.image, promptHash: hash, ok: res.ok, latencyMs: res.ok ? res.ms : null, attempts, finish: res.finish, usage: res.usage, content: res.content ?? null };
      fs.writeFileSync(path.join(outDir, `${it.id}.json`), JSON.stringify(rec, null, 2));
      console.log(`${it.id}: ${res.ok ? 'ok' : 'FAIL'} ${res.ms} ms ${res.error ?? ''}`);
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  if (stop) console.log(`stopped early: ${stop}`);
  console.log(`calls so far ${callsSoFar()}/${MAX_CALLS} (HTTP attempts, retries included)`);
}

// ------------------------------------------------------------------ simulation (child process)
async function cmdSim() {
  const { Simulation } = await import('eecircuit-engine');
  const net = fs.readFileSync(0, 'utf8');
  const s = new Simulation();
  await s.start();
  s.setNetList(net);
  const r = await s.runSim();
  const log = s.getError().filter((l) => l.trim());
  if (!r || r.variableNames.length === 0 || r.numPoints < 1) {
    fs.writeFileSync(args[1], JSON.stringify({ ok: false, errors: log.slice(-8) }));
    process.exit(0);
  }
  const complex = r.dataType === 'complex';
  const val = (v) => (complex ? Math.hypot(v.real, v.img) : v);
  const xv = r.data[0];
  const out = { ok: true, kind: complex ? 'ac' : xv.name === 'time' ? 'tran' : 'other', x: xv.values.map((v) => (complex ? v.real : v)), v: {} };
  for (const d of r.data.slice(1)) if (d.type === 'voltage') out.v[d.name.replace(/^v\((.*)\)$/i, '$1').toLowerCase()] = d.values.map(val);
  fs.writeFileSync(args[1], JSON.stringify(out)); // a file, not stdout: exit() would truncate a piped write
  process.exit(0);
}

let simSeq = 0;
function simulate(netlist) {
  const outFile = path.join(os.tmpdir(), `seance-eval-sim-${process.pid}-${simSeq++}.json`);
  const p = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'sim', outFile], { input: netlist, timeout: 40_000, maxBuffer: 200 * 1024 * 1024, cwd: ROOT });
  if (p.error || p.status === null) return { ok: false, errors: [p.error?.code === 'ETIMEDOUT' ? 'ngspice hung (40 s)' : String(p.error ?? p.signal)] };
  try {
    return JSON.parse(fs.readFileSync(outFile, 'utf8'));
  } catch {
    return { ok: false, errors: [p.stderr.toString().slice(-300) || 'no output'] };
  } finally {
    fs.rmSync(outFile, { force: true });
  }
}

// ------------------------------------------------------------------ netlist helpers
const SUFFIX = { t: 1e12, g: 1e9, meg: 1e6, k: 1e3, m: 1e-3, mil: 25.4e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
export function spiceNumber(tok) {
  const m = String(tok).trim().toLowerCase().match(/^([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(meg|mil|[tgkmunpf])?/);
  if (!m) return NaN;
  return parseFloat(m[1]) * (m[2] ? SUFFIX[m[2]] : 1);
}

function topLines(net) {
  const out = [];
  let depth = 0;
  const all = net.replace(/\r/g, '').split('\n');
  const title = all.findIndex((l) => l.trim()); // SPICE: the first line is always the title
  for (const raw of all.slice(title + 1)) {
    const l = raw.trim();
    if (/^\.subckt/i.test(l)) depth++;
    else if (/^\.ends/i.test(l)) depth = Math.max(0, depth - 1);
    else if (depth === 0) out.push(l);
  }
  return out;
}

export function passives(net) {
  return topLines(net)
    .filter((l) => /^[rcl]/i.test(l))
    .map((l) => {
      const t = l.split(/\s+/);
      const valTok = t.slice(3).find((x) => !/^(r|c|l)=?$/i.test(x)) ?? '';
      return { type: l[0].toUpperCase(), name: t[0], value: spiceNumber(valTok.replace(/^(r|c|l)=/i, '')) };
    });
}

function nodesOf(net) {
  const nodes = new Set();
  for (const l of topLines(net)) {
    if (!l || /^[.*+]/.test(l)) continue;
    const t = l.split(/\s+/);
    const c = l[0].toLowerCase();
    const n = c === 'x' ? t.slice(1, -1).filter((x) => !x.includes('=')) : 'seg'.includes(c) ? t.slice(1, 5) : c === 'q' ? t.slice(1, 4) : t.slice(1, 3);
    n.forEach((x) => x && x !== '0' && !/gnd/i.test(x) && nodes.add(x));
  }
  return [...nodes];
}

export function valueMatch(truthNet, candNet) {
  const truth = passives(truthNet);
  const cand = passives(candNet);
  const used = new Set();
  let hit = 0;
  const misses = [];
  for (const g of truth) {
    const i = cand.findIndex((c, k) => !used.has(k) && c.type === g.type && Math.abs(c.value - g.value) <= 0.01 * Math.abs(g.value));
    if (i >= 0) {
      used.add(i);
      hit++;
    } else misses.push(`${g.name} ${g.value}`);
  }
  return { hit, total: truth.length, extra: cand.length - used.size, exactSet: hit === truth.length && cand.length === truth.length, misses };
}

/**
 * Make the two netlists comparable as *circuits*:
 *  - the candidate's analysis directives are replaced by the ground truth's (same window/sweep);
 *  - when both have the same number of independent voltage sources, each candidate source keeps
 *    its own nodes but takes the ground-truth stimulus (most drawings show only a source symbol,
 *    so amplitude/period are a model's guess, not a transcription error);
 *  - a candidate without .ic gets a 10 mV kick when the truth uses .ic (oscillator start-up).
 *    With `kick: false` it is left out: the scorer retries that way when the kicked netlist fails to
 *    simulate (a 10 mV .ic on *every* node + the truth's UIC contradicts a high-gain op-amp whose
 *    output must be 1e5 x its input difference, and ngspice gives up on a correct circuit).
 */
export function normalise(candNet, truthNet, needAc, { kick = true } = {}) {
  const truthV = topLines(truthNet).filter((l) => /^v/i.test(l));
  const candV = topLines(candNet).filter((l) => /^v/i.test(l));
  const swapStimulus = truthV.length > 0 && truthV.length === candV.length;
  const lines = candNet.replace(/\r/g, '').split('\n');
  const keep = [];
  let inControl = false;
  for (const l of lines) {
    const t = l.trim().toLowerCase();
    if (t.startsWith('.control')) inControl = true;
    if (inControl) {
      if (t.startsWith('.endc')) inControl = false;
      continue;
    }
    if (/^\.(tran|ac|dc|op|noise|end|print|plot|probe|save|meas|measure)\b/.test(t) && !t.startsWith('.ends')) continue;
    if (swapStimulus && candV.includes(l.trim())) {
      const k = candV.indexOf(l.trim());
      const c = l.trim().split(/\s+/);
      keep.push(`${c.slice(0, 3).join(' ')} ${truthV[k].split(/\s+/).slice(3).join(' ')}`);
      continue;
    }
    if (needAc && /^v/.test(t) && !/\bac\b/.test(t)) {
      keep.push(l + ' AC 1');
      continue;
    }
    keep.push(l);
  }
  const truthLines = truthNet.split('\n').map((l) => l.trim());
  const analysis = truthLines.filter((l) => /^\.(tran|ac|dc|op)\b/i.test(l));
  const tweaks = swapStimulus ? ['stimulus set to ground truth'] : [];
  // the oscillator/integrator truths set initial conditions; give a candidate without any the same kind of kick
  if (kick && truthLines.some((l) => /^\.ic\b/i.test(l)) && !keep.some((l) => /^\s*\.ic\b/i.test(l))) {
    const n = nodesOf(candNet);
    if (n.length) {
      keep.push(`.ic ${n.map((x) => `v(${x})=0.01`).join(' ')}`);
      tweaks.push('added .ic 10 mV kick');
    }
  }
  return { netlist: [...keep, ...analysis, '.end', ''].join('\n'), tweaks };
}

// ------------------------------------------------------------------ measurements
const last = (a) => a[a.length - 1];
function lateWindow(x, y, frac) {
  const t0 = x[0] + (last(x) - x[0]) * (1 - frac);
  const i = x.findIndex((t) => t >= t0);
  return [x.slice(i), y.slice(i)];
}
function upCrossFreq(x, y) {
  const mean = y.reduce((s, v) => s + v, 0) / y.length;
  const amp = Math.max(...y) - Math.min(...y);
  if (amp < 1e-3) return NaN;
  const ts = [];
  for (let i = 1; i < y.length; i++)
    if (y[i - 1] < mean && y[i] >= mean) ts.push(x[i - 1] + ((mean - y[i - 1]) / (y[i] - y[i - 1])) * (x[i] - x[i - 1]));
  return ts.length >= 3 ? (ts.length - 1) / (last(ts) - ts[0]) : NaN;
}
const METRICS = {
  tau63: (x, y) => {
    const f = last(y);
    const i = y.findIndex((v) => v >= 0.632 * f);
    return i > 0 ? x[i - 1] + ((0.632 * f - y[i - 1]) / (y[i] - y[i - 1])) * (x[i] - x[i - 1]) : NaN;
  },
  final: (x, y) => last(y),
  peak: (x, y) => Math.max(...y),
  ringFreq: (x, y) => {
    const f = last(y);
    const ts = [];
    for (let i = 1; i < y.length; i++) if (y[i - 1] < f && y[i] >= f) ts.push(x[i]);
    return ts.length >= 3 ? (ts.length - 1) / (last(ts) - ts[0]) : NaN;
  },
  maxLate: (x, y) => Math.max(...lateWindow(x, y, 0.4)[1]),
  minLate: (x, y) => Math.min(...lateWindow(x, y, 0.4)[1]),
  ppLate: (x, y) => {
    const w = lateWindow(x, y, 0.5)[1];
    return Math.max(...w) - Math.min(...w);
  },
  oscFreq: (x, y) => upCrossFreq(...lateWindow(x, y, 0.5)),
  rampSlope: (x, y) => {
    const [xs, ys] = lateWindow(x, y, 0.8);
    const s = [];
    for (let i = 1; i < xs.length; i++) if (Math.abs(ys[i]) < 10 && xs[i] > xs[i - 1]) s.push(Math.abs((ys[i] - ys[i - 1]) / (xs[i] - xs[i - 1])));
    s.sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : NaN;
  },
  f3db: (x, y) => {
    const ref = y[0];
    for (let i = 1; i < y.length; i++)
      if (y[i] / ref < Math.SQRT1_2) {
        const [a, b] = [Math.log10(x[i - 1]), Math.log10(x[i])];
        const [ya, yb] = [y[i - 1] / ref, y[i] / ref];
        return 10 ** (a + ((Math.SQRT1_2 - ya) / (yb - ya)) * (b - a));
      }
    return NaN;
  },
  gain10k: (x, y) => {
    const i = x.findIndex((f) => f >= 1e4);
    return i > 0 ? y[i] / y[0] : NaN;
  },
};

function measure(sim, node, names) {
  const y = sim.v[node];
  return Object.fromEntries(names.map((n) => [n, y ? METRICS[n](sim.x, y) : NaN]));
}
const relErr = (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) / Math.max(Math.abs(b), 1e-30) : Infinity);

// ------------------------------------------------------------------ score
async function cmdScore() {
  const { parseNetlistFromResponse, sanitizeNetlist } = await appModules();
  const man = manifest();
  const tol = man.tolerance;
  const models = opt('models')?.split(',') ?? fs.readdirSync(path.join(RES, 'raw'));
  const truthCache = {};
  const rows = [];
  for (const model of models) {
    for (const it of man.items) {
      const f = path.join(RES, 'raw', model, `${it.id}.json`);
      if (!fs.existsSync(f)) continue;
      const rec = JSON.parse(fs.readFileSync(f, 'utf8'));
      const truthNet = fs.readFileSync(path.join(ROOT, it.truth), 'utf8');
      const tkey = it.truth + it.metrics.join();
      if (!truthCache[tkey]) {
        const ts = simulate(sanitizeNetlist(truthNet).sanitized);
        if (!ts.ok) throw new Error(`ground truth failed to simulate: ${it.truth} ${ts.errors}`);
        truthCache[tkey] = measure(ts, it.probe, it.metrics);
      }
      const want = truthCache[tkey];
      const row = { model, id: it.id, variant: it.variant ?? null, promptHash: rec.promptHash ?? null, latencyMs: rec.latencyMs, attempts: rec.attempts.length, apiOk: rec.ok, want };
      rows.push(row);
      if (!rec.ok) {
        row.stage = 'api';
        row.error = last(rec.attempts).error;
        continue;
      }
      const parsed = parseNetlistFromResponse(rec.content);
      if ('error' in parsed) {
        row.stage = 'parse';
        row.error = parsed.error;
        continue;
      }
      row.confidence = parsed.confidence ?? null;
      row.netlist = parsed.netlist;
      const { sanitized } = sanitizeNetlist(parsed.netlist);
      row.values = valueMatch(truthNet, sanitized);
      const needAc = it.metrics.some((m) => m === 'f3db' || m === 'gain10k');
      const { netlist: normed, tweaks } = normalise(sanitized, truthNet, needAc);
      row.tweaks = tweaks;
      let cs = simulate(normed);
      if (!cs.ok && tweaks.includes('added .ic 10 mV kick')) {
        // the kick is the scorer's own addition; when it is what breaks the run, score the netlist as written
        const retry = simulate(normalise(sanitized, truthNet, needAc, { kick: false }).netlist);
        if (retry.ok) {
          cs = retry;
          row.tweaks = [...tweaks.filter((t) => t !== 'added .ic 10 mV kick'), 'kick dropped (run failed with it)'];
        }
      }
      if (!cs.ok) {
        row.stage = 'simulate';
        row.error = (cs.errors ?? []).join(' | ').slice(0, 400);
        continue;
      }
      // best-matching node (candidate may rename nodes)
      let best = null;
      for (const node of Object.keys(cs.v)) {
        const got = measure(cs, node, it.metrics);
        const err = Math.max(...it.metrics.map((m) => relErr(got[m], want[m])));
        if (!best || err < best.err) best = { node, got, err };
      }
      row.stage = 'scored';
      row.node = best?.node ?? null;
      row.got = best?.got ?? null;
      row.maxRelErr = best ? best.err : Infinity;
      row.behaviourPass = !!best && best.err <= tol;
    }
  }
  fs.writeFileSync(path.join(RES, 'scores.json'), JSON.stringify(rows, null, 2));

  // summary
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '–');
  const med = (a) => {
    const s = a.filter((v) => v != null).sort((p, q) => p - q);
    return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
  };
  let md = `| Model | Images | Answered | Parsed | Simulated | Behaviour match (±${tol * 100} %) | R/L/C values right | Fully right (behaviour ✓ + every value) | Exact component set | Median latency | Max latency |\n|---|---|---|---|---|---|---|---|---|---|---|\n`;
  for (const model of models) {
    const r = rows.filter((x) => x.model === model);
    const ans = r.filter((x) => x.apiOk);
    const parsed = r.filter((x) => x.netlist);
    const sim = r.filter((x) => x.stage === 'scored');
    const pass = r.filter((x) => x.behaviourPass);
    const vh = parsed.reduce((s, x) => s + x.values.hit, 0);
    const vt = r.reduce((s, x) => s + (fs.existsSync(path.join(ROOT, manifest().items.find((i) => i.id === x.id).truth)) ? passives(fs.readFileSync(path.join(ROOT, manifest().items.find((i) => i.id === x.id).truth), 'utf8')).length : 0), 0);
    const exact = parsed.filter((x) => x.values.exactSet).length;
    const full = r.filter((x) => x.behaviourPass && x.values.hit === x.values.total).length;
    const lat = ans.map((x) => x.latencyMs);
    md += `| ${model} | ${r.length} | ${ans.length} | ${parsed.length} | ${sim.length} | **${pass.length}/${r.length} (${pct(pass.length, r.length)})** | ${vh}/${vt} (${pct(vh, vt)}) | ${full}/${r.length} (${pct(full, r.length)}) | ${exact}/${r.length} | ${med(lat) != null ? (med(lat) / 1000).toFixed(1) + ' s' : '–'} | ${lat.length ? (Math.max(...lat) / 1000).toFixed(1) + ' s' : '–'} |\n`;
  }
  md += `\n| Image | ${models.join(' | ')} |\n|---|${models.map(() => '---').join('|')}|\n`;
  for (const it of man.items) {
    const cells = models.map((m) => {
      const x = rows.find((r) => r.model === m && r.id === it.id);
      if (!x) return 'n/a';
      if (x.stage !== 'scored') return `✗ ${x.stage}: ${String(x.error).slice(0, 60).replace(/\|/g, '/')}`;
      const errs = it.metrics.map((k) => `${k} ${(100 * relErr(x.got[k], x.want[k])).toFixed(1)}%`).join(', ');
      return `${x.behaviourPass ? '✓' : '✗'} ${errs}; values ${x.values.hit}/${x.values.total}; ${(x.latencyMs / 1000).toFixed(1)} s`;
    });
    md += `| ${it.id} | ${cells.join(' | ')} |\n`;
  }
  fs.writeFileSync(path.join(RES, 'summary.md'), md);
  console.log(md);
}

if (cmd === 'call') await cmdCall();
else if (cmd === 'score') await cmdScore();
else if (cmd === 'sim') await cmdSim();
else console.log('usage: node tools/eval-vision.mjs call --model <m> [--only ids] | score [--models a,b]');
