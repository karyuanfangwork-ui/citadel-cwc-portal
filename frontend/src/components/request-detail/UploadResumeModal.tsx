import React, { useState } from 'react';
import * as approvalService from '../../services/approval.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

const DOC_TYPES = [
  { value: 'RESUME', label: 'Resume', icon: 'description', color: 'blue' },
  { value: 'CERTIFICATE', label: 'Certificates', icon: 'workspace_premium', color: 'amber' },
  { value: 'TRANSCRIPT', label: 'Transcripts', icon: 'school', color: 'emerald' },
] as const;

interface UploadResumeModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
  existingCandidateNames?: string[];
}

const UploadResumeModal: React.FC<UploadResumeModalProps> = ({ requestId, onSuccess, onClose, existingCandidateNames = [] }) => {
  const [file, setFile] = useState<File | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [selectedExisting, setSelectedExisting] = useState('');
  const [nameMode, setNameMode] = useState<'select' | 'new'>(
    existingCandidateNames.length > 0 ? 'select' : 'new'
  );
  const [documentType, setDocumentType] = useState('RESUME');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleBackdropClick } = useModalDismiss(onClose);

  const resolvedCandidateName = nameMode === 'select' ? selectedExisting : candidateName.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      setSubmitting(true);
      setError(null);
      await approvalService.uploadResume(requestId, file, resolvedCandidateName, notes || undefined, documentType);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDocType = DOC_TYPES.find(d => d.value === documentType)!;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-green-600">upload_file</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Upload Candidate Document</h2>
              <p className="text-xs text-gray-500">HR Workflow · Upload resume, certificates, or transcripts</p>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              {/* Document Type Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DOC_TYPES.map(dt => (
                    <button
                      key={dt.value}
                      type="button"
                      onClick={() => setDocumentType(dt.value)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                        documentType === dt.value
                          ? dt.color === 'blue' ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : dt.color === 'amber' ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xl">{dt.icon}</span>
                      <span className="text-xs font-semibold">{dt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Candidate Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Candidate Name <span className="text-red-500">*</span>
                </label>
                {existingCandidateNames.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => { setNameMode('select'); setSelectedExisting(existingCandidateNames[0]); }}
                      className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        nameMode === 'select'
                          ? 'bg-[#0052cc] text-white border-[#0052cc]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      Existing Candidate
                    </button>
                    <button
                      type="button"
                      onClick={() => { setNameMode('new'); setCandidateName(''); }}
                      className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        nameMode === 'new'
                          ? 'bg-[#0052cc] text-white border-[#0052cc]'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      New Candidate
                    </button>
                  </div>
                )}
                {nameMode === 'select' && existingCandidateNames.length > 0 ? (
                  <select
                    required
                    value={selectedExisting}
                    onChange={e => setSelectedExisting(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] bg-white"
                  >
                    <option value="">-- Select a candidate --</option>
                    {existingCandidateNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={candidateName}
                    onChange={e => setCandidateName(e.target.value)}
                    placeholder="e.g., John Doe"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc]"
                  />
                )}
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  {selectedDocType.label} File (PDF, DOC, DOCX, PNG, JPG) <span className="text-red-500">*</span>
                </label>
                {file ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                    <span className="material-symbols-outlined text-green-600 text-lg">check_circle</span>
                    <span className="text-sm font-medium text-green-800 flex-1 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-green-600 hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 px-3 py-4 bg-white border-2 border-dashed border-gray-300 rounded-lg hover:border-[#0052cc] hover:bg-blue-50/30 transition-all cursor-pointer group">
                    <span className="material-symbols-outlined text-xl text-gray-400 group-hover:text-[#0052cc]">cloud_upload</span>
                    <span className="text-sm text-gray-500 group-hover:text-[#0052cc]">Click to select {selectedDocType.label.toLowerCase()}</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      required
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="font-normal normal-case text-gray-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button type="button" onClick={onClose} className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || !resolvedCandidateName || submitting}
                className="px-4 py-3 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? 'Uploading…' : `Upload ${selectedDocType.label}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default UploadResumeModal;