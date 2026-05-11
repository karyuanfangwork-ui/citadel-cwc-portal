
import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';

/** Strip HTML tags so raw HTML bodies display as readable plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
import { ToastProvider } from './src/context/ToastContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { ProtectedRoute } from './src/components/ProtectedRoute';
import { hasPermission, hasAnyPermission, hasAnyRole } from './src/utils/permissions';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import * as Sentry from '@sentry/react';
import ToastContainer from './src/components/ToastContainer';
import Login from './src/pages/Login';

import Dashboard from './pages/Dashboard';
import HRServices from './pages/HRServices';
import ITSupport from './pages/ITSupport';
import GroupFinance from './pages/GroupFinance';
import MyRequests from './pages/MyRequests';
import RequestDetail from './pages/RequestDetail';
import AdminSettings from './pages/AdminSettings';
import CreateRequest from './pages/CreateRequest';
import NotificationDropdown from './src/components/NotificationDropdown';
import AgentDashboard from './pages/AgentDashboard';
import Reports from './pages/Reports';
import SearchResults from './pages/SearchResults';
import KnowledgeBase from './pages/KnowledgeBase';
import ArticleDetail from './pages/ArticleDetail';
import ApprovalQueue from './pages/ApprovalQueue';
import AssetManagement from './pages/AssetManagement';
import CrmAccountDetail from './pages/CrmAccountDetail';
import CrmOpportunityDetail from './pages/CrmOpportunityDetail';
import CrmLeadDetail from './pages/CrmLeadDetail';
import CrmContactDetail from './pages/CrmContactDetail';
import CrmDashboard from './pages/CrmDashboard';
import CrmAccounts from './pages/CrmAccounts';
import CrmContacts from './pages/CrmContacts';
import CrmLeads from './pages/CrmLeads';
import CrmOpportunities from './pages/CrmOpportunities';
import CrmPipelineView from './pages/CrmPipeline';
import CrmTeamDashboard from './pages/CrmTeamDashboard';
import CrmReports from './pages/CrmReports';
import CrmGuide from './pages/CrmGuide';
import ChangePassword from './src/pages/ChangePassword';
import ForgotPassword from './src/pages/ForgotPassword';
import ResetPassword from './src/pages/ResetPassword';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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

  // Close mobile menu on navigation
  React.useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  // Don't show header on auth pages (login, forgot-password, reset-password)
  if (['/login', '/forgot-password', '/reset-password'].includes(location.pathname)) {
    return null;
  }

  const navLinks = [
    { to: '/', label: 'Dashboard', show: true },
    { to: '/my-requests', label: 'My Requests', show: true },
    { to: '/agent', label: 'Agent Dashboard', show: hasAnyRole(user, ['ADMIN', 'AGENT']) },
    { to: '/approvals', label: 'Approvals', show: hasPermission(user, 'request:approve') },
    { to: '/assets', label: 'IT Assets', show: hasAnyPermission(user, ['asset:read']) },
    { to: '/crm', label: 'CRM', show: hasAnyPermission(user, ['crm:read']) },
    { to: '/kb', label: 'Knowledge Base', show: import.meta.env.DEV },
    { to: '/reports', label: 'Reports', show: hasPermission(user, 'report:read') },
    { to: '/admin/settings', label: 'Admin Settings', show: hasPermission(user, 'admin:access') },
  ].filter(l => l.show);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-cwc-border bg-surface/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link to="/" className="flex items-center gap-3 text-[#0052cc]">
              <div className="bg-[#0052cc] p-1.5 rounded-lg text-white">
                <span className="material-symbols-outlined block">corporate_fare</span>
              </div>
              <h2 className="text-text-primary text-lg font-bold leading-tight tracking-tight">Citadel Workplace Connect</h2>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
                    isActive(link.to) ? 'text-[#0052cc] border-[#0052cc]' : 'text-text-secondary border-transparent'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const q = (formData.get('q') as string) ?? '';
                if (q.trim()) {
                  navigate(`/search?q=${encodeURIComponent(q.trim())}`);
                }
              }}
              className="relative hidden sm:block"
            >
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-xl">search</span>
              <input
                name="q"
                type="text"
                placeholder="Search requests and articles..."
                className="w-64 pl-10 pr-4 py-1.5 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none transition-all"
              />
            </form>
            <div className="flex gap-2">
              <NotificationDropdown />
              <button aria-label="Help" className="hidden sm:flex items-center justify-center rounded-lg h-10 w-10 bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors">
                <span className="material-symbols-outlined">help</span>
              </button>
            </div>
            {isAuthenticated && user && (
              <div className="relative hidden sm:block" id="user-menu-container">
                <button
                  onClick={(e) => { e.stopPropagation(); setUserMenuOpen(!userMenuOpen); }}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-[#0052cc] flex items-center justify-center text-white text-sm font-bold">
                    {user.firstName?.[0]}{user.lastName?.[0]}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-gray-900 leading-tight">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500 leading-tight">{user.email}</p>
                  </div>
                  <span className={`material-symbols-outlined text-gray-400 text-lg transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {userMenuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50"
                >
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <Link
                    to="/change-password"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg text-gray-400">lock</span>
                    Change Password
                  </Link>
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
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center rounded-lg h-10 w-10 bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Open navigation menu"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="absolute top-0 left-0 w-72 h-full bg-surface shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100">
              <Link to="/" className="flex items-center gap-2 text-[#0052cc]" onClick={() => setMobileMenuOpen(false)}>
                <div className="bg-[#0052cc] p-1.5 rounded-lg text-white">
                  <span className="material-symbols-outlined block text-lg">corporate_fare</span>
                </div>
                <span className="text-sm font-bold text-text-primary">CWC</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="flex items-center justify-center rounded-lg h-9 w-9 text-text-secondary hover:bg-gray-100 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Mobile search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const q = (formData.get('q') as string) ?? '';
                if (q.trim()) {
                  navigate(`/search?q=${encodeURIComponent(q.trim())}`);
                  setMobileMenuOpen(false);
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
                  className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none"
                />
              </div>
            </form>

            {/* Nav links */}
            <nav className="flex flex-col py-2 flex-1 overflow-y-auto">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive(link.to) ? 'bg-brand-50 text-brand-700' : 'text-text-secondary hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* User section at bottom */}
            {isAuthenticated && user && (
              <div className="px-4 py-4 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500 mb-3">{user.email}</p>
                <Link
                  to="/change-password"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 w-full bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors text-sm font-semibold justify-center mb-2"
                >
                  <span className="material-symbols-outlined text-base">lock</span>
                  Change Password
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 w-full bg-surface-muted text-text-primary hover:bg-gray-200 transition-colors text-sm font-semibold justify-center"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const Footer = () => (
  <footer className="mt-auto border-t border-gray-100 py-10 bg-white">
    <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-2 opacity-50">
        <span className="material-symbols-outlined text-xl">corporate_fare</span>
        <span className="text-xs font-bold uppercase tracking-widest">© 2026 Citadel Group Technologies Sdn Bhd</span>
      </div>
      <div className="flex gap-8 text-xs font-medium text-gray-500">
        <a href="#" className="hover:text-[#0052cc]">Privacy Policy</a>
        <a href="#" className="hover:text-[#0052cc]">Terms of Service</a>
        <a href="#" className="hover:text-[#0052cc]">Contact Support</a>
      </div>
    </div>
  </footer>
);

const NotificationToast = () => {
  const navigate = useNavigate();
  const { toast, dismissToast } = useNotifications();
  if (!toast) return null;

  const handleClick = () => {
    if (toast.relatedRequestId) {
      navigate(`/request/${toast.relatedRequestId}`);
    }
    dismissToast();
  };

  return (
    <div
      onClick={toast.relatedRequestId ? handleClick : undefined}
      className={`fixed bottom-6 right-6 z-[9999] w-80 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-fade-in ${toast.relatedRequestId ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
    >
      <span className="material-symbols-outlined text-[#0052cc] text-xl flex-shrink-0 mt-0.5">notifications</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#101418] line-clamp-1">{toast.subject}</p>
        <p className="text-xs text-[#44546f] line-clamp-2 mt-0.5">{stripHtml(toast.body)}</p>
        {toast.relatedRequestId && (
          <p className="text-[11px] text-[#0052cc] mt-1 font-medium">Click to view request →</p>
        )}
      </div>
      <button onClick={(e) => { e.stopPropagation(); dismissToast(); }} aria-label="Close notification" className="text-[#44546f] hover:text-[#101418] flex-shrink-0">
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
};

const AppShell = () => {
  const { user } = useAuth();
  const location = useLocation();
  const authPages = ['/login', '/forgot-password', '/reset-password'];
  const showFooter = !authPages.includes(location.pathname);
  
  return (
    <NotificationProvider userId={user?.id ?? null}>
      <div className="flex flex-col min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:bg-brand-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-cwc-md focus:text-sm focus:font-bold"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-grow">
          <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />


              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/hr" element={<ProtectedRoute><HRServices /></ProtectedRoute>} />
              <Route path="/it" element={<ProtectedRoute><ITSupport /></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute><GroupFinance /></ProtectedRoute>} />
              <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
              <Route path="/request/:id" element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <RequestDetail />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/it/hardware" element={<Navigate to="/it" replace />} />
              <Route path="/agent" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute requirePermission="report:read"><Reports /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
              <Route path="/kb" element={import.meta.env.DEV ? <ProtectedRoute><KnowledgeBase /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/kb/:slug" element={import.meta.env.DEV ? <ProtectedRoute><ArticleDetail /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/approvals" element={<ProtectedRoute requirePermission="request:approve"><ApprovalQueue /></ProtectedRoute>} />
              <Route path="/assets" element={<ProtectedRoute requirePermission="asset:read"><AssetManagement /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute requirePermission="crm:read"><CrmDashboard /></ProtectedRoute>} />
              <Route path="/crm/accounts" element={<ProtectedRoute requirePermission="crm:read"><CrmAccounts /></ProtectedRoute>} />
              <Route path="/crm/accounts/:id" element={<ProtectedRoute requirePermission="crm:read"><CrmAccountDetail /></ProtectedRoute>} />
              <Route path="/crm/contacts" element={<ProtectedRoute requirePermission="crm:read"><CrmContacts /></ProtectedRoute>} />
              <Route path="/crm/contacts/:id" element={<ProtectedRoute requirePermission="crm:read"><CrmContactDetail /></ProtectedRoute>} />
              <Route path="/crm/leads" element={<ProtectedRoute requirePermission="crm:read"><CrmLeads /></ProtectedRoute>} />
              <Route path="/crm/leads/:id" element={<ProtectedRoute requirePermission="crm:read"><CrmLeadDetail /></ProtectedRoute>} />
              <Route path="/crm/opportunities" element={<ProtectedRoute requirePermission="crm:read"><CrmOpportunities /></ProtectedRoute>} />
              <Route path="/crm/opportunities/:id" element={<ProtectedRoute requirePermission="crm:read"><CrmOpportunityDetail /></ProtectedRoute>} />
              <Route path="/crm/pipeline" element={<ProtectedRoute requirePermission="crm:read"><CrmPipelineView /></ProtectedRoute>} />
              <Route path="/crm/team" element={<ProtectedRoute requirePermission="crm:admin"><CrmTeamDashboard /></ProtectedRoute>} />
              <Route path="/crm/reports" element={<ProtectedRoute requirePermission="crm:read"><CrmReports /></ProtectedRoute>} />
              <Route path="/crm/guide" element={<ProtectedRoute requirePermission="crm:read"><CrmGuide /></ProtectedRoute>} />
              <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
              <Route path="/admin/settings" element={
                <ProtectedRoute requirePermission="admin:access">
                  <ErrorBoundary>
                    <AdminSettings />
                  </ErrorBoundary>
                </ProtectedRoute>
              } />
              <Route path="/:deskType/:deskId/create/:categoryId" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
            </Routes>
          </main>
          {showFooter && <Footer />}
          <NotificationToast />
        </div>
      </NotificationProvider>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <Sentry.ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <AppShell />
              <ToastContainer />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </Sentry.ErrorBoundary>
    </BrowserRouter>
  );
}
