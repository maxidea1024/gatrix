import React, { Suspense } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { CssBaseline, Box, GlobalStyles, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { SnackbarProvider, closeSnackbar } from 'notistack';

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
import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import './styles/fullcalendar.css';
import './styles/chat.css';
import './styles/scrollbar.css'; // Must be last to override all other scrollbar styles

// Contexts
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider, useI18n } from './contexts/I18nContext';
import { PlatformConfigProvider } from './contexts/PlatformConfigContext';
import { GameWorldProvider } from './contexts/GameWorldContext';
import { PlanningDataProvider } from './contexts/PlanningDataContext';
import { EnvironmentProvider } from './contexts/EnvironmentContext';
import { OrgProjectProvider } from './contexts/OrgProjectContext';

// Components - always needed for app shell
import { LoadingIndicator } from './components/LoadingIndicator';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './contexts/AuthContext';

// Layout Components - always needed for app shell
import { MainLayout } from './components/layout/MainLayout';
import { EnvironmentAwareLayout } from './components/layout/EnvironmentAwareLayout';

// ============================================================
// Lazy-loaded Pages - each becomes a separate chunk
// ============================================================

// Pages - Auth
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage'));
const LogoutPage = React.lazy(() => import('./pages/auth/LogoutPage'));
const RegisterPage = React.lazy(() => import('./pages/auth/RegisterPage'));
const PendingApprovalPage = React.lazy(
  () => import('./pages/auth/PendingApprovalPage')
);
const AccountSuspendedPage = React.lazy(
  () => import('./pages/auth/AccountSuspendedPage')
);
const SessionExpiredPage = React.lazy(
  () => import('./pages/auth/SessionExpiredPage')
);
const ForgotPasswordPage = React.lazy(
  () => import('./pages/auth/ForgotPasswordPage')
);
const ResetPasswordPage = React.lazy(
  () => import('./pages/auth/ResetPasswordPage')
);
const OAuthCallbackPage = React.lazy(
  () => import('./pages/auth/OAuthCallbackPage')
);
const InvalidInvitePage = React.lazy(
  () => import('./pages/auth/InvalidInvitePage')
);

// Pages - Common
const DashboardPage = React.lazy(() => import('./pages/common/DashboardPage'));
const NotFoundPage = React.lazy(() => import('./pages/common/NotFoundPage'));
const UnauthorizedPage = React.lazy(
  () => import('./pages/common/UnauthorizedPage')
);
const LandingPage = React.lazy(() => import('./pages/LandingPage'));

