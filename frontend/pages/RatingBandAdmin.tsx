/**
 * RatingBandAdmin — Phase 5 admin screen for configurable rating bands
 * and risk factor weights.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { ratingBandAdminApi, RatingBandConfig, RatingBandSetConfig, RiskFactorMatrixConfig } from '../src/services/ratingBandAdmin.service';
import { useAuth } from '../src/context/AuthContext';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';

const RATING_OPTIONS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'];
const RISK_CATEGORIES = ['LOW', 'MODERATE', 'HIGH', 'PROHIBITED'];
const RISK_FACTORS = ['APPLICANT', 'INDUSTRY', 'PRODUCT', 'DOCUMENTATION', 'BEHAVIOUR', 'FRAUD'];

type DraftBand = { scoreMin: string; scoreMax: string; rating: string; riskCategory: string };

const RatingBandAdmin: React.FC = () => {
  const { user } = useAuth();
  const [bands, setBands] = useState<RatingBandConfig[]>([]);
  const [bandSets, setBandSets] = useState<RatingBandSetConfig[]>([]);
  const [riskFactors, setRiskFactors] = useState<RiskFactorMatrixConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bands' | 'risk-factors'>('bands');

  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [draftBands, setDraftBands] = useState<DraftBand[]>([]);
  const [activationReferences, setActivationReferences] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newFactor, setNewFactor] = useState({ factor: 'APPLICANT', weight: '25', threshold: '' });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [bandList, setList, factorList] = await Promise.all([
        ratingBandAdminApi.listBands(),
        ratingBandAdminApi.listBandSets(),
        ratingBandAdminApi.listRiskFactors(),
      ]);
      setBands(bandList);
      setBandSets(setList);
      setRiskFactors(factorList);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load configuration'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreateBandSet = async () => {
    try {
      setSaving(true);
      await ratingBandAdminApi.createDraftBandSet({
        name: newSetName.trim(),
        description: newSetDescription.trim() || undefined,
        reason: changeReason.trim(),
        bands: draftBands.map((band) => ({
          scoreMin: Number(band.scoreMin),
          scoreMax: Number(band.scoreMax),
          rating: band.rating,
          riskCategory: band.riskCategory,
        })),
      });
      toast.success('Inactive rating-band draft created. It does not affect scoring.');
      setNewSetName('');
      setNewSetDescription('');
      setChangeReason('');
      setDraftBands([]);
      await fetchAll();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to create rating-band draft'));
    } finally {
      setSaving(false);
    }
  };

  const transitionBandSet = async (
    operation: (id: string) => Promise<RatingBandSetConfig>,
    setId: string,
    message: string,
  ) => {
    try {
      setSaving(true);
      await operation(setId);
      toast.success(message);
      await fetchAll();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Rating-band set transition failed'));
    } finally {
      setSaving(false);
    }
  };

  const activateBandSet = async (set: RatingBandSetConfig) => {
    const reference = (activationReferences[set.id] ?? '').trim();
    if (reference.length < 5) {
      toast.error('Enter the credit-policy approval reference before activation.');
      return;
    }
    if (!window.confirm(`Activate rating-band set v${set.version}? This changes live credit scoring.`)) return;
    try {
      setSaving(true);
      await ratingBandAdminApi.activateBandSet(set.id, reference);
      toast.success('Rating-band set activated.');
      await fetchAll();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Rating-band activation failed'));
    } finally {
      setSaving(false);
    }
  };

  const addDraftBand = () => setDraftBands((current) => [...current, {
    scoreMin: '', scoreMax: '', rating: RATING_OPTIONS[Math.min(current.length, RATING_OPTIONS.length - 1)], riskCategory: 'LOW',
  }]);

  const updateDraftBand = (index: number, patch: Partial<DraftBand>) => {
    setDraftBands((current) => current.map((band, i) => i === index ? { ...band, ...patch } : band));
  };

  const handleUpsertFactor = async () => {
    try {
      await ratingBandAdminApi.upsertRiskFactor({
        factor: newFactor.factor,
        weight: Number(newFactor.weight),
        threshold: newFactor.threshold || undefined,
      });
      toast.success('Risk factor saved');
      setNewFactor({ factor: 'APPLICANT', weight: '25', threshold: '' });
      fetchAll();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to save risk factor'));
    }
  };

  if (loading) {
    return <div className="p-6"><div className="h-32 rounded-lg bg-gray-100 animate-pulse" /></div>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Credit Risk Configuration</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('bands')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${activeTab === 'bands' ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Rating Bands
          </button>
          <button
            onClick={() => setActiveTab('risk-factors')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg ${activeTab === 'risk-factors' ? 'bg-brand-700 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            Risk Factor Weights
          </button>
        </div>
      </div>

      {activeTab === 'bands' && (
        <div className="space-y-4">
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            Rating bands determine live scoring. Enter only a policy-owner-reviewed proposal; a draft remains inactive. Approval and activation require separate operators, and activation requires the policy decision reference.
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Create a complete draft set</h2>
              <p className="mt-1 text-xs text-gray-500">No canonical thresholds are prefilled. The server rejects gaps, overlaps, incomplete 0–100 coverage, and duplicate ratings.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input aria-label="Set name" value={newSetName} onChange={(event) => setNewSetName(event.target.value)} maxLength={200} placeholder="Versioned set name" className="rounded border border-gray-300 px-3 py-2 text-sm" />
              <input aria-label="Set description" value={newSetDescription} onChange={(event) => setNewSetDescription(event.target.value)} maxLength={2000} placeholder="Description (optional)" className="rounded border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-800">Score bands</h3>
              <button type="button" onClick={addDraftBand} className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 hover:bg-gray-200">Add band</button>
            </div>
            {draftBands.length === 0 ? <p className="text-sm text-gray-500">Add band rows to define the full range from 0 through 100.</p> : (
              <div className="space-y-2">
                {draftBands.map((band, index) => (
                  <div key={index} className="grid grid-cols-2 gap-2 rounded border border-gray-100 p-3 md:grid-cols-5">
                    <input aria-label={`Minimum score ${index + 1}`} type="number" min={0} max={100} value={band.scoreMin} onChange={(event) => updateDraftBand(index, { scoreMin: event.target.value })} placeholder="Minimum" className="rounded border border-gray-300 px-2 py-2 text-sm" />
                    <input aria-label={`Maximum score ${index + 1}`} type="number" min={0} max={100} value={band.scoreMax} onChange={(event) => updateDraftBand(index, { scoreMax: event.target.value })} placeholder="Maximum" className="rounded border border-gray-300 px-2 py-2 text-sm" />
                    <select aria-label={`Rating ${index + 1}`} value={band.rating} onChange={(event) => updateDraftBand(index, { rating: event.target.value })} className="rounded border border-gray-300 px-2 py-2 text-sm">
                      {RATING_OPTIONS.map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                    </select>
                    <select aria-label={`Risk category ${index + 1}`} value={band.riskCategory} onChange={(event) => updateDraftBand(index, { riskCategory: event.target.value })} className="rounded border border-gray-300 px-2 py-2 text-sm">
                      {RISK_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                    <button type="button" onClick={() => setDraftBands((current) => current.filter((_, i) => i !== index))} className="text-left text-sm text-red-700 hover:underline">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <label className="block text-sm font-medium text-gray-700">
              Change reason
              <textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={1000} rows={3} className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm" placeholder="Policy reason and review scope" />
            </label>
            <button
              type="button"
              disabled={saving || newSetName.trim().length === 0 || changeReason.trim().length < 5 || draftBands.length === 0 || draftBands.some((band) => !band.scoreMin || !band.scoreMax)}
              onClick={handleCreateBandSet}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >Create inactive draft</button>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
            <h2 className="font-semibold text-gray-900">Band-set lifecycle</h2>
            {bandSets.length === 0 ? <p className="text-sm text-gray-500">No governed rating-band sets exist yet. Existing standalone bands are listed separately below and are not assigned a human maker.</p> : (
              <div className="space-y-4">
                {bandSets.map((set) => {
                  const isMaker = user?.id === set.createdById;
                  const canSubmit = set.status === 'DRAFT' && isMaker;
                  const canApprove = set.status === 'SUBMITTED' && !isMaker && user?.id !== set.submittedById;
                  const canActivate = set.status === 'APPROVED' && !isMaker && user?.id !== set.submittedById && user?.id !== set.approvedById;
                  return (
                    <article key={set.id} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{set.name} v{set.version}</h3>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${set.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : set.status === 'DRAFT' ? 'bg-gray-100 text-gray-700' : 'bg-blue-100 text-blue-800'}`}>{set.status}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-600">{set.bands.length} bands · Maker {set.createdById} · {set.reason}</p>
                          {set.approvedById && <p className="mt-1 text-xs text-gray-500">Checker {set.approvedById}{set.policyApprovalReference ? ` · Policy reference ${set.policyApprovalReference}` : ''}</p>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canSubmit && <button disabled={saving} onClick={() => void transitionBandSet(ratingBandAdminApi.submitBandSet, set.id, 'Rating-band set submitted for independent review.')} className="rounded bg-indigo-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Submit</button>}
                          {canApprove && <button disabled={saving} onClick={() => void transitionBandSet(ratingBandAdminApi.approveBandSet, set.id, 'Rating-band set approved; activation remains separate.')} className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Approve</button>}
                        </div>
                      </div>
                      {canActivate && (
                        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                          <label className="min-w-64 flex-1 text-xs font-medium text-gray-700">
                            Credit-policy approval reference
                            <input value={activationReferences[set.id] ?? ''} onChange={(event) => setActivationReferences((current) => ({ ...current, [set.id]: event.target.value }))} maxLength={200} className="mt-1 block w-full rounded border border-gray-300 px-2 py-2 text-sm" placeholder="Approved policy decision reference" />
                          </label>
                          <button disabled={saving || (activationReferences[set.id] ?? '').trim().length < 5} onClick={() => void activateBandSet(set)} className="rounded bg-green-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Activate</button>
                        </div>
                      )}
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead><tr className="border-b border-gray-100 text-gray-500"><th className="py-2 pr-3">Score range</th><th className="py-2 pr-3">Rating</th><th className="py-2">Risk category</th></tr></thead>
                          <tbody>{set.bands.map((band) => <tr key={band.id} className="border-b border-gray-50"><td className="py-2 pr-3 font-mono">{band.scoreMin}–{band.scoreMax}</td><td className="py-2 pr-3 font-semibold">{band.rating}</td><td className="py-2">{band.riskCategory}</td></tr>)}</tbody>
                        </table>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-900">Legacy standalone bands</h2>
            {bands.filter((band) => !band.bandSetId).length === 0 ? <p className="text-sm text-gray-500">No standalone band rows.</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-gray-500"><th className="py-2 px-2">Score</th><th className="py-2 px-2">Rating</th><th className="py-2 px-2">Category</th><th className="py-2 px-2">State</th><th className="py-2 px-2">Set identity</th></tr></thead>
                <tbody>{bands.filter((band) => !band.bandSetId).map((band) => <tr key={band.id} className="border-b border-gray-100"><td className="py-2 px-2 font-mono">{band.scoreMin}–{band.scoreMax}</td><td className="py-2 px-2 font-semibold">{band.rating}</td><td className="py-2 px-2">{band.riskCategory}</td><td className="py-2 px-2">{band.status ?? 'UNKNOWN'}</td><td className="py-2 px-2">{band.name ?? 'Unattributed legacy row'} v{band.version}</td></tr>)}</tbody>
              </table></div>
            )}
          </section>
        </div>
      )}


      {activeTab === 'risk-factors' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Risk Factor Weights</h2>
            {riskFactors.length === 0 ? (
              <p className="text-sm text-gray-400">No risk factor weights configured. Defaults will be used.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2 px-2">Factor</th>
                    <th className="text-left py-2 px-2">Weight</th>
                    <th className="text-left py-2 px-2">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {riskFactors.map((rf) => (
                    <tr key={rf.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-medium">{rf.factor}</td>
                      <td className="py-2 px-2 font-mono">{Number(rf.weight)}%</td>
                      <td className="py-2 px-2 text-xs text-gray-500">{rf.threshold || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Configure Risk Factor</h3>
            <div className="grid grid-cols-3 gap-3">
              <select value={newFactor.factor} onChange={(e) => setNewFactor({ ...newFactor, factor: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
                {RISK_FACTORS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
              <input type="number" placeholder="Weight (%)" value={newFactor.weight} onChange={(e) => setNewFactor({ ...newFactor, weight: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg" />
              <input type="text" placeholder="Threshold (optional)" value={newFactor.threshold} onChange={(e) => setNewFactor({ ...newFactor, threshold: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <button onClick={handleUpsertFactor} className="mt-3 px-4 py-2 text-sm font-semibold bg-brand-700 text-white rounded-lg hover:bg-brand-800">
              Save Risk Factor
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RatingBandAdmin;