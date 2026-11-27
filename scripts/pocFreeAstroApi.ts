/**
 * Isolated Proof of Concept — FreeAstroAPI Benchmark CLI (New Delhi 1988 Reference Profile)
 *
 * Usage:
 *   FREE_ASTRO_API_KEY=... npx tsx scripts/pocFreeAstroApi.ts
 *   (or place FREE_ASTRO_API_KEY in .env.local / .env)
 *
 * Zero production changes, zero DB writes, does NOT alter FREE_ASTROLOGY_API_KEY.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dotenv from 'dotenv';
import { runFreeAstroApiPocBenchmark } from '../server/services/freeAstroApiPocRunner';

dotenv.config({ path: ['.env.local', '.env'], override: false });

async function run() {
  const apiKey = (process.env.FREE_ASTRO_API_KEY || '').trim();
  if (!apiKey) {
    console.error('\n[FreeAstroAPI PoC] FREE_ASTRO_API_KEY is not set.');
    console.error('Configure it securely without overwriting FREE_ASTROLOGY_API_KEY:');
    console.error('  1) Local dev: add FREE_ASTRO_API_KEY=<your_key> to .env.local (gitignored)');
    console.error('  2) Production Cloudflare Worker: npx wrangler secret put FREE_ASTRO_API_KEY');
    console.error('  3) Or run the benchmark from /app/admin/birth-chart after deploying.\n');
    process.exit(1);
  }

  const report = await runFreeAstroApiPocBenchmark({
    apiKey,
    onProgress: (msg) => console.log(msg),
  });

  const outPath = path.join(os.tmpdir(), 'freeastroapi-poc-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n==================== SUMMARY ====================');
  console.log(JSON.stringify(report.performanceSummary, null, 2));
  console.log(JSON.stringify(report.audits, null, 2));
  console.log(`\nFull machine-generated JSON responses saved to: ${outPath}`);
}

run().catch((err) => {
  console.error('Fatal PoC error:', err);
  process.exit(1);
});
