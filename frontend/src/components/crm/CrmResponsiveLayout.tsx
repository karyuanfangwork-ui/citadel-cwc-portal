import React, { useState, useEffect } from 'react';
import CrmNav from '../CrmNav';
import CrmMobileNav from './CrmMobileNav';
import CrmQuickAdd from './CrmQuickAdd';

// Responsive CRM layout: desktop shows CrmNav sidebar, mobile shows bottom nav + FAB
export default function CrmResponsiveLayout({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Mobile Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 48, background: '#fff', borderBottom: '1px solid #e5e7eb',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#111827' }}>CWC CRM</span>
        </header>

        {/* Content Area */}
        <main style={{ flex: 1, padding: '12px 16px', paddingBottom: 72 }}>
          {children}
        </main>

        {/* Quick Add FAB */}
        <CrmQuickAdd />

        {/* Bottom Navigation */}
        <CrmMobileNav />
      </div>
    );
  }

  // Desktop: standard layout with CrmNav sidebar
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <CrmNav />
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}