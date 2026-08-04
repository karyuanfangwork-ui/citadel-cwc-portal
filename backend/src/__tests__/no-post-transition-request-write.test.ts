/**
 * Fitness test: workflow controllers must not write Request scalars outside the
 * command boundary.
 *
 * `no-direct-request-status-write.test.ts` guards the `status` field only, so a
 * controller can still commit a transition and then write customFields in a
 * second, non-atomic statement. Those writes belong in
 * WorkflowCommand.requestPatch or transactionMutations.
 *
 * ALLOWLIST is a debt ledger. It may shrink; it must never grow.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const CONTROLLER_DIR = path.join(__dirname, '..', 'controllers');

const WORKFLOW_CONTROLLERS = [
  'esm-workflow.controller.ts',
  'finance-workflow.controller.ts',
  'it-workflow.controller.ts',
  'chargeback-workflow.controller.ts',
  'offboarding.controller.ts',
];

// Populate by running this test once and pasting the reported sites.
// Each entry is "filename:line" (1-indexed).
const ALLOWLIST = new Set<string>([
  // Legitimate: tx.request.update inside $transaction for admin CEO-approver reassignment
  // (read-modify-return pattern returning updated request for API response)
  'esm-workflow.controller.ts:393',
  // Legitimate: tx.request.update inside $transaction for DCEO approver change
  'finance-workflow.controller.ts:503',
  // Data-sync: customFields.lastDay propagation from offboarding model
  'offboarding.controller.ts:228',
]);

function findRequestUpdates(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.ES2022,
    true,
  );
  const hits: string[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ['update', 'updateMany', 'upsert'].includes(node.expression.name.text)
    ) {
      const target = node.expression.expression;
      // Matches `prisma.request.update(...)` and `tx.request.update(...)`.
      if (ts.isPropertyAccessExpression(target) && target.name.text === 'request') {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        hits.push(`${path.basename(file)}:${line + 1}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

describe('workflow controllers do not write Request outside the command boundary', () => {
  it('has no un-allowlisted direct Request writes', () => {
    const violations: string[] = [];
    for (const name of WORKFLOW_CONTROLLERS) {
      const file = path.join(CONTROLLER_DIR, name);
      if (!fs.existsSync(file)) continue;
      for (const hit of findRequestUpdates(file)) {
        if (!ALLOWLIST.has(hit)) violations.push(hit);
      }
    }
    expect(violations).toEqual([]);
  });

  it('does not allowlist sites that no longer exist', () => {
    const present = new Set(
      WORKFLOW_CONTROLLERS.flatMap((name) => {
        const file = path.join(CONTROLLER_DIR, name);
        return fs.existsSync(file) ? findRequestUpdates(file) : [];
      }),
    );
    const stale = [...ALLOWLIST].filter((entry) => !present.has(entry));
    expect(stale).toEqual([]);
  });
});