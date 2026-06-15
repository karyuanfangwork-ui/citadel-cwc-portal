import React from 'react';
import { FormData, URGENCY_OPTIONS, WorkflowInfo } from './useCreateRequestWizard';

interface StepReviewProps {
  formData: FormData;
  selectedRequestType: any;
  deskType: string;
  entityOptions: { code: string; name: string }[];
  isRoleBlocked: boolean;
  autoSummary?: string;
  isAutoConfidential?: boolean;
  workflow?: WorkflowInfo | null;
}

const ProcessOverview: React.FC<{ workflow: WorkflowInfo; slaHours?: number | null; requiresApproval: boolean }> = ({ workflow, slaHours, requiresApproval }) => {
  const { steps } = workflow;

  if (!steps || steps.length === 0) return null;

  return (
    <div className="pb-6 border-b border-cwc-border">
      <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-base">route</span>
        Process Overview
      </h3>

      {/* Quick stats */}
      {(requiresApproval || slaHours) && (
        <div className="flex items-center gap-3 mb-4">
          {requiresApproval && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-cwc-md">
              <span className="material-symbols-outlined text-amber-600 text-sm">approval</span>
              <span className="text-xs font-semibold text-amber-800">Approval required</span>
            </div>
          )}
          {slaHours && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-cwc-md">
              <span className="material-symbols-outlined text-blue-600 text-sm">schedule</span>
              <span className="text-xs font-semibold text-blue-800">~{slaHours}h target SLA</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-muted border border-cwc-border rounded-cwc-md">
            <span className="material-symbols-outlined text-text-secondary text-sm">steps</span>
            <span className="text-xs font-semibold text-text-secondary">{steps.length} steps</span>
          </div>
        </div>
      )}

      {/* Vertical timeline */}
      <div className="ml-1">
        {steps.map((step, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === steps.length - 1;
          const hasConnection = !isLast;

          return (
            <div key={step.id} className="flex gap-3">
              {/* Left rail: icon + connector */}
              <div className="flex flex-col items-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  step.isInitial
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : step.isFinal
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-brand-300 text-brand-600'
                }`}>
                  <span className="material-symbols-outlined leading-none" style={{ fontSize: '14px' }}>{step.icon || 'radio_button_checked'}</span>
                </div>
                {hasConnection && (
                  <div className="w-0.5 flex-1 min-h-[20px] bg-brand-200" />
                )}
              </div>
              {/* Right: label + badges */}
              <div className={`pb-4 ${isLast ? '' : ''}`}>
                <p className={`text-sm font-semibold ${
                  step.isInitial ? 'text-brand-700' : step.isFinal ? 'text-green-700' : 'text-text-primary'
                }`}>
                  {step.label}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {step.isInitial && (
                    <span className="text-[10px] font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded-full">Starting step</span>
                  )}
                  {step.isFinal && (
                    <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Completion</span>
                  )}
                  {step.slaPause && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                      <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>pause</span>
                      SLA paused
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
        You can track your request's progress through these stages on the request detail page.
      </p>
    </div>
  );
};

const StepReview: React.FC<StepReviewProps> = ({
  formData,
  selectedRequestType,
  deskType,
  entityOptions,
  isRoleBlocked,
  autoSummary,
  isAutoConfidential,
  workflow,
}) => {
  const getUrgencyLabel = (value: string) => {
    const opt = URGENCY_OPTIONS.find(o => o.value === value);
    return opt?.label || value;
  };

  const formatFileSize = (size?: number) => {
    if (!size) return '';
    if (size > 1024 * 1024) return ` (${(size / (1024 * 1024)).toFixed(1)} MB)`;
    return ` (${(size / 1024).toFixed(0)} KB)`;
  };

  const formatCustomFieldDisplay = (field: any, value: any) => {
    if (!value && value !== 0) return '—';
    if (field.type === 'entity' && entityOptions.length > 0) {
      const entity = entityOptions.find(e => e.code === value);
      return entity ? `${entity.name} (${entity.code})` : value;
    }
    // File field: single object or array of file objects
    if (field.type === 'file') {
      const files: { fileName: string; s3Key?: string; mimeType?: string; fileSize?: number }[] = Array.isArray(value) ? value : (value?.fileName ? [value] : []);
      if (files.length === 0) return '—';
      return files.map(f => f.fileName + formatFileSize(f.fileSize)).join(', ');
    }
    if (field.type === 'currency') {
      return `RM ${value}`;
    }
    if (field.type === 'candidateDocuments' && typeof value === 'object') {
      const candidates = value as Record<string, Record<string, any>>;
      const docTypes = field.documentTypes || ['Resume', 'Certificates', 'Transcripts'];
      const entries = Object.entries(candidates);
      if (entries.length === 0) return '—';
      return `${entries.length} candidate${entries.length > 1 ? 's' : ''} — ${entries.reduce((sum, [, docs]) => sum + Object.keys(docs).length, 0)} document${entries.reduce((sum, [, docs]) => sum + Object.keys(docs).length, 0) !== 1 ? 's' : ''}`;
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

      {/* Process Overview — workflow timeline */}
      {workflow && workflow.steps.length > 0 && (
        <ProcessOverview
          workflow={workflow}
          slaHours={selectedRequestType?.slaHours}
          requiresApproval={!!selectedRequestType?.requiresApproval}
        />
      )}

      {/* Summary */}
      <div className="pb-6 border-b border-cwc-border">
        <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3 flex items-center gap-2">
          Summary
          {autoSummary && !formData.summary && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-full">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Auto-filled
            </span>
          )}
        </h3>
        <p className="text-text-primary font-medium">{formData.summary || autoSummary || '—'}</p>
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
      {(deskType === 'hr' || deskType === 'finance') && (formData.isConfidential || isAutoConfidential) && (
        <div>
          <h3 className="text-sm font-bold text-text-tertiary uppercase tracking-wider mb-3">Confidentiality</h3>
          <div className="flex items-center gap-2 text-amber-700">
            <span className="material-symbols-outlined text-lg">lock</span>
            <span className="font-medium">{isAutoConfidential ? 'Auto-applied' : 'Marked'} as Confidential</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StepReview;