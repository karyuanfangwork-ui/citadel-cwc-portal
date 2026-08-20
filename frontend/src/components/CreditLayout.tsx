import React from 'react';
import { Outlet } from 'react-router-dom';
import CreditNav from './CreditNav';

/**
 * CreditLayout — wraps all credit module pages with:
 *   1. Horizontal sub-navigation (CreditNav) at the top
 *   2. Content area below with Financial Core design system tokens
 *
 * Modeled after CrmLayout. Used as a route element in App.tsx:
 *   <Route path="/credit" element={<CreditLayout />}>
 *     <Route index element={<CreditDashboard />} />
 *     ...
 *   </Route>
 */
const CreditLayout: React.FC = () => {
  return (
    <div className="credit-module" style={{ minHeight: '100%', overflowX: 'hidden', backgroundColor: 'var(--cr-surface, #f7f9fb)' }}>
      {/* ── Horizontal Sub-Nav (Financial Core styling) ── */}
      <CreditNav />

      {/* ── Content area ── */}
      <div className="flex-1 min-w-0">
        <div className="mx-auto min-h-full w-full max-w-[1680px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default CreditLayout;
