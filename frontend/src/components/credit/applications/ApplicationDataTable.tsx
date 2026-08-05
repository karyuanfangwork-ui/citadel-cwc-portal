import React from 'react';
import { CreditApplication } from '../../../services/credit.service';
import { SortColumn, SortDir } from '../../../utils/creditSort';
import StateBadge from '../StateBadge';
import ApplicationRiskMeter from './ApplicationRiskMeter';
import ApplicationSlaPill from './ApplicationSlaPill';

interface SlaInfo {
  text: string;
  color: string;
}

interface ApplicationDataTableProps {
  applications: CreditApplication[];
  productLabels: Record<string, string>;
  sortCol: SortColumn;
  sortDir: SortDir;
  canCreate: boolean;
  onSort: (column: SortColumn) => void;
  onRowClick: (applicationId: string) => void;
  onClone: (applicationId: string) => void;
  getBorrowerName: (application: CreditApplication) => string;
  getBorrowerType: (application: CreditApplication) => string;
  getSlaInfo: (application: CreditApplication) => SlaInfo;
  formatCurrency: (amount: number | string | null | undefined, currency?: string | null) => string;
}

const sortableHeader = (
  label: string,
  column: SortColumn,
  sortCol: SortColumn,
  sortDir: SortDir,
  onSort: (column: SortColumn) => void,
) => (
  <button
    onClick={() => onSort(column)}
    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors hover:text-[var(--cr-secondary)]"
    style={{ color: sortCol === column ? 'var(--cr-secondary)' : 'var(--cr-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer' }}
  >
    {label}
    <span className="material-symbols-outlined text-[13px]">
      {sortCol === column ? (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
    </span>
  </button>
);

const ApplicationDataTable: React.FC<ApplicationDataTableProps> = ({
  applications,
  productLabels,
  sortCol,
  sortDir,
  canCreate,
  onSort,
  onRowClick,
  onClone,
  getBorrowerName,
  getBorrowerType,
  getSlaInfo,
  formatCurrency,
}) => {
  return (
    <div className="overflow-hidden" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg)' }}>
      <div className="cr-scroll overflow-x-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
        <table className="w-full min-w-[1120px] border-collapse text-left">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--cr-surface-container-low)' }}>
            <tr className="border-b" style={{ borderColor: 'var(--cr-outline-variant)' }}>
              <th className="p-3 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>App No</th>
              <th className="p-3 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Borrower</th>
              <th className="p-3 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Product / Type</th>
              <th className="p-3">{sortableHeader('Requested Amt', 'amount', sortCol, sortDir, onSort)}</th>
              <th className="p-3 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Risk</th>
              <th className="p-3">{sortableHeader('SLA', 'sla', sortCol, sortDir, onSort)}</th>
              <th className="p-3">{sortableHeader('Status', 'state', sortCol, sortDir, onSort)}</th>
              <th className="p-3 text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Owner</th>
              <th className="p-3 text-right text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--cr-outline-variant)' }}>
            {applications.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-sm" style={{ color: 'var(--cr-on-surface-variant)' }}>
                  <span className="material-symbols-outlined mb-2 block text-3xl opacity-25">search_off</span>
                  No applications found
                </td>
              </tr>
            )}
            {applications.map(app => {
              const state = (app.state || app.status) as string;
              const sla = getSlaInfo(app);
              const borrowerName = getBorrowerName(app);
              const borrowerType = getBorrowerType(app);
              const product = productLabels[app.productType || app.productName || ''] || app.productName || '—';
              const riskRating = app.riskRating || app.borrowerProfile?.creditRiskRating || null;
              const canClone = ['APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED'].includes(state) && canCreate;

              return (
                <tr
                  key={app.id}
                  onClick={() => onRowClick(app.id)}
                  className="cursor-pointer transition-colors hover:bg-[var(--cr-surface-container-low)]"
                >
                  <td className="p-3 align-middle">
                    <div className="font-semibold tabular-nums" style={{ fontFamily: 'var(--cr-font-display)', color: 'var(--cr-secondary)' }}>
                      {app.applicationNo || `#${app.id.slice(-8).toUpperCase()}`}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.04em]" style={{ color: 'var(--cr-on-surface-variant)' }}>
                      {app.branch?.code || 'Credit'}
                    </div>
                  </td>
                  <td className="p-3 align-middle">
                    <div className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{borrowerName}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--cr-on-surface-variant)' }}>{borrowerType}</div>
                  </td>
                  <td className="p-3 align-middle text-sm" style={{ color: 'var(--cr-on-surface)' }}>
                    <div>{product}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: 'var(--cr-on-surface-variant)' }}>{app.applicationType || 'Credit Application'}</div>
                  </td>
                  <td className="p-3 align-middle text-sm font-semibold tabular-nums" style={{ color: 'var(--cr-on-surface)' }}>
                    {formatCurrency(app.requestedAmount, app.currency)}
                  </td>
                  <td className="p-3 align-middle"><ApplicationRiskMeter rating={riskRating} /></td>
                  <td className="p-3 align-middle"><ApplicationSlaPill text={sla.text} color={sla.color} /></td>
                  <td className="p-3 align-middle"><StateBadge state={state} /></td>
                  <td className="p-3 align-middle">
                    {app.rm ? (
                      <div className="inline-flex items-center gap-2 rounded-full px-2 py-1 text-[11px] font-semibold" style={{ background: 'var(--cr-surface-container-low)', color: 'var(--cr-on-surface)' }}>
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: 'var(--cr-secondary)' }}>
                          {app.rm.firstName?.[0] ?? '?'}
                        </span>
                        {app.rm.firstName} {app.rm.lastName?.[0] ? `${app.rm.lastName[0]}.` : ''}
                      </div>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--cr-on-surface-variant)' }}>Unassigned</span>
                    )}
                  </td>
                  <td className="p-3 align-middle text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      {canClone && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onClone(app.id); }}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-bold transition-colors hover:bg-[var(--cr-surface-container)]"
                          style={{ borderColor: 'var(--cr-outline-variant)', color: 'var(--cr-on-surface-variant)', background: 'white', cursor: 'pointer' }}
                          title="Clone this application into a new draft"
                        >
                          <span className="material-symbols-outlined text-[13px]">content_copy</span>
                          Clone
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onRowClick(app.id); }}
                        className="rounded p-1 transition-colors hover:bg-[var(--cr-surface-container)]"
                        style={{ color: 'var(--cr-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer' }}
                        aria-label={`Open ${app.applicationNo || app.id}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ApplicationDataTable;
