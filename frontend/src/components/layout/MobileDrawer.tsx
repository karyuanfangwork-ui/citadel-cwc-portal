import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useFocusTrap } from '@/src/hooks/useFocusTrap';
import type { NavLinkConfig } from './navConfig';
import type { User } from '@/src/context/AuthContext';

/** Map role strings to display labels and badge colors */
const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  ADMIN:      { label: 'Admin',      bg: '#dc262620', text: '#dc2626' },
  GROUP_DCEO:  { label: 'Group Deputy CEO',  bg: '#7c3aed20', text: '#7c3aed' },
  CEO:        { label: 'CEO',        bg: '#7c3aed20', text: '#7c3aed' },
  CTO:        { label: 'CTO',        bg: '#7c3aed20', text: '#7c3aed' },
  CFO:        { label: 'CFO',        bg: '#7c3aed20', text: '#7c3aed' },
  COO:        { label: 'COO',        bg: '#7c3aed20', text: '#7c3aed' },
  CHRO:       { label: 'CHRO',      bg: '#7c3aed20', text: '#7c3aed' },
  CMO:        { label: 'CMO',        bg: '#7c3aed20', text: '#7c3aed' },
  AGENT:      { label: 'Agent',      bg: '#2563eb20', text: '#2563eb' },
  END_USER:   { label: 'User',       bg: '#6b728020', text: '#6b7280' },
};

/** Role priority order: ADMIN > GROUP_DCEO > CEO > CTO > CFO > AGENT > first role > END_USER */
const ROLE_PRIORITY = ['ADMIN', 'GROUP_DCEO', 'CEO', 'CTO', 'CFO', 'AGENT'];

function primaryRole(roles: string[] | undefined): string {
  if (!roles?.length) return 'END_USER';
  for (const p of ROLE_PRIORITY) {
    if (roles.includes(p)) return p;
  }
  // Return first non-standard role if known, else END_USER
  return ROLE_BADGE[roles[0]] ? roles[0] : 'END_USER';
}

type MobileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  navLinks: NavLinkConfig[];
  isActive: (path: string) => boolean;
  user: User | null;
  onOOO: () => void;
  onLogout: () => void;
};

const groupLabels: Record<string, string> = {
  primary: 'Main',
  'service-desks': 'Service Desks',
  tools: 'Modules',
  admin: 'Admin',
};

export default function MobileDrawer({ isOpen, onClose, navLinks, isActive, user, onOOO, onLogout }: MobileDrawerProps) {
  const drawerRef = useFocusTrap(isOpen);
  const navigate = useNavigate();
  const location = useLocation();
  const visibleLinks = navLinks.filter((l) => l.show);
  const groups = ['primary', 'service-desks', 'tools', 'admin'] as const;

  // Escape closes drawer
  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Lock body scroll
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Close on navigation
  React.useEffect(() => {
    onClose();
  }, [location.pathname]);

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-40" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        className="absolute top-0 left-0 w-72 h-full bg-surface shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <Link to="/" className="flex items-center gap-2 text-brand-700" onClick={onClose}>
            <div className="bg-brand-700 p-1.5 rounded-cwc-md text-white">
              <span className="material-symbols-outlined block text-lg">corporate_fare</span>
            </div>
            <span className="text-sm font-bold text-text-primary">CWC</span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="flex items-center justify-center rounded-cwc-md h-9 w-9 text-text-secondary hover:bg-gray-100 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const q = (formData.get('q') as string) ?? '';
            if (q.trim()) {
              navigate(`/search?q=${encodeURIComponent(q.trim())}`);
              onClose();
            }
          }}
          className="px-4 pt-4"
        >
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xl">search</span>
            <input
              name="q"
              type="text"
              placeholder="Search requests and articles..."
              className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] border-none rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 outline-none"
            />
          </div>
        </form>

        {/* Nav links */}
        <nav className="flex flex-col py-2 flex-1 overflow-y-auto">
          {groups.map((group) => {
            const links = visibleLinks.filter((l) => l.group === group);
            if (links.length === 0) return null;
            return (
              <React.Fragment key={group}>
                <p className="px-4 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                  {groupLabels[group]}
                </p>
                {links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={onClose}
                    aria-current={isActive(link.to) ? 'page' : undefined}
                    className={`flex items-center gap-2.5 px-4 py-3 text-sm font-semibold transition-colors ${
                      isActive(link.to) ? 'bg-brand-50 text-brand-700' : 'text-text-secondary hover:bg-gray-50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </React.Fragment>
            );
          })}
        </nav>

        {/* User section */}
        {user && (
          <div className="px-4 py-4 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
            <p className="text-xs text-gray-500 mb-1">{user.email}</p>
            <div className="flex items-center gap-2 mb-2">
              {(() => {
                const role = primaryRole(user.roles);
                const badge = ROLE_BADGE[role] || ROLE_BADGE.END_USER;
                return (
                  <span
                    className="inline-flex items-center text-[10px] font-bold rounded-full px-2 py-0.5"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {badge.label}
                  </span>
                );
              })()}
              {user.tenantId && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-teal-50 text-teal-700">
                  <span className="material-symbols-outlined text-xs">business</span>
                  Citadel
                </span>
              )}
              {user.outOfOffice && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                  <span className="material-symbols-outlined text-xs">outbox</span>
                  OOO
                </span>
              )}
            </div>
            <button
              onClick={() => { onOOO(); onClose(); }}
              className="flex items-center gap-1.5 rounded-cwc-md px-3 py-2 w-full bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors text-sm font-semibold justify-center mb-2"
            >
              <span className="material-symbols-outlined text-base">outbox</span>
              {user.outOfOffice ? 'OOO Settings' : 'Set OOO'}
            </button>
            <Link
              to="/change-password"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-cwc-md px-3 py-2 w-full bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors text-sm font-semibold justify-center mb-2"
            >
              <span className="material-symbols-outlined text-base">lock</span>
              Change Password
            </Link>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-cwc-md px-3 py-2 w-full bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors text-sm font-semibold justify-center"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}