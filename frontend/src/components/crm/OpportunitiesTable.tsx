import React from 'react';
import { Link } from 'react-router-dom';
import type { CrmOpportunity } from '../../services/crm.service';
import { hasPermission } from '../../utils/permissions';
import StageDropdown from './StageDropdown';
import {
  formatCurrency,
  formatShortDate,
  isOverdue,
  isToday,
  winProbStyle,
  stageBadgeColor,
} from './crmConstants';

// ── Types ──────────────────────────────────────────────────────────
type SortField = 'name' | 'stageId' | 'value' | 'probability' | 'expectedCloseDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface PipelineRef {
  id: string;
  stages?: { id: string; name: string; probability: number; displayOrder?: number; color?: string; isWonStage?: boolean; isLostStage?: boolean }[];
}

interface OpportunitiesTableProps {
  opportunities: CrmOpportunity[];
  pipelines: PipelineRef[];
  sortConfig: SortConfig | null;
  onSort: (field: SortField) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEdit: (opp: CrmOpportunity) => void;
  onDelete: (opp: CrmOpportunity) => void;
  onStageChange: (oppId: string, stageId: string, lostReason?: string) => void;
  isAllSelected: boolean;
  user: any;
}

// ── Sort indicator ──────────────────────────────────────────────
const SortIcon: React.FC<{ active: boolean; direction: SortDirection | null }> = ({ active, direction }) => (
  <span className="material-symbols-outlined text-sm ml-0.5" style={{ fontSize: 14, opacity: active ? 1 : 0.3 }}>
    {direction === 'asc' ? 'arrow_upward' : direction === 'desc' ? 'arrow_downward' : 'unfold_more'}
  </span>
);

