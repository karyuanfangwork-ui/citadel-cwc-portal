/**
 * Phase 3: SME / Corporate Financial Profile
 *
 * Restructured SME Financials tab with:
 *  - BusinessProfileSection (enhanced statement type card)
 *  - RatiosAndTrendsSection (expanded ratio table with trend arrows)
 *  - FinancialRiskIndicatorsPanel (derived risk flags)
 *  - Analyst remarks (placeholder)
 *
 * For SOLE_PROPRIETOR: dual assessment (owner DSR + business DSCR) preserved.
 */

import React, { useEffect, useState, useCallback } from 'react';
import smeFinancialApi, {
  SmeFinancialAssessment,
  SmeFinancialRatio,
  DualAssessment,
  StatementTypeValidation,
} from '../../../../src/services/smeFinancial.service';
import creditService, { CreditApplication, FinancialRatio } from '../../../../src/services/credit.service';
import BusinessProfileSection from '../../../../src/components/credit/BusinessProfileSection';
import RatiosAndTrendsSection from '../../../../src/components/credit/RatiosAndTrendsSection';
import FinancialRiskIndicatorsPanel from '../../../../src/components/credit/FinancialRiskIndicatorsPanel';
import { friendlyMessage } from '../../../../src/utils/errorMessages';

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return 'bg-emerald-100 text-emerald-700';
    case 'warn': return 'bg-amber-100 text-amber-700';
    case 'fail': return 'bg-red-100 text-red-700';
  }
}

function statusLabel(status: 'pass' | 'warn' | 'fail'): string {
  switch (status) {
    case 'pass': return 'Pass';
    case 'warn': return 'Warning';
    case 'fail': return 'Fail';
  }
}

