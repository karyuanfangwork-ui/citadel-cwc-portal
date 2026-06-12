/**
 * P2-4: Score Outdated Banner
 *
 * Shows a warning banner when financials have been updated more recently
 * than the last score run, indicating the risk score may be stale.
 *
 * Provides a "Rescore" button to trigger a new score run.
 */

import React, { useState, useEffect } from 'react';
import { scoreStatusApi, ScoreStatus } from '../../services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';

interface ScoreOutdatedBannerProps {
  applicationId: string;
  className?: string;
}

const ScoreOutdatedBanner: React.FC<ScoreOutdatedBannerProps> = ({ applicationId, className }) => {
  const [scoreStatus, setScoreStatus] = useState<ScoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    scoreStatusApi.getStatus(applicationId)
      .then(data => {
        if (!cancelled) setScoreStatus(data);
      })
      .catch(() => {
        // Non-critical — banner just won't show
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [applicationId]);

  const handleRescore = async () => {
    setRescoring(true);
    try {
      await scoreStatusApi.rescore(applicationId);
      toast.success('Rescore initiated — score will update shortly');
      setScoreStatus(prev => prev ? { ...prev, isOutdated: false } : prev);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to initiate rescore'));
    } finally {
      setRescoring(false);
    }
  };

  // Don't render if still loading, if status check failed, or if score is current
  if (loading || !scoreStatus || !scoreStatus.isOutdated) return null;

  const formatDate = (d: string | null) => {
    if (!d) return 'never';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-3 ${className || ''}`}>
      <span className="material-icons text-amber-600 mt-0.5 shrink-0">warning</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-amber-800">
          Risk score may be outdated
        </div>
        <div className="text-xs text-amber-700 mt-0.5">
          Financial data was updated {formatDate(scoreStatus.lastFinancialsUpdatedAt)},
          but the last score run was {formatDate(scoreStatus.lastScoreRunAt)}.
        </div>
      </div>
      <button
        onClick={handleRescore}
        disabled={rescoring}
        className="shrink-0 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        <span className="material-icons text-sm">refresh</span>
        {rescoring ? 'Rescoring…' : 'Rescore now'}
      </button>
    </div>
  );
};

export default ScoreOutdatedBanner;