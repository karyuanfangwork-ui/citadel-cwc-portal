import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/crm', label: 'Dashboard', icon: 'dashboard' },
  { to: '/crm/pipeline', label: 'Pipeline', icon: 'view_kanban' },
  { to: '/crm/activities', label: 'Activities', icon: 'event_note' },
  { to: '/crm/leads', label: 'Leads', icon: 'person_add' },
  { to: '/crm/reports', label: 'Reports', icon: 'bar_chart' },
];

export default function CrmMobileNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (to: string) => {
    if (to === '/crm') return location.pathname === '/crm';
    return location.pathname.startsWith(to);
  };

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff', borderTop: '1px solid #e5e7eb',
      display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      height: 56, zIndex: 1000, boxShadow: '0 -2px 8px rgba(0,0,0,0.08)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {NAV_ITEMS.map(item => {
        const active = isActive(item.to);
        return (
          <button
            key={item.to}
            onClick={() => navigate(item.to)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flex: 1, height: '100%', border: 'none', background: 'none', cursor: 'pointer',
              color: active ? '#2563eb' : '#6b7280', fontSize: 10, gap: 2,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span className="material-icons" style={{ fontSize: 22 }}>{item.icon}</span>
            <span style={{ fontWeight: active ? 600 : 400 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}