/**
 * Sprint 3 — Approval Matrix Applicability Panel
 *
 * Shows which approval matrix row applies to the current application,
 * the required approver count, collected approvals, and progress.
 */
import React, { useEffect, useState } from 'react';
import creditService from '../../services/credit.service';

interface Props {
  applicationId: string;
}

interface ApplicabilityData {
  matrixMatched: boolean;
  matrixName: string | null;
  matrixId: string | null;
  authorityLevel: string | null;
  requiredApproverCount: number;
  approvalsCollected: number;
  isComplete: boolean;
  exposureUsed: number;
  riskRatingUsed: string;
  branchId: string | null;
  lane: string | null;
  approvers: { decisionById: string; authorityLevel: string | null; createdAt: string }[];
}

const ApprovalMatrixApplicabilityPanel: React.FC<Props> = ({ applicationId }) => {
  const [data, setData] = useState<ApplicabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    creditService.getApprovalMatrixApplicability(applicationId)
      .then(setData)
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        {error ?? 'Unable to load approval matrix applicability.'}
      </div>
    );
  }

  if (!data.matrixMatched) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <span className="material-symbols-outlined text-base">warning</span>
          No Approval Matrix Matched
        </div>
        <p className="text-xs text-amber-700">
          No active matrix row matches this exposure/rating combination.
          Configure an approval matrix before committee submission.
        </p>
      </div>
    );
  }

  const pct = data.requiredApproverCount > 0
    ? Math.min(100, Math.round((data.approvalsCollected / data.requiredApproverCount) * 100))
    : 100;

  const fmtMYR = (v: number) =>
    new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-blue-600">rule</span>
          <span className="text-sm font-semibold text-gray-800">Approval Matrix</span>
        </div>
        {data.isComplete ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
            Complete
          </span>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            In Progress
          </span>
        )}
      </div>

      {/* Matrix details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <span className="text-gray-500">Matrix:</span>{' '}
          <span className="font-medium text-gray-800">{data.matrixName ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Authority:</span>{' '}
          <span className="font-medium text-gray-800">{data.authorityLevel ?? '—'}</span>
        </div>
        <div>
          <span className="text-gray-500">Exposure:</span>{' '}
          <span className="font-medium text-gray-800">{fmtMYR(data.exposureUsed)}</span>
        </div>
        <div>
          <span className="text-gray-500">Risk Rating:</span>{' '}
          <span className="font-medium text-gray-800">{data.riskRatingUsed}</span>
        </div>
        {data.lane && (
          <div>
            <span className="text-gray-500">Lane:</span>{' '}
            <span className="font-medium text-gray-800">{data.lane}</span>
          </div>
        )}
      </div>

      {/* Approval progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">
            Approvals: {data.approvalsCollected} / {data.requiredApproverCount}
          </span>
          <span className="text-gray-400">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${data.isComplete ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Approver list */}
      {data.approvers.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Approvers</span>
          {data.approvers.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="material-symbols-outlined text-sm text-green-600">check_circle</span>
              <span className="text-gray-700">
                Approver {i + 1}
                {a.authorityLevel ? ` (${a.authorityLevel})` : ''}
              </span>
              <span className="text-gray-400 ml-auto">
                {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ApprovalMatrixApplicabilityPanel;