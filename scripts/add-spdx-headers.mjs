#!/usr/bin/env node
/**
 * Batch-insert SPDX license headers into .ts/.tsx source files.
 *
 * Usage:  node scripts/add-spdx-headers.mjs
 *
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 CtxPilot
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const HEADER = '// SPDX-License-Identifier: MIT\n// Copyright (c) 2026 CtxPilot\n\n';

const DIRS = [
  join(ROOT, 'shared'),
  join(ROOT, 'server', 'src'),
  join(ROOT, 'client', 'src'),
];

let total = 0;
let skipped = 0;
let written = 0;

for (const dir of DIRS) {
  if (!existsSync(dir)) {
    console.warn(`[SKIP] directory not found: ${dir}`);
    continue;
  }
  walk(dir);
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  total++;
  let content = readFileSync(filePath, 'utf-8');
  const relPath = relative(ROOT, filePath);

  // Skip if header already present
  if (content.startsWith('// SPDX-License-Identifier')) {
    skipped++;
    return;
  }

  // Check for a shebang line (very rare in .ts but possible)
  if (content.startsWith('#!')) {
    const firstNewline = content.indexOf('\n');
    content = content.slice(0, firstNewline + 1) + HEADER + content.slice(firstNewline + 1);
  } else {
    content = HEADER + content;
  }

  writeFileSync(filePath, content, 'utf-8');
  written++;
  console.log(`  + ${relPath}`);
}

console.log(`\nDone. Scanned: ${total} | Headers added: ${written} | Already had: ${skipped}`);
