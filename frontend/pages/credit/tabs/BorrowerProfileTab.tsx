import React, { useEffect, useState } from 'react';
import { CreditApplication, FatcaCrsDeclaration } from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import FatcaCrsSection from '../../../src/components/credit/FatcaCrsSection';

// S2 · Borrower Profile — Identity summary + KYC snapshot.
// Used by PersonalFastView.tsx (retail fast-track lane).
// CustomerProfileTab.tsx now uses the type-specific profile components
// (RetailCustomerProfile / SmeCustomerProfile / CorporateCustomerProfile)
// plus the extracted FatcaCrsSection directly, and no longer renders this tab.

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** §8.2 — Callback to signal whether FATCA/CRS is complete */
  onFatcaComplete?: (complete: boolean) => void;
  /** P2-1: Whether the credit:fatca_crs feature flag is enabled */
  fatcaCrsEnabled?: boolean;
};

const BorrowerProfileTab: React.FC<Props> = ({ application, onFatcaComplete, fatcaCrsEnabled = false }) => {
  const bp = application.borrowerProfile;
  const isIndividual = bp?.borrowerType === 'INDIVIDUAL';
  const isCorporate = bp?.borrowerType === 'CORPORATE' || bp?.borrowerType === 'SOLE_PROPRIETOR';

  // §8.2 — Track FATCA/CRS declaration status
  const [fatcaDeclaration, setFatcaDeclaration] = useState<FatcaCrsDeclaration | null>(null);
  const fatcaIsComplete = isIndividual || (!!fatcaDeclaration?.verifiedAt || !!fatcaDeclaration?.selfCertifiedById);
  useEffect(() => { onFatcaComplete?.(fatcaIsComplete); }, [fatcaIsComplete, onFatcaComplete]);

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
              {bp?.name || '—'}
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

      {/* ── FATCA/CRS Declaration (P2-1: gated by credit:fatca_crs feature flag) ─── */}
      {fatcaCrsEnabled && isCorporate && !fatcaIsComplete && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600">warning</span>
          <span className="text-sm font-semibold text-red-800">
            FATCA/CRS declaration is mandatory for corporate borrowers before proceeding.
          </span>
        </div>
      )}
      {fatcaCrsEnabled && bp?.id && <FatcaCrsSection borrowerProfileId={bp.id} onDeclarationLoaded={setFatcaDeclaration} />}
    </div>
  );
};

export default BorrowerProfileTab;