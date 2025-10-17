import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box } from '@mui/material';
import { SnackbarProvider } from 'notistack';

// MUI Date Pickers
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/zh-cn';

// MUI Locales for DatePicker
import { koKR } from '@mui/x-date-pickers/locales';
import { zhCN } from '@mui/x-date-pickers/locales';
import { enUS } from '@mui/x-date-pickers/locales';

// Styles
import './styles/fullcalendar.css';
import './styles/chat.css';
import './styles/scrollbar.css';
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';

// Components
import { LoadingIndicator } from './components/LoadingIndicator';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

// Layout Components
import { MainLayout } from './components/layout/MainLayout';

// Pages - Auth
import LoginPage from './pages/auth/LoginPage';
import LogoutPage from './pages/auth/LogoutPage';
import RegisterPage from './pages/auth/RegisterPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import AccountSuspendedPage from './pages/auth/AccountSuspendedPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import OAuthCallbackPage from './pages/auth/OAuthCallbackPage';
import InvalidInvitePage from './pages/auth/InvalidInvitePage';

// Pages - Common
import DashboardPage from './pages/common/DashboardPage';
import NotFoundPage from './pages/common/NotFoundPage';
import UnauthorizedPage from './pages/common/UnauthorizedPage';

// Pages - User
import ProfilePage from './pages/user/ProfilePage';
import SettingsPage from './pages/SettingsPage';
import TagsPage from './pages/settings/TagsPage';

// Pages - Admin
import UsersManagementPage from './pages/admin/UsersManagementPage';
import GameWorldsPage from './pages/admin/GameWorldsPage';
import WhitelistPage from './pages/admin/WhitelistPage';
import ClientVersionsPage from './pages/admin/ClientVersionsPage';
import AuditLogsPage from './pages/admin/AuditLogsPage';
import MaintenancePage from './pages/admin/MaintenancePage';
import MessageTemplatesPage from './pages/admin/MessageTemplatesPage';
import SchedulerPage from './pages/admin/SchedulerPage';

import JobsPage from './pages/admin/JobsPage';
import QueueMonitorPage from './pages/admin/QueueMonitorPage';
import CustomQueueMonitorPage from './pages/admin/CustomQueueMonitorPage';
import RemoteConfigPage from './pages/admin/RemoteConfigPage';
import RemoteConfigHistoryPage from './pages/admin/RemoteConfigHistoryPage';
import RemoteConfigDashboard from './pages/RemoteConfig/RemoteConfigParametersPage';
import ApiTokensPage from './pages/admin/ApiTokensPage';
import CrashEventsPage from './pages/admin/CrashEventsPage';
import ChatPage from './pages/chat/ChatPage';
import MailboxPage from './pages/mailbox/MailboxPage';
import SystemConsolePage from './pages/admin/SystemConsolePage';
import RealtimeEventsPage from './pages/admin/RealtimeEventsPage';
// import AdvancedSettingsPage from './pages/admin/AdvancedSettingsPage'];

// Conditional Landing Page Component
const ConditionalLandingPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return <LoadingIndicator />;
  }

  // If authenticated, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Always redirect to login page for unauthenticated users
  return <Navigate to="/login" replace />;
};

// LocalizationProvider with language support
const LocalizedDatePickers: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language } = useI18n();

  // console.log('🌍 LocalizedDatePickers - Current language:', language);

  // Set dayjs locale
  React.useEffect(() => {
    // console.log('⚙️ Setting dayjs locale for:', language);
    switch (language) {
      case 'ko':
        dayjs.locale('ko');
        // console.log('✅ Dayjs locale set to Korean');
        break;
      case 'zh':
        dayjs.locale('zh-cn');
        // console.log('✅ Dayjs locale set to Chinese');
        break;
      default:
        dayjs.locale('en');
        // console.log('✅ Dayjs locale set to English');
        break;
    }
  }, [language]);

  // Get the correct locale text
  const getLocaleText = () => {
    switch (language) {
      case 'ko':
        // console.log('🇰🇷 Using Korean locale text');
        return koKR;
      case 'zh':
        // console.log('🇨🇳 Using Chinese locale text');
        return zhCN;
      default:
        // console.log('🇺🇸 Using English locale text');
        return enUS;
    }
  };

  const localeText = getLocaleText();
  // console.log('📝 Final locale text:', localeText);

  // Force complete re-mount when language changes
  const adapterLocale = language === 'ko' ? 'ko' : language === 'zh' ? 'zh-cn' : 'en';

  // console.log('🔧 Final settings:', {
  //   language,
  //   adapterLocale,
  //   localeText: localeText?.components?.MuiLocalizationProvider?.defaultProps?.localeText
  // });

  return (
    <LocalizationProvider
      key={`picker-${language}-${adapterLocale}`}
      dateAdapter={AdapterDayjs}
      adapterLocale={adapterLocale}
      localeText={localeText?.components?.MuiLocalizationProvider?.defaultProps?.localeText}
    >
      {children}
    </LocalizationProvider>
  );
};

