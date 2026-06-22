import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Popover,
  TextField,
  Checkbox,
  Typography,
  Button,
  Divider,
  InputAdornment,
  Collapse,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Search as SearchIcon,
  Business as OrgIcon,
  Folder as ProjectIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// ─── Types ─────────────────────────

export interface TreeEnvironment {
  environmentId: string;
  environmentName: string;
  environmentType?: string;
  projectId: string;
  projectName: string;
  orgId: string;
  orgName: string;
}

interface OrgNode {
  orgId: string;
  orgName: string;
  projects: ProjectNode[];
}

interface ProjectNode {
  projectId: string;
  projectName: string;
  environments: TreeEnvironment[];
}

interface EnvironmentTreeFilterChipProps {
  /** Chip label (default: i18n 'network.environment') */
  label?: string;
  /** Flat list of environments with org/project hierarchy info */
  environments: TreeEnvironment[];
  /** Currently selected environment IDs */
  selected: string[];
  /** Called when selection changes */
  onChange: (selected: string[]) => void;
}

// ─── Environment type color ─────────────────────────

const getEnvTypeColor = (type?: string): string => {
  switch (type) {
    case 'production':
      return '#d32f2f';
    case 'staging':
      return '#ed6c02';
    case 'development':
      return '#2e7d32';
    case 'review':
      return '#1976d2';
    default:
      return '#757575';
  }
};

// ─── Component ─────────────────────────

