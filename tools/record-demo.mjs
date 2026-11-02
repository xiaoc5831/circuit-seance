#!/usr/bin/env node
/**
 * Auto-records the < 3:00 demo video (follows docs/video/script.md) with Playwright + system Chromium,
 * then burns English captions (timed to the real scene timings) into an mp4 with ffmpeg.
 *
 *   npm run build && node tools/record-demo.mjs
 *
 * Output:
 *   docs/demo/circuit-seance-demo.mp4      1920×1080 H.264, captions burned in, quiet ambient drone
 *   docs/demo/circuit-seance-demo.en.srt   the captions, with the timings measured during this recording
 *   docs/demo/scenes.json                  scene start times (s)
 *   docs/demo/raw/*.webm                   Playwright's raw capture (gitignored)
 *
 * Env: CHROMIUM_PATH (default /usr/bin/chromium), PORT (default 4329), DEMO_URL (skip starting vite preview),
 *      REPO_URL (shown on the closing card), NO_AUDIO=1 (silent mp4).
 *
 * Everything on screen is the real app in demo mode (recorded transcriptions, offline spirit, zero network).
 * Two things are recording-only: a drawn mouse cursor (headless video has none) and the closing title card.
 * The Kiro scene renders the real .kiro/ files and transcript counts into a viewer page served by page.route.
 * (Hand-written, polish round 3.)
 */
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'docs/demo');
const RAW = join(OUT, 'raw');
const PORT = Number(process.env.PORT ?? 4329);
const BASE = process.env.DEMO_URL ?? `http://127.0.0.1:${PORT}`;
const REPO_URL = process.env.REPO_URL ?? '';
const BURN_SRT = join(tmpdir(), 'circuit-seance-demo.burn.srt');
const VW = 1600;
const VH = 900;

mkdirSync(RAW, { recursive: true });
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ------------------------------------------------------------------ preview server
let server = null;
async function startServer() {
  if (process.env.DEMO_URL) return;
  if (!existsSync(join(ROOT, 'dist/index.html'))) throw new Error('dist/ missing: run `npm run build` first');
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('vite preview did not start');
}

// ------------------------------------------------------------------ Kiro viewer page (real files)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const lines = (p) => read(p).split('\n').length;

function hookCounts() {
  const dir = join(ROOT, 'docs/kiro-runs');
  const counts = {};
  let runs = 0;
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
    runs++;
    const seen = new Set();
    for (const m of read(`docs/kiro-runs/${f}`).matchAll(/"operationId":"([^"]+)","name":"([^"]+)"/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      counts[m[2]] = (counts[m[2]] ?? 0) + 1;
    }
  }
  return { counts, runs };
}

