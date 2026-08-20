import React from 'react';
import { Link } from 'react-router-dom';
import type { MyWorkItem } from '../../../services/credit.service';

interface RmLaneProps {
  items: MyWorkItem[];
  formatAmount: (value: number | null) => string;
}

const PRIORITY_RANK: Record<MyWorkItem['priority'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const NEEDS_YOU_STATES = new Set(['REFERRED_BACK', 'KYC_REJECTED', 'COMPLIANCE_HOLD']);
const HOLDER_GROUPS = [
  { label: 'With credit', states: ['SUBMITTED', 'KYC_REVIEW', 'KYC_APPROVED', 'UNDERWRITING', 'CREDIT_ASSESSMENT'] },
  { label: 'With customer', states: ['COMPLIANCE_HOLD', 'OFFER'] },
  { label: 'With committee', states: ['COMMITTEE_REVIEW'] },
];
const HOLDER_GROUP_STATES = new Set(HOLDER_GROUPS.flatMap(group => group.states));

const isNeedsYou = (item: MyWorkItem) =>
  item.slaStatus === 'OVERDUE' || item.slaStatus === 'WARNING' || NEEDS_YOU_STATES.has(item.state);

function slaLabel(item: MyWorkItem): string | null {
  if (item.slaStatus === 'OVERDUE') return 'Overdue';
  if (item.slaRemainingHours == null) return null;
  return `${item.slaRemainingHours}h left`;
}

const NeedsYouRow: React.FC<{ item: MyWorkItem; formatAmount: RmLaneProps['formatAmount'] }> = ({ item, formatAmount }) => (
  <li aria-label={`${item.applicationNo} ${item.borrowerName}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 20px', borderBottom: '1px solid var(--cr-outline-variant)' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 13, color: 'var(--cr-on-surface-variant)' }}>{item.applicationNo} · {item.borrowerName}</span>
      <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{formatAmount(item.requestedAmount)}</span>
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 14, fontWeight: 600 }}>{item.blocker}</span>
      {slaLabel(item) && <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{slaLabel(item)}</span>}
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Link to={item.nextAction.route} style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-secondary)', textDecoration: 'none' }}>{item.nextAction.label}</Link>
    </div>
  </li>
);

const RmLane: React.FC<RmLaneProps> = ({ items, formatAmount }) => {
  const drafts = items.filter(item => item.state === 'DRAFT');
  const rest = items.filter(item => item.state !== 'DRAFT');
  const needsYou = rest.filter(isNeedsYou).sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const inFlight = rest.filter(item => !isNeedsYou(item));
  const otherInFlight = inFlight.filter(item => !HOLDER_GROUP_STATES.has(item.state));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {drafts.length > 0 && (
        <section aria-label="Drafts" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '12px 20px', background: 'var(--cr-surface-container-low)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Resume draft</span>
          {drafts.map(item => <Link key={item.id} to={item.nextAction.route}>{item.applicationNo} · {item.borrowerName}</Link>)}
        </section>
      )}

      <section aria-labelledby="rm-needs-you-heading" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', overflow: 'hidden' }}>
        <h2 id="rm-needs-you-heading" style={{ fontSize: 14, fontWeight: 600, padding: '16px 20px', borderBottom: '1px solid var(--cr-outline-variant)' }}>Needs you{needsYou.length > 0 ? ` · ${needsYou.length}` : ''}</h2>
        {needsYou.length === 0 ? <p style={{ padding: 32, textAlign: 'center' }}>Nothing is waiting on you.</p> : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{needsYou.map(item => <NeedsYouRow key={item.id} item={item} formatAmount={formatAmount} />)}</ul>}
      </section>

      {inFlight.length > 0 && (
        <section aria-label="In flight" style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>In flight</h2>
          {HOLDER_GROUPS.map(group => {
            const groupItems = inFlight.filter(item => group.states.includes(item.state));
            if (groupItems.length === 0) return null;
            return <div key={group.label}><h3 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{group.label}</h3><ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{groupItems.map(item => <li key={item.id}><Link to={`/credit/applications/${item.id}`}>{item.applicationNo}</Link> <span>{item.borrowerName}</span> <span>{formatAmount(item.requestedAmount)}</span></li>)}</ul></div>;
          })}
          {otherInFlight.length > 0 && <div><h3 style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>Other in-flight work</h3><ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{otherInFlight.map(item => <li key={item.id}><Link to={`/credit/applications/${item.id}`}>{item.applicationNo}</Link> <span>{item.borrowerName}</span> <span>{formatAmount(item.requestedAmount)}</span></li>)}</ul></div>}
        </section>
      )}
    </div>
  );
};

export default RmLane;
