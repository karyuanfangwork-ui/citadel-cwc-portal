import type { GraphEdge } from '../../services/workflow-version.service';

interface EdgeInspectorProps { edge: GraphEdge | null; readOnly: boolean; onChange: (patch: Partial<GraphEdge>) => void; onDelete: () => void; }
export default function EdgeInspector({ edge, readOnly, onChange, onDelete }: EdgeInspectorProps) {
  if (!edge) return <p className="text-sm text-[#44546f]">Select an edge to edit transition rules.</p>;
  return <div className="space-y-4">
    <p className="text-xs font-semibold text-[#8993a4]">{edge.fromNodeId} → {edge.toNodeId}</p>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Transition label<input aria-label="Transition label" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={edge.transitionLabel ?? ''} onChange={(event) => onChange({ transitionLabel: event.target.value || null })} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={readOnly} checked={edge.requiresComment} onChange={(event) => onChange({ requiresComment: event.target.checked })} /> Requires comment</label>
    {edge.requiresComment && <p className="rounded-lg bg-[#fff4d6] p-3 text-xs text-[#8a5a00]">Comment guidance is enabled for this transition. This is recommended for rejection and return paths.</p>}
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Auto-assign role<input aria-label="Auto-assign role" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={edge.autoAssignRole ?? ''} onChange={(event) => onChange({ autoAssignRole: event.target.value || null })} /></label>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Allowed roles<input aria-label="Allowed roles" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={edge.allowedRoles.join(', ')} onChange={(event) => onChange({ allowedRoles: event.target.value.split(',').map((role) => role.trim()).filter(Boolean) })} /></label>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Executive roles<input aria-label="Executive roles" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={edge.allowedExecutiveRoles.join(', ')} onChange={(event) => onChange({ allowedExecutiveRoles: event.target.value.split(',').map((role) => role.trim()).filter(Boolean) })} /></label>
    {!readOnly && <button className="w-full rounded-lg border border-[#f2b8b5] px-3 py-2 text-sm font-semibold text-[#b42318]" onClick={onDelete}>Delete edge</button>}
  </div>;
}
