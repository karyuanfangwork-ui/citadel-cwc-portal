import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import Combobox, { ComboboxOption } from '../ui/Combobox';
import creditService, { BorrowerProfile } from '../../services/credit.service';

// ── Types ────────────────────────────────────────────────────────────────

type BorrowerType = 'CORPORATE' | 'INDIVIDUAL' | 'SOLE_PROPRIETOR' | 'JOINT';
type RiskRating = 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D' | 'NR';
type AmlRiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'PROHIBITED';

export interface EditBorrowerModalProps {
  profile: BorrowerProfile;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: BorrowerProfile) => void;
}

interface FormState {
  name: string;
  borrowerType: string;
  isActive: boolean;
  creditRiskRating: string;
  amlRiskTier: string;
  isSanctionedEntity: boolean;
  exposureLimit: string;
  occupation: string;
  employer: string;
  annualIncome: string;
  netWorth: string;
  sourceOfWealth: string;
  purposeOfAccount: string;
  // Identity fields (CRM-independent, Phase 3)
  nricPassport: string;
  phone: string;
  email: string;
  address: string;
  // Corporate identity fields
  registrationNumber: string;
  industry: string;
}

// ── Static Options ────────────────────────────────────────────────────────

const BORROWER_TYPE_OPTIONS: ComboboxOption[] = [
  { value: 'CORPORATE', label: 'Corporate', icon: 'business' },
  { value: 'INDIVIDUAL', label: 'Individual', icon: 'person' },
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor', icon: 'storefront' },
  { value: 'JOINT', label: 'Joint', icon: 'group' },
];

const RISK_RATING_OPTIONS: ComboboxOption[] = [
  { value: 'AAA', label: 'AAA — Prime' },
  { value: 'AA', label: 'AA — High Grade' },
  { value: 'A', label: 'A — Upper Medium Grade' },
  { value: 'BBB', label: 'BBB — Medium Grade' },
  { value: 'BB', label: 'BB — Speculative' },
  { value: 'B', label: 'B — Highly Speculative' },
  { value: 'CCC', label: 'CCC — Substantial Risk' },
  { value: 'CC', label: 'CC — Extremely Speculative' },
  { value: 'C', label: 'C — Near Default' },
  { value: 'D', label: 'D — Default' },
  { value: 'NR', label: 'NR — Not Rated' },
];

