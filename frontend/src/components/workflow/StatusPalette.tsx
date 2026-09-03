import { useState } from 'react';
import type { GraphNode } from '../../services/workflow-version.service';
import type { RequestStatusDefinition } from '../../services/requestStatusService';

interface StatusPaletteProps {
  definitions: RequestStatusDefinition[];
  loading: boolean;
  error: string | null;
  existingCodes: Set<string>;
  activeCodes?: Set<string>;
  runtimeMissingCodes?: Set<string>;
  readOnly: boolean;
  onAdd: (node: GraphNode) => void;
}

export default function StatusPalette({ definitions, loading, error, existingCodes, activeCodes = new Set(), runtimeMissingCodes = new Set(), readOnly, onAdd }: StatusPaletteProps) {
  const [selectedCode, setSelectedCode] = useState('');
  const selectable = definitions.filter((definition) => !existingCodes.has(definition.code));
  const selected = definitions.find((definition) => definition.code === selectedCode);

  const add = () => {
    if (!selected) return;
    onAdd({
      id: crypto.randomUUID(),
      type: 'STATUS',
      statusCode: selected.code,
      label: selected.label,
      displayOrder: null,
      positionX: 80,
      positionY: 80 + existingCodes.size * 110,
      isInitial: existingCodes.size === 0,
      isFinal: false,
      slaPause: false,
      icon: 'radio_button_checked',
    });
    setSelectedCode('');
  };

  return <div className="space-y-4">
    <div><h2 className="text-xs font-bold uppercase tracking-wide text-[#8993a4]">Governed statuses</h2><p className="mt-2 text-sm text-[#44546f]">Catalogue membership is separate from graph membership. Add a catalogue-only status to this draft, then configure its edges and behavior.</p></div>
    {loading && <p className="text-xs text-[#44546f]" role="status">Loading status definitions…</p>}
    {error && <p className="text-xs font-semibold text-[#b42318]" role="alert">{error}</p>}
    {!loading && !error && definitions.length === 0 && <p className="rounded-lg bg-[#fff4d6] p-3 text-xs text-[#8a5a00]">No active status definitions are available. Create one in Admin Settings first.</p>}
    {!loading && !error && definitions.length > 0 && <ul className="space-y-2" aria-label="Governed statuses">{definitions.map((definition) => {
      const inDraft = existingCodes.has(definition.code);
      const inActive = activeCodes.has(definition.code);
      const runtimeMissing = runtimeMissingCodes.has(definition.code);
      const membership = runtimeMissing ? 'Runtime/occupied status missing from graph — review required' : inDraft ? 'In this draft' : inActive ? 'In active workflow' : 'Catalogue only — add to draft';
      return <li key={definition.code} className="rounded-lg border border-[#dbe3ef] p-2 text-xs"><div className="font-semibold text-[#101418]">{definition.label}</div><div className="text-[#66758f]">{definition.code}</div><div className={`mt-1 font-semibold ${runtimeMissing ? 'text-[#b42318]' : inDraft || inActive ? 'text-[#18794e]' : 'text-[#8a5a00]'}`}>{membership}</div></li>;
    })}</ul>}
    <label className="block text-xs font-bold uppercase tracking-wide text-[#8993a4]">Add catalogue-only status
      <select aria-label="Status code" className="mt-1 w-full rounded-lg border border-[#b9c8de] bg-white px-3 py-2 text-sm" disabled={readOnly || loading || Boolean(error) || selectable.length === 0} value={selectedCode} onChange={(event) => setSelectedCode(event.target.value)}>
        <option value="">Select a status…</option>
        {selectable.map((definition) => <option key={definition.code} value={definition.code}>{definition.label} · {definition.code}{definition.category ? ` · ${definition.category}` : ''}</option>)}
      </select>
    </label>
    {selected && <p className="text-xs text-[#44546f]">{selected.description || selected.label}</p>}
    <button className="w-full rounded-lg bg-[#0052cc] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={readOnly || !selected} onClick={add}>Add status</button>
  </div>;
}
