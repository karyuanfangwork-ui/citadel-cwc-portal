/**
 * P2-3: SME Financials Tab
 *
 * Simplified financial assessment view for SME borrowers.
 * - Shows statement type requirements (AUDITED/MANAGEMENT/COMPILED)
 * - Displays SME-calibrated benchmarks for key ratios
 * - For SOLE_PROPRIETOR: shows dual assessment (owner DSR + business DSCR)
 */

import React, { useEffect, useState, useCallback } from 'react';
import smeFinancialApi, {
  SmeFinancialAssessment,
  SmeFinancialRatio,
  DualAssessment,
  StatementTypeValidation,
} from '../../../src/services/smeFinancial.service';
import creditService, { CreditApplication } from '../../../src/services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';

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

function statementTypeLabel(type: string | null): string {
  switch (type) {
    case 'AUDITED': return 'Audited';
    case 'MANAGEMENT': return 'Management';
    case 'COMPILED': return 'Compiled';
    default: return 'Not specified';
  }
}

// ── Props ────────────────────────────────────────────────────────────────────

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

// ── Sub-Components ───────────────────────────────────────────────────────────

/** Statement type requirements card */
const StatementTypeCard: React.FC<{
  assessment: SmeFinancialAssessment;
  validation: StatementTypeValidation | null;
}> = ({ assessment, validation }) => {
  const requiresAudited = assessment.requiresAudited;
  const acceptsManagement = assessment.acceptsManagement;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Financial Statement Requirements</h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <span className="text-xs text-gray-500">Current Type</span>
          <p className="text-sm font-medium text-gray-900">
            {statementTypeLabel(assessment.smeFinancialStatementType)}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Years Trading</span>
          <p className="text-sm font-medium text-gray-900">
            {assessment.yearsTrading !== null ? assessment.yearsTrading : '—'}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500">Annual Turnover</span>
          <p className="text-sm font-medium text-gray-900">
            {formatCurrency(assessment.annualTurnover)}
          </p>
        </div>
        <div>
          <span className="text-xs text-gray-500">SIC Code</span>
          <p className="text-sm font-medium text-gray-900">
            {assessment.sicCode ?? '—'}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          requiresAudited ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
        }`}>
          {requiresAudited ? '⚠ Audited Required' : '✓ Audited Not Required'}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          acceptsManagement ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
        }`}>
          {acceptsManagement ? '✓ Management Accepted' : '⚠ Management Not Accepted'}
        </span>
      </div>

      {validation && (
        <div className={`text-xs p-2 rounded ${
          validation.acceptable ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
        }`}>
          {validation.reason}
        </div>
      )}
    </div>
  );
};

/** Simplified ratios table */
const SimplifiedRatiosTable: React.FC<{ ratios: SmeFinancialRatio[] }> = ({ ratios }) => {
  if (ratios.length === 0) {
    return <p className="text-sm text-gray-500">No ratio data available.</p>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">SME Simplified Ratios</h3>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ratio</th>
            <th className="px-5 py-2 text-right text-xs font-medium text-gray-500 uppercase">Value</th>
            <th className="px-5 py-2 text-center text-xs font-medium text-gray-500 uppercase">Pass</th>
            <th className="px-5 py-2 text-center text-xs font-medium text-gray-500 uppercase">Warn</th>
            <th className="px-5 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ratios.map((r) => (
            <tr key={r.key} className="hover:bg-gray-50">
              <td className="px-5 py-2 text-sm text-gray-900">{r.label}</td>
              <td className="px-5 py-2 text-sm text-right font-mono text-gray-900">
                {formatNumber(r.value)}{r.unit === '%' ? '%' : r.unit === 'x' ? 'x' : ''}
              </td>
              <td className="px-5 py-2 text-sm text-center text-gray-600">
                {r.benchmark.direction === 'higher_is_better' ? '≥' : '≤'}{r.benchmark.passThreshold}
                {r.unit === '%' ? '%' : r.unit === 'x' ? 'x' : ''}
              </td>
              <td className="px-5 py-2 text-sm text-center text-gray-600">
                {r.benchmark.direction === 'higher_is_better' ? '≥' : '≤'}{r.benchmark.warnThreshold}
                {r.unit === '%' ? '%' : r.unit === 'x' ? 'x' : ''}
              </td>
              <td className="px-5 py-2 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(r.status)}`}>
                  {statusLabel(r.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/** Dual assessment card for sole proprietors */
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

// ── Main Tab Component ───────────────────────────────────────────────────────

const SmeFinancialsTab: React.FC<Props> = ({ application }) => {
  const borrowerProfileId = application.borrowerProfile?.id;
  const borrowerType = application.borrowerProfile?.borrowerType;
  const isSoleProprietor = borrowerType === 'SOLE_PROPRIETOR';

  const [assessment, setAssessment] = useState<SmeFinancialAssessment | null>(null);
  const [validation, setValidation] = useState<StatementTypeValidation | null>(null);
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

      // Also get validation for current statement type
      const valData = await smeFinancialApi.validateStatementType({
        smeFinancialStatementType: data.smeFinancialStatementType,
        yearsTrading: data.yearsTrading,
        annualAmount: data.annualTurnover,
      });
      setValidation(valData);
    } catch (err: any) {
      setError(friendlyMessage(err, 'Failed to load SME financial assessment'));
      toast.error('Failed to load SME financial assessment');
    } finally {
      setLoading(false);
    }
  }, [borrowerProfileId]);

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
    <div className="space-y-6 p-6">
      {/* Statement Type Requirements */}
      <StatementTypeCard assessment={assessment} validation={validation} />

      {/* Simplified Ratios */}
      <SimplifiedRatiosTable ratios={assessment.simplifiedRatios} />

      {/* Dual Assessment for Sole Proprietor */}
      {isSoleProprietor && assessment.dualAssessment && (
        <DualAssessmentCard dual={assessment.dualAssessment} />
      )}

      {/* Info box for non-SME */}
      {!isSoleProprietor && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-700">
          This borrower is classified as <strong>{borrowerType}</strong>. Dual assessment (owner DSR + business DSCR) is only available for sole proprietors.
        </div>
      )}
    </div>
  );
};

export default SmeFinancialsTab;