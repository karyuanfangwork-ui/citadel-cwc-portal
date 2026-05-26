import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import NotificationDropdown from '@/src/components/NotificationDropdown';
import type { NavLinkConfig } from './navConfig';

/** Map role strings to display labels and badge colors */
const ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  ADMIN:      { label: 'Admin',      bg: '#dc262620', text: '#dc2626' },
  GROUP_CEO:  { label: 'Group CEO',  bg: '#7c3aed20', text: '#7c3aed' },
  CEO:        { label: 'CEO',        bg: '#7c3aed20', text: '#7c3aed' },
  CTO:        { label: 'CTO',        bg: '#7c3aed20', text: '#7c3aed' },
  CFO:        { label: 'CFO',        bg: '#7c3aed20', text: '#7c3aed' },
  COO:        { label: 'COO',        bg: '#7c3aed20', text: '#7c3aed' },
  CHRO:       { label: 'CHRO',      bg: '#7c3aed20', text: '#7c3aed' },
  CMO:        { label: 'CMO',        bg: '#7c3aed20', text: '#7c3aed' },
  AGENT:      { label: 'Agent',      bg: '#2563eb20', text: '#2563eb' },
  END_USER:   { label: 'User',       bg: '#6b728020', text: '#6b7280' },
};

/** Role priority order: ADMIN > GROUP_CEO > CEO > CTO > CFO > AGENT > first role > END_USER */
const ROLE_PRIORITY = ['ADMIN', 'GROUP_CEO', 'CEO', 'CTO', 'CFO', 'AGENT'];

function primaryRole(roles: string[] | undefined): string {
  if (!roles?.length) return 'END_USER';
  for (const p of ROLE_PRIORITY) {
    if (roles.includes(p)) return p;
  }
  // Return first non-standard role if known, else END_USER
  return ROLE_BADGE[roles[0]] ? roles[0] : 'END_USER';
}

type TopBarProps = {
  navLinks: NavLinkConfig[];
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
  onOOO: () => void;
  className?: string;
};

export default function TopBar({ navLinks, onMobileMenuToggle, mobileMenuOpen, onOOO, className = '' }: TopBarProps) {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);

  // Close user menu on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const container = document.getElementById('user-menu-container');
      if (container && !container.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close on route change
  React.useEffect(() => {
    setUserMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`sticky top-0 z-20 w-full border-b border-cwc-border bg-surface/80 backdrop-blur-md h-14 overflow-visible ${className}`}>
      <div className="flex items-center justify-between h-full px-4 sm:px-6 overflow-visible">
        {/* Left: hamburger (mobile) */}
        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex items-center justify-center rounded-cwc-md h-9 w-9 bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors"
            onClick={onMobileMenuToggle}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
          >
            <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {/* Center: search */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const q = (formData.get('q') as string) ?? '';
            if (q.trim()) {
              navigate(`/search?q=${encodeURIComponent(q.trim())}`);
            }
          }}
          className="relative hidden sm:block flex-1 max-w-md mx-4"
        >
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xl">search</span>
          <input
            name="q"
            type="text"
            placeholder="Search requests and articles..."
            className="w-full pl-10 pr-4 py-1.5 bg-[#f0f2f5] border-none rounded-cwc-md text-sm focus:ring-2 focus:ring-brand-700/20 outline-none transition-all"
          />
        </form>

        {/* Right: notifications, help, user */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex gap-2">
            <NotificationDropdown />
            <button aria-label="Help" className="hidden sm:flex items-center justify-center rounded-cwc-md h-9 w-9 bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>

          {isAuthenticated && user && (
            <div className="relative hidden sm:block" id="user-menu-container">
                <button
                  onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
                  className="flex items-center gap-2 rounded-cwc-md px-2 py-1.5 hover:bg-gray-100 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-brand-700 flex items-center justify-center text-white text-sm font-bold">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                  <span className={`hidden md:inline material-symbols-outlined text-gray-400 text-lg transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-cwc-lg shadow-lg border border-gray-100 py-1 z-[70]">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const role = primaryRole(user.roles);
                        const badge = ROLE_BADGE[role] || ROLE_BADGE.END_USER;
                        return (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5"
                            style={{ background: badge.bg, color: badge.text }}
                          >
                            {badge.label}
                          </span>
                        );
                      })()}
                      {user.outOfOffice && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-medium rounded">
                          <span className="material-symbols-outlined text-xs">outbox</span>
                          OOO
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    to="/change-password"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-gray-400">lock</span>
                    Change Password
                  </Link>
                  <button
                    onClick={() => { setUserMenuOpen(false); onOOO(); }}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <span className="material-symbols-outlined text-lg text-gray-400">outbox</span>
                    {user.outOfOffice ? 'OOO Settings' : 'Set Out of Office'}
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors w-full text-left"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}