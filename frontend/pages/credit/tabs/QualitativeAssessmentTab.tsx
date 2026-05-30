import React, { useEffect, useState } from 'react';
import { qualitativeAssessmentApi } from '../../../src/services/credit.service';

interface Props {
  applicationId: string;
  readOnly?: boolean;
}

const FACTORS = [
  {
    key: 'managementScore' as const,
    label: 'Management Quality',
    anchors: ['No track record', 'Below average', 'Adequate experience', 'Above average', 'Experienced team, succession plan'],
  },
  {
    key: 'relationshipScore' as const,
    label: 'Relationship & History',
    anchors: ['New customer', 'Short history, issues', '1–2 years, minor issues', 'Good history', '5+ years, zero delinquency'],
  },
  {
    key: 'industryScore' as const,
    label: 'Industry Outlook',
    anchors: ['Declining, adverse regulation', 'Weak growth', 'Stable, moderate growth', 'Growing sector', 'High-growth, favourable regulation'],
  },
  {
    key: 'collateralScore' as const,
    label: 'Collateral Quality',
    anchors: ['No collateral', 'Weak/illiquid asset', 'Tangible, moderate liquidity', 'Good quality asset', 'Liquid, insured, professionally valued'],
  },
] as const;

const SLIDER_LABELS: Record<number, string> = { 1: 'Weak', 2: 'Below Average', 3: 'Neutral', 4: 'Good', 5: 'Strong' };
const SLIDER_COLORS: Record<number, string> = {
  1: 'text-red-500',
  2: 'text-orange-500',
  3: 'text-yellow-500',
  4: 'text-blue-500',
  5: 'text-green-600',
};

type Scores = {
  managementScore: number;
  relationshipScore: number;
  industryScore: number;
  collateralScore: number;
};

export default function QualitativeAssessmentTab({ applicationId, readOnly }: Props) {
  const [scores, setScores] = useState<Scores>({
    managementScore: 3,
    relationshipScore: 3,
    industryScore: 3,
    collateralScore: 3,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    qualitativeAssessmentApi.get(applicationId).then((qa) => {
      if (qa) setScores(qa);
      setLoading(false);
    });
  }, [applicationId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await qualitativeAssessmentApi.upsert(applicationId, scores);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="space-y-5 pt-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mt-0.5">
            Rate each factor 1–5. Unrated factors default to Neutral (3). Scores feed into the next scorecard run.
          </p>
        </div>
        {!readOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
        )}
      </div>

      <div className="grid gap-4">
        {FACTORS.map((factor) => {
          const val = scores[factor.key];
          return (
            <div key={factor.key} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{factor.label}</span>
                <span className={`text-sm font-semibold ${SLIDER_COLORS[val]}`}>
                  {val} — {SLIDER_LABELS[val]}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={val}
                disabled={readOnly}
                onChange={(e) =>
                  setScores((prev) => ({ ...prev, [factor.key]: Number(e.target.value) }))
                }
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between mt-1">
                {factor.anchors.map((anchor, i) => (
                  <span
                    key={i}
                    className={`text-[10px] text-center w-1/5 leading-tight px-0.5 ${
                      val === i + 1 ? 'text-blue-600 font-medium' : 'text-gray-400'
                    }`}
                  >
                    {anchor}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        Note: Re-run the scorecard after updating these ratings to see the updated risk score.
      </p>
    </div>
  );
}
