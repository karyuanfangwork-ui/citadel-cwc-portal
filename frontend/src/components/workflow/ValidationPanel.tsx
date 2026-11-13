import { useState } from 'react';
import type { ValidationFinding } from '../../services/workflow-version.service';

interface ValidationPanelProps { blocking: ValidationFinding[]; warnings: ValidationFinding[]; onFocus: (finding: ValidationFinding) => void; }
export default function ValidationPanel({ blocking, warnings, onFocus }: ValidationPanelProps) {
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const renderFinding = (finding: ValidationFinding, index: number, isBlocking: boolean) => (
    <button key={`${finding.code}-${index}`} className={`rounded-lg p-3 text-left text-xs ${isBlocking ? 'bg-[#fff0f0] text-[#b42318]' : 'bg-[#fff4d6] text-[#8a5a00]'}`} onClick={() => onFocus(finding)}>
      <strong>{finding.code}</strong><span className="ml-2">{finding.message}</span>
      {finding.code === 'STATUS_IN_USE_REMOVED' && <span className="ml-2 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">Resolve on publish</span>}
    </button>
  );

  return <section className="shrink-0 border-t border-[#dbe3ef] bg-white p-4" aria-label="Workflow validation">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-black text-[#101418]">Validation</h2>
      <div className="flex items-center gap-3 text-xs font-bold">
        <span className={blocking.length ? 'text-[#b42318]' : 'text-[#18794e]'}>{blocking.length} blocking</span>
        <span className="text-[#8a5a00]">{warnings.length} warnings</span>
        {warnings.length > 0 && <button type="button" className="rounded border border-[#d5a84a] px-2 py-1 text-[#765000] hover:bg-[#fff8e8]" aria-expanded={warningsExpanded} onClick={() => setWarningsExpanded((expanded) => !expanded)}>{warningsExpanded ? 'Hide warnings' : 'Show warnings'}</button>}
      </div>
    </div>
    {!blocking.length && !warnings.length && <p className="mt-2 text-sm text-[#18794e]">No findings from the server validator.</p>}
    {blocking.length > 0 && <div className="mt-3 grid max-h-32 gap-2 overflow-y-auto md:grid-cols-2" aria-label="Blocking findings">{blocking.map((finding, index) => renderFinding(finding, index, true))}</div>}
    {warningsExpanded && <div className="mt-3 grid max-h-40 gap-2 overflow-y-auto md:grid-cols-2" aria-label="Warning details">{warnings.map((finding, index) => renderFinding(finding, index, false))}</div>}
  </section>;
}
