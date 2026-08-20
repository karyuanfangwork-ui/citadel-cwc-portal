import React from 'react';
import type { BorrowerNextAction } from './borrowerReadiness';

const ORDER: Record<BorrowerNextAction['severity'], number> = { BLOCKER: 0, WARNING: 1, INFO: 2, DONE: 3 };

export const BorrowerNextActions: React.FC<{ actions: BorrowerNextAction[]; onAction: (action: BorrowerNextAction) => void }> = ({ actions, onAction }) => {
  const ordered = [...actions].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <section aria-labelledby="borrower-next-actions-heading" className="rounded-fc border border-fc-outline bg-fc-surface p-4">
      <h2 id="borrower-next-actions-heading" className="mb-3 text-label-md font-bold uppercase tracking-wide text-fc-on-variant">Next actions</h2>
      {ordered.length === 0 ? <p className="text-sm text-fc-on-variant">No outstanding actions.</p> : (
        <ul className="space-y-3">
          {ordered.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 border-b border-fc-outline pb-3 last:border-0 last:pb-0">
            <div><p className="text-sm font-semibold text-fc-primary">{item.title}</p><p className="text-xs text-fc-on-variant">{item.description}</p></div>
            <button type="button" onClick={() => onAction(item)} className="shrink-0 text-xs font-bold text-fc-primary underline">{item.actionLabel}</button>
          </li>)}
        </ul>
      )}
    </section>
  );
};
export default BorrowerNextActions;
