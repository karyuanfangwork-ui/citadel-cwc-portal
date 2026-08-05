import type { ValidationFinding } from '../../services/workflow-version.service';

interface ValidationPanelProps { blocking: ValidationFinding[]; warnings: ValidationFinding[]; onFocus: (finding: ValidationFinding) => void; }
export default function ValidationPanel({ blocking, warnings, onFocus }: ValidationPanelProps) {
  return <section className="border-t border-[#dbe3ef] bg-white p-4" aria-label="Workflow validation"><div className="flex items-center justify-between"><h2 className="text-sm font-black text-[#101418]">Validation</h2><div className="flex gap-3 text-xs font-bold"><span className={blocking.length ? 'text-[#b42318]' : 'text-[#18794e]'}>{blocking.length} blocking</span><span className="text-[#8a5a00]">{warnings.length} warnings</span></div></div>
    {!blocking.length && !warnings.length && <p className="mt-2 text-sm text-[#18794e]">No findings from the server validator.</p>}
    <div className="mt-3 grid gap-2 md:grid-cols-2">{[...blocking, ...warnings].map((finding, index) => <button key={`${finding.code}-${index}`} className={`rounded-lg p-3 text-left text-xs ${blocking.includes(finding) ? 'bg-[#fff0f0] text-[#b42318]' : 'bg-[#fff4d6] text-[#8a5a00]'}`} onClick={() => onFocus(finding)}><strong>{finding.code}</strong><span className="ml-2">{finding.message}</span>{finding.code === 'STATUS_IN_USE_REMOVED' && <span className="ml-2 rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-bold uppercase">Resolve on publish</span>}</button>)}</div>
  </section>;
}
