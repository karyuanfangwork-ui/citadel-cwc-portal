import { useState } from 'react';
import type { GraphNode } from '../../services/workflow-version.service';

const ICON_OPTIONS = [
  ['radio_button_checked', 'Default status'],
  ['send', 'Submitted / send'],
  ['manage_search', 'Review / search'],
  ['sync', 'In progress / sync'],
  ['pending', 'Pending'],
  ['hourglass_empty', 'Waiting'],
  ['person', 'User action'],
  ['groups', 'Team review'],
  ['warning', 'Action required'],
  ['check_circle', 'Approved / complete'],
  ['task_alt', 'Resolved'],
  ['cancel', 'Rejected / cancelled'],
  ['block', 'Blocked'],
  ['assignment', 'Assignment'],
  ['verified', 'Verified'],
] as const;

interface NodeInspectorProps { node: GraphNode | null; readOnly: boolean; onChange: (patch: Partial<GraphNode>) => void; onDelete: () => void; }
export default function NodeInspector({ node, readOnly, onChange, onDelete }: NodeInspectorProps) {
  const [roles] = useState(false);
  if (!node) return <p className="text-sm text-[#44546f]">Select a node to edit its properties.</p>;
  const iconOptions = ICON_OPTIONS.some(([value]) => value === node.icon)
    ? ICON_OPTIONS
    : [[node.icon, `Current (${node.icon})`], ...ICON_OPTIONS] as readonly (readonly [string, string])[];
  return <div className="space-y-4">
    <div><label className="text-xs font-bold uppercase tracking-wide text-[#8993a4]">Status code</label><p className="mt-1 rounded-lg bg-[#f7f9fc] px-3 py-2 text-sm font-semibold text-[#44546f]">{node.statusCode || 'Unset'}</p></div>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Label<input aria-label="Node label" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={node.label ?? ''} onChange={(event) => onChange({ label: event.target.value || null })} /></label>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Icon<select aria-label="Node icon" className="mt-1 w-full rounded-lg border border-[#b9c8de] bg-white px-3 py-2 text-sm" disabled={readOnly} value={node.icon} onChange={(event) => onChange({ icon: event.target.value })}>{iconOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span className="mt-1 block text-[11px] font-normal normal-case tracking-normal text-[#8993a4]">Used for the visual status marker in the workflow graph.</span></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={readOnly} checked={node.isInitial} onChange={(event) => onChange({ isInitial: event.target.checked })} /> Initial node</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={readOnly} checked={node.isFinal} onChange={(event) => onChange({ isFinal: event.target.checked })} /> Final node</label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={readOnly} checked={node.slaPause} onChange={(event) => onChange({ slaPause: event.target.checked })} /> Pause SLA</label>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Display order<input aria-label="Display order" type="number" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={node.displayOrder ?? ''} onChange={(event) => onChange({ displayOrder: event.target.value === '' ? null : Number(event.target.value) })} /></label>
    {!readOnly && <button className="w-full rounded-lg border border-[#f2b8b5] px-3 py-2 text-sm font-semibold text-[#b42318]" onClick={onDelete}>Delete node</button>}
    {roles && null}
  </div>;
}
