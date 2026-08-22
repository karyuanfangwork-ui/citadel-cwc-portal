export function SlaContextBanner({ requestType, ruleCount }: { requestType: { id: string; name: string; slaHours: number | null } | null; ruleCount: number }) {
    if (!requestType) return null;
    if (requestType.slaHours == null) return <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><span className="material-symbols-outlined">warning</span><div><p className="font-black">{requestType.name} · No SLA defined</p><p className="mt-1">No SLA is defined for this request type. Escalation rules will not fire until an SLA is set.</p></div></div>;
    return <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-[#e8f0fe] p-4 text-sm text-[#173b72]"><span className="font-black">{requestType.name}</span><span><strong>{requestType.slaHours}h</strong> base SLA</span><span><strong>{ruleCount}</strong> configured {ruleCount === 1 ? 'rule' : 'rules'}</span></div>;
}