// Pages - User
const ProfilePage = React.lazy(() => import('./pages/user/ProfilePage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const TagsPage = React.lazy(() => import('./pages/settings/TagsPage'));
const SystemSettingsPage = React.lazy(
  () => import('./pages/settings/SystemSettingsPage')
);

// Pages - Admin
const UsersManagementPage = React.lazy(
  () => import('./pages/admin/UsersManagementPage')
);
const GameWorldsPage = React.lazy(() => import('./pages/admin/GameWorldsPage'));
const WhitelistPage = React.lazy(() => import('./pages/admin/WhitelistPage'));
const ClientVersionsPage = React.lazy(
  () => import('./pages/admin/ClientVersionsPage')
);
const AuditLogsPage = React.lazy(() => import('./pages/admin/AuditLogsPage'));
const MaintenancePage = React.lazy(
  () => import('./pages/admin/MaintenancePage')
);
const PlayerConnectionsPage = React.lazy(
  () => import('./pages/admin/PlayerConnectionsPage')
);
const MessageTemplatesPage = React.lazy(
  () => import('./pages/admin/MessageTemplatesPage')
);
const SchedulerPage = React.lazy(() => import('./pages/admin/SchedulerPage'));
const JobsPage = React.lazy(() => import('./pages/admin/JobsPage'));
const QueueMonitorPage = React.lazy(
  () => import('./pages/admin/QueueMonitorPage')
);
const CustomQueueMonitorPage = React.lazy(
  () => import('./pages/admin/CustomQueueMonitorPage')
);
const ApiTokensPage = React.lazy(() => import('./pages/admin/ApiTokensPage'));
const CrashEventsPage = React.lazy(
  () => import('./pages/admin/CrashEventsPage')
);
const ChatPage = React.lazy(() => import('./pages/chat/ChatPage'));
const MailboxPage = React.lazy(() => import('./pages/mailbox/MailboxPage'));
const SystemConsolePage = React.lazy(
  () => import('./pages/admin/SystemConsolePage')
);
const LogsPage = React.lazy(() => import('./pages/monitoring/LogsPage'));
const AlertsPage = React.lazy(() => import('./pages/monitoring/AlertsPage'));
const RealtimeEventsPage = React.lazy(
  () => import('./pages/admin/RealtimeEventsPage')
);
const ServerListPage = React.lazy(() => import('./pages/admin/ServerListPage'));
const ServerLifecyclePage = React.lazy(
  () => import('./pages/admin/ServerLifecyclePage')
);
const ChangeRequestsPage = React.lazy(
  () => import('./pages/admin/ChangeRequestsPage')
);
const ChangeRequestDetailPage = React.lazy(
  () => import('./pages/admin/ChangeRequestDetailPage')
);
const OpenApiPage = React.lazy(() => import('./pages/admin/OpenApiPage'));
const GrafanaDashboardPage = React.lazy(
  () => import('./pages/admin/GrafanaDashboardPage')
);
const EventLensProjectsPage = React.lazy(
  () => import('./pages/admin/EventLensProjectsPage')
);
const DataManagementPage = React.lazy(
  () => import('./pages/admin/DataManagementPage')
);
const GatrixEdgesPage = React.lazy(
  () => import('./pages/admin/GatrixEdgesPage')
);
const EnvironmentsPage = React.lazy(
  () => import('./pages/settings/EnvironmentsPage')
);
const KeyValuePage = React.lazy(() => import('./pages/settings/KeyValuePage'));
const IntegrationsPage = React.lazy(
  () => import('./pages/settings/IntegrationsPage')
);
const IntegrationsSdksPage = React.lazy(
  () => import('./pages/settings/IntegrationsSdksPage')
);
const CreateIntegrationPage = React.lazy(
  () => import('./pages/settings/CreateIntegrationPage')
);
const EditIntegrationPage = React.lazy(
  () => import('./pages/settings/EditIntegrationPage')
);
const SignalEndpointsPage = React.lazy(
  () => import('./pages/admin/SignalEndpointsPage')
);
const ActionSetsPage = React.lazy(() => import('./pages/admin/ActionSetsPage'));
const ServiceAccountsPage = React.lazy(
  () => import('./pages/admin/ServiceAccountsPage')
);
const RolesPage = React.lazy(() => import('./pages/admin/RolesPage'));
const GroupsPage = React.lazy(() => import('./pages/admin/GroupsPage'));
const ProjectsPage = React.lazy(() => import('./pages/admin/ProjectsPage'));
const WorkspacePage = React.lazy(() => import('./pages/admin/WorkspacePage'));

// Pages - Game
const ServiceNoticesPage = React.lazy(
  () => import('./pages/game/ServiceNoticesPage')
);
const ServiceNoticesPreviewPage = React.lazy(
  () => import('./pages/game/ServiceNoticesPreviewPage')
);
const IngamePopupNoticesPage = React.lazy(
  () => import('./pages/game/IngamePopupNoticesPage')
);
const CouponsPage = React.lazy(() => import('./pages/game/CouponsPage'));
const CouponSettingsPage = React.lazy(
  () => import('./pages/game/CouponSettingsPage')
);
const CouponUsagePage = React.lazy(
  () => import('./pages/game/CouponUsagePage')
);
const SurveysPage = React.lazy(() => import('./pages/game/SurveysPage'));
const RewardTemplatesPage = React.lazy(
  () => import('./pages/game/RewardTemplatesPage')
);
const StoreProductsPage = React.lazy(
  () => import('./pages/game/StoreProductsPage')
);
const BannerManagementPage = React.lazy(
  () => import('./pages/game/BannerManagementPage')
);
const HotTimeButtonEventPage = React.lazy(
  () => import('./pages/game/HotTimeButtonEventPage')
);
const LiveEventPage = React.lazy(() => import('./pages/game/LiveEventPage'));
const PlanningDataPage = React.lazy(
  () => import('./pages/game/PlanningDataPage')
);
const PlanningDataHistoryPage = React.lazy(
  () => import('./pages/game/PlanningDataHistoryPage')
);
const FeatureFlagsPage = React.lazy(
  () => import('./pages/features/FeatureFlagsPage')
);
const FeatureFlagDetailPage = React.lazy(
  () => import('./pages/features/FeatureFlagDetailPage')
);
const FeatureSegmentsPage = React.lazy(
  () => import('./pages/features/FeatureSegmentsPage')
);
const FeatureContextFieldsPage = React.lazy(
  () => import('./pages/features/FeatureContextFieldsPage')
);
const FeatureFlagTypesPage = React.lazy(
  () => import('./pages/features/FeatureFlagTypesPage')
);
const FeatureNetworkPage = React.lazy(
  () => import('./pages/features/FeatureNetworkPage')
);
const UnknownFlagsPage = React.lazy(
  () => import('./pages/features/UnknownFlagsPage')
);
const ReleaseFlowTemplatesPage = React.lazy(
  () => import('./pages/features/ReleaseFlowTemplatesPage')
);
const ImpactMetricsPage = React.lazy(
  () => import('./pages/features/ImpactMetricsPage')
);

// Conditional Landing Page Component - Simplified since FirstVisitGuard handles first-visit logic
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

  // Check if user has visited before
  const hasVisitedBefore = localStorage.getItem('hasVisitedBefore') === 'true';

  // Show landing page for first-time visitors (or those who somehow got here)
  if (!hasVisitedBefore) {
    return <LandingPage />;
  }

  // Redirect to login page for returning visitors
  return <Navigate to="/login" replace />;
};

// First Visit Guard - Redirects first-time visitors to landing page from any route
const FirstVisitGuard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  // Don't block while auth is loading
  if (isLoading) {
    return <>{children}</>;
  }

  // Skip check for authenticated users (they should go where they want)
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Check if user has visited before
  const hasVisitedBefore = localStorage.getItem('hasVisitedBefore') === 'true';

  // If first-time visitor and not already on root path, redirect to landing page
  if (!hasVisitedBefore && location.pathname !== '/') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// LocalizationProvider with language support
const LocalizedDatePickers: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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
  const adapterLocale =
    language === 'ko' ? 'ko' : language === 'zh' ? 'zh-cn' : 'en';

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
      localeText={
        localeText?.components?.MuiLocalizationProvider?.defaultProps
          ?.localeText
      }
    >
      {children}
    </LocalizationProvider>
  );
};

