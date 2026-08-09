import React, { useEffect, useState, useCallback } from 'react';
import {
  disbursementApi,
  DisbursementOrder,
  DisbursementReadinessResult,
  CreditApplication,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import IntegrationModeBanner from '../../../src/components/credit/IntegrationModeBanner';
import { useAuth } from '../../../src/context/AuthContext';
import { hasPermission } from '../../../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import { useCreditFeatureFlags } from '../../../src/hooks/useCreditFeatureFlags';

type Props = { application: CreditApplication; onUpdated: (app: CreditApplication) => void };

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border-amber-300',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-300',
  DISBURSED: 'bg-green-100 text-green-800 border-green-300',
  CANCELLED: 'bg-gray-100 text-gray-600 border-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending Approval',
  APPROVED: 'Approved — Awaiting Disbursement',
  DISBURSED: 'Disbursed',
  CANCELLED: 'Cancelled',
};

function userName(u: { firstName: string; lastName: string } | null | undefined): string {
  if (!u) return '—';
  return `${u.firstName} ${u.lastName}`.trim() || '—';
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const ReadinessChecklist: React.FC<{ appId: string }> = ({ appId }) => {
  const [readiness, setReadiness] = useState<DisbursementReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    disbursementApi.readiness(appId)
      .then(setReadiness)
      .catch(() => toast.error('Failed to load readiness'))
      .finally(() => setLoading(false));
  }, [appId]);

  if (loading) return <p className="text-xs text-gray-400">Loading readiness…</p>;
  if (!readiness) return null;

  return (
    <div className="space-y-2">
      {readiness.checks.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className={`text-base ${c.pass ? 'text-green-600' : 'text-red-500'}`}>
            {c.pass ? '✅' : '❌'}
          </span>
          <span className={c.pass ? 'text-gray-700' : 'text-red-700 font-medium'}>{c.reason}</span>
        </div>
      ))}
      {readiness.ready && (
        <p className="text-xs text-green-600 font-medium mt-1">All disbursement readiness checks passed.</p>
      )}
    </div>
  );
};

const DisbursementOrderForm: React.FC<{
  appId: string;
  approvedTotal: number;
  onCreated: (order: DisbursementOrder) => void;
}> = ({ appId, approvedTotal, onCreated }) => {
  const [form, setForm] = useState({
    totalAmount: '',
    currency: 'MYR',
    disbursementMethod: '',
    beneficiaryBank: '',
    beneficiaryAccount: '',
    referenceNote: '',
  });
  const [saving, setSaving] = useState(false);
  const [amountError, setAmountError] = useState('');

  const submit = async () => {
    setAmountError('');
    if (!form.totalAmount || parseFloat(form.totalAmount) <= 0) {
      setAmountError('Total amount is required');
      return;
    }
    if (approvedTotal > 0 && parseFloat(form.totalAmount) > approvedTotal) {
      setAmountError(`Amount exceeds approved total (${approvedTotal.toLocaleString('en-MY', { minimumFractionDigits: 2 })})`);
      return;
    }
    setSaving(true);
    try {
      const order = await disbursementApi.create(appId, {
        totalAmount: parseFloat(form.totalAmount),
        currency: form.currency || undefined,
        disbursementMethod: form.disbursementMethod || undefined,
        beneficiaryBank: form.beneficiaryBank || undefined,
        beneficiaryAccount: form.beneficiaryAccount || undefined,
        referenceNote: form.referenceNote || undefined,
      });
      toast.success('Disbursement order created');
      onCreated(order);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to create disbursement order'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New Disbursement Order</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Total Amount *</label>
          <input type="number" step="0.01" min="0" className={`border rounded px-2 py-1 text-sm w-full${amountError ? ' border-red-400' : ''}`}
            value={form.totalAmount} onChange={e => { setForm(f => ({ ...f, totalAmount: e.target.value })); setAmountError(''); }} />
          {amountError && <p className="text-xs text-red-600 mt-0.5">{amountError}</p>}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Currency</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={form.currency}
            onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            <option value="MYR">MYR</option>
            <option value="USD">USD</option>
            <option value="SGD">SGD</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Disbursement Method</label>
          <select className="border rounded px-2 py-1 text-sm w-full" value={form.disbursementMethod}
            onChange={e => setForm(f => ({ ...f, disbursementMethod: e.target.value }))}>
            <option value="">— Select —</option>
            <option value="telegraphic_transfer">Telegraphic Transfer</option>
            <option value="cheque">Cheque</option>
            <option value="internal_transfer">Internal Transfer</option>
            <option value="ibft">IBFT / IBG</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Beneficiary Bank</label>
          <input className="border rounded px-2 py-1 text-sm w-full" value={form.beneficiaryBank}
            onChange={e => setForm(f => ({ ...f, beneficiaryBank: e.target.value }))} placeholder="Bank name" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Beneficiary Account</label>
          <input className="border rounded px-2 py-1 text-sm w-full" value={form.beneficiaryAccount}
            onChange={e => setForm(f => ({ ...f, beneficiaryAccount: e.target.value }))} placeholder="Account number" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Reference Note</label>
          <textarea className="border rounded px-2 py-1 text-sm w-full resize-none h-16" value={form.referenceNote}
            onChange={e => setForm(f => ({ ...f, referenceNote: e.target.value }))} placeholder="Internal reference or instructions…" />
        </div>
      </div>
      <button onClick={submit} disabled={saving} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Disbursement Order'}
      </button>
    </div>
  );
};

const CancelForm: React.FC<{
  onCancel: (reason: string) => void;
  loading: boolean;
}> = ({ onCancel, loading }) => {
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);

  if (!open) {
    return <button onClick={() => setOpen(true)} className="text-xs text-red-500 hover:text-red-700 underline">Cancel Order</button>;
  }

  return (
    <div className="border border-red-200 rounded p-3 bg-red-50 space-y-2">
      <label className="block text-xs text-gray-600 font-medium">Cancellation Reason *</label>
      <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-16" value={reason}
        onChange={e => setReason(e.target.value)} placeholder="Explain why this order is being cancelled…" />
      <div className="flex gap-2">
        <button onClick={() => { if (reason.trim()) onCancel(reason.trim()); else toast.error('Reason required'); }}
          disabled={loading || !reason.trim()}
          className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
          {loading ? 'Cancelling…' : 'Confirm Cancel'}
        </button>
        <button onClick={() => setOpen(false)} className="px-3 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">Back</button>
      </div>
    </div>
  );
};

