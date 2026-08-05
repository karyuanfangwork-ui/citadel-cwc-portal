import React, { useState } from 'react';
import { checkDuplicates, type DuplicateCheckResult, type DuplicateMatch } from '../../services/creditAi.service';

interface Props {
  applicationId: string;
}

const severityBadge = (confidence: number) => {
  if (confidence >= 0.8) return <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">High</span>;
  if (confidence >= 0.5) return <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Medium</span>;
  return <span className="inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Low</span>;
};

const AiDuplicateAlert: React.FC<Props> = ({ applicationId }) => {
  const [result, setResult] = useState<DuplicateCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await checkDuplicates(applicationId);
      setResult(res);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Duplicate check failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">A6 — Duplicate Detection</h3>
        <button
          onClick={run}
          disabled={loading}
          className="px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Run Check'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}

      {result && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">
            Checked at: {new Date(result.checkedAt).toLocaleString()} —{' '}
            {result.matches.length === 0 ? (
              <span className="text-green-700 font-medium">No duplicates found</span>
            ) : (
              <span className="text-red-700 font-medium">{result.matches.length} potential duplicate(s)</span>
            )}
          </p>

          {result.matches.map((m: DuplicateMatch, i: number) => (
            <div key={i} className="border rounded p-2 bg-gray-50 text-xs">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-800">{m.borrowerName}</span>
                {severityBadge(m.confidence)}
              </div>
              <p className="text-gray-600">Match fields: {m.matchFields.join(', ')}</p>
              <p className="text-gray-600">Confidence: {(m.confidence * 100).toFixed(0)}% · Existing apps: {m.existingApplicationCount}</p>
            </div>
          ))}
        </div>
      )}

      {!result && !error && !loading && (
        <p className="text-xs text-gray-400 italic">Click "Run Check" to detect duplicate borrowers</p>
      )}
    </div>
  );
};

export default AiDuplicateAlert;