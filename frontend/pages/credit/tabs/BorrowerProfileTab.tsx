import React from 'react';
import creditService, { CreditApplication } from '../../../src/services/credit.service';
import { formatDate } from '../creditUtils';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

// S2 · Borrower Profile — Identity summary + KYC snapshot.
// Directors/UBOs/Shareholders are on the "Parties" sub-tab.

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const BorrowerProfileTab: React.FC<Props> = ({ application }) => {
  const bp = application.borrowerProfile;
  const account = bp?.account;
  const contact = bp?.contact;
  const isIndividual = bp?.borrowerType === 'INDIVIDUAL';

  return (
    <div className="space-y-6">
      {/* ── Identity ──────────────────────────── */}
      <CaMemoSection title="Borrower Identity" phase="S2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Borrower Type</label>
            <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {isIndividual ? 'Individual' : 'Corporate'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
            <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {isIndividual
                ? (contact ? `${contact.firstName} ${contact.lastName}` : '—')
                : (account?.name || '—')}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Credit Risk Rating</label>
            <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {bp?.creditRiskRating || 'Not rated'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Borrower ID</label>
            <div className="text-sm font-mono text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {bp?.id?.slice(0, 8) || '—'}
            </div>
          </div>
        </div>
      </CaMemoSection>

      {/* ── KYC / AML ──────────────────────────── */}
      <CaMemoSection title="KYC & AML" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">AML Risk Tier</div>
            <div className="text-sm font-bold text-gray-900">{bp?.amlRiskTier || '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Sanctioned Entity</div>
            <div className="text-sm font-bold">
              {bp?.isSanctionedEntity ? (
                <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded">Yes — Flagged</span>
              ) : (
                <span className="text-green-700">No</span>
              )}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Source of Wealth</div>
            <div className="text-sm font-bold text-gray-900">{bp?.sourceOfWealth || '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Connected Party</div>
            <div className="text-sm font-bold">
              {application.connectedPartyFlag ? (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Yes</span>
              ) : (
                <span className="text-green-700">No</span>
              )}
            </div>
          </div>
        </div>

        {bp?.occupation && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 mb-1">Occupation</div>
              <div className="text-sm font-bold text-gray-900">{bp.occupation}</div>
            </div>
            {bp.employer && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Employer</div>
                <div className="text-sm font-bold text-gray-900">{bp.employer}</div>
              </div>
            )}
            {bp.annualIncome != null && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Annual Income</div>
                <div className="text-sm font-bold text-gray-900">{Number(bp.annualIncome).toLocaleString('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 })}</div>
              </div>
            )}
          </div>
        )}
      </CaMemoSection>
    </div>
  );
};

export default BorrowerProfileTab;