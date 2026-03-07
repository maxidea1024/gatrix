import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Checkbox,
  Collapse,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  Business as OrgIcon,
  Folder as ProjectIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import orgProjectService, {
  type Organisation,
  type Project,
  type AccessTree,
} from '@/services/orgProjectService';
import rbacService, { type Role } from '@/services/rbacService';
import type { AutoJoinMembership, AutoJoinRoleBinding } from '@/types/invitation';

// ==================== Types ====================

interface OrgNode {
  org: Organisation;
  projects: Project[];
}

interface OrgProjectTreeSelectorProps {
  value: AutoJoinMembership[];
  onChange: (value: AutoJoinMembership[]) => void;
}

// ==================== Component ====================

const OrgProjectTreeSelector: React.FC<OrgProjectTreeSelectorProps> = ({ value, onChange }) => {
  const { t } = useTranslation();

  // Data
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [accessTree, orgs, projects, roleList] = await Promise.all([
        orgProjectService.getMyAccess(),
        orgProjectService.getOrganisations(),
        orgProjectService.getProjects(),
        rbacService.getRoles(),
      ]);

      // Build tree from access tree (only orgs/projects current user has access to)
      const orgMap = new Map(orgs.map((o) => [o.id, o]));
      const projectMap = new Map(projects.map((p) => [p.id, p]));

      const nodes: OrgNode[] = [];
      for (const [orgId, access] of Object.entries(accessTree)) {
        const org = orgMap.get(orgId);
        if (!org) continue;

        const orgProjects = access.projectIds
          .map((pid) => projectMap.get(pid))
          .filter((p): p is Project => !!p);

        nodes.push({ org, projects: orgProjects });
      }

      setTree(nodes);
      setRoles(roleList);
    } catch (err) {
      console.error('Failed to load org/project tree:', err);
      setError(t('autoJoin.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Helpers ─────────────────────────

  // Find the default role (Viewer) for safety
  const getDefaultRoleId = (): string | undefined => {
    const viewerRole = roles.find((r) => r.roleName.toLowerCase() === 'viewer');
    return viewerRole?.id;
  };

  const getMembership = (orgId: string): AutoJoinMembership | undefined => {
    return value.find((m) => m.orgId === orgId);
  };

  const isOrgChecked = (orgId: string): boolean => {
    return !!getMembership(orgId);
  };

  const isProjectChecked = (orgId: string, projectId: string): boolean => {
    const m = getMembership(orgId);
    return !!m?.projectIds.includes(projectId);
  };

  const getOrgRoleBinding = (orgId: string): AutoJoinRoleBinding | undefined => {
    const m = getMembership(orgId);
    return m?.roleBindings.find((rb) => rb.scopeType === 'org' && rb.scopeId === orgId);
  };

  const getProjectRoleBinding = (
    orgId: string,
    projectId: string
  ): AutoJoinRoleBinding | undefined => {
    const m = getMembership(orgId);
    return m?.roleBindings.find((rb) => rb.scopeType === 'project' && rb.scopeId === projectId);
  };

  // ─── Handlers ─────────────────────────

  const toggleOrg = (orgId: string) => {
    if (isOrgChecked(orgId)) {
      // Remove org
      onChange(value.filter((m) => m.orgId !== orgId));
    } else {
      // Add org with default Viewer role binding for safety
      const defaultRoleId = getDefaultRoleId();
      const defaultBindings: AutoJoinRoleBinding[] = defaultRoleId
        ? [{ roleId: defaultRoleId, scopeType: 'org', scopeId: orgId }]
        : [];
      onChange([...value, { orgId, projectIds: [], roleBindings: defaultBindings }]);
      // Auto-expand
      setExpandedOrgs((prev) => new Set([...prev, orgId]));
    }
  };

  const toggleProject = (orgId: string, projectId: string) => {
    const existing = getMembership(orgId);
    if (!existing) {
      // Auto-check org when checking project, with default Viewer bindings
      const defaultRoleId = getDefaultRoleId();
      const defaultBindings: AutoJoinRoleBinding[] = defaultRoleId
        ? [
            { roleId: defaultRoleId, scopeType: 'org', scopeId: orgId },
            { roleId: defaultRoleId, scopeType: 'project', scopeId: projectId },
          ]
        : [];
      onChange([...value, { orgId, projectIds: [projectId], roleBindings: defaultBindings }]);
      setExpandedOrgs((prev) => new Set([...prev, orgId]));
      return;
    }

    const newProjectIds = existing.projectIds.includes(projectId)
      ? existing.projectIds.filter((id) => id !== projectId)
      : [...existing.projectIds, projectId];

    // Remove project role bindings if unchecked, add default Viewer if checked
    let newBindings: AutoJoinRoleBinding[];
    if (existing.projectIds.includes(projectId)) {
      // Unchecking: remove project bindings
      newBindings = existing.roleBindings.filter(
        (rb) => !(rb.scopeType === 'project' && rb.scopeId === projectId)
      );
    } else {
      // Checking: add default Viewer role binding
      const defaultRoleId = getDefaultRoleId();
      newBindings = defaultRoleId
        ? [
            ...existing.roleBindings,
            { roleId: defaultRoleId, scopeType: 'project' as const, scopeId: projectId },
          ]
        : existing.roleBindings;
    }

    onChange(
      value.map((m) =>
        m.orgId === orgId ? { ...m, projectIds: newProjectIds, roleBindings: newBindings } : m
      )
    );
  };

  const setRoleBinding = (
    orgId: string,
    scopeType: 'org' | 'project',
    scopeId: string,
    roleId: string
  ) => {
    const existing = getMembership(orgId);
    if (!existing) return;

    // Remove existing binding for this scope, add new one
    const filteredBindings = existing.roleBindings.filter(
      (rb) => !(rb.scopeType === scopeType && rb.scopeId === scopeId)
    );

    const newBindings = roleId
      ? [...filteredBindings, { roleId, scopeType, scopeId }]
      : filteredBindings;

    onChange(value.map((m) => (m.orgId === orgId ? { ...m, roleBindings: newBindings } : m)));
  };

  const toggleExpand = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }
      return next;
    });
  };

  // ─── Render ─────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (tree.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
        {t('autoJoin.noOrgsAvailable')}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
        {t('autoJoin.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8rem' }}>
        {t('autoJoin.description')}
      </Typography>

      <Box
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {tree.map((node, idx) => (
          <Box
            key={node.org.id}
            sx={{
              borderBottom: idx < tree.length - 1 ? '1px solid' : 'none',
              borderColor: 'divider',
            }}
          >
            {/* Org row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1,
                py: 0.5,
                bgcolor: isOrgChecked(node.org.id) ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {/* Expand toggle */}
              <Box
                sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', mr: 0.5 }}
                onClick={() => toggleExpand(node.org.id)}
              >
                {node.projects.length > 0 ? (
                  expandedOrgs.has(node.org.id) ? (
                    <ExpandMoreIcon fontSize="small" />
                  ) : (
                    <ChevronRightIcon fontSize="small" />
                  )
                ) : (
                  <Box sx={{ width: 24 }} />
                )}
              </Box>

              <Checkbox
                size="small"
                checked={isOrgChecked(node.org.id)}
                onChange={() => toggleOrg(node.org.id)}
                sx={{ p: 0.5 }}
              />

              <OrgIcon fontSize="small" sx={{ mx: 0.5, color: 'primary.main' }} />
              <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                {node.org.displayName || node.org.orgName}
              </Typography>

              {/* Role selector for org */}
              {isOrgChecked(node.org.id) && (
                <Select
                  size="small"
                  value={getOrgRoleBinding(node.org.id)?.roleId || ''}
                  displayEmpty
                  onChange={(e) =>
                    setRoleBinding(node.org.id, 'org', node.org.id, e.target.value as string)
                  }
                  sx={{ minWidth: 140, fontSize: '0.8rem', height: 30 }}
                  MenuProps={{ sx: { zIndex: 2000 } }}
                >
                  <MenuItem value="">
                    <em>{t('autoJoin.noRole')}</em>
                  </MenuItem>
                  {roles.map((role) => (
                    <MenuItem key={role.id} value={role.id}>
                      {role.roleName}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </Box>

            {/* Projects */}
            <Collapse in={expandedOrgs.has(node.org.id)}>
              {node.projects.map((project) => (
                <Box
                  key={project.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    pl: 5,
                    pr: 1,
                    py: 0.5,
                    bgcolor: isProjectChecked(node.org.id, project.id)
                      ? 'action.selected'
                      : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={isProjectChecked(node.org.id, project.id)}
                    onChange={() => toggleProject(node.org.id, project.id)}
                    sx={{ p: 0.5 }}
                  />

                  <ProjectIcon fontSize="small" sx={{ mx: 0.5, color: 'text.secondary' }} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {project.displayName || project.projectName}
                  </Typography>

                  {/* Role selector for project */}
                  {isProjectChecked(node.org.id, project.id) && (
                    <Select
                      size="small"
                      value={getProjectRoleBinding(node.org.id, project.id)?.roleId || ''}
                      displayEmpty
                      onChange={(e) =>
                        setRoleBinding(node.org.id, 'project', project.id, e.target.value as string)
                      }
                      sx={{ minWidth: 140, fontSize: '0.8rem', height: 30 }}
                      MenuProps={{ sx: { zIndex: 2000 } }}
                    >
                      <MenuItem value="">
                        <em>{t('autoJoin.noRole')}</em>
                      </MenuItem>
                      {roles.map((role) => (
                        <MenuItem key={role.id} value={role.id}>
                          {role.roleName}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                </Box>
              ))}
            </Collapse>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default OrgProjectTreeSelector;
