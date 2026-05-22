#!/usr/bin/env node
/**
 * scripts/compress-violations.js
 * ═══════════════════════════════════════════════════════════════
 * Pre-compress violations.json with gzip before `next build`.
 * The SW caches this as-is; the browser decompresses automatically.
 *
 * Reduces the 3 MB violations.json to ~250 KB over the wire.
 *
 * Usage: node scripts/compress-violations.js
 *   or add to package.json scripts:
 *   "prebuild": "node scripts/compress-violations.js"
 * ═══════════════════════════════════════════════════════════════
 */

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const SRC  = path.join(__dirname, '..', 'public', 'violations.json');
const DEST = path.join(__dirname, '..', 'public', 'violations.json');   // overwrite (gzip)

if (!fs.existsSync(SRC)) {
  console.warn('[compress] violations.json not found at:', SRC);
  console.warn('[compress] Copy it from backend/data/legal/violations.json first.');
  process.exit(0);
}

const raw         = fs.readFileSync(SRC);
const originalKB  = (raw.length / 1024).toFixed(1);

zlib.gzip(raw, { level: zlib.constants.Z_BEST_COMPRESSION }, (err, compressed) => {
  if (err) {
    console.error('[compress] gzip failed:', err);
    process.exit(1);
  }

  // Write gzip-compressed file (same filename, served with Content-Encoding: gzip header)
  fs.writeFileSync(DEST, compressed);
  const compressedKB = (compressed.length / 1024).toFixed(1);
  const ratio        = ((1 - compressed.length / raw.length) * 100).toFixed(1);

  console.log(`[compress] violations.json: ${originalKB} KB → ${compressedKB} KB (${ratio}% smaller) ✓`);
});
