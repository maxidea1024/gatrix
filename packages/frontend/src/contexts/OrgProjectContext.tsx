import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import { orgProjectService, Organisation, Project } from '../services/orgProjectService';
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

const OrgProjectContext = createContext<OrgProjectContextType | undefined>(undefined);

interface OrgProjectProviderProps {
  children: ReactNode;
}

// localStorage helpers
const getStoredOrgId = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_ORG) : null;

const getStoredProjectId = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY_PROJECT) : null;

const storeOrgId = (orgId: string) => localStorage.setItem(STORAGE_KEY_ORG, orgId);
const storeProjectId = (projectId: string) => localStorage.setItem(STORAGE_KEY_PROJECT, projectId);

export const OrgProjectProvider: React.FC<OrgProjectProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(getStoredOrgId());
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(getStoredProjectId());
  const [isLoading, setIsLoading] = useState(true);

  const currentOrg = organisations.find((o) => o.id === currentOrgId) || null;
  const currentProject = projects.find((p) => p.id === currentProjectId) || null;

  // Load organisations
  const loadOrgs = useCallback(async () => {
    try {
      const orgs = await orgProjectService.getOrganisations();
      setOrganisations(orgs);

      // Auto-select: stored → first active org
      const stored = getStoredOrgId();
      const valid = orgs.find((o) => o.id === stored);
      if (valid) {
        setCurrentOrgId(valid.id);
      } else if (orgs.length > 0) {
        const active = orgs.find((o) => o.isActive) || orgs[0];
        setCurrentOrgId(active.id);
        storeOrgId(active.id);
      }
    } catch (error) {
      devLogger.error('Failed to load organisations:', error);
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

      // Auto-select: stored → default → first
      const stored = getStoredProjectId();
      const valid = projs.find((p) => p.id === stored);
      if (valid) {
        setCurrentProjectId(valid.id);
      } else if (projs.length > 0) {
        const defaultProj = projs.find((p) => p.isDefault) || projs[0];
        setCurrentProjectId(defaultProj.id);
        storeProjectId(defaultProj.id);
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
    if (currentOrgId) {
      loadProjects();
    }
  }, [currentOrgId, loadProjects]);

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
  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
    storeOrgId(orgId);
    setCurrentProjectId(null);
    localStorage.removeItem(STORAGE_KEY_PROJECT);
  }, []);

  // Switch project within current org
  const switchProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    storeProjectId(projectId);
  }, []);

  // Atomically switch both org and project at once.
  // Unlike calling switchOrg + switchProject sequentially,
  // this does NOT reset projectId to null in between.
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
    switchOrg,
    switchProject,
    switchContext,
    refreshOrgs: loadOrgs,
    refreshProjects: loadProjects,
    getProjectApiPath,
  };

  return <OrgProjectContext.Provider value={value}>{children}</OrgProjectContext.Provider>;
};

export const useOrgProject = (): OrgProjectContextType => {
  const context = useContext(OrgProjectContext);
  if (context === undefined) {
    throw new Error('useOrgProject must be used within an OrgProjectProvider');
  }
  return context;
};

export default OrgProjectContext;
