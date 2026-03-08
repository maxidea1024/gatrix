import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Popover,
  alpha,
  ButtonBase,
  Collapse,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Public as EnvironmentIcon,
  Business as OrgIcon,
  Folder as ProjectIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useTranslation } from 'react-i18next';
import { environmentService, Environment } from '@/services/environmentService';

// Environment type colors
const getEnvironmentColor = (type: string, customColor?: string): string => {
  if (customColor) return customColor;
  switch (type) {
    case 'production':
      return '#d32f2f'; // Red
    case 'staging':
      return '#ed6c02'; // Orange
    case 'development':
      return '#2e7d32'; // Green
    default:
      return '#757575'; // Grey
  }
};

interface EnvironmentSelectorProps {
  variant?: 'select' | 'chip';
  size?: 'small' | 'medium';
}

export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  size = 'small',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const {
    environments,
    currentEnvironment,
    currentEnvironmentId,
    isLoading,
    switchEnvironment,
  } = useEnvironment();

  const {
    organisations,
    currentOrg,
    projects,
    currentProject,
    currentProjectId,
  } = useOrgProject();

  // Track expanded state for org and project tree nodes
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );

  // Per-project environment cache
  const [projectEnvMap, setProjectEnvMap] = useState<
    Record<string, Environment[]>
  >({});
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(
    new Set()
  );
  const loadedProjectsRef = useRef<Set<string>>(new Set());

  // Load environments for a specific project
  const loadProjectEnvironments = useCallback(
    async (projectId: string, orgId: string) => {
      if (loadedProjectsRef.current.has(projectId)) return;
      loadedProjectsRef.current.add(projectId);

      setLoadingProjects((prev) => new Set(prev).add(projectId));
      try {
        const apiPath = `/admin/orgs/${orgId}/projects/${projectId}`;
        const envs = await environmentService.getEnvironments(apiPath);
        setProjectEnvMap((prev) => ({ ...prev, [projectId]: envs }));
      } catch (error) {
        console.error(
          `Failed to load environments for project ${projectId}:`,
          error
        );
        loadedProjectsRef.current.delete(projectId);
      } finally {
        setLoadingProjects((prev) => {
          const next = new Set(prev);
          next.delete(projectId);
          return next;
        });
      }
    },
    []
  );

  const handleOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(event.currentTarget);

      // Auto-expand current org and project, and load environments
      if (currentOrg) {
        setExpandedOrgs((prev) => new Set(prev).add(currentOrg.id));
      }
      if (currentProject && currentOrg) {
        setExpandedProjects((prev) => new Set(prev).add(currentProject.id));
        loadProjectEnvironments(currentProject.id, currentOrg.id);
      }
    },
    [currentOrg, currentProject, loadProjectEnvironments]
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleToggleOrg = useCallback((orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  }, []);

  const handleToggleProject = useCallback(
    (projectId: string, orgId: string) => {
      setExpandedProjects((prev) => {
        const next = new Set(prev);
        if (next.has(projectId)) {
          next.delete(projectId);
        } else {
          next.add(projectId);
          // Load environments when expanding
          loadProjectEnvironments(projectId, orgId);
        }
        return next;
      });
    },
    [loadProjectEnvironments]
  );

  const handleSelectEnvironment = useCallback(
    (envId: string, projectId: string, orgId: string) => {
      switchEnvironment(orgId, projectId, envId);
      handleClose();
    },
    [switchEnvironment, handleClose]
  );

  // Build display label: Org / Project / Environment
  const displayLabel = useMemo(() => {
    const parts: string[] = [];
    if (organisations.length > 1 && currentOrg) {
      parts.push(currentOrg.displayName || currentOrg.orgName);
    }
    if (currentProject) {
      parts.push(currentProject.displayName || currentProject.projectName);
    }
    if (currentEnvironment) {
      parts.push(
        currentEnvironment.displayName || currentEnvironment.environmentName
      );
    }
    return parts.join(' / ');
  }, [organisations.length, currentOrg, currentProject, currentEnvironment]);

  const isOpen = Boolean(anchorEl);

  // Show nothing only if there are truly no environments (not just loading)
  if (!isLoading && environments.length === 0 && organisations.length === 0) {
    return null;
  }

  // During initial load with no data, show a placeholder to prevent layout shift
  if (isLoading && environments.length === 0) {
    return (
      <ButtonBase
        disabled
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: size === 'small' ? 0.5 : 0.75,
          borderRadius: 1,
          backgroundColor: '#757575',
          color: '#fff',
        }}
      >
        <EnvironmentIcon sx={{ fontSize: 18, opacity: 0.9 }} />
        <Typography variant="body2" sx={{ fontWeight: 500, opacity: 0.5 }}>
          {t('common.loading')}
        </Typography>
      </ButtonBase>
    );
  }

  const envColor = currentEnvironment
    ? getEnvironmentColor(
        currentEnvironment.environmentType,
        currentEnvironment.color
      )
    : '#757575';

  return (
    <>
      {/* Trigger button */}
      <ButtonBase
        onClick={handleOpen}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: size === 'small' ? 0.5 : 0.75,
          borderRadius: 1,
          backgroundColor: envColor,
          boxShadow: `0 0 8px ${alpha(envColor, 0.5)}, inset 0 1px 0 ${alpha('#fff', 0.2)}`,
          border: `1px solid ${alpha('#fff', 0.3)}`,
          transition: 'all 0.2s ease-in-out',
          cursor: 'pointer',
          '&:hover': {
            boxShadow: `0 0 12px ${alpha(envColor, 0.7)}, inset 0 1px 0 ${alpha('#fff', 0.3)}`,
            transform: 'scale(1.02)',
          },
        }}
      >
        <EnvironmentIcon sx={{ fontSize: 18, color: '#fff', opacity: 0.9 }} />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            maxWidth: 300,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            direction: 'rtl',
            textAlign: 'left',
          }}
        >
          {displayLabel || t('environments.selectEnvironment')}
        </Typography>
        <ArrowDropDownIcon
          sx={{
            fontSize: 20,
            color: '#fff',
            opacity: 0.8,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </ButtonBase>

      {/* Tree dropdown popover */}
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 280,
              maxWidth: 400,
              maxHeight: 400,
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              overflow: 'auto',
            },
          },
        }}
      >
        {/* Tree content */}
        <Box sx={{ py: 0.5 }}>
          {organisations.map((org) => {
            const isMultiOrg = organisations.length > 1;
            const isOrgExpanded = expandedOrgs.has(org.id) || !isMultiOrg;

            // For single-org, skip the org header level
            if (!isMultiOrg) {
              return (
                <React.Fragment key={org.id}>
                  {projects.filter((p) => p.orgId === org.id).length === 0 ? (
                    // No projects — navigate to projects management page
                    <ListItemButton
                      onClick={() => {
                        handleClose();
                        navigate(`/admin/projects?orgId=${org.id}`);
                      }}
                      dense
                      sx={{ pl: 1.5, py: 0.75 }}
                    >
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <ProjectIcon sx={{ fontSize: 16, opacity: 0.5 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={t('environments.noProjects')}
                        primaryTypographyProps={{
                          variant: 'caption',
                          color: 'text.secondary',
                          fontStyle: 'italic',
                        }}
                      />
                    </ListItemButton>
                  ) : (
                    projects
                      .filter((p) => p.orgId === org.id)
                      .map((proj) => {
                        const isProjExpanded = expandedProjects.has(proj.id);
                        const isCurrentProject = proj.id === currentProjectId;

                        return (
                          <React.Fragment key={proj.id}>
                            {/* Project node */}
                            <ListItemButton
                              onClick={() =>
                                handleToggleProject(proj.id, org.id)
                              }
                              dense
                              sx={{
                                py: 0.5,
                                pl: 1.5,
                                backgroundColor: isCurrentProject
                                  ? (theme) =>
                                      alpha(
                                        theme.palette.primary.main,
                                        theme.palette.mode === 'dark'
                                          ? 0.1
                                          : 0.04
                                      )
                                  : 'transparent',
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 28 }}>
                                {isProjExpanded ? (
                                  <ExpandMoreIcon sx={{ fontSize: 18 }} />
                                ) : (
                                  <ChevronRightIcon sx={{ fontSize: 18 }} />
                                )}
                              </ListItemIcon>
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <ProjectIcon
                                  sx={{ fontSize: 16, opacity: 0.7 }}
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={proj.displayName || proj.projectName}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  fontWeight: isCurrentProject ? 600 : 400,
                                }}
                              />
                            </ListItemButton>

                            {/* Environment nodes under this project */}
                            <Collapse in={isProjExpanded} timeout="auto">
                              {renderEnvironments(proj.id, org.id)}
                            </Collapse>
                          </React.Fragment>
                        );
                      })
                  )}
                </React.Fragment>
              );
            }

            // Multi-org: show org header
            return (
              <React.Fragment key={org.id}>
                {/* Org node */}
                <ListItemButton
                  onClick={() => handleToggleOrg(org.id)}
                  dense
                  sx={{ py: 0.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    {isOrgExpanded ? (
                      <ExpandMoreIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    )}
                  </ListItemIcon>
                  <ListItemIcon sx={{ minWidth: 24 }}>
                    <OrgIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={org.displayName || org.orgName}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontWeight: currentOrg?.id === org.id ? 600 : 400,
                    }}
                  />
                </ListItemButton>

                {/* Projects under this org */}
                <Collapse in={isOrgExpanded} timeout="auto">
                  {projects.filter((p) => p.orgId === org.id).length === 0 && (
                    // No projects — navigate to projects management page
                    <ListItemButton
                      onClick={() => {
                        handleClose();
                        navigate(`/admin/projects?orgId=${org.id}`);
                      }}
                      dense
                      sx={{ pl: 4, py: 0.75 }}
                    >
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <ProjectIcon sx={{ fontSize: 16, opacity: 0.5 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={t('environments.goToProjectManagement')}
                        primaryTypographyProps={{
                          variant: 'caption',
                          color: 'text.secondary',
                          fontStyle: 'italic',
                        }}
                      />
                    </ListItemButton>
                  )}
                  {projects
                    .filter((p) => p.orgId === org.id)
                    .map((proj) => {
                      const isProjExpanded = expandedProjects.has(proj.id);
                      const isCurrentProject = proj.id === currentProjectId;

                      return (
                        <React.Fragment key={proj.id}>
                          <ListItemButton
                            onClick={() => handleToggleProject(proj.id, org.id)}
                            dense
                            sx={{
                              py: 0.5,
                              pl: 4,
                              backgroundColor: isCurrentProject
                                ? (theme) =>
                                    alpha(
                                      theme.palette.primary.main,
                                      theme.palette.mode === 'dark' ? 0.1 : 0.04
                                    )
                                : 'transparent',
                            }}
                          >
                            <ListItemIcon sx={{ minWidth: 28 }}>
                              {isProjExpanded ? (
                                <ExpandMoreIcon sx={{ fontSize: 18 }} />
                              ) : (
                                <ChevronRightIcon sx={{ fontSize: 18 }} />
                              )}
                            </ListItemIcon>
                            <ListItemIcon sx={{ minWidth: 24 }}>
                              <ProjectIcon
                                sx={{ fontSize: 16, opacity: 0.7 }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={proj.displayName || proj.projectName}
                              primaryTypographyProps={{
                                variant: 'body2',
                                fontWeight: isCurrentProject ? 600 : 400,
                              }}
                            />
                          </ListItemButton>

                          <Collapse in={isProjExpanded} timeout="auto">
                            {renderEnvironments(proj.id, org.id)}
                          </Collapse>
                        </React.Fragment>
                      );
                    })}
                </Collapse>
              </React.Fragment>
            );
          })}
        </Box>
      </Popover>
    </>
  );

  // Render environment items for a given project
  function renderEnvironments(projectId: string, orgId: string) {
    const indent = organisations.length > 1 ? 7 : 4;

    // Always use projectEnvMap for consistency across all projects
    const envList = projectEnvMap[projectId] || [];
    const isLoadingEnvs = loadingProjects.has(projectId);

    if (isLoadingEnvs && envList.length === 0) {
      return (
        <ListItemButton dense disabled sx={{ pl: indent, py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 24 }}>
            <EnvironmentIcon sx={{ fontSize: 16, opacity: 0.5 }} />
          </ListItemIcon>
          <ListItemText
            primary={t('common.loading')}
            primaryTypographyProps={{
              variant: 'caption',
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          />
        </ListItemButton>
      );
    }

    // No environments
    if (envList.length === 0) {
      return (
        <ListItemButton
          onClick={() => {
            handleClose();
            navigate(
              `/admin/environments?orgId=${orgId}&projectId=${projectId}`
            );
          }}
          dense
          sx={{ pl: indent, py: 0.75 }}
        >
          <ListItemIcon sx={{ minWidth: 24 }}>
            <EnvironmentIcon sx={{ fontSize: 16, opacity: 0.5 }} />
          </ListItemIcon>
          <ListItemText
            primary={t('environments.noEnvironments')}
            primaryTypographyProps={{
              variant: 'caption',
              color: 'text.secondary',
              fontStyle: 'italic',
            }}
          />
        </ListItemButton>
      );
    }

    return envList.map((env) => {
      const itemColor = getEnvironmentColor(env.environmentType, env.color);
      const isSelected = env.environmentId === currentEnvironmentId;

      return (
        <ListItemButton
          key={env.environmentId}
          onClick={() =>
            handleSelectEnvironment(env.environmentId, projectId, orgId)
          }
          dense
          selected={isSelected}
          sx={{
            pl: indent,
            py: 0.5,
            '&.Mui-selected': {
              backgroundColor: (theme) =>
                alpha(itemColor, theme.palette.mode === 'dark' ? 0.2 : 0.1),
              '&:hover': {
                backgroundColor: (theme) =>
                  alpha(itemColor, theme.palette.mode === 'dark' ? 0.25 : 0.15),
              },
            },
            '&:hover': {
              backgroundColor: (theme) =>
                alpha(itemColor, theme.palette.mode === 'dark' ? 0.15 : 0.08),
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 24 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: 0.5,
                backgroundColor: itemColor,
                boxShadow: isSelected
                  ? `0 0 6px ${alpha(itemColor, 0.6)}`
                  : 'none',
              }}
            />
          </ListItemIcon>
          <ListItemText
            primary={env.displayName || env.environmentName}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: isSelected ? 600 : 400,
            }}
          />
          {isSelected && (
            <CheckIcon
              sx={{ fontSize: 18, color: 'success.main', ml: 'auto' }}
            />
          )}
        </ListItemButton>
      );
    });
  }
};

export default EnvironmentSelector;
