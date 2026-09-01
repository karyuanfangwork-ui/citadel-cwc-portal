import React from 'react';
import type { ApplicationSnapshotSummary } from '../../services/credit.service';
import type { SnapshotViewMode } from './applicationSnapshotView';

interface SnapshotBannerProps {
  mode: SnapshotViewMode;
  effectiveMode: SnapshotViewMode;
  snapshot: ApplicationSnapshotSummary | null;
  error: string | null;
  viewingLive: boolean;
  onToggleLive: (value: boolean) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SnapshotBanner: React.FC<SnapshotBannerProps> = ({
  mode, effectiveMode, snapshot, error, viewingLive, onToggleLive,
}) => {
  if (mode === 'live') return null;

  if (mode === 'decided-without-snapshot') {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <span className="material-symbols-outlined text-[18px] leading-5 text-slate-500">info</span>
        <p className="m-0">
          {error
            ? 'The frozen decision context could not be loaded. Showing current master data, which may differ from what was decided on.'
            : 'This application was decided before context snapshots were introduced. Showing current master data, which may differ from what was decided on.'}
        </p>
      </div>
    );
  }

  if (effectiveMode === 'live' || viewingLive) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <span className="material-symbols-outlined text-[18px] leading-5 text-amber-600">warning</span>
        <p className="m-0 flex-1">Showing <strong>current master data</strong>, which may differ from what was decided on.</p>
        <button type="button" onClick={() => onToggleLive(false)} className="shrink-0 rounded border border-amber-400 bg-white px-2 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
          Show decision context
        </button>
      </div>
    );
  }

  const takenBy = snapshot?.takenBy ? `${snapshot.takenBy.firstName} ${snapshot.takenBy.lastName}` : 'the system';
  return (
    <div className="flex items-start gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
      <span className="material-symbols-outlined text-[18px] leading-5 text-blue-600">history_toggle_off</span>
      <p className="m-0 flex-1">
        Showing the borrower and financial context <strong>frozen at the decision</strong> on{' '}
        {snapshot ? formatDate(snapshot.takenAt) : 'the decision date'}, captured by {takenBy}.
      </p>
      <button type="button" onClick={() => onToggleLive(true)} className="shrink-0 rounded border border-blue-400 bg-white px-2 py-0.5 text-xs font-semibold text-blue-900 hover:bg-blue-100">
        Show current data
      </button>
    </div>
  );
};

export default SnapshotBanner;
