/**
 * Verify bundled example netlists with eecircuit-engine (one engine instance, reused).
 * Run: node scripts/verify-examples.mjs [dir...]
 */
import { Simulation } from 'eecircuit-engine';
import fs from 'node:fs';
import path from 'node:path';

const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ['src/examples'];
const files = dirs.flatMap((d) =>
  fs.readdirSync(d).filter((f) => f.endsWith('.net')).map((f) => path.join(d, f)),
);
const sim = new Simulation();
await sim.start();
let failed = 0;
for (const f of files) {
  sim.setNetList(fs.readFileSync(f, 'utf8'));
  try {
    const r = await sim.runSim();
    if (!r || r.numPoints < 1) throw new Error('no points');
    const ranges = r.data
      .filter((d) => d.name !== 'time' && d.name.startsWith('v(') && typeof d.values[0] === 'number')
      .map((d) => `${d.name}[${Math.min(...d.values).toFixed(2)},${Math.max(...d.values).toFixed(2)}]`);
    console.log(`OK   ${f}: ${r.numPoints} pts ${ranges.join(' ')}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${f}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