const DisbursementTab: React.FC<Props> = ({ application, onUpdated }) => {
  const { user } = useAuth();
  const { integrations } = useCreditFeatureFlags();
  const cbsStatus = integrations?.cbs ?? 'PLACEHOLDER' as const;
  const appId = application.id;
  const [order, setOrder] = useState<DisbursementOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');
  const canApprove = hasPermission(user, 'credit:approve');
  const canDisburse = hasPermission(user, 'credit:disburse');
  const isRequestor = order?.requestedById === user?.id;
  const isApprover = order?.approvedById === user?.id;
  const isDisburser = order?.disbursedById === user?.id;
  const readOnly = application.state !== 'ACCEPTED';

  // Compute approved total from facilities (F22)
  const approvedTotal = (application.facilities ?? []).reduce(
    (sum, f) => sum + Number(f.approvedAmount ?? f.amount),
    0,
  );

  const loadOrder = useCallback(async () => {
    try {
      const data = await disbursementApi.get(appId);
      setOrder(data);
    } catch {
      // 404 means no order yet — that's fine
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const handleCreated = (o: DisbursementOrder) => { setOrder(o); };
  const handleRefresh = () => { loadOrder(); };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const updated = await disbursementApi.approve(appId);
      toast.success('Disbursement order approved');
      setOrder(updated);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to approve'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisburse = async () => {
    if (!confirm('Confirm disbursement? This will transition the application to DISBURSED state and cannot be undone.')) return;
    setActionLoading(true);
    try {
      const updated = await disbursementApi.disburse(appId);
      toast.success('Disbursement confirmed — application now in DISBURSED state');
      setOrder(updated);
      // Refresh application state
      onUpdated({ ...application, state: 'DISBURSED' } as CreditApplication);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to confirm disbursement'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (reason: string) => {
    setActionLoading(true);
    try {
      const updated = await disbursementApi.cancel(appId, reason);
      toast.success('Disbursement order cancelled');
      setOrder(updated);
    } catch (e) {
      toast.error(friendlyMessage(e, 'Failed to cancel'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* LOS-021: Record-only mode banner */}
      <IntegrationModeBanner capability="core banking" status={cbsStatus} />

      {/* Readiness Checklist */}
      <CaMemoSection title="Disbursement Readiness" phase="S7">
        <ReadinessChecklist appId={appId} />
      </CaMemoSection>

      {/* Existing Order or Create Form */}
      {loading ? (
        <div className="text-sm text-gray-400 py-4">Loading disbursement order…</div>
      ) : order ? (
        <CaMemoSection title="Disbursement Order" phase="S7">
          {/* Status Banner */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-medium ${STATUS_STYLES[order.status]}`}>
            <span className="font-bold">{STATUS_LABELS[order.status]}</span>
            <span>· Order {order.orderNo}</span>
          </div>

          {/* Order Details */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
            <div><span className="text-xs text-gray-500">Total Amount</span><br />
              <span className="font-medium">{Number(order.totalAmount).toLocaleString('en-MY', { minimumFractionDigits: 2 })} {order.currency}</span>
            </div>
            <div><span className="text-xs text-gray-500">Method</span><br />
              <span className="font-medium">{order.disbursementMethod || '—'}</span>
            </div>
            <div><span className="text-xs text-gray-500">Beneficiary Bank</span><br />
              <span className="font-medium">{order.beneficiaryBank || '—'}</span>
            </div>
            <div><span className="text-xs text-gray-500">Beneficiary Account</span><br />
              <span className="font-medium">{order.beneficiaryAccount || '—'}</span>
            </div>
            {order.referenceNote && (
              <div className="col-span-2"><span className="text-xs text-gray-500">Reference Note</span><br />
                <span className="font-medium">{order.referenceNote}</span>
              </div>
            )}
          </div>

          {/* Lifecycle Timeline */}
          <div className="mt-4 border-t pt-3 space-y-1 text-xs text-gray-600">
            <p><strong>Requested:</strong> {userName(order.requestedBy)} · {formatDate(order.requestedAt)}</p>
            {order.approvedById && <p><strong>Approved:</strong> {userName(order.approvedBy)} · {formatDate(order.approvedAt)}</p>}
            {order.disbursedById && <p><strong>Disbursed:</strong> {userName(order.disbursedBy)} · {formatDate(order.disbursedAt)}</p>}
            {order.cancelledById && <p><strong>Cancelled:</strong> {userName(order.cancelledBy)} · {formatDate(order.cancelledAt)}{order.cancellationReason ? ` — ${order.cancellationReason}` : ''}</p>}
          </div>

          {/* Action Buttons */}
          {order.status === 'PENDING' && canApprove && !isRequestor && (
            <div className="mt-4 pt-3 border-t">
              <button onClick={handleApprove} disabled={actionLoading}
                className="px-4 py-1.5 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                {actionLoading ? 'Approving…' : 'Approve Disbursement'}
              </button>
              {isRequestor && <p className="text-xs text-amber-600 mt-1">You created this order — a different officer must approve.</p>}
            </div>
          )}

          {order.status === 'APPROVED' && canDisburse && !isApprover && !isRequestor && (
            <div className="mt-4 pt-3 border-t">
              <button onClick={handleDisburse} disabled={actionLoading}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                {actionLoading ? 'Disbursing…' : 'Confirm Disbursement'}
              </button>
              <p className="text-xs text-gray-500 mt-1">Three-role segregation: requestor, approver, and disburser must all be different people.</p>
            </div>
          )}

          {order.status === 'PENDING' && canApprove && isRequestor && (
            <div className="mt-2">
              <p className="text-xs text-amber-600">You created this order — a different officer with approval authority must approve it.</p>
            </div>
          )}

          {order.status === 'APPROVED' && (isApprover || isRequestor) && !canDisburse && (
            <div className="mt-2">
              <p className="text-xs text-gray-500">A different officer with disbursement authority must confirm the disbursement.</p>
            </div>
          )}

          {order.status !== 'DISBURSED' && order.status !== 'CANCELLED' && canApprove && !readOnly && (
            <div className="mt-3 pt-3 border-t">
              <CancelForm onCancel={handleCancel} loading={actionLoading} />
            </div>
          )}
        </CaMemoSection>
      ) : (
        !readOnly && canWrite ? (
          <DisbursementOrderForm appId={appId} approvedTotal={approvedTotal} onCreated={handleCreated} />
        ) : (
          <CaMemoSection title="Disbursement Order" phase="S7">
            <p className="text-sm text-gray-400 italic">No disbursement order has been created yet.
              {readOnly ? ' Disbursement can only be initiated when the application is in ACCEPTED state.' : ''}
            </p>
          </CaMemoSection>
        )
      )}
    </>
  );
};

export default DisbursementTab;