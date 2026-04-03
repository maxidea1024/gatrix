import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
} from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Logout as LogoutIcon,
  CheckCircleOutline as CheckIcon,
  HourglassTop as WaitIcon,
  SupportAgent as SupportIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import {
  orgProjectService,
  Organisation,
  Project,
} from '../services/orgProjectService';
import { devLogger } from '../utils/logger';

const STORAGE_KEY_ORG = 'gatrix_selected_org';
const STORAGE_KEY_PROJECT = 'gatrix_selected_project';

export interface OrgProjectContextType {
  // Organisations
  organisations: Organisation[];
  currentOrg: Organisation | null;
  currentOrgId: string | null;

  // Projects
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;

  // Loading
  isLoading: boolean;
  noOrgAccess: boolean;

  // Actions
  switchOrg: (orgId: string) => void;
  switchProject: (projectId: string) => void;
  /** Atomically switch both org and project without resetting project to null */
  switchContext: (orgId: string, projectId: string) => void;
  refreshOrgs: () => Promise<void>;
  refreshProjects: () => Promise<void>;

  // Helpers
  /** Returns `/admin/orgs/${orgId}/projects/${projectId}` for project-scoped API calls */
  getProjectApiPath: () => string | null;
}

const OrgProjectContext = createContext<OrgProjectContextType | undefined>(
  undefined
);

interface OrgProjectProviderProps {
  children: ReactNode;
}

// localStorage helpers
const getStoredOrgId = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ORG) : null;

const getStoredProjectId = (): string | null =>
  typeof window !== 'undefined'
    ? localStorage.getItem(STORAGE_KEY_PROJECT)
    : null;

const storeOrgId = (orgId: string) =>
  localStorage.setItem(STORAGE_KEY_ORG, orgId);
const storeProjectId = (projectId: string) =>
  localStorage.setItem(STORAGE_KEY_PROJECT, projectId);

// Polling interval for checking org access (15 seconds)
const POLL_INTERVAL_MS = 15000;

// ==================== No-Org-Access Onboarding Page ====================

