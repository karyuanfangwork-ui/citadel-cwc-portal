import type { WizardStep, WizardStepConfig } from './step-config';

interface WizardStepperProps {
  steps: WizardStepConfig[];
  currentStep: WizardStep;
  currentStepIndex: number;
  onStepSelect: (step: WizardStep) => void;
}

export default function WizardStepper({ steps, currentStep, currentStepIndex, onStepSelect }: WizardStepperProps) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-6 rounded-lg border p-3" style={{ borderColor: 'var(--cr-outline-variant)', background: 'var(--cr-surface-container-lowest)' }}>
        <p className="px-1 pb-3 text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--cr-on-surface-variant)' }}>Steps</p>
        <div className="space-y-2">
          {steps.map((step, index) => {
            const active = step.key === currentStep;
            const passed = index < currentStepIndex;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => onStepSelect(step.key)}
                className="flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition"
                style={{
                  borderColor: active ? 'var(--cr-secondary)' : 'transparent',
                  background: active ? 'var(--cr-secondary-fixed)' : passed ? 'rgba(0,0,0,0.02)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: active ? 'var(--cr-secondary)' : passed ? 'var(--cr-secondary-fixed)' : 'var(--cr-surface-container-low)', color: active ? 'var(--cr-on-secondary)' : 'var(--cr-on-surface-variant)' }}>
                  {index + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--cr-on-surface)' }}>{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--cr-on-surface-variant)' }}>{step.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
