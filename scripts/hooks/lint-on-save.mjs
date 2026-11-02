#!/usr/bin/env node
/**
 * lint-on-save.mjs
 * Kiro PostFileSave hook — runs ESLint + Prettier on the saved TypeScript file.
 *
 * Kiro passes event data as JSON on STDIN (not via env vars).
 * We probe several field names because the exact schema is not publicly
 * documented: filePath, file_path, path, tool_input.path, tool_input.file_path,
 * or any string field whose value ends with a relevant extension.
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
  // not JSON — nothing to do
  process.exit(0);
}

// ── 3. Find the saved file path ─────────────────────────────────────────────
const TS_EXTS = /\.(ts|tsx)$/;

function extractPath(obj) {
  if (!obj || typeof obj !== 'object') return null;

  // Probe known field names first
  for (const key of ['filePath', 'file_path', 'path']) {
    if (typeof obj[key] === 'string' && TS_EXTS.test(obj[key])) return obj[key];
  }

  // Probe nested tool_input
  if (obj.tool_input && typeof obj.tool_input === 'object') {
    for (const key of ['path', 'file_path', 'filePath']) {
      if (typeof obj.tool_input[key] === 'string' && TS_EXTS.test(obj.tool_input[key])) {
        return obj.tool_input[key];
      }
    }
  }

  // Fallback: any string field ending with a relevant extension
  for (const val of Object.values(obj)) {
    if (typeof val === 'string' && TS_EXTS.test(val)) return val;
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

// ── 6. Run ESLint --fix then Prettier --write ───────────────────────────────
try {
  execSync(`npx --no-install eslint --fix "${abs}"`, { stdio: 'inherit' });
} catch {
  // ESLint errors are informational — don't block the save
}

try {
  execSync(`npx --no-install prettier --write "${abs}"`, { stdio: 'inherit' });
} catch {
  // Same: don't block
}

process.exit(0);
