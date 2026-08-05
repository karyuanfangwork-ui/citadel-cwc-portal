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
  getLeadDisplayId,
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

// ── Design tokens (Kinetic Enterprise) ────────────────────────────────
const T = {
  teal: '#006a61',
  tealLight: '#86f2e4',
  tealDark: '#006f66',
  surface: '#f8f9ff',
  surfaceLow: '#eff4ff',
  surfaceLowest: '#ffffff',
  onSurface: '#0b1c30',
  onSurfaceVar: '#45464d',
  outline: '#e2e8f0',
  outlineVar: '#c6c6cd',
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  danger: '#ba1a1a',
  dangerBg: '#ffdad6',
} as const;

// ── Sort indicator ──────────────────────────────────────────────
const SortIcon: React.FC<{ active: boolean; direction: SortDirection | null }> = ({ active, direction }) => (
  <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: active ? 1 : 0.3, marginLeft: 2 }}>
    {direction === 'asc' ? 'arrow_upward' : direction === 'desc' ? 'arrow_downward' : 'unfold_more'}
  </span>
);

// ── Label-caps style header cell ─────────────────────────────────────
const labelCaps: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  lineHeight: '16px',
  color: T.onSurfaceVar,
};

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
      style={{ ...labelCaps, padding: '10px 12px', cursor: 'pointer', userSelect: 'none', textAlign: 'left' }}
      className="hover:text-[#0b1c30] transition-colors"
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
    <thead style={{ background: T.surfaceLow, borderBottom: `1px solid ${T.outline}` }}>
      <tr>
        <th style={{ padding: '10px 12px', width: 40 }}>
          <input
            type="checkbox"
            checked={isAllSelected && leadCount > 0}
            onChange={() => isAllSelected ? onClearSelection() : onSelectAll()}
            style={{ accentColor: T.teal, width: 16, height: 16, cursor: 'pointer' }}
            title={isAllSelected ? 'Deselect all' : 'Select all on this page'}
          />
        </th>
        <th style={{ ...labelCaps, padding: '10px 12px' }}>Lead ID</th>
        {sortableCol('Lead Name', 'title')}
        {sortableCol('Status', 'status')}
        {sortableCol('Score', 'aiScore')}

        <th style={{ ...labelCaps, padding: '10px 12px', textAlign: 'left' }}>Contact</th>
        {sortableCol('Value', 'estimatedValue')}
        {sortableCol('Follow-up', 'followUpDate')}
        <th style={{ ...labelCaps, padding: '10px 12px' }} className="hidden xl:table-cell">Source</th>
        <th style={{ ...labelCaps, padding: '10px 12px', textAlign: 'left' }}>Owner</th>
        <th style={{ padding: '10px 12px', position: 'sticky', right: 0, background: T.surfaceLow, zIndex: 10, minWidth: 100 }} />
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
      ? { text: formatShortDate(lead.followUpDate), color: T.danger, bold: true }
      : isToday(lead.followUpDate)
      ? { text: 'Today', color: 'var(--color-warning)', bold: true }
      : { text: formatShortDate(lead.followUpDate), color: T.onSurfaceVar, bold: false }
    : null;

  // Source sub-label for lead name cell
  const sourceLabel = lead.source ? (SOURCE_LABELS[lead.source] || lead.source.replace(/_/g, ' ')) : null;

  // Avatar initials
  const initials = lead.title
    ? lead.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'L';

  return (
    <tr
      className={`group border-b transition-colors ${isSelected ? 'bg-[#e5eeff]' : ''}`}
      style={{ borderBottomColor: T.borderSubtle }}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = T.surface; }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = ''; }}
    >
      {/* Checkbox */}
      <td style={{ padding: '10px 12px', width: 40 }}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(lead.id)}
          style={{ accentColor: T.teal, width: 16, height: 16, cursor: 'pointer' }}
        />
      </td>

      {/* Lead ID — data-mono style, never wraps */}
      <td style={{ padding: '10px 12px', fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 500, color: T.onSurfaceVar, whiteSpace: 'nowrap', minWidth: 70 }}>
        {getLeadDisplayId(lead.id)}
      </td>

      {/* Lead Name — sticky with avatar + source */}
      <td
        style={{
          padding: '10px 12px',
          minWidth: 220,
          position: 'sticky',
          left: 0,
          zIndex: 10,
          background: isSelected ? '#e5eeff' : T.surfaceLowest,
          boxShadow: '1px 0 0 0 #c6c6cd',
        }}
        className="group-hover:!bg-[#f8f9ff]"
      >
        <div className="flex items-center gap-3">
          {/* Avatar circle */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: T.tealLight, color: T.tealDark }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <Link
              to={`/crm/leads/${lead.id}`}
              className="text-sm font-bold hover:underline transition-colors line-clamp-1"
              style={{ color: T.teal }}
              title={lead.title}
            >
              {lead.title}
            </Link>
            <div className="flex items-center gap-2">
              {sourceLabel && (
                <p className="text-[11px] opacity-70 line-clamp-1" style={{ color: T.onSurfaceVar }}>
                  {sourceLabel}
                </p>
              )}
              <span className="text-[11px]" style={{ color: T.onSurfaceVar, opacity: 0.5 }}>
                {formatShortDate(lead.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Status */}
      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
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

      {/* AI Score */}
      <td style={{ padding: '10px 12px' }}>
        {lead.aiScore != null ? (() => {
          const s = scoreStyle(lead.aiScore);
          const tip = lead.ruleScore != null ? `AI: ${lead.aiScore} · Rule: ${lead.ruleScore}` : `AI Score: ${lead.aiScore}`;
          return (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold cursor-default"
              style={{ background: s.bg, color: s.text }}
              title={tip}>
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              {lead.aiScore}
            </span>
          );
        })() : (
          <span className="text-xs" style={{ color: T.onSurfaceVar, opacity: 0.5 }}>—</span>
        )}
      </td>

      {/* Contact — compact */}
      <td style={{ padding: '10px 12px' }}>
        {lead.contactName ? (
          <div>
            <div className="text-sm line-clamp-1" style={{ color: T.onSurface }}>{lead.contactName}</div>
            {lead.companyName && (
              <div className="text-[11px] line-clamp-1" style={{ color: T.onSurfaceVar, opacity: 0.7 }}>{lead.companyName}</div>
            )}
          </div>
        ) : lead.companyName ? (
          <div className="text-sm line-clamp-1" style={{ color: T.onSurface }}>{lead.companyName}</div>
        ) : (
          <span className="text-sm" style={{ color: T.onSurfaceVar, opacity: 0.5 }}>—</span>
        )}
      </td>

      {/* Value */}
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
        <span className="text-sm font-bold" style={{ fontFamily: '"JetBrains Mono", monospace', color: T.teal }}>
          {formatCurrency(lead.estimatedValue)}
        </span>
      </td>

      {/* Follow-up */}
      <td style={{ padding: '10px 12px' }}>
        {followUpDisplay ? (
          <span className="text-sm" style={{ color: followUpDisplay.color, fontWeight: followUpDisplay.bold ? 700 : 400 }}>
            {followUpDisplay.text}
          </span>
        ) : (
          <span className="text-sm" style={{ color: T.onSurfaceVar, opacity: 0.5 }}>—</span>
        )}
      </td>

      {/* Source */}
      <td style={{ padding: '10px 12px' }} className="hidden xl:table-cell">
        {lead.source ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider"
            style={{
              background: lead.source === 'WEBSITE' ? '#dbeafe' : lead.source === 'REFERRAL' ? T.tealLight : '#f1f5f9',
              color: lead.source === 'WEBSITE' ? '#1d4ed8' : lead.source === 'REFERRAL' ? T.tealDark : T.onSurfaceVar,
            }}>
            {SOURCE_LABELS[lead.source] || lead.source.replace(/_/g, ' ')}
          </span>
        ) : (
          <span style={{ color: T.onSurfaceVar, opacity: 0.5 }}>—</span>
        )}
      </td>

      {/* Owner */}
      <td style={{ padding: '10px 12px' }}>
        {lead.owner ? (
          <div className="flex items-center gap-2">
            {lead.owner.avatarUrl ? (
              <img src={lead.owner.avatarUrl} alt={lead.owner.firstName} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ background: '#dce9ff', color: T.onSurfaceVar }}>
                {lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}
              </div>
            )}
            <span className="text-[13px]" style={{ color: T.onSurface }}>{lead.owner.firstName?.[0]}. {lead.owner.lastName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center border border-dashed flex-shrink-0" style={{ borderColor: T.outline }}>
              <span className="material-symbols-outlined text-[14px]" style={{ color: T.onSurfaceVar, opacity: 0.4 }}>person</span>
            </div>
            <span className="text-[13px] italic" style={{ color: T.onSurfaceVar, opacity: 0.5 }}>Unassigned</span>
          </div>
        )}
      </td>

      {/* Actions — hover-revealed */}
      <td
        style={{
          padding: '10px 12px',
          position: 'sticky',
          right: 0,
          zIndex: 10,
          background: isSelected ? '#e5eeff' : T.surfaceLowest,
          minWidth: 100,
          textAlign: 'right',
        }}
        className="group-hover:!bg-[#f8f9ff]"
      >
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={`/crm/leads/${lead.id}`}
            className="p-1.5 rounded transition-colors"
            style={{ color: T.onSurfaceVar }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.tealLight; (e.currentTarget as HTMLElement).style.color = T.tealDark; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.onSurfaceVar; }}
            title="View details"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
          </Link>
          <button
            onClick={e => { e.stopPropagation(); onEdit(lead); }}
            className="p-1.5 rounded transition-colors"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.onSurfaceVar }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.tealLight; (e.currentTarget as HTMLElement).style.color = T.tealDark; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.onSurfaceVar; }}
            title="Edit lead"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
          </button>
          {canDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(lead); }}
              className="p-1.5 rounded transition-colors"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.onSurfaceVar }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.dangerBg; (e.currentTarget as HTMLElement).style.color = T.danger; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.onSurfaceVar; }}
              title="Delete lead"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
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
  const initials = lead.title
    ? lead.title.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'L';

  return (
    <div
      className="bg-white border rounded-xl p-5 transition-all duration-200 cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderColor: isSelected ? T.teal : T.outline }}
    >
      {/* Row 1: checkbox + avatar + name + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(lead.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: T.teal }}
          />
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.text }}>
            <span className="material-symbols-outlined" style={{ fontSize: 11 }}>{st.icon}</span>
            {lead.status.replace(/_/g, ' ')}
          </span>
        </div>
        <span className="text-[11px] opacity-60" style={{ color: T.onSurfaceVar }}>{formatShortDate(lead.createdAt)}</span>
      </div>

      {/* Row 2: Avatar + Name + source */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: T.tealLight, color: T.tealDark }}>
          {initials}
        </div>
        <div className="min-w-0">
          <h3
            className="text-sm font-bold line-clamp-2 cursor-pointer hover:underline"
            style={{ color: T.onSurface }}
            onClick={() => window.location.href = `/crm/leads/${lead.id}`}
          >
            {lead.title}
          </h3>
          {lead.source && (
            <p className="text-[11px] opacity-70" style={{ color: T.onSurfaceVar }}>
              {SOURCE_LABELS[lead.source] || lead.source.replace(/_/g, ' ')}
            </p>
          )}
        </div>
      </div>

      {/* Contact + Value */}
      {(lead.contactName || lead.companyName) && (
        <div className="text-xs mb-1" style={{ color: T.onSurfaceVar, opacity: 0.7 }}>
          {lead.contactName && <span>{lead.contactName}</span>}
          {lead.contactName && lead.companyName && <span> · </span>}
          {lead.companyName && <span className="font-medium">{lead.companyName}</span>}
        </div>
      )}

      {lead.followUpDate && (
        <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: followUpOverdue ? T.danger : T.onSurfaceVar }}>
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>event</span>
          <span className={followUpOverdue ? 'font-bold' : ''}>{formatShortDate(lead.followUpDate)}</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${T.borderSubtle}` }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ fontFamily: '"JetBrains Mono", monospace', color: T.teal }}>{formatCurrency(lead.estimatedValue)}</span>
        </div>
        {lead.owner ? (
          <div className="flex items-center gap-1.5">
            {lead.owner.avatarUrl ? (
              <img src={lead.owner.avatarUrl} alt={lead.owner.firstName} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: T.teal }}>
                {lead.owner.firstName?.[0]}{lead.owner.lastName?.[0]}
              </div>
            )}
            <span className="text-[11px] opacity-70" style={{ color: T.onSurfaceVar }}>{lead.owner.firstName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full flex items-center justify-center border border-dashed" style={{ borderColor: T.outline }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12, color: T.onSurfaceVar, opacity: 0.4 }}>person</span>
            </div>
            <span className="text-[11px] italic opacity-50" style={{ color: T.onSurfaceVar }}>Unassigned</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Urgency dot inline ──────────────────────────────────────────
function getUrgencyBadgeInline(lead: CrmLead): { color: string; title: string } | null {
  if (lead.followUpDate) {
    if (isOverdue(lead.followUpDate) && !isToday(lead.followUpDate))
      return { color: T.danger, title: 'Overdue' };
    if (isToday(lead.followUpDate))
      return { color: 'var(--color-warning)', title: 'Due Today' };
  }
  if (isStale(lead.updatedAt) && lead.status !== 'CONVERTED' && lead.status !== 'LOST')
    return { color: T.onSurfaceVar, title: 'Stale' };
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
    <div className="hidden lg:block w-full overflow-x-auto rounded-xl border shadow-sm" style={{ borderColor: T.outline, background: T.surfaceLowest }}>
      <table className="w-full" style={{ minWidth: 800 }}>
        <TableHeader sortConfig={sortConfig} onSort={onSort} isAllSelected={isAllSelected} onSelectAll={onSelectAll} onClearSelection={onClearSelection} leadCount={leads.length} />
        <tbody className="divide-y" style={{ borderColor: T.borderSubtle }}>
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
        <div className="py-12 text-center text-sm" style={{ color: T.onSurfaceVar }}>No leads found</div>
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