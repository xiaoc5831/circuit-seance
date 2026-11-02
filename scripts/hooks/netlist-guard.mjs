#!/usr/bin/env node
/**
 * netlist-guard.mjs
 * Kiro PostFileSave hook — runs related Vitest tests when a netlist/simulate
 * source file is saved.  Exits non-zero (with test output on stderr) on
 * failure so the agent sees the result.
 *
 * Kiro passes event data as JSON on STDIN.
 * We probe several field names: filePath, file_path, path,
 * tool_input.path / file_path / filePath, and any string field ending in
 * a netlist or TypeScript extension.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';

// ── 1. Read all of STDIN ────────────────────────────────────────────────────
const raw = await new Promise((res) => {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { buf += chunk; });
  process.stdin.on('end', () => res(buf));
});

// ── 2. Parse JSON defensively ───────────────────────────────────────────────
let event = {};
try {
  event = JSON.parse(raw);
} catch {
  process.exit(0);
}

// ── 3. Find the saved file path ─────────────────────────────────────────────
const RELEVANT_EXTS = /\.(ts|tsx|cir|sp)$/;

function extractPath(obj) {
  if (!obj || typeof obj !== 'object') return null;

  for (const key of ['filePath', 'file_path', 'path']) {
    if (typeof obj[key] === 'string' && RELEVANT_EXTS.test(obj[key])) return obj[key];
  }

  if (obj.tool_input && typeof obj.tool_input === 'object') {
    for (const key of ['path', 'file_path', 'filePath']) {
      if (typeof obj.tool_input[key] === 'string' && RELEVANT_EXTS.test(obj.tool_input[key])) {
        return obj.tool_input[key];
      }
    }
  }

  // Fallback: any string field ending with a relevant extension
  for (const val of Object.values(obj)) {
    if (typeof val === 'string' && RELEVANT_EXTS.test(val)) return val;
  }

  return null;
}

const filePath = extractPath(event);

if (!filePath) process.exit(0);

// ── 4. Guard: must be inside src/ ───────────────────────────────────────────
const abs = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
if (!abs.includes('/src/')) process.exit(0);

// ── 5. Guard: project must be bootstrapped ──────────────────────────────────
if (!existsSync('package.json') || !existsSync('node_modules')) process.exit(0);

// ── 6. Run vitest related --run <file> ──────────────────────────────────────
try {
  execSync(`npx --no-install vitest related --run "${abs}"`, {
    stdio: ['ignore', 'inherit', 'inherit'],
    timeout: 60_000,
  });
} catch (err) {
  // Re-emit the error so the agent sees the test failure
  process.stderr.write(`\n[netlist-guard] Tests failed for ${abs}\n`);
  process.exit(1);
}

process.exit(0);
