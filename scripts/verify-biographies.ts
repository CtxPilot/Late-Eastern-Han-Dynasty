// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Verify merge-biographies.ts output: 4 prototype officers have biography field,
 * content is non-empty, HTML comments stripped, key historical keywords present.
 *
 * Run: `npx tsx scripts/verify-biographies.ts`
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OFFICERS_FILE = join(ROOT, 'server', 'src', 'data', 'officers.json');

interface Officer { id: number; name: string; biography?: string }

const EXPECTED: Array<{ id: number; name: string; keyword: string }> = [
  { id: 1, name: '曹操', keyword: '字孟德' },
  { id: 4, name: '诸葛亮', keyword: '字孔明' },
  { id: 5, name: '吕布', keyword: '字奉先' },
  { id: 6, name: '关羽', keyword: '字云长' },
];

let pass = 0;
let fail = 0;

function assert(cond: boolean, msg: string): void {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); }
  else { fail++; console.error(`  ✗ ${msg}`); }
}

const officers = JSON.parse(readFileSync(OFFICERS_FILE, 'utf-8')) as Officer[];

for (const exp of EXPECTED) {
  const o = officers.find((x) => x.id === exp.id);
  assert(o != null, `${exp.name} (id=${exp.id}) found in officers.json`);
  if (!o) continue;
  assert(typeof o.biography === 'string' && o.biography.length > 50, `${exp.name} biography non-empty (>50 chars), got ${o.biography?.length ?? 0}`);
  assert(!o.biography?.includes('<!--'), `${exp.name} biography HTML comments stripped`);
  assert(o.biography?.includes(exp.keyword) ?? false, `${exp.name} biography contains "${exp.keyword}"`);
  assert(o.biography?.includes(exp.name) ?? false, `${exp.name} biography contains name "${exp.name}"`);
}

const noBio = officers.filter((o) => !EXPECTED.some((e) => e.id === o.id)).slice(0, 5);
for (const o of noBio) {
  assert(o.biography == null || o.biography === '', `${o.name} (id=${o.id}) has no biography (expected for non-prototype)`);
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);
