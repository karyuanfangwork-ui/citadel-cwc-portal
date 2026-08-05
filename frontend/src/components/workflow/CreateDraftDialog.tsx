import { useState } from 'react';
import type { WorkflowSummary } from '../../services/workflow-version.service';

interface CreateDraftDialogProps {
  workflow: WorkflowSummary;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function CreateDraftDialog({ workflow, busy, error, onConfirm, onClose }: CreateDraftDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101418]/40 p-4" role="presentation" onMouseDown={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="create-draft-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="create-draft-title" className="text-xl font-black text-[#101418]">Create workflow draft</h2>
        <p className="mt-2 text-sm text-[#44546f]">Create a new editable version for <strong>{workflow.name}</strong> ({workflow.code}).</p>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[#f7f9fc] p-4 text-sm">
          <div><dt className="text-[#8993a4]">Active version</dt><dd className="font-bold text-[#101418]">{workflow.activeVersion ? `v${workflow.activeVersion.version}` : 'None'}</dd></div>
          <div><dt className="text-[#8993a4]">Affected request types</dt><dd className="font-bold text-[#101418]">{workflow.requestTypes.length}</dd></div>
        </dl>
        <label className="mt-5 flex gap-2 text-sm text-[#44546f]"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I understand this draft will become the authoring source for the next publish.</label>
        {error && <p className="mt-4 rounded-lg bg-[#fff0f0] p-3 text-sm font-semibold text-[#b42318]" role="alert">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><button className="rounded-lg border border-[#b9c8de] px-4 py-2 text-sm font-semibold text-[#334a70]" onClick={onClose}>Cancel</button><button className="rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!confirmed || busy} onClick={onConfirm}>{busy ? 'Creating…' : 'Create draft'}</button></div>
      </div>
    </div>
  );
}
