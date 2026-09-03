import type { ValidationFinding } from '../../services/workflow-version.service';

interface WorkflowParityPanelProps {
  blocking: ValidationFinding[];
  warnings: ValidationFinding[];
  nodeCount: number;
  versionLabel: string;
}

export default function WorkflowParityPanel({ blocking, warnings, nodeCount, versionLabel }: WorkflowParityPanelProps) {
  const runtimeMissing = blocking.filter((finding) => finding.code === 'RUNTIME_STATUS_MISSING_FROM_GRAPH').length;
  const occupiedMissing = blocking.filter((finding) => finding.code === 'STATUS_IN_USE_REMOVED').length;
  return <section className="border-b border-[#dbe3ef] bg-[#f7f9fc] px-6 py-2" aria-label="Workflow parity summary">
    <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3 text-xs text-[#44546f]">
      <strong className="text-[#101418]">Parity · {versionLabel}</strong>
      <span>{nodeCount} graph statuses</span>
      <span className={runtimeMissing ? 'font-semibold text-[#b42318]' : 'text-[#18794e]'}>{runtimeMissing} runtime-only</span>
      <span className={occupiedMissing ? 'font-semibold text-[#b42318]' : 'text-[#18794e]'}>{occupiedMissing} occupied missing</span>
      <span>{warnings.length} warnings</span>
      {blocking.length > 0 && <span className="font-semibold text-[#b42318]">Review blocking findings before publish</span>}
    </div>
  </section>;
}
