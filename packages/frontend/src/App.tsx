import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from './contexts/I18nContext';

// Components
import { LoadingIndicator } from './components/LoadingIndicator';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layout Components
import { MainLayout } from './components/layout/MainLayout';

// Pages - Auth
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import SignUpPromptPage from './pages/auth/SignUpPromptPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import AccountSuspendedPage from './pages/auth/AccountSuspendedPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// Pages - Common
import DashboardPage from './pages/common/DashboardPage';
import NotFoundPage from './pages/common/NotFoundPage';
import UnauthorizedPage from './pages/common/UnauthorizedPage';

// Pages - User
import ProfilePage from './pages/user/ProfilePage';
import SettingsPage from './pages/SettingsPage';

// Pages - Admin
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import UsersManagementPage from './pages/admin/UsersManagementPage';
import GameWorldsPage from './pages/admin/GameWorldsPage';
import WhitelistPage from './pages/admin/WhitelistPage';
import ClientVersionsPage from './pages/admin/ClientVersionsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
// import AdvancedSettingsPage from './pages/admin/AdvancedSettingsPage';

const App: React.FC = () => {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <CssBaseline />
          <SnackbarProvider
            maxSnack={3}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'center',
            }}
          >
            <Router>
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/signup-prompt" element={<SignUpPromptPage />} />
                <Route path="/pending-approval" element={<PendingApprovalPage />} />
                <Route path="/account-suspended" element={<AccountSuspendedPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                {/* Protected Routes */}
                <Route path="/" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Navigate to="/dashboard" replace />
                    </MainLayout>
                  </ProtectedRoute>
                } />

                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <DashboardPage />
                    </MainLayout>
                  </ProtectedRoute>
                } />

                <Route path="/profile" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <ProfilePage />
                    </MainLayout>
                  </ProtectedRoute>
                } />

                {/* Settings Route */}
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <SettingsPage />
                    </MainLayout>
                  </ProtectedRoute>
                } />

                {/* Advanced Settings Route - Removed */}

                {/* Admin Routes */}
                <Route path="/admin/*" element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <MainLayout>
                      <Routes>
                        <Route index element={<Navigate to="/admin/dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboardPage />} />
                        <Route path="users" element={<UsersManagementPage />} />
                        <Route path="client-versions" element={<ClientVersionsPage />} />
                        <Route path="game-worlds" element={<GameWorldsPage />} />
                        <Route path="whitelist" element={<WhitelistPage />} />
                        <Route path="audit-logs" element={<AuditLogsPage />} />
                      </Routes>
                    </MainLayout>
                  </ProtectedRoute>
                } />

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Router>
            <ToastContainer
              position="bottom-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </SnackbarProvider>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
};

export default App;