const AML_TIER_OPTIONS: ComboboxOption[] = [
  { value: 'LOW', label: 'Low Risk', icon: 'check_circle' },
  { value: 'MEDIUM', label: 'Medium Risk', icon: 'warning' },
  { value: 'HIGH', label: 'High Risk', icon: 'error' },
  { value: 'PROHIBITED', label: 'Prohibited', icon: 'block' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

const toStr = (val: string | number | null | undefined): string =>
  val == null ? '' : String(val);

const formStateFromProfile = (p: BorrowerProfile): FormState => ({
  name: p.name ?? '',
  borrowerType: p.borrowerType ?? 'CORPORATE',
  isActive: p.isActive ?? true,
  creditRiskRating: p.creditRiskRating ?? '',
  amlRiskTier: p.amlRiskTier ?? '',
  isSanctionedEntity: p.isSanctionedEntity ?? false,
  exposureLimit: toStr(p.exposureLimit),
  occupation: p.occupation ?? '',
  employer: p.employer ?? '',
  annualIncome: toStr(p.annualIncome),
  netWorth: toStr(p.netWorth),
  sourceOfWealth: p.sourceOfWealth ?? '',
  purposeOfAccount: p.purposeOfAccount ?? '',
  nricPassport: p.nricPassport ?? '',
  phone: p.phone ?? '',
  email: p.email ?? '',
  address: p.address ?? '',
  registrationNumber: p.registrationNumber ?? '',
  industry: p.industry ?? '',
});

// ── Component ─────────────────────────────────────────────────────────────

const EditBorrowerModal: React.FC<EditBorrowerModalProps> = ({
  profile,
  isOpen,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<FormState>(formStateFromProfile(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset form when profile changes or modal reopens
  useEffect(() => {
    if (isOpen) {
      setForm(formStateFromProfile(profile));
      setError(null);
      setFieldErrors({});
    }
  }, [profile, isOpen]);

  const set = (field: keyof FormState, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setFieldErrors(prev => { if (prev[field]) { const n = { ...prev }; delete n[field]; return n; } return prev; });
  };

  const isCrmLinked = !!(profile.accountId || profile.contactId);

  // Build a dirty-check payload — only send changed fields
  const buildPayload = (): Record<string, any> => {
    const original = formStateFromProfile(profile);
    const payload: Record<string, any> = {};

    const stringFields: (keyof FormState)[] = [
      'name', 'borrowerType', 'creditRiskRating', 'amlRiskTier',
      'exposureLimit', 'occupation', 'employer', 'annualIncome',
      'netWorth', 'sourceOfWealth', 'purposeOfAccount',
      // Phase 3: Identity fields
      'nricPassport', 'phone', 'email', 'address',
      'registrationNumber', 'industry',
    ];
    const booleanFields: (keyof FormState)[] = ['isActive', 'isSanctionedEntity'];

    for (const field of stringFields) {
      if (form[field] !== original[field]) {
        // For enum fields, empty string means null
        if (['creditRiskRating', 'amlRiskTier'].includes(field)) {
          payload[field] = form[field] === '' ? null : form[field];
        }
        // For decimal fields, empty string means null
        else if (['exposureLimit', 'annualIncome', 'netWorth'].includes(field)) {
          payload[field] = form[field] === '' ? null : form[field];
        } else {
          payload[field] = form[field] === '' ? null : form[field];
        }
      }
    }

    for (const field of booleanFields) {
      if (form[field] !== original[field]) {
        payload[field] = form[field];
      }
    }

    return payload;
  };

  // ── Phase 6: Inline validation ──
  const validate = (): string | null => {
    const errs: Record<string, string> = {};
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Invalid email format';
    }
    if (form.nricPassport && form.nricPassport.length < 5) {
      errs.nricPassport = 'NRIC / Passport too short';
    }
    if (form.phone && form.phone.replace(/[\s\-+()]/g, '').length < 6) {
      errs.phone = 'Phone number too short';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      return Object.values(errs)[0];
    }
    return null;
  };

  const handleSubmit = async () => {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    const payload = buildPayload();

    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await creditService.updateBorrowerProfile(profile.id, payload);
      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all';
  const errorInputCls = 'w-full px-3 py-2 border border-red-400 rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-red-300 bg-red-50/50 transition-all';
  const labelCls = 'block text-xs font-bold text-text-primary mb-1';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Borrower Profile"
      size="lg"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon="save" loading={saving} onClick={handleSubmit}>
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-cwc-md text-xs text-red-700 font-semibold">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </div>
        )}

        {/* ── Identity ── */}
        <div className="flex flex-col gap-3 p-4 bg-surface-subtle rounded-cwc-md border border-cwc-border">
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">Identity</p>

          <div>
            <label className={labelCls}>
              {isCrmLinked ? 'Display Name' : 'Full / Company Name'}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder={isCrmLinked ? 'Managed by CRM' : 'e.g. Ahmad bin Abdullah'}
              className={inputCls}
              disabled={isCrmLinked}
            />
            {isCrmLinked && (
              <p className="text-[11px] text-text-tertiary mt-1">Name is managed by the linked CRM account</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Borrower Type</label>
            <Combobox
              options={BORROWER_TYPE_OPTIONS}
              value={form.borrowerType}
              onChange={v => set('borrowerType', v)}
              placeholder="Select type..."
              searchable={false}
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div>
              <label className="text-xs font-bold text-text-primary">Active</label>
              <p className="text-[11px] text-text-tertiary mt-0.5">Deactivate to suspend this borrower profile</p>
            </div>
            <button
              type="button"
              onClick={() => set('isActive', !form.isActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                form.isActive ? 'bg-brand-700' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* ── Phase 3: Contact & Identity Fields ── */}
          {/* Retail/Individual identity fields */}
          {(form.borrowerType === 'INDIVIDUAL' || form.borrowerType === 'JOINT') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 mt-2 border-t border-cwc-border">
              <div>
                <label className={labelCls}>NRIC / Passport</label>
                <input
                  type="text"
                  value={form.nricPassport}
                  onChange={e => set('nricPassport', e.target.value)}
                  placeholder="e.g. 901234-14-5678"
                  className={fieldErrors.nricPassport ? errorInputCls : inputCls}
                />
                {fieldErrors.nricPassport && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.nricPassport}</p>}
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="e.g. +60 12-345 6789"
                  className={fieldErrors.phone ? errorInputCls : inputCls}
                />
                {fieldErrors.phone && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.phone}</p>}
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="e.g. ahmad@example.com"
                  className={fieldErrors.email ? errorInputCls : inputCls}
                />
                {fieldErrors.email && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.email}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Address</label>
                <textarea
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="Residential address"
                  className={inputCls}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Corporate/SME identity fields */}
          {(form.borrowerType === 'CORPORATE' || form.borrowerType === 'SOLE_PROPRIETOR') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 mt-2 border-t border-cwc-border">
              <div>
                <label className={labelCls}>Registration Number</label>
                <input
                  type="text"
                  value={form.registrationNumber}
                  onChange={e => set('registrationNumber', e.target.value)}
                  placeholder="e.g. 202001234567 (1234567-A)"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Industry / Sector</label>
                <input
                  type="text"
                  value={form.industry}
                  onChange={e => set('industry', e.target.value)}
                  placeholder="e.g. Technology, Manufacturing"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  placeholder="e.g. +60 3-1234 5678"
                  className={fieldErrors.phone ? errorInputCls : inputCls}
                />
                {fieldErrors.phone && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.phone}</p>}
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="e.g. contact@company.com"
                  className={fieldErrors.email ? errorInputCls : inputCls}
                />
                {fieldErrors.email && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.email}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Registered Address</label>
                <textarea
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                  placeholder="Registered business address"
                  className={inputCls}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Credit Risk ── */}
        <div className="flex flex-col gap-3 p-4 bg-surface-subtle rounded-cwc-md border border-cwc-border">
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">Credit Risk</p>

          <div>
            <label className={labelCls}>Risk Rating</label>
            <Combobox
              options={RISK_RATING_OPTIONS}
              value={form.creditRiskRating}
              onChange={v => set('creditRiskRating', v === form.creditRiskRating ? '' : v)}
              placeholder="Not rated"
              clearable
              searchable
            />
          </div>

          <div>
            <label className={labelCls}>AML Tier</label>
            <Combobox
              options={AML_TIER_OPTIONS}
              value={form.amlRiskTier}
              onChange={v => set('amlRiskTier', v === form.amlRiskTier ? '' : v)}
              placeholder="Not assessed"
              clearable
              searchable
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <label className="text-xs font-bold text-text-primary">Sanctioned Entity</label>
            <button
              type="button"
              onClick={() => set('isSanctionedEntity', !form.isSanctionedEntity)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-300 ${
                form.isSanctionedEntity ? 'bg-red-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.isSanctionedEntity ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className={labelCls}>Exposure Limit (RM)</label>
            <input
              type="number"
              value={form.exposureLimit}
              onChange={e => set('exposureLimit', e.target.value)}
              placeholder="e.g. 500000"
              className={inputCls}
            />
          </div>
        </div>

        {/* ── Business Information ── */}
        <div className="flex flex-col gap-3 p-4 bg-surface-subtle rounded-cwc-md border border-cwc-border">
          <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">Business Information</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Occupation</label>
              <input
                type="text"
                value={form.occupation}
                onChange={e => set('occupation', e.target.value)}
                placeholder="e.g. Software Engineer"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Employer</label>
              <input
                type="text"
                value={form.employer}
                onChange={e => set('employer', e.target.value)}
                placeholder="e.g. TechCorp Sdn Bhd"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Annual Income (RM)</label>
              <input
                type="number"
                value={form.annualIncome}
                onChange={e => set('annualIncome', e.target.value)}
                placeholder="e.g. 120000"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Net Worth (RM)</label>
              <input
                type="number"
                value={form.netWorth}
                onChange={e => set('netWorth', e.target.value)}
                placeholder="e.g. 500000"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Source of Wealth</label>
            <input
              type="text"
              value={form.sourceOfWealth}
              onChange={e => set('sourceOfWealth', e.target.value)}
              placeholder="e.g. Employment income, Investment returns"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Purpose of Account</label>
            <input
              type="text"
              value={form.purposeOfAccount}
              onChange={e => set('purposeOfAccount', e.target.value)}
              placeholder="e.g. Personal savings, Business overdraft facility"
              className={inputCls}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default EditBorrowerModal;