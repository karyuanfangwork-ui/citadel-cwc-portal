
import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import { ProtectedRoute } from './src/components/ProtectedRoute';
import Login from './src/pages/Login';
import Register from './src/pages/Register';
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

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close mobile menu on navigation
  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Don't show header on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  const navLinks = [
    { to: '/', label: 'Dashboard', show: true },
    { to: '/my-requests', label: 'My Requests', show: true },
    { to: '/agent', label: 'Agent Dashboard', show: !!(user?.roles?.includes('ADMIN') || user?.roles?.includes('AGENT')) },
    { to: '/reports', label: 'Reports', show: !!user?.roles?.includes('ADMIN') },
    { to: '/kb', label: 'Knowledge Base', show: true },
    { to: '/admin/settings', label: 'Admin Settings', show: !!user?.roles?.includes('ADMIN') },
  ].filter(l => l.show);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-[#f0f2f5] bg-white/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link to="/" className="flex items-center gap-3 text-[#0052cc]">
              <div className="bg-[#0052cc] p-1.5 rounded-lg text-white">
                <span className="material-symbols-outlined block">corporate_fare</span>
              </div>
              <h2 className="text-[#101418] text-lg font-bold leading-tight tracking-tight">Help Center</h2>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm font-semibold hover:text-[#0052cc] transition-colors pb-1 border-b-2 ${
                    isActive(link.to) ? 'text-[#0052cc] border-[#0052cc]' : 'text-[#44546f] border-transparent'
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
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#44546f] text-xl">search</span>
              <input
                name="q"
                type="text"
                placeholder="Search requests and articles..."
                className="w-64 pl-10 pr-4 py-1.5 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none transition-all"
              />
            </form>
            <div className="flex gap-2">
              <NotificationDropdown />
              <button className="hidden sm:flex items-center justify-center rounded-lg h-10 w-10 bg-[#f0f2f5] text-[#101418] hover:bg-gray-200 transition-colors">
                <span className="material-symbols-outlined">help</span>
              </button>
            </div>
            {isAuthenticated && user && (
              <div className="hidden sm:flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center rounded-lg h-10 px-4 bg-[#f0f2f5] text-[#101418] hover:bg-gray-200 transition-colors"
                >
                  <span className="material-symbols-outlined mr-1">logout</span>
                  <span className="text-sm font-semibold">Logout</span>
                </button>
              </div>
            )}
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center rounded-lg h-10 w-10 bg-[#f0f2f5] text-[#101418] hover:bg-gray-200 transition-colors"
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Toggle menu"
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-xl" onClick={e => e.stopPropagation()}>
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
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#44546f] text-xl">search</span>
                <input
                  name="q"
                  type="text"
                  placeholder="Search requests and articles..."
                  className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none"
                />
              </div>
            </form>
            <nav className="flex flex-col py-2">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-3 text-sm font-semibold transition-colors ${
                    isActive(link.to) ? 'text-[#0052cc] bg-blue-50' : 'text-[#44546f] hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {isAuthenticated && user && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 bg-[#f0f2f5] text-[#101418] hover:bg-gray-200 transition-colors text-sm font-semibold"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Logout
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
        <span className="material-symbols-outlined text-xl">auto_awesome</span>
        <span className="text-xs font-bold uppercase tracking-widest">Powered by Service Management</span>
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
  const { toast, dismissToast } = useNotifications();
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 bg-white border border-gray-200 rounded-xl shadow-2xl p-4 flex items-start gap-3 animate-fade-in">
      <span className="material-symbols-outlined text-[#0052cc] text-xl flex-shrink-0 mt-0.5">notifications</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#101418] line-clamp-1">{toast.subject}</p>
        <p className="text-xs text-[#44546f] line-clamp-2 mt-0.5">{toast.body}</p>
      </div>
      <button onClick={dismissToast} className="text-[#44546f] hover:text-[#101418] flex-shrink-0">
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
};

const AppShell = () => {
  const { user } = useAuth();
  return (
    <NotificationProvider userId={user?.id ?? null}>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/hr" element={<ProtectedRoute><HRServices /></ProtectedRoute>} />
              <Route path="/it" element={<ProtectedRoute><ITSupport /></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute><GroupFinance /></ProtectedRoute>} />
              <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
              <Route path="/request/:id" element={<ProtectedRoute><RequestDetail /></ProtectedRoute>} />
              <Route path="/it/hardware" element={<Navigate to="/it" replace />} />
              <Route path="/agent" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
              <Route path="/kb" element={<ProtectedRoute><KnowledgeBase /></ProtectedRoute>} />
              <Route path="/kb/:slug" element={<ProtectedRoute><ArticleDetail /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
              <Route path="/:deskType/:deskId/create/:categoryId" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
          <NotificationToast />
        </div>
      </NotificationProvider>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
