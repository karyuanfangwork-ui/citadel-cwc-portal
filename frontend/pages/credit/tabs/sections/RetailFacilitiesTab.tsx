import React, { useCallback, useEffect, useState } from 'react';
import creditService, {
  CreditApplication,
  CreditFacility,
  FacilityType,
} from '../../../../src/services/credit.service';
import CaMemoSection from '../../../../src/components/credit/CaMemoSection';
import { formatRequiredCreditAmount } from '../../creditUtils';

// ── Retail-only facility types (no LC, BG, Trust Receipt, Islamic variants) ──
const RETAIL_FACILITY_TYPES: { value: FacilityType; label: string }[] = [
  { value: 'TERM_LOAN', label: 'Term Loan' },
  { value: 'OVERDRAFT', label: 'Overdraft' },
  { value: 'REVOLVING_CREDIT', label: 'Revolving Credit' },
];

// ── Map application.productType → facilityType for pre-fill ──
const PRODUCT_TO_FACILITY: Record<string, FacilityType> = {
  TERM_LOAN: 'TERM_LOAN',
  REVOLVING_CREDIT: 'REVOLVING_CREDIT',
  OVERDRAFT: 'OVERDRAFT',
  REVOLVING: 'REVOLVING_CREDIT',
};

// ── Props ───────────────────────────────────────────────────────

type Props = {
  application: CreditApplication;
  onDirtyChange?: (dirty: boolean) => void;
};

// ── Form state ───────────────────────────────────────────────────

type FormState = {
  facilityType: FacilityType;
  amount: string;
  tenorMonths: string;
  ratePct: string;
  purpose: string;
};

const emptyForm: FormState = {
  facilityType: 'TERM_LOAN',
  amount: '',
  tenorMonths: '',
  ratePct: '',
  purpose: '',
};

// ── Component ────────────────────────────────────────────────────

