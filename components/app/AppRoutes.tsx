import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import AuthPage from './AuthPage';
import AppLayout from './AppLayout';
import AppDashboardHome from './AppDashboardHome';
import PhasePlaceholder from './PhasePlaceholder';
import ProfileManager from './ProfileManager';
import ChatWorkspace from './ChatWorkspace';
import BillingCredits from './BillingCredits';
import SettingsPage from './SettingsPage';
import ReportsStore from './ReportsStore';
import ReportOrderDetail from './ReportOrderDetail';
import AppsHub from './AppsHub';
import MiniAppRunner from './MiniAppRunner';
import AdminPanel from '../admin/AdminPanel';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading, session, isPreviewMode } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center font-['Plus_Jakarta_Sans',sans-serif] text-sm text-[#5C5449]">
        Loading Cosmic Council Observatory...
      </div>
    );
  }

  if (!session && !isPreviewMode) {
    return <Navigate to="/app/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { appUser } = useAuth();
  if (!appUser?.is_admin) {
    return <Navigate to="/app/home" replace />;
  }
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<AuthPage />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/home" replace />} />
          <Route path="home" element={<AppDashboardHome />} />
          <Route path="dashboard" element={<Navigate to="/app/home" replace />} />
          <Route path="apps" element={<AppsHub />} />
          <Route path="apps/:appSlug" element={<MiniAppRunner />} />
          <Route path="profiles" element={<ProfileManager />} />
          <Route path="chat" element={<ChatWorkspace />} />
          <Route path="chat/:conversationId" element={<ChatWorkspace />} />
          <Route path="reports" element={<ReportsStore />} />
          <Route path="reports/:orderId" element={<ReportOrderDetail />} />
          <Route path="billing" element={<BillingCredits />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route
          path="admin/*"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <AdminPanel />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/app/home" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default AppRoutes;