// Auth Initializer - Shows loading screen while checking authentication
const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'background.default',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            height: '60px',
          }}
        >
          {[0, 1, 2].map((index) => (
            <Box
              key={index}
              sx={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                animation: 'dotWave 1.4s infinite ease-in-out',
                animationDelay: `${index * 0.15}s`,
                '@keyframes dotWave': {
                  '0%, 60%, 100%': {
                    transform: 'translateY(0) scale(1)',
                    opacity: 0.4,
                  },
                  '30%': {
                    transform: 'translateY(-20px) scale(1.2)',
                    opacity: 1,
                  },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
};

// App Content with LocalizedDatePickers inside I18nProvider
const AppContent: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthInitializer>
          <LocalizedDatePickers>
            <CssBaseline />
            <SnackbarProvider
              maxSnack={3}
              autoHideDuration={3000}
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'center',
              }}
              style={{ zIndex: 99999 }}
            >
              <Router>
                <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/logout" element={<LogoutPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/signup" element={<RegisterPage />} />
                <Route path="/invalid-invite" element={<InvalidInvitePage />} />
                <Route path="/pending-approval" element={<PendingApprovalPage />} />
                <Route path="/auth/pending" element={<PendingApprovalPage />} />
                <Route path="/auth/callback" element={<OAuthCallbackPage />} />
                <Route path="/account-suspended" element={<AccountSuspendedPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                {/* Landing Page - only for first-time visitors */}
                <Route path="/" element={<ConditionalLandingPage />} />

                {/* Protected Routes */}

                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <DashboardPage />
                    </MainLayout>
                  </ProtectedRoute>
                } />

                <Route path="/chat" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <ChatPage />
                    </MainLayout>
                  </ProtectedRoute>
                } />

                <Route path="/mailbox" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <MailboxPage />
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

                {/* Settings Routes */}
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <SettingsPage />
                    </MainLayout>
                  </ProtectedRoute>
                } />
                <Route path="/settings/tags" element={
                  <ProtectedRoute>
                    <MainLayout>
                      <TagsPage />
                    </MainLayout>
                  </ProtectedRoute>
                } />

                {/* Advanced Settings Route - Removed */}

                {/* Admin Routes */}
                <Route path="/admin/*" element={
                  <ProtectedRoute requiredRoles={['admin']}>
                    <MainLayout>
                      <Routes>
                        <Route index element={<Navigate to="/admin/users" replace />} />
                        <Route path="users" element={<UsersManagementPage />} />
                        <Route path="client-versions" element={<ClientVersionsPage />} />
                        <Route path="game-worlds" element={<GameWorldsPage />} />
                        <Route path="maintenance" element={<MaintenancePage />} />
                        <Route path="maintenance-templates" element={<MessageTemplatesPage />} />
                        <Route path="scheduler" element={<SchedulerPage />} />
                        <Route path="whitelist" element={<WhitelistPage />} />

                        <Route path="jobs" element={<JobsPage />} />
                        <Route path="queue-monitor" element={<QueueMonitorPage />} />
                        <Route path="audit-logs" element={<AuditLogsPage />} />
                        <Route path="realtime-events" element={<RealtimeEventsPage />} />
                        <Route path="crash-events" element={<CrashEventsPage />} />
                        <Route path="remote-config" element={<RemoteConfigDashboard />} />
                        <Route path="remote-config-old" element={<RemoteConfigPage />} />
                        <Route path="remote-config/history" element={<RemoteConfigHistoryPage />} />
                        <Route path="api-tokens" element={<ApiTokensPage />} />
                        <Route path="console" element={<SystemConsolePage />} />
                      </Routes>
                    </MainLayout>
                  </ProtectedRoute>
                } />

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Router>
          </SnackbarProvider>
        </LocalizedDatePickers>
        </AuthInitializer>
      </AuthProvider>
    </ThemeProvider>
  );
};

const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};

export default App;