// Auth Initializer - Shows loading screen while checking authentication
const AuthInitializer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
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
        <OrgProjectProvider>
          <EnvironmentProvider>
            <PlatformConfigProvider>
              <GameWorldProvider>
                <AuthInitializer>
                  <LocalizedDatePickers>
                    <CssBaseline />
                    {/* Global scrollbar styles */}
                    <GlobalStyles
                      styles={(theme) => ({
                        // Firefox - thin scrollbar for all elements
                        'html, body, *, div, main, section, article, aside, nav':
                          {
                            scrollbarWidth: 'thin',
                            scrollbarColor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.2) transparent'
                                : 'rgba(0, 0, 0, 0.2) transparent',
                          },
                        // WebKit/Blink (Chrome, Edge, Safari)
                        'html::-webkit-scrollbar, body::-webkit-scrollbar, *::-webkit-scrollbar, div::-webkit-scrollbar':
                          {
                            width: '8px',
                            height: '8px',
                          },
                        'html::-webkit-scrollbar-track, body::-webkit-scrollbar-track, *::-webkit-scrollbar-track, div::-webkit-scrollbar-track':
                          {
                            background: 'transparent',
                          },
                        'html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb, div::-webkit-scrollbar-thumb':
                          {
                            backgroundColor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.2)'
                                : 'rgba(0, 0, 0, 0.2)',
                            borderRadius: 0,
                          },
                        'html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover, *::-webkit-scrollbar-thumb:hover, div::-webkit-scrollbar-thumb:hover':
                          {
                            backgroundColor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.3)'
                                : 'rgba(0, 0, 0, 0.3)',
                          },
                        'html::-webkit-scrollbar-thumb:active, body::-webkit-scrollbar-thumb:active, *::-webkit-scrollbar-thumb:active, div::-webkit-scrollbar-thumb:active':
                          {
                            backgroundColor:
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.4)'
                                : 'rgba(0, 0, 0, 0.4)',
                          },
                      })}
                    />
                    <SnackbarProvider
                      maxSnack={3}
                      dense
                      autoHideDuration={3000}
                      anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                      classes={{
                        containerRoot: 'snackbar-container-root',
                      }}
                      action={(snackbarId) => (
                        <IconButton
                          size="small"
                          onClick={() => closeSnackbar(snackbarId)}
                          sx={{ color: 'inherit' }}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      )}
                    >
                      <Router
                        basename={import.meta.env.VITE_ROUTER_BASENAME || '/'}
                      >
                        <FirstVisitGuard>
                          <Suspense fallback={<LoadingIndicator />}>
                            <Routes>
                              {/* Public Routes */}
                              <Route path="/login" element={<LoginPage />} />
                              <Route path="/logout" element={<LogoutPage />} />
                              <Route
                                path="/register"
                                element={<RegisterPage />}
                              />
                              <Route
                                path="/signup"
                                element={<RegisterPage />}
                              />
                              <Route
                                path="/invalid-invite"
                                element={<InvalidInvitePage />}
                              />
                              <Route
                                path="/pending-approval"
                                element={<PendingApprovalPage />}
                              />
                              <Route
                                path="/session-expired"
                                element={<SessionExpiredPage />}
                              />
                              <Route
                                path="/auth/pending"
                                element={<PendingApprovalPage />}
                              />
                              <Route
                                path="/auth/callback"
                                element={<OAuthCallbackPage />}
                              />
                              <Route
                                path="/account-suspended"
                                element={<AccountSuspendedPage />}
                              />
                              <Route
                                path="/forgot-password"
                                element={<ForgotPasswordPage />}
                              />
                              <Route
                                path="/reset-password"
                                element={<ResetPasswordPage />}
                              />
                              <Route
                                path="/unauthorized"
                                element={<UnauthorizedPage />}
                              />

                              {/* Service Notices Preview - Public Route */}
                              <Route
                                path="/service-notices-preview"
                                element={<ServiceNoticesPreviewPage />}
                              />

                              {/* Landing Page - only for first-time visitors */}
                              <Route
                                path="/"
                                element={<ConditionalLandingPage />}
                              />

                              {/* Protected Routes */}

                              <Route
                                path="/dashboard"
                                element={
                                  <ProtectedRoute>
                                    <MainLayout>
                                      <DashboardPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />

                              <Route
                                path="/chat"
                                element={
                                  <ProtectedRoute>
                                    <MainLayout>
                                      <ChatPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />

                              <Route
                                path="/mailbox"
                                element={
                                  <ProtectedRoute>
                                    <MainLayout>
                                      <MailboxPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />

                              <Route
                                path="/profile"
                                element={
                                  <ProtectedRoute>
                                    <MainLayout>
                                      <ProfilePage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />

                              {/* Settings Routes */}
                              <Route
                                path="/settings"
                                element={
                                  <ProtectedRoute>
                                    <EnvironmentAwareLayout>
                                      <SettingsPage />
                                    </EnvironmentAwareLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings/tags"
                                element={
                                  <ProtectedRoute>
                                    <EnvironmentAwareLayout>
                                      <TagsPage />
                                    </EnvironmentAwareLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings/environments"
                                element={
                                  <Navigate to="/admin/environments" replace />
                                }
                              />
                              <Route
                                path="/settings/system"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <MainLayout>
                                      <SystemSettingsPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings/kv"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <EnvironmentAwareLayout>
                                      <KeyValuePage />
                                    </EnvironmentAwareLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings/integrations"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <MainLayout>
                                      <IntegrationsPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings/integrations/sdks"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <MainLayout>
                                      <IntegrationsSdksPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings/integrations/create"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <MainLayout>
                                      <CreateIntegrationPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/settings/integrations/:id/edit"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <MainLayout>
                                      <EditIntegrationPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />

                              {/* Admin Routes */}
                              <Route
                                path="/admin/*"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <EnvironmentAwareLayout>
                                      <Routes>
                                        <Route
                                          index
                                          element={
                                            <Navigate
                                              to="/admin/users"
                                              replace
                                            />
                                          }
                                        />
                                        <Route
                                          path="users"
                                          element={<UsersManagementPage />}
                                        />
                                        <Route
                                          path="workspace"
                                          element={<WorkspacePage />}
                                        />
                                        <Route
                                          path="client-versions"
                                          element={<ClientVersionsPage />}
                                        />
                                        <Route
                                          path="game-worlds"
                                          element={<GameWorldsPage />}
                                        />
                                        <Route
                                          path="maintenance"
                                          element={<MaintenancePage />}
                                        />
                                        <Route
                                          path="player-connections"
                                          element={<PlayerConnectionsPage />}
                                        />
                                        <Route
                                          path="maintenance-templates"
                                          element={<MessageTemplatesPage />}
                                        />
                                        <Route
                                          path="scheduler"
                                          element={<SchedulerPage />}
                                        />
                                        <Route
                                          path="whitelist"
                                          element={<WhitelistPage />}
                                        />

                                        <Route
                                          path="jobs"
                                          element={<JobsPage />}
                                        />
                                        <Route
                                          path="queue-monitor"
                                          element={<QueueMonitorPage />}
                                        />
                                        <Route
                                          path="audit-logs"
                                          element={<AuditLogsPage />}
                                        />
                                        <Route
                                          path="realtime-events"
                                          element={<RealtimeEventsPage />}
                                        />
                                        <Route
                                          path="crash-events"
                                          element={<CrashEventsPage />}
                                        />
                                        <Route
                                          path="api-tokens"
                                          element={<ApiTokensPage />}
                                        />
                                        <Route
                                          path="console"
                                          element={<SystemConsolePage />}
                                        />
                                        <Route
                                          path="server-list"
                                          element={<ServerListPage />}
                                        />
                                        <Route
                                          path="server-lifecycle"
                                          element={<ServerLifecyclePage />}
                                        />
                                        <Route
                                          path="change-requests"
                                          element={<ChangeRequestsPage />}
                                        />
                                        <Route
                                          path="change-requests/:id"
                                          element={<ChangeRequestDetailPage />}
                                        />
                                        <Route
                                          path="grafana-dashboard"
                                          element={<GrafanaDashboardPage />}
                                        />
                                        <Route
                                          path="open-api"
                                          element={<OpenApiPage />}
                                        />
                                        <Route
                                          path="event-lens/projects"
                                          element={<EventLensProjectsPage />}
                                        />
                                        <Route
                                          path="data-management"
                                          element={<DataManagementPage />}
                                        />
                                        <Route
                                          path="gatrix-edges"
                                          element={<GatrixEdgesPage />}
                                        />
                                        <Route
                                          path="signal-endpoints"
                                          element={<SignalEndpointsPage />}
                                        />
                                        <Route
                                          path="actions"
                                          element={<ActionSetsPage />}
                                        />
                                        <Route
                                          path="service-accounts"
                                          element={<ServiceAccountsPage />}
                                        />
                                        <Route
                                          path="roles"
                                          element={<RolesPage />}
                                        />
                                        <Route
                                          path="groups"
                                          element={<GroupsPage />}
                                        />
                                        <Route
                                          path="organisations"
                                          element={
                                            <Navigate
                                              to="/admin/workspace"
                                              replace
                                            />
                                          }
                                        />
                                        <Route
                                          path="projects"
                                          element={<ProjectsPage />}
                                        />
                                        <Route
                                          path="environments"
                                          element={<EnvironmentsPage />}
                                        />
                                      </Routes>
                                    </EnvironmentAwareLayout>
                                  </ProtectedRoute>
                                }
                              />

                              {/* Monitoring Routes */}
                              <Route
                                path="/monitoring/logs"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <MainLayout>
                                      <LogsPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />
                              <Route
                                path="/monitoring/alerts"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <MainLayout>
                                      <AlertsPage />
                                    </MainLayout>
                                  </ProtectedRoute>
                                }
                              />

                              {/* Game Routes */}
                              <Route
                                path="/game/*"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <PlanningDataProvider>
                                      <EnvironmentAwareLayout>
                                        <Routes>
                                          <Route
                                            path="service-notices"
                                            element={<ServiceNoticesPage />}
                                          />
                                          <Route
                                            path="ingame-popup-notices"
                                            element={<IngamePopupNoticesPage />}
                                          />
                                          <Route
                                            path="coupons"
                                            element={<CouponsPage />}
                                          />
                                          <Route
                                            path="surveys"
                                            element={<SurveysPage />}
                                          />
                                          <Route
                                            path="store-products"
                                            element={<StoreProductsPage />}
                                          />
                                          <Route
                                            path="reward-templates"
                                            element={<RewardTemplatesPage />}
                                          />
                                          <Route
                                            path="banners"
                                            element={<BannerManagementPage />}
                                          />
                                          <Route
                                            path="hot-time-button-event"
                                            element={<HotTimeButtonEventPage />}
                                          />
                                          <Route
                                            path="coupon-settings"
                                            element={<CouponSettingsPage />}
                                          />
                                          <Route
                                            path="coupon-usage"
                                            element={<CouponUsagePage />}
                                          />
                                          <Route
                                            path="live-event"
                                            element={<LiveEventPage />}
                                          />
                                          <Route
                                            path="planning-data"
                                            element={<PlanningDataPage />}
                                          />
                                          <Route
                                            path="planning-data-history"
                                            element={
                                              <PlanningDataHistoryPage />
                                            }
                                          />
                                        </Routes>
                                      </EnvironmentAwareLayout>
                                    </PlanningDataProvider>
                                  </ProtectedRoute>
                                }
                              />

                              {/* Feature Flags Routes - Independent from /game */}
                              <Route
                                path="/feature-flags/*"
                                element={
                                  <ProtectedRoute requiredRoles={['admin']}>
                                    <EnvironmentAwareLayout>
                                      <Routes>
                                        <Route
                                          index
                                          element={<FeatureFlagsPage />}
                                        />
                                        <Route
                                          path="segments"
                                          element={<FeatureSegmentsPage />}
                                        />
                                        <Route
                                          path="context-fields"
                                          element={<FeatureContextFieldsPage />}
                                        />
                                        <Route
                                          path="types"
                                          element={<FeatureFlagTypesPage />}
                                        />
                                        <Route
                                          path="network"
                                          element={<FeatureNetworkPage />}
                                        />
                                        <Route
                                          path="templates"
                                          element={<ReleaseFlowTemplatesPage />}
                                        />
                                        <Route
                                          path="unknown"
                                          element={<UnknownFlagsPage />}
                                        />
                                        <Route
                                          path="impact-metrics"
                                          element={<ImpactMetricsPage />}
                                        />
                                        <Route
                                          path=":flagName"
                                          element={<FeatureFlagDetailPage />}
                                        />
                                      </Routes>
                                    </EnvironmentAwareLayout>
                                  </ProtectedRoute>
                                }
                              />

                              {/* 404 Route */}
                              <Route path="*" element={<NotFoundPage />} />
                            </Routes>
                          </Suspense>
                        </FirstVisitGuard>
                      </Router>
                    </SnackbarProvider>
                  </LocalizedDatePickers>
                </AuthInitializer>
              </GameWorldProvider>
            </PlatformConfigProvider>
          </EnvironmentProvider>
        </OrgProjectProvider>
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