function kiroViewerHtml() {
  const tree = [];
  const walk = (d) => {
    for (const f of readdirSync(join(ROOT, d)).sort()) {
      const p = `${d}/${f}`;
      if (statSync(join(ROOT, p)).isDirectory()) {
        tree.push(`<div class="dir">${esc(p)}/</div>`);
        walk(p);
      } else tree.push(`<div class="file"><span>${esc(p)}</span><span class="n">${lines(p)} lines</span></div>`);
    }
  };
  walk('.kiro');
  const req = read('.kiro/specs/circuit-seance/requirements.md')
    .split('\n')
    .filter((l) => /^- (WHEN|IF|WHERE|WHILE)/.test(l))
    .slice(0, 9)
    .map((l) => `<li>${esc(l.slice(2)).replace(/\b(WHEN|IF|WHERE|WHILE|THEN|THE SYSTEM|SHALL)\b/g, '<b>$1</b>')}</li>`)
    .join('');
  const reqCount = (read('.kiro/specs/circuit-seance/requirements.md').match(/SHALL/g) ?? []).length;
  const tasksTxt = read('.kiro/specs/circuit-seance/tasks.md');
  const done = (tasksTxt.match(/^\s*- \[x\]/gm) ?? []).length;
  const open = (tasksTxt.match(/^\s*- \[ \]/gm) ?? []).length;
  const taskLines = tasksTxt
    .split('\n')
    .filter((l) => /^\s*- \[[x ]\]/.test(l))
    .slice(28, 46)
    .map((l) => {
      const on = /\[x\]/.test(l);
      const indent = /^\s{2,}/.test(l);
      return `<li class="${on ? 'x' : 'o'}${indent ? ' sub' : ''}">${on ? '☑' : '☐'} ${esc(l.replace(/^\s*- \[[x ]\]\s*/, '').slice(0, 110))}</li>`;
    })
    .join('');
  const hooks = readdirSync(join(ROOT, '.kiro/hooks'))
    .sort()
    .map((f) => {
      const h = JSON.parse(read(`.kiro/hooks/${f}`)).hooks[0];
      return `<tr><td>${esc(f)}</td><td>${esc(h.name)}</td><td>${esc(h.trigger)}</td><td><code>${esc(h.matcher ?? '')}</code></td><td>${esc(h.action?.type ?? '')}</td></tr>`;
    })
    .join('');
  const tone = JSON.parse(read('.kiro/hooks/spirit-tone.json')).hooks[0].action.prompt.split('\n\n').slice(0, 2).join('\n\n');
  const { counts, runs } = hookCounts();
  const fires = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([n, c]) => `<tr><td>${esc(n)}</td><td class="num">${c}</td></tr>`)
    .join('');
  const totalFires = Object.values(counts).reduce((a, b) => a + b, 0);
  const handRows = read('docs/kiro-runs/hand-fixes.md')
    .split('\n')
    .filter((l) => /^\| \d|^\| 0|^\| 10|^\| 08/.test(l))
    .slice(0, 12)
    .map((l) => {
      const c = l.split('|').map((x) => x.trim());
      return `<tr><td>${esc(c[1])}</td><td>${esc(c[2].replace(/\*\*|`/g, '').slice(0, 150))}${c[2].length > 150 ? '…' : ''}</td></tr>`;
    })
    .join('');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>.kiro — Circuit Séance</title><style>
  @font-face{font-family:VT;src:url(/assets/${readdirSync(join(ROOT, 'dist/assets')).find((f) => /^vt323-latin-400-normal.*\.woff2$/.test(f))}) format('woff2')}
  @font-face{font-family:STM;src:url(/assets/${readdirSync(join(ROOT, 'dist/assets')).find((f) => /^share-tech-mono-latin-400-normal.*\.woff2$/.test(f))}) format('woff2')}
  *{box-sizing:border-box}html{scroll-behavior:smooth}
  body{margin:0;background:#010603;color:#b8ffc4;font:17px/1.5 STM,monospace}
  section{min-height:900px;padding:56px 80px 120px;border-bottom:1px solid #1d4a2b}
  h1{font:64px/1 VT,monospace;color:#39ff14;text-shadow:0 0 8px rgba(57,255,20,.6);margin:0 0 6px}
  h2{font:44px/1 VT,monospace;color:#39ff14;text-shadow:0 0 8px rgba(57,255,20,.5);margin:0 0 18px}
  .sub{color:#7fd593;margin:0 0 28px;font-size:19px}.path{color:#ffb000;font-size:16px;margin-bottom:10px}
  .card{background:#04100a;border:1px solid #1d4a2b;border-radius:12px;padding:22px 26px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:28px}
  .dir{color:#ffb000;margin-top:8px}.file{display:flex;justify-content:space-between;padding:2px 0 2px 22px}.n{color:#5fa872}
  ul{margin:0;padding-left:20px}li{margin:6px 0}b{color:#ffb000;font-weight:normal}
  .tasks{list-style:none;padding:0}.tasks li{margin:3px 0}.tasks .sub{padding-left:28px}.tasks .x{color:#b8ffc4}.tasks .o{color:#5fa872}
  table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #12311c;padding:7px 10px;text-align:left;vertical-align:top}th{color:#7fd593;font-weight:normal}
  code{color:#4df3ff}.num{text-align:right;color:#39ff14;font-size:22px}
  .big{font:84px/1 VT,monospace;color:#39ff14;text-shadow:0 0 10px rgba(57,255,20,.6)}.stat{display:flex;gap:60px;margin:6px 0 26px}.stat div span{display:block;color:#7fd593}
  pre{white-space:pre-wrap;margin:0;color:#b8ffc4;font:16px/1.5 STM,monospace}
  .amber{color:#ffb000}
  </style></head><body>
  <section id="tree"><h1>How Kiro built Circuit Séance</h1><p class="sub">Spec-driven development with kiro-cli (headless). Everything under <span class="amber">.kiro/</span> was written by Kiro.</p>
   <div class="grid"><div class="card">${tree.join('')}</div>
   <div class="card"><div class="stat"><div><div class="big">${reqCount}</div><span>EARS “SHALL” criteria</span></div><div><div class="big">${done}</div><span>tasks ticked by Kiro</span></div><div><div class="big">${totalFires}</div><span>hook fires in transcripts</span></div></div>
   <p>${runs} recorded kiro-cli runs · prompts + raw ACP transcripts in <span class="amber">docs/kiro-runs/</span></p>
   <p>steering → spec (requirements · design · tasks) → hooks → task waves A · B · C · LLM</p></div></div></section>
  <section id="req"><div class="path">.kiro/specs/circuit-seance/requirements.md</div><h2>Requirements in EARS notation</h2><div class="card"><ul>${req}</ul></div></section>
  <section id="tasks"><div class="path">.kiro/specs/circuit-seance/tasks.md</div><h2>Linked task list: ${done} done · ${open} open</h2><div class="card"><ul class="tasks">${taskLines}</ul></div></section>
  <section id="hooks"><div class="path">.kiro/hooks/*.json</div><h2>Agent hooks fired on every save</h2>
   <div class="grid"><div class="card"><table><tr><th>file</th><th>name</th><th>trigger</th><th>matcher</th><th>type</th></tr>${hooks}</table>
   <p class="sub" style="margin:18px 0 6px">spirit-tone.json (agent prompt, excerpt)</p><pre>${esc(tone)}</pre></div>
   <div class="card"><p class="sub" style="margin:0 0 8px">Fires counted from the headless transcripts (hook_update events)</p><table>${fires}</table></div></div></section>
  <section id="hand"><div class="path">docs/kiro-runs/hand-fixes.md</div><h2>Honest ledger: what was written by hand</h2><p class="sub">The free credits ran out mid-build. The scope, the spirit and the UI wiring were finished by hand, and every hand-written file is logged.</p><div class="card"><table>${handRows}</table></div></section>
  </body></html>`;
}

