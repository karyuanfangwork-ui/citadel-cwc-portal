/**
 * ApplicationAlertsPanel — Right sidebar critical alerts panel.
 *
 * Shows: Missing documents, SLA expiry warnings, score staleness.
 * Each alert has severity (error/warning) and an action link.
 *
 * Uses Financial Core design tokens (--cr-*).
 */
import React from 'react';

export interface AlertItem {
  id: string;
  severity: 'error' | 'warning' | 'info';
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    tab: string;
  };
}

interface ApplicationAlertsPanelProps {
  alerts: AlertItem[];
  onNavigate: (tab: string) => void;
}

const severityStyles: Record<string, { bg: string; border: string; iconColor: string }> = {
  error: {
    bg: '#fef2f2',
    border: '#dc2626',
    iconColor: '#dc2626',
  },
  warning: {
    bg: '#fffbeb',
    border: '#f59e0b',
    iconColor: '#d97706',
  },
  info: {
    bg: 'var(--cr-surface-container-lowest)',
    border: 'var(--cr-outline-variant)',
    iconColor: 'var(--cr-secondary)',
  },
};

const ApplicationAlertsPanel: React.FC<ApplicationAlertsPanelProps> = ({
  alerts,
  onNavigate,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
      <h3
        className="font-bold uppercase tracking-wider"
        style={{ fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-label-md)', color: 'var(--cr-outline)', letterSpacing: 'var(--cr-tracking-label)' }}
      >
        Critical Alerts
      </h3>
      <div className="flex flex-col gap-2">
        {alerts.map((alert) => {
          const styles = severityStyles[alert.severity] || severityStyles.info;
          return (
            <div
              key={alert.id}
              className="flex flex-col gap-1 p-3"
              style={{
                backgroundColor: styles.bg,
                borderLeft: `4px solid ${styles.border}`,
                borderRadius: 'var(--cr-radius)',
              }}
            >
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined shrink-0" style={{ fontSize: 18, color: styles.iconColor }}>
                  {alert.icon}
                </span>
                <div className="flex flex-col flex-1 min-w-0">
                  <span
                    className="font-bold"
                    style={{ fontSize: 'var(--cr-text-body-sm)', color: 'var(--cr-on-surface)', fontFamily: 'var(--cr-font-display)' }}
                  >
                    {alert.title}
                  </span>
                  <span
                    style={{ fontSize: 12, color: 'var(--cr-outline)', fontFamily: 'var(--cr-font-body)' }}
                  >
                    {alert.description}
                  </span>
                  {alert.action && (
                    <button
                      onClick={() => onNavigate(alert.action!.tab)}
                      className="mt-1 text-left font-bold"
                      style={{
                        fontSize: 12,
                        color: 'var(--cr-secondary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        fontFamily: 'var(--cr-font-display)',
                      }}
                    >
                      {alert.action.label} →
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApplicationAlertsPanel;