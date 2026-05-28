import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const QUICK_ACTIONS = [
  { label: 'New Lead', icon: 'person_add', to: '/crm/leads/new' },
  { label: 'New Contact', icon: 'contact_page', to: '/crm/contacts/new' },
  { label: 'New Account', icon: 'business', to: '/crm/accounts/new' },
  { label: 'New Opportunity', icon: 'trending_up', to: '/crm/opportunities/new' },
  { label: 'Log Activity', icon: 'event_note', to: '/crm/activities/new' },
];

export default function CrmQuickAdd() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleAction = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 72, right: 16, zIndex: 999,
          width: 56, height: 56, borderRadius: 28,
          background: '#2563eb', color: '#fff', border: 'none',
          boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'transform 0.2s',
          transform: open ? 'rotate(45deg)' : 'rotate(0)',
        }}
      >
        <span className="material-icons" style={{ fontSize: 28 }}>add</span>
      </button>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 998 }}
        />
      )}

      {/* Bottom Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 999,
        background: '#fff', borderRadius: '16px 16px 0 0',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        maxHeight: open ? '60vh' : '0',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d1d5db' }} />
        </div>
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>Quick Add</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.to}
                onClick={() => handleAction(action.to)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 12,
                  background: '#fff', cursor: 'pointer', fontSize: 16, color: '#111827',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span className="material-icons" style={{ fontSize: 22, color: '#2563eb' }}>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}