import React, { useState, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Popover,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  alpha,
  Tooltip,
  useTheme,
  Collapse,
  CircularProgress,
} from '@mui/material';
import {
  Business as OrgIcon,
  Folder as ProjectIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Check as CheckIcon,
  UnfoldMore as UnfoldMoreIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useTranslation } from 'react-i18next';
import { environmentService, Environment } from '@/services/environmentService';

// Environment type colors
const getEnvironmentColor = (type: string, customColor?: string): string => {
  if (customColor) return customColor;
  switch (type) {
    case 'production':
      return '#d32f2f';
    case 'staging':
      return '#ed6c02';
    case 'development':
      return '#2e7d32';
    default:
      return '#757575';
  }
};

interface SidebarContextSwitcherProps {
  collapsed: boolean;
}

const SidebarContextSwitcher: React.FC<SidebarContextSwitcherProps> = ({
  collapsed,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const {
    organisations,
    currentOrg,
    currentOrgId,
    projects,
    currentProject,
    currentProjectId,
    isLoading: orgLoading,
  } = useOrgProject();

  const {
    environments,
    currentEnvironment,
    currentEnvironmentId,
    isLoading: envLoading,
    switchEnvironment,
  } = useEnvironment();

  // Main popover anchor
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  // Tree expand state
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );

  // Per-project environment cache (lazy loading)
  const [projectEnvMap, setProjectEnvMap] = useState<
    Record<string, Environment[]>
  >({});
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(
    new Set()
  );
  const loadedProjectsRef = useRef<Set<string>>(new Set());

  // ─── Load environments for a specific project ───
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

  // ─── Handlers ───
  const handleOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      setAnchorEl(e.currentTarget);
      // Auto-expand current org and project
      if (currentOrg) {
        setExpandedOrgs((prev) => new Set(prev).add(currentOrg.id));
      }
      if (currentProject && currentOrg) {
        setExpandedProjects((prev) =>
          new Set(prev).add(currentProject.id)
        );
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
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
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

  // ─── Labels ───
  const orgLabel =
    currentOrg?.displayName ||
    currentOrg?.orgName ||
    t('sidebar.context.noOrgs');
  const projLabel =
    currentProject?.displayName ||
    currentProject?.projectName ||
    t('sidebar.context.noProjects');
  const envLabel =
    currentEnvironment?.displayName ||
    currentEnvironment?.environmentName ||
    t('sidebar.context.noEnvironments');
  const envColor = currentEnvironment
    ? getEnvironmentColor(
        currentEnvironment.environmentType,
        currentEnvironment.color
      )
    : '#757575';

  const isLoading =
    (orgLoading && organisations.length === 0) ||
    (envLoading && environments.length === 0);

  const isMultiOrg = organisations.length > 1;

  // ─── Render environments for a project ───
  function renderEnvironments(projectId: string, orgId: string) {
    const indent = isMultiOrg ? 7 : 4;
    const envList = projectEnvMap[projectId] || [];
    const isLoadingEnvs = loadingProjects.has(projectId);

    if (isLoadingEnvs && envList.length === 0) {
      return (
        <ListItemButton dense disabled sx={{ pl: indent, py: 0.5 }}>
          <ListItemIcon sx={{ minWidth: 24 }}>
            <CircularProgress size={12} />
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
            <ProjectIcon sx={{ fontSize: 16, opacity: 0.5 }} />
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
                alpha(
                  itemColor,
                  theme.palette.mode === 'dark' ? 0.2 : 0.1
                ),
              '&:hover': {
                backgroundColor: (theme) =>
                  alpha(
                    itemColor,
                    theme.palette.mode === 'dark' ? 0.25 : 0.15
                  ),
              },
            },
            '&:hover': {
              backgroundColor: (theme) =>
                alpha(
                  itemColor,
                  theme.palette.mode === 'dark' ? 0.15 : 0.08
                ),
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 24 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: itemColor,
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
              sx={{ fontSize: 16, color: 'success.main', ml: 0.5 }}
            />
          )}
        </ListItemButton>
      );
    });
  }

  // ─── Render a project node with its environments ───
  function renderProject(
    proj: (typeof projects)[0],
    orgId: string,
    indent: number
  ) {
    const isProjExpanded = expandedProjects.has(proj.id);
    const isCurrentProject = proj.id === currentProjectId;

    return (
      <React.Fragment key={proj.id}>
        <ListItemButton
          onClick={() => handleToggleProject(proj.id, orgId)}
          dense
          sx={{
            py: 0.5,
            pl: indent,
            backgroundColor: isCurrentProject
              ? (theme) =>
                  alpha(
                    theme.palette.primary.main,
                    theme.palette.mode === 'dark' ? 0.1 : 0.04
                  )
              : 'transparent',
            '&:hover .manage-icon': { opacity: 0.5 },
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
            <ProjectIcon sx={{ fontSize: 16, opacity: 0.7 }} />
          </ListItemIcon>
          <ListItemText
            primary={proj.displayName || proj.projectName}
            primaryTypographyProps={{
              variant: 'body2',
              fontWeight: isCurrentProject ? 600 : 400,
            }}
          />
          <Tooltip title={t('sidebar.context.manage')} placement="top" arrow>
            <Box
              className="manage-icon"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                handleClose();
                navigate(`/admin/environments?orgId=${orgId}&projectId=${proj.id}`);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                opacity: 0,
                transition: 'opacity 0.15s',
                '&:hover': { opacity: '1 !important' },
              }}
            >
              <SettingsIcon sx={{ fontSize: 13 }} />
            </Box>
          </Tooltip>
        </ListItemButton>

        <Collapse in={isProjExpanded} timeout="auto">
          {renderEnvironments(proj.id, orgId)}
        </Collapse>
      </React.Fragment>
    );
  }



  // ─── Trigger element (unchanged from original) ───

  // Show nothing only if there are truly no environments (not just loading)
  if (!isLoading && environments.length === 0 && organisations.length === 0) {
    return null;
  }

  // During initial load with no data, show a placeholder to prevent layout shift
  if (isLoading && environments.length === 0) {
    return collapsed ? (
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          bgcolor: '#757575',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Skeleton
          variant="rectangular"
          width={20}
          height={16}
          sx={{ borderRadius: 0.5 }}
        />
      </Box>
    ) : (
      <Box sx={{ px: 0.75, py: 0.5 }}>
        <Skeleton width={60} height={16} sx={{ borderRadius: 0.5 }} />
      </Box>
    );
  }

  const trigger = collapsed ? (
    // Collapsed: G icon with env-color ring
    <Tooltip
      title={`${envLabel} — ${orgLabel} / ${projLabel}`}
      placement="right"
      arrow
    >
      <Box
        onClick={handleOpen}
        sx={{
          width: 32,
          height: 32,
          backgroundColor: theme.palette.primary.main,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: `2px solid ${envColor}`,
          transition: 'all 0.15s ease',
          '&:hover': { opacity: 0.8 },
        }}
      >
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
          G
        </Typography>
      </Box>
    </Tooltip>
  ) : (
    // Expanded: env name + breadcrumb + unfold icon
    <Box
      onClick={handleOpen}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        cursor: 'pointer',
        borderRadius: 1,
        px: 0.75,
        py: 0.5,
        minWidth: 0,
        flex: 1,
        transition: 'background-color 0.15s ease',
        '&:hover': {
          bgcolor: (th) =>
            th.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(0,0,0,0.04)',
          '& .context-unfold-icon': {
            opacity: 0.6,
          },
        },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            fontSize: '0.875rem',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: envColor,
          }}
        >
          {envLabel}
        </Typography>
        <Tooltip
          title={`${orgLabel} / ${projLabel}`}
          placement="bottom"
          arrow
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontSize: '0.625rem',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'block',
              opacity: 0.6,
              direction: 'rtl',
              textAlign: 'left',
            }}
          >
            {orgLabel} / {projLabel}
          </Typography>
        </Tooltip>
      </Box>
      <UnfoldMoreIcon
        className="context-unfold-icon"
        sx={{
          fontSize: 16,
          opacity: 0,
          transition: 'opacity 0.15s ease',
          flexShrink: 0,
        }}
      />
    </Box>
  );

  return (
    <>
      {trigger}

      {/* ─── Tree popover ─── */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              width: 280,
              maxHeight: 500,
              borderRadius: 2,
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
                  : '0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
              overflow: 'auto',
            },
          },
        }}
      >
        {/* Tree content */}
        <Box sx={{ py: 0.5 }}>
          {organisations.map((org) => {
            const isOrgExpanded = expandedOrgs.has(org.id) || !isMultiOrg;
            const orgProjects = projects.filter((p) => p.orgId === org.id);

            // Single-org: skip org header, show projects directly
            if (!isMultiOrg) {
              return (
                <React.Fragment key={org.id}>
                  {orgProjects.length === 0 ? (
                    <ListItemButton
                      onClick={() => {
                        handleClose();
                        navigate(`/admin/projects?orgId=${org.id}`);
                      }}
                      dense
                      sx={{ pl: 1.5, py: 0.75 }}
                    >
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <ProjectIcon
                          sx={{ fontSize: 16, opacity: 0.5 }}
                        />
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
                    orgProjects.map((proj) =>
                      renderProject(proj, org.id, 1.5)
                    )
                  )}
                </React.Fragment>
              );
            }

            // Multi-org: show org header with expand/collapse
            return (
              <React.Fragment key={org.id}>
                <ListItemButton
                  onClick={() => handleToggleOrg(org.id)}
                  dense
                  sx={{
                    py: 0.5,
                    '&:hover .manage-icon': { opacity: 0.5 },
                  }}
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
                      fontWeight:
                        currentOrg?.id === org.id ? 600 : 400,
                    }}
                  />
                  <Tooltip title={t('sidebar.context.manage')} placement="top" arrow>
                    <Box
                      className="manage-icon"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleClose();
                        navigate(`/admin/projects?orgId=${org.id}`);
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        opacity: 0,
                        transition: 'opacity 0.15s',
                        '&:hover': { opacity: '1 !important' },
                      }}
                    >
                      <SettingsIcon sx={{ fontSize: 13 }} />
                    </Box>
                  </Tooltip>
                </ListItemButton>

                <Collapse in={isOrgExpanded} timeout="auto">
                  {orgProjects.length === 0 && (
                    <ListItemButton
                      onClick={() => {
                        handleClose();
                        navigate(
                          `/admin/projects?orgId=${org.id}`
                        );
                      }}
                      dense
                      sx={{ pl: 4, py: 0.75 }}
                    >
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <ProjectIcon
                          sx={{ fontSize: 16, opacity: 0.5 }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={t(
                          'environments.goToProjectManagement'
                        )}
                        primaryTypographyProps={{
                          variant: 'caption',
                          color: 'text.secondary',
                          fontStyle: 'italic',
                        }}
                      />
                    </ListItemButton>
                  )}
                  {orgProjects.map((proj) =>
                    renderProject(proj, org.id, 4)
                  )}
                </Collapse>
              </React.Fragment>
            );
          })}
        </Box>


      </Popover>
    </>
  );
};

export default SidebarContextSwitcher;
