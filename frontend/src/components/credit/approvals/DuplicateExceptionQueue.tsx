import React, { useEffect, useState } from 'react';
import creditService from '@/src/services/credit.service';
import type { DuplicateExceptionQueueItem } from '@/src/types/credit-ui.types';
import DuplicateExceptionDecisionModal from './DuplicateExceptionDecisionModal';

const DuplicateExceptionQueue: React.FC = () => {
  const [items, setItems] = useState<DuplicateExceptionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DuplicateExceptionQueueItem | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await creditService.listPendingDuplicateExceptions();
      setItems(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <section aria-labelledby="duplicate-exception-heading" className="mb-8 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 id="duplicate-exception-heading" className="text-sm font-bold uppercase tracking-wider text-text-primary">Duplicate Exceptions</h2>
          <p className="mt-1 text-xs text-text-secondary">Review oldest requests first. Requesters cannot approve their own exception.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-md border border-border bg-bg-surface px-3 py-1.5 text-xs font-semibold">Refresh</button>
      </div>
      {loading ? <p className="text-sm text-text-secondary">Loading duplicate exceptions…</p> : items.length === 0 ? (
        <p className="text-sm text-text-secondary">No pending duplicate exceptions.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <article key={item.id} className="rounded-lg border border-border bg-bg-surface p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{item.matchedBorrower.name || 'Unnamed borrower'}</p>
                  <p className="text-xs text-text-secondary">{item.matchedBorrower.borrowerNumber || 'No borrower number'} · {item.matchedBorrower.maskedIdentifier || 'Identifier masked'}</p>
                  <p className="mt-1 text-xs text-text-secondary">Requested by {item.requester.name} · {item.category}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => window.open(`/credit/borrowers/${item.matchedBorrower.id}`, '_blank', 'noopener,noreferrer')} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold">Open borrower</button>
                  <button type="button" onClick={() => setSelected(item)} className="rounded-md bg-brand-700 px-2.5 py-1.5 text-xs font-semibold text-white">Review</button>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-text-secondary">{item.justification}</p>
              <p className="mt-2 text-[11px] text-text-tertiary">Expires {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : '—'} · Single-use approval</p>
            </article>
          ))}
        </div>
      )}
      {selected && <DuplicateExceptionDecisionModal exception={selected} onClose={() => setSelected(null)} onDecided={() => { setSelected(null); void load(); }} />}
    </section>
  );
};

export default DuplicateExceptionQueue;