// ------------------------------------------------------------------ recording helpers
const cursorScript = () => {
  window.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.id = '__demo_cursor';
    c.style.cssText =
      'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:transform 30ms linear';
    c.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 22 22"><path d="M2 1 L2 18 L6.5 13.8 L9.6 20.5 L12.6 19.2 L9.6 12.6 L15.8 12.4 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(c);
    const ring = document.createElement('div');
    ring.style.cssText =
      'position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:2px solid #ffb000;opacity:0;z-index:2147483646;pointer-events:none;transition:opacity 250ms';
    document.documentElement.appendChild(ring);
    window.addEventListener('mousemove', (e) => (c.style.transform = `translate(${e.clientX - 2}px, ${e.clientY - 1}px)`), true);
    window.addEventListener(
      'mousedown',
      (e) => {
        ring.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        ring.style.opacity = '0.9';
        setTimeout(() => (ring.style.opacity = '0'), 260);
      },
      true,
    );
  });
};

let T0 = 0;
let introAt = 0;
const now = () => (Date.now() - T0) / 1000;
const cues = [];
const scenes = [];
// top: put the caption at the top of the frame (when the action is at the bottom of the screen)
const say = (text, top = false) => {
  if (cues.length && cues[cues.length - 1].end == null) cues[cues.length - 1].end = now();
  cues.push({ start: now(), end: null, text, top });
  log('cue', now().toFixed(1), text);
};
const quiet = () => {
  if (cues.length && cues[cues.length - 1].end == null) cues[cues.length - 1].end = now();
};
const scene = (id) => {
  scenes.push({ id, start: Number(now().toFixed(2)) });
  log('scene', id);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let mouse = { x: VW / 2, y: VH / 2 };
async function moveTo(page, x, y, ms = 600) {
  // each step costs a frame (≈ 50–100 ms in a GPU-less recorder), so keep the count low
  const steps = Math.max(6, Math.round(ms / 70));
  await page.mouse.move(x, y, { steps });
  mouse = { x, y };
}
async function moveToEl(page, loc, ms = 600, dx = 0.5, dy = 0.5) {
  await loc.scrollIntoViewIfNeeded();
  const b = await loc.boundingBox();
  if (!b) throw new Error('no box');
  await moveTo(page, b.x + b.width * dx, b.y + b.height * dy, ms);
  return b;
}
async function click(page, loc, ms = 600) {
  await moveToEl(page, loc, ms);
  await wait(120);
  await page.mouse.down();
  await wait(70);
  await page.mouse.up();
}
async function scrollTo(page, y, ms = 900) {
  await page.evaluate(([top]) => window.scrollTo({ top, behavior: 'smooth' }), [y]);
  await wait(ms);
}
async function scrollToEl(page, sel, offset = 0, ms = 900) {
  const y = await page.evaluate(([s, o]) => {
    const el = document.querySelector(s);
    return el ? el.getBoundingClientRect().top + window.scrollY - o : 0;
  }, [sel, offset]);
  await scrollTo(page, y, ms);
}
async function typeSlow(page, text, perChar = 90) {
  for (const ch of text) {
    await page.keyboard.type(ch);
    await wait(perChar);
  }
}
const traceReady = (page) =>
  page.waitForFunction(
    () =>
      document.querySelector('[data-testid=sim-status]')?.getAttribute('data-state') === 'complete' &&
      document.querySelector('[data-testid=scope-canvas]')?.getAttribute('data-has-trace') === 'true',
    null,
    { timeout: 60_000 },
  );

// drag the possess slider smoothly from its current position to `toPos` (0..100)
async function dragSlider(page, toPos, ms = 2500) {
  const s = page.getByTestId('possess-slider');
  const b = await s.boundingBox();
  const cur = Number(await s.inputValue());
  const xAt = (p) => b.x + 8 + ((b.width - 16) * p) / 100;
  const y = b.y + b.height / 2;
  await moveTo(page, xAt(cur), y, 500);
  await page.mouse.down();
  const steps = Math.max(8, Math.round(ms / 180));
  for (let i = 1; i <= steps; i++) {
    const p = cur + ((toPos - cur) * i) / steps;
    await page.mouse.move(xAt(p), y);
    mouse = { x: xAt(p), y };
    await wait(40);
  }
  await page.mouse.up();
}

// land exactly on a slider position with the arrow keys (the drag can be off by a step)
async function nudgeSlider(page, target) {
  const s = page.getByTestId('possess-slider');
  for (let i = 0; i < 6; i++) {
    const v = Number(await s.inputValue());
    if (v === target) return;
    await s.press(v < target ? 'ArrowRight' : 'ArrowLeft');
    await wait(60);
  }
}

// ------------------------------------------------------------------ the film
async function film(page) {
  // 1 · séance intro (fresh profile, so it plays)
  scene('intro');
  await page.goto(`${BASE}/`);
  await page.getByTestId('intro').waitFor({ state: 'visible', timeout: 15_000 });
  introAt = now();
  // warm the image cache so Haunted Classics pages don't pop in later
  await page.evaluate(() => {
    for (const f of ['ne555-astable', 'rc-ladder', 'wien-bridge', 'opamp-integrator']) new Image().src = `classics/${f}.svg`;
    for (const f of ['rlc-ringing', 'diode-rectifier', 'opamp-inverting']) new Image().src = `samples/${f}.svg`;
  });
  say('1973, UC Berkeley: a program called SPICE learns to simulate circuits.');
  await wait(3300);
  say('Tonight that 1973 program wakes up, inside your browser.');
  await page.getByTestId('intro').waitFor({ state: 'hidden', timeout: 15_000 });

  // 2 · drawing → transcription → netlist → CRT
  scene('drawing');
  say('Circuit Séance: a hand-drawn circuit is read into a SPICE netlist…');
  await page.locator('[data-testid=tx-text]').waitFor({ timeout: 10_000 });
  await wait(1600);
  say('…and ngspice, Berkeley SPICE’s open-source heir compiled to WebAssembly, simulates it on your device.');
  await traceReady(page);
  await wait(2600);
  say('No server, no install, no account. The demo makes zero network requests.');
  await wait(2600);

  // 3 · cursor readout + spirit
  scene('spirit');
  say('Hover the green-phosphor scope to read any instant…');
  const scr = page.locator('.scope-screen');
  const sb = await scr.boundingBox();
  await moveTo(page, sb.x + sb.width * 0.12, sb.y + sb.height * 0.5, 700);
  await moveTo(page, sb.x + sb.width * 0.34, sb.y + sb.height * 0.45, 1800);
  await wait(900);
  say('…and the Spirit explains the trace with numbers measured from the simulation: τ = 1 ms = R × C.');
  await moveTo(page, VW - 40, VH - 60, 500);
  await scrollToEl(page, '.spirit-panel', 110, 1400);
  await wait(3600);

  // 4 · Possess a component (the wow)
  scene('possess');
  // scope + possess panel in one view (header is sticky, ≈ 90 px)
  await scrollToEl(page, '.scope-panel', 84, 1300);
  say('New: possess a component. Pick C1 and its spirit takes the slider.', true);
  await click(page, page.getByTestId('possess-C1'), 800);
  await wait(1300);
  say('Drag it: ngspice re-runs on every move, and the dashed ghost is the circuit before possession.', true);
  await dragSlider(page, 67, 3200);
  await nudgeSlider(page, 67);
  await wait(1800);
  say('C × 2.2 → τ × 2.2. The readout shows it live: 1 ms becomes 2.2 ms.', true);
  await wait(2600);
  say('Now ÷10: the capacitor fills ten times faster.', true);
  await dragSlider(page, 0, 2600);
  await nudgeSlider(page, 0);
  await wait(2600);
  await click(page, page.getByTestId('possess-release'), 600);
  await traceReady(page);
  await wait(500);

  // 5 · homework check catching a wrong answer
  scene('homework');
  say('Homework check: solve it by hand, then let the simulation grade you (±5 %).', true);
  await scrollToEl(page, '.homework', 150, 1200);
  await click(page, page.locator('.homework summary'), 600);
  await wait(500);
  const hw = page.getByLabel(/Time constant/);
  await click(page, hw, 500);
  await typeSlow(page, '0.5m');
  await wait(300);
  await click(page, page.getByRole('button', { name: 'Check' }).first(), 500);
  await wait(500);
  say('A classic slip, τ = RC/2, gets caught: off by −50 %.', true);
  await wait(3000);
  await click(page, hw, 400);
  await page.keyboard.press('ControlOrMeta+A');
  await typeSlow(page, '1m');
  await click(page, page.getByRole('button', { name: 'Check' }).first(), 500);
  say('Fix it, check again: correct. A lab partner for every EE problem set.', true);
  await wait(3000);

  // 6 · Haunted Classics
  scene('classics');
  await scrollTo(page, 0, 1000);
  say('Haunted Classics: famous circuits resurrected from old pages.');
  await click(page, page.getByRole('tab', { name: 'Haunted Classics' }), 700);
  await wait(1400);
  say('The 1972 NE555 timer: its capacitor saws between ⅓ and ⅔ of the supply.');
  await click(page, page.getByTestId('classic-ne555-astable'), 700);
  await traceReady(page);
  await moveTo(page, VW - 40, VH / 2, 500);
  await scrollTo(page, 0, 700);
  await wait(3600);
  say('Bill Hewlett’s 1939 Wien-bridge oscillator: a sine wave grows out of a 10 mV whisper.');
  await click(page, page.getByTestId('classic-wien-bridge'), 700);
  await traceReady(page);
  await moveTo(page, VW - 40, VH / 2, 500);
  await scrollTo(page, 0, 700);
  await wait(3600);

  // 7 · 中文
  scene('chinese');
  say('Every label and every explanation also works in Chinese, fully offline, with no blocked services.');
  await click(page, page.getByRole('button', { name: 'Switch language to Chinese' }), 700);
  await wait(1800);
  await moveTo(page, VW - 40, VH - 80, 400);
  await scrollToEl(page, '.spirit-panel', 110, 1300);
  await wait(2600);
  await scrollTo(page, 0, 900);
  await click(page, page.getByRole('button', { name: '切换为英文' }), 600);
  await wait(800);

  // 8 · BYOK settings
  scene('settings');
  say('Bring your own key (Qwen-VL by default) to read photos of your own drawings.');
  await click(page, page.getByTestId('open-settings'), 700);
  await wait(2600);
  say('The key stays in this browser and goes only to the provider you pick. The demo needs none.');
  await moveToEl(page, page.getByLabel('API key'), 700);
  await wait(2700);
  await page.keyboard.press('Escape');
  await wait(500);

  // 9 · Kiro
  scene('kiro');
  say('We built it spec-first with Kiro: steering, an EARS requirements spec, a design and a linked task list.');
  await page.goto(`${BASE}/__kiro/`);
  await page.evaluate(() => document.fonts.ready);
  await wait(4600);
  await page.evaluate(() => document.getElementById('req').scrollIntoView({ behavior: 'smooth' }));
  await wait(1000);
  say('Every requirement is a WHEN … THE SYSTEM SHALL line that tasks link back to.');
  await wait(3800);
  await page.evaluate(() => document.getElementById('tasks').scrollIntoView({ behavior: 'smooth' }));
  await wait(1000);
  say('Kiro implemented the tasks in headless waves and ticked them off.');
  await wait(3400);
  await page.evaluate(() => document.getElementById('hooks').scrollIntoView({ behavior: 'smooth' }));
  await wait(1000);
  say('Agent hooks fired on every save: lint, netlist tests, and a spirit-tone review that hunts for leaked keys.');
  await wait(4200);
  await page.evaluate(() => document.getElementById('hand').scrollIntoView({ behavior: 'smooth' }));
  await wait(1000);
  say('When the free credits ran out, we finished by hand, and logged every hand-written file.');
  await wait(4000);

  // 10 · closing card over the CRT
  scene('closing');
  quiet();
  await page.goto(`${BASE}/?nointro`);
  await page.getByRole('tab', { name: 'Bench' }).click();
  await page.getByTestId('bench-rc-lowpass').click();
  await traceReady(page);
  quiet();
  await wait(1200);
  await page.evaluate(
    ([repo]) => {
      const d = document.createElement('div');
      d.style.cssText =
        'position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:rgba(1,6,3,0);transition:background 900ms;font-family:VT323,monospace;color:#39ff14;text-align:center';
      d.innerHTML = `<div style="opacity:0;transition:opacity 900ms 300ms" id="__card"><div style="font-size:120px;line-height:1;text-shadow:0 0 14px rgba(57,255,20,.7)">Circuit Séance</div><div style="font-size:64px;margin-top:6px;color:#b8ffc4;font-family:'Noto Sans CJK SC','PingFang SC',sans-serif">电路招魂</div><div style="font-size:40px;margin-top:26px;color:#7fd593">Berkeley SPICE (1973), resurrected in your browser.</div><div style="font-size:30px;margin-top:30px;color:#ffb000">Kiroween 2026 · Resurrection · MIT${repo ? ' · ' + repo : ''}</div></div>`;
      document.body.appendChild(d);
      requestAnimationFrame(() => {
        d.style.background = 'rgba(1,6,3,0.86)';
        document.getElementById('__card').style.opacity = '1';
      });
    },
    [REPO_URL],
  );
  say('Circuit Séance · 电路招魂. Berkeley SPICE, resurrected in your browser.');
  await wait(6200);
  quiet();
}

// ------------------------------------------------------------------ captions + mp4
const ts = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, '0')}`;
};
function wrap(text, max = 62) {
  const words = text.split(' ');
  const out = [''];
  for (const w of words) {
    if ((out[out.length - 1] + ' ' + w).trim().length > max && out[out.length - 1]) out.push(w);
    else out[out.length - 1] = (out[out.length - 1] + ' ' + w).trim();
  }
  return out.join('\n');
}
// docs/demo/*.srt is clean (for YouTube); the burned copy carries {\an8} for top-of-frame cues
function writeSrt(lead) {
  const make = (tags) =>
    cues
      .map((c, i) => {
        const end = Math.min(c.end ?? c.start + 4, c.start + 9);
        return `${i + 1}\n${ts(c.start - lead + 0.15)} --> ${ts(end - lead - 0.05)}\n${tags && c.top ? '{\\an8}' : ''}${wrap(c.text)}\n`;
      })
      .join('\n');
  writeFileSync(join(OUT, 'circuit-seance-demo.en.srt'), make(false));
  writeFileSync(BURN_SRT, make(true));
}

function encode(webm, duration, cut = 0) {
  const srt = BURN_SRT;
  const mp4 = join(OUT, 'circuit-seance-demo.mp4');
  // encode to /tmp first: the +faststart rewrite fails on some network/overlay filesystems
  const tmp = join(tmpdir(), `circuit-seance-demo-${process.pid}.mp4`);
  const style = [
    'FontName=DejaVu Sans',
    'FontSize=12',
    'PrimaryColour=&H00E8FFEC',
    'OutlineColour=&H50000000',
    'BackColour=&H50000000',
    'BorderStyle=3',
    'Outline=6',
    'Shadow=0',
    'MarginV=18',
    'Alignment=2',
  ].join(',');
  const vf = `scale=1920:1080:flags=lanczos,subtitles='${srt.replace(/'/g, "\\'")}':force_style='${style}':original_size=1920x1080`;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-ss', cut.toFixed(2), '-i', webm];
  if (!process.env.NO_AUDIO) {
    // quiet ambient drone (two detuned low sines with a slow swell), fades in and out
    const d = duration.toFixed(2);
    args.push(
      '-f',
      'lavfi',
      '-i',
      `aevalsrc='0.05*sin(2*PI*55*t)*(0.6+0.4*sin(2*PI*0.07*t))+0.035*sin(2*PI*82.6*t)+0.02*sin(2*PI*110.3*t)*(0.5+0.5*sin(2*PI*0.11*t))':s=48000:d=${d}`,
    );
    args.push('-filter_complex', `[0:v]${vf}[v];[1:a]afade=t=in:d=3,afade=t=out:st=${Math.max(0, duration - 4).toFixed(2)}:d=4[a]`, '-map', '[v]', '-map', '[a]', '-c:a', 'aac', '-b:a', '96k');
  } else {
    args.push('-vf', vf);
  }
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', '-t', duration.toFixed(2), tmp);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  copyFileSync(tmp, mp4);
  rmSync(tmp);
  return mp4;
}

