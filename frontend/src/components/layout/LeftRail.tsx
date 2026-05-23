import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { NavLinkConfig } from './navConfig';
import type { User } from '@/src/context/AuthContext';

/** Map role strings to display labels and badge colors */
const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  ADMIN:  { label: 'Admin',  bg: '#dc262620', text: '#dc2626' },
  AGENT:  { label: 'Agent',  bg: '#2563eb20', text: '#2563eb' },
  END_USER: { label: 'User', bg: '#6b728020', text: '#6b7280' },
};

function primaryRole(roles: string[] | undefined): string {
  if (!roles?.length) return 'END_USER';
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('AGENT')) return 'AGENT';
  return roles[0];
}

type LeftRailProps = {
  navLinks: NavLinkConfig[];
  isActive: (path: string) => boolean;
  user: User | null;
  onOOO: () => void;
  onLogout: () => void;
  className?: string;
};

const groupLabels: Record<string, string> = {
  primary: 'Main',
  'service-desks': 'Service Desks',
  tools: 'Tools',
  admin: 'Admin',
};

export default function LeftRail({ navLinks, isActive, user, onOOO, onLogout, className = '' }: LeftRailProps) {
  const [expanded, setExpanded] = React.useState(false);
  const navigate = useNavigate();

  const visibleLinks = navLinks.filter((l) => l.show);
  const groups = ['primary', 'service-desks', 'tools', 'admin'] as const;
  const initials = user ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}` : '?';

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`hidden lg:flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-200 ease-in-out z-30 flex-shrink-0 ${
        expanded ? 'w-60' : 'w-16'
      } ${className}`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-3 px-3 border-b border-gray-100 flex-shrink-0 ${expanded ? 'py-3' : 'py-3'}`}>
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
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Main navigation">
        {/* New Request CTA */}
        <div className="px-2 pb-1">
          <Link
            to="/it"
            title="New Request"
            className={`flex items-center gap-2 rounded-cwc-md bg-brand-700 text-white text-sm font-bold h-9 transition-colors hover:bg-brand-800 ${
              expanded ? 'px-3' : 'px-0 justify-center'
            }`}
          >
            <span className="material-symbols-outlined text-lg flex-shrink-0">add_circle</span>
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-200 ${
                expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0'
              }`}
            >
              New Request
            </span>
          </Link>
        </div>

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

      {/* User section */}
      {user && (
        <div className="border-t border-gray-100 px-3 py-3 flex-shrink-0">
          <div className={`flex items-center gap-2 ${expanded ? '' : 'justify-center'}`}>
            <div className="h-8 w-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initials}
            </div>
            {expanded && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                  {user.firstName} {user.lastName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {(() => {
                    const role = primaryRole(user.roles);
                    const badge = ROLE_BADGE[role] || ROLE_BADGE.END_USER;
                    return (
                      <span
                        className="inline-flex items-center text-[9px] font-bold rounded-full px-1.5 py-px"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                  {user.outOfOffice && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-px bg-amber-100 text-amber-800 text-[9px] font-bold rounded-full">
                      <span className="material-symbols-outlined" style={{ fontSize: 10 }}>outbox</span>
                      OOO
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          {expanded && (
            <div className="mt-2 flex flex-col gap-1">
              <button
                onClick={onOOO}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-cwc-md transition-colors w-full text-left"
              >
                <span className="material-symbols-outlined text-lg text-gray-400">outbox</span>
                {user.outOfOffice ? 'OOO Settings' : 'Set OOO'}
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-cwc-md transition-colors w-full text-left"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                Sign Out
              </button>
            </div>
          )}
          {!expanded && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <button
                onClick={onOOO}
                title={user.outOfOffice ? 'Out of Office Settings' : 'Set Out of Office'}
                className="flex items-center justify-center h-8 w-8 rounded-cwc-md text-gray-400 hover:bg-gray-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">outbox</span>
              </button>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="flex items-center justify-center h-8 w-8 rounded-cwc-md text-red-500 hover:bg-red-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}