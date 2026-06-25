/**
 * RatingBandAdmin — Phase 5 admin screen for configurable rating bands
 * and risk factor weights.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { ratingBandAdminApi, RatingBandConfig, RiskFactorMatrixConfig } from '../src/services/ratingBandAdmin.service';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../src/utils/errorMessages';

const RATING_OPTIONS = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D'];
const RISK_CATEGORIES = ['LOW', 'MODERATE', 'HIGH', 'PROHIBITED'];
const RISK_FACTORS = ['APPLICANT', 'INDUSTRY', 'PRODUCT', 'DOCUMENTATION', 'BEHAVIOUR', 'FRAUD'];

const RatingBandAdmin: React.FC = () => {
  const [bands, setBands] = useState<RatingBandConfig[]>([]);
  const [riskFactors, setRiskFactors] = useState<RiskFactorMatrixConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bands' | 'risk-factors'>('bands');

  const [newBand, setNewBand] = useState({ scoreMin: '', scoreMax: '', rating: 'AAA', riskCategory: 'LOW' });
  const [newFactor, setNewFactor] = useState({ factor: 'APPLICANT', weight: '25', threshold: '' });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [bandList, factorList] = await Promise.all([
        ratingBandAdminApi.listBands(),
        ratingBandAdminApi.listRiskFactors(),
      ]);
      setBands(bandList);
      setRiskFactors(factorList);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to load configuration'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSeedBands = async () => {
    try {
      await ratingBandAdminApi.seedDefaults();
      toast.success('Default bands seeded');
      fetchAll();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to seed bands'));
    }
  };

  const handleCreateBand = async () => {
    try {
      await ratingBandAdminApi.createBand({
        scoreMin: Number(newBand.scoreMin),
        scoreMax: Number(newBand.scoreMax),
        rating: newBand.rating,
        riskCategory: newBand.riskCategory,
      });
      toast.success('Band created');
      setNewBand({ scoreMin: '', scoreMax: '', rating: 'AAA', riskCategory: 'LOW' });
      fetchAll();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to create band'));
    }
  };

  const handleDeactivateBand = async (id: string) => {
    try {
      await ratingBandAdminApi.updateBand(id, { effectiveTo: new Date().toISOString() } as any);
      toast.success('Band deactivated');
      fetchAll();
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to deactivate band'));
    }
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
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Score-to-Rating Bands</h2>
              <button onClick={handleSeedBands} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Seed Defaults
              </button>
            </div>
            {bands.length === 0 ? (
              <p className="text-sm text-gray-400">No bands configured. Click "Seed Defaults" to create the standard 10 bands.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-200">
                    <th className="text-left py-2 px-2">Score Range</th>
                    <th className="text-left py-2 px-2">Rating</th>
                    <th className="text-left py-2 px-2">Risk Category</th>
                    <th className="text-left py-2 px-2">Effective</th>
                    <th className="text-right py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((band) => (
                    <tr key={band.id} className="border-b border-gray-100">
                      <td className="py-2 px-2 font-mono text-xs">{band.scoreMin}–{band.scoreMax}</td>
                      <td className="py-2 px-2"><span className="font-bold">{band.rating}</span></td>
                      <td className="py-2 px-2 text-xs">{band.riskCategory}</td>
                      <td className="py-2 px-2 text-xs text-gray-500">
                        {new Date(band.effectiveFrom).toLocaleDateString('en-MY')}
                        {band.effectiveTo && <span className="text-amber-600"> → {new Date(band.effectiveTo).toLocaleDateString('en-MY')}</span>}
                      </td>
                      <td className="py-2 px-2 text-right">
                        {!band.effectiveTo && (
                          <button onClick={() => handleDeactivateBand(band.id)} className="text-xs text-red-600 hover:underline">
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Create New Band</h3>
            <div className="grid grid-cols-4 gap-3">
              <input type="number" placeholder="Min Score" value={newBand.scoreMin} onChange={(e) => setNewBand({ ...newBand, scoreMin: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg" />
              <input type="number" placeholder="Max Score" value={newBand.scoreMax} onChange={(e) => setNewBand({ ...newBand, scoreMax: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg" />
              <select value={newBand.rating} onChange={(e) => setNewBand({ ...newBand, rating: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
                {RATING_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={newBand.riskCategory} onChange={(e) => setNewBand({ ...newBand, riskCategory: e.target.value })} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
                {RISK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={handleCreateBand} className="mt-3 px-4 py-2 text-sm font-semibold bg-brand-700 text-white rounded-lg hover:bg-brand-800">
              Create Band
            </button>
          </div>
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