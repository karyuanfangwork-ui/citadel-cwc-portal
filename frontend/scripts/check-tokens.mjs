#!/usr/bin/env node
/**
 * check-tokens.mjs — Design-system ratchet for hex-literal usage.
 *
 * Scans pages/ and src/ for raw hex color literals in .ts/.tsx files and
 * compares per-file counts against scripts/check-tokens.baseline.json.
 *
 *   - Fails when any file's hex count rises above its baseline.
 *   - Fails when a previously-clean file (or a brand-new file) introduces hex.
 *   - Allows counts to drop — just run `npm run check:tokens:update` to re-record.
 *
 * Goal: stop the bleeding on the ~1,127 hex literals (see C4 in the UI/UX audit)
 * without forcing a single mega-PR. Migrate files to tokens at your own pace;
 * the ratchet guarantees we never go backwards.
 *
 * Allowlisted files (token sources of truth):
 *   - src/styles/tokens.css
 *   - tailwind.theme.extend.ts
 *   - index.css
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_PATH = join(__dirname, 'check-tokens.baseline.json');

const SCAN_DIRS = ['pages', 'src'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '__tests__', '.test.tsx', 'test']);
const IGNORE_FILES = new Set([
  // token sources — raw hex is intentional here
  'src/styles/tokens.css',
  'tailwind.theme.extend.ts',
]);

// Match 3- or 6-digit hex literals not preceded by an alphanumeric (so we
// skip refs like "REQ-1A2B3C"). Allows quotes, parens, # at line start, etc.
const HEX_RE = /(?<![A-Za-z0-9_-])#[0-9a-fA-F]{6}\b|(?<![A-Za-z0-9_-])#[0-9a-fA-F]{3}\b/g;

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, acc);
    } else {
      const ext = full.slice(full.lastIndexOf('.'));
      if (!EXTENSIONS.has(ext)) continue;
      if (entry.endsWith('.test.tsx') || entry.endsWith('.test.ts') || entry.endsWith('.spec.tsx') || entry.endsWith('.spec.ts')) continue;
      acc.push(full);
    }
  }
  return acc;
}

function countHexInFile(absPath) {
  const src = readFileSync(absPath, 'utf8');
  const matches = src.match(HEX_RE);
  return matches ? matches.length : 0;
}

function buildCurrent() {
  const counts = {};
  for (const sub of SCAN_DIRS) {
    const start = join(ROOT, sub);
    if (!existsSync(start)) continue;
    for (const file of walk(start)) {
      const rel = relative(ROOT, file).split('\\').join('/');
      if (IGNORE_FILES.has(rel)) continue;
      const n = countHexInFile(file);
      if (n > 0) counts[rel] = n;
    }
  }
  return counts;
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function writeBaseline(counts) {
  // Stable, sorted output for clean diffs
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

function main() {
  const mode = process.argv[2]; // undefined | 'update'
  const current = buildCurrent();
  const total = Object.values(current).reduce((a, b) => a + b, 0);

  if (mode === 'update') {
    writeBaseline(current);
    console.log(`✓ baseline updated — ${Object.keys(current).length} files, ${total} hex literals`);
    return;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    writeBaseline(current);
    console.log(`✓ baseline created at scripts/check-tokens.baseline.json`);
    console.log(`  ${Object.keys(current).length} files contain hex literals (total: ${total}).`);
    console.log(`  From now on, any increase will fail this check.`);
    return;
  }

  const violations = [];
  for (const [file, count] of Object.entries(current)) {
    const allowed = baseline[file] ?? 0;
    if (count > allowed) {
      violations.push({ file, allowed, count, delta: count - allowed, kind: allowed === 0 ? 'new' : 'increase' });
    }
  }

  // Files that dropped to 0 OR decreased — informational only
  const improvements = [];
  for (const [file, allowed] of Object.entries(baseline)) {
    const count = current[file] ?? 0;
    if (count < allowed) improvements.push({ file, was: allowed, now: count });
  }

  if (improvements.length > 0) {
    console.log(`✓ ${improvements.length} file(s) reduced their hex count:`);
    for (const i of improvements.slice(0, 10)) {
      console.log(`    ${i.file}  ${i.was} → ${i.now}`);
    }
    console.log(`  Run \`npm run check:tokens:update\` to lock in the improvement.`);
    console.log('');
  }

  if (violations.length === 0) {
    const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
    console.log(`✓ no new hex literals — ${total} total (baseline: ${baseTotal})`);
    return;
  }

  console.error(`✗ design-token ratchet failed — ${violations.length} file(s) added hex literals:\n`);
  for (const v of violations) {
    if (v.kind === 'new') {
      console.error(`  NEW   ${v.file}  +${v.count} hex literal(s)`);
    } else {
      console.error(`  ↑     ${v.file}  ${v.allowed} → ${v.count}  (+${v.delta})`);
    }
  }
  console.error('');
  console.error('Use design tokens instead of raw hex:');
  console.error('  • Colors:  var(--color-brand-700), var(--color-it-500), var(--color-danger), …');
  console.error('  • Tailwind: text-brand-700, bg-it-50, border-cwc-border, …');
  console.error('  • Token source: frontend/src/styles/tokens.css');
  console.error('');
  console.error('If a hex really must be added (e.g. third-party brand color), justify in PR and run:');
  console.error('  npm run check:tokens:update');
  process.exit(1);
}

main();
