import React, { useState } from 'react';
import { detectExceptions, recordOverride, type AutoExceptionResult, type PolicyException } from '../../services/creditAi.service';

interface Props {
  applicationId: string;
}

const severityStyle: Record<string, string> = {
  HIGH: 'border-l-4 border-l-red-500 bg-red-50',
  MEDIUM: 'border-l-4 border-l-amber-500 bg-amber-50',
  LOW: 'border-l-4 border-l-blue-500 bg-blue-50',
};

const AiAutoExceptionPanel: React.FC<Props> = ({ applicationId }) => {
  const [result, setResult] = useState<AutoExceptionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideField, setOverrideField] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await detectExceptions(applicationId);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Exception detection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (exc: PolicyException) => {
    if (!overrideReason.trim()) return;
    setOverrideSubmitting(true);
    try {
      await recordOverride(applicationId, {
        feature: 'A15_EXCEPTION',
        fieldName: exc.policyRef,
        aiValue: exc.description,
        overriddenValue: 'ACKNOWLEDGED',
        reason: overrideReason,
      });
      setOverrideField(null);
      setOverrideReason('');
    } catch {
      // silent — override is best-effort logging
    } finally {
      setOverrideSubmitting(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">A15 — Auto-Exception Detection</h3>
        <button
          onClick={run}
          disabled={loading}
          className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Detecting…' : 'Detect'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {result && result.exceptions.length === 0 && (
        <p className="text-xs text-green-700 font-medium">No policy exceptions detected</p>
      )}

      {result && result.exceptions.map((exc: PolicyException, i: number) => (
        <div key={i} className={`rounded p-3 mb-2 text-xs ${severityStyle[exc.severity] ?? 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-800">{exc.policyRef}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
              exc.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
              exc.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {exc.severity}
            </span>
          </div>
          <p className="text-gray-700 mb-1">{exc.description}</p>
          <p className="text-gray-500 italic mb-2">{exc.recommendation}</p>

          {overrideField === exc.policyRef ? (
            <div className="flex gap-1 mt-1">
              <input
                type="text"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Override reason (required)"
                className="flex-1 border rounded px-2 py-1 text-xs"
                disabled={overrideSubmitting}
              />
              <button
                onClick={() => handleOverride(exc)}
                disabled={overrideSubmitting || !overrideReason.trim()}
                className="px-2 py-1 text-xs rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {overrideSubmitting ? '…' : 'Submit'}
              </button>
              <button
                onClick={() => { setOverrideField(null); setOverrideReason(''); }}
                className="px-2 py-1 text-xs rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOverrideField(exc.policyRef)}
              className="text-[10px] text-amber-700 hover:underline"
            >
              Record override
            </button>
          )}
        </div>
      ))}

      {result && (
        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
          <span>Model: {result.model}</span>
          <span>Cost: ${result.costUsd.toFixed(4)}</span>
          <span>ID: {result.interactionId.slice(0, 8)}…</span>
        </div>
      )}

      {!result && !error && !loading && (
        <p className="text-xs text-gray-400 italic">Click "Detect" to identify policy exceptions</p>
      )}

      <p className="text-[10px] text-gray-400 mt-2 italic">
        AI proposes — approval of exceptions requires human decision
      </p>
    </div>
  );
};

export default AiAutoExceptionPanel;