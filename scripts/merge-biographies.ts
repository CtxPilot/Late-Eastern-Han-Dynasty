// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Merge docs/biographies/officer_{id}.md into server/src/data/officers.json biography field.
 *
 * Markdown files may contain HTML comments (<!-- -->) for internal notes (references, copyright);
 * these are stripped before merging—only the prose body becomes the biography field value.
 *
 * Run: `tsx scripts/merge-biographies.ts` (after editing Markdown, before commit).
 * See docs/15-linux-ui-spec.md §3.1 for the design rationale (PR-friendly Markdown + build merge).
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BIO_DIR = join(ROOT, 'docs', 'biographies');
const OFFICERS_FILE = join(ROOT, 'server', 'src', 'data', 'officers.json');

function stripHtmlComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function main(): void {
  if (!existsSync(BIO_DIR)) {
    console.error(`No biography directory: ${BIO_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(BIO_DIR).filter((f) => /^officer_\d+\.md$/.test(f));
  if (files.length === 0) {
    console.log('No officer_N.md files found; nothing to merge.');
    return;
  }

  const officers = JSON.parse(readFileSync(OFFICERS_FILE, 'utf-8')) as Array<{ id: number; name?: string; biography?: string } & Record<string, unknown>>;
  let merged = 0;
  let warned = 0;

  for (const f of files) {
    const match = f.match(/^officer_(\d+)\.md$/);
    if (!match) continue;
    const id = Number(match[1]);
    const content = stripHtmlComments(readFileSync(join(BIO_DIR, f), 'utf-8'));
    const officer = officers.find((o) => o.id === id);
    if (officer) {
      officer.biography = content;
      merged++;
      console.log(`  merged: officer id=${id} ${officer.name ?? ''} (${content.length} chars)`);
    } else {
      console.warn(`  WARN: officer id=${id} not found in officers.json`);
      warned++;
    }
  }

  writeFileSync(OFFICERS_FILE, JSON.stringify(officers, null, 2) + '\n', 'utf-8');
  console.log(`\nMerged ${merged} biographies (warned ${warned}) into ${OFFICERS_FILE}`);
}

main();
