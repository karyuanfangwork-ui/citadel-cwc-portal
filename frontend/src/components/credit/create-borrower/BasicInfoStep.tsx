import React, { useState } from 'react';
import creditService from '../../../services/credit.service';
import crmService from '../../../services/crm.service';

type BorrowerType = 'INDIVIDUAL' | 'CORPORATE' | 'SOLE_PROPRIETOR';

export interface FormData {
  borrowerType: BorrowerType;
  name: string;
  ssm: string;
  nric: string;
  dateOfBirth: string;
  dateOfIncorporation: string;
  businessNature: string;
  industrySector: string;
  estimatedAnnualRevenue: string;
  accountId: string | null;
  contactId: string | null;
  originatorNotes: string;
}

export const initialFormData = (): FormData => ({
  borrowerType: 'CORPORATE',
  name: '',
  ssm: '',
  nric: '',
  dateOfBirth: '',
  dateOfIncorporation: '',
  businessNature: '',
  industrySector: '',
  estimatedAnnualRevenue: '',
  accountId: null,
  contactId: null,
  originatorNotes: '',
});

interface CrmSearchResult {
  id: string;
  name: string;
  sub: string;
}

const INDUSTRY_OPTIONS = [
  { value: '', label: 'Select industry...' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'RETAIL_TRADE', label: 'Retail Trade' },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'TECHNOLOGY', label: 'Technology' },
  { value: 'FINANCIAL_SERVICES', label: 'Financial Services' },
  { value: 'WHOLESALE_TRADE', label: 'Wholesale Trade' },
  { value: 'TRANSPORTATION', label: 'Transportation & Storage' },
  { value: 'ACCOMMODATION', label: 'Accommodation & Food Services' },
  { value: 'PROFESSIONAL_SERVICES', label: 'Professional Services' },
  { value: 'OTHER_SERVICES', label: 'Other Services' },
];

const SEGMENT_TAGS: Record<BorrowerType, string> = {
  INDIVIDUAL: 'Retail Fields Loaded',
  SOLE_PROPRIETOR: 'SME Fields Loaded',
  CORPORATE: 'Corporate Fields Loaded',
};

interface BasicInfoStepProps {
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
  duplicateStatus: 'idle' | 'checking' | 'clear' | 'duplicate';
  duplicateBorrowerId: string | null;
  onDuplicateCheck: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  border: '1px solid var(--cr-outline-variant, #c6c6cd)',
  borderRadius: 'var(--cr-radius, 0.25rem)',
  padding: '0 12px',
  fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
  fontSize: 'var(--cr-text-body-sm, 13px)',
  color: 'var(--cr-on-surface, #191c1e)',
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
  fontSize: 'var(--cr-text-label-md, 12px)',
  fontWeight: 600,
  letterSpacing: 'var(--cr-tracking-label, 0.05em)',
  color: 'var(--cr-on-surface-variant, #45464d)',
  marginBottom: 4,
};

const sectionCardStyle: React.CSSProperties = {
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  border: '1px solid var(--cr-outline-variant, #c6c6cd)',
  borderRadius: 'var(--cr-radius-lg, 0.5rem)',
  padding: 24,
};

const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  formData,
  onFormDataChange,
  duplicateStatus,
  duplicateBorrowerId,
  onDuplicateCheck,
}) => {
  const isIndividual = formData.borrowerType === 'INDIVIDUAL';
  const isCorporateType = formData.borrowerType === 'CORPORATE' || formData.borrowerType === 'SOLE_PROPRIETOR';

  // ── CRM search state ──
  const [crmSearch, setCrmSearch] = useState('');
  const [crmResults, setCrmResults] = useState<CrmSearchResult[]>([]);
  const [selectedCrm, setSelectedCrm] = useState<CrmSearchResult | null>(null);
  const [crmSearching, setCrmSearching] = useState(false);
  const [crmMode, setCrmMode] = useState<'search' | 'create' | 'skip' | null>(null);

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

  const handleCreateCrmInline = async () => {
    try {
      if (isIndividual) {
        const nameParts = formData.name.trim().split(/\s+/);
        const contact = await crmService.createContact({
          firstName: nameParts[0] || formData.name,
          lastName: nameParts.slice(1).join(' ') || '',
          nricPassport: formData.nric || undefined,
          dateOfBirth: formData.dateOfBirth || undefined,
        } as any);
        const result = { id: contact.id, name: formData.name, sub: formData.nric };
        setSelectedCrm(result);
        setCrmSearch(formData.name);
        onFormDataChange({ contactId: contact.id, accountId: null });
      } else {
        const account = await crmService.createAccount({
          name: formData.name,
          registrationNumber: formData.ssm || undefined,
        } as any);
        const result = { id: account.id, name: formData.name, sub: formData.ssm };
        setSelectedCrm(result);
        setCrmSearch(formData.name);
        onFormDataChange({ accountId: account.id, contactId: null });
      }
    } catch {
      // Error shown inline
    }
  };

  const handleSelectCrm = (r: CrmSearchResult) => {
    setSelectedCrm(r);
    setCrmResults([]);
    setCrmSearch(r.name);
    if (isIndividual) {
      onFormDataChange({ contactId: r.id, accountId: null });
    } else {
      onFormDataChange({ accountId: r.id, contactId: null });
    }
  };

  const handleSkipCrm = () => {
    setCrmMode('skip');
    setSelectedCrm(null);
    setCrmResults([]);
    onFormDataChange({ accountId: null, contactId: null });
  };

  return (
    <div>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2
            style={{
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-headline-md, 20px)',
              fontWeight: 600,
              color: 'var(--cr-on-surface, #191c1e)',
              margin: 0,
            }}
          >
            Basic Information
          </h2>
          <p style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)', margin: '4px 0 0' }}>
            Enter the core identity details for this borrower profile.
          </p>
        </div>
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 9999,
            fontSize: 'var(--cr-text-label-sm, 11px)',
            fontWeight: 600,
            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
            backgroundColor: 'var(--cr-secondary-container, #316bf3)',
            color: 'var(--cr-on-secondary-container, #ffffff)',
          }}
        >
          {SEGMENT_TAGS[formData.borrowerType]}
        </span>
      </div>

      {/* ── Identity Section ── */}
      <div style={sectionCardStyle}>
        <div
          style={{
            fontSize: 'var(--cr-text-label-sm, 11px)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--cr-on-surface-variant, #45464d)',
            marginBottom: 16,
          }}
        >
          {isIndividual ? 'Personal Identity' : 'Company Identity'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Name — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              {isIndividual ? 'Full Name' : 'Company Name'} <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={e => onFormDataChange({ name: e.target.value })}
              placeholder={isIndividual ? 'e.g. Ahmad bin Abdullah' : 'e.g. Citadel Holdings Sdn Bhd'}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* SSM (Corporate/SoleProp) */}
          {isCorporateType && (
            <>
              <div>
                <label style={labelStyle}>
                  Registration Number (SSM) <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.ssm}
                  onChange={e => { onFormDataChange({ ssm: e.target.value }); }}
                  placeholder="e.g. 202301012345"
                  style={{
                    ...inputStyle,
                    ...(duplicateStatus === 'duplicate' ? { borderColor: 'var(--cr-error, #ba1a1a)', boxShadow: '0 0 0 1px var(--cr-error, #ba1a1a)' } : {}),
                  }}
                  onFocus={e => { if (duplicateStatus !== 'duplicate') { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}}
                  onBlur={e => { if (duplicateStatus !== 'duplicate') { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; } onDuplicateCheck(); }}
                />
                <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)', marginTop: 4 }}>
                  Checked for duplicates when you leave this field
                </div>
              </div>
              <div>
                <label style={labelStyle}>Date of Incorporation</label>
                <input
                  type="date"
                  value={formData.dateOfIncorporation}
                  onChange={e => onFormDataChange({ dateOfIncorporation: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </>
          )}

          {/* NRIC (Individual) */}
          {isIndividual && (
            <>
              <div>
                <label style={labelStyle}>
                  NRIC / Passport No. <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.nric}
                  onChange={e => onFormDataChange({ nric: e.target.value })}
                  placeholder="e.g. 901231-14-5678"
                  style={{
                    ...inputStyle,
                    ...(duplicateStatus === 'duplicate' ? { borderColor: 'var(--cr-error, #ba1a1a)', boxShadow: '0 0 0 1px var(--cr-error, #ba1a1a)' } : {}),
                  }}
                  onFocus={e => { if (duplicateStatus !== 'duplicate') { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}}
                  onBlur={e => { if (duplicateStatus !== 'duplicate') { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; } onDuplicateCheck(); }}
                />
                <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)', marginTop: 4 }}>
                  Checked for duplicates when you leave this field
                </div>
              </div>
              <div>
                <label style={labelStyle}>
                  Date of Birth <span style={{ color: 'var(--cr-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={e => onFormDataChange({ dateOfBirth: e.target.value })}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </>
          )}
        </div>

        {/* Duplicate check feedback */}
        {duplicateStatus === 'checking' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>
            Checking for duplicates…
          </div>
        )}
        {duplicateStatus === 'clear' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
            padding: '8px 12px', borderRadius: 'var(--cr-radius, 0.25rem)',
            backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0',
            fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: '#16a34a',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
            No duplicate found — you may proceed.
          </div>
        )}
        {duplicateStatus === 'duplicate' && duplicateBorrowerId && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12,
            padding: '12px', borderRadius: 'var(--cr-radius, 0.25rem)',
            backgroundColor: '#fffbeb', border: '1px solid #fbbf24',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#d97706', marginTop: 1 }}>warning</span>
            <div>
              <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: '#92400e' }}>
                A borrower with this {isIndividual ? 'NRIC' : 'SSM'} already exists.
              </div>
              <a
                href={`/credit/borrowers/${duplicateBorrowerId}`}
                style={{ fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 600, color: '#0051d5', textDecoration: 'underline' }}
              >
                View Existing Borrower →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Business Details Section ── */}
      <div style={{ ...sectionCardStyle, marginTop: 20 }}>
        <div
          style={{
            fontSize: 'var(--cr-text-label-sm, 11px)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--cr-on-surface-variant, #45464d)',
            marginBottom: 16,
          }}
        >
          Business Details
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
          {/* Business Nature — full width */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Business Nature / Description</label>
            <textarea
              value={formData.businessNature}
              onChange={e => onFormDataChange({ businessNature: e.target.value })}
              placeholder="Brief description of the business activities..."
              rows={3}
              style={{
                ...inputStyle,
                height: 'auto',
                padding: '8px 12px',
                resize: 'vertical',
                minHeight: 72,
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Industry Sector */}
          <div>
            <label style={labelStyle}>Industry Sector</label>
            <select
              value={formData.industrySector}
              onChange={e => onFormDataChange({ industrySector: e.target.value })}
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {INDUSTRY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Estimated Annual Revenue */}
          <div>
            <label style={labelStyle}>Estimated Annual Revenue</label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 'var(--cr-text-body-sm, 13px)',
                  color: 'var(--cr-outline, #76777d)',
                  pointerEvents: 'none',
                }}
              >
                RM
              </span>
              <input
                type="text"
                value={formData.estimatedAnnualRevenue}
                onChange={e => onFormDataChange({ estimatedAnnualRevenue: e.target.value })}
                placeholder="e.g. 5,000,000"
                style={{ ...inputStyle, paddingLeft: 36 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── CRM Link Section ── */}
      <div style={{ ...sectionCardStyle, marginTop: 20 }}>
        <div
          style={{
            fontSize: 'var(--cr-text-label-sm, 11px)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--cr-on-surface-variant, #45464d)',
            marginBottom: 16,
          }}
        >
          CRM Account Link <span style={{ textTransform: 'none', fontWeight: 400, letterSpacing: 'normal' }}>(optional)</span>
        </div>

        {selectedCrm ? (
          /* ── CRM selected state ── */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--cr-radius, 0.25rem)',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--cr-radius, 0.25rem)',
                backgroundColor: 'var(--cr-secondary, #0051d5)',
                color: 'var(--cr-on-secondary, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
                fontWeight: 800,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              {selectedCrm.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--cr-text-body-md, 14px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>
                {selectedCrm.name}
              </div>
              {selectedCrm.sub && (
                <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
                  {selectedCrm.sub}
                </div>
              )}
            </div>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 9999,
                fontSize: 'var(--cr-text-label-sm, 11px)',
                fontWeight: 600,
                backgroundColor: 'var(--cr-secondary, #0051d5)',
                color: 'var(--cr-on-secondary, #ffffff)',
              }}
            >
              Linked
            </span>
            <button
              onClick={() => { setSelectedCrm(null); setCrmSearch(''); setCrmMode(null); onFormDataChange({ accountId: null, contactId: null }); }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--cr-on-surface-variant, #45464d)',
                padding: 4,
              }}
              title="Remove CRM link"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        ) : crmMode === 'skip' ? (
          /* ── Skip state ── */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius, 0.25rem)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--cr-outline, #76777d)' }}>schedule</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>
                CRM linking skipped
              </div>
              <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
                You can link a CRM record later from the borrower profile.
              </div>
            </div>
            <button
              onClick={() => setCrmMode(null)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--cr-secondary, #0051d5)',
                fontSize: 'var(--cr-text-label-md, 12px)',
                fontWeight: 600,
              }}
            >
              Change
            </button>
          </div>
        ) : (
          /* ── CRM selection options ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Search input */}
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--cr-outline, #76777d)', pointerEvents: 'none' }}>
                search
              </span>
              <input
                type="text"
                value={crmSearch}
                onChange={e => handleCrmSearch(e.target.value)}
                placeholder={`Search by name${isCorporateType ? ' or SSM' : ' or NRIC'}…`}
                style={{ ...inputStyle, paddingLeft: 34 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--cr-secondary, #0051d5)'; e.currentTarget.style.boxShadow = '0 0 0 1px var(--cr-secondary, #0051d5)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--cr-outline-variant, #c6c6cd)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              {crmSearching && (
                <span className="material-symbols-outlined" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, animation: 'spin 1s linear infinite', color: 'var(--cr-outline, #76777d)' }}>
                  progress_activity
                </span>
              )}
            </div>

            {/* Search results */}
            {crmResults.length > 0 && (
              <div
                style={{
                  border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                  borderRadius: 'var(--cr-radius, 0.25rem)',
                  overflow: 'hidden',
                }}
              >
                {crmResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleSelectCrm(r)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 12px',
                      backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
                      border: 'none',
                      borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container, #eceef0)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container-lowest, #ffffff)'; }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 'var(--cr-radius, 0.25rem)',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 11,
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {r.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>{r.name}</div>
                      {r.sub && <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>{r.sub}</div>}
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--cr-outline, #76777d)' }}>chevron_right</span>
                  </button>
                ))}
              </div>
            )}

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)', fontWeight: 600 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--cr-outline-variant, #c6c6cd)' }} />or<div style={{ flex: 1, height: 1, backgroundColor: 'var(--cr-outline-variant, #c6c6cd)' }} />
            </div>

            {/* Create CRM inline */}
            <button
              onClick={handleCreateCrmInline}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                backgroundColor: 'transparent',
                border: '1.5px dashed #93c5fd',
                borderRadius: 'var(--cr-radius, 0.25rem)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background-color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#2563eb'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#93c5fd'; }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--cr-radius, 0.25rem)',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {isIndividual ? 'person_add' : 'add_business'}
                </span>
              </div>
              <div>
                <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: '#2563eb' }}>
                  Create new CRM {isIndividual ? 'Contact' : 'Account'}
                </div>
                <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
                  Pre-filled from form — no re-entry needed
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--cr-outline, #76777d)', marginLeft: 'auto' }}>chevron_right</span>
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)', fontWeight: 600 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: 'var(--cr-outline-variant, #c6c6cd)' }} />or<div style={{ flex: 1, height: 1, backgroundColor: 'var(--cr-outline-variant, #c6c6cd)' }} />
            </div>

            {/* Skip */}
            <button
              onClick={handleSkipCrm}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                backgroundColor: 'transparent',
                border: '1.5px dashed var(--cr-outline-variant, #c6c6cd)',
                borderRadius: 'var(--cr-radius, 0.25rem)',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--cr-surface-container, #eceef0)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--cr-radius, 0.25rem)',
                backgroundColor: 'var(--cr-surface-container, #eceef0)',
                color: 'var(--cr-on-surface-variant, #45464d)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>schedule</span>
              </div>
              <div>
                <div style={{ fontSize: 'var(--cr-text-body-sm, 13px)', fontWeight: 600, color: 'var(--cr-on-surface-variant, #45464d)' }}>
                  Skip for now — link CRM later
                </div>
                <div style={{ fontSize: 'var(--cr-text-label-sm, 11px)', color: 'var(--cr-outline, #76777d)' }}>
                  A reminder will appear on the profile until linked
                </div>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--cr-outline, #76777d)', marginLeft: 'auto' }}>chevron_right</span>
            </button>
          </div>
        )}
      </div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default BasicInfoStep;