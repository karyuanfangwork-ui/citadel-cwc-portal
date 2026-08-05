import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import workflowVersionService, { type WorkflowSummary } from '../src/services/workflow-version.service';
import { useWorkflowVersions } from '../src/hooks/useWorkflowVersions';
import WorkflowListCard from '../src/components/workflow/WorkflowListCard';
import CreateDraftDialog from '../src/components/workflow/CreateDraftDialog';

export default function WorkflowList() {
  const navigate = useNavigate();
  const { workflows, loading, error, reload } = useWorkflowVersions();
  const [selected, setSelected] = useState<WorkflowSummary | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createDraft = async () => {
    if (!selected || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await workflowVersionService.createDraft(selected.id);
      navigate(`/admin/workflows/${selected.id}/versions/${result.draft.id}`);
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Unable to create draft');
      await reload();
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="min-h-[calc(100vh-8rem)] bg-[#f7f9fc] px-6 py-8" data-testid="workflow-list-page">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#0052cc]">Administration</p><h1 className="text-3xl font-black tracking-tight text-[#101418]">Workflow Designer</h1><p className="mt-2 max-w-2xl text-sm text-[#44546f]">Create and manage versioned workflows without editing compiled runtime rules directly.</p></div><Link className="text-sm font-semibold text-[#0052cc] hover:underline" to="/admin/settings?tab=workflow-config">Open legacy Workflow Config</Link></div>
        {loading && <div className="rounded-2xl border border-[#dbe3ef] bg-white p-10 text-center text-sm text-[#44546f]" role="status">Loading workflows…</div>}
        {!loading && error && <div className="rounded-2xl border border-[#f2b8b5] bg-white p-8 text-center"><p className="font-semibold text-[#b42318]" role="alert">{error}</p><button className="mt-4 rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white" onClick={() => void reload()}>Retry</button></div>}
        {!loading && !error && workflows.length === 0 && <div className="rounded-2xl border border-dashed border-[#c9d4e5] bg-white p-10 text-center"><h2 className="text-lg font-bold text-[#101418]">No active workflows</h2><p className="mt-2 text-sm text-[#44546f]">There are no workflow types available for administration.</p></div>}
        {!loading && !error && workflows.length > 0 && <div className="grid gap-5 lg:grid-cols-2">{workflows.map((workflow) => <WorkflowListCard key={workflow.id} workflow={workflow} onCreateDraft={(item) => { setSelected(item); setCreateError(null); }} />)}</div>}
      </div>
      {selected && <CreateDraftDialog workflow={selected} busy={creating} error={createError} onClose={() => { if (!creating) setSelected(null); }} onConfirm={() => void createDraft()} />}
    </section>
  );
}
