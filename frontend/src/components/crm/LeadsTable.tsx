import React from 'react';
import { Link } from 'react-router-dom';
import type { CrmLead, LeadStatus } from '../../services/crm.service';
import { hasPermission } from '../../utils/permissions';
import StatusDropdown from './StatusDropdown';
import {
  STATUS_STYLES,
  SOURCE_LABELS,
  formatCurrency,
  formatShortDate,
  isToday,
  isOverdue,
  isStale,
  scoreStyle,
} from './crmConstants';

type SortField = 'title' | 'status' | 'aiScore' | 'estimatedValue' | 'followUpDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface LeadsTableProps {
  leads: CrmLead[];
  sortConfig: SortConfig | null;
  onSort: (field: SortField) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEdit: (lead: CrmLead) => void;
  onDelete: (lead: CrmLead) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
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
  leadCount: number;
}> = ({ sortConfig, onSort, isAllSelected, onSelectAll, onClearSelection, leadCount }) => {
  const sortableCol = (label: string, field: SortField) => (
    <th
      className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-text-primary transition-colors"
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
    <thead className="bg-surface-muted border-b border-border">
      <tr>
        <th className="px-4 py-3 w-10">
          <input
            type="checkbox"
            checked={isAllSelected && leadCount > 0}
            onChange={() => isAllSelected ? onClearSelection() : onSelectAll()}
            className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
            title={isAllSelected ? 'Deselect all' : 'Select all on this page'}
          />
        </th>
        {sortableCol('Lead Title', 'title')}
        {sortableCol('Status', 'status')}
        {sortableCol('Score', 'aiScore')}
        <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Contact</th>
        {sortableCol('Value', 'estimatedValue')}
        {sortableCol('Follow-up', 'followUpDate')}
        <th className="px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider hidden xl:table-cell">Source</th>
        <th className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider">Owner</th>
        <th
          className="text-left px-4 py-3 text-xs font-bold text-text-secondary uppercase tracking-wider cursor-pointer select-none hover:text-text-primary transition-colors hidden xl:table-cell"
          onClick={() => onSort('createdAt')}
          aria-sort={sortConfig?.field === 'createdAt' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
          <span className="inline-flex items-center gap-0.5">
            Created
            <SortIcon active={sortConfig?.field === 'createdAt'} direction={sortConfig?.field === 'createdAt' ? sortConfig.direction : null} />
          </span>
        </th>
        <th className="px-4 py-3 sticky right-0 bg-surface-muted z-10"></th>
      </tr>
    </thead>
  );
};

// ── Desktop table row ────────────────────────────────────────────
const LeadRow: React.FC<{
  lead: CrmLead;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (lead: CrmLead) => void;
  onDelete: (lead: CrmLead) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  canDelete: boolean;
}> = ({ lead, isSelected, onToggleSelect, onEdit, onDelete, onStatusChange, canDelete }) => {
  const st = STATUS_STYLES[lead.status] || STATUS_STYLES.NEW;

  // Urgency indicators
  const badge = getUrgencyBadgeInline(lead);

  // Follow-up display
  const followUpDisplay = lead.followUpDate
    ? (isOverdue(lead.followUpDate) && !isToday(lead.followUpDate))
      ? { text: formatShortDate(lead.followUpDate), color: 'var(--color-danger)', bold: true }
      : isToday(lead.followUpDate)
      ? { text: 'Today', color: 'var(--color-warning)', bold: true }
      : { text: formatShortDate(lead.followUpDate), color: 'var(--color-text-secondary)', bold: false }
    : null;

  return (
    <tr className={`border-b border-border hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-brand-50/40' : ''}`}>
      <td className="px-4 py-2.5 w-10">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(lead.id)}
          className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer"
        />
      </td>
      <td className="px-4 py-2.5" style={{ minWidth: 180 }}>
        <Link
          to={`/crm/leads/${lead.id}`}
          className="text-sm font-bold text-text-primary hover:text-brand-700 hover:underline transition-colors line-clamp-2"
          title={lead.title}
        >
          {lead.title}
        </Link>
        {lead.description && (
          <p className="text-xs text-text-tertiary line-clamp-1 mt-0.5" title={lead.description}>
            {lead.description}
          </p>
        )}
      </td>
      <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <StatusDropdown currentStatus={lead.status} onChange={newStatus => onStatusChange(lead.id, newStatus)} compact />
          {badge && (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: badge.color }}
              title={badge.title}
            />
          )}
        </div>
      </td>
      <td className="px-4 py-2.5">
        {lead.aiScore != null ? (() => {
          const s = scoreStyle(lead.aiScore);
          return (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold"
              style={{ background: s.bg, color: s.text }}>
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              {lead.aiScore}
            </span>
          );
        })() : (
          <span className="text-xs text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        <div className="text-sm text-text-primary line-clamp-1">{lead.contactName || '—'}</div>
        {lead.companyName && (
          <div className="text-xs text-text-tertiary line-clamp-1">{lead.companyName}</div>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-sm font-bold text-brand-600">{formatCurrency(lead.estimatedValue)}</span>
      </td>
      <td className="px-4 py-2.5">
        {followUpDisplay ? (
          <span className="text-sm" style={{ color: followUpDisplay.color, fontWeight: followUpDisplay.bold ? 700 : 400 }}>
            {followUpDisplay.text}
          </span>
        ) : (
          <span className="text-sm text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 hidden xl:table-cell">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: lead.source === 'WEBSITE' ? 'var(--color-it-50)' : lead.source === 'REFERRAL' ? 'var(--color-hr-50)' : 'var(--color-surface-muted)',
            color: lead.source === 'WEBSITE' ? 'var(--color-it-500)' : lead.source === 'REFERRAL' ? 'var(--color-success)' : 'var(--color-text-secondary)',
          }}>
          {SOURCE_LABELS[lead.source] || lead.source.replace(/_/g, ' ')}
        </span>
      </td>
      <td className="px-4 py-2.5">
        {lead.owner ? (
          <div className="flex items-center gap-1.5">
            {lead.owner.avatarUrl ? (
              <img src={lead.owner.avatarUrl} alt={lead.owner.firstName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-brand-600">{lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}</span>
              </div>
            )}
            <span className="text-xs text-text-secondary line-clamp-1">{lead.owner.firstName}</span>
          </div>
        ) : (
          <span className="text-xs text-text-tertiary">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 hidden xl:table-cell">
        <span className="text-sm text-text-tertiary">{formatShortDate(lead.createdAt)}</span>
      </td>
      <td className="px-4 py-2.5 sticky right-0 bg-white z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-1">
          <button
            onClick={e => { e.stopPropagation(); onEdit(lead); }}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
            title="Edit lead"
          >
            <span className="material-symbols-outlined text-base text-text-secondary hover:text-brand-700">edit</span>
          </button>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(lead); }}
              className="p-1 rounded hover:bg-red-50 transition-colors"
              style={{ border: 'none', background: 'none', cursor: 'pointer' }}
              title="Delete lead"
            >
              <span className="material-symbols-outlined text-base text-text-secondary hover:text-red-600">delete</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};

// ── Mobile compact row ───────────────────────────────────────────
const MobileLeadRow: React.FC<{
  lead: CrmLead;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (lead: CrmLead) => void;
  onDelete: (lead: CrmLead) => void;
  onStatusChange: (leadId: string, newStatus: LeadStatus) => void;
  canDelete: boolean;
}> = ({ lead, isSelected, onToggleSelect, onEdit, onDelete, onStatusChange, canDelete }) => {
  const st = STATUS_STYLES[lead.status] || STATUS_STYLES.NEW;
  const followUpOverdue = lead.followUpDate && isOverdue(lead.followUpDate) && !isToday(lead.followUpDate);

  return (
    <div className={`bg-surface border rounded-xl p-4 transition-all ${isSelected ? 'border-brand-400 ring-2 ring-brand-100' : 'border-border hover:border-brand-200'}`}>
      {/* Row 1: checkbox + title */}
      <div className="flex items-start gap-2 mb-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(lead.id)}
          className="w-4 h-4 rounded border-border text-brand-600 focus:ring-brand-500 cursor-pointer mt-0.5"
        />
        <Link to={`/crm/leads/${lead.id}`} className="text-sm font-bold text-text-primary hover:text-brand-700 flex-1 line-clamp-2" title={lead.title}>
          {lead.title}
        </Link>
        {/* Description preview below title */}
        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <StatusDropdown currentStatus={lead.status} onChange={newStatus => onStatusChange(lead.id, newStatus)} compact />
        </div>
      </div>
      {lead.description && (
        <p className="text-xs text-text-tertiary line-clamp-1 ml-6 mb-1" title={lead.description}>
          {lead.description}
        </p>
      )}
      {/* Row 2: value + contact */}
      <div className="flex items-center gap-3 text-sm mb-1.5 ml-6">
        <span className="font-bold text-brand-600">{formatCurrency(lead.estimatedValue)}</span>
        {(lead.contactName || lead.companyName) && (
          <span className="text-text-secondary truncate">
            {lead.contactName}{lead.contactName && lead.companyName ? ' · ' : ''}{lead.companyName}
          </span>
        )}
      </div>
      {/* Row 3: owner + follow-up + actions */}
      <div className="flex items-center gap-3 text-xs text-text-tertiary ml-6">
        {lead.owner && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">person</span>
            {lead.owner.firstName}
          </span>
        )}
        {lead.followUpDate && (
          <span style={{ color: followUpOverdue ? 'var(--color-danger)' : undefined, fontWeight: followUpOverdue ? 700 : 400 }}>
            {followUpOverdue ? '🔴 ' : isToday(lead.followUpDate) ? '⚡ ' : ''}
            {formatShortDate(lead.followUpDate)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onEdit(lead)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px' }}>
            <span className="material-symbols-outlined text-base text-text-secondary">edit</span>
          </button>
          {canDelete && (
            <button onClick={() => onDelete(lead)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px' }}>
              <span className="material-symbols-outlined text-base text-text-secondary">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Urgency dot inline ──────────────────────────────────────────
function getUrgencyBadgeInline(lead: CrmLead): { color: string; title: string } | null {
  if (lead.followUpDate) {
    if (isOverdue(lead.followUpDate) && !isToday(lead.followUpDate))
      return { color: 'var(--color-danger)', title: 'Overdue' };
    if (isToday(lead.followUpDate))
      return { color: 'var(--color-warning)', title: 'Due Today' };
  }
  if (isStale(lead.updatedAt) && lead.status !== 'CONVERTED' && lead.status !== 'LOST')
    return { color: 'var(--color-text-tertiary)', title: 'Stale' };
  return null;
}

// ── Main component ───────────────────────────────────────────────
const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  sortConfig,
  onSort,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onEdit,
  onDelete,
  onStatusChange,
  isAllSelected,
  user,
}) => {
  const canDelete = hasPermission(user, 'crm:delete');

  // Desktop table
  const desktopTable = (
    <div className="hidden lg:block w-full overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full" style={{ minWidth: 900 }}>
        <TableHeader sortConfig={sortConfig} onSort={onSort} isAllSelected={isAllSelected} onSelectAll={onSelectAll} onClearSelection={onClearSelection} leadCount={leads.length} />
        <tbody>
          {leads.map(lead => (
            <LeadRow
              key={lead.id}
              lead={lead}
              isSelected={selectedIds.has(lead.id)}
              onToggleSelect={onToggleSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              canDelete={canDelete}
            />
          ))}
        </tbody>
      </table>
      {leads.length === 0 && (
        <div className="py-12 text-center text-text-secondary text-sm">No leads found</div>
      )}
    </div>
  );

  // Mobile stacked list
  const mobileList = (
    <div className="lg:hidden space-y-3">
      {leads.map(lead => (
        <MobileLeadRow
          key={lead.id}
          lead={lead}
          isSelected={selectedIds.has(lead.id)}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          canDelete={canDelete}
        />
      ))}
    </div>
  );

  return (
    <>
      {desktopTable}
      {mobileList}
    </>
  );
};

export default LeadsTable;