import React, { useEffect, useState } from 'react';
import { CreditApplication, FatcaCrsDeclaration } from '../../../src/services/credit.service';
import RetailBorrowerProfile from './sections/RetailBorrowerProfile';
import SmeBorrowerProfile from './sections/SmeBorrowerProfile';
import CorporateBorrowerProfile from './sections/CorporateBorrowerProfile';
import FatcaCrsSection from '../../../src/components/credit/FatcaCrsSection';
import PartiesTab from './sections/PartiesTab';

interface BorrowerProfileTab360Props {
  application: CreditApplication;
  fatcaCrsEnabled: boolean;
  lane?: string | null;
}

const sectionHeaderStyle: React.CSSProperties = {
  fontFamily: 'var(--cr-font-display)',
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--cr-on-surface, #0f172a)',
  borderBottom: '1px solid var(--cr-outline-variant, #e2e8f0)',
  paddingBottom: 8,
  marginBottom: 16,
};

/**
 * Determine which profile view to use based on borrowerType and lane.
 * - INDIVIDUAL → Retail
 * - SOLE_PROPRIETOR → SME
 * - CORPORATE → SME if lane is PERSONAL_FAST or SME, Corporate if lane is CORPORATE
 * - JOINT → Retail (treated as individual joint borrowers)
 */
function getProfileView(borrowerType: string | null | undefined, lane: string | null | undefined): 'retail' | 'sme' | 'corporate' {
  if (!borrowerType || borrowerType === 'INDIVIDUAL' || borrowerType === 'JOINT') return 'retail';
  if (borrowerType === 'SOLE_PROPRIETOR') return 'sme';
  // CORPORATE
  if (lane === 'CORPORATE') return 'corporate';
  return 'sme';
}

const CustomerProfileTab: React.FC<BorrowerProfileTab360Props> = ({ application, fatcaCrsEnabled, lane }) => {
  const borrowerType = application.borrowerProfile?.borrowerType ?? null;
  const view = getProfileView(borrowerType, lane);
  const isCorporate = borrowerType === 'CORPORATE' || borrowerType === 'SOLE_PROPRIETOR';

  // §8.2 — Track FATCA/CRS declaration status (corporate only)
  const [fatcaDeclaration, setFatcaDeclaration] = useState<FatcaCrsDeclaration | null>(null);
  const fatcaIsComplete = !isCorporate || !!fatcaDeclaration?.verifiedAt || !!fatcaDeclaration?.selfCertifiedById;
  useEffect(() => { /* onFatcaComplete?.(fatcaIsComplete); */ }, [fatcaIsComplete]);

  return (
    <div className="space-y-8">
      {/* ── Borrower-type-specific profile sections ─────────────── */}
      {view === 'retail' && <RetailBorrowerProfile application={application} />}
      {view === 'sme' && <SmeBorrowerProfile application={application} />}
      {view === 'corporate' && <CorporateBorrowerProfile application={application} />}

      {/* ── FATCA/CRS Declaration (corporate only, gated by feature flag) ─── */}
      {fatcaCrsEnabled && isCorporate && !fatcaIsComplete && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600">warning</span>
          <span className="text-sm font-semibold text-red-800">
            FATCA/CRS declaration is mandatory for corporate borrowers before proceeding.
          </span>
        </div>
      )}
      {fatcaCrsEnabled && isCorporate && application.borrowerProfile?.id && (
        <FatcaCrsSection borrowerProfileId={application.borrowerProfile.id} onDeclarationLoaded={setFatcaDeclaration} />
      )}

      {/* ── Parties & Guarantors (shared for SME/Corporate) ──────── */}
      {view !== 'retail' && (
        <section>
          <h3 style={sectionHeaderStyle}>
            <span className="material-symbols-outlined" style={{ verticalAlign: 'middle', marginRight: 8 }}>
              groups
            </span>
            Parties &amp; Guarantors
          </h3>
          <PartiesTab app={application} borrowerType={borrowerType} />
        </section>
      )}
    </div>
  );
};

export default CustomerProfileTab;