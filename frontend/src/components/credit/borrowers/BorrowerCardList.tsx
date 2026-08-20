import React from 'react';
import type { BorrowerListItem } from '@/src/types/credit-ui.types';
import { formatMyr } from '@/src/lib/credit/formatters';
import BorrowerDataQualityBadge from './BorrowerDataQualityBadge';
import BorrowerStatusBadge from './BorrowerStatusBadge';

export interface BorrowerCardListProps {
  profiles: BorrowerListItem[];
  canCreate?: boolean;
  canWrite?: boolean;
  onRowClick?: (id: string) => void;
  onActiveApplicationsClick?: (id: string) => void;
  onActionClick: (id: string, action: string) => void;
  onClearFilters?: () => void;
  /** Compatibility alias for existing direct-360 consumers. */
  onOpen360?: (id: string) => void;
}

const label = (value: string | null | undefined) => value ? value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase()) : '—';
const typeLabel = (profile: BorrowerListItem) => profile.segment ? label(profile.segment) : label(profile.legalType);
const menuItemStyle: React.CSSProperties = { display: 'block', width: '100%', padding: '9px 12px', border: 0, background: 'transparent', color: 'var(--cr-on-surface)', textAlign: 'left', cursor: 'pointer', font: 'inherit' };

const BorrowerCardList: React.FC<BorrowerCardListProps> = ({
  profiles,
  canCreate = false,
  canWrite = true,
  onRowClick,
  onActiveApplicationsClick,
  onActionClick,
  onClearFilters,
  onOpen360,
}) => {
  const [openDetailsId, setOpenDetailsId] = React.useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  const openBorrower = (id: string) => {
    if (onRowClick) onRowClick(id);
    else onOpen360?.(id);
  };

  if (profiles.length === 0) {
    return (
      <section aria-label="Borrower cards" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 44, color: 'var(--cr-on-surface-variant)' }}>person_search</span>
        <p style={{ margin: '12px 0 4px', fontWeight: 'var(--cr-fw-label)' }}>No borrowers found</p>
        <p style={{ margin: 0, color: 'var(--cr-on-surface-variant)' }}>Try changing your search or filters.</p>
        {onClearFilters && <button type="button" onClick={onClearFilters} style={{ marginTop: 12, minHeight: 40, padding: '9px 12px', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: 'var(--cr-surface-container-lowest)', color: 'var(--cr-primary)', cursor: 'pointer', fontWeight: 'var(--cr-fw-label)' }}>Clear search and filters</button>}
      </section>
    );
  }

  return (
    <section aria-label="Borrower cards" style={{ display: 'grid', gap: 12, padding: 12 }}>
      {profiles.map((profile) => {
        const detailsOpen = openDetailsId === profile.id;
        const menuOpen = openMenuId === profile.id;
        const title = profile.name || 'Unnamed borrower';
        const detailsId = `borrower-details-${profile.id}`;
        const menuId = `borrower-actions-${profile.id}`;

        return (
          <article key={profile.id} style={{ minWidth: 0, padding: 16, border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg)', background: 'var(--cr-surface-container-lowest)', boxShadow: 'var(--cr-shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <button type="button" aria-label={`Open ${title} in Borrower 360`} onClick={() => openBorrower(profile.id)} style={{ maxWidth: '100%', padding: 0, border: 0, background: 'transparent', color: 'var(--cr-primary)', cursor: 'pointer', font: 'inherit', fontWeight: 'var(--cr-fw-label)', fontSize: 'var(--cr-text-body-lg)', textAlign: 'left', overflowWrap: 'anywhere' }}>{title}</button>
                <div style={{ marginTop: 4, color: 'var(--cr-on-surface-variant)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 'var(--cr-text-body-sm)' }}>{profile.borrowerNumber || '—'}</div>
              </div>
              <div style={{ position: 'relative', flex: '0 0 auto' }}>
                <button type="button" aria-label={`Actions for ${title}`} aria-expanded={menuOpen} aria-controls={menuOpen ? menuId : undefined} onClick={() => setOpenMenuId(menuOpen ? null : profile.id)} style={{ display: 'inline-grid', width: 36, height: 36, placeItems: 'center', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: 'var(--cr-surface-container-lowest)', color: 'var(--cr-on-surface)', cursor: 'pointer' }}><span className="material-symbols-outlined" aria-hidden="true">more_vert</span></button>
                {menuOpen && <div id={menuId} role="menu" style={{ position: 'absolute', right: 0, top: 40, zIndex: 2, minWidth: 170, overflow: 'hidden', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius)', background: 'var(--cr-surface-container-lowest)', boxShadow: 'var(--cr-shadow-card)' }}>
                  <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(profile.id, 'view'); }} style={menuItemStyle}>Open 360 View</button>
                  {canCreate && <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(profile.id, 'newApp'); }} style={menuItemStyle}>New Application</button>}
                  {canWrite && <button role="menuitem" type="button" onClick={() => { setOpenMenuId(null); onActionClick(profile.id, 'edit'); }} style={menuItemStyle}>Edit Borrower</button>}
                </div>}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              <span style={{ padding: '4px 8px', borderRadius: 999, background: 'var(--cr-surface-container-low)', color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)', fontWeight: 'var(--cr-fw-label)' }}>{typeLabel(profile)}</span>
              <BorrowerStatusBadge status={profile.status} />
              <BorrowerDataQualityBadge dataQuality={profile.dataQuality} missingFields={profile.missingFields} />
            </div>

            <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 16px', margin: '16px 0 0' }}>
              <div><dt style={{ color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)' }}>Active applications</dt><dd style={{ margin: '4px 0 0' }}><button type="button" onClick={() => onActiveApplicationsClick?.(profile.id)} style={{ padding: 0, border: 0, background: 'transparent', color: 'var(--cr-primary)', cursor: onActiveApplicationsClick ? 'pointer' : 'default', font: 'inherit', fontWeight: 'var(--cr-fw-label)' }}>{profile.activeApplicationCount.toLocaleString()} active applications</button></dd></div>
              <div><dt style={{ color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)' }}>Total exposure</dt><dd style={{ margin: '4px 0 0', fontWeight: 'var(--cr-fw-label)', fontVariantNumeric: 'tabular-nums' }}>{formatMyr(profile.totalExposure)}</dd></div>
              <div><dt style={{ color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)' }}>Last updated</dt><dd style={{ margin: '4px 0 0' }}>{new Date(profile.updatedAt).toLocaleDateString('en-GB')}</dd></div>
            </dl>

            <button type="button" aria-expanded={detailsOpen} aria-controls={detailsOpen ? detailsId : undefined} onClick={() => setOpenDetailsId(detailsOpen ? null : profile.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 16, padding: 0, border: 0, background: 'transparent', color: 'var(--cr-primary)', cursor: 'pointer', font: 'inherit', fontWeight: 'var(--cr-fw-label)' }}><span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 18 }}>{detailsOpen ? 'expand_less' : 'expand_more'}</span>{detailsOpen ? 'Hide borrower details' : 'Show borrower details'}</button>
            {detailsOpen && <dl id={detailsId} style={{ display: 'grid', gap: 10, margin: '14px 0 0', paddingTop: 14, borderTop: '1px solid var(--cr-outline-variant)' }}>
              <div><dt style={{ color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)' }}>NRIC / Registration No.</dt><dd style={{ margin: '3px 0 0', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{profile.maskedIdentifier || '—'}</dd></div>
              <div><dt style={{ color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)' }}>Contact</dt><dd style={{ margin: '3px 0 0' }}>{profile.primaryContact || '—'}</dd></div>
              <div><dt style={{ color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)' }}>Relationship owner</dt><dd style={{ margin: '3px 0 0' }}>{profile.relationshipOwner?.name || 'Unassigned'}</dd></div>
            </dl>}
          </article>
        );
      })}
    </section>
  );
};

export default BorrowerCardList;
