import React, { useCallback, useEffect, useState } from 'react';
import creditService, {
  CreditApplication,
  ExternalRating,
  EclSnapshot,
  EclForecast,
  RatingAgency,
  MfrsStage,
} from '../../../src/services/credit.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENCIES: RatingAgency[] = ['RAM', 'MARC', 'SP', 'MOODYS', 'FITCH'];
const AGENCY_LABELS: Record<RatingAgency, string> = { RAM: 'RAM', MARC: 'MARC', SP: 'S&P', MOODYS: "Moody's", FITCH: 'Fitch' };
const SUBJECT_TYPES = ['CUSTOMER', 'CORPORATE_GUARANTOR'];
const MFRS_STAGES: MfrsStage[] = ['STAGE_1', 'STAGE_2', 'STAGE_3'];
const MFRS_LABELS: Record<MfrsStage, string> = { STAGE_1: 'Stage 1', STAGE_2: 'Stage 2', STAGE_3: 'Stage 3' };
const OUTLOOKS = ['Stable', 'Positive', 'Negative', 'Watch Negative', 'Watch Positive'];

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

  return (
    <div className="p-6 space-y-8">
      <ExternalRatingsSection appId={appId} readOnly={readOnly} />
      <EclSnapshotsSection appId={appId} readOnly={readOnly} />
      <EclForecastsSection appId={appId} readOnly={readOnly} />
    </div>
  );
};

export default RiskRatingEclTab;
