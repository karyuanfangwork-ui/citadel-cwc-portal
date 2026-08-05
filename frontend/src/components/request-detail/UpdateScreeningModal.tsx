import React, { useState, useEffect } from 'react';
import screeningService from '../../services/screening.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

interface UpdateScreeningModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const UpdateScreeningModal: React.FC<UpdateScreeningModalProps> = ({ requestId, onSuccess, onClose }) => {
  const [refStatus, setRefStatus] = useState('PENDING');
  const [refNotes, setRefNotes] = useState('');
  const [refContacted, setRefContacted] = useState('');
  const [overallStatus, setOverallStatus] = useState('IN_PROGRESS');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  useEffect(() => {
    screeningService.getScreeningDetails(requestId).then(data => {
      if (!data) return;
      setRefStatus(data.referencesCheckStatus || 'PENDING');
      setRefNotes(data.referencesCheckNotes || '');
      setRefContacted(Array.isArray(data.referencesContacted) ? data.referencesContacted.join(', ') : '');
      setOverallStatus(data.overallStatus || 'IN_PROGRESS');
    }).catch(() => {});
  }, [requestId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await screeningService.updateScreeningStatus(requestId, {
        backgroundCheckStatus: 'PASSED', // Auto-pass since we removed it from UI
        referencesCheckStatus: refStatus,
        referencesCheckNotes: refNotes || undefined,
        referencesContacted: refContacted ? refContacted.split(',').map(r => r.trim()).filter(Boolean) : [],
        overallStatus,
      } as any);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update reference check status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600">fact_check</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Update Reference Check</h2>
              <p className="text-xs text-gray-500">HR Workflow · Reference Check stage</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Reference Check Status</label>
                <select value={refStatus} onChange={e => setRefStatus(e.target.value)} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]">
                  <option value="PENDING">Pending</option>
                  <option value="PASSED">Passed</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Reference Check Notes</label>
                <textarea value={refNotes} onChange={e => setRefNotes(e.target.value)} rows={2} placeholder="Feedback from references..." className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">References Contacted <span className="font-normal normal-case text-gray-400">(comma separated)</span></label>
                <input type="text" value={refContacted} onChange={e => setRefContacted(e.target.value)} placeholder="e.g. Michael Scott, Jim Halpert" className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Overall Status <span className="text-red-500">*</span></label>
                <select value={overallStatus} onChange={e => setOverallStatus(e.target.value)} required className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]">
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed (Proceed to LOA)</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={submitting} className="px-4 py-3 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {submitting ? 'Updating…' : 'Update Status'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default UpdateScreeningModal;