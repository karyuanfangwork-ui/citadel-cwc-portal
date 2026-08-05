import { Link } from 'react-router-dom';
import type { WorkflowSummary } from '../../services/workflow-version.service';

interface WorkflowListCardProps {
  workflow: WorkflowSummary;
  onCreateDraft: (workflow: WorkflowSummary) => void;
}

export default function WorkflowListCard({ workflow, onCreateDraft }: WorkflowListCardProps) {
  const active = workflow.activeVersion;
  const draft = workflow.draftVersion;
  const visibleTypes = workflow.requestTypes.slice(0, 3);
  const overflowTypes = workflow.requestTypes.slice(3);
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
      <div className="mt-4 flex flex-wrap items-center gap-1.5" data-testid="workflow-request-types">
        {workflow.requestTypes.length === 0 && (
          <span className="rounded-full border border-dashed border-[#e0c48a] px-2.5 py-1 text-xs font-semibold text-[#8a5a00]">
            Not bound to any request type
          </span>
        )}
        {visibleTypes.map((requestType) => (
          <span key={requestType.id} className="rounded-full bg-[#f1f4f9] px-2.5 py-1 text-xs font-semibold text-[#44546f]">
            {requestType.name}
          </span>
        ))}
        {overflowTypes.length > 0 && (
          <span
            className="rounded-full bg-[#f1f4f9] px-2.5 py-1 text-xs font-semibold text-[#8993a4]"
            title={overflowTypes.map((requestType) => requestType.name).join(', ')}
          >
            +{overflowTypes.length} more
          </span>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {draft && <span className="rounded-full bg-[#fff4d6] px-2.5 py-1 text-xs font-bold text-[#8a5a00]">Draft v{draft.version}</span>}
        {active && <Link className="rounded-lg border border-[#b9c8de] px-3 py-2 text-sm font-semibold text-[#334a70] hover:bg-[#f7f9fc]" to={`/admin/workflows/${workflow.id}/versions/${active.id}`}>Open active</Link>}
        {draft ? <Link className="rounded-lg bg-[#0052cc] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0041a3]" to={`/admin/workflows/${workflow.id}/versions/${draft.id}`}>Open draft</Link> : <button className="rounded-lg bg-[#0052cc] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0041a3]" onClick={() => onCreateDraft(workflow)}>Create draft</button>}
      </div>
    </article>
  );
}
