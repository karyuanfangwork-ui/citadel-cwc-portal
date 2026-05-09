import React from 'react';

interface EntityApproval {
    id: string;
    entityId?: string | null;
    approverId?: string | null;
    approverType?: string;
    status: string;
    comments?: string | null;
    updatedAt?: string;
    entity?: { id: string; name: string; code: string } | null;
    approver?: { id: string; firstName: string; lastName: string } | null;
}

interface EntityApprovalsPanelProps {
    approvals: EntityApproval[];
}

const STATUS_STYLES = {
    PENDING:  'bg-amber-50 text-amber-600 border-amber-100',
    APPROVED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    REJECTED: 'bg-red-50 text-red-600 border-red-100',
};

const STATUS_ICONS = {
    PENDING:  'pending',
    APPROVED: 'check_circle',
    REJECTED: 'cancel',
};

export const EntityApprovalsPanel: React.FC<EntityApprovalsPanelProps> = ({ approvals }) => {
    const entityApprovals = approvals.filter((a) => a.entityId !== null);
    if (entityApprovals.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-black text-[#101418] uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0052cc] text-lg">corporate_fare</span>
                Entity Approvals
            </h3>
            <div className="space-y-3">
                {entityApprovals.map((approval) => (
                    <div key={approval.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                            <div className="font-bold text-sm text-[#101418]">
                                {approval.entity?.name || 'Unknown Entity'}
                                <span className="ml-2 text-[10px] font-black text-gray-400 font-mono">{approval.entity?.code}</span>
                            </div>
                            <div className="text-xs text-[#44546f] mt-0.5">
                                Approver: {approval.approver ? `${approval.approver.firstName} ${approval.approver.lastName}` : '—'}
                            </div>
                            {approval.comments && (
                                <div className="text-xs text-[#44546f] mt-1 italic">"{approval.comments}"</div>
                            )}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${STATUS_STYLES[approval.status]}`}>
                            <span className="material-symbols-outlined text-[12px]">{STATUS_ICONS[approval.status]}</span>
                            {approval.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};