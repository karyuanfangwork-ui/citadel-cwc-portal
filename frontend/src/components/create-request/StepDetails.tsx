import React from 'react';
import apiClient from '../../services/api';
import { type FormData, URGENCY_OPTIONS } from './useCreateRequestWizard';

interface StepDetailsProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  selectedRequestType: any;
  entityOptions: { code: string; name: string }[];
  uploadingFields: Record<string, boolean>;
  setUploadingFields: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isRoleBlocked: boolean;
  deskType: string;
  submitting: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  handleCustomFieldChange: (fieldId: string, value: string) => void;
  autoSummary?: string;
  isAutoSummary?: boolean;
  isAutoConfidential?: boolean;
}

const commonClass = "w-full px-4 py-3 bg-white border border-cwc-border rounded-cwc-md text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-700 outline-none transition-all placeholder:text-text-tertiary";

const StepDetails: React.FC<StepDetailsProps> = ({
  formData,
  setFormData,
  selectedRequestType,
  entityOptions,
  uploadingFields,
  setUploadingFields,
  isRoleBlocked,
  deskType,
  submitting,
  error,
  setError,
  handleCustomFieldChange,
  autoSummary,
  isAutoSummary,
  isAutoConfidential,
}) => {

  const renderDynamicField = (field: any) => {
    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            required={field.required}
            rows={4}
            className={`${commonClass} resize-none`}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            value={formData.customFields[field.id] || ''}
            onChange={e => handleCustomFieldChange(field.id, e.target.value)}
            disabled={submitting}
          />
        );
      case 'date':
        return (
          <input
            required={field.required}
            type="date"
            className={commonClass}
            value={formData.customFields[field.id] || ''}
            onChange={e => handleCustomFieldChange(field.id, e.target.value)}
            disabled={submitting}
          />
        );
      case 'number':
        return (
          <input
            required={field.required}
            type="number"
            className={commonClass}
            placeholder="0"
            value={formData.customFields[field.id] || ''}
            onChange={e => handleCustomFieldChange(field.id, e.target.value)}
            disabled={submitting}
          />
        );
      case 'currency':
        return (
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-medium">
              RM
            </span>
            <input
              required={field.required}
              type="number"
              step="0.01"
              min="0"
              className={`${commonClass} pl-14`}
              placeholder="0.00"
              value={formData.customFields[field.id] || ''}
              onChange={e => {
                handleCustomFieldChange(field.id, e.target.value);
              }}
              onBlur={e => {
                const value = e.target.value;
                if (value && !isNaN(parseFloat(value))) {
                  handleCustomFieldChange(field.id, parseFloat(value).toFixed(2));
                }
              }}
              disabled={submitting}
            />
          </div>
        );
      case 'file': {
        const fieldValue = formData.customFields[field.id];
        const displayName = fieldValue?.fileName || fieldValue || null;
        const isUploading = uploadingFields[field.id];
        return (
          <div className="relative">
            <input
              required={field.required && !fieldValue}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
              id={`file-${field.id}`}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploadingFields(prev => ({ ...prev, [field.id]: true }));
                try {
                  const fd = new FormData();
                  fd.append('file', file);
                  const res = await apiClient.post('/files/upload', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                  });
                  handleCustomFieldChange(field.id, res.data.data);
                } catch {
                  setError('File upload failed. Please try again.');
                } finally {
                  setUploadingFields(prev => ({ ...prev, [field.id]: false }));
                }
              }}
              disabled={submitting || isUploading}
            />
            <label
              htmlFor={`file-${field.id}`}
              className="flex items-center justify-center gap-3 w-full px-4 py-6 bg-white border-2 border-dashed border-cwc-border rounded-cwc-md hover:border-brand-700 hover:bg-brand-50/30 transition-all cursor-pointer group"
            >
              <span className="material-symbols-outlined text-3xl text-text-tertiary group-hover:text-brand-700">
                {isUploading ? 'hourglass_empty' : 'upload_file'}
              </span>
              <div className="text-left">
                <p className="text-sm font-bold text-text-primary group-hover:text-brand-700">
                  {isUploading ? 'Uploading...' : displayName || 'Click to upload or drag and drop'}
                </p>
                <p className="text-xs text-text-secondary">PNG, JPG, PDF, DOC (max 10MB)</p>
              </div>
            </label>
          </div>
        );
      }
      case 'candidateDocuments': {
        const candidates = (formData.customFields[field.id] as Record<string, Record<string, any>>) || {};
        const docTypes = field.documentTypes || ['Resume', 'Certificates', 'Transcripts'];
        const maxCandidates = field.maxCandidates || 5;
        const candidateCount = Math.max(1, Object.keys(candidates).length);
        const [addCandidateCount, setAddCandidateCount] = React.useState(candidateCount);

        const updateDoc = (candidateKey: string, docType: string, value: any) => {
          const updated = { ...candidates };
          if (!updated[candidateKey]) updated[candidateKey] = {};
          updated[candidateKey] = { ...updated[candidateKey], [docType]: value };
          handleCustomFieldChange(field.id, updated as any);
        };

        const removeDoc = (candidateKey: string, docType: string) => {
          const updated = { ...candidates };
          if (updated[candidateKey]) {
            const candidateDocs = { ...updated[candidateKey] };
            delete candidateDocs[docType];
            if (Object.keys(candidateDocs).length === 0) {
              delete updated[candidateKey];
            } else {
              updated[candidateKey] = candidateDocs;
            }
          }
          handleCustomFieldChange(field.id, updated as any);
        };

        const addCandidate = () => {
          if (addCandidateCount >= maxCandidates) return;
          const newCount = addCandidateCount + 1;
          setAddCandidateCount(newCount);
        };

        const removeCandidate = (index: number) => {
          const key = `candidate_${index}`;
          const updated = { ...candidates };
          delete updated[key];
          handleCustomFieldChange(field.id, updated as any);
          setAddCandidateCount(prev => prev - 1);
        };

        return (
          <div className="space-y-4">
            {Array.from({ length: addCandidateCount }, (_, i) => {
              const key = `candidate_${i + 1}`;
              const candidateDocs = candidates[key] || {};
              const hasAnyDoc = Object.keys(candidateDocs).length > 0;

              return (
                <div key={key} className="border border-cwc-border rounded-cwc-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-surface-muted/50 border-b border-cwc-border">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-brand-700 text-lg">person</span>
                      <span className="text-sm font-bold text-text-primary">Candidate #{i + 1}</span>
                      {hasAnyDoc && (
                        <span className="text-xs text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">
                          {Object.keys(candidateDocs).length}/{docTypes.length} docs
                        </span>
                      )}
                    </div>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => removeCandidate(i + 1)}
                        className="text-text-tertiary hover:text-red-500 transition-colors"
                        title="Remove candidate"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    {docTypes.map((docType: string) => {
                      const docFieldId = `${field.id}_${key}_${docType.toLowerCase()}`;
                      const docData = candidateDocs[docType];
                      const displayName = docData?.fileName || null;
                      const isUploadingDoc = uploadingFields[docFieldId];

                      return (
                        <div key={docType}>
                          <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                            {docType}
                          </label>
                          <div className="relative">
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              className="hidden"
                              id={`file-${docFieldId}`}
                              onChange={async e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingFields(prev => ({ ...prev, [docFieldId]: true }));
                                try {
                                  const fd = new FormData();
                                  fd.append('file', file);
                                  const res = await apiClient.post('/files/upload', fd, {
                                    headers: { 'Content-Type': 'multipart/form-data' },
                                  });
                                  updateDoc(key, docType, res.data.data);
                                } catch {
                                  setError(`Failed to upload ${docType}. Please try again.`);
                                } finally {
                                  setUploadingFields(prev => ({ ...prev, [docFieldId]: false }));
                                }
                              }}
                              disabled={submitting || isUploadingDoc}
                            />
                            {docData ? (
                              <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-cwc-md">
                                <span className="material-symbols-outlined text-green-600 text-lg">description</span>
                                <span className="text-sm font-medium text-green-800 flex-1 truncate">{displayName}</span>
                                <button
                                  type="button"
                                  onClick={() => removeDoc(key, docType)}
                                  className="text-green-600 hover:text-red-500 transition-colors"
                                  title="Remove file"
                                >
                                  <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                              </div>
                            ) : (
                              <label
                                htmlFor={`file-${docFieldId}`}
                                className="flex items-center gap-2 px-3 py-2.5 bg-white border border-dashed border-cwc-border rounded-cwc-md hover:border-brand-700 hover:bg-brand-50/30 transition-all cursor-pointer group"
                              >
                                <span className={`material-symbols-outlined text-lg ${isUploadingDoc ? 'animate-spin' : 'text-text-tertiary group-hover:text-brand-700'}`}>
                                  {isUploadingDoc ? 'progress_activity' : 'upload_file'}
                                </span>
                                <span className="text-sm text-text-secondary group-hover:text-brand-700">
                                  {isUploadingDoc ? 'Uploading...' : `Upload ${docType}`}
                                </span>
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {addCandidateCount < maxCandidates && (
              <button
                type="button"
                onClick={addCandidate}
                className="w-full py-3 border-2 border-dashed border-cwc-border rounded-cwc-md text-sm font-semibold text-text-secondary hover:border-brand-700 hover:text-brand-700 hover:bg-brand-50/30 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">add</span>
                Add Candidate ({maxCandidates - addCandidateCount} remaining)
              </button>
            )}
          </div>
        );
      }
      case 'select':
        return (
          <div className="relative">
            <select
              required={field.required}
              className={`${commonClass} appearance-none`}
              value={formData.customFields[field.id] || ''}
              onChange={e => handleCustomFieldChange(field.id, e.target.value)}
              disabled={submitting}
            >
              <option value="" disabled>Select an option...</option>
              {field.options?.map((option: string, i: number) => (
                <option key={i} value={option}>{option}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">expand_more</span>
          </div>
        );
      case 'entity': {
        const selected = formData.customFields[field.id] || '';
        return (
          <div className="relative">
            <select
              required={field.required}
              className={`${commonClass} appearance-none`}
              value={selected}
              onChange={e => handleCustomFieldChange(field.id, e.target.value)}
              disabled={submitting}
            >
              <option value="" disabled>Select an entity...</option>
              {entityOptions.map(e => (
                <option key={e.code} value={e.code}>{e.name} ({e.code})</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">expand_more</span>
          </div>
        );
      }
      default: // text
        return (
          <input
            required={field.required}
            type="text"
            className={commonClass}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            value={formData.customFields[field.id] || ''}
            onChange={e => handleCustomFieldChange(field.id, e.target.value)}
            disabled={submitting}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-cwc-xl text-sm font-medium">
          {error}
        </div>
      )}

      {isRoleBlocked && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-cwc-xl">
          <span className="material-symbols-outlined text-red-500 mt-0.5">lock</span>
          <div>
            <p className="text-sm font-bold text-red-700">Access Restricted</p>
            <p className="text-sm text-red-600">
              You need the <strong>{selectedRequestType.requiredRole}</strong> role to submit this request type.
              Please contact your administrator.
            </p>
          </div>
        </div>
      )}

      {/* Summary — auto-generated for hiring/offboarding requests, manual for others */}
      {isAutoSummary ? (
        <div>
          <label className="block text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
            Summary
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-full">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Auto-filled
            </span>
          </label>
          {autoSummary ? (
            <div className="w-full px-4 py-3 bg-brand-50/40 border border-brand-200 rounded-cwc-md text-base text-text-primary font-medium">
              {autoSummary}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">Will be auto-generated from the details below.</p>
          )}
        </div>
      ) : (
        <div>
          <label className="block text-sm font-bold text-text-primary mb-2 flex justify-between">
            Summary <span className="text-red-500">*</span>
          </label>
          <input
            required
            type="text"
            placeholder="Enter a brief summary"
            className={commonClass}
            value={formData.summary}
            onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
            disabled={submitting}
          />
        </div>
      )}

      {/* DYNAMIC FIELDS FROM ADMIN CONFIG */}
      {selectedRequestType?.formConfig?.map((field: any) => (
        <div key={field.id} className="scale-in">
          <label className="block text-sm font-bold text-text-primary mb-2 flex justify-between">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          {renderDynamicField(field)}
        </div>
      ))}

      {/* Description - Only for IT Support */}
      {deskType === 'it' && (
        <div>
          <label className="block text-sm font-bold text-text-primary mb-2">Description</label>
          <div className="border border-cwc-border rounded-cwc-md overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-700 transition-all">
            <div className="bg-surface-muted/50 border-b border-cwc-border px-4 py-2 flex gap-4">
              <button type="button" className="material-symbols-outlined text-text-tertiary hover:text-brand-700 text-lg">format_bold</button>
              <button type="button" className="material-symbols-outlined text-text-tertiary hover:text-brand-700 text-lg">format_italic</button>
              <button type="button" className="material-symbols-outlined text-text-tertiary hover:text-brand-700 text-lg">format_list_bulleted</button>
              <button type="button" className="material-symbols-outlined text-text-tertiary hover:text-brand-700 text-lg">link</button>
            </div>
            <textarea
              rows={8}
              placeholder="Provide additional details about your request..."
              className="w-full px-4 py-3 bg-white border-none text-base outline-none resize-none placeholder:text-text-tertiary"
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              disabled={submitting}
            />
          </div>
        </div>
      )}

      {/* Urgency - Only for IT Support */}
      {deskType === 'it' && (
        <div>
          <label className="block text-sm font-bold text-text-primary mb-2">Urgency</label>
          <div className="relative">
            <select
              className="w-full pl-4 pr-10 py-3 bg-white border border-cwc-border rounded-cwc-md text-base focus:ring-2 focus:ring-brand-500/20 focus:border-brand-700 outline-none transition-all appearance-none text-text-primary"
              value={formData.urgency}
              onChange={e => setFormData(prev => ({ ...prev, urgency: e.target.value }))}
              disabled={submitting}
            >
              {URGENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">expand_more</span>
          </div>
        </div>
      )}

      {/* Confidentiality — HR auto-confidential, Finance manual toggle */}
      {isAutoConfidential && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-cwc-xl">
          <span className="material-symbols-outlined text-amber-600 mt-0.5 text-lg">lock</span>
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
              Confidential Request
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-full">
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                Auto-applied
              </span>
            </div>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              All HR requests are confidential by default. Only you, designated approvers, and authorized personnel will see this request.
            </p>
          </div>
        </div>
      )}
      {!isAutoConfidential && deskType === 'finance' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-cwc-xl">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.isConfidential}
              onChange={e => setFormData(prev => ({ ...prev, isConfidential: e.target.checked }))}
              disabled={submitting}
              className="w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500/30 accent-amber-600 cursor-pointer"
            />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Mark as Confidential
              </div>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Only you, designated approvers, and authorized personnel will see this request. Other agents will not have access.
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};

export default StepDetails;