import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { WorkflowNodeData } from '../../utils/workflowLayout';

export default function StatusNode({ data, selected }: NodeProps<Node<WorkflowNodeData>>) {
  return (
    <div className={`relative min-w-[190px] rounded-xl border-2 bg-white px-4 py-3 shadow-md ${selected ? 'border-[#0052cc] ring-4 ring-[#dbeafe]' : 'border-[#b9c8de]'}`}>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-white !bg-[#0052cc]" />
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-xl text-[#0052cc]">{data.icon || 'radio_button_checked'}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[#101418]">{data.label || data.statusCode || 'Unnamed status'}</div>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#8993a4]">{data.statusCode || 'No status code'}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold uppercase tracking-wide">
        {data.isInitial && <span className="rounded bg-[#e8f0fe] px-1.5 py-0.5 text-[#0052cc]">Initial</span>}
        {data.isFinal && <span className="rounded bg-[#e8f7ed] px-1.5 py-0.5 text-[#18794e]">Final</span>}
        {data.slaPause && <span className="rounded bg-[#fff4d6] px-1.5 py-0.5 text-[#8a5a00]">SLA paused</span>}
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-white !bg-[#0052cc]" />
    </div>
  );
}
