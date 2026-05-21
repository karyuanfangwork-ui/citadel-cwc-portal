import React, { useState } from 'react';
import type { WorkflowInfo } from './useCreateRequestWizard';

interface StepRequestTypeProps {
  requestTypes: any[];
  selectedRequestType: any;
  onSelectType: (type: any) => void;
  loading: boolean;
  error: string | null;
  workflow: WorkflowInfo | null;
}

const WorkflowPreview: React.FC<{ workflow: WorkflowInfo; slaHours?: number | null; requiresApproval: boolean }> = ({ workflow, slaHours, requiresApproval }) => {
  const [expanded, setExpanded] = useState(true);
  const { steps } = workflow;

  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-4 border border-brand-200 bg-brand-50/30 rounded-cwc-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-50/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-700 text-lg">route</span>
          <span className="text-sm font-bold text-brand-800">What happens next?</span>
          {(requiresApproval || slaHours) && (
            <div className="flex items-center gap-2 ml-1">
              {requiresApproval && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-full">
                  <span className="material-symbols-outlined text-xs">approval</span>
                  Approval needed
                </span>
              )}
              {slaHours && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-100 border border-blue-200 rounded-full">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  ~{slaHours}h SLA
                </span>
              )}
            </div>
          )}
        </div>
        <span className="material-symbols-outlined text-brand-600 text-lg transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <div className="flex items-start gap-0">
            {steps.map((step, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1 min-w-0">
                  {/* Step node */}
                  <div className="flex items-center w-full">
                    {/* Connector left */}
                    {!isFirst && (
                      <div className="flex-1 h-0.5 bg-brand-200" />
                    )}
                    {/* Icon circle */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2 ${
                      step.isInitial
                        ? 'bg-brand-700 border-brand-700 text-white'
                        : step.isFinal
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-white border-brand-300 text-brand-600'
                    }`}>
                      <span className="material-symbols-outlined text-base">{step.icon || 'radio_button_checked'}</span>
                    </div>
                    {/* Connector right */}
                    {!isLast && (
                      <div className="flex-1 h-0.5 bg-brand-200" />
                    )}
                  </div>
                  {/* Label */}
                  <div className="mt-1.5 text-center px-0.5">
                    <p className={`text-xs font-semibold leading-tight ${
                      step.isInitial ? 'text-brand-700' : step.isFinal ? 'text-green-700' : 'text-text-secondary'
                    }`}>
                      {step.label}
                    </p>
                    {step.slaPause && (
                      <span className="inline-flex items-center gap-0.5 mt-0.5 px-1 py-px text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full">
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>pause</span>
                        Pauses SLA
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-text-tertiary leading-relaxed">
            Your request will follow this process. You can track progress on the request detail page after submission.
          </p>
        </div>
      )}
    </div>
  );
};

const StepRequestType: React.FC<StepRequestTypeProps> = ({
  requestTypes,
  selectedRequestType,
  onSelectType,
  loading,
  error,
  workflow,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-cwc-lg text-sm font-medium">
        {error}
      </div>
    );
  }

  if (requestTypes.length <= 1) {
    // Single or no type — auto-selected, show a simple confirmation
    if (requestTypes.length === 1) {
      const type = requestTypes[0];
      return (
        <div className="pb-6">
          <div className={`p-5 rounded-cwc-xl border-2 border-brand-700 bg-brand-50/50`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-cwc-md flex items-center justify-center bg-brand-700 text-white">
                <span className="material-symbols-outlined text-xl">{type.icon || 'mail'}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-text-primary mb-1">{type.name}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{type.description}</p>
              </div>
              <span className="material-symbols-outlined text-brand-700">check_circle</span>
            </div>
          </div>
          {workflow && selectedRequestType?.id === type.id && (
            <WorkflowPreview
              workflow={workflow}
              slaHours={type.slaHours}
              requiresApproval={!!type.requiresApproval}
            />
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="pb-6">
      <label className="block text-sm font-bold text-text-primary mb-3">
        Select Request Type <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {requestTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelectType(type)}
            className={`p-5 rounded-cwc-xl border-2 text-left transition-all ${
              selectedRequestType?.id === type.id
                ? 'border-brand-700 bg-brand-50/50 shadow-cwc-md'
                : 'border-cwc-border hover:border-cwc-border-subtle hover:bg-surface-muted'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-cwc-md flex items-center justify-center ${
                selectedRequestType?.id === type.id
                  ? 'bg-brand-700 text-white'
                  : 'bg-surface-muted text-text-tertiary'
              }`}>
                <span className="material-symbols-outlined text-xl">{type.icon || 'mail'}</span>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-text-primary mb-1">{type.name}</h3>
                <p className="text-xs text-text-secondary leading-relaxed">{type.description}</p>
              </div>
              {selectedRequestType?.id === type.id && (
                <span className="material-symbols-outlined text-brand-700">check_circle</span>
              )}
            </div>
          </button>
        ))}
      </div>
      {!selectedRequestType && (
        <p className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-100 rounded-cwc-md p-3">
          Please select a request type to continue
        </p>
      )}
      {workflow && selectedRequestType && (
        <WorkflowPreview
          workflow={workflow}
          slaHours={selectedRequestType.slaHours}
          requiresApproval={!!selectedRequestType.requiresApproval}
        />
      )}
    </div>
  );
};

export default StepRequestType;