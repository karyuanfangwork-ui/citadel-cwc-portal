import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  AccountUtilisationSnapshot,
  AccountUtilisationInput,
  utilisationApi,
} from '../../../src/services/credit.service';

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
};

const fmt = (v: number | null | undefined) =>
  v != null ? v.toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '—';

// ─── Add Snapshot Form ────────────────────────────────────────────────────────

const AddSnapshotForm: React.FC<{
  appId: string;
  facilityType: string;
  onAdded: (item: AccountUtilisationSnapshot) => void;
}> = ({ appId, facilityType, onAdded }) => {
  const [form, setForm] = useState({
    accountNo: '',
    snapshotMonth: '',
    withdrawalAmount: '',
    depositAmount: '',
    monthEndBalance: '',
    returnedChequesCount: '',
    approvedLimit: '',
    outstandingAmount: '',
    overdueAmount: '',
    instalmentsInArrears: '',
  });
  const [saving, setSaving] = useState(false);

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.accountNo || !form.snapshotMonth) return;
    setSaving(true);
    try {
      const payload: AccountUtilisationInput = {
        accountNo: form.accountNo,
        facilityType,
        snapshotMonth: form.snapshotMonth,
        withdrawalAmount: form.withdrawalAmount || null,
        depositAmount: form.depositAmount || null,
        monthEndBalance: form.monthEndBalance || null,
        returnedChequesCount: form.returnedChequesCount ? Number(form.returnedChequesCount) : null,
        approvedLimit: form.approvedLimit || null,
        outstandingAmount: form.outstandingAmount || null,
        overdueAmount: form.overdueAmount || null,
        instalmentsInArrears: form.instalmentsInArrears ? Number(form.instalmentsInArrears) : null,
      };
      const saved = await utilisationApi.upsert(appId, payload);
      onAdded(saved);
      setForm({ accountNo: '', snapshotMonth: '', withdrawalAmount: '', depositAmount: '', monthEndBalance: '', returnedChequesCount: '', approvedLimit: '', outstandingAmount: '', overdueAmount: '', instalmentsInArrears: '' });
    } finally { setSaving(false); }
  };

  const isCashline = facilityType === 'CASHLINE';

  return (
    <div className="border rounded p-3 bg-gray-50 space-y-2 mt-3">
      <p className="text-xs font-medium text-gray-600">Add Snapshot</p>
      <div className="grid grid-cols-2 gap-2">
        <input className="border rounded px-2 py-1 text-sm" placeholder="Account No" value={form.accountNo} onChange={e => update('accountNo', e.target.value)} />
        <input type="month" className="border rounded px-2 py-1 text-sm" value={form.snapshotMonth} onChange={e => update('snapshotMonth', `${e.target.value}-01`)} />
        {isCashline ? <>
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Withdrawal" value={form.withdrawalAmount} onChange={e => update('withdrawalAmount', e.target.value)} />
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Deposit" value={form.depositAmount} onChange={e => update('depositAmount', e.target.value)} />
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Month-End Balance" value={form.monthEndBalance} onChange={e => update('monthEndBalance', e.target.value)} />
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Returned Cheques" value={form.returnedChequesCount} onChange={e => update('returnedChequesCount', e.target.value)} />
        </> : <>
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Approved Limit" value={form.approvedLimit} onChange={e => update('approvedLimit', e.target.value)} />
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Outstanding" value={form.outstandingAmount} onChange={e => update('outstandingAmount', e.target.value)} />
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Overdue" value={form.overdueAmount} onChange={e => update('overdueAmount', e.target.value)} />
          <input type="number" className="border rounded px-2 py-1 text-sm" placeholder="Instalments in Arrears" value={form.instalmentsInArrears} onChange={e => update('instalmentsInArrears', e.target.value)} />
        </>}
      </div>
      <button onClick={submit} disabled={saving} className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
};

// ─── Snapshot Table ───────────────────────────────────────────────────────────

