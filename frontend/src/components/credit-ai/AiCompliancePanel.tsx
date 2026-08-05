import React, { useState } from 'react';
import { runComplianceCheck, type ComplianceCheckResult, type ComplianceConcern } from '../../services/creditAi.service';

interface Props {
  applicationId: string;
}

const severityStyle: Record<string, string> = {
  HIGH: 'border-l-4 border-l-red-500 bg-red-50',
  MEDIUM: 'border-l-4 border-l-amber-500 bg-amber-50',
  LOW: 'border-l-4 border-l-blue-500 bg-blue-50',
};

const AiCompliancePanel: React.FC<Props> = ({ applicationId }) => {
  const [result, setResult] = useState<ComplianceCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runComplianceCheck(applicationId);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Compliance check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">A13 — AI Compliance Check</h3>
        <button
          onClick={run}
          disabled={loading}
          className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Run Check'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {result && result.concerns.length === 0 && (
        <p className="text-xs text-green-700 font-medium">No compliance concerns detected</p>
      )}

      {result && result.concerns.map((c: ComplianceConcern, i: number) => (
        <div key={i} className={`rounded p-3 mb-2 text-xs ${severityStyle[c.severity] ?? 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-800">{c.field}</span>
            <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
              c.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
              c.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {c.severity}
            </span>
          </div>
          <p className="text-gray-700 mb-1">{c.issue}</p>
          <p className="text-gray-500 italic">{c.recommendation}</p>
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
        <p className="text-xs text-gray-400 italic">Click "Run Check" for AI compliance review</p>
      )}
    </div>
  );
};

export default AiCompliancePanel;