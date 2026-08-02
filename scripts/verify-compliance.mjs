// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tracked = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);
const failures = [];
const fail = (message) => failures.push(message);

const privatePrefixes = [
  '.crush/', '.playwright-mcp/', '.omo/', '.opencode/', '.zcode/', '.codegraph/',
  'agent-exports/', 'audit-evidence/',
];
for (const directory of ['.crush', '.playwright-mcp', '.omo', '.opencode', '.zcode', '.codegraph']) {
  const path = resolve(root, directory);
  if (existsSync(path) && (statSync(path).mode & 0o077) !== 0) {
    fail(`private artifact directory is not owner-only (expected 0700): ${directory}`);
  }
}
for (const file of ['.crush/crush.db', '.crush/crush.db-wal', '.crush/crush.db-shm', '.crush/logs/crush.log']) {
  const path = resolve(root, file);
  if (existsSync(path) && (statSync(path).mode & 0o077) !== 0) {
    fail(`private artifact file is not owner-only (expected 0600): ${file}`);
  }
}
for (const path of tracked) {
  if (privatePrefixes.some((prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix))) fail(`tracked private artifact: ${path}`);
  if (/^client\/public\/portraits\/.*\.png$/i.test(path)) fail(`unapproved raster portrait: ${path}`);
}

// Ignored files are not safe merely because Git does not list them.  Explicitly
// block high-risk local asset buckets so an untracked portrait/demo cannot enter
// a release or silently influence a screenshot review.
const forbiddenIgnoredRoots = [
  'assets/portraits',
  'client/public/portraits',
];
for (const relativeRoot of forbiddenIgnoredRoots) {
  const absoluteRoot = resolve(root, relativeRoot);
  if (!existsSync(absoluteRoot)) continue;
  const entries = readdirSync(absoluteRoot, { withFileTypes: true });
  if (entries.length > 0) fail(`forbidden ignored asset directory is non-empty: ${relativeRoot}`);
}
for (const filename of ['map_battleground_procedural_engine.html', 'map_battleground_procedural_engine (1).html']) {
  if (existsSync(resolve(root, filename))) fail(`quarantined external demo recreated in workspace: ${filename}`);
}

const binaryExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.ogg', '.wav']);
for (const path of tracked.filter((item) => binaryExtensions.has(extname(item).toLowerCase()))) {
  const allowed = path === 'client/public/geo-basemap.png'
    || path.startsWith('docs/screenshots/')
    || path === 'client/public/favicon.svg';
  if (!allowed) fail(`asset lacks manifest rule: ${path}`);
}
const screenshotCount = tracked.filter((path) => path.startsWith('docs/screenshots/') && path.endsWith('.png')).length;
if (screenshotCount !== 125) fail(`screenshot inventory changed without manifest update: ${screenshotCount}`);

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.py']);
for (const path of tracked.filter((item) => sourceExtensions.has(extname(item)))) {
  if (!readFileSync(resolve(root, path), 'utf8').includes('SPDX-License-Identifier:')) {
    fail(`missing SPDX identifier: ${path}`);
  }
}

const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html', '.py', '.md', '.json', '.yml', '.yaml', '.toml']);
const sensitivePatterns = [
  ['private key', new RegExp('BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY')],
  ['GitHub token', new RegExp('gh' + '[pousr]_[A-Za-z0-9]{30,}')],
  ['AWS access key', new RegExp('AK' + 'IA[0-9A-Z]{16}')],
  ['PRC identity number', /\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]\b/],
  ['PRC mobile number', /(?<!\d)1[3-9]\d{9}(?!\d)/],
];
for (const path of tracked.filter((item) => textExtensions.has(extname(item).toLowerCase()))) {
  if (path === 'scripts/verify-compliance.mjs') continue;
  const text = readFileSync(resolve(root, path), 'utf8');
  for (const [label, pattern] of sensitivePatterns) {
    if (pattern.test(text)) fail(`${label} pattern in tracked text: ${path}`);
  }
}

for (const path of tracked.filter((item) => item.endsWith('.md') && !item.startsWith('docs/reviews/'))) {
  const text = readFileSync(resolve(root, path), 'utf8');
  for (const phrase of ['95% 可搬', '移植用户 demo', '移植用户 Demo']) {
    if (text.includes(phrase)) fail(`retired external-demo instruction in ${path}: ${phrase}`);
  }
}

const geoHash = createHash('sha256')
  .update(readFileSync(resolve(root, 'client/public/geo-basemap.png'))).digest('hex');
if (geoHash !== '6a1870cfb2ec530b7447b7f1d6138a05ab639424b3ac547f9c2e4e190fa7bce1') {
  fail(`Natural Earth output hash changed without manifest update: ${geoHash}`);
}

const expectedFonts = new Map([
  ['NotoSerifCJKsc-Regular.woff2', 'f76a4c2b177d8fe6b3a15197e17c0d2dd26129b7af99b7e1cf1a77fe9215cdb5'],
  ['NotoSerifCJKsc-Bold.woff2', '7dc0feb5d15b5979bafd55118f1111328ef9e7ac77fad1c44cee48b1d1da332a'],
  ['MaShanZheng-Regular.woff2', 'f3178053ce6bad1c47ba1c2ae6cec4382daacfbfa8f3479dabed1270dbba3e20'],
]);
for (const [name, expected] of expectedFonts) {
  const path = resolve(root, 'client/public/fonts', name);
  if (!existsSync(path)) continue;
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== expected) fail(`font checksum mismatch: ${name}`);
}
if (existsSync(resolve(root, 'client/public/fonts/MuYaoSoftBrush.woff2'))) {
  fail('misleading legacy font filename still present: MuYaoSoftBrush.woff2');
}

const licenseReport = JSON.parse(execFileSync('pnpm', ['licenses', 'list', '--json'], {
  cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
}));
const allowedLicenses = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-3-Clause', 'CC-BY-4.0']);
for (const license of Object.keys(licenseReport)) {
  if (!allowedLicenses.has(license)) fail(`unreviewed dependency license: ${license}`);
}

if (failures.length) {
  console.error(failures.map((message) => `FAIL: ${message}`).join('\n'));
  process.exit(1);
}
console.log(`compliance verification passed: ${tracked.length} tracked files, ${Object.keys(licenseReport).length} license classes`);