const RetailFacilitiesTab: React.FC<Props> = ({ application, onDirtyChange }) => {
  const LOCKED_STATES = new Set(['COMMITTEE_REVIEW', 'APPROVED', 'REJECTED', 'CONDITION_FULFILMENT', 'OFFER', 'ACCEPTED', 'DISBURSED', 'ACTIVE', 'CLOSED', 'WITHDRAWN']);
  const readOnly = LOCKED_STATES.has(application.state ?? '');
  const appId = application.id;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [facilities, setFacilities] = useState<CreditFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);

  // Load existing facilities
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const facs = await creditService.listFacilities(appId);
      setFacilities(facs);
    } catch {
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  // Close form when facilities load (pre-fill may have opened it during loading state)
  useEffect(() => {
    if (facilities.length > 0 && !editingId) {
      setShowForm(false);
      setForm(emptyForm);
    }
  }, [facilities.length, editingId]);

  // Pre-fill from S1 Loan Request when no facilities exist
  useEffect(() => {
    if (facilities.length > 0) return;
    if (loading) return; // wait for load to confirm truly empty
    const prefill: Partial<FormState> = {};
    if (application.productType) {
      const mapped = PRODUCT_TO_FACILITY[application.productType];
      if (mapped) prefill.facilityType = mapped;
    }
    if (application.requestedAmount) prefill.amount = String(application.requestedAmount);
    if (application.requestedTenor) prefill.tenorMonths = String(application.requestedTenor);
    if (application.purpose) prefill.purpose = application.purpose;
    if (Object.keys(prefill).length > 0) {
      setForm(prev => ({ ...prev, ...prefill }));
      setShowForm(true); // auto-open form when pre-filled
    }
  }, [facilities.length, loading, application.productType, application.requestedAmount, application.requestedTenor, application.purpose]);

  // ── Validation ──
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.facilityType) errs.facilityType = 'Facility type is required';
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Amount must be greater than 0';
    if (form.tenorMonths && Number(form.tenorMonths) <= 0) errs.tenorMonths = 'Tenor must be positive';
    if (form.ratePct && Number(form.ratePct) < 0) errs.ratePct = 'Rate cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Create ──
  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Partial<CreditFacility> = {
        facilityType: form.facilityType,
        amount: Number(form.amount),
        newLimit: Number(form.amount),
        tenorMonths: form.tenorMonths ? Number(form.tenorMonths) : null,
        ratePct: form.ratePct ? Number(form.ratePct) : null,
        purpose: form.purpose || null,
      };
      if (editingId) {
        await creditService.updateFacility(editingId, payload);
        setEditingId(null);
      } else {
        await creditService.createFacility(appId, payload);
      }
      setForm(emptyForm);
      setShowForm(false);
      setErrors({});
      await load();
      onDirtyChange?.(false);
    } catch {
      setErrors({ general: 'Failed to save facility. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  // ── Edit ──
  const handleEdit = (fac: CreditFacility) => {
    setEditingId(fac.id);
    setForm({
      facilityType: fac.facilityType,
      amount: String(fac.newLimit ?? fac.amount),
      tenorMonths: fac.tenorMonths != null ? String(fac.tenorMonths) : '',
      ratePct: fac.ratePct != null ? String(fac.ratePct) : '',
      purpose: fac.purpose ?? '',
    });
    setShowForm(true);
    setErrors({});
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!confirm('Remove this facility?')) return;
    try {
      await creditService.deleteFacility(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
        setShowForm(false);
      }
      await load();
    } catch {
      // silent — reload will reflect current state
    }
  };

  // ── Cancel ──
  const handleCancel = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setErrors({});
    onDirtyChange?.(false);
  };

  // ── Field dirty tracking ──
  const handleFormChange = (key: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    onDirtyChange?.(true);
  };

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Info banner ── */}
      <CaMemoSection title="Retail Loan Facility" phase="S1" readOnly={readOnly}>
        <div className="space-y-5">
          {/* Help text */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <span className="material-symbols-outlined text-blue-500 text-base mt-0.5">info</span>
            <div className="text-xs text-blue-800">
              <p className="font-medium">What is a facility?</p>
              <p className="mt-0.5">
                Every loan application needs at least one <strong>facility</strong> — it defines the
                product type and amount being offered to the borrower. We've pre-filled this from
                your Loan Request. Review the details and click <strong>Save Facility</strong> to continue.
              </p>
            </div>
          </div>

          {/* ── Facility form (shown when adding/editing) ── */}
          {showForm && !readOnly && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">
                {editingId ? 'Edit Facility' : 'Add Facility'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Facility Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Facility Type *</label>
                  <select
                    value={form.facilityType}
                    onChange={e => handleFormChange('facilityType', e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${errors.facilityType ? 'border-red-400' : 'border-gray-300'}`}
                  >
                    {RETAIL_FACILITY_TYPES.map(ft => (
                      <option key={ft.value} value={ft.value}>{ft.label}</option>
                    ))}
                  </select>
                  {errors.facilityType && <p className="text-[10px] text-red-600 mt-0.5">{errors.facilityType}</p>}
                </div>

                {/* Loan Amount */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Loan Amount (RM) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">RM</span>
                    <input
                      type="number"
                      value={form.amount}
                      onChange={e => handleFormChange('amount', e.target.value)}
                      placeholder="0"
                      className={`w-full border rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${errors.amount ? 'border-red-400' : 'border-gray-300'}`}
                    />
                  </div>
                  {errors.amount && <p className="text-[10px] text-red-600 mt-0.5">{errors.amount}</p>}
                </div>

                {/* Tenor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tenor (months) *</label>
                  <input
                    type="number"
                    value={form.tenorMonths}
                    onChange={e => handleFormChange('tenorMonths', e.target.value)}
                    placeholder="e.g. 60"
                    className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${errors.tenorMonths ? 'border-red-400' : 'border-gray-300'}`}
                  />
                  {errors.tenorMonths && <p className="text-[10px] text-red-600 mt-0.5">{errors.tenorMonths}</p>}
                </div>

                {/* Interest Rate */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Interest Rate (%)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={form.ratePct}
                      onChange={e => handleFormChange('ratePct', e.target.value)}
                      placeholder="e.g. 4.50"
                      className={`w-full border rounded-lg pr-8 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 ${errors.ratePct ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  </div>
                  {errors.ratePct && <p className="text-[10px] text-red-600 mt-0.5">{errors.ratePct}</p>}
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Purpose</label>
                <textarea
                  value={form.purpose}
                  onChange={e => handleFormChange('purpose', e.target.value)}
                  placeholder="Describe the purpose of this facility..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none"
                />
              </div>

              {/* Error */}
              {errors.general && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {errors.general}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : editingId ? 'Update Facility' : 'Save Facility'}
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Saved facilities list ── */}
          {facilities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Saved Facilities</h4>
              <div className="space-y-2">
                {facilities.map(fac => {
                  const typeLabel = RETAIL_FACILITY_TYPES.find(t => t.value === fac.facilityType)?.label ?? fac.facilityType;
                  const isEditing = editingId === fac.id;
                  return (
                    <div
                      key={fac.id}
                      className={`flex items-center justify-between border rounded-lg p-3 ${isEditing ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-center gap-4 flex-wrap">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                          {typeLabel}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{formatRequiredCreditAmount(fac.newLimit ?? fac.amount, application.currency)}</span>
                        {fac.tenorMonths != null && (
                          <span className="text-sm text-gray-600">{fac.tenorMonths} mo</span>
                        )}
                        {fac.ratePct != null && (
                          <span className="text-sm text-gray-600">{Number(fac.ratePct).toFixed(2)}%</span>
                        )}
                        {fac.purpose && (
                          <span className="text-xs text-gray-400 truncate max-w-[200px]">{fac.purpose}</span>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-2 ml-2">
                          <button
                            onClick={() => handleEdit(fac)}
                            className="text-xs text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(fac.id)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Tip for multiple facilities */}
              <div className="flex items-start gap-2 mt-3">
                <span className="text-amber-500 text-sm mt-0.5">💡</span>
                <p className="text-xs text-gray-400">
                  Add multiple facilities if the borrower needs more than one product
                  (e.g. Term Loan + Overdraft).
                </p>
              </div>
            </div>
          )}

          {/* ── Empty state (no facilities, form not shown) ── */}
          {facilities.length === 0 && !showForm && !readOnly && (
            <div className="text-center py-6">
              <span className="material-symbols-outlined text-4xl text-gray-300 block mb-2">account_balance_wallet</span>
              <p className="text-sm text-gray-400 mb-3">No facilities added yet.</p>
              <button
                onClick={() => { setForm(emptyForm); setShowForm(true); }}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Add Facility
              </button>
            </div>
          )}

          {/* ── Read-only: show facilities even if 0 ── */}
          {facilities.length === 0 && readOnly && (
            <p className="text-sm text-gray-400 text-center py-4">No facilities recorded.</p>
          )}

          {/* ── Add another button (when facilities exist, form not open) ── */}
          {facilities.length > 0 && !showForm && !readOnly && (
            <button
              onClick={() => { setForm(emptyForm); setShowForm(true); }}
              className="text-xs text-blue-600 border border-blue-300 px-3 py-1.5 rounded hover:bg-blue-50 transition-colors"
            >
              + Add Another Facility
            </button>
          )}
        </div>
      </CaMemoSection>
    </div>
  );
};

export default RetailFacilitiesTab;