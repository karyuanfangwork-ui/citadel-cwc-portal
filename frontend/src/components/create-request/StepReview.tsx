import React from 'react';
import { FormData, URGENCY_OPTIONS } from './useCreateRequestWizard';

interface StepReviewProps {
  formData: FormData;
  selectedRequestType: any;
  deskType: string;
  entityOptions: { code: string; name: string }[];
  isRoleBlocked: boolean;
}

const StepReview: React.FC<StepReviewProps> = ({
  formData,
  selectedRequestType,
  deskType,
  entityOptions,
  isRoleBlocked,
}) => {
  const getUrgencyLabel = (value: string) => {
    const opt = URGENCY_OPTIONS.find(o => o.value === value);
    return opt?.label || value;
  };

  const formatCustomFieldDisplay = (field: any, value: any) => {
    if (!value && value !== 0) return '—';
    if (field.type === 'entity' && entityOptions.length > 0) {
      const entity = entityOptions.find(e => e.code === value);
      return entity ? `${entity.name} (${entity.code})` : value;
    }
    if (field.type === 'file' && value?.fileName) {
      return value.fileName;
    }
    if (field.type === 'currency') {
      return `RM ${value}`;
    }
    return String(value);
  };

  return (
    <div className="space-y-6">
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

      {/* Request Type */}
      <div className="pb-6 border-b border-cwc-border">
        <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3">Request Type</h3>
        <div className="p-4 bg-brand-50 rounded-cwc-lg border border-brand-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-cwc-md flex items-center justify-center bg-brand-700 text-white">
              <span className="material-symbols-outlined text-xl">{selectedRequestType?.icon || 'mail'}</span>
            </div>
            <div>
              <h4 className="font-bold text-text-primary">{selectedRequestType?.name}</h4>
              <p className="text-xs text-text-secondary">{selectedRequestType?.description}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="pb-6 border-b border-cwc-border">
        <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3">Summary</h3>
        <p className="text-text-primary font-medium">{formData.summary || '—'}</p>
      </div>

      {/* Description (IT only) */}
      {deskType === 'it' && formData.description && (
        <div className="pb-6 border-b border-cwc-border">
          <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3">Description</h3>
          <p className="text-text-secondary whitespace-pre-wrap">{formData.description}</p>
        </div>
      )}

      {/* Custom Fields */}
      {selectedRequestType?.formConfig?.length > 0 && (
        <div className="pb-6 border-b border-cwc-border">
          <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3">Additional Fields</h3>
          <div className="space-y-3">
            {selectedRequestType.formConfig.map((field: any) => (
              <div key={field.id} className="flex justify-between items-start gap-4 py-2">
                <span className="text-sm text-text-secondary min-w-[140px]">{field.label}</span>
                <span className="text-sm text-text-primary font-medium text-right flex-1">
                  {formatCustomFieldDisplay(field, formData.customFields[field.id])}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Urgency (IT only) */}
      {deskType === 'it' && (
        <div className="pb-6 border-b border-cwc-border">
          <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3">Urgency</h3>
          <p className="text-text-primary font-medium">{getUrgencyLabel(formData.urgency)}</p>
        </div>
      )}

      {/* Confidentiality */}
      {(deskType === 'hr' || deskType === 'finance') && formData.isConfidential && (
        <div>
          <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3">Confidentiality</h3>
          <div className="flex items-center gap-2 text-amber-700">
            <span className="material-symbols-outlined text-lg">lock</span>
            <span className="font-medium">Marked as Confidential</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepReview;