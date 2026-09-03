import prisma from '../utils/prisma';
import { runWithExecutionScope } from '../lib/execution-scope';
import { inventoryWorkflowRuntimeParity, legacyRuntimeEvidenceProvider } from '../services/workflowRuntimeParity.service';

function parseArgs(argv: string[]): { workflowCode?: string; json: boolean } {
  const workflowIndex = argv.indexOf('--workflow');
  const workflowCode = workflowIndex >= 0 ? argv[workflowIndex + 1] : undefined;
  if (workflowIndex >= 0 && (!workflowCode || workflowCode.startsWith('--'))) {
    throw new Error('Usage: workflow:runtime-parity [--workflow CODE] [--json]');
  }
  return { workflowCode, json: argv.includes('--json') };
}

function printText(results: Awaited<ReturnType<typeof inventoryWorkflowRuntimeParity>>): void {
  for (const result of results) {
    console.log(`${result.workflow.code} — ${result.workflow.name}`);
    console.log(`  catalogue: ${result.statusDefinitions.length}`);
    console.log(`  graph: ${result.graph.statuses.length} statuses, ${result.graph.transitions.length} transitions`);
    console.log(`  compiled: ${result.compiled.steps.length} steps, ${result.compiled.transitions.length} transitions`);
    console.log(`  runtime evidence: ${result.runtimeStatusEvidence.length}`);
    console.log(`  request occupancy: ${result.requestOccupancy.map((row) => `${row.status}=${row.count}`).join(', ') || 'none'}`);
    console.log(`  findings: ${result.findings.length}`);
    for (const finding of result.findings) console.log(`    ${finding.code}${finding.status ? ` ${finding.status}` : finding.transition ? ` ${finding.transition}` : ''}: ${finding.detail}`);
  }
}

async function main(): Promise<void> {
  return runWithExecutionScope({ kind: 'platform', actorId: 'workflow-runtime-parity', reason: 'read-only workflow runtime parity audit' }, async () => {
    const options = parseArgs(process.argv.slice(2));
    const results = await inventoryWorkflowRuntimeParity({ workflowCode: options.workflowCode, client: prisma, runtimeEvidenceProvider: legacyRuntimeEvidenceProvider });
    if (options.json) console.log(JSON.stringify(results, null, 2));
    else printText(results);
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }).finally(async () => {
    await prisma.$disconnect();
  });
}

main();
