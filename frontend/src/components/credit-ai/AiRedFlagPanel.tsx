import React, { useState } from 'react';
import { generateRedFlags, type RedFlagResult, type RedFlag } from '../../services/creditAi.service';

interface Props {
  applicationId: string;
}

const severityStyle: Record<string, string> = {
  HIGH: 'border-l-4 border-l-red-500 bg-red-50',
  MEDIUM: 'border-l-4 border-l-amber-500 bg-amber-50',
  LOW: 'border-l-4 border-l-blue-500 bg-blue-50',
};

const severityLabel: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800',
  MEDIUM: 'bg-amber-100 text-amber-800',
  LOW: 'bg-blue-100 text-blue-800',
};

const AiRedFlagPanel: React.FC<Props> = ({ applicationId }) => {
  const [result, setResult] = useState<RedFlagResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateRedFlags(applicationId);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Red flag check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">A5 — Red Flag Detection</h3>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
              result.overallRisk === 'HIGH' ? 'bg-red-100 text-red-800' :
              result.overallRisk === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
              'bg-green-100 text-green-800'
            }`}>
              Overall: {result.overallRisk}
            </span>
          )}
          <button
            onClick={run}
            disabled={loading}
            className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {result && result.flags.length === 0 && (
        <p className="text-xs text-green-700 font-medium">No red flags detected</p>
      )}

      {result && result.flags.map((f: RedFlag, i: number) => (
        <div key={i} className={`rounded p-3 mb-2 text-xs ${severityStyle[f.severity] ?? 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-800">{f.title}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${severityLabel[f.severity] ?? ''}`}>
              {f.severity}
            </span>
          </div>
          <p className="text-gray-700 mb-1">{f.evidence}</p>
          <p className="text-gray-500 italic">{f.rationale}</p>
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
        <p className="text-xs text-gray-400 italic">Click "Analyze" to detect red flags using AI</p>
      )}
    </div>
  );
};

export default AiRedFlagPanel;