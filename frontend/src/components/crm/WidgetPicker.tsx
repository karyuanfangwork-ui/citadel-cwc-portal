import React from 'react';
import { useDashboardLayout, WidgetConfig } from './DashboardLayoutProvider';

const WIDGET_ICONS: Record<string, string> = {
  kpi_hero: '📊',
  today_priorities: '🎯',
  my_performance: '📈',
  pipeline_funnel: '🔻',
  recent_activity: '🕐',
  won_lost: '🏆',
  stale_leads: '⚠️',
  team_leaderboard: '🏅',
  quota_attainment: '💰',
  ai_briefing: '🤖',
};

interface WidgetPickerProps {
  onClose: () => void;
}

const WidgetPicker: React.FC<WidgetPickerProps> = ({ onClose }) => {
  const { layout, registry, toggleWidget, saveLayout } = useDashboardLayout();

  const visibleWidgetIds = new Set(layout.filter(w => w.visible).map(w => w.widgetId));

  const handleToggle = (widgetId: string) => {
    toggleWidget(widgetId);
  };

  const handleSave = async () => {
    await saveLayout();
    onClose();
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface, #fff)',
    borderRadius: 'var(--radius-lg, 12px)',
    border: '1px solid var(--color-border, #e5e7eb)',
    padding: '20px',
    maxWidth: '480px',
    margin: '0 auto',
  };

  const widgetItemStyle = (visible: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', borderRadius: '8px',
    background: visible ? '#eff6ff' : '#f9fafb',
    border: `1px solid ${visible ? '#93c5fd' : '#e5e7eb'}`,
    cursor: 'pointer', transition: 'background 0.15s',
  });

  const btnStyle = (variant: 'primary' | 'secondary' = 'primary'): React.CSSProperties => ({
    padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600,
    background: variant === 'primary' ? 'var(--color-primary, #4f46e5)' : '#f3f4f6',
    color: variant === 'primary' ? '#fff' : '#374151',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={cardStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>Customize Dashboard</h2>
        <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>Toggle widgets on/off to customize your dashboard layout.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto' }}>
          {registry.map(reg => {
            const visible = visibleWidgetIds.has(reg.widgetId);
            return (
              <div key={reg.widgetId} style={widgetItemStyle(visible)} onClick={() => handleToggle(reg.widgetId)}>
                <span style={{ fontSize: '20px' }}>{WIDGET_ICONS[reg.widgetId] || '📦'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{reg.title}</div>
                  <div style={{ fontSize: '12px', color: '#9ca3af' }}>Size: {reg.size}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '4px', border: `2px solid ${visible ? '#4f46e5' : '#d1d5db'}`,
                  background: visible ? '#4f46e5' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: '12px', fontWeight: 700,
                }}>
                  {visible ? '✓' : ''}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button style={btnStyle('secondary')} onClick={onClose}>Cancel</button>
          <button style={btnStyle('primary')} onClick={handleSave}>Save Layout</button>
        </div>
      </div>
    </div>
  );
};

export default WidgetPicker;