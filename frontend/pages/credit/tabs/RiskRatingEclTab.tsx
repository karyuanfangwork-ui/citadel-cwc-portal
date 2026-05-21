import React, { useCallback, useEffect, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditScoreRun,
  ExternalRating,
  EclSnapshot,
  EclForecast,
  RatingAgency,
  MfrsStage,
  RiskRating,
} from '../../../src/services/credit.service';
import { useAuth } from '../../../src/context/AuthContext';
import { hasPermission } from '../../../src/utils/permissions';
import { useToast } from '../../../src/context/ToastContext';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENCIES: RatingAgency[] = ['RAM', 'MARC', 'SP', 'MOODYS', 'FITCH'];
const AGENCY_LABELS: Record<RatingAgency, string> = { RAM: 'RAM', MARC: 'MARC', SP: 'S&P', MOODYS: "Moody's", FITCH: 'Fitch' };
const SUBJECT_TYPES = ['CUSTOMER', 'CORPORATE_GUARANTOR'];
const MFRS_STAGES: MfrsStage[] = ['STAGE_1', 'STAGE_2', 'STAGE_3'];
const MFRS_LABELS: Record<MfrsStage, string> = { STAGE_1: 'Stage 1', STAGE_2: 'Stage 2', STAGE_3: 'Stage 3' };
const OUTLOOKS = ['Stable', 'Positive', 'Negative', 'Watch Negative', 'Watch Positive'];

