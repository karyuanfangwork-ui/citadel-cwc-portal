/**
 * ApplicationJourneyStepper — 11-stage horizontal journey stepper
 * for the Application 360 Workspace.
 *
 * Renders a horizontal progress track with stages from JOURNEY_STAGES.
 * - Current stage: filled circle + bold label
 * - Completed stages (index < currentStageIndex): checkmark icon
 * - Future stages (index > currentStageIndex): muted
 * - Clicking a COMPLETED stage calls onStageClick(stage) to navigate
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React from 'react';
import { JourneyStage, JOURNEY_STAGES } from '../../../../pages/credit/creditUtils';

interface ApplicationJourneyStepperProps {
  currentStageIndex: number;
  onStageClick: (stage: JourneyStage) => void;
}

const ApplicationJourneyStepper: React.FC<ApplicationJourneyStepperProps> = ({
  currentStageIndex,
  onStageClick,
}) => {
  const isCompleted = (idx: number) => idx < currentStageIndex;
  const isCurrent = (idx: number) => idx === currentStageIndex;
  const isFuture = (idx: number) => idx > currentStageIndex;

  const handleClick = (stage: JourneyStage, idx: number) => {
    if (isCompleted(idx)) {
      onStageClick(stage);
    }
  };

  return (
    <div
      style={{
        background: 'var(--cr-surface-container-lowest)',
        border: '1px solid var(--cr-outline-variant)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 20,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          maxWidth: '64rem',
          margin: '0 auto',
        }}
      >
        {/* Background connector line behind all circles */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 0,
            right: 0,
            height: 2,
            backgroundColor: 'rgba(198, 198, 205, 0.5)',
            zIndex: 0,
          }}
        />

        {JOURNEY_STAGES.map((stage, idx) => {
          const completed = isCompleted(idx);
          const current = isCurrent(idx);
          const future = isFuture(idx);

          // Circle sizing
          const circleSize = current ? 36 : 32;
          const circleStyle: React.CSSProperties = current
            ? {
                width: circleSize,
                height: circleSize,
                borderRadius: '50%',
                backgroundColor: 'var(--cr-primary-container)',
                color: 'white',
                border: '4px solid white',
                boxShadow:
                  '0 1px 3px rgba(0,0,0,0.1), 0 0 0 2px var(--cr-primary-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }
            : completed
              ? {
                  width: circleSize,
                  height: circleSize,
                  borderRadius: '50%',
                  backgroundColor: 'var(--cr-secondary)',
                  color: 'white',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }
              : {
                  width: circleSize,
                  height: circleSize,
                  borderRadius: '50%',
                  backgroundColor: 'var(--cr-outline-variant)',
                  color: 'var(--cr-on-surface-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.4,
                  flexShrink: 0,
                };

          // Label style
          const labelStyle: React.CSSProperties = {
            fontSize: 10,
            fontFamily: 'var(--cr-font-display)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase' as const,
            textAlign: 'center' as const,
            color: current
              ? 'var(--cr-primary)'
              : completed
                ? 'var(--cr-secondary)'
                : 'var(--cr-outline)',
            fontWeight: current ? 800 : completed ? 700 : 400,
            opacity: future ? 0.4 : 1,
            marginTop: 4,
            cursor: completed ? 'pointer' : 'default',
          };

          return (
            <div
              key={stage.key}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              onClick={() => handleClick(stage, idx)}
              onMouseEnter={(e) => {
                if (completed) {
                  const circle = e.currentTarget.querySelector(
                    '[data-circle]'
                  ) as HTMLElement | null;
                  if (circle) {
                    circle.style.transform = 'scale(1.1)';
                    circle.style.boxShadow =
                      '0 2px 6px rgba(0,0,0,0.12), 0 0 0 2px var(--cr-secondary)';
                  }
                }
              }}
              onMouseLeave={(e) => {
                if (completed) {
                  const circle = e.currentTarget.querySelector(
                    '[data-circle]'
                  ) as HTMLElement | null;
                  if (circle) {
                    circle.style.transform = 'scale(1)';
                    circle.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                  }
                }
              }}
            >
              <div data-circle style={circleStyle}>
                {completed ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                  >
                    check
                  </span>
                ) : current ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16 }}
                  >
                    hourglass_empty
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    {idx + 1}
                  </span>
                )}
              </div>
              <span style={labelStyle}>{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApplicationJourneyStepper;