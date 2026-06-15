import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider, useNotifications } from './src/context/NotificationContext';
import notificationService from './src/services/notification.service';

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
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { isFeatureEnabled } from './src/lib/featureFlags';
import * as Sentry from '@sentry/react';
import ToastContainer from './src/components/ToastContainer';
import SessionExpiryBanner from './src/components/SessionExpiryBanner';
import EnvironmentBanner from './src/components/ui/EnvironmentBanner';
import OutOfOfficeModal from './src/components/ui/OutOfOfficeModal';
import { Toaster } from 'react-hot-toast';
import Login from './src/pages/Login';

import Dashboard from './pages/Dashboard';
import HRServices from './pages/HRServices';
import ITSupport from './pages/ITSupport';
import GroupFinance from './pages/GroupFinance';
import MyRequests from './pages/MyRequests';
import RequestDetail from './pages/RequestDetail';
import AdminSettings from './pages/AdminSettings';
import AuditTrail from './pages/AuditTrail';
import UnifiedInbox from './pages/UnifiedInbox';
import CreateRequest from './pages/CreateRequest';
import AgentDashboard from './pages/AgentDashboard';
import Reports from './pages/Reports';
import Insights from './pages/Insights';
import SearchResults from './pages/SearchResults';
import KnowledgeBase from './pages/KnowledgeBase';
import ArticleDetail from './pages/ArticleDetail';
import ApprovalQueue from './pages/ApprovalQueue';
import ApprovalCenter from './pages/ApprovalCenter';
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

import CrmTeamDashboard from './pages/CrmTeamDashboard';
import CrmReports from './pages/CrmReports';
import CrmGuide from './pages/CrmGuide';
import CrmImportExport from './pages/CrmImportExport';
import CrmTerritories from './pages/CrmTerritories';
import CrmTerritoryDetail from './pages/CrmTerritoryDetail';
import CrmQuotaDashboard from './pages/CrmQuotaDashboard';
import CrmWorkflows from './pages/CrmWorkflows';
import CrmWorkflowBuilder from './pages/CrmWorkflowBuilder';
import CrmWorkflowDetail from './pages/CrmWorkflowDetail';
import CrmIntegrationsSettings from './pages/CrmIntegrationsSettings';
import CrmAnomalyConfigPage from './pages/CrmAnomalyConfig';
import CrmCustomFieldAdmin from './pages/CrmCustomFieldAdmin';
import CrmDuplicates from './pages/CrmDuplicates';
import CrmLeadScoringAdmin from './pages/CrmLeadScoringAdmin';
import CrmAssignmentRulesAdmin from './pages/CrmAssignmentRulesAdmin';
import CrmLayout from './src/components/crm/CrmLayout';
import CreditDashboard from './pages/credit/CreditDashboard';
import CreditReports from './pages/credit/CreditReports';
import GroupExposurePage from './pages/credit/GroupExposurePage';
import BorrowerProfileList from './pages/BorrowerProfileList';
import BorrowerProfileDetail from './pages/BorrowerProfileDetail';
import CreditApplicationList from './pages/CreditApplicationList';
import CreditApplicationDetail from './pages/CreditApplicationDetail';
import MyApprovals from './pages/MyApprovals';
import FinancialSpreading from './pages/FinancialSpreading';
import FinancialAnalysis from './pages/FinancialAnalysis';
import ScorecardManagement from './pages/ScorecardManagement';
import CommitteeMeetings from './pages/CommitteeMeetings';
import CommitteeMeetingDetail from './pages/credit/CommitteeMeetingDetail';
import CommitteeMobileVote from './pages/credit/CommitteeMobileVote';
import MobileApprovalInbox from './pages/credit/MobileApprovalInbox';
import CreditApplicationMobileSummary from './pages/credit/CreditApplicationMobileSummary';
import CollateralManagement from './pages/CollateralManagement';
import Announcements from './pages/Announcements';
import AnnouncementsManage from './pages/AnnouncementsManage';
import AnnouncementDetail from './pages/AnnouncementDetail';
import ChangePassword from './src/pages/ChangePassword';
import ForgotPassword from './src/pages/ForgotPassword';
import ResetPassword from './src/pages/ResetPassword';
import NotFound from './pages/NotFound';

import LeftRail from './src/components/layout/LeftRail';
import MobileDrawer from './src/components/layout/MobileDrawer';
import TopBar from './src/components/layout/TopBar';
import { buildNavLinks } from './src/components/layout/navConfig';

const Footer = () => (
  <footer className="mt-auto border-t border-gray-100 py-4 bg-white">
    <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
      <div className="flex items-center gap-2 opacity-50">
        <span className="material-symbols-outlined text-xl">corporate_fare</span>
        <span className="text-xs font-bold uppercase tracking-widest">© 2026 Citadel Group Technologies Sdn Bhd</span>
      </div>
      <div className="flex gap-8 text-xs font-medium text-gray-500">
        <span className="opacity-60" title="Coming soon">Privacy Policy</span>
        <span className="opacity-60" title="Coming soon">Terms of Service</span>
        <a href="mailto:support@citadelgroup.com.my" className="hover:text-[#0052cc]">Contact Support</a>
      </div>
    </div>
  </footer>
);

