import React, { useState, useCallback } from 'react';
import { getPolicyExplanation, ItsmPolicyExplanation, CreditPolicyExplanation } from '../../services/approval.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PolicyExplainerProps {
  /** 'itsm' or 'credit' */
  type: 'itsm' | 'credit';
  /** requestId (ITSM) or applicationId (credit) */
  id: string;
  /** Optional className for the wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helper: friendly approver type labels
// ---------------------------------------------------------------------------

const APPROVER_TYPE_LABELS: Record<string, string> = {
  CEO: 'CEO Approval',
  HIRING_MANAGER: 'Hiring Manager',
  ENTITY: 'Entity Approver',
};

const SIGNOFF_ROLE_LABELS: Record<string, string> = {
  PREPARED_BY: 'Prepared by',
  REVIEWED_BY: 'Reviewed by',
  CONCURRED_BY: 'Concurred by',
};

const DECISION_TYPE_LABELS: Record<string, string> = {
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  RETURN: 'Returned',
  ESCALATE: 'Escalated',
  DEFER: 'Deferred',
};

// ---------------------------------------------------------------------------
// Sub-components for formatting
// ---------------------------------------------------------------------------

function ItsmExplanation({ data }: { data: ItsmPolicyExplanation }) {
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Why you're seeing this approval
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{data.summary}</p>

      {/* Approvals Table */}
      {data.approvals.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Approval Assignments
          </div>
          <div className="space-y-1.5">
            {data.approvals.map((a) => (
              <div
                key={a.approvalId}
                className={`text-xs border rounded-cwc-sm p-2 ${
                  a.approverId === data.currentUserId
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {APPROVER_TYPE_LABELS[a.approverType] || a.approverType}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-cwc-sm text-[10px] font-semibold ${
                      a.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : a.status === 'APPROVED'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
                {a.approverName && (
                  <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                    Assignee: {a.approverName}
                  </div>
                )}
                {a.entityName && (
                  <div className="text-gray-500 dark:text-gray-500 mt-0.5">
                    Entity: {a.entityName}
                  </div>
                )}
                <div className="text-gray-600 dark:text-gray-400 mt-1">{a.reason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routing Rules */}
      {data.routingRules.length > 0 && (
        <div className="mt-2">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Active Routing Rules
          </div>
          {data.routingRules.map((r) => (
            <div key={r.ruleId} className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">{r.requestTypeName}</span>
              {' — '}
              {r.routingMode === 'REQUESTER_ENTITY'
                ? "Route to the requester's entity approver"
                : `Route by custom field "${r.customFieldKey}"`}
              {r.label ? ` (${r.label})` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreditExplanation({ data }: { data: CreditPolicyExplanation }) {
  return (
    <div className="space-y-3">
      {/* Main explanation */}
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        Approval authority explanation
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300">{data.explanation}</p>

      {/* Application context */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
        <div>Application: <span className="font-medium text-gray-700 dark:text-gray-300">{data.applicationNo}</span></div>
        <div>State: <span className="font-medium text-gray-700 dark:text-gray-300">{data.state}</span></div>
        <div>Product: <span className="font-medium text-gray-700 dark:text-gray-300">{data.productType}</span></div>
        {data.authorityLevel && (
          <div>Required authority: <span className="font-medium text-gray-700 dark:text-gray-300">{data.authorityLevel}</span></div>
        )}
        {data.matrixName && (
          <div>Matrix: <span className="font-medium text-gray-700 dark:text-gray-300">{data.matrixName}</span></div>
        )}
      </div>

      {/* Decisions */}
      {data.decisions.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Decisions
          </div>
          <div className="space-y-1.5">
            {data.decisions.map((d) => (
              <div
                key={d.decisionId}
                className={`text-xs border rounded-cwc-sm p-2 ${
                  d.decidedById === data.currentUserId
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {d.decidedByName || 'Unknown user'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-cwc-sm text-[10px] font-semibold ${
                      d.decisionType === 'APPROVE'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : d.decisionType === 'REJECT'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}
                  >
                    {DECISION_TYPE_LABELS[d.decisionType] || d.decisionType}
                  </span>
                </div>
                {d.authorityLevel && (
                  <div className="text-gray-500 dark:text-gray-500 mt-0.5">
                    Authority: {d.authorityLevel}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sign-offs */}
      {data.signoffs.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
            Sign-offs
          </div>
          <div className="space-y-1.5">
            {data.signoffs.map((s) => (
              <div
                key={s.signoffId}
                className={`text-xs border rounded-cwc-sm p-2 ${
                  s.signedById === data.currentUserId
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {SIGNOFF_ROLE_LABELS[s.role] || s.role}
                  </span>
                  <span className="text-green-700 dark:text-green-400 font-medium">Signed</span>
                </div>
                <div className="text-gray-600 dark:text-gray-400">
                  {s.signedByName} — {s.designationSnapshot}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

/**
 * PolicyExplainer — shows a popover/tooltip explaining why the current user
 * is seeing an approval item, powered by the backend policy-explainer endpoint.
 *
 * Usage:
 *   <PolicyExplainer type="itsm" id={requestId} />
 *   <PolicyExplainer type="credit" id={applicationId} />
 */
export const PolicyExplainer: React.FC<PolicyExplainerProps> = ({ type, id, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItsmPolicyExplanation | CreditPolicyExplanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async () => {
    if (data) return; // already loaded
    setLoading(true);
    setError(null);
    try {
      const result = await getPolicyExplanation(type, id);
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load policy explanation');
    } finally {
      setLoading(false);
    }
  }, [type, id, data]);

  const handleMouseEnter = useCallback(() => {
    setVisible(true);
    if (!data && !loading) {
      fetchExplanation();
    }
  }, [data, loading, fetchExplanation]);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  return (
    <div className={`relative inline-flex ${className}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Info icon trigger */}
      <button
        type="button"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-blue-500 dark:text-gray-500 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label="Why am I seeing this approval?"
        tabIndex={0}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
          />
        </svg>
      </button>

      {/* Popover panel */}
      {visible && (
        <div
          className="absolute z-[90] bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-h-96 overflow-y-auto pointer-events-auto"
          role="tooltip"
        >
          <div className="rounded-cwc-md shadow-cwc-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-3">
            {loading && (
              <div className="flex items-center justify-center py-4 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                <p className="font-medium">Could not load explanation</p>
                <p className="mt-1 text-xs">{error}</p>
              </div>
            )}

            {data && data.type === 'itsm' && <ItsmExplanation data={data} />}
            {data && data.type === 'credit' && <CreditExplanation data={data} />}

            {/* Arrow */}
            <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-white dark:border-t-gray-800" />
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyExplainer;