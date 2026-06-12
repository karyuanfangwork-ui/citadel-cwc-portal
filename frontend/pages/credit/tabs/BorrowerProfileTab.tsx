import React, { useEffect, useState } from 'react';
import creditService, { CreditApplication, fatcaCrsApi, FatcaCrsDeclaration, FatcaEntityClassification, CrsResidency } from '../../../src/services/credit.service';
import { useAuth } from '../../../src/context/AuthContext';
import { formatDate } from '../creditUtils';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

const ENTITY_CLASSIFICATIONS: { value: FatcaEntityClassification; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'ACTIVE_NFE', label: 'Active NFE (Non-Financial Entity)' },
  { value: 'PASSIVE_NFE', label: 'Passive NFE (Non-Financial Entity)' },
  { value: 'FINANCIAL_INSTITUTION', label: 'Financial Institution' },
];

// ── FATCA/CRS Declaration — §3.4 ───────────────────────────────────────────
function FatcaCrsSection({ borrowerProfileId, onDeclarationLoaded }: { borrowerProfileId: string; onDeclarationLoaded?: (d: FatcaCrsDeclaration | null) => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [declaration, setDeclaration] = useState<FatcaCrsDeclaration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isUsPerson, setIsUsPerson] = useState(false);
  const [usTin, setUsTin] = useState('');
  const [classification, setClassification] = useState<FatcaEntityClassification>('INDIVIDUAL');
  const [residencies, setResidencies] = useState<CrsResidency[]>([{ country: '', tin: '' }]);
  const [declarationDate, setDeclarationDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const load = () => {
    setLoading(true);
    fatcaCrsApi.get(borrowerProfileId)
      .then((d) => {
        setDeclaration(d);
        onDeclarationLoaded?.(d);
        if (d) {
          setIsUsPerson(d.isUsPerson);
          setUsTin(d.usTin ?? '');
          setClassification(d.entityClassification);
          setResidencies(d.crsResidencies?.length ? d.crsResidencies : [{ country: '', tin: '' }]);
          setDeclarationDate(d.declarationDate?.slice(0, 10) ?? '');
          setExpiryDate(d.expiryDate?.slice(0, 10) ?? '');
        }
      })
      .catch(() => setError('Failed to load FATCA/CRS declaration'))
      .finally(() => setLoading(false));
  };

  // §8.2 — Load declaration eagerly (not just on open) to check mandatory status
  useEffect(() => {
    if (loading === true && declaration === null) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateResidency = (idx: number, field: keyof CrsResidency, value: string) => {
    setResidencies((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };
  const addResidency = () => setResidencies((rows) => [...rows, { country: '', tin: '' }]);
  const removeResidency = (idx: number) => setResidencies((rows) => rows.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = await fatcaCrsApi.upsert(borrowerProfileId, {
        declarationDate: declarationDate || new Date().toISOString().slice(0, 10),
        isUsPerson,
        usTin: isUsPerson ? usTin : null,
        entityClassification: classification,
        crsResidencies: residencies.filter((r) => r.country.trim()),
        expiryDate: expiryDate || null,
      });
      setDeclaration(saved);
      onDeclarationLoaded?.(saved);
    } catch {
      setError('Failed to save FATCA/CRS declaration');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const verified = await fatcaCrsApi.verify(borrowerProfileId);
      setDeclaration(verified);
      onDeclarationLoaded?.(verified);
    } catch {
      setError('Verification failed — verifier must differ from the self-certifying officer');
    } finally {
      setVerifying(false);
    }
  };

  const isExpired = declaration?.expiryDate ? new Date(declaration.expiryDate).getTime() < Date.now() : false;
  const canVerify = !!declaration && !declaration.verifiedAt && declaration.selfCertifiedById !== user?.id;

  return (
    <CaMemoSection title="FATCA/CRS Declaration" phase="S2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
      >
        <span className="material-symbols-outlined text-base">{open ? 'expand_less' : 'expand_more'}</span>
        {open ? 'Hide declaration' : 'Show / edit declaration'}
        {declaration?.verifiedAt && <span className="ml-2 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Verified</span>}
        {declaration && !declaration.verifiedAt && <span className="ml-2 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Pending verification</span>}
        {isExpired && <span className="ml-2 text-xs text-red-700 bg-red-50 px-2 py-0.5 rounded-full">Expired</span>}
        {!declaration && !loading && open && <span className="ml-2 text-xs text-gray-500">No declaration on file</span>}
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Is US Person</label>
              <select
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
                value={isUsPerson ? 'yes' : 'no'}
                onChange={(e) => setIsUsPerson(e.target.value === 'yes')}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            {isUsPerson && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">US TIN</label>
                <input
                  type="text"
                  className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
                  value={usTin}
                  onChange={(e) => setUsTin(e.target.value)}
                  placeholder="xxx-xx-xxxx"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Entity Classification</label>
              <select
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
                value={classification}
                onChange={(e) => setClassification(e.target.value as FatcaEntityClassification)}
              >
                {ENTITY_CLASSIFICATIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Declaration Date</label>
              <input
                type="date"
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
                value={declarationDate}
                onChange={(e) => setDeclarationDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Expiry Date</label>
              <input
                type="date"
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-500">CRS Tax Residencies</label>
              <button type="button" onClick={addResidency} className="text-xs text-blue-700 hover:text-blue-900 font-semibold">
                + Add country
              </button>
            </div>
            <div className="space-y-2">
              {residencies.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    className="flex-1 text-sm rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="Country (e.g. US)"
                    value={row.country}
                    onChange={(e) => updateResidency(idx, 'country', e.target.value)}
                  />
                  <input
                    type="text"
                    className="flex-1 text-sm rounded-lg border border-gray-300 px-3 py-2"
                    placeholder="TIN"
                    value={row.tin ?? ''}
                    onChange={(e) => updateResidency(idx, 'tin', e.target.value)}
                  />
                  {residencies.length > 1 && (
                    <button type="button" onClick={() => removeResidency(idx)} className="text-gray-400 hover:text-red-600">
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {declaration && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 space-y-1">
              <div>
                Self-certified by: {declaration.selfCertifiedBy ? `${declaration.selfCertifiedBy.firstName} ${declaration.selfCertifiedBy.lastName}` : '—'}
              </div>
              <div>
                Verified: {declaration.verifiedAt
                  ? `${declaration.verifiedBy ? `${declaration.verifiedBy.firstName} ${declaration.verifiedBy.lastName} — ` : ''}${formatDate(declaration.verifiedAt)}`
                  : 'Not yet verified — requires sign-off by a second officer'}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg px-4 py-2"
            >
              {saving ? 'Saving…' : declaration ? 'Save Declaration' : 'Submit Declaration'}
            </button>
            {canVerify && (
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying}
                className="text-sm font-semibold text-blue-700 border border-blue-200 hover:bg-blue-50 disabled:opacity-50 rounded-lg px-4 py-2"
              >
                {verifying ? 'Verifying…' : 'Verify (second officer)'}
              </button>
            )}
          </div>
        </div>
      )}
    </CaMemoSection>
  );
}

// S2 · Borrower Profile — Identity summary + KYC snapshot.
// Directors/UBOs/Shareholders are on the "Parties" sub-tab.

type Props = {
  application: CreditApplication;
  onUpdated?: (next: CreditApplication) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** §8.2 — Callback to signal whether FATCA/CRS is complete */
  onFatcaComplete?: (complete: boolean) => void;
  /** P2-1: Whether the credit:fatca_crs feature flag is enabled */
  fatcaCrsEnabled?: boolean;
};

const BorrowerProfileTab: React.FC<Props> = ({ application, onFatcaComplete, fatcaCrsEnabled = false }) => {
  const bp = application.borrowerProfile;
  const account = bp?.account;
  const contact = bp?.contact;
  const isIndividual = bp?.borrowerType === 'INDIVIDUAL';
  const isCorporate = bp?.borrowerType === 'CORPORATE' || bp?.borrowerType === 'SOLE_PROPRIETOR';

  // §8.2 — Track FATCA/CRS declaration status
  const [fatcaDeclaration, setFatcaDeclaration] = useState<FatcaCrsDeclaration | null>(null);
  const fatcaIsComplete = isIndividual || (!!fatcaDeclaration?.verifiedAt || !!fatcaDeclaration?.selfCertifiedById);
  useEffect(() => { onFatcaComplete?.(fatcaIsComplete); }, [fatcaIsComplete, onFatcaComplete]);

  return (
    <div className="space-y-6">
      {/* ── Identity ──────────────────────────── */}
      <CaMemoSection title="Borrower Identity" phase="S2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Borrower Type</label>
            <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {isIndividual ? 'Individual' : 'Corporate'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Name</label>
            <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {isIndividual
                ? (contact ? `${contact.firstName} ${contact.lastName}` : '—')
                : (account?.name || '—')}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Credit Risk Rating</label>
            <div className="text-sm font-semibold text-gray-900 bg-gray-50 rounded-lg px-3 py-2">
              {bp?.creditRiskRating || 'Not rated'}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Borrower ID</label>
            <div className="text-sm font-mono text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              {bp?.id?.slice(0, 8) || '—'}
            </div>
          </div>
        </div>
      </CaMemoSection>

      {/* ── KYC / AML ──────────────────────────── */}
      <CaMemoSection title="KYC & AML" phase="S2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">AML Risk Tier</div>
            <div className="text-sm font-bold text-gray-900">{bp?.amlRiskTier || '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Sanctioned Entity</div>
            <div className="text-sm font-bold">
              {bp?.isSanctionedEntity ? (
                <span className="text-red-700 bg-red-50 px-2 py-0.5 rounded">Yes — Flagged</span>
              ) : (
                <span className="text-green-700">No</span>
              )}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Source of Wealth</div>
            <div className="text-sm font-bold text-gray-900">{bp?.sourceOfWealth || '—'}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">Connected Party</div>
            <div className="text-sm font-bold">
              {application.connectedPartyFlag ? (
                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded">Yes</span>
              ) : (
                <span className="text-green-700">No</span>
              )}
            </div>
          </div>
        </div>

        {bp?.occupation && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 mb-1">Occupation</div>
              <div className="text-sm font-bold text-gray-900">{bp.occupation}</div>
            </div>
            {bp.employer && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Employer</div>
                <div className="text-sm font-bold text-gray-900">{bp.employer}</div>
              </div>
            )}
            {bp.annualIncome != null && (
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs font-semibold text-gray-500 mb-1">Annual Income</div>
                <div className="text-sm font-bold text-gray-900">{Number(bp.annualIncome).toLocaleString('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 })}</div>
              </div>
            )}
          </div>
        )}
      </CaMemoSection>

      {/* ── FATCA/CRS Declaration (P2-1: gated by credit:fatca_crs feature flag) ─── */}
      {fatcaCrsEnabled && isCorporate && !fatcaIsComplete && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-600">warning</span>
          <span className="text-sm font-semibold text-red-800">
            FATCA/CRS declaration is mandatory for corporate borrowers before proceeding.
          </span>
        </div>
      )}
      {fatcaCrsEnabled && bp?.id && <FatcaCrsSection borrowerProfileId={bp.id} onDeclarationLoaded={setFatcaDeclaration} />}
    </div>
  );
};

export default BorrowerProfileTab;