// ── Desktop table header ─────────────────────────────────────────
const TableHeader: React.FC<{
  sortConfig: SortConfig | null;
  onSort: (field: SortField) => void;
  isAllSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  oppCount: number;
}> = ({ sortConfig, onSort, isAllSelected, onSelectAll, onClearSelection, oppCount }) => {
  const sortableCol = (label: string, field: SortField) => (
    <th
      className={`text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] cursor-pointer select-none hover:text-[#006a61] transition-colors`}
      onClick={() => onSort(field)}
      aria-sort={sortConfig?.field === field ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        <SortIcon active={sortConfig?.field === field} direction={sortConfig?.field === field ? sortConfig.direction : null} />
      </span>
    </th>
  );

  return (
    <thead className="bg-[#f0f4f8] border-b border-[#e2e8f0]">
      <tr>
        <th className="px-4 py-3 w-10">
          <input
            type="checkbox"
            checked={isAllSelected && oppCount > 0}
            onChange={() => isAllSelected ? onClearSelection() : onSelectAll()}
            className="w-4 h-4 rounded border-[#e2e8f0] text-[#006a61] focus:ring-[#006a61] cursor-pointer"
            title={isAllSelected ? 'Deselect all' : 'Select all on this page'}
          />
        </th>
        {sortableCol('Opportunity', 'name')}
        {sortableCol('Stage', 'stageId')}
        {sortableCol('Value', 'value')}
        {sortableCol('Probability', 'probability')}
        <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Contact</th>
        <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d] hidden xl:table-cell">Account</th>
        {sortableCol('Close Date', 'expectedCloseDate')}
        <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-[0.05em] text-[#45464d]">Owner</th>
        <th className="px-4 py-3 sticky right-0 bg-[#f0f4f8] z-10"></th>
      </tr>
    </thead>
  );
};

// ── Desktop table row ────────────────────────────────────────────
const OppRow: React.FC<{
  opp: CrmOpportunity;
  stages: { id: string; name: string; probability: number; displayOrder?: number; color?: string; isWonStage?: boolean; isLostStage?: boolean }[];
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (opp: CrmOpportunity) => void;
  onDelete: (opp: CrmOpportunity) => void;
  onStageChange: (oppId: string, stageId: string, lostReason?: string) => void;
  canDelete: boolean;
}> = ({ opp, stages, isSelected, onToggleSelect, onEdit, onDelete, onStageChange, canDelete }) => {
  const contactName = opp.contact ? `${opp.contact.firstName} ${opp.contact.lastName}`.trim() : null;
  const closeDateOverdue = opp.expectedCloseDate && isOverdue(opp.expectedCloseDate) && !isToday(opp.expectedCloseDate);

  return (
    <tr className={`border-b border-[#e2e8f0] hover:bg-[#f0f4f8] transition-colors ${isSelected ? 'bg-[#e8f0fe]' : ''}`}>
      <td className="px-4 py-2.5 w-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(opp.id)}
          className="w-4 h-4 rounded border-[#e2e8f0] text-[#006a61] focus:ring-[#006a61] cursor-pointer"
        />
      </td>
      <td className="px-4 py-2.5" style={{ minWidth: 180 }}>
        <Link
          to={`/crm/opportunities/${opp.id}`}
          className="text-sm font-bold text-[#0b1c30] hover:text-[#006a61] hover:underline transition-colors line-clamp-2"
          title={opp.name}
        >
          {opp.name}
        </Link>
        {opp.description && (
          <p className="text-xs text-text-tertiary line-clamp-1 mt-0.5" title={opp.description}>
            {opp.description}
          </p>
        )}
      </td>
      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
        {opp.stage ? (
          <StageDropdown
            currentStage={opp.stage}
            stages={stages}
            onChange={(stageId, lostReason) => onStageChange(opp.id, stageId, lostReason)}
            compact
          />
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-sm font-bold text-[#006a61]">{formatCurrency(opp.value)}</span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#f0f4f8] rounded-full overflow-hidden" style={{ minWidth: 40 }}>
            <div className="h-full rounded-full" style={{ width: `${opp.probability}%`, background: opp.stage ? stageBadgeColor(opp.stage) : 'var(--color-brand-500)' }} />
          </div>
          <span className="text-xs font-bold text-text-secondary">{opp.probability}%</span>
          {opp.aiWinProbability != null && (() => {
            const ws = winProbStyle(opp.aiWinProbability);
            return (
              <span
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ml-1"
                style={{ background: ws.bg, color: ws.text }}
                title={`AI Win Probability: ${opp.aiWinProbability}%${opp.aiWinReason ? ' — ' + opp.aiWinReason : ''}`}
              >
                <span className="material-symbols-outlined text-sm">{ws.icon}</span>
                AI {opp.aiWinProbability}%
              </span>
            );
          })()}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {contactName ? (
          <span className="text-sm text-text-primary line-clamp-1">{contactName}</span>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 hidden xl:table-cell">
        <span className="text-sm text-text-secondary line-clamp-1">{opp.account?.name || '—'}</span>
      </td>
      <td className="px-4 py-2.5 hidden xl:table-cell">
        {opp.expectedCloseDate ? (
          <span className="text-xs" style={{ color: closeDateOverdue ? 'var(--color-danger)' : undefined, fontWeight: closeDateOverdue ? 700 : 400 }}>
            {closeDateOverdue && <span className="material-symbols-outlined text-xs align-middle mr-0.5">warning</span>}
            {formatShortDate(opp.expectedCloseDate)}
          </span>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {opp.owner ? (
          <div className="flex items-center gap-1.5">
            {opp.owner.avatarUrl ? (
              <img src={opp.owner.avatarUrl} alt={opp.owner.firstName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#d3e4fe] flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-[#006a61]">{opp.owner.firstName?.[0]}{opp.owner.lastName?.[0]}</span>
              </div>
            )}
            <span className="text-xs text-text-secondary line-clamp-1">{opp.owner.firstName}</span>
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 sticky right-0 bg-white z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onEdit(opp); }}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
            title="Edit opportunity"
          >
            <span className="material-symbols-outlined text-base text-[#76777d] hover:text-[#006a61]">edit</span>
          </button>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(opp); }}
              className="p-1 rounded hover:bg-red-50 transition-colors"
              style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              title="Delete opportunity"
            >
              <span className="material-symbols-outlined text-base text-text-secondary hover:text-red-600">delete</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ── Mobile stacked card ──────────────────────────────────────────
const MobileOppCard: React.FC<{
  opp: CrmOpportunity;
  stages: { id: string; name: string; probability: number; displayOrder?: number; color?: string; isWonStage?: boolean; isLostStage?: boolean }[];
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (opp: CrmOpportunity) => void;
  onDelete: (opp: CrmOpportunity) => void;
  onStageChange: (oppId: string, stageId: string, lostReason?: string) => void;
  canDelete: boolean;
}> = ({ opp, stages, isSelected, onToggleSelect, onEdit, onDelete, onStageChange, canDelete }) => {
  const contactName = opp.contact ? `${opp.contact.firstName} ${opp.contact.lastName}`.trim() : null;
  const closeDateOverdue = opp.expectedCloseDate && isOverdue(opp.expectedCloseDate) && !isToday(opp.expectedCloseDate);

  return (
    <div className={`bg-white border rounded-xl p-4 transition-all ${isSelected ? 'border-[#006a61] ring-2 ring-[#006a61]/10' : 'border-[#e2e8f0] hover:border-[#006a61]/30'}`}>
      {/* Row 1: checkbox + name + stage */}
      <div className="flex items-start gap-2 mb-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(opp.id)}
          className="w-4 h-4 rounded border-[#e2e8f0] text-[#006a61] focus:ring-[#006a61] cursor-pointer mt-0.5"
        />
        <Link to={`/crm/opportunities/${opp.id}`} className="text-sm font-bold text-[#0b1c30] hover:text-[#006a61] flex-1 line-clamp-2" title={opp.name}>
          {opp.name}
        </Link>
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {opp.stage && (
            <StageDropdown
              currentStage={opp.stage}
              stages={stages}
              onChange={(stageId, lostReason) => onStageChange(opp.id, stageId, lostReason)}
              compact
            />
          )}
        </div>
      </div>
      {opp.description && (
        <p className="text-xs text-text-tertiary line-clamp-1 ml-6 mb-1" title={opp.description}>
          {opp.description}
        </p>
      )}
      {/* Row 2: value + probability */}
      <div className="flex items-center gap-3 text-sm mb-1.5 ml-6">
        <span className="font-bold text-[#006a61]">{formatCurrency(opp.value)}</span>
        <div className="flex items-center gap-1 flex-1">
          <div className="flex-1 h-1.5 bg-[#f0f4f8] rounded-full overflow-hidden" style={{ minWidth: 30 }}>
            <div className="h-full rounded-full" style={{ width: `${opp.probability}%`, background: opp.stage ? stageBadgeColor(opp.stage) : 'var(--color-brand-500)' }} />
          </div>
          <span className="text-xs font-bold text-text-secondary">{opp.probability}%</span>
        </div>
        {opp.aiWinProbability != null && (() => {
          const ws = winProbStyle(opp.aiWinProbability);
          return (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: ws.bg, color: ws.text }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{ws.icon}</span>
              {opp.aiWinProbability}%
            </span>
          );
        })()}
      </div>
      {/* Row 3: contact + account + close date + owner */}
      <div className="flex items-center gap-3 text-xs text-text-tertiary ml-6">
        {contactName && <span>{contactName}</span>}
        {opp.account?.name && <span>{opp.account.name}</span>}
        {opp.expectedCloseDate && (
          <span style={{ color: closeDateOverdue ? 'var(--color-danger)' : undefined, fontWeight: closeDateOverdue ? 700 : 400 }}>
            {closeDateOverdue ? '⚠ ' : ''}{formatShortDate(opp.expectedCloseDate)}
          </span>
        )}
        {opp.owner && (
          <span className="flex items-center gap-0.5">
            <span className="material-symbols-outlined text-sm">person</span>
            {opp.owner.firstName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onEdit(opp)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
            <span className="material-symbols-outlined text-base text-[#76777d]">edit</span>
          </button>
          {canDelete && (
            <button onClick={() => onDelete(opp)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 2 }}>
              <span className="material-symbols-outlined text-base text-[#76777d]">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main component ───────────────────────────────────────────────
const OpportunitiesTable: React.FC<OpportunitiesTableProps> = ({
  opportunities,
  pipelines,
  sortConfig,
  onSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onEdit,
  onDelete,
  onStageChange,
  isAllSelected,
  user,
}) => {
  const canDelete = hasPermission(user, 'crm:delete');

  // Helper: get stages for a given pipelineId
  const getStages = (pipelineId: string) =>
    pipelines.find(p => p.id === pipelineId)?.stages ?? [];

  // Desktop table
  const desktopTable = (
    <div className="hidden lg:block w-full overflow-x-auto rounded-xl border border-[#e2e8f0] bg-white">
      <table className="w-full" style={{ minWidth: 1000 }}>
        <TableHeader sortConfig={sortConfig} onSort={onSort} isAllSelected={isAllSelected} onSelectAll={onSelectAll} onClearSelection={onClearSelection} oppCount={opportunities.length} />
        <tbody>
          {opportunities.map(opp => (
            <OppRow
              key={opp.id}
              opp={opp}
              stages={getStages(opp.pipelineId)}
              isSelected={selectedIds.has(opp.id)}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onStageChange={onStageChange}
              canDelete={canDelete}
            />
          ))}
        </tbody>
      </table>
      {opportunities.length === 0 && (
        <div className="py-12 text-center text-[#76777d] text-sm">No opportunities found</div>
      )}
    </div>
  );

  // Mobile stacked list
  const mobileList = (
    <div className="lg:hidden space-y-3">
      {opportunities.map(opp => (
        <MobileOppCard
          key={opp.id}
          opp={opp}
          stages={getStages(opp.pipelineId)}
          isSelected={selectedIds.has(opp.id)}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onStageChange={onStageChange}
          canDelete={canDelete}
        />
      ))}
      {opportunities.length === 0 && (
        <div className="py-12 text-center text-[#76777d] text-sm">No opportunities found</div>
      )}
    </div>
  );

  return (
    <>
      {desktopTable}
      {mobileList}
    </>
  );
};

export default OpportunitiesTable;