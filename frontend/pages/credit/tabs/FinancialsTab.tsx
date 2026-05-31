import React, { useEffect, useState } from 'react';
import creditService, {
  CreditApplication,
  FinancialStatement,
  financialApi,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import RetailIncomeTab from './RetailIncomeTab';

// S3 · Financials — Financial spreading for non-bank SME lending.
// Shows financial statements, key ratios (DSCR, current ratio, gearing).
// Bank-only Profitability/WalletShare/Utilisation are behind credit:advanced_memo flag.

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

const FinancialsTab: React.FC<Props> = ({ application }) => {
  const [statements, setStatements] = useState<FinancialStatement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bpId = application.borrowerProfileId;
    if (!bpId) { setLoading(false); return; }
    setLoading(true);
    financialApi.listStatements(bpId)
      .then(data => setStatements(data || []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, [application.borrowerProfileId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  // Retail borrowers use DSR income form instead of financial spreader
  const borrowerType = application.borrowerProfile?.borrowerType;
  if (borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR') {
    return (
      <CaMemoSection title="Retail Income Assessment" phase="S3">
        <RetailIncomeTab applicationId={application.id} />
      </CaMemoSection>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Financial Statements ──────────────── */}
      <CaMemoSection title="Financial Statements" phase="S3">
        {statements.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <span className="material-symbols-outlined text-4xl mb-2 block">analytics</span>
            <p className="text-sm">No financial statements recorded yet.</p>
            <p className="text-xs mt-1">Add financial statements via the financial spreading tool.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {statements.map((fs, idx) => (
              <div key={fs.id || idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-gray-900">
                      {fs.fiscalYearEnd || `Period ${idx + 1}`}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">
                      {fs.statementType || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                      {fs.currency || 'MYR'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      {fs.period || '—'}
                    </span>
                  </div>
                </div>
                {fs.lineItems && fs.lineItems.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {fs.lineItems.slice(0, 9).map((li, liIdx) => (
                      <div key={li.id || liIdx} className="bg-gray-50 rounded px-2 py-1 text-xs">
                        <span className="text-gray-500">{li.lineLabel || li.lineKey || `Line ${liIdx + 1}`}</span>
                        <span className="float-right font-semibold text-gray-900">
                          {li.amount != null ? Number(li.amount).toLocaleString('en-MY') : '—'}
                        </span>
                      </div>
                    ))}
                    {fs.lineItems.length > 9 && (
                      <div className="col-span-full text-xs text-gray-400 text-center py-1">
                        +{fs.lineItems.length - 9} more line items
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">No line items</p>
                )}
                {fs.ratios && fs.ratios.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {fs.ratios.map((r, rIdx) => (
                      <span key={r.id || rIdx} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                        {r.ratioLabel || r.ratioKey || 'Ratio'}: {r.value ?? '—'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CaMemoSection>

      {/* ── Key Ratios Summary ─────────────────── */}
      <CaMemoSection title="Key Financial Ratios" phase="S3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(() => {
            // Attempt to compute ratios from the first PL + BS statements
            const plStmt = statements.find(s => s.statementType === 'PL');
            const bsStmt = statements.find(s => s.statementType === 'BS');
            const bsRatios = bsStmt?.ratios || [];
            const plRatios = plStmt?.ratios || [];
            const allRatios = [...bsRatios, ...plRatios];
            const find = (key: string) => {
              const r = allRatios.find(r => (r.ratioKey || '').toUpperCase().includes(key.toUpperCase()));
              return r?.value ?? null;
            };
            const display = (v: string | number | null) => v != null ? String(v) : '—';
            return [
              { label: 'DSCR', value: display(find('DSCR')), desc: 'Debt Service Coverage Ratio' },
              { label: 'Current Ratio', value: display(find('CURRENT_RATIO') || find('CURRENT')), desc: 'Current Assets / Current Liabilities' },
              { label: 'Gearing', value: display(find('GEARING') || find('DEBT_EQUITY') || find('D_E')), desc: 'Total Debt / Total Equity' },
              { label: 'LTV', value: display(find('LTV') || find('LOAN_TO_VALUE')), desc: 'Loan-to-Value' },
            ];
          })().map(r => (
              <div key={r.label} className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">{r.label}</div>
                <div className="text-xl font-black text-gray-900">{r.value}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{r.desc}</div>
              </div>
            ))
          }
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Ratios are auto-calculated from financial statements when line items are complete.
        </p>
      </CaMemoSection>
    </div>
  );
};

export default FinancialsTab;