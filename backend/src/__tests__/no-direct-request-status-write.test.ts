/**
 * Task 15: Architecture test — no direct request status writes outside the command boundary.
 *
 * SCANS all production source files and flags `prisma.request.update` / `updateMany`
 * calls that modify the `status` field outside of the allowed locations.
 *
 * Allowed:
 * - workflowCommand.service.ts (the versioned transaction boundary)
 * - requestTransition.service.ts (delegates to workflowCommand)
 *
 * Known legacy call sites that have NOT been migrated yet are listed in
 * KNOWN_LEGACY_SITES. New violations will fail the test; legacy sites
 * are logged as warnings.
 */

import fs from 'fs';
import path from 'path';

const SRC_DIR = path.resolve(__dirname, '../../src');

const EXEMPT_PATTERNS = [
  '__tests__',
  '.test.ts',
  '.spec.ts',
  'migrations',
  'workflowCommand.service.ts',
  'requestTransition.service.ts',
];

// Legacy call sites not yet migrated to the command boundary.
// These are logged as warnings but do NOT fail the test.
// Each migration removes an entry here.
const KNOWN_LEGACY_SITES = [
  'controllers/screening.controller.ts',
  'controllers/finance-workflow.controller.ts',
  'controllers/offboarding.controller.ts',
  'controllers/chargeback-workflow.controller.ts',
  'controllers/onboarding.controller.ts',
  'controllers/interview.controller.ts',
  'controllers/esm-workflow.controller.ts',
  'controllers/loa.controller.ts',
  'controllers/request.controller.ts',
  'controllers/approval.controller.ts',
];

function isExempt(filePath: string): boolean {
  return EXEMPT_PATTERNS.some((pattern) => filePath.includes(pattern));
}

function isLegacy(filePath: string): boolean {
  return KNOWN_LEGACY_SITES.some((site) => filePath.endsWith(site));
}

function scanForDirectStatusWrites(dir: string): Array<{ file: string; line: number; content: string }> {
  const violations: Array<{ file: string; line: number; content: string }> = [];

  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        if (isExempt(fullPath)) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (
            (line.includes('request.update(') || line.includes('request.updateMany(')) &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*')
          ) {
            const nearbyLines = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 10)).join('\n');
            if (nearbyLines.includes('status:') || nearbyLines.includes("status: '")) {
              violations.push({
                file: fullPath.replace(SRC_DIR + path.sep, ''),
                line: i + 1,
                content: line.trim(),
              });
            }
          }
        }
      }
    }
  }

  walk(dir);
  return violations;
}

describe('Architecture: no direct request status writes outside command boundary', () => {
  it('flags new direct request status writes not in the known legacy list', () => {
    const violations = scanForDirectStatusWrites(SRC_DIR);

    const newViolations = violations.filter((v) => !isLegacy(v.file));
    const legacyViolations = violations.filter((v) => isLegacy(v.file));

    if (legacyViolations.length > 0) {
      console.warn(
        `[Task 15] ${legacyViolations.length} legacy direct status writes remain in known controllers. ` +
        'These should be migrated to transitionRequest() / executeWorkflowCommand().',
      );
    }

    if (newViolations.length > 0) {
      const details = newViolations
        .map((v) => `  ${v.file}:${v.line} — ${v.content}`)
        .join('\n');
      fail(
        `Found NEW direct request status writes outside the command boundary:\n${details}\n\n` +
        'All request status changes must go through executeWorkflowCommand() or transitionRequest(). ' +
        'If this is a known legacy site, add it to KNOWN_LEGACY_SITES.',
      );
    }

    // No NEW violations
    expect(newViolations.length).toBe(0);
  });
});