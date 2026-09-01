import React, { useEffect, useState } from 'react';
import creditService, { type ApplicationSnapshotSummary } from '../../services/credit.service';

const TYPE_LABELS: Record<string, string> = {
  COMMITTEE_SUBMISSION: 'Committee submission',
  FINAL_DECISION: 'Final decision',
};

const SnapshotHistoryPanel: React.FC<{ applicationId: string }> = ({ applicationId }) => {
  const [snapshots, setSnapshots] = useState<ApplicationSnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!applicationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const list = await creditService.getApplicationSnapshots(applicationId);
        if (!cancelled) setSnapshots(list);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? 'Failed to load snapshots');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applicationId]);

  if (loading) return <p className="text-sm text-slate-500">Loading context snapshots…</p>;
  if (error) return <p className="text-sm text-red-700">Context snapshots could not be loaded: {error}</p>;
  if (snapshots.length === 0) {
    return <p className="text-sm text-slate-600">No context snapshots were captured for this application. Snapshots are taken at committee submission and at the final decision.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-semibold">Captured</th>
            <th className="py-2 pr-4 font-semibold">Type</th>
            <th className="py-2 pr-4 font-semibold">Trigger</th>
            <th className="py-2 pr-4 font-semibold">By</th>
            <th className="py-2 font-semibold">Hash</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((snapshot) => (
            <tr key={snapshot.id} className="border-b border-slate-100">
              <td className="whitespace-nowrap py-2 pr-4">{new Date(snapshot.takenAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
              <td className="py-2 pr-4">{TYPE_LABELS[snapshot.snapshotType] ?? snapshot.snapshotType}</td>
              <td className="py-2 pr-4 font-mono text-xs">{snapshot.triggerAction}</td>
              <td className="py-2 pr-4">{snapshot.takenBy ? `${snapshot.takenBy.firstName} ${snapshot.takenBy.lastName}` : 'System'}</td>
              <td className="py-2 font-mono text-xs text-slate-500" title={snapshot.hash}>{snapshot.hash.slice(0, 12)}…</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SnapshotHistoryPanel;