function probeDuration(f) {
  return Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());
}

// ------------------------------------------------------------------ main
async function main() {
  const vi = process.argv.indexOf('--viewer-html');
  if (vi > 0) {
    // debug: write the Kiro viewer page (serve it next to dist/ so /assets fonts resolve)
    writeFileSync(process.argv[vi + 1], kiroViewerHtml());
    return;
  }
  if (process.argv.includes('--encode-only')) {
    // re-burn captions / re-encode from the last capture without re-recording
    const meta = JSON.parse(readFileSync(join(OUT, 'scenes.json'), 'utf8'));
    cues.push(...meta.cues);
    writeSrt(meta.lead ?? 0);
    const mp4 = encode(join(RAW, 'circuit-seance-demo.webm'), meta.duration, meta.cut ?? 0);
    log('wrote', relative(ROOT, mp4), `${(statSync(mp4).size / 1e6).toFixed(1)} MB`);
    return;
  }
  await startServer();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  for (const f of readdirSync(RAW)) rmSync(join(RAW, f));
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    recordVideo: { dir: RAW, size: { width: VW, height: VH } },
    locale: 'en-US',
    colorScheme: 'dark',
  });
  await ctx.addInitScript(cursorScript);
  const viewer = kiroViewerHtml();
  await ctx.route('**/__kiro/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: viewer }));
  // demo mode must stay offline: block (and count) anything that leaves localhost
  const external = [];
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => {
    external.push(r.request().url());
    return r.abort();
  });
  const page = await ctx.newPage();
  T0 = Date.now();
  // dark first frame instead of white while the app loads
  await page.setContent('<html style="background:#010603"></html>');
  try {
    await film(page);
  } finally {
    quiet();
    const video = page.video();
    const filmEnd = now();
    await ctx.close();
    await browser.close();
    server?.kill();
    const raw = await video.path();
    const webm = join(RAW, 'circuit-seance-demo.webm');
    renameSync(raw, webm);
    // the capture starts a little after T0 (offset); trim the dark frames before the intro (cut)
    const rawDur = probeDuration(webm);
    const offset = Math.max(0, filmEnd - rawDur);
    const cut = Math.max(0, introAt - offset - 0.3);
    const lead = offset + cut;
    const total = rawDur - cut;
    log(`raw ${rawDur.toFixed(1)} s, offset ${offset.toFixed(2)} s, cut ${cut.toFixed(2)} s → ${total.toFixed(1)} s; external requests: ${external.length}`);
    writeSrt(lead);
    writeFileSync(
      join(OUT, 'scenes.json'),
      JSON.stringify(
        {
          duration: Number(total.toFixed(2)),
          lead: Number(lead.toFixed(2)),
          cut: Number(cut.toFixed(2)),
          external,
          scenes: scenes.map((s) => ({ ...s, start: Number((s.start - lead).toFixed(2)) })),
          cues: cues.map((c) => ({ start: Number(c.start.toFixed(3)), end: Number((c.end ?? c.start + 4).toFixed(3)), text: c.text, top: !!c.top })),
        },
        null,
        2,
      ),
    );
    const mp4 = encode(webm, total, cut);
    log('wrote', relative(ROOT, mp4), `${(statSync(mp4).size / 1e6).toFixed(1)} MB`);
  }
}

main().catch((e) => {
  console.error(e);
  server?.kill();
  process.exit(1);
});
