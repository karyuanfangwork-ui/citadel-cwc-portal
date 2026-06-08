import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../ui/Modal';
import { Button } from '../ui/Button';
import creditService, { CreateBorrowerProfilePayload, DuplicateMatch } from '../../services/credit.service';
import crmService from '../../services/crm.service';

// ── Types ────────────────────────────────────────────────────────────────────

type BorrowerType = 'CORPORATE' | 'INDIVIDUAL' | 'SOLE_PROPRIETOR';

interface Step1Data {
  borrowerType: BorrowerType;
  name: string;          // Company Name (Corporate/Sole Prop) or Full Name (Individual)
  ssm: string;           // Corporate / Sole Prop only
  nric: string;          // Individual only
  dateOfBirth: string;   // Individual only
}

interface CrmSearchResult {
  id: string;
  name: string;
  sub: string; // e.g. "SSM 202301012345 · KL"
}

export interface NewBorrowerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful creation with the new borrower ID */
  onCreated?: (borrowerId: string) => void;
  /** If true, navigates to the new borrower profile page after creation */
  navigateAfterCreate?: boolean;
}

// ── Helper ───────────────────────────────────────────────────────────────────

const initials = (name: string) => {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
};

// ── Component ─────────────────────────────────────────────────────────────────

const NewBorrowerWizard: React.FC<NewBorrowerWizardProps> = ({
  isOpen,
  onClose,
  onCreated,
  navigateAfterCreate = true,
}) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [s1, setS1] = useState<Step1Data>({
    borrowerType: 'CORPORATE', name: '', ssm: '', nric: '', dateOfBirth: '',
  });
  const [dupCheck, setDupCheck] = useState<'idle' | 'checking' | 'clear' | 'duplicate'>('idle');
  const [dupBorrowerId, setDupBorrowerId] = useState<string | null>(null);

  // Step 2 state
  const [crmSearch, setCrmSearch] = useState('');
  const [crmResults, setCrmResults] = useState<CrmSearchResult[]>([]);
  const [selectedCrm, setSelectedCrm] = useState<CrmSearchResult | null>(null);
  const [crmSearching, setCrmSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // §2.3 — 409 conflict handling
  const [duplicateConflict, setDuplicateConflict] = useState<DuplicateMatch[]>([]);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const isIndividual = s1.borrowerType === 'INDIVIDUAL';
  const isCorporateType = s1.borrowerType === 'CORPORATE' || s1.borrowerType === 'SOLE_PROPRIETOR';

  // ── Duplicate check ────────────────────────────────────────────────────────

  const runDuplicateCheck = async () => {
    const identifier = isIndividual ? s1.nric : s1.ssm;
    if (!identifier) return;
    setDupCheck('checking');
    try {
      const result = await creditService.checkDuplicateBorrower(
        isIndividual ? { nric: identifier } : { ssm: identifier }
      );
      if (result.exists && result.borrowerId) {
        setDupCheck('duplicate');
        setDupBorrowerId(result.borrowerId);
      } else {
        setDupCheck('clear');
        setDupBorrowerId(null);
      }
    } catch {
      setDupCheck('idle');
    }
  };

  // ── CRM typeahead ──────────────────────────────────────────────────────────

  const handleCrmSearch = async (q: string) => {
    setCrmSearch(q);
    setSelectedCrm(null);
    if (q.length < 2) { setCrmResults([]); return; }
    setCrmSearching(true);
    try {
      if (isIndividual) {
        const data = await crmService.listContacts({ search: q, limit: 5 });
        setCrmResults((data.contacts as any[]).map(c => ({
          id: c.id,
          name: `${c.firstName} ${c.lastName}`.trim(),
          sub: [c.nricPassport, c.jobTitle].filter(Boolean).join(' · '),
        })));
      } else {
        const data = await crmService.listAccounts({ search: q, limit: 5 });
        setCrmResults(data.accounts.map(a => ({
          id: a.id,
          name: a.name,
          sub: [a.industry].filter(Boolean).join(' · '),
        })));
      }
    } catch {
      setCrmResults([]);
    } finally {
      setCrmSearching(false);
    }
  };

  // ── Create CRM inline ──────────────────────────────────────────────────────

  const handleCreateCrmInline = async () => {
    try {
      if (isIndividual) {
        const nameParts = s1.name.trim().split(/\s+/);
        const contact = await crmService.createContact({
          firstName: nameParts[0] || s1.name,
          lastName: nameParts.slice(1).join(' ') || '',
          nricPassport: s1.nric || undefined,
          dateOfBirth: s1.dateOfBirth || undefined,
        } as any);
        setSelectedCrm({ id: contact.id, name: s1.name, sub: s1.nric });
      } else {
        const account = await crmService.createAccount({
          name: s1.name,
          registrationNumber: s1.ssm || undefined,
        } as any);
        setSelectedCrm({ id: account.id, name: s1.name, sub: s1.ssm });
      }
    } catch {
      setError('Failed to create CRM record. Please try again.');
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (overrideDuplicate = false) => {
    setError(null);
    setSaving(true);
    try {
      const payload: CreateBorrowerProfilePayload = {
        borrowerType: s1.borrowerType,
        name: s1.name,
        accountId: (isCorporateType && selectedCrm) ? selectedCrm.id : null,
        contactId: (isIndividual && selectedCrm) ? selectedCrm.id : null,
        ...(overrideDuplicate && { overrideDuplicate: true }),
      };
      const profile = await creditService.createBorrowerProfile(payload);
      onCreated?.(profile.id);
      if (navigateAfterCreate) {
        navigate(`/credit/borrowers/${profile.id}`);
      }
      handleClose();
    } catch (e: any) {
      if (e?.response?.status === 409) {
        // Duplicate detected — show conflict modal
        const conflicts: DuplicateMatch[] = e?.response?.data?.data?.duplicates ?? e?.response?.data?.data ?? [];
        setDuplicateConflict(Array.isArray(conflicts) ? conflicts : []);
        setShowConflictModal(true);
        return;
      }
      setError(e?.response?.data?.message || 'Failed to create borrower. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Close / reset ──────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep(1);
    setS1({ borrowerType: 'CORPORATE', name: '', ssm: '', nric: '', dateOfBirth: '' });
    setDupCheck('idle');
    setDupBorrowerId(null);
    setCrmSearch('');
    setCrmResults([]);
    setSelectedCrm(null);
    setError(null);
    setDuplicateConflict([]);
    setShowConflictModal(false);
    onClose();
  };

  // ── Step 1 validation ──────────────────────────────────────────────────────

  const step1Valid = () => {
    if (!s1.name.trim()) return false;
    if (isCorporateType && !s1.ssm.trim()) return false;
    if (isIndividual && (!s1.nric.trim() || !s1.dateOfBirth)) return false;
    return dupCheck === 'clear';
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const TYPE_BTNS: { value: BorrowerType; icon: string; label: string }[] = [
    { value: 'CORPORATE', icon: 'business', label: 'Corporate' },
    { value: 'INDIVIDUAL', icon: 'person', label: 'Individual' },
    { value: 'SOLE_PROPRIETOR', icon: 'storefront', label: 'Sole Prop' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="New Borrower Profile"
      size="lg"
      footer={
        step === 1 ? (
          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button
              variant="primary"
              icon="arrow_forward"
              iconPosition="right"
              disabled={!step1Valid()}
              onClick={() => setStep(2)}
            >
              Next
            </Button>
          </div>
        ) : (
          <div className="flex justify-between">
            <Button variant="ghost" icon="arrow_back" onClick={() => setStep(1)}>Back</Button>
            <Button
              variant="primary"
              icon="person_add"
              loading={saving}
              onClick={() => handleSubmit()}
            >
              Create Borrower
            </Button>
          </div>
        )
      }
    >
      {/* ── Stepper ── */}
      <div className="mb-5">
        <div className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step > 1 ? 'bg-green-600 text-white' : 'bg-brand-700 text-white'}`}>
            {step > 1 ? <span className="material-symbols-outlined text-sm">check</span> : '1'}
          </div>
          <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-brand-700' : 'bg-border'}`} />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${step === 2 ? 'bg-brand-700 text-white' : 'bg-surface-muted text-text-tertiary border border-cwc-border'}`}>
            2
          </div>
        </div>
        <div className="flex justify-between mt-1.5">
          <span className={`text-[11px] font-semibold ${step === 1 ? 'text-brand-700' : 'text-green-600'}`}>Identity</span>
          <span className={`text-[11px] font-semibold ${step === 2 ? 'text-brand-700' : 'text-text-tertiary'}`}>CRM Link</span>
        </div>
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          {/* Type toggle */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1.5">Borrower Type <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              {TYPE_BTNS.map(btn => (
                <button
                  key={btn.value}
                  type="button"
                  onClick={() => { setS1(p => ({ ...p, borrowerType: btn.value })); setDupCheck('idle'); }}
                  className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-cwc-md border-[1.5px] transition-colors cursor-pointer font-sans ${
                    s1.borrowerType === btn.value
                      ? 'border-brand-700 bg-brand-50 text-brand-700'
                      : 'border-cwc-border bg-surface text-text-secondary hover:bg-surface-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">{btn.icon}</span>
                  <span className="text-xs font-bold">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Identity fields */}
          <div className="flex flex-col gap-3 p-4 bg-surface-subtle rounded-cwc-md border border-cwc-border">
            <p className="text-[11px] font-bold text-text-tertiary uppercase tracking-wide">
              {isIndividual ? 'Personal Identity' : 'Company Identity'}
            </p>

            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-text-primary mb-1">
                {isIndividual ? 'Full Name' : 'Company Name'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={s1.name}
                onChange={e => setS1(p => ({ ...p, name: e.target.value }))}
                placeholder={isIndividual ? 'e.g. Ahmad bin Abdullah' : 'e.g. Citadel Holdings Sdn Bhd'}
                className="w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all"
              />
            </div>

            {/* SSM (Corporate / Sole Prop) */}
            {isCorporateType && (
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">SSM Registration No. <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={s1.ssm}
                  onChange={e => { setS1(p => ({ ...p, ssm: e.target.value })); setDupCheck('idle'); }}
                  onBlur={runDuplicateCheck}
                  placeholder="e.g. 202301012345"
                  className={`w-full px-3 py-2 border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all ${
                    dupCheck === 'duplicate' ? 'border-red-400 ring-2 ring-red-100' : 'border-cwc-border'
                  }`}
                />
                <p className="text-[11px] text-text-tertiary mt-1">Checked for duplicates when you leave this field</p>
              </div>
            )}

            {/* NRIC (Individual) */}
            {isIndividual && (
              <>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">NRIC / Passport No. <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={s1.nric}
                    onChange={e => { setS1(p => ({ ...p, nric: e.target.value })); setDupCheck('idle'); }}
                    onBlur={runDuplicateCheck}
                    placeholder="e.g. 901231-14-5678"
                    className={`w-full px-3 py-2 border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all ${
                      dupCheck === 'duplicate' ? 'border-red-400 ring-2 ring-red-100' : 'border-cwc-border'
                    }`}
                  />
                  <p className="text-[11px] text-text-tertiary mt-1">Checked for duplicates when you leave this field</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-primary mb-1">Date of Birth <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={s1.dateOfBirth}
                    onChange={e => setS1(p => ({ ...p, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all"
                  />
                </div>
              </>
            )}
          </div>

          {/* Duplicate check feedback */}
          {dupCheck === 'checking' && (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              Checking for duplicates…
            </div>
          )}
          {dupCheck === 'clear' && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-cwc-md text-xs text-green-700 font-semibold">
              <span className="material-symbols-outlined text-base">check_circle</span>
              No duplicate found — you may proceed.
            </div>
          )}
          {dupCheck === 'duplicate' && dupBorrowerId && (
            <div className="flex flex-col gap-2 px-3 py-3 bg-amber-50 border border-amber-300 rounded-cwc-md">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base mt-0.5">warning</span>
                <div className="text-xs font-semibold text-amber-800">A borrower with this {isIndividual ? 'NRIC' : 'SSM'} already exists. Duplicate profiles are not allowed.</div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon="open_in_new"
                onClick={() => { handleClose(); navigate(`/credit/borrowers/${dupBorrowerId}`); }}
              >
                View Existing Borrower
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {/* Identity chip */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-brand-50 border border-brand-100 rounded-cwc-md">
            <div className="w-9 h-9 rounded-lg bg-brand-700 text-white text-xs font-black flex items-center justify-center shrink-0">
              {initials(s1.name)}
            </div>
            <div>
              <div className="text-sm font-bold text-brand-900">{s1.name}</div>
              <div className="text-xs text-brand-600">{s1.borrowerType.replace(/_/g, ' ')} {isCorporateType && s1.ssm ? `· SSM ${s1.ssm}` : ''}{isIndividual && s1.nric ? `· ${s1.nric}` : ''}</div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="ml-auto text-xs font-semibold text-brand-700 hover:text-brand-900 flex items-center gap-0.5 bg-none border-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">edit</span> Edit
            </button>
          </div>

          <p className="text-xs font-bold text-text-secondary uppercase tracking-wide">
            Link to CRM <span className="normal-case font-normal text-text-tertiary">(optional)</span>
          </p>

          {/* CRM search */}
          <div>
            <label className="block text-xs font-bold text-text-primary mb-1">Search existing CRM {isIndividual ? 'Contact' : 'Account'}</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary text-lg pointer-events-none">search</span>
              <input
                type="text"
                value={crmSearch}
                onChange={e => handleCrmSearch(e.target.value)}
                placeholder={`Search by name${isCorporateType ? ' or SSM' : ' or NRIC'}…`}
                className="w-full pl-9 pr-3 py-2 border border-cwc-border rounded-cwc-md text-sm outline-none focus:ring-2 focus:ring-brand-300 bg-surface transition-all"
              />
            </div>
            {crmSearching && <p className="text-xs text-text-tertiary mt-1">Searching…</p>}
            {crmResults.length > 0 && (
              <div className="border border-cwc-border rounded-cwc-md mt-1 overflow-hidden shadow-cwc-lg">
                {crmResults.map(r => (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedCrm(r); setCrmResults([]); setCrmSearch(r.name); }}
                    className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer border-b border-cwc-border last:border-0 transition-colors ${selectedCrm?.id === r.id ? 'bg-brand-50' : 'hover:bg-surface-subtle'}`}
                  >
                    <div className="w-7 h-7 rounded-md bg-brand-50 text-brand-700 text-[11px] font-black flex items-center justify-center shrink-0">{initials(r.name)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary truncate">{r.name}</div>
                      {r.sub && <div className="text-xs text-text-tertiary">{r.sub}</div>}
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${selectedCrm?.id === r.id ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700'}`}>
                      {selectedCrm?.id === r.id ? '✓ Selected' : 'Select'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 text-xs text-text-tertiary font-semibold">
            <div className="flex-1 h-px bg-border" />or<div className="flex-1 h-px bg-border" />
          </div>

          {/* Create CRM inline */}
          <button
            type="button"
            onClick={handleCreateCrmInline}
            className="flex items-center gap-3 px-3 py-3 border-[1.5px] border-dashed border-brand-300 rounded-cwc-md hover:bg-brand-50 hover:border-brand-700 transition-colors cursor-pointer text-left bg-none font-sans w-full"
          >
            <div className="w-8 h-8 rounded-cwc-md bg-brand-50 text-brand-700 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">{isIndividual ? 'person_add' : 'add_business'}</span>
            </div>
            <div>
              <div className="text-sm font-bold text-brand-700">Create new CRM {isIndividual ? 'Contact' : 'Account'}</div>
              <div className="text-xs text-text-secondary">Pre-filled from Step 1 — no re-entry needed</div>
            </div>
            <span className="material-symbols-outlined text-text-tertiary text-lg ml-auto">chevron_right</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 text-xs text-text-tertiary font-semibold">
            <div className="flex-1 h-px bg-border" />or<div className="flex-1 h-px bg-border" />
          </div>

          {/* Skip */}
          <button
            type="button"
            onClick={() => handleSubmit()}
            className="flex items-center gap-3 px-3 py-3 border-[1.5px] border-dashed border-cwc-border rounded-cwc-md hover:bg-surface-muted transition-colors cursor-pointer text-left bg-none font-sans w-full"
          >
            <div className="w-8 h-8 rounded-cwc-md bg-surface-muted text-text-tertiary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">schedule</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-text-secondary">Skip for now — link CRM later</div>
              <div className="text-xs text-text-tertiary">A reminder will appear on the profile until linked</div>
            </div>
            <span className="material-symbols-outlined text-text-tertiary text-lg ml-auto">chevron_right</span>
          </button>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-cwc-md text-xs text-red-700 font-semibold">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}
        </div>
      )}

      {/* §2.3 — Duplicate Conflict Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowConflictModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-2xl text-amber-500">warning</span>
              <h3 className="text-lg font-bold text-text-primary">Duplicate Borrower Detected</h3>
            </div>
            <p className="text-sm text-text-secondary mb-4">
              The following borrower(s) were found with matching details. Please review before proceeding.
            </p>
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-1.5 text-xs font-bold text-text-secondary uppercase">Name</th>
                    <th className="text-left px-2 py-1.5 text-xs font-bold text-text-secondary uppercase">Type</th>
                    <th className="text-left px-2 py-1.5 text-xs font-bold text-text-secondary uppercase">Match Field</th>
                    <th className="px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {duplicateConflict.map(dup => (
                    <tr key={dup.borrowerId} className="border-b border-border last:border-0">
                      <td className="px-2 py-1.5 font-semibold text-text-primary">{dup.name}</td>
                      <td className="px-2 py-1.5 text-text-secondary">{dup.borrowerType}</td>
                      <td className="px-2 py-1.5 text-text-secondary">{dup.matchField}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Link
                          to={`/credit/borrowers/${dup.borrowerId}`}
                          className="text-brand-700 text-xs font-bold hover:underline"
                          onClick={() => setShowConflictModal(false)}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowConflictModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                icon="verified_user"
                loading={saving}
                onClick={() => {
                  setShowConflictModal(false);
                  handleSubmit(true);
                }}
              >
                Create Anyway (Admin Override)
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default NewBorrowerWizard;