import { useState } from 'react';
import type { GraphNode } from '../../services/workflow-version.service';

interface StatusPaletteProps { existingCodes: Set<string>; readOnly: boolean; onAdd: (node: GraphNode) => void; }
export default function StatusPalette({ existingCodes, readOnly, onAdd }: StatusPaletteProps) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const add = () => {
    const normalized = code.trim().toUpperCase();
    if (!normalized || existingCodes.has(normalized)) return;
    onAdd({ id: `client-node-${crypto.randomUUID()}`, type: 'STATUS', statusCode: normalized, label: label.trim() || normalized, displayOrder: null, positionX: 80, positionY: 80 + existingCodes.size * 110, isInitial: existingCodes.size === 0, isFinal: false, slaPause: false, icon: 'radio_button_checked' });
    setCode(''); setLabel('');
  };
  return <div className="space-y-4"><p className="text-sm text-[#44546f]">Add a governed status code to this draft. Status codes are globally meaningful and may affect multiple request types.</p>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Status code<input aria-label="New status code" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={code} onChange={(event) => setCode(event.target.value)} /></label>
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Display label<input aria-label="New status label" className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm" disabled={readOnly} value={label} onChange={(event) => setLabel(event.target.value)} /></label>
    <button className="w-full rounded-lg bg-[#0052cc] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={readOnly || !code.trim() || existingCodes.has(code.trim().toUpperCase())} onClick={add}>Add status</button>
    {existingCodes.has(code.trim().toUpperCase()) && code.trim() && <p className="text-xs font-semibold text-[#b42318]">This status is already present.</p>}
  </div>;
}
