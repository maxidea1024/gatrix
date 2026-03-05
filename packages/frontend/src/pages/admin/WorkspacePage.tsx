import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Alert,
  Tooltip,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
} from '@mui/material';
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  CalendarToday as CalendarTodayIcon,
  Folder as ProjectIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { orgProjectService, Organisation, Project, AccessTree } from '@/services/orgProjectService';
import { rbacService } from '@/services/rbacService';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import PageContentLoader from '@/components/common/PageContentLoader';
import { useNavigate } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';

interface OrgWithMemberCount extends Organisation {
  memberCount: number;
}

const WorkspacePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrgId } = useOrgProject();
  const [organisations, setOrganisations] = useState<OrgWithMemberCount[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessTree, setAccessTree] = useState<AccessTree>({});
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const loadOrganisations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const orgs = await orgProjectService.getOrganisations();

      // Load member counts for each org
      const orgsWithCounts = await Promise.all(
        orgs.map(async (org) => {
          try {
            const members = await rbacService.getOrgMembers(org.id);
            return { ...org, memberCount: members.length };
          } catch {
            return { ...org, memberCount: 0 };
          }
        })
      );

      setOrganisations(orgsWithCounts);

      // Load projects and access tree
      try {
        const [projectData, access] = await Promise.all([
          orgProjectService.getProjects(),
          orgProjectService.getMyAccess(),
        ]);
        setAllProjects(projectData);
        setAccessTree(access);
      } catch {
        console.warn('Failed to load projects/access tree');
      }
    } catch (err) {
      setError(t('workspace.loadFailed'));
      console.error('Failed to load organisations:', err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOrganisations();
  }, [loadOrganisations]);

  const handleToggleExpand = (e: React.MouseEvent, orgId: string) => {
    e.stopPropagation();
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

  // Get accessible projects for an org
  const getAccessibleProjects = (orgId: string): Project[] => {
    const orgAccess = accessTree[orgId];
    if (!orgAccess) return [];
    return allProjects.filter((p) => orgAccess.projectIds.includes(p.id));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={600} gutterBottom>
          {t('workspace.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('workspace.subtitle')}
        </Typography>
      </Box>

      <PageContentLoader loading={loading}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {organisations.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 8,
              color: 'text.secondary',
            }}
          >
            <BusinessIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
            <Typography variant="h6">{t('workspace.noOrganisations')}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('workspace.noOrganisationsDesc')}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: 3,
            }}
          >
            {organisations.map((org) => {
              const isExpanded = expandedOrgs.has(org.id);
              const accessibleProjects = getAccessibleProjects(org.id);

              return (
                <Card
                  key={org.id}
                  sx={{
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: org.id === currentOrgId ? 'primary.main' : 'divider',
                    boxShadow:
                      org.id === currentOrgId
                        ? (theme) =>
                            `0 0 0 2px ${theme.palette.primary.main}40, 0 4px 12px ${theme.palette.primary.main}20`
                        : '0 2px 8px rgba(0, 0, 0, 0.06)',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      boxShadow:
                        org.id === currentOrgId
                          ? (theme) =>
                              `0 0 0 2px ${theme.palette.primary.main}60, 0 6px 20px ${theme.palette.primary.main}30`
                          : '0 4px 16px rgba(0, 0, 0, 0.1)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardActionArea onClick={() => navigate(`/admin/projects?orgId=${org.id}`)}>
                    <CardContent sx={{ p: 3 }}>
                      {/* Header */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          mb: 2,
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: 'primary.main',
                              color: 'primary.contrastText',
                              flexShrink: 0,
                            }}
                          >
                            <BusinessIcon fontSize="small" />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="subtitle1"
                              fontWeight={600}
                              noWrap
                              title={org.displayName}
                            >
                              {org.displayName}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              noWrap
                              sx={{ display: 'block' }}
                              title={org.orgName}
                            >
                              {org.orgName}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          label={org.isActive ? t('common.active') : t('common.inactive')}
                          size="small"
                          color={org.isActive ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ flexShrink: 0, ml: 1 }}
                        />
                      </Box>

                      {/* Description */}
                      {org.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.6,
                          }}
                        >
                          {org.description}
                        </Typography>
                      )}

                      {/* Footer info */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          pt: 2,
                          borderTop: '1px solid',
                          borderColor: 'divider',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            {org.memberCount} {t('workspace.members')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Tooltip title={formatDateTimeDetailed(org.createdAt)} arrow>
                            <Typography variant="caption" color="text.secondary">
                              {formatRelativeTime(org.createdAt)}
                            </Typography>
                          </Tooltip>
                        </Box>
                      </Box>
                    </CardContent>
                  </CardActionArea>

                  {/* Expandable project list */}
                  {accessibleProjects.length > 0 && (
                    <Box
                      sx={{
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <ListItemButton
                        onClick={(e) => handleToggleExpand(e, org.id)}
                        dense
                        sx={{ py: 0.5 }}
                      >
                        <ListItemIcon sx={{ minWidth: 28 }}>
                          {isExpanded ? (
                            <ExpandMoreIcon sx={{ fontSize: 18 }} />
                          ) : (
                            <ChevronRightIcon sx={{ fontSize: 18 }} />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary={`${t('common.project')} (${accessibleProjects.length})`}
                          primaryTypographyProps={{
                            variant: 'caption',
                            color: 'text.secondary',
                            fontWeight: 500,
                          }}
                        />
                      </ListItemButton>
                      <Collapse in={isExpanded}>
                        <List dense disablePadding>
                          {accessibleProjects.map((proj) => (
                            <ListItemButton
                              key={proj.id}
                              onClick={() =>
                                navigate(`/admin/environments?orgId=${org.id}&projectId=${proj.id}`)
                              }
                              sx={{ pl: 4, py: 0.25 }}
                            >
                              <ListItemIcon sx={{ minWidth: 24 }}>
                                <ProjectIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={proj.displayName || proj.projectName}
                                primaryTypographyProps={{
                                  variant: 'body2',
                                  noWrap: true,
                                }}
                              />
                            </ListItemButton>
                          ))}
                        </List>
                      </Collapse>
                    </Box>
                  )}
                </Card>
              );
            })}
          </Box>
        )}
      </PageContentLoader>
    </Box>
  );
};

export default WorkspacePage;
