import React, { useState } from 'react';
import creditService, { Director, Shareholder, UltimateBeneficialOwner } from '../../services/credit.service';
import toast from 'react-hot-toast';

export type PartyRole = 'director' | 'shareholder' | 'ubo';

interface PartyFormModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  borrowerProfileId: string;
  role: PartyRole;
}

const ROLE_LABELS: Record<PartyRole, string> = {
  director: 'Director',
  shareholder: 'Shareholder',
  ubo: 'Ultimate Beneficial Owner',
};

const PartyFormModal: React.FC<PartyFormModalProps> = ({ open, onClose, onCreated, borrowerProfileId, role }) => {
  const [name, setName] = useState('');
  const [nricPassport, setNricPassport] = useState('');

  // Director-specific
  const [position, setPosition] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [isExecutive, setIsExecutive] = useState(false);

  // Shareholder-specific
  const [shareholdingPct, setShareholdingPct] = useState('');
  const [shareClass, setShareClass] = useState('');

  // UBO-specific
  const [ownershipPct, setOwnershipPct] = useState('');
  const [isPep, setIsPep] = useState(false);
  const [sourceOfWealth, setSourceOfWealth] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setNricPassport('');
    setPosition('');
    setAppointmentDate('');
    setIsExecutive(false);
    setShareholdingPct('');
    setShareClass('');
    setOwnershipPct('');
    setIsPep(false);
    setSourceOfWealth('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      setError('');

      if (role === 'director') {
        await creditService.createDirector(borrowerProfileId, {
          name: name.trim(),
          nricPassport: nricPassport.trim() || null,
          position: position.trim() || null,
          appointmentDate: appointmentDate || null,
          isExecutive,
        });
      } else if (role === 'shareholder') {
        await creditService.createShareholder(borrowerProfileId, {
          name: name.trim(),
          nricPassport: nricPassport.trim() || null,
          shareholdingPct: shareholdingPct ? parseFloat(shareholdingPct) : null,
          shareClass: shareClass.trim() || null,
        });
      } else if (role === 'ubo') {
        await creditService.createUbo(borrowerProfileId, {
          name: name.trim(),
          nricPassport: nricPassport.trim() || null,
          ownershipPct: ownershipPct ? parseFloat(ownershipPct) : 0,
          isPep,
          sourceOfWealth: sourceOfWealth.trim() || null,
        });
      }

      toast.success(`${ROLE_LABELS[role]} added`);
      resetForm();
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || `Failed to add ${ROLE_LABELS[role]}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  const inputClass = 'w-full border border-[#d0d7de] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0052cc]';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[#101418] mb-4">
          Add {ROLE_LABELS[role]}
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Common: Name */}
          <div>
            <label className="block text-sm font-medium text-[#44546f] mb-1">Full Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Enter full name"
              required
            />
          </div>

          {/* Common: NRIC/Passport */}
          <div>
            <label className="block text-sm font-medium text-[#44546f] mb-1">NRIC / Passport</label>
            <input
              type="text"
              value={nricPassport}
              onChange={(e) => setNricPassport(e.target.value)}
              className={inputClass}
              placeholder="NRIC or passport number"
            />
          </div>

          {/* Director-specific fields */}
          {role === 'director' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#44546f] mb-1">Position</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Managing Director"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#44546f] mb-1">Appointment Date</label>
                <input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isExecutive"
                  checked={isExecutive}
                  onChange={(e) => setIsExecutive(e.target.checked)}
                  className="h-4 w-4 rounded border-[#d0d7de] text-[#0052cc] focus:ring-[#0052cc]"
                />
                <label htmlFor="isExecutive" className="text-sm font-medium text-[#44546f]">Executive Director</label>
              </div>
            </>
          )}

          {/* Shareholder-specific fields */}
          {role === 'shareholder' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#44546f] mb-1">Shareholding %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={shareholdingPct}
                  onChange={(e) => setShareholdingPct(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 25.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#44546f] mb-1">Share Class</label>
                <input
                  type="text"
                  value={shareClass}
                  onChange={(e) => setShareClass(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Ordinary"
                />
              </div>
            </>
          )}

          {/* UBO-specific fields */}
          {role === 'ubo' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[#44546f] mb-1">Ownership % *</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={ownershipPct}
                  onChange={(e) => setOwnershipPct(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 30"
                  required
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPep"
                  checked={isPep}
                  onChange={(e) => setIsPep(e.target.checked)}
                  className="h-4 w-4 rounded border-[#d0d7de] text-[#0052cc] focus:ring-[#0052cc]"
                />
                <label htmlFor="isPep" className="text-sm font-medium text-[#44546f]">Politically Exposed Person (PEP)</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#44546f] mb-1">Source of Wealth</label>
                <input
                  type="text"
                  value={sourceOfWealth}
                  onChange={(e) => setSourceOfWealth(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Business income"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-[#44546f] hover:text-[#101418]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="px-4 py-2 bg-[#0052cc] text-white text-sm font-bold rounded-lg hover:bg-[#0043a8] disabled:opacity-50"
            >
              {submitting ? 'Adding…' : `Add ${ROLE_LABELS[role]}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartyFormModal;