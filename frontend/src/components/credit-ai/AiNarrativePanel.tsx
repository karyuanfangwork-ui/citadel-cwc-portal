import React, { useState } from 'react';
import { generateNarrative, type RiskNarrativeResult } from '../../services/creditAi.service';

interface Props {
  applicationId: string;
}

const AiNarrativePanel: React.FC<Props> = ({ applicationId }) => {
  const [result, setResult] = useState<RiskNarrativeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await generateNarrative(applicationId);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Narrative generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">A4 — Risk Narrative</h3>
        <button
          onClick={run}
          disabled={loading}
          className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap border rounded p-3 bg-gray-50">
            {result.narrative}
          </div>

          {result.keyRisks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1">Key Risks</p>
              <ul className="text-xs text-gray-700 list-disc list-inside">
                {result.keyRisks.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {result.keyStrengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">Key Strengths</p>
              <ul className="text-xs text-gray-700 list-disc list-inside">
                {result.keyStrengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          {result.citedFields.length > 0 && (
            <p className="text-[10px] text-gray-400">
              Cited fields: {result.citedFields.join(', ')}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
            <span>Model: {result.model}</span>
            <span>Cost: ${result.costUsd.toFixed(4)}</span>
            <span>ID: {result.interactionId.slice(0, 8)}…</span>
          </div>
        </div>
      )}

      {!result && !error && !loading && (
        <p className="text-xs text-gray-400 italic">Click "Generate" to create a risk narrative using AI</p>
      )}

      <p className="text-[10px] text-gray-400 mt-2 italic">
        AI proposes, humans dispose — review before including in credit memorandum
      </p>
    </div>
  );
};

export default AiNarrativePanel;