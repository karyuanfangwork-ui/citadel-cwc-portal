import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  BorrowerProfile,
} from '../../../../src/services/credit.service';
import creditService from '../../../../src/services/credit.service';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import { formatCurrency, formatDate } from '../../creditUtils';

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

const SmeCustomerProfile: React.FC<Props> = ({ application }) => {
  const bp = application.borrowerProfile;
  const account = bp?.account;

  const [fullProfile, setFullProfile] = useState<BorrowerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bp?.id) return;
    creditService
      .getBorrowerProfile(bp.id)
      .then((profile) => {
        setFullProfile(profile);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bp?.id]);

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading customer profile…</div>;

  const directors = fullProfile?.directors ?? [];
  const shareholders = fullProfile?.shareholders ?? [];

  const facilities = application.facilities ?? [];

  return (
    <div className="space-y-6">
      {/* ── Company Information ────────────────────────────────────── */}
      <CaMemoSection title="Company Information" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard label="Company Name" value={account?.name || bp?.name || null} icon="business" />
          <InfoCard label="SSM Number" value={account?.registrationNumber || null} icon="app_registration" />
          <InfoCard label="Industry" value={account?.industry || null} icon="factory" />
          <InfoCard label="Company Size" value={account?.companySize || null} icon="groups" />
          <InfoCard
            label="Annual Revenue"
            value={
              account?.annualRevenue != null
                ? formatCurrency(Number(account.annualRevenue))
                : bp?.annualTurnover != null
                ? formatCurrency(Number(bp.annualTurnover))
                : null
            }
            icon="trending_up"
          />
          <InfoCard label="Years Trading" value={bp?.yearsTrading ?? null} icon="history" />
          <InfoCard label="SIC Code" value={bp?.sicCode || null} icon="tag" />
          <InfoCard label="Credit Risk Rating" value={bp?.creditRiskRating || 'Not rated'} icon="assessment" />
        </div>
        {(account?.address || account?.city || account?.state || account?.country) && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500 mb-1">Registered Address</div>
            <div className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
              {[account?.address, account?.city, account?.state, account?.country].filter(Boolean).join(', ')}
            </div>
          </div>
        )}
      </CaMemoSection>

      {/* ── Business Nature ────────────────────────────────────────── */}
      <CaMemoSection title="Business Nature" phase="S2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InfoCard label="Purpose of Account" value={bp?.purposeOfAccount || null} icon="flag" />
          <InfoCard label="Description" value={account?.description || null} icon="description" />
          <InfoCard label="Source of Wealth" value={bp?.sourceOfWealth || null} icon="savings" />
          <InfoCard label="AML Risk Tier" value={bp?.amlRiskTier || null} icon="shield" />
        </div>
      </CaMemoSection>

      {/* ── Directors ──────────────────────────────────────────────── */}
      <CaMemoSection title="Directors" phase="S2">
        {directors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-left py-2 px-3">Position</th>
                  <th className="text-left py-2 px-3">Nationality</th>
                  <th className="text-left py-2 px-3">Appointed</th>
                  <th className="text-center py-2 px-3">Key Mgmt</th>
                </tr>
              </thead>
              <tbody>
                {directors.map((d) => (
                  <tr key={d.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium text-gray-900">{d.name}</td>
                    <td className="py-2 px-3 text-gray-700">{d.position || '—'}</td>
                    <td className="py-2 px-3 text-gray-700">{d.nationality || '—'}</td>
                    <td className="py-2 px-3 text-gray-700">{formatDate(d.appointmentDate)}</td>
                    <td className="py-2 px-3 text-center">
                      {d.isKeyManagement ? (
                        <span className="material-symbols-outlined text-green-600 text-base">check_circle</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No directors on file.
          </div>
        )}
      </CaMemoSection>

      {/* ── Shareholders ───────────────────────────────────────────── */}
      <CaMemoSection title="Shareholders" phase="S2">
        {shareholders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="text-left py-2 px-3">Name</th>
                  <th className="text-right py-2 px-3">Shareholding %</th>
                  <th className="text-left py-2 px-3">Share Class</th>
                  <th className="text-right py-2 px-3">No. of Shares</th>
                  <th className="text-left py-2 px-3">Nationality</th>
                </tr>
              </thead>
              <tbody>
                {shareholders.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100">
                    <td className="py-2 px-3 font-medium text-gray-900">{s.name}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                      {s.shareholdingPct != null ? `${Number(s.shareholdingPct).toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{s.shareClass || '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                      {s.numberOfShares != null ? s.numberOfShares.toLocaleString('en-MY') : '—'}
                    </td>
                    <td className="py-2 px-3 text-gray-700">{s.nationality || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-base">info</span>
            No shareholders on file.
          </div>
        )}
      </CaMemoSection>

      {/* ── Revenue ─────────────────────────────────────────────────── */}
      <CaMemoSection title="Revenue" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard
            label="Annual Revenue"
            value={account?.annualRevenue != null ? formatCurrency(Number(account.annualRevenue)) : null}
            icon="trending_up"
          />
          <InfoCard
            label="Annual Turnover"
            value={bp?.annualTurnover != null ? formatCurrency(Number(bp.annualTurnover)) : null}
            icon="bar_chart"
          />
          <InfoCard
            label="Exposure Limit"
            value={bp?.exposureLimit != null ? formatCurrency(Number(bp.exposureLimit)) : null}
            icon="account_balance"
          />
          <InfoCard
            label="Total Exposure"
            value={bp?.totalExposure != null ? formatCurrency(Number(bp.totalExposure)) : null}
            icon="summarize"
          />
        </div>
      </CaMemoSection>

      {/* ── Existing Facilities ──────────────────────────────────────── */}
      <CaMemoSection title="Existing Facilities (Current Application)" phase="S2">
        {facilities.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="text-left py-2 px-3">Facility Type</th>
                  <th className="text-right py-2 px-3">Amount / Limit</th>
                  <th className="text-right py-2 px-3">Existing Limit</th>
                  <th className="text-right py-2 px-3">Outstanding Balance</th>
                  <th className="text-right py-2 px-3">Undisbursed</th>
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
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                      {f.undisbursedLimit != null ? formatCurrency(Number(f.undisbursedLimit)) : '—'}
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
      </CaMemoSection>
    </div>
  );
};

export default SmeCustomerProfile;