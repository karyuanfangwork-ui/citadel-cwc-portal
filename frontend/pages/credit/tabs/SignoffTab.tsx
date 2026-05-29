import React, { useEffect, useState } from 'react';
import {
  CreditApplication,
  ApplicationSignoff,
  SignoffRole,
  signoffApi,
} from '../../../src/services/credit.service';
import creditService from '../../../src/services/credit.service';
import { useAuth } from '../../../src/context/AuthContext';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

type Props = { application: CreditApplication; onUpdated: (next: CreditApplication) => void };

const ROLES: { role: SignoffRole; label: string; requires: string | null }[] = [
  { role: 'PREPARED_BY',  label: 'Prepared By',  requires: null },
  { role: 'REVIEWED_BY',  label: 'Reviewed By',  requires: 'Prepared By' },
  { role: 'CONCURRED_BY', label: 'Concurred By', requires: 'Reviewed By' },
];

const formatDT = (s: string) =>
  new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── Sign-off Card ────────────────────────────────────────────────────────────

const SignoffCard: React.FC<{
  role: SignoffRole;
  label: string;
  requires: string | null;
  existing: ApplicationSignoff | undefined;
  isLocked: boolean;
  canSign: boolean;
  canRevoke: boolean;
  onSign: (designation: string) => Promise<void>;
  onRevoke: () => Promise<void>;
}> = ({ label, requires, existing, isLocked, canSign, canRevoke, onSign, onRevoke }) => {
  const [showModal, setShowModal] = useState(false);
  const [designation, setDesignation] = useState('');
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');

  const handleSign = async () => {
    if (!designation.trim()) { setError('Designation is required'); return; }
    setSigning(true);
    setError('');
    try {
      await onSign(designation.trim());
      setShowModal(false);
      setDesignation('');
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message ?? 'Sign-off failed');
    } finally { setSigning(false); }
  };

  return (
    <div className={`border rounded-xl p-5 ${existing ? 'border-green-300 bg-green-50' : isLocked ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-blue-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-gray-800">{label}</p>
          {requires && !existing && <p className="text-xs text-gray-500 mt-0.5">Requires: {requires}</p>}
        </div>
        {existing
          ? <span className="text-[10px] font-bold bg-green-600 text-white px-2 py-0.5 rounded-full">SIGNED</span>
          : <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">PENDING</span>}
      </div>

      {existing ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold">{existing.signedBy ? `${existing.signedBy.firstName} ${existing.signedBy.lastName}` : existing.signedById}</p>
          <p className="text-xs text-gray-500">{existing.designationSnapshot}</p>
          <p className="text-xs text-gray-400">{formatDT(existing.signedAt)}</p>
          {canRevoke && (
            <button onClick={onRevoke} className="mt-2 text-xs text-red-500 hover:text-red-700 underline">Revoke sign-off</button>
          )}
        </div>
      ) : canSign ? (
        <button
          onClick={() => setShowModal(true)}
          className="mt-1 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Sign as {label}
        </button>
      ) : null}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96">
            <h3 className="text-base font-bold mb-4">Confirm Sign-off — {label}</h3>
            <p className="text-xs text-gray-500 mb-3">Enter your designation as it should appear on the CA Memo.</p>
            <input
              className="w-full border rounded px-3 py-2 text-sm mb-3"
              placeholder="e.g. Credit Manager, SME Banking"
              value={designation}
              onChange={e => setDesignation(e.target.value)}
            />
            {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowModal(false); setError(''); }} className="px-4 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSign} disabled={signing} className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {signing ? 'Signing…' : 'Confirm Sign-off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Tab ─────────────────────────────────────────────────────────────────

const SignoffTab: React.FC<Props> = ({ application, onUpdated }) => {
  const { user } = useAuth();
  const [signoffs, setSignoffs] = useState<ApplicationSignoff[]>([]);

  useEffect(() => {
    signoffApi.list(application.id).then(setSignoffs).catch(() => {});
  }, [application.id]);

  const isConcurred = !!application.concurredAt;
  const readOnly = application.state !== 'DRAFT';

  const byRole = (role: SignoffRole) => signoffs.find(s => s.role === role);

  const handleSign = async (role: SignoffRole, designation: string) => {
    const created = await signoffApi.create(application.id, { role, designationSnapshot: designation });
    setSignoffs(ss => [...ss.filter(s => s.role !== role), created]);
    // Refresh application to pick up timestamp
    const updated = await import('../../../src/services/credit.service').then(m =>
      m.default.getApplication(application.id)
    );
    onUpdated(updated);
  };

  const handleRevoke = async (role: SignoffRole) => {
    await signoffApi.revoke(application.id, role);
    setSignoffs(ss => ss.filter(s => s.role !== role));
    const updated = await import('../../../src/services/credit.service').then(m =>
      m.default.getApplication(application.id)
    );
    onUpdated(updated);
  };

  return (
    <CaMemoSection title="Sign-off" phase="Phase 5" readOnly={readOnly}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          {isConcurred && (
            <span className="text-xs font-bold bg-green-600 text-white px-3 py-1 rounded-full">
              CA Memo Fully Signed — {new Date(application.concurredAt!).toLocaleDateString('en-GB')}
            </span>
          )}
          {/* §1.10 — CA Memo Preview */}
          <button
            onClick={async () => {
              try {
                const res = await creditService.downloadCaMemo(application.id);
                const blob = res.data ?? res;
                const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: 'application/pdf' }));
                window.open(url, '_blank');
              } catch (e) { console.error('Failed to generate CA Memo preview', e); }
            }}
            className="flex items-center gap-1.5 bg-brand-700 hover:bg-brand-800 text-white rounded-lg px-4 py-2 text-sm font-bold transition-colors"
          >
            <span className="material-symbols-outlined text-base">description</span>
            Preview CA Memo
          </button>
        </div>

        {isConcurred && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-sm text-green-800">
            All sections are now read-only. The CA Memo has been signed off and locked.
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {ROLES.map(({ role, label, requires }) => {
            const existing = byRole(role);
            const prevSigned = role === 'PREPARED_BY' ? true
              : role === 'REVIEWED_BY' ? !!byRole('PREPARED_BY')
              : !!byRole('REVIEWED_BY');

            const isCurrentUser = existing?.signedById === user?.id;
            const nextSigned = role === 'PREPARED_BY' ? !!byRole('REVIEWED_BY')
              : role === 'REVIEWED_BY' ? !!byRole('CONCURRED_BY')
              : false;

            return (
              <SignoffCard
                key={role}
                role={role}
                label={label}
                requires={requires}
                existing={existing}
                isLocked={!prevSigned && !existing}
                canSign={!existing && prevSigned && !isConcurred}
                canRevoke={!!existing && isCurrentUser && !nextSigned && !isConcurred}
                onSign={designation => handleSign(role, designation)}
                onRevoke={() => handleRevoke(role)}
              />
            );
          })}
        </div>
      </div>
    </CaMemoSection>
  );
};

export default SignoffTab;