const EnvironmentTreeFilterChip: React.FC<EnvironmentTreeFilterChipProps> = ({
  label,
  environments,
  selected,
  onChange,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchText, setSearchText] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const open = Boolean(anchorEl);

  const chipLabel = label || t('network.environment');

  // ─── Build tree from flat list ─────────────────────────

  const tree = useMemo((): OrgNode[] => {
    const orgMap = new Map<string, OrgNode>();

    for (const env of environments) {
      let org = orgMap.get(env.orgId);
      if (!org) {
        org = { orgId: env.orgId, orgName: env.orgName, projects: [] };
        orgMap.set(env.orgId, org);
      }

      let project = org.projects.find((p) => p.projectId === env.projectId);
      if (!project) {
        project = {
          projectId: env.projectId,
          projectName: env.projectName,
          environments: [],
        };
        org.projects.push(project);
      }

      if (
        !project.environments.some((e) => e.environmentId === env.environmentId)
      ) {
        project.environments.push(env);
      }
    }

    return Array.from(orgMap.values());
  }, [environments]);

  const isMultiOrg = tree.length > 1;
  const totalEnvCount = environments.length;
  const selectedCount = selected.length;
  const noneSelected = selectedCount === 0;
  const allSelected = selectedCount === totalEnvCount && totalEnvCount > 0;

  // ─── Summary text for chip ─────────────────────────

  const summaryText = useMemo(() => {
    if (allSelected) return t('common.all', 'All');
    if (noneSelected) return t('common.none', 'None');
    if (selectedCount <= 2) {
      const labels = environments
        .filter((e) => selected.includes(e.environmentId))
        .map((e) => e.environmentName);
      return labels.join(', ');
    }
    return `${selectedCount}/${totalEnvCount}`;
  }, [
    allSelected,
    noneSelected,
    selected,
    environments,
    selectedCount,
    totalEnvCount,
    t,
  ]);

  // ─── Filtered tree by search ─────────────────────────

  const filteredTree = useMemo((): OrgNode[] => {
    if (!searchText) return tree;
    const lower = searchText.toLowerCase();

    return tree
      .map((org) => {
        const orgMatch = org.orgName.toLowerCase().includes(lower);
        const filteredProjects = org.projects
          .map((proj) => {
            const projMatch = proj.projectName.toLowerCase().includes(lower);
            const filteredEnvs = proj.environments.filter(
              (env) =>
                env.environmentName.toLowerCase().includes(lower) ||
                projMatch ||
                orgMatch
            );
            if (filteredEnvs.length > 0) {
              return { ...proj, environments: filteredEnvs };
            }
            return null;
          })
          .filter((p): p is ProjectNode => p !== null);

        if (filteredProjects.length > 0) {
          return { ...org, projects: filteredProjects };
        }
        return null;
      })
      .filter((o): o is OrgNode => o !== null);
  }, [tree, searchText]);

  // ─── Handlers ─────────────────────────

  const handleOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      setAnchorEl(e.currentTarget);
      setSearchText('');
      // Auto-expand all orgs and all projects
      setExpandedOrgs(new Set(tree.map((o) => o.orgId)));
      setExpandedProjects(
        new Set(tree.flatMap((o) => o.projects.map((p) => p.projectId)))
      );
    },
    [tree]
  );

  const handleClose = useCallback(() => {
    setAnchorEl(null);
    setSearchText('');
  }, []);

  const handleSelectAll = useCallback(() => {
    onChange(environments.map((e) => e.environmentId));
  }, [environments, onChange]);

  const handleDeselectAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const toggleEnvironment = useCallback(
    (envId: string) => {
      if (selected.includes(envId)) {
        onChange(selected.filter((id) => id !== envId));
      } else {
        onChange([...selected, envId]);
      }
    },
    [selected, onChange]
  );

  const toggleProject = useCallback(
    (project: ProjectNode) => {
      const envIds = project.environments.map((e) => e.environmentId);
      const allChecked = envIds.every((id) => selected.includes(id));

      if (allChecked) {
        onChange(selected.filter((id) => !envIds.includes(id)));
      } else {
        const newSelected = new Set(selected);
        envIds.forEach((id) => newSelected.add(id));
        onChange(Array.from(newSelected));
      }
    },
    [selected, onChange]
  );

  const toggleOrg = useCallback(
    (org: OrgNode) => {
      const envIds = org.projects.flatMap((p) =>
        p.environments.map((e) => e.environmentId)
      );
      const allChecked = envIds.every((id) => selected.includes(id));

      if (allChecked) {
        onChange(selected.filter((id) => !envIds.includes(id)));
      } else {
        const newSelected = new Set(selected);
        envIds.forEach((id) => newSelected.add(id));
        onChange(Array.from(newSelected));
      }
    },
    [selected, onChange]
  );

  const toggleExpandOrg = useCallback((orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  }, []);

  const toggleExpandProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  // ─── Check helpers ─────────────────────────

  const isOrgChecked = (org: OrgNode) => {
    const envIds = org.projects.flatMap((p) =>
      p.environments.map((e) => e.environmentId)
    );
    return envIds.length > 0 && envIds.every((id) => selected.includes(id));
  };

  const isOrgIndeterminate = (org: OrgNode) => {
    const envIds = org.projects.flatMap((p) =>
      p.environments.map((e) => e.environmentId)
    );
    const cnt = envIds.filter((id) => selected.includes(id)).length;
    return cnt > 0 && cnt < envIds.length;
  };

  const isProjectChecked = (project: ProjectNode) => {
    const envIds = project.environments.map((e) => e.environmentId);
    return envIds.length > 0 && envIds.every((id) => selected.includes(id));
  };

  const isProjectIndeterminate = (project: ProjectNode) => {
    const envIds = project.environments.map((e) => e.environmentId);
    const cnt = envIds.filter((id) => selected.includes(id)).length;
    return cnt > 0 && cnt < envIds.length;
  };

  // ─── Render ─────────────────────────

  return (
    <>
      {/* Chip trigger — same design as MultiSelectFilterChip */}
      <Box
        onClick={handleOpen}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          height: '32px',
          borderRadius: '4px',
          border: '1px solid',
          borderColor: open ? 'primary.main' : 'divider',
          bgcolor: open ? 'action.hover' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.15s',
          overflow: 'hidden',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
        {/* Label section */}
        <Box
          sx={{
            px: 1,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.04)',
            borderRight: '1px solid',
            borderRightColor: 'divider',
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color: 'text.secondary',
              whiteSpace: 'nowrap',
            }}
          >
            {chipLabel}
          </Typography>
        </Box>
        {/* Value section */}
        <Box
          sx={{
            px: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: noneSelected ? 'error.main' : 'text.primary',
              whiteSpace: 'nowrap',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {summaryText}
          </Typography>
          <ExpandMoreIcon
            sx={{
              fontSize: 14,
              color: 'text.disabled',
              transition: 'transform 0.2s',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              ml: -0.25,
            }}
          />
        </Box>
      </Box>

      {/* Popover */}
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
              minWidth: 300,
              maxWidth: 400,
              borderRadius: '10px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        {/* Header: Select All / Deselect All */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 1.5,
            pt: 1,
            pb: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: 'text.secondary' }}
          >
            {chipLabel}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              onClick={handleSelectAll}
              disabled={allSelected}
              sx={{
                minWidth: 'auto',
                px: 0.75,
                py: 0,
                fontSize: '0.7rem',
                textTransform: 'none',
              }}
            >
              {t('common.selectAll', 'All')}
            </Button>
            <Button
              size="small"
              onClick={handleDeselectAll}
              disabled={noneSelected}
              sx={{
                minWidth: 'auto',
                px: 0.75,
                py: 0,
                fontSize: '0.7rem',
                textTransform: 'none',
              }}
            >
              {t('common.deselectAll', 'None')}
            </Button>
          </Box>
        </Box>

        <Divider />

        {/* Search (long lists only) */}
        {totalEnvCount > 8 && (
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
            <TextField
              size="small"
              placeholder={t('common.search', 'Search...')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              fullWidth
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiInputBase-root': {
                  height: '30px',
                  fontSize: '0.8rem',
                },
              }}
            />
          </Box>
        )}

        {/* Tree */}
        <Box sx={{ maxHeight: 320, overflowY: 'auto', py: 0.5 }}>
          {filteredTree.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                px: 1.5,
                py: 1,
                textAlign: 'center',
                fontSize: '0.8rem',
              }}
            >
              {t('common.noResults', 'No results')}
            </Typography>
          ) : (
            filteredTree.map((org) => {
              const isOrgExpanded = expandedOrgs.has(org.orgId) || !isMultiOrg;

              return (
                <Box key={org.orgId}>
                  {/* Org level — only for multi-org */}
                  {isMultiOrg && (
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 0.5,
                        py: 0.25,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                    >
                      <Box
                        onClick={() => toggleExpandOrg(org.orgId)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          mr: 0.25,
                        }}
                      >
                        {isOrgExpanded ? (
                          <ExpandMoreIcon sx={{ fontSize: 18 }} />
                        ) : (
                          <ChevronRightIcon sx={{ fontSize: 18 }} />
                        )}
                      </Box>
                      <Checkbox
                        size="small"
                        checked={isOrgChecked(org)}
                        indeterminate={isOrgIndeterminate(org)}
                        onChange={() => toggleOrg(org)}
                        sx={{
                          p: 0.25,
                          '& .MuiSvgIcon-root': { fontSize: 18 },
                        }}
                      />
                      <OrgIcon
                        sx={{
                          fontSize: 15,
                          mx: 0.5,
                          color: 'primary.main',
                          opacity: 0.7,
                        }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ fontSize: '0.8rem', fontWeight: 500 }}
                      >
                        {org.orgName}
                      </Typography>
                    </Box>
                  )}

                  {/* Projects */}
                  <Collapse in={isOrgExpanded}>
                    {org.projects.map((project) => {
                      const isProjExpanded = expandedProjects.has(
                        project.projectId
                      );
                      const projectIndent = isMultiOrg ? 2.5 : 0.5;
                      const envIndent = isMultiOrg ? 5 : 3;

                      return (
                        <Box key={project.projectId}>
                          {/* Project level */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              pl: projectIndent,
                              pr: 0.5,
                              py: 0.25,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            <Box
                              onClick={() =>
                                toggleExpandProject(project.projectId)
                              }
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                mr: 0.25,
                              }}
                            >
                              {isProjExpanded ? (
                                <ExpandMoreIcon sx={{ fontSize: 18 }} />
                              ) : (
                                <ChevronRightIcon sx={{ fontSize: 18 }} />
                              )}
                            </Box>
                            <Checkbox
                              size="small"
                              checked={isProjectChecked(project)}
                              indeterminate={isProjectIndeterminate(project)}
                              onChange={() => toggleProject(project)}
                              sx={{
                                p: 0.25,
                                '& .MuiSvgIcon-root': { fontSize: 18 },
                              }}
                            />
                            <ProjectIcon
                              sx={{
                                fontSize: 15,
                                mx: 0.5,
                                color: 'text.secondary',
                                opacity: 0.7,
                              }}
                            />
                            <Typography
                              variant="body2"
                              sx={{ fontSize: '0.8rem', fontWeight: 500 }}
                            >
                              {project.projectName}
                            </Typography>
                          </Box>

                          {/* Environments (leaf) */}
                          <Collapse in={isProjExpanded}>
                            {project.environments.map((env) => {
                              const isChecked = selected.includes(
                                env.environmentId
                              );
                              const envColor = getEnvTypeColor(
                                env.environmentType
                              );

                              return (
                                <Box
                                  key={env.environmentId}
                                  onClick={() =>
                                    toggleEnvironment(env.environmentId)
                                  }
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    pl: envIndent,
                                    pr: 1,
                                    py: 0.25,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'action.hover' },
                                  }}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    size="small"
                                    sx={{
                                      p: 0.25,
                                      '& .MuiSvgIcon-root': { fontSize: 18 },
                                    }}
                                  />
                                  <Box
                                    sx={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 0.5,
                                      bgcolor: envColor,
                                      mx: 0.75,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontSize: '0.8rem',
                                      fontWeight: isChecked ? 600 : 400,
                                      color: isChecked
                                        ? 'text.primary'
                                        : 'text.secondary',
                                    }}
                                  >
                                    {env.environmentName}
                                  </Typography>
                                </Box>
                              );
                            })}
                          </Collapse>
                        </Box>
                      );
                    })}
                  </Collapse>
                </Box>
              );
            })
          )}
        </Box>
      </Popover>
    </>
  );
};

export default EnvironmentTreeFilterChip;
