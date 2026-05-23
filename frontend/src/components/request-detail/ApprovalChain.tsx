import React, { useState, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalChainProps {
  approvals?: {
    id: string;
    approverId: string;
    approverType: string;
    status: string;
    decision: string | null;
    decidedAt: string | null;
    approver: { id: string; firstName: string; lastName: string; email: string };
    entity: { id: string; name: string; code: string } | null;
  }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatRelative = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = Date.now();
  const diff = now - date.getTime();
  const abs = Math.abs(diff);

  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(abs / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 2) return 'yesterday';
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const initials = (firstName: string, lastName: string) =>
  `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ApprovalChain: React.FC<ApprovalChainProps> = ({ approvals }) => {
  const [popoverId, setPopoverId] = useState<string | null>(null);

  const togglePopover = (id: string | null) => {
    setPopoverId(prev => (prev === id ? null : id));
  };

  // Sort approvals: decided (APPROVED/REJECTED) first sorted by decidedAt, then pending
  const sorted = useMemo(() => {
    if (!approvals || approvals.length === 0) return [];
    return [...approvals].sort((a, b) => {
      if (a.decidedAt && !b.decidedAt) return -1;
      if (!a.decidedAt && b.decidedAt) return 1;
      if (a.decidedAt && b.decidedAt) return new Date(a.decidedAt).getTime() - new Date(b.decidedAt).getTime();
      return 0;
    });
  }, [approvals]);

  // Empty state
  if (!approvals || approvals.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-5 py-3">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-base text-gray-500" aria-hidden="true">approval</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">Approvals</span>
        </div>
        <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
          <span className="material-symbols-outlined text-xl" aria-hidden="true">hourglass_empty</span>
          <span className="text-sm">No approvals required</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm px-5 py-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-base text-gray-500" aria-hidden="true">approval</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-600">
          Approvals ({sorted.length})
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {sorted.map((approval, idx) => {
          const isLast = idx === sorted.length - 1;
          const isPending = approval.status === 'PENDING' || !approval.decision;
          const isApproved = approval.decision === 'APPROVED';
          const isRejected = approval.decision === 'REJECTED';
          const isPopoverOpen = popoverId === approval.id;

          return (
            <div key={approval.id} className="relative flex gap-3">
              {/* Timeline line + node */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => togglePopover(approval.id)}
                  className="relative z-10 focus:outline-none"
                  aria-label={`${approval.approver.firstName} ${approval.approver.lastName} — ${isPending ? 'Pending' : approval.decision ?? 'Pending'}`}
                >
                  {isApproved ? (
                    <div className="size-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-white text-base" aria-hidden="true">check</span>
                    </div>
                  ) : isRejected ? (
                    <div className="size-8 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-white text-base" aria-hidden="true">close</span>
                    </div>
                  ) : isPending ? (
                    <div className="size-8 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center shadow-sm">
                      <span className="material-symbols-outlined text-amber-600 text-base animate-pulse" aria-hidden="true">hourglass_empty</span>
                    </div>
                  ) : (
                    <div className="size-8 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-400 text-base" aria-hidden="true">help</span>
                    </div>
                  )}
                </button>
                {!isLast && (
                  <div className={`w-0.5 flex-1 min-h-[20px] ${
                    isPending ? 'bg-gray-200' : isApproved ? 'bg-emerald-300' : 'bg-gray-200'
                  }`} />
                )}
              </div>

              {/* Content */}
              <div className="pb-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Avatar */}
                  <div className="size-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {initials(approval.approver.firstName, approval.approver.lastName)}
                  </div>
                  <span className="text-sm font-semibold text-gray-800 truncate">
                    {approval.approver.firstName} {approval.approver.lastName}
                  </span>
                  {(approval.approverType || approval.entity) && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {approval.approverType?.replace(/_/g, ' ').toLowerCase()}
                      {approval.entity && ` · ${approval.entity.name}`}
                    </span>
                  )}
                </div>

                {/* Status line */}
                <div className="mt-0.5 flex items-center gap-1.5">
                  {isApproved ? (
                    <>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Approved</span>
                      {approval.decidedAt && (
                        <span className="text-[10px] text-gray-400">{formatRelative(approval.decidedAt)}</span>
                      )}
                    </>
                  ) : isRejected ? (
                    <>
                      <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Rejected</span>
                      {approval.decidedAt && (
                        <span className="text-[10px] text-gray-400">{formatRelative(approval.decidedAt)}</span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      Waiting for {approval.approverType?.replace(/_/g, ' ').toLowerCase() ?? 'approval'}
                    </span>
                  )}
                </div>

                {/* Popover on click */}
                {isPopoverOpen && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                        {initials(approval.approver.firstName, approval.approver.lastName)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">{approval.approver.firstName} {approval.approver.lastName}</div>
                        <div className="text-[10px] text-gray-400">{approval.approver.email}</div>
                      </div>
                    </div>
                    {approval.entity && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <span className="material-symbols-outlined text-xs text-gray-400" aria-hidden="true">business</span>
                        <span>{approval.entity.name} ({approval.entity.code})</span>
                      </div>
                    )}
                    {approval.decision && (
                      <div className="flex items-center gap-1">
                        <span className={`material-symbols-outlined text-sm ${
                          isApproved ? 'text-emerald-500' : 'text-red-500'
                        }`} aria-hidden="true">
                          {isApproved ? 'check_circle' : 'cancel'}
                        </span>
                        <span className={`font-semibold ${isApproved ? 'text-emerald-600' : 'text-red-600'}`}>
                          {approval.decision}
                        </span>
                      </div>
                    )}
                    {approval.decidedAt && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400">
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">schedule</span>
                        <span>{new Date(approval.decidedAt).toLocaleString()}</span>
                      </div>
                    )}
                    {isPending && (
                      <div className="flex items-center gap-1 text-amber-600 font-semibold">
                        <span className="material-symbols-outlined text-xs animate-pulse" aria-hidden="true">hourglass_empty</span>
                        <span>Pending decision</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Click-away backdrop to close popover */}
      {popoverId && (
        <div className="fixed inset-0 z-20" onClick={() => setPopoverId(null)} />
      )}
    </div>
  );
};

export default ApprovalChain;