const NoOrgAccessPage: React.FC<{ t: (key: string) => string }> = ({ t }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { logout } = useAuth();

  // Replace URL to /onboarding so the browser shows the correct path
  useEffect(() => {
    if (window.location.pathname !== '/onboarding') {
      window.history.replaceState(null, '', '/onboarding');
    }
  }, []);

  const steps = [
    {
      icon: <WaitIcon sx={{ fontSize: 22 }} />,
      title: t('onboarding.step1Title'),
      desc: t('onboarding.step1Desc'),
    },
    {
      icon: <CheckIcon sx={{ fontSize: 22 }} />,
      title: t('onboarding.step2Title'),
      desc: t('onboarding.step2Desc'),
    },
    {
      icon: <SupportIcon sx={{ fontSize: 22 }} />,
      title: t('onboarding.step3Title'),
      desc: t('onboarding.step3Desc'),
    },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Main card */}
      <Box
        sx={{
          maxWidth: 520,
          width: '100%',
          mx: 2,
          p: { xs: 4, sm: 5 },
          borderRadius: 4,
          bgcolor: 'background.paper',
          border: `1px solid`,
          borderColor: 'divider',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.3)'
            : '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
          textAlign: 'center',
        }}
      >
        {/* Animated processing indicator */}
        <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
          <CircularProgress
            size={72}
            thickness={2}
            sx={{
              color: theme.palette.primary.main,
              opacity: 0.3,
            }}
          />
          <CircularProgress
            size={72}
            thickness={2}
            variant="indeterminate"
            sx={{
              color: theme.palette.primary.main,
              position: 'absolute',
              left: 0,
              animationDuration: '2.5s',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              sx={{
                fontSize: 28,
                fontWeight: 800,
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: -1,
              }}
            >
              G
            </Typography>
          </Box>
        </Box>

        {/* Title */}
        <Typography
          variant="h5"
          fontWeight={700}
          sx={{ mb: 1, color: 'text.primary', letterSpacing: -0.3 }}
        >
          {t('onboarding.title')}
        </Typography>

        {/* Subtitle */}
        <Typography
          variant="body1"
          sx={{
            mb: 4,
            color: 'text.secondary',
            lineHeight: 1.7,
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          {t('onboarding.subtitle')}
        </Typography>

        {/* Steps */}
        <Box sx={{ textAlign: 'left', mb: 3 }}>
          {steps.map((step, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                py: 1.5,
                px: 2,
                borderRadius: 2,
                mb: 1,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  mt: 0.25,
                  color: 'primary.main',
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </Box>
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{ mb: 0.25, color: 'text.primary' }}
                >
                  {step.title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ lineHeight: 1.5, color: 'text.secondary' }}
                >
                  {step.desc}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Auto-check indicator */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            py: 1,
            color: 'text.disabled',
          }}
        >
          <CircularProgress
            size={12}
            thickness={5}
            sx={{ color: 'text.disabled' }}
          />
          <Typography variant="caption">
            {t('onboarding.autoChecking')}
          </Typography>
        </Box>
      </Box>

      {/* Logout link */}
      <Button
        variant="text"
        size="small"
        startIcon={<LogoutIcon sx={{ fontSize: 16 }} />}
        onClick={async () => {
          await logout();
          window.location.href = '/login';
        }}
        sx={{
          mt: 3,
          color: 'text.disabled',
          textTransform: 'none',
          fontSize: '0.8rem',
          '&:hover': { color: 'text.secondary' },
        }}
      >
        {t('onboarding.logoutLink')}
      </Button>
    </Box>
  );
};

// ==================== Provider ====================

export const OrgProjectProvider: React.FC<OrgProjectProviderProps> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(
    getStoredOrgId()
  );
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    getStoredProjectId()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [noOrgAccess, setNoOrgAccess] = useState(false);
  const { t } = useTranslation();

  const currentOrg = organisations.find((o) => o.id === currentOrgId) || null;
  const currentProject =
    projects.find((p) => p.id === currentProjectId) || null;

  // Load organisations
  const loadOrgs = useCallback(async () => {
    try {
      const orgs = await orgProjectService.getOrganisations();
      setOrganisations(orgs);
      setNoOrgAccess(false);

      // Auto-select: stored → first active org
      const stored = getStoredOrgId();
      const valid = orgs.find((o) => o.id === stored);
      if (valid) {
        setCurrentOrgId(valid.id);
      } else if (orgs.length > 0) {
        const active = orgs.find((o) => o.isActive) || orgs[0];
        setCurrentOrgId(active.id);
        storeOrgId(active.id);
      } else {
        // Authenticated but no orgs returned
        setNoOrgAccess(true);
      }
    } catch (error: any) {
      devLogger.error('Failed to load organisations:', error);
      const status = error?.status || error?.response?.status;
      if (status === 403) {
        setNoOrgAccess(true);
      }
    }
  }, []);

  // Load projects for the current org
  const loadProjects = useCallback(async () => {
    if (!currentOrgId) {
      setProjects([]);
      return;
    }

    try {
      const projs = await orgProjectService.getProjects();
      setProjects(projs);

      const orgProjs = projs.filter((p) => p.orgId === currentOrgId);

      // Auto-select: stored -> default -> first
      const stored = getStoredProjectId();
      const valid = orgProjs.find((p) => p.id === stored);
      if (valid) {
        setCurrentProjectId(valid.id);
        storeProjectId(valid.id);
      } else if (orgProjs.length > 0) {
        const defaultProj = orgProjs.find((p) => p.isDefault) || orgProjs[0];
        setCurrentProjectId(defaultProj.id);
        storeProjectId(defaultProj.id);
      } else {
        setCurrentProjectId(null);
        localStorage.removeItem(STORAGE_KEY_PROJECT);
      }
    } catch (error) {
      devLogger.error('Failed to load projects:', error);
    }
  }, [currentOrgId]);

  // Fetch orgs when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      loadOrgs().finally(() => setIsLoading(false));
    } else {
      setOrganisations([]);
      setProjects([]);
      setCurrentOrgId(null);
      setCurrentProjectId(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, loadOrgs]);

  // Fetch projects when org changes
  useEffect(() => {
    if (isAuthenticated && currentOrgId) {
      loadProjects();
    }
  }, [isAuthenticated, currentOrgId, loadProjects]);

  // Auto-poll when noOrgAccess — check every 15s if access has been granted
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (noOrgAccess && isAuthenticated) {
      pollTimerRef.current = setInterval(() => {
        loadOrgs();
      }, POLL_INTERVAL_MS);
      return () => {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      };
    }
    // Clean up timer when access is granted
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [noOrgAccess, isAuthenticated, loadOrgs]);

  // Notify other components when project changes
  useEffect(() => {
    if (currentProjectId && currentProject) {
      window.dispatchEvent(
        new CustomEvent('project-changed', {
          detail: { projectId: currentProjectId, project: currentProject },
        })
      );
    }
  }, [currentProjectId, currentProject]);

  // Switch org only (resets project — loadProjects will auto-select)
  const switchOrg = useCallback(
    (orgId: string) => {
      if (currentOrgId === orgId) return;

      setCurrentOrgId(orgId);
      storeOrgId(orgId);

      // Synchronously try to select a project to avoid flashing 'No project'
      const orgProjs = projects.filter((p) => p.orgId === orgId);
      if (orgProjs.length > 0) {
        const defaultProj = orgProjs.find((p) => p.isDefault) || orgProjs[0];
        setCurrentProjectId(defaultProj.id);
        storeProjectId(defaultProj.id);
      } else {
        setCurrentProjectId(null);
        localStorage.removeItem(STORAGE_KEY_PROJECT);
      }
    },
    [currentOrgId, projects]
  );

  // Switch project within current org
  const switchProject = useCallback(
    (projectId: string) => {
      if (currentProjectId === projectId) return;

      setCurrentProjectId(projectId);
      storeProjectId(projectId);
    },
    [currentProjectId]
  );

  // Atomically switch both org and project at once.
  const switchContext = useCallback((orgId: string, projectId: string) => {
    setCurrentOrgId(orgId);
    storeOrgId(orgId);
    setCurrentProjectId(projectId);
    storeProjectId(projectId);
  }, []);

  // Build project-scoped API base path
  const getProjectApiPath = useCallback((): string | null => {
    if (!currentOrgId || !currentProjectId) return null;
    return `/admin/orgs/${currentOrgId}/projects/${currentProjectId}`;
  }, [currentOrgId, currentProjectId]);

  const value: OrgProjectContextType = {
    organisations,
    currentOrg,
    currentOrgId,
    projects,
    currentProject,
    currentProjectId,
    isLoading,
    noOrgAccess,
    switchOrg,
    switchProject,
    switchContext,
    refreshOrgs: loadOrgs,
    refreshProjects: loadProjects,
    getProjectApiPath,
  };

  // Show full-screen pending access page
  if (noOrgAccess) {
    return (
      <OrgProjectContext.Provider value={value}>
        <NoOrgAccessPage t={t} />
      </OrgProjectContext.Provider>
    );
  }

  return (
    <OrgProjectContext.Provider value={value}>
      {children}
    </OrgProjectContext.Provider>
  );
};

export const useOrgProject = (): OrgProjectContextType => {
  const context = useContext(OrgProjectContext);
  if (context === undefined) {
    throw new Error('useOrgProject must be used within an OrgProjectProvider');
  }
  return context;
};

export default OrgProjectContext;
