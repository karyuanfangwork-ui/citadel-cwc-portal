import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as approvalService from '../../services/approval.service';
import { useModalDismiss } from '../../hooks/useModalDismiss';
import ModalPortal from '../ModalPortal';

const DOC_TYPE_CONFIG = [
  { value: 'RESUME', label: 'Resume', icon: 'description', color: 'blue', bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-700', hover: 'hover:border-blue-400' },
  { value: 'CERTIFICATE', label: 'Certificate', icon: 'workspace_premium', color: 'amber', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', hover: 'hover:border-amber-400' },
  { value: 'TRANSCRIPT', label: 'Transcript', icon: 'school', color: 'emerald', bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', hover: 'hover:border-emerald-400' },
] as const;

type DocTypeValue = 'RESUME' | 'CERTIFICATE' | 'TRANSCRIPT';

interface BatchUploadModalProps {
  requestId: string;
  onSuccess: () => void;
  onClose: () => void;
  existingCandidates?: approvalService.Candidate[];
  /** Pre-selected candidate ID (when adding docs to existing candidate) */
  preselectedCandidateId?: string;
}

const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
  requestId,
  onSuccess,
  onClose,
  existingCandidates = [],
  preselectedCandidateId,
}) => {
  const [nameMode, setNameMode] = useState<'select' | 'new'>(
    preselectedCandidateId ? 'select' : existingCandidates.length > 0 ? 'select' : 'new'
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState(preselectedCandidateId || '');
  const [candidateName, setCandidateName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Files keyed by doc type
  const [files, setFiles] = useState<Record<DocTypeValue, File | null>>({
    RESUME: null,
    CERTIFICATE: null,
    TRANSCRIPT: null,
  });

  // Drag-over state per zone
  const [dragOverSlot, setDragOverSlot] = useState<DocTypeValue | null>(null);

  const fileInputRefs = useRef<Record<DocTypeValue, HTMLInputElement | null>>({
    RESUME: null,
    CERTIFICATE: null,
    TRANSCRIPT: null,
  });

  const { handleBackdropClick } = useModalDismiss(onClose);

  // Compute readiness
  const allFilesAttached = Object.values(files).every(f => f !== null);
  const attachedCount = Object.values(files).filter(f => f !== null).length;
  const resolvedCandidateId = nameMode === 'select' ? selectedCandidateId : undefined;
  const resolvedCandidateName = nameMode === 'new' ? candidateName.trim() : undefined;
  const isValid = (resolvedCandidateId || resolvedCandidateName) && allFilesAttached;

  // Get the selected candidate to check which doc types already exist
  const selectedCandidate = nameMode === 'select'
    ? existingCandidates.find(c => c.id === selectedCandidateId)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      setSubmitting(true);
      setError(null);

      const filesToUpload = DOC_TYPE_CONFIG
        .map(dt => ({ docType: dt.value, file: files[dt.value]! }))
        .filter(f => f.file !== null);

      await approvalService.batchUploadDocs(
        requestId,
        filesToUpload.map(f => ({ file: f.file, documentType: f.docType })),
        resolvedCandidateName || 'Unnamed Candidate',
        resolvedCandidateId,
        notes || undefined,
      );

      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to upload documents';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent, docType: DocTypeValue) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, [docType]: file }));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, docType: DocTypeValue) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSlot(docType);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSlot(null);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={handleBackdropClick}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center gap-3 p-5 border-b border-gray-100">
            <div className="size-9 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600">upload_file</span>
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900">Upload Candidate Documents</h2>
              <p className="text-xs text-gray-500">HR Workflow · Submit all required documents for a candidate</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-5">
              {/* Candidate Name Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                  Candidate Name <span className="text-red-500">*</span>
                </label>
                {existingCandidates.length > 0 && (
                  <div className="flex gap-1 mb-2">
                    <button
                      type="button"
                      onClick={() => { setNameMode('select'); if (!selectedCandidateId) setSelectedCandidateId(existingCandidates[0].id); }}
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
                {nameMode === 'select' && existingCandidates.length > 0 ? (
                  <select
                    required
                    value={selectedCandidateId}
                    onChange={e => setSelectedCandidateId(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#0052cc] bg-white"
                  >
                    <option value="">-- Select a candidate --</option>
                    {existingCandidates.map(c => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
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

              {/* Required Documents — 3 zone grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Required Documents ({attachedCount}/3)
                  </label>
                  {attachedCount < 3 && (
                    <span className="text-xs text-amber-600 font-medium">
                      All 3 documents required to proceed
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {DOC_TYPE_CONFIG.map(dt => {
                    const file = files[dt.value];
                    const existingDoc = selectedCandidate?.documents.find(d => d.documentType === dt.value);
                    const hasExisting = !!existingDoc;
                    const isDragOver = dragOverSlot === dt.value;

                    return (
                      <div key={dt.value} className="flex flex-col">
                        {/* Type label */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className={`material-symbols-outlined text-sm ${dt.text}`}>{dt.icon}</span>
                          <span className="text-xs font-semibold text-gray-700">{dt.label}</span>
                          {hasExisting && (
                            <span className="text-[10px] text-amber-600 font-medium ml-auto">Already uploaded</span>
                          )}
                        </div>

                        {/* Drop zone */}
                        {file ? (
                          <div className={`flex items-center gap-2 px-3 py-3 ${dt.bg} border ${dt.border} rounded-lg`}>
                            <span className={`material-symbols-outlined text-lg ${dt.text}`}>check_circle</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${dt.text} truncate`}>{file.name}</p>
                              <p className="text-[10px] text-gray-500">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFiles(prev => ({ ...prev, [dt.value]: null }))}
                              className={`${dt.text} hover:text-red-500 transition-colors`}
                            >
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                          </div>
                        ) : (
                          <label
                            className={`flex flex-col items-center justify-center gap-1.5 px-3 py-5 border-2 border-dashed rounded-lg transition-all cursor-pointer ${
                              isDragOver
                                ? `${dt.border} ${dt.bg} ${dt.text}`
                                : `border-gray-200 bg-white text-gray-400 ${dt.hover}`
                            }`}
                            onDrop={e => handleDrop(e, dt.value)}
                            onDragOver={e => handleDragOver(e, dt.value)}
                            onDragLeave={handleDragLeave}
                          >
                            <span className={`material-symbols-outlined text-2xl ${isDragOver ? dt.text : ''}`}>
                              {isDragOver ? 'download' : 'cloud_upload'}
                            </span>
                            <span className={`text-xs ${isDragOver ? dt.text : ''}`}>
                              {isDragOver ? 'Drop here' : 'Drop or click'}
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              onChange={e => {
                                const f = e.target.files?.[0] || null;
                                if (f) setFiles(prev => ({ ...prev, [dt.value]: f }));
                              }}
                              className="hidden"
                              ref={el => { fileInputRefs.current[dt.value] = el; }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
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

              {/* Completeness warning */}
              {attachedCount < 3 && (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">warning</span>
                  Upload all 3 document types before routing to hiring manager
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isValid || submitting}
                className="px-4 py-3 text-sm font-bold text-white bg-[#0052cc] rounded-lg hover:bg-[#003d99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? 'Uploading...'
                  : `Upload ${attachedCount} Document${attachedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default BatchUploadModal;