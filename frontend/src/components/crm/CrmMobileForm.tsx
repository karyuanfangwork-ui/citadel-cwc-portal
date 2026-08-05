import React from 'react';

interface Props {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  saveLabel?: string;
  saving?: boolean;
  children: React.ReactNode;
}

// Mobile-optimized bottom-sheet form: slide-up, full-width inputs, 44px touch targets, sticky header
export default function CrmMobileForm({ title, isOpen, onClose, onSave, saveLabel = 'Save', saving = false, children }: Props) {
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1100, animation: 'fadeIn 0.2s ease',
        }}
      />

      {/* Bottom Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1101,
        background: '#fff', borderRadius: '16px 16px 0 0',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        {/* Drag Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#d1d5db' }} />
        </div>

        {/* Sticky Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 16px 12px', borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, background: '#fff', zIndex: 1,
        }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, color: '#6b7280', cursor: 'pointer', padding: '8px', minWidth: 44, minHeight: 44, WebkitTapHighlightColor: 'transparent' }}>
            ✕
          </button>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#111827' }}>{title}</h3>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 20px', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              minWidth: 44, minHeight: 44, opacity: saving ? 0.7 : 1,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {saving ? 'Saving...' : saveLabel}
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', WebkitOverflowScrolling: 'touch' }}>
          {React.Children.map(children, child => {
            // Ensure all direct children have mobile-optimized styles
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<any>, {
                style: {
                  ...(child.props as any).style,
                  minHeight: 44, // Touch target minimum
                },
              });
            }
            return child;
          })}
          {children}
          {/* Extra bottom padding for safe area */}
          <div style={{ height: 'env(safe-area-inset-bottom, 20px)' }} />
        </div>
      </div>

      {/* Keyframe Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );
}