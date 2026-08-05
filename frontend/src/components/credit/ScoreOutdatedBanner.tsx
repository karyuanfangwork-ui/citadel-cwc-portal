import React, { useState, useEffect } from 'react';
import { scoreStatusApi, ScoreStatus } from '../../services/credit.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../utils/errorMessages';

interface ScoreOutdatedBannerProps {
  applicationId: string;
  className?: string;
}

const ScoreOutdatedBanner: React.FC<ScoreOutdatedBannerProps> = ({ applicationId, className = '' }) => {
  const [status, setStatus] = useState<ScoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescoring, setRescoring] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        setLoading(true);
        const result = await scoreStatusApi.getStatus(applicationId);
        if (mounted) setStatus(result);
      } catch {
        // Silently fail — banner is non-critical
      } finally {
        if (mounted) setLoading(false);
      }
    };
    check();
    return () => { mounted = false; };
  }, [applicationId]);

  if (loading || !status || !status.isOutdated) return null;

  const handleRescore = async () => {
    try {
      setRescoring(true);
      await scoreStatusApi.rescore(applicationId);
      // Re-fetch the real score status instead of optimistically clearing
      // the outdated flag — only hide the banner when the new run is confirmed
      // to be at least as fresh as the latest material input.
      const freshStatus = await scoreStatusApi.getStatus(applicationId);
      setStatus(freshStatus);
      if (!freshStatus.isOutdated) {
        toast.success('Score updated', `New rating: ${freshStatus.lastScoreRunAt ? 'rescored' : 'complete'}`);
      } else {
        toast.success('Rescore triggered', 'Score run created — refresh to see updated results.');
      }
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to trigger rescore'));
    } finally {
      setRescoring(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return 'never';
    return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-center gap-3 ${className}`}>
      <span className="material-symbols-outlined text-amber-600 text-xl">warning</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-800">
          Credit score may be outdated
        </p>
        <p className="text-xs text-amber-700">
          Financials were updated {formatTime(status.lastFinancialsUpdatedAt)}, but the last score run was {formatTime(status.lastScoreRunAt)}.
        </p>
      </div>
      <button
        onClick={handleRescore}
        disabled={rescoring}
        className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-sm">refresh</span>
        {rescoring ? 'Rescoring…' : 'Rescore Now'}
      </button>
    </div>
  );
};

export default ScoreOutdatedBanner;