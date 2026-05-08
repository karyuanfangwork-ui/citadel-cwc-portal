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

      {/* Summary */}
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

      {/* Confidentiality Toggle — HR & Finance */}
      {(deskType === 'hr' || deskType === 'finance') && (
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