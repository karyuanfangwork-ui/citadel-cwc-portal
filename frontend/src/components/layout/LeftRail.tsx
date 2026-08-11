import React from 'react';
import { Link } from 'react-router-dom';
import type { NavLinkConfig } from './navConfig';

type LeftRailProps = {
  navLinks: NavLinkConfig[];
  isActive: (path: string) => boolean;
  className?: string;
};

const groupLabels: Record<string, string> = {
  primary: 'Main',
  'service-desks': 'Service Desks',
  tools: 'Tools',
  admin: 'Admin',
};

export default function LeftRail({ navLinks, isActive, className = '' }: LeftRailProps) {
  const [hoverExpanded, setHoverExpanded] = React.useState(false);
  const [pinned, setPinned] = React.useState(() => {
    try { return localStorage.getItem('cwc-sidebar-pinned') === 'true'; } catch { return false; }
  });
  const expanded = pinned || hoverExpanded;

  const togglePin = React.useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      try { localStorage.setItem('cwc-sidebar-pinned', String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const visibleLinks = navLinks.filter((l) => l.show);
  const groups = ['primary', 'service-desks', 'tools', 'admin'] as const;

  return (
    <aside
      onMouseEnter={() => { if (!pinned) setHoverExpanded(true); }}
      onMouseLeave={() => { if (!pinned) setHoverExpanded(false); }}
      className={`hidden lg:flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-200 ease-in-out z-30 flex-shrink-0 ${
        expanded ? 'w-60' : 'w-16'
      } ${className}`}
    >
      {/* Brand */}
      <Link to="/" className={`flex items-center gap-3 px-3 border-b border-gray-100 flex-shrink-0 hover:bg-brand-50/50 transition-colors ${expanded ? 'py-3' : 'py-3'}`}>
        <div className="bg-brand-700 p-1.5 rounded-cwc-md text-white flex-shrink-0">
          <span className="material-symbols-outlined block text-lg">corporate_fare</span>
        </div>
        <span
          className={`leading-tight transition-all duration-200 ${
            expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          }`}
        >
          <span className="block text-sm font-bold text-text-primary leading-none">Citadel</span>
          <span className="block text-[11px] font-semibold text-text-secondary leading-none mt-0.5">Workplace Connect</span>
        </span>
      </Link>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
        {groups.map((group) => {
          const links = visibleLinks.filter((l) => l.group === group);
          if (links.length === 0) return null;
          return (
            <div key={group} className="mb-1">
              {expanded && (
                <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                  {groupLabels[group]}
                </p>
              )}
              {links.map((link) => {
                const active = isActive(link.to);
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    title={link.label}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 mx-2 my-0.5 rounded-cwc-md transition-colors text-sm font-semibold h-9 ${
                      expanded ? 'px-3' : 'px-0 justify-center'
                    } ${
                      active
                        ? 'bg-brand-50 text-brand-700 border-l-2 border-brand-700'
                        : 'text-text-secondary hover:bg-gray-50 border-l-2 border-transparent'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg flex-shrink-0">{link.icon}</span>
                    <span
                      className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
                        expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
                      }`}
                    >
                      {link.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Pin / Auto-hide toggle */}
      <div className="flex-shrink-0 border-t border-gray-100 px-2 py-1.5">
        <button
          onClick={togglePin}
          title={pinned ? 'Switch to auto-hide' : 'Pin sidebar open'}
          className={`flex items-center gap-2 w-full rounded-cwc-md transition-colors text-sm font-medium h-8 ${
            pinned
              ? 'px-3 text-brand-700 bg-brand-50 hover:bg-brand-100'
              : 'px-0 justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600'
          }`}
        >
          <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ fontSize: 18 }}>
            {pinned ? 'lock' : 'lock_open'}
          </span>
          <span
            className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
              expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
            }`}
          >
            {pinned ? 'Pinned' : 'Auto-hide'}
          </span>
        </button>
      </div>
    </aside>
  );
}