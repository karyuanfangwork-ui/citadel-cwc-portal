import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { SlaBreachItem } from '../../services/credit.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SlaBreachWidgetProps {
  breaches: SlaBreachItem[];
  totalCount: number;
  filterMode: 'all' | 'mine';
}

// ---------------------------------------------------------------------------
// State label helper
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_REVIEW: 'KYC Review',
  KYC_APPROVED: 'KYC Approved',
  KYC_REJECTED: 'KYC Rejected',
  UNDERWRITING: 'Underwriting',
  CREDIT_ASSESSMENT: 'Credit Assessment',
  COMMITTEE_REVIEW: 'Committee Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  OFFER: 'Offer',
  ACCEPTED: 'Accepted',
  DISBURSED: 'Disbursed',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
  REFERRED_BACK: 'Referred Back',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SlaBreachWidget: React.FC<SlaBreachWidgetProps> = ({ breaches, totalCount, filterMode }) => {
  const [expanded, setExpanded] = useState(false);

  if (totalCount === 0) {
    return (
      <div className="bg-bg-surface border border-border rounded-xl p-5">
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">SLA Breaches</p>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-green-600 text-2xl">check_circle</span>
          <p className="text-sm text-green-600 font-semibold">No SLA breaches</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">SLA Breaches</p>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-black ${
            totalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
            {totalCount}
          </span>
          <span className={`material-symbols-outlined text-lg text-text-secondary transition-transform ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 -mx-2 overflow-x-auto">
          {breaches.length === 0 ? (
            <p className="text-sm text-text-secondary py-2">
              {filterMode === 'mine' ? 'No breaches on your cases.' : 'No breaches to display.'}
            </p>
          ) : (
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">App No</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Borrower</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">State</th>
                  <th className="text-right px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">Days Overdue</th>
                  <th className="text-left px-2 py-2 text-xs font-bold text-text-secondary uppercase tracking-wider">SLA Policy</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {breaches.map(b => (
                  <tr key={b.id} className="border-b border-border last:border-0 hover:bg-surface-muted transition-colors">
                    <td className="px-2 py-2 font-semibold text-text-primary">{b.applicationNo}</td>
                    <td className="px-2 py-2 text-text-secondary">{b.borrowerName}</td>
                    <td className="px-2 py-2">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700">
                        {STATE_LABELS[b.currentState] ?? b.currentState}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <span className="font-bold text-red-600">{b.daysOverdue}d</span>
                    </td>
                    <td className="px-2 py-2 text-text-secondary text-xs">{b.policyName}</td>
                    <td className="px-2 py-2 text-right">
                      <Link
                        to={`/credit/applications/${b.applicationId}`}
                        className="text-brand-700 text-xs font-bold hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default SlaBreachWidget;