const NotificationToast = () => {
  const navigate = useNavigate();
  const { toast, dismissToast, setUnreadCount } = useNotifications();
  if (!toast) return null;

  const handleClick = () => {
    if (toast.relatedRequestId) {
      navigate(`/request/${toast.relatedRequestId}`);
    }
    // Mark the notification as read when the user clicks the toast
    if (toast.id) {
      notificationService.markAsRead(toast.id).catch(() => {});
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    dismissToast();
  };

  return (
    <div
      onClick={toast.relatedRequestId ? handleClick : undefined}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed bottom-6 right-6 z-[9999] w-80 bg-white border border-gray-200 rounded-cwc-lg shadow-2xl p-4 flex items-start gap-3 animate-fade-in ${toast.relatedRequestId ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
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
  const { user, logout, updateOutOfOffice } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [oooModalOpen, setOooModalOpen] = React.useState(false);

  const authPages = ['/login', '/forgot-password', '/reset-password'];
  const isAuthPage = authPages.includes(location.pathname);
  const navLinks = buildNavLinks(user);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Auth pages: no layout, just render routes
  if (isAuthPage) {
    return (
      <NotificationProvider userId={user?.id ?? null}>
        <div className="flex flex-col min-h-screen">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:bg-brand-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-cwc-md focus:text-sm focus:font-bold"
          >
            Skip to main content
          </a>
          <EnvironmentBanner />
          <main id="main-content" className="flex-grow">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Routes>
          </main>
          <NotificationToast />
          <SessionExpiryBanner />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider userId={user?.id ?? null}>
      <div className="flex h-screen overflow-visible">
        {/* Left rail - desktop only */}
        <LeftRail
          navLinks={navLinks}
          isActive={isActive}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-screen overflow-visible">
          <TopBar
            navLinks={navLinks}
            onMobileMenuToggle={() => setMobileMenuOpen((o) => !o)}
            mobileMenuOpen={mobileMenuOpen}
            onOOO={() => setOooModalOpen(true)}
          />

          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[999] focus:bg-brand-700 focus:text-white focus:px-4 focus:py-2 focus:rounded-cwc-md focus:text-sm focus:font-bold"
          >
            Skip to main content
          </a>
          <EnvironmentBanner />

          <main id="main-content" className="flex-grow overflow-auto">
            <Routes>
              {/* Protected routes */}
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/hr" element={<ProtectedRoute><HRServices /></ProtectedRoute>} />
              <Route path="/it" element={<ProtectedRoute><ITSupport /></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute><GroupFinance /></ProtectedRoute>} />
              <Route path="/my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
              <Route path="/request/:id" element={<ProtectedRoute><ErrorBoundary><RequestDetail /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/it/hardware" element={<Navigate to="/it" replace />} />
              <Route path="/agent" element={<ProtectedRoute><AgentDashboard /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute requirePermission="report:read"><Reports /></ProtectedRoute>} />
              <Route path="/insights" element={<ProtectedRoute requirePermission="report:read"><Insights /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
              <Route path="/kb" element={isFeatureEnabled('kb') ? <ProtectedRoute><KnowledgeBase /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/kb/:slug" element={isFeatureEnabled('kb') ? <ProtectedRoute><ArticleDetail /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/approvals" element={<ProtectedRoute><ApprovalCenter /></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><UnifiedInbox /></ProtectedRoute>} />
              <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
              <Route path="/announcements/:id" element={<ProtectedRoute><AnnouncementDetail /></ProtectedRoute>} />
              <Route path="/admin/announcements" element={<ProtectedRoute requirePermission="announcement:write"><AnnouncementsManage /></ProtectedRoute>} />
              <Route path="/assets" element={<ProtectedRoute requirePermission="asset:read"><AssetManagement /></ProtectedRoute>} />
              <Route
                element={(
                  <ProtectedRoute requirePermission="crm:read">
                    <CrmLayout />
                  </ProtectedRoute>
                )}
              >
                <Route path="/crm" element={<CrmDashboard />} />
                <Route path="/crm/accounts" element={<CrmAccounts />} />
                <Route path="/crm/accounts/:id" element={<CrmAccountDetail />} />
                <Route path="/crm/contacts" element={<CrmContacts />} />
                <Route path="/crm/contacts/:id" element={<CrmContactDetail />} />
                <Route path="/crm/leads" element={<CrmLeads />} />
                <Route path="/crm/leads/:id" element={<CrmLeadDetail />} />
                <Route path="/crm/opportunities" element={<CrmOpportunities />} />
                <Route path="/crm/opportunities/:id" element={<CrmOpportunityDetail />} />

                <Route path="/crm/team" element={<CrmTeamDashboard />} />
                <Route path="/crm/reports" element={<CrmReports />} />
                <Route path="/crm/guide" element={<CrmGuide />} />
                <Route path="/crm/import-export" element={<CrmImportExport />} />
                <Route path="/crm/territories" element={<CrmTerritories />} />
                <Route path="/crm/territories/:id" element={<CrmTerritoryDetail />} />
                <Route path="/crm/quotas" element={<CrmQuotaDashboard />} />
                <Route path="/crm/workflows" element={<CrmWorkflows />} />
                <Route path="/crm/workflows/new" element={<CrmWorkflowBuilder />} />
                <Route path="/crm/workflows/:id" element={<CrmWorkflowDetail />} />
                <Route path="/crm/integrations" element={<CrmIntegrationsSettings />} />
                <Route path="/crm/anomalies" element={<CrmAnomalyConfigPage />} />
                <Route path="/crm/custom-fields" element={<CrmCustomFieldAdmin />} />
                <Route path="/crm/duplicates" element={<CrmDuplicates />} />
                <Route path="/crm/lead-scoring" element={<CrmLeadScoringAdmin />} />
                <Route path="/crm/assignment-rules" element={<CrmAssignmentRulesAdmin />} />
              </Route>
              {/* Credit Module routes */}
              <Route path="/credit" element={<ProtectedRoute requirePermission="credit:read"><CreditDashboard /></ProtectedRoute>} />
              <Route path="/credit/borrowers" element={<ProtectedRoute requirePermission="credit:read"><BorrowerProfileList /></ProtectedRoute>} />
              <Route path="/credit/borrowers/:id" element={<ProtectedRoute requirePermission="credit:read"><BorrowerProfileDetail /></ProtectedRoute>} />
              <Route path="/credit/applications" element={<ProtectedRoute requirePermission="credit:read"><CreditApplicationList /></ProtectedRoute>} />
              <Route path="/credit/applications/:id" element={<ProtectedRoute requirePermission="credit:read"><CreditApplicationDetail /></ProtectedRoute>} />
              <Route path="/credit/approvals" element={<ProtectedRoute requirePermission="credit:approve"><MyApprovals /></ProtectedRoute>} />
              <Route path="/credit/financials" element={<ProtectedRoute requirePermission="credit:read"><FinancialSpreading /></ProtectedRoute>} />
              <Route path="/credit/analysis" element={<ProtectedRoute requirePermission="credit:read"><FinancialAnalysis /></ProtectedRoute>} />
              <Route path="/credit/scorecards" element={<ProtectedRoute requirePermission="credit:admin"><ScorecardManagement /></ProtectedRoute>} />
              <Route path="/credit/committee" element={<ProtectedRoute requirePermission="credit:read"><CommitteeMeetings /></ProtectedRoute>} />
              <Route path="/credit/committee/:meetingId" element={<ProtectedRoute requirePermission="credit:read"><CommitteeMeetingDetail /></ProtectedRoute>} />
              <Route path="/credit/m/committee/:meetingId" element={<ProtectedRoute requirePermission="credit:approve"><CommitteeMobileVote /></ProtectedRoute>} />
              <Route path="/credit/m/approvals" element={<ProtectedRoute requirePermission="credit:approve"><MobileApprovalInbox /></ProtectedRoute>} />
              <Route path="/credit/m/applications/:id" element={<ProtectedRoute requirePermission="credit:read"><CreditApplicationMobileSummary /></ProtectedRoute>} />
              <Route path="/credit/collateral" element={<ProtectedRoute requirePermission="credit:read"><CollateralManagement /></ProtectedRoute>} />
              <Route path="/credit/reports" element={<ProtectedRoute requirePermission="credit:read"><CreditReports /></ProtectedRoute>} />
              <Route path="/credit/group-exposure" element={<ProtectedRoute requirePermission="credit:read"><GroupExposurePage /></ProtectedRoute>} />
              <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute requirePermission="admin:access"><ErrorBoundary><AdminSettings /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/admin/audit" element={<ProtectedRoute requirePermission="admin:access"><ErrorBoundary><AuditTrail /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/:deskType/:deskId/create/:categoryId" element={<ProtectedRoute><CreateRequest /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </div>

      {/* Mobile drawer - mobile only */}
      <MobileDrawer
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navLinks={navLinks}
        isActive={isActive}
        user={user}
        onOOO={() => { setOooModalOpen(true); setMobileMenuOpen(false); }}
        onLogout={handleLogout}
      />

      <OutOfOfficeModal
        isOpen={oooModalOpen}
        onClose={() => setOooModalOpen(false)}
        isCurrentlyOOO={!!user?.outOfOffice}
        currentUntil={user?.outOfOfficeUntil ?? null}
        currentMessage={user?.outOfOfficeMessage ?? null}
        onSubmit={updateOutOfOffice}
      />
      <NotificationToast />
      <SessionExpiryBanner />
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
              <Toaster position="top-right" gutter={8} toastOptions={{ duration: 4000, style: { background: '#1a1a2e', color: '#fff' } }} />
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </Sentry.ErrorBoundary>
    </BrowserRouter>
  );
}
