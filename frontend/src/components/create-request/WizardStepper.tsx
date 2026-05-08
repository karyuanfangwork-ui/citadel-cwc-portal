import React from 'react';
import { WizardStep } from './useCreateRequestWizard';

interface WizardStepperProps {
  steps: { id: WizardStep; label: string; icon: string }[];
  currentStep: WizardStep;
}

const WizardStepper: React.FC<WizardStepperProps> = ({ steps, currentStep }) => {
  const currentIndex = steps.findIndex(s => s.id === currentStep);
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, idx) => (
        <div key={step.id} className="flex items-center flex-1">
          <div className={`flex items-center gap-2 ${idx <= currentIndex ? 'text-brand-700' : 'text-text-tertiary'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              idx < currentIndex ? 'bg-brand-700 text-white' :
              idx === currentIndex ? 'bg-brand-100 text-brand-700 border-2 border-brand-700' :
              'bg-surface-muted text-text-tertiary'
            }`}>
              {idx < currentIndex ? <span className="material-symbols-outlined text-sm">check</span> : idx + 1}
            </div>
            <span className="text-sm font-semibold hidden sm:inline">{step.label}</span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-0.5 mx-3 ${idx < currentIndex ? 'bg-brand-700' : 'bg-cwc-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default WizardStepper;