const SnapshotTable: React.FC<{
  title: string;
  facilityType: string;
  appId: string;
  items: AccountUtilisationSnapshot[];
  readOnly: boolean;
  onRemoved: (id: string) => void;
  onAdded: (item: AccountUtilisationSnapshot) => void;
}> = ({ title, facilityType, appId, items, readOnly, onRemoved, onAdded }) => {
  const isCashline = facilityType === 'CASHLINE';

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{title}</h3>
      {items.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="p-2 text-left">Account No</th>
                <th className="p-2 text-left">Month</th>
                {isCashline ? <>
                  <th className="p-2 text-right">Withdrawal</th>
                  <th className="p-2 text-right">Deposit</th>
                  <th className="p-2 text-right">Month-End Bal</th>
                  <th className="p-2 text-right">Returned Cheques</th>
                </> : <>
                  <th className="p-2 text-right">Approved Limit</th>
                  <th className="p-2 text-right">Outstanding</th>
                  <th className="p-2 text-right">Overdue</th>
                  <th className="p-2 text-right">Inst. Arrears</th>
                </>}
                {!readOnly && <th className="p-2"></th>}
              </tr>
            </thead>
            <tbody>
              {items.map(s => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="p-2">{s.accountNo}</td>
                  <td className="p-2">{s.snapshotMonth?.slice(0, 7)}</td>
                  {isCashline ? <>
                    <td className="p-2 text-right">{fmt(s.withdrawalAmount)}</td>
                    <td className="p-2 text-right">{fmt(s.depositAmount)}</td>
                    <td className="p-2 text-right">{fmt(s.monthEndBalance)}</td>
                    <td className="p-2 text-right">{s.returnedChequesCount ?? '—'}</td>
                  </> : <>
                    <td className="p-2 text-right">{fmt(s.approvedLimit)}</td>
                    <td className="p-2 text-right">{fmt(s.outstandingAmount)}</td>
                    <td className="p-2 text-right">{fmt(s.overdueAmount)}</td>
                    <td className="p-2 text-right">{s.instalmentsInArrears ?? '—'}</td>
                  </>}
                  {!readOnly && (
                    <td className="p-2 text-center">
                      <button onClick={() => onRemoved(s.id)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">No snapshots recorded.</p>
      )}
      {!readOnly && <AddSnapshotForm appId={appId} facilityType={facilityType} onAdded={onAdded} />}
    </section>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const AccountConductTab: React.FC<Props> = ({ application }) => {
  const readOnly = application.state !== 'DRAFT';
  const [snapshots, setSnapshots] = useState<AccountUtilisationSnapshot[]>([]);

  useEffect(() => {
    utilisationApi.list(application.id).then(setSnapshots).catch(() => {});
  }, [application.id]);

  const byType = (type: string) => snapshots.filter(s => s.facilityType === type);
  const others = snapshots.filter(s => s.facilityType !== 'CASHLINE' && s.facilityType !== 'TERM');

  const handleRemoved = (id: string) => setSnapshots(s => s.filter(x => x.id !== id));
  const handleAdded = (item: AccountUtilisationSnapshot) => setSnapshots(s => [...s, item]);

  return (
    <div className="p-6 space-y-8">
      <SnapshotTable
        title="Term Financings"
        facilityType="TERM"
        appId={application.id}
        items={byType('TERM')}
        readOnly={readOnly}
        onRemoved={handleRemoved}
        onAdded={handleAdded}
      />
      <SnapshotTable
        title="Cashline — 6-Month Rolling"
        facilityType="CASHLINE"
        appId={application.id}
        items={byType('CASHLINE')}
        readOnly={readOnly}
        onRemoved={handleRemoved}
        onAdded={handleAdded}
      />
      {others.length > 0 && (
        <SnapshotTable
          title="Other Accounts"
          facilityType="OTHER"
          appId={application.id}
          items={others}
          readOnly={readOnly}
          onRemoved={handleRemoved}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
};

export default AccountConductTab;
