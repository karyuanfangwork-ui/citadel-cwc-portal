
import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ProtectedRoute } from './src/components/ProtectedRoute';
import Login from './src/pages/Login';
import Register from './src/pages/Register';
import Dashboard from './pages/Dashboard';
import HRServices from './pages/HRServices';
import ITSupport from './pages/ITSupport';
import GroupFinance from './pages/GroupFinance';
import MyRequests from './pages/MyRequests';
import RequestDetail from './pages/RequestDetail';
import HardwareForm from './pages/HardwareForm';
import AdminSettings from './pages/AdminSettings';
import CreateRequest from './pages/CreateRequest';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Don't show header on login/register pages
  if (location.pathname === '/login' || location.pathname === '/register') {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#f0f2f5] bg-white/80 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-3 text-[#0052cc]">
            <div className="bg-[#0052cc] p-1.5 rounded-lg text-white">
              <span className="material-symbols-outlined block">corporate_fare</span>
            </div>
            <h2 className="text-[#101418] text-lg font-bold leading-tight tracking-tight">Help Center</h2>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link to="/" className={`text-sm font-semibold hover:text-[#0052cc] transition-colors ${isActive('/') ? 'text-[#0052cc]' : 'text-[#44546f]'}`}>Dashboard</Link>
            <Link to="/my-requests" className={`text-sm font-semibold hover:text-[#0052cc] transition-colors ${isActive('/my-requests') ? 'text-[#0052cc]' : 'text-[#44546f]'}`}>My Requests</Link>
            <a href="#" className="text-sm font-semibold text-[#44546f] hover:text-[#0052cc] transition-colors">Knowledge Base</a>
            {user?.roles?.includes('ADMIN') && (
              <Link to="/admin/settings" className={`text-sm font-semibold hover:text-[#0052cc] transition-colors ${isActive('/admin/settings') ? 'text-[#0052cc]' : 'text-[#44546f]'}`}>Admin Settings</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#5e718d] text-xl">search</span>
            <input
              type="text"
              placeholder="Search help articles..."
              className="w-64 pl-10 pr-4 py-1.5 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-2 focus:ring-[#0052cc]/20 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-[#f0f2f5] text-[#101418] hover:bg-gray-200 transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="flex items-center justify-center rounded-lg h-10 w-10 bg-[#f0f2f5] text-[#101418] hover:bg-gray-200 transition-colors">
              <span className="material-symbols-outlined">help</span>
            </button>
          </div>
          {isAuthenticated && user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
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
        </div>
      </div>
    </header>
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

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
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
              <Route path="/it/hardware" element={<ProtectedRoute><HardwareForm /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSettings /></ProtectedRoute>} />
              <Route path="/:deskType/:deskId/create/:categoryId" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </HashRouter>
  );
}