function formatNumber(value: number | null, decimals = 2): string {
  if (value === null) return '—';
  return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—';
  return `RM ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Callback to push DSCR up to parent for summary strip */
  onDscrChange?: (dscr: number | null) => void;
  /** Callback to push SME ratios up to parent for calculation breakdown */
  onRatiosChange?: (ratios: SmeFinancialRatio[]) => void;
};

// ── Dual Assessment Card (preserved from original) ───────────────────────────

const DualAssessmentCard: React.FC<{ dual: DualAssessment }> = ({ dual }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">Dual Assessment (Sole Proprietor)</h3>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Owner DSR */}
      <div className="border border-gray-100 rounded p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Owner DSR (Personal)</h4>
        {dual.ownerDsr ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Monthly Gross Income</span>
              <span className="text-sm font-medium">{formatCurrency(dual.ownerDsr.monthlyGrossIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Monthly Net Income</span>
              <span className="text-sm font-medium">{formatCurrency(dual.ownerDsr.monthlyNetIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Commitments</span>
              <span className="text-sm font-medium">{formatCurrency(dual.ownerDsr.totalCommitments)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">DSR %</span>
              <span className="text-sm font-medium">{formatNumber(dual.ownerDsr.dsrPercent)}%</span>
            </div>
            {dual.ownerDsr.netDsrPercent !== null && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Net DSR %</span>
                <span className="text-sm font-medium">{formatNumber(dual.ownerDsr.netDsrPercent)}%</span>
              </div>
            )}
            <div className="pt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(dual.ownerDsr.status)}`}>
                DSR: {statusLabel(dual.ownerDsr.status)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No owner DSR data available</p>
        )}
      </div>

      {/* Business DSCR */}
      <div className="border border-gray-100 rounded p-4">
        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Business DSCR</h4>
        {dual.businessDscr ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Net Income</span>
              <span className="text-sm font-medium">{formatCurrency(dual.businessDscr.netIncome)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">EBITDA</span>
              <span className="text-sm font-medium">{formatCurrency(dual.businessDscr.ebitda)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Interest + Principal</span>
              <span className="text-sm font-medium">{formatCurrency(dual.businessDscr.interest + dual.businessDscr.principal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">DSCR</span>
              <span className="text-sm font-medium">{formatNumber(dual.businessDscr.dscr)}x</span>
            </div>
            <div className="pt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(dual.businessDscr.status)}`}>
                DSCR: {statusLabel(dual.businessDscr.status)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No business DSCR data available</p>
        )}
      </div>
    </div>

    {/* Overall */}
    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
      <span className="text-sm font-semibold text-gray-600">Overall Assessment:</span>
      <span className={`inline-flex items-center px-3 py-1 rounded text-sm font-semibold ${statusBadge(dual.overallStatus)}`}>
        {statusLabel(dual.overallStatus)}
      </span>
    </div>
  </div>
);

// ── Analyst Remarks (placeholder) ─────────────────────────────────────────────

const PlaceholderBadge = () => (
  <span className="ml-1 text-[9px] text-gray-400 font-medium italic" title="Not yet persisted">(preview)</span>
);

const AnalystRemarks: React.FC<{ readOnly: boolean }> = ({ readOnly }) => {
  const [remarks, setRemarks] = useState('');
  return (
    <div className="bg-white border rounded-lg p-4">
      <label className="block text-xs font-medium text-gray-600 mb-1">
        Analyst Remarks <PlaceholderBadge />
      </label>
      <textarea
        value={remarks}
        disabled={readOnly}
        onChange={(e) => setRemarks(e.target.value)}
        className="w-full border border-dashed border-gray-300 rounded-md px-3 py-2 text-sm bg-gray-50/50 disabled:bg-gray-50 resize-none h-24"
        placeholder="Document risk observations, mitigating factors, and recommendation for the business financial assessment…"
      />
    </div>
  );
};

// ── Main Tab Component ───────────────────────────────────────────────────────

const SmeFinancialsTab: React.FC<Props> = ({ application, onDscrChange, onRatiosChange }) => {
  const borrowerProfileId = application.borrowerProfile?.id;
  const borrowerType = application.borrowerProfile?.borrowerType;
  const isSoleProprietor = borrowerType === 'SOLE_PROPRIETOR';
  const readOnly = application.state !== 'DRAFT';

  const [assessment, setAssessment] = useState<SmeFinancialAssessment | null>(null);
  const [validation, setValidation] = useState<StatementTypeValidation | null>(null);
  const [corporateRatios, setCorporateRatios] = useState<FinancialRatio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssessment = useCallback(async () => {
    if (!borrowerProfileId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await smeFinancialApi.getAssessment(borrowerProfileId);
      setAssessment(data);

      // Push DSCR up to parent
      const dscrRatio = data.simplifiedRatios.find(r => r.key === 'dscr');
      onDscrChange?.(dscrRatio?.value ?? null);

      // Push ratios up to parent
      onRatiosChange?.(data.simplifiedRatios);

      // Get validation
      const valData = await smeFinancialApi.validateStatementType({
        smeFinancialStatementType: data.smeFinancialStatementType,
        yearsTrading: data.yearsTrading,
        annualAmount: data.annualTurnover,
      });
      setValidation(valData);

      // Fetch corporate financial statement ratios (if any)
      const statements = await creditService.listFinancialStatements(borrowerProfileId);
      if (statements.length > 0) {
        // Get ratios from the most recent statement
        const latest = statements[0];
        if (latest.ratios) {
          setCorporateRatios(latest.ratios);
        }
      }
    } catch (err: any) {
      setError(friendlyMessage(err, 'Failed to load SME financial assessment'));
    } finally {
      setLoading(false);
    }
  }, [borrowerProfileId, onDscrChange, onRatiosChange]);

  useEffect(() => {
    fetchAssessment();
  }, [fetchAssessment]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span className="ml-3 text-sm text-gray-500">Loading SME financial assessment…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        <button onClick={fetchAssessment} className="mt-3 text-sm text-blue-600 hover:underline">Retry</button>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">No SME financial data available for this borrower.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {/* Business Profile + Statement Quality */}
      <BusinessProfileSection
        application={application}
        assessment={assessment}
        validation={validation}
      />

      {/* Ratios & Trends */}
      <RatiosAndTrendsSection
        smeRatios={assessment.simplifiedRatios}
        corporateRatios={corporateRatios}
      />

      {/* Risk Indicators */}
      <FinancialRiskIndicatorsPanel smeRatios={assessment.simplifiedRatios} />

      {/* Dual Assessment for Sole Proprietor */}
      {isSoleProprietor && assessment.dualAssessment && (
        <DualAssessmentCard dual={assessment.dualAssessment} />
      )}

      {/* Non-sole-proprietor info */}
      {!isSoleProprietor && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700">
          This borrower is classified as <strong>{borrowerType}</strong>. Dual assessment (owner DSR + business DSCR) is only available for sole proprietors.
        </div>
      )}

      {/* Analyst Remarks */}
      <AnalystRemarks readOnly={readOnly} />
    </div>
  );
};

export default SmeFinancialsTab;