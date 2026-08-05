import { Link } from 'react-router-dom';
import type { WorkflowSummary } from '../../services/workflow-version.service';

interface WorkflowListCardProps {
  workflow: WorkflowSummary;
  onCreateDraft: (workflow: WorkflowSummary) => void;
}

export default function WorkflowListCard({ workflow, onCreateDraft }: WorkflowListCardProps) {
  const active = workflow.activeVersion;
  const draft = workflow.draftVersion;
  return (
    <article className="rounded-2xl border border-[#dbe3ef] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#8993a4]">{workflow.code}</p>
          <h2 className="mt-1 text-xl font-black text-[#101418]">{workflow.name}</h2>
        </div>
        <span className="rounded-full bg-[#e8f7ed] px-2.5 py-1 text-xs font-bold text-[#18794e]">
          {active ? `Active v${active.version}` : 'No active version'}
        </span>
      </div>
      <p className="mt-4 text-sm text-[#44546f]">
        Bound request types: <span className="font-semibold text-[#101418]">{workflow.requestTypes.length}</span>
        {' · '}affects {workflow.requestTypes.length} request type{workflow.requestTypes.length === 1 ? '' : 's'}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {draft && <span className="rounded-full bg-[#fff4d6] px-2.5 py-1 text-xs font-bold text-[#8a5a00]">Draft v{draft.version}</span>}
        {active && <Link className="rounded-lg border border-[#b9c8de] px-3 py-2 text-sm font-semibold text-[#334a70] hover:bg-[#f7f9fc]" to={`/admin/workflows/${workflow.id}/versions/${active.id}`}>Open active</Link>}
        {draft ? <Link className="rounded-lg bg-[#0052cc] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0041a3]" to={`/admin/workflows/${workflow.id}/versions/${draft.id}`}>Open draft</Link> : <button className="rounded-lg bg-[#0052cc] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0041a3]" onClick={() => onCreateDraft(workflow)}>Create draft</button>}
      </div>
    </article>
  );
}
