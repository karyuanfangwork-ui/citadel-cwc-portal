import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import creditService, {
  CreditApplication,
  CreditApplicationParty,
  BorrowerProfile,
} from '../../../src/services/credit.service';
import { useAuth } from '../../../src/context/AuthContext';
import { hasPermission } from '../../../src/utils/permissions';
import toast from 'react-hot-toast';
import { friendlyMessage } from '../../../src/utils/errorMessages';
import EmptyState from '../../../src/components/EmptyState';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import NewBorrowerWizard from '../../../src/components/credit/NewBorrowerWizard';

interface PartiesTabProps {
  app: CreditApplication;
  borrowerType?: string | null;
}

const PartiesTab: React.FC<PartiesTabProps> = ({ app, borrowerType }) => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canWrite = hasPermission(user, 'credit:write');

  const [parties, setParties] = useState<CreditApplicationParty[]>([]);
  const [showPartyForm, setShowPartyForm] = useState(false);
  const [partyForm, setPartyForm] = useState<{ borrowerProfileId: string; role: string; liabilityPct: string }>({ borrowerProfileId: '', role: 'guarantor', liabilityPct: '' });
  const [borrowerProfiles, setBorrowerProfiles] = useState<BorrowerProfile[]>([]);
  const [savingParty, setSavingParty] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showNewBorrower, setShowNewBorrower] = useState(false);

  const validatePartyForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!partyForm.borrowerProfileId) {
      newErrors.borrowerProfileId = 'Borrower profile is required';
    }
    if (!partyForm.role) {
      newErrors.role = 'Role is required';
    }
    if (partyForm.liabilityPct !== '') {
      const num = parseFloat(partyForm.liabilityPct);
      if (isNaN(num) || num < 0 || num > 100) {
        newErrors.liabilityPct = 'Liability % must be between 0 and 100';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchParties = useCallback(async () => {
    if (!id) return;
    try {
      const data = await creditService.listParties(id);
      setParties(data);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load parties')); }
  }, [id]);

  const fetchBorrowerProfiles = useCallback(async () => {
    try {
      const result = await creditService.listBorrowerProfiles({ limit: 200 });
      setBorrowerProfiles(result.profiles);
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to load borrower profiles')); }
  }, []);

  useEffect(() => { fetchParties(); }, [fetchParties]);
  useEffect(() => { if (showPartyForm) fetchBorrowerProfiles(); }, [showPartyForm, fetchBorrowerProfiles]);

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePartyForm()) return;
    if (!id) return;
    try {
      setSavingParty(true);
      await creditService.createParty(id, {
        borrowerProfileId: partyForm.borrowerProfileId,
        role: partyForm.role,
        liabilityPct: partyForm.liabilityPct || null,
      });
      toast.success('Party added');
      setShowPartyForm(false);
      setPartyForm({ borrowerProfileId: '', role: 'guarantor', liabilityPct: '' });
      setErrors({});
      fetchParties();
    } catch (e) { console.error(e); toast.error(friendlyMessage(e, 'Failed to add party')); }
    finally { setSavingParty(false); }
  };

  return (
    <>
      {(borrowerType === 'INDIVIDUAL' || borrowerType === 'SOLE_PROPRIETOR') && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <span className="material-symbols-outlined text-blue-500 text-xl mt-0.5 shrink-0">info</span>
          <p>For individual borrowers, Directors and Shareholders do not apply. Use this section to add <strong>guarantors</strong>, <strong>co-borrowers</strong>, or <strong>sponsors</strong> linked to this application.</p>
        </div>
      )}
      <CaMemoSection title="Parties" phase="Phase 2" readOnly={!canWrite} actions={canWrite ? (
        <button onClick={() => setShowPartyForm(true)} className="flex items-center gap-1.5 bg-brand-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors" style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <span className="material-symbols-outlined text-base">person_add</span> Add Party
        </button>
      ) : undefined}>
        {parties.length === 0 ? (
          <EmptyState
            icon="group"
            title="No Parties"
            description="Add guarantors, co-borrowers, or related parties."
            actionLabel="Add Party"
            onAction={() => setShowPartyForm(true)}
          />
        ) : (
          <div className="space-y-3">
            {parties.map(p => {
              const displayName = p.borrowerProfile?.name || 'Unknown';
              const initials = p.borrowerProfile?.name?.slice(0, 2).toUpperCase() ?? '?';
              const roleLabel = p.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) ?? 'Party';
              return (
                <div key={p.id} className="flex items-center gap-4 bg-bg-surface border border-border rounded-xl p-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-text-primary text-sm">{displayName}</p>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">{roleLabel}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {p.borrowerProfile?.borrowerType && `${p.borrowerProfile.borrowerType} · `}
                      {p.liabilityPct != null && `Liability: ${p.liabilityPct}%`}
                    </p>
                  </div>
                  <Link to={`/credit/borrowers/${p.borrowerProfileId}`} className="text-brand-700 hover:underline text-sm font-semibold" style={{ textDecoration: 'none' }}>
                    View Profile
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </CaMemoSection>

      {/* Party Form Modal */}
      {showPartyForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowPartyForm(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Party</h2>
            <form onSubmit={handleCreateParty} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Role *</label>
                <select required value={partyForm.role} onChange={e => { setPartyForm(f => ({ ...f, role: e.target.value })); setErrors(errs => { const { role: _, ...rest } = errs; return rest; }); }}
                  className={`w-full border ${errors.role ? 'border-red-500' : 'border-border'} rounded-lg px-3 py-2 text-sm`} style={{ fontFamily: 'var(--font-sans)' }}>
                  {['borrower', 'guarantor', 'co_borrower', 'sponsor'].map(r => <option key={r} value={r}>{r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
                {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Borrower Profile *</label>
                <div className="flex gap-2 items-start">
                  <select required value={partyForm.borrowerProfileId} onChange={e => { setPartyForm(f => ({ ...f, borrowerProfileId: e.target.value })); setErrors(errs => { const { borrowerProfileId: _, ...rest } = errs; return rest; }); }}
                    className={`flex-1 border ${errors.borrowerProfileId ? 'border-red-500' : 'border-border'} rounded-lg px-3 py-2 text-sm`} style={{ fontFamily: 'var(--font-sans)' }}>
                    <option value="">Select a borrower...</option>
                    {borrowerProfiles.map(bp => {
                      const name = bp.name || (bp.contact ? `${bp.contact.firstName} ${bp.contact.lastName}` : (bp.account?.name ?? bp.id));
                      return <option key={bp.id} value={bp.id}>{name} ({bp.borrowerType})</option>;
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewBorrower(true)}
                    className="shrink-0 flex items-center gap-1 px-3 py-2 border border-border rounded-lg text-sm font-semibold text-text-secondary hover:bg-surface-muted transition-colors bg-surface cursor-pointer font-sans"
                    title="Create new borrower"
                  >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    New
                  </button>
                </div>
                {errors.borrowerProfileId && <p className="text-red-500 text-xs mt-1">{errors.borrowerProfileId}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Liability %</label>
                <input type="number" min="0" max="100" step="0.01" value={partyForm.liabilityPct} onChange={e => { setPartyForm(f => ({ ...f, liabilityPct: e.target.value })); setErrors(errs => { const { liabilityPct: _, ...rest } = errs; return rest; }); }}
                  className={`w-full border ${errors.liabilityPct ? 'border-red-500' : 'border-border'} rounded-lg px-3 py-2 text-sm`} style={{ background: '#fff' }} placeholder="e.g. 100" />
                {errors.liabilityPct && <p className="text-red-500 text-xs mt-1">{errors.liabilityPct}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPartyForm(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingParty}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingParty ? 'Saving...' : 'Add Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <NewBorrowerWizard
        isOpen={showNewBorrower}
        onClose={() => setShowNewBorrower(false)}
        navigateAfterCreate={false}
        onCreated={(borrowerId) => {
          setShowNewBorrower(false);
          setPartyForm(f => ({ ...f, borrowerProfileId: borrowerId }));
          fetchBorrowerProfiles();
        }}
      />
    </>
  );
};

export default PartiesTab;