const RISK_RATINGS: RiskRating[] = ['AAA', 'AA', 'A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'C', 'D', 'NR'];

const getRatingColor = (rating: string | null): string => {
  const map: Record<string, string> = {
    AAA: 'bg-emerald-100 text-emerald-700', AA: 'bg-emerald-50 text-emerald-600', A: 'bg-green-50 text-green-600',
    BBB: 'bg-yellow-50 text-yellow-700', BB: 'bg-orange-50 text-orange-600', B: 'bg-orange-100 text-orange-700',
    CCC: 'bg-red-50 text-red-600', CC: 'bg-red-100 text-red-700', C: 'bg-red-200 text-red-800', D: 'bg-red-300 text-red-900', NR: 'bg-gray-100 text-gray-500'
  };
  return map[rating || 'NR'] || 'bg-gray-100 text-gray-500';
};

const getRatingTextColor = (rating: string | null): string => {
  const map: Record<string, string> = {
    AAA: 'text-emerald-700', AA: 'text-emerald-600', A: 'text-green-600',
    BBB: 'text-yellow-700', BB: 'text-orange-600', B: 'text-orange-700',
    CCC: 'text-red-600', CC: 'text-red-700', C: 'text-red-800', D: 'text-red-900', NR: 'text-gray-500'
  };
  return map[rating || 'NR'] || 'text-gray-500';
};

const pct = (v: number | string | null | undefined) =>
  v != null && v !== '' ? `${(Number(v) * 100).toFixed(4)}%` : '—';
const fmt = (v: number | string | null | undefined) =>
  v != null && v !== '' ? Number(v).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

type Props = { application: CreditApplication };

// ─── External Ratings section ─────────────────────────────────────────────────

const ExternalRatingsSection: React.FC<{ appId: string; readOnly: boolean }> = ({ appId, readOnly }) => {
  const [ratings, setRatings] = useState<ExternalRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<ExternalRating>>({ agency: 'RAM', subjectType: 'CUSTOMER', rating: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ExternalRating>>({});

  useEffect(() => {
    creditService.listExternalRatings(appId).then(setRatings).finally(() => setLoading(false));
  }, [appId]);

  const handleAdd = async () => {
    if (!form.rating) return;
    setSaving(true);
    try {
      const r = await creditService.createExternalRating(appId, form);
      setRatings(rs => [...rs, r]);
      setAdding(false);
      setForm({ agency: 'RAM', subjectType: 'CUSTOMER', rating: '' });
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async (id: string) => {
    const r = await creditService.updateExternalRating(appId, id, editForm);
    setRatings(rs => rs.map(x => x.id === id ? { ...x, ...r } : x));
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this rating?')) return;
    await creditService.deleteExternalRating(appId, id);
    setRatings(rs => rs.filter(x => x.id !== id));
  };

  if (loading) return <div className="text-xs text-gray-400">Loading…</div>;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">External Ratings</h3>
        {!readOnly && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs border border-blue-300 text-blue-600 px-3 py-1 rounded hover:bg-blue-50">+ Add Rating</button>
        )}
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {['Subject', 'Name', 'Agency', 'Rating', 'Date', 'Outlook', 'FY', ''].map(h => (
                <th key={h} className="p-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ratings.map(r => editingId === r.id ? (
              <tr key={r.id} className="bg-blue-50">
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={editForm.subjectType ?? r.subjectType} onChange={e => setEditForm(f => ({ ...f, subjectType: e.target.value }))}>{SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                <td className="p-1"><input className="border rounded px-1 py-0.5 text-xs w-24" value={editForm.subjectName ?? r.subjectName ?? ''} onChange={e => setEditForm(f => ({ ...f, subjectName: e.target.value }))} /></td>
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={editForm.agency ?? r.agency} onChange={e => setEditForm(f => ({ ...f, agency: e.target.value as RatingAgency }))}>{AGENCIES.map(a => <option key={a} value={a}>{AGENCY_LABELS[a]}</option>)}</select></td>
                <td className="p-1"><input className="border rounded px-1 py-0.5 text-xs w-16" value={editForm.rating ?? r.rating} onChange={e => setEditForm(f => ({ ...f, rating: e.target.value }))} /></td>
                <td className="p-1"><input type="date" className="border rounded px-1 py-0.5 text-xs" value={(editForm.ratingDate ?? r.ratingDate ?? '').slice(0, 10)} onChange={e => setEditForm(f => ({ ...f, ratingDate: e.target.value }))} /></td>
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={editForm.outlook ?? r.outlook ?? ''} onChange={e => setEditForm(f => ({ ...f, outlook: e.target.value }))}><option value="">—</option>{OUTLOOKS.map(o => <option key={o} value={o}>{o}</option>)}</select></td>
                <td className="p-1"><input type="number" className="border rounded px-1 py-0.5 text-xs w-16" value={editForm.fiscalYear ?? r.fiscalYear ?? ''} onChange={e => setEditForm(f => ({ ...f, fiscalYear: e.target.value ? Number(e.target.value) : undefined }))} /></td>
                <td className="p-1 space-x-1">
                  <button onClick={() => handleSaveEdit(r.id)} className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-xs border px-2 py-0.5 rounded">×</button>
                </td>
              </tr>
            ) : (
              <tr key={r.id} className="border-t hover:bg-gray-50">
                <td className="p-2 text-xs">{r.subjectType.replace('_', ' ')}</td>
                <td className="p-2 text-xs">{r.subjectName ?? '—'}</td>
                <td className="p-2 text-xs font-medium">{AGENCY_LABELS[r.agency]}</td>
                <td className="p-2 text-xs font-bold">{r.rating}</td>
                <td className="p-2 text-xs">{r.ratingDate ? r.ratingDate.slice(0, 10) : '—'}</td>
                <td className="p-2 text-xs">{r.outlook ?? '—'}</td>
                <td className="p-2 text-xs">{r.fiscalYear ?? '—'}</td>
                <td className="p-2 text-xs space-x-1">
                  {!readOnly && <>
                    <button onClick={() => { setEditingId(r.id); setEditForm({}); }} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:underline">Del</button>
                  </>}
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="bg-green-50">
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={form.subjectType} onChange={e => setForm(f => ({ ...f, subjectType: e.target.value }))}>{SUBJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></td>
                <td className="p-1"><input className="border rounded px-1 py-0.5 text-xs w-24" placeholder="Name" value={form.subjectName ?? ''} onChange={e => setForm(f => ({ ...f, subjectName: e.target.value }))} /></td>
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={form.agency} onChange={e => setForm(f => ({ ...f, agency: e.target.value as RatingAgency }))}>{AGENCIES.map(a => <option key={a} value={a}>{AGENCY_LABELS[a]}</option>)}</select></td>
                <td className="p-1"><input className="border rounded px-1 py-0.5 text-xs w-16" placeholder="AA" value={form.rating ?? ''} onChange={e => setForm(f => ({ ...f, rating: e.target.value }))} /></td>
                <td className="p-1"><input type="date" className="border rounded px-1 py-0.5 text-xs" value={form.ratingDate ?? ''} onChange={e => setForm(f => ({ ...f, ratingDate: e.target.value }))} /></td>
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={form.outlook ?? ''} onChange={e => setForm(f => ({ ...f, outlook: e.target.value }))}><option value="">—</option>{OUTLOOKS.map(o => <option key={o} value={o}>{o}</option>)}</select></td>
                <td className="p-1"><input type="number" className="border rounded px-1 py-0.5 text-xs w-16" placeholder="FY" value={form.fiscalYear ?? ''} onChange={e => setForm(f => ({ ...f, fiscalYear: e.target.value ? Number(e.target.value) : undefined }))} /></td>
                <td className="p-1 space-x-1">
                  <button onClick={handleAdd} disabled={saving} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">{saving ? '…' : 'Add'}</button>
                  <button onClick={() => setAdding(false)} className="text-xs border px-2 py-0.5 rounded">×</button>
                </td>
              </tr>
            )}
            {ratings.length === 0 && !adding && (
              <tr><td colSpan={8} className="p-4 text-center text-gray-400 text-xs">No external ratings added.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ─── ECL Snapshots section ────────────────────────────────────────────────────

const EclSnapshotsSection: React.FC<{ appId: string; readOnly: boolean }> = ({ appId, readOnly }) => {
  const [snapshots, setSnapshots] = useState<EclSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Partial<EclSnapshot>>({ subjectType: 'CUSTOMER', snapshotDate: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    creditService.listEclSnapshots(appId).then(setSnapshots).finally(() => setLoading(false));
  }, [appId]);

  const handleAdd = async () => {
    if (!form.snapshotDate) return;
    setSaving(true);
    try {
      const s = await creditService.createEclSnapshot(appId, form);
      setSnapshots(ss => [...ss, s]);
      setAdding(false);
      setForm({ subjectType: 'CUSTOMER', snapshotDate: new Date().toISOString().slice(0, 10) });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this ECL snapshot?')) return;
    await creditService.deleteEclSnapshot(appId, id);
    setSnapshots(ss => ss.filter(x => x.id !== id));
  };

  if (loading) return <div className="text-xs text-gray-400">Loading…</div>;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">ECL Snapshots</h3>
        {!readOnly && !adding && (
          <button onClick={() => setAdding(true)} className="text-xs border border-blue-300 text-blue-600 px-3 py-1 rounded hover:bg-blue-50">+ Add Snapshot</button>
        )}
      </div>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {['Subject', 'Date', 'MIA', 'Stage', 'O/S (RM)', 'PD%', 'LGD%', 'Loss Rate%', 'ECL (RM)', 'Writeback', ''].map(h => (
                <th key={h} className="p-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {snapshots.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="p-2 text-xs">{s.subjectName ?? s.subjectType.replace('_', ' ')}</td>
                <td className="p-2 text-xs">{s.snapshotDate.slice(0, 10)}</td>
                <td className="p-2 text-xs">{s.miaCount ?? '—'}</td>
                <td className="p-2 text-xs">{s.mfrsStage ? MFRS_LABELS[s.mfrsStage] : '—'}</td>
                <td className="p-2 text-xs text-right">{fmt(s.totalOutstanding)}</td>
                <td className="p-2 text-xs text-right">{pct(s.pdPct)}</td>
                <td className="p-2 text-xs text-right">{pct(s.lgdPct)}</td>
                <td className="p-2 text-xs text-right">{pct(s.lossRatePct)}</td>
                <td className="p-2 text-xs text-right font-medium">{fmt(s.eclAmount)}</td>
                <td className="p-2 text-xs text-right">{fmt(s.potentialEclWriteback)}</td>
                <td className="p-2 text-xs">
                  {!readOnly && <button onClick={() => handleDelete(s.id)} className="text-red-500 hover:underline">Del</button>}
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="bg-green-50">
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={form.subjectType} onChange={e => setForm(f => ({ ...f, subjectType: e.target.value }))}>{SUBJECT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></td>
                <td className="p-1"><input type="date" className="border rounded px-1 py-0.5 text-xs" value={form.snapshotDate ?? ''} onChange={e => setForm(f => ({ ...f, snapshotDate: e.target.value }))} /></td>
                <td className="p-1"><input type="number" className="border rounded px-1 py-0.5 text-xs w-12" placeholder="MIA" value={form.miaCount ?? ''} onChange={e => setForm(f => ({ ...f, miaCount: e.target.value ? Number(e.target.value) : undefined }))} /></td>
                <td className="p-1"><select className="border rounded px-1 py-0.5 text-xs" value={form.mfrsStage ?? ''} onChange={e => setForm(f => ({ ...f, mfrsStage: (e.target.value || undefined) as MfrsStage | undefined }))}><option value="">—</option>{MFRS_STAGES.map(s => <option key={s} value={s}>{MFRS_LABELS[s]}</option>)}</select></td>
                <td className="p-1"><input type="number" className="border rounded px-1 py-0.5 text-xs w-24" placeholder="O/S" value={form.totalOutstanding ?? ''} onChange={e => setForm(f => ({ ...f, totalOutstanding: e.target.value }))} /></td>
                <td className="p-1"><input type="number" step="0.0001" className="border rounded px-1 py-0.5 text-xs w-20" placeholder="0.0500" value={form.pdPct ?? ''} onChange={e => setForm(f => ({ ...f, pdPct: e.target.value }))} /></td>
                <td className="p-1"><input type="number" step="0.0001" className="border rounded px-1 py-0.5 text-xs w-20" placeholder="0.4000" value={form.lgdPct ?? ''} onChange={e => setForm(f => ({ ...f, lgdPct: e.target.value }))} /></td>
                <td className="p-1"><input type="number" step="0.0001" className="border rounded px-1 py-0.5 text-xs w-20" placeholder="0.0200" value={form.lossRatePct ?? ''} onChange={e => setForm(f => ({ ...f, lossRatePct: e.target.value }))} /></td>
                <td className="p-1"><input type="number" className="border rounded px-1 py-0.5 text-xs w-24" placeholder="ECL" value={form.eclAmount ?? ''} onChange={e => setForm(f => ({ ...f, eclAmount: e.target.value }))} /></td>
                <td className="p-1"><input type="number" className="border rounded px-1 py-0.5 text-xs w-24" placeholder="Writeback" value={form.potentialEclWriteback ?? ''} onChange={e => setForm(f => ({ ...f, potentialEclWriteback: e.target.value }))} /></td>
                <td className="p-1 space-x-1">
                  <button onClick={handleAdd} disabled={saving} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">{saving ? '…' : 'Add'}</button>
                  <button onClick={() => setAdding(false)} className="text-xs border px-2 py-0.5 rounded">×</button>
                </td>
              </tr>
            )}
            {snapshots.length === 0 && !adding && (
              <tr><td colSpan={11} className="p-4 text-center text-gray-400 text-xs">No ECL snapshots added.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ─── ECL Forecasts section ────────────────────────────────────────────────────

const EclForecastsSection: React.FC<{ appId: string; readOnly: boolean }> = ({ appId, readOnly }) => {
  const [forecasts, setForecasts] = useState<EclForecast[]>([]);
  const [local, setLocal] = useState<Record<number, Partial<EclForecast>>>({});
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    creditService.listEclForecasts(appId).then(fs => {
      setForecasts(fs);
      const init: Record<number, Partial<EclForecast>> = {};
      [1, 2, 3].forEach(y => {
        const existing = fs.find(f => f.forecastYear === y);
        init[y] = existing ?? { forecastYear: y };
      });
      setLocal(init);
    });
  }, [appId]);

  const flush = async (year: number) => {
    setSaving(year);
    try {
      const saved = await creditService.upsertEclForecast(appId, year, local[year] ?? {});
      setForecasts(fs => {
        const idx = fs.findIndex(f => f.forecastYear === year);
        return idx >= 0 ? fs.map(f => f.forecastYear === year ? saved : f) : [...fs, saved];
      });
    } finally { setSaving(null); }
  };

  const update = (year: number, patch: Partial<EclForecast>) => {
    setLocal(l => ({ ...l, [year]: { ...(l[year] ?? {}), ...patch } }));
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">ECL Forecasts (Y1–Y3)</h3>
      <div className="border rounded-lg overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-2 text-left">Year</th>
              <th className="p-2 text-left">MFRS Stage</th>
              <th className="p-2 text-right">ECL Amount (RM)</th>
              <th className="p-2 text-right">PD (decimal)</th>
              <th className="p-2 text-right">LGD (decimal)</th>
              <th className="p-2 text-left">Assumptions</th>
              {!readOnly && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map(year => {
              const row = local[year] ?? {};
              return (
                <tr key={year} className="border-t">
                  <td className="p-2 text-sm font-semibold">Y{year}</td>
                  <td className="p-2">
                    {readOnly
                      ? <span className="text-sm">{row.mfrsStage ? MFRS_LABELS[row.mfrsStage] : '—'}</span>
                      : <select className="border rounded px-1 py-0.5 text-sm" value={row.mfrsStage ?? ''} onChange={e => update(year, { mfrsStage: (e.target.value || undefined) as MfrsStage | undefined })} onBlur={() => flush(year)}><option value="">—</option>{MFRS_STAGES.map(s => <option key={s} value={s}>{MFRS_LABELS[s]}</option>)}</select>}
                  </td>
                  <td className="p-2 text-right">
                    {readOnly
                      ? <span>{fmt(row.eclAmount)}</span>
                      : <input type="number" className="border rounded px-2 py-0.5 text-sm w-32 text-right" value={row.eclAmount ?? ''} onChange={e => update(year, { eclAmount: e.target.value })} onBlur={() => flush(year)} placeholder="0.00" />}
                  </td>
                  <td className="p-2 text-right">
                    {readOnly
                      ? <span>{row.pdPct ?? '—'}</span>
                      : <input type="number" step="0.0001" className="border rounded px-2 py-0.5 text-sm w-24 text-right" value={row.pdPct ?? ''} onChange={e => update(year, { pdPct: e.target.value })} onBlur={() => flush(year)} placeholder="0.0500" />}
                  </td>
                  <td className="p-2 text-right">
                    {readOnly
                      ? <span>{row.lgdPct ?? '—'}</span>
                      : <input type="number" step="0.0001" className="border rounded px-2 py-0.5 text-sm w-24 text-right" value={row.lgdPct ?? ''} onChange={e => update(year, { lgdPct: e.target.value })} onBlur={() => flush(year)} placeholder="0.4000" />}
                  </td>
                  <td className="p-2">
                    {readOnly
                      ? <span className="text-sm">{row.assumptions ?? '—'}</span>
                      : <input className="border rounded px-2 py-0.5 text-sm w-48" value={row.assumptions ?? ''} onChange={e => update(year, { assumptions: e.target.value })} onBlur={() => flush(year)} />}
                  </td>
                  {!readOnly && <td className="p-2 text-xs text-gray-400">{saving === year ? 'Saving…' : ''}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// ─── Main tab ─────────────────────────────────────────────────────────────────

const RiskRatingEclTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  const appId = application.id;
  const { user } = useAuth();
  const canApprove = hasPermission(user, 'credit:approve');
  const toast = useToast();
  const [scoreRuns, setScoreRuns] = useState<CreditScoreRun[]>([]);
  const [runningScore, setRunningScore] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState<CreditScoreRun | null>(null);
  const [overriding, setOverriding] = useState(false);
  const [overrideForm, setOverrideForm] = useState<{ rating: RiskRating; reason: string }>({ rating: 'BBB', reason: '' });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    creditService.listScoreRuns(application.id).then(setScoreRuns).catch(() => {});
  }, [application.id]);

  const handleRunScore = async () => {
    setRunningScore(true);
    try {
      const sr = await creditService.executeScore(application.id);
      setScoreRuns(prev => [sr, ...prev]);
      toast.success('Score Run', 'Score run completed');
    } catch (e) { toast.error('Score Error', friendlyMessage(e, 'Failed to run score')); }
    finally { setRunningScore(false); }
  };

  const handleOverride = async () => {
    if (!overrideTarget || !overrideForm.rating || !overrideForm.reason.trim()) return;
    setOverriding(true);
    try {
      const sr = await creditService.overrideScore(overrideTarget.id, {
        rating: overrideForm.rating,
        reason: overrideForm.reason,
        approverId: user!.id,
      });
      setScoreRuns(prev => prev.map(s => s.id === sr.id ? sr : s));
      setOverrideTarget(null);
      setOverrideForm({ rating: 'BBB', reason: '' });
      toast.success('Override', 'Rating overridden successfully');
    } catch (e) { toast.error('Override Error', friendlyMessage(e, 'Failed to override rating')); }
    finally { setOverriding(false); }
  };

  return (
    <CaMemoSection
      title="Risk Rating & ECL — Section 7"
      phase="Phase 3"
      readOnly={readOnly}
      saving={saving}
      savedAt={savedAt}
    >
      <div className="space-y-8">
      <ExternalRatingsSection appId={appId} readOnly={readOnly} />
      <EclSnapshotsSection appId={appId} readOnly={readOnly} />
      <EclForecastsSection appId={appId} readOnly={readOnly} />

      {/* Score Override Section */}
      {canApprove && (
        <section className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Credit Scoring</h3>
            <button
              onClick={handleRunScore}
              disabled={runningScore}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
              style={{ cursor: runningScore ? 'wait' : 'pointer', border: '1px solid var(--indigo-200, #c7d2fe)', fontFamily: 'var(--font-sans)' }}
            >
              <span className="material-symbols-outlined text-base">play_arrow</span>
              {runningScore ? 'Running...' : 'Run Score'}
            </button>
          </div>
          {scoreRuns.length === 0 && !runningScore && (
            <div className="text-center py-6 text-text-secondary bg-bg-surface border border-dashed border-border rounded-xl">
              <span className="material-symbols-outlined text-3xl block opacity-20 mb-1">analytics</span>
              <p className="text-sm">No score runs yet. Click "Run Score" to generate a credit score.</p>
            </div>
          )}
          {scoreRuns.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    {['#', 'Score', 'Rating', 'Date', 'Override', 'Actions'].map(h => (
                      <th key={h} className="p-2 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scoreRuns.map((sr, idx) => (
                    <tr key={sr.id} className={`border-t ${sr.overriddenBy ? 'bg-amber-50' : ''}`}>
                      <td className="p-2 text-gray-500">{idx + 1}</td>
                      <td className="p-2 font-semibold">{sr.totalScore ?? '—'}</td>
                      <td className="p-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${getRatingColor(sr.riskRating)}`}>
                          {sr.riskRating}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500">{new Date(sr.executedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="p-2">
                        {sr.overriddenBy ? (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            Override by {sr.overrider ? `${sr.overrider.firstName} ${sr.overrider.lastName}` : 'N/A'}
                          </span>
                        ) : <span className="text-xs text-gray-400">Original</span>}
                      </td>
                      <td className="p-2">
                        {canApprove && !sr.overriddenBy && (
                          <button onClick={() => setOverrideTarget(sr)} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                            Override
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Override Dialog */}
      {overrideTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setOverrideTarget(null)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Override Risk Rating</h2>
            <p className="text-sm text-text-secondary mb-4">
              Current rating: <span className={`font-bold ${getRatingTextColor(overrideTarget.riskRating)}`}>{overrideTarget.riskRating}</span> (Score: {overrideTarget.totalScore ?? '—'})
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">New Rating *</label>
                <select value={overrideForm.rating} onChange={e => setOverrideForm(f => ({ ...f, rating: e.target.value as RiskRating }))}
                  className="w-full px-4 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)' }}>
                  {RISK_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Reason * <span className="text-xs text-text-tertiary">(required)</span></label>
                <textarea rows={3} value={overrideForm.reason} onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-brand-200" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }}
                  placeholder="Justification for overriding the risk rating..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setOverrideTarget(null)} className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-gray-50 transition-colors" style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
              <button onClick={handleOverride} disabled={!overrideForm.rating || !overrideForm.reason.trim() || overriding}
                className="px-4 py-2 text-sm font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                {overriding ? 'Overriding...' : 'Override Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </CaMemoSection>
  );
};

export default RiskRatingEclTab;
