import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  BorrowerProfile,
  ExposureSummary,
  IndustryAssessment,
} from '../../../../src/services/credit.service';
import creditService from '../../../../src/services/credit.service';
import { industryAssessmentApi, qualitativeAssessmentApi } from '../../../../src/services/credit.service';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import { formatCurrency } from '../../creditUtils';

type Props = {
  application: CreditApplication;
};

function InfoCard({ label, value, icon }: { label: string; value: React.ReactNode; icon?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
        {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
        {label}
      </div>
      <div className="text-sm font-bold text-gray-900">{value || '—'}</div>
    </div>
  );
}

const FACILITY_LABELS: Record<string, string> = {
  TERM_LOAN: 'Term Loan',
  REVOLVING_CREDIT: 'Revolving Credit',
  OVERDRAFT: 'Overdraft',
  LETTER_OF_CREDIT: 'Letter of Credit',
  BANK_GUARANTEE: 'Bank Guarantee',
  TRADE_FINANCE: 'Trade Finance',
  BRIDGE_LOAN: 'Bridge Loan',
  PROJECT_FINANCE: 'Project Finance',
  REVOLVING: 'Revolving',
  LC: 'LC',
  BG: 'BG',
  TRUST_RECEIPT: 'Trust Receipt',
  BRIDGING: 'Bridging',
  CASHLINE: 'Cashline',
  RWC_I: 'RWC-i',
  LC_I: 'LC-i',
  BG_I: 'BG-i',
  ICMTD_I: 'ICMTD-i',
};

const CorporateBorrowerProfile: React.FC<Props> = ({ application }) => {
  const bp = application.borrowerProfile;
  const account = bp?.account;

  const [fullProfile, setFullProfile] = useState<BorrowerProfile | null>(null);
  const [exposure, setExposure] = useState<ExposureSummary | null>(null);
  const [industry, setIndustry] = useState<IndustryAssessment | null>(null);
  const [qualitative, setQualitative] = useState<{
    managementScore: number;
    relationshipScore: number;
    industryScore: number;
    collateralScore: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!application.id || !bp?.id) return;
    setLoading(true);
    Promise.allSettled([
      creditService.getBorrowerProfile(bp.id),
      creditService.getExposureSummary(application.id),
      industryAssessmentApi.get(application.id),
      qualitativeAssessmentApi.get(application.id),
    ]).then(([profileRes, exposureRes, industryRes, qualRes]) => {
      if (profileRes.status === 'fulfilled') setFullProfile(profileRes.value);
      if (exposureRes.status === 'fulfilled') setExposure(exposureRes.value);
      if (industryRes.status === 'fulfilled') setIndustry(industryRes.value);
      if (qualRes.status === 'fulfilled') setQualitative(qualRes.value);
      setLoading(false);
    });
  }, [application.id, bp?.id]);

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading borrower profile…</div>;

  const directors = fullProfile?.directors ?? [];
  const keyManagement = directors.filter((d) => d.isKeyManagement);
  const facilities = application.facilities ?? [];

  // Group exposure from ExposureSummary
  const groupTotalSecured = exposure?.groupTotalSecured ? Number(exposure.groupTotalSecured) : null;
  const groupTotalUnsecured = exposure?.groupTotalUnsecured ? Number(exposure.groupTotalUnsecured) : null;
  const groupTotal = (groupTotalSecured ?? 0) + (groupTotalUnsecured ?? 0);

  const customerTotalSecured = exposure?.customerTotalSecured ? Number(exposure.customerTotalSecured) : null;
  const customerTotalUnsecured = exposure?.customerTotalUnsecured ? Number(exposure.customerTotalUnsecured) : null;
  const customerTotal = (customerTotalSecured ?? 0) + (customerTotalUnsecured ?? 0);

  return (
    <div className="space-y-6">
      {/* ── Corporate Group Structure ─────────────────────────────── */}
      <CaMemoSection title="Corporate Group Structure" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard label="Company Name" value={account?.name || bp?.name || null} icon="business" />
          <InfoCard label="SSM Number" value={account?.registrationNumber || null} icon="app_registration" />
          <InfoCard label="Account Type" value={account?.accountType || null} icon="category" />
          <InfoCard label="Industry" value={account?.industry || null} icon="factory" />
        </div>
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-1">Parent Company</div>
          <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
            {account?.parentAccountId ? (
              <>
                <span className="material-symbols-outlined text-base text-blue-600">corporate_fare</span>
                <span>Linked parent account (ID: {account.parentAccountId.slice(0, 8)}…)</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base text-gray-400">block</span>
                <span className="text-gray-400">No parent company linked</span>
              </>
            )}
          </div>
        </div>
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-1">Subsidiaries</div>
          <div className="text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            Subsidiary lookup requires a group-structure endpoint (not yet available). Use the Parties & Guarantors
            section below for related entities.
          </div>
        </div>
      </CaMemoSection>

      {/* ── Group Exposure ─────────────────────────────────────────── */}
      <CaMemoSection title="Group Exposure" phase="S2">
        {exposure ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard
                label="Group Total Secured"
                value={groupTotalSecured != null ? formatCurrency(groupTotalSecured) : null}
                icon="lock"
              />
              <InfoCard
                label="Group Total Unsecured"
                value={groupTotalUnsecured != null ? formatCurrency(groupTotalUnsecured) : null}
                icon="lock_open"
              />
              <InfoCard
                label="Group Total Exposure"
                value={groupTotal > 0 ? formatCurrency(groupTotal) : null}
                icon="summarize"
              />
              <InfoCard
                label="Customer Total Exposure"
                value={customerTotal > 0 ? formatCurrency(customerTotal) : null}
                icon="person"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard
                label="This App Secured"
                value={exposure.thisAppSecured != null ? formatCurrency(Number(exposure.thisAppSecured)) : null}
                icon="assignment"
              />
              <InfoCard
                label="This App Unsecured"
                value={exposure.thisAppUnsecured != null ? formatCurrency(Number(exposure.thisAppUnsecured)) : null}
                icon="assignment_late"
              />
              <InfoCard
                label="Other App Secured"
                value={exposure.otherAppSecured != null ? formatCurrency(Number(exposure.otherAppSecured)) : null}
                icon="folder_shared"
              />
              <InfoCard
                label="Related Counterparty Secured"
                value={
                  exposure.relatedCounterpartySecured != null
                    ? formatCurrency(Number(exposure.relatedCounterpartySecured))
                    : null
                }
                icon="groups"
              />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No exposure summary recorded for this application.
          </div>
        )}
      </CaMemoSection>

      {/* ── Industry Risk ───────────────────────────────────────────── */}
      <CaMemoSection title="Industry Risk" phase="S2">
        {industry ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoCard label="Sector" value={industry.sectorName || null} icon="factory" />
            <InfoCard label="Subsector" value={industry.subsectorName || null} icon="category" />
            <InfoCard label="Sector Outlook" value={industry.sectorOutlook || null} icon="trending_up" />
            <InfoCard label="Subsector Outlook" value={industry.subsectorOutlook || null} icon="trending_up" />
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No industry assessment on file.
          </div>
        )}
      </CaMemoSection>

      {/* ── Management Assessment ──────────────────────────────────── */}
      <CaMemoSection title="Management Assessment" phase="S2">
        {keyManagement.length > 0 ? (
          <div className="overflow-x-auto mb-4">
            <div className="text-xs font-semibold text-gray-500 mb-2">Key Management Personnel</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Position</th>
                  <th className="text-left py-2 px-3">Nationality</th>
                  <th className="text-left py-2 px-3">Experience & Qualification</th>
                </tr>
              </thead>
              <tbody>
                {keyManagement.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium text-gray-900">{d.name}</td>
                    <td className="py-2 px-3 text-gray-700">{d.position || '—'}</td>
                    <td className="py-2 px-3 text-gray-700">{d.nationality || '—'}</td>
                    <td className="py-2 px-3 text-gray-600 text-xs">{d.experienceQualification || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-base">info</span>
            No key management personnel flagged.
          </div>
        )}
        {qualitative ? (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Qualitative Assessment Scores</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard label="Management Score" value={`${qualitative.managementScore}/100`} icon="manage_accounts" />
              <InfoCard label="Relationship Score" value={`${qualitative.relationshipScore}/100`} icon="handshake" />
              <InfoCard label="Industry Score" value={`${qualitative.industryScore}/100`} icon="factory" />
              <InfoCard label="Collateral Score" value={`${qualitative.collateralScore}/100`} icon="lock" />
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No qualitative assessment on file.
          </div>
        )}
      </CaMemoSection>

      {/* ── Existing Banking Relationships ──────────────────────────── */}
      <CaMemoSection title="Existing Banking Relationships" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard
            label="Bank Account No."
            value={null}
            icon="account_balance"
          />
          <InfoCard
            label="Relationship Since"
            value={null}
            icon="history"
          />
          <InfoCard
            label="Total Exposure"
            value={bp?.totalExposure != null ? formatCurrency(Number(bp.totalExposure)) : null}
            icon="summarize"
          />
          <InfoCard
            label="Exposure Limit"
            value={bp?.exposureLimit != null ? formatCurrency(Number(bp.exposureLimit)) : null}
            icon="account_balance"
          />
        </div>
        <div className="mt-4">
          <div className="text-xs font-semibold text-gray-500 mb-2">Facilities on This Application</div>
          {facilities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                    <th className="text-left py-2 px-3">Facility Type</th>
                    <th className="text-right py-2 px-3">Amount</th>
                    <th className="text-right py-2 px-3">Existing Limit</th>
                    <th className="text-right py-2 px-3">Outstanding</th>
                    <th className="text-left py-2 px-3">Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  {facilities.map((f) => (
                    <tr key={f.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 font-medium text-gray-900">
                        {FACILITY_LABELS[f.facilityType] || f.facilityType}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                        {formatCurrency(Number(f.amount))}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                        {f.existingLimit != null ? formatCurrency(Number(f.existingLimit)) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                        {f.outstandingBalance != null ? formatCurrency(Number(f.outstandingBalance)) : '—'}
                      </td>
                      <td className="py-2 px-3 text-gray-600 text-xs">{f.purpose || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span>
              No facilities on this application.
            </div>
          )}
        </div>
      </CaMemoSection>
    </div>
  );
};

export default CorporateBorrowerProfile;