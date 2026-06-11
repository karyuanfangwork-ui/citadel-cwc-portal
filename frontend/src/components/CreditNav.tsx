import React, { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/permissions';

interface CreditNavItem {
  to: string;
  label: string;
  icon: string;
  permission?: string;
}

/** All nav items in desired display order. The component will show as many as fit, overflow goes into "More". */
const ALL_ITEMS: CreditNavItem[] = [
  { to: '/credit', label: 'Dashboard', icon: 'dashboard' },
  { to: '/credit/borrowers', label: 'Borrowers', icon: 'person' },
  { to: '/credit/applications', label: 'Applications', icon: 'description' },
  { to: '/credit/group-exposure', label: 'Group Exposure', icon: 'scatter_plot', permission: 'credit:read' },
  { to: '/credit/approvals', label: 'My Approvals', icon: 'approval', permission: 'credit:approve' },
  { to: '/credit/committee', label: 'Committee', icon: 'groups', permission: 'credit:read' },
  { to: '/credit/scorecards', label: 'Scorecards', icon: 'dashboard_customize', permission: 'credit:admin' },
  { to: '/credit/analysis', label: 'Analysis', icon: 'query_stats', permission: 'credit:read' },
  { to: '/credit/financials', label: 'Spreading', icon: 'table_chart', permission: 'credit:read' },
  { to: '/credit/collateral', label: 'Collateral', icon: 'shield', permission: 'credit:read' },
  { to: '/credit/reports', label: 'Reports', icon: 'assessment', permission: 'credit:read' },
];

const CreditNav: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ALL_ITEMS.length);
  const navRef = useRef<HTMLElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemWidthsRef = useRef<Map<string, number>>(new Map());

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/credit') return location.pathname === '/credit';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const canSee = (item: CreditNavItem) =>
    !item.permission || hasPermission(user, item.permission);

  const visibleItems = ALL_ITEMS.filter(canSee);
  const overflowActive = (item: CreditNavItem) => isActive(item.to);

  const linkCls = (active: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
      active
        ? 'text-[#0052cc] border-[#0052cc]'
        : 'text-text-secondary border-transparent hover:text-[#0052cc] hover:border-[#0052cc]/30'
    }`;

  // Measure item widths and compute how many fit
  const measureAndCompute = useCallback(() => {
    if (!navRef.current) return;

    // Measure all visible item refs
    const containerEl = navRef.current.querySelector<HTMLDivElement>('.credit-nav-items');
    if (!containerEl) return;

    const containerWidth = containerEl.offsetWidth;

    // Get measured widths from rendered hidden items
    const widths = itemWidthsRef.current;
    if (widths.size < visibleItems.length) return; // not all measured yet

    // More button width (icon + "More" + chevron ≈ 117px)
    const MORE_BUTTON_WIDTH = 120;

    let usedWidth = 0;
    let count = 0;

    for (const item of visibleItems) {
      const itemWidth = widths.get(item.to) ?? 130; // fallback estimate
      const neededWidth = count === visibleItems.length - 1
        ? itemWidth // last item, no need for More button
        : itemWidth + (count < visibleItems.length - 1 ? 0 : 0);

      // If adding this item exceeds width, but we still have more items to show,
      // we need to reserve space for the More button
      const reserveWidth = (count < visibleItems.length - 1) ? MORE_BUTTON_WIDTH : 0;

      if (usedWidth + itemWidth + (usedWidth > 0 ? 4 : 0) > containerWidth - reserveWidth) {
        break;
      }

      usedWidth += itemWidth + (usedWidth > 0 ? 4 : 0); // 4px gap
      count++;
    }

    // Ensure at least 1 item is always visible
    setVisibleCount(Math.max(1, count));
  }, [visibleItems]);

  // Use ResizeObserver to recalculate on container resize
  useEffect(() => {
    const containerEl = navRef.current?.querySelector('.credit-nav-items');
    if (!containerEl) return;

    const ro = new ResizeObserver(() => {
      measureAndCompute();
    });
    ro.observe(containerEl);
    return () => ro.disconnect();
  }, [measureAndCompute]);

  // Recompute when visibleItems change
  useEffect(() => {
    // Reset to show all, then measure
    setVisibleCount(visibleItems.length);
    // measureAndCompute will fire via ResizeObserver or layout effect
  }, [visibleItems.length]);

  const primaryItems = visibleItems.slice(0, visibleCount);
  const overflowItems = visibleItems.slice(visibleCount);
  const overflowHasActive = overflowItems.some(overflowActive);

  // Ref callback to measure each item's width
  const itemRef = useCallback((node: HTMLAnchorElement | null, to: string) => {
    if (node) {
      itemWidthsRef.current.set(to, node.offsetWidth);
    }
  }, []);

  // After render, compute visible count
  useLayoutEffect(() => {
    measureAndCompute();
  }, [measureAndCompute]);

  return (
    <nav className="sticky top-0 z-[60] bg-white border-b border-[var(--border,#e5e7eb)]" ref={navRef}>
      <div className="credit-nav-items max-w-[1200px] mx-auto flex items-center gap-1 px-4 sm:px-8">
        {primaryItems.map(item => (
          <Link
            key={item.to}
            to={item.to}
            ref={(node) => itemRef(node, item.to)}
            className={linkCls(isActive(item.to))}
            style={{ textDecoration: 'none' }}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {overflowItems.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                overflowHasActive
                  ? 'text-[#0052cc] border-[#0052cc]'
                  : 'text-text-secondary border-transparent hover:text-[#0052cc] hover:border-[#0052cc]/30'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">more_horiz</span>
              More
              <span className="material-symbols-outlined text-[14px]">
                {open ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {open && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-[var(--border,#e5e7eb)] rounded-lg shadow-lg py-1 z-[70]">
                {overflowItems.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                      isActive(item.to)
                        ? 'text-[#0052cc] bg-blue-50'
                        : 'text-text-secondary hover:text-[#0052cc] hover:bg-blue-50/50'
                    }`}
                    style={{ textDecoration: 'none' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default CreditNav;