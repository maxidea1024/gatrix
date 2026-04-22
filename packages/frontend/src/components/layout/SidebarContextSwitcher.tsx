import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Popover,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  alpha,
  InputBase,
  Tooltip,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Business as OrgIcon,
  Folder as ProjectIcon,
  Search as SearchIcon,
  Check as CheckIcon,
  UnfoldMore as UnfoldMoreIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useTranslation } from 'react-i18next';

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

// ─── Searchable list inside popover ───
interface SelectionListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getIcon?: (item: T) => React.ReactNode;
  selectedKey: string | null;
  onSelect: (item: T) => void;
  emptyMessage: string;
  searchable?: boolean;
  title?: string;
  onManageClick?: () => void;
  manageTooltip?: string;
}

function SelectionList<T>({
  items,
  getKey,
  getLabel,
  getIcon,
  selectedKey,
  onSelect,
  emptyMessage,
  searchable = false,
  title,
  onManageClick,
  manageTooltip,
}: SelectionListProps<T>) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => getLabel(item).toLowerCase().includes(q));
  }, [items, search, getLabel]);

  return (
    <Box>
      {title && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1.5,
            pt: 1,
            pb: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontSize: '0.6875rem',
              opacity: 0.5,
            }}
          >
            {title}
          </Typography>
          {onManageClick && (
            <Tooltip title={manageTooltip || ''} placement="top" arrow>
              <Box
                component="span"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onManageClick();
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: 0.5,
                  cursor: 'pointer',
                  opacity: 0.4,
                  transition: 'opacity 0.15s ease, background-color 0.15s ease',
                  '&:hover': {
                    opacity: 1,
                    bgcolor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.08)',
                  },
                }}
              >
                <SettingsIcon sx={{ fontSize: 13 }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      )}
      {searchable && items.length > 3 && (
        <Box sx={{ px: 1.5, pb: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.03)',
            }}
          >
            <SearchIcon sx={{ fontSize: 14, opacity: 0.4 }} />
            <InputBase
              inputRef={searchRef}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ fontSize: '0.8125rem', flex: 1 }}
              size="small"
              autoFocus={searchable}
            />
          </Box>
        </Box>
      )}
      <List dense sx={{ py: 0.5, maxHeight: 200, overflow: 'auto' }}>
        {filtered.length === 0 ? (
          <ListItemButton disabled dense>
            <ListItemText
              primary={emptyMessage}
              primaryTypographyProps={{
                variant: 'caption',
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            />
          </ListItemButton>
        ) : (
          filtered.map((item) => {
            const key = getKey(item);
            const isSelected = key === selectedKey;
            return (
              <ListItemButton
                key={key}
                selected={isSelected}
                onClick={() => onSelect(item)}
                dense
                sx={{
                  py: 0.5,
                  px: 1.5,
                  '&.Mui-selected': {
                    bgcolor: (theme) =>
                      alpha(
                        theme.palette.primary.main,
                        theme.palette.mode === 'dark' ? 0.15 : 0.08
                      ),
                  },
                }}
              >
                {getIcon && (
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <Box sx={{ display: 'flex' }}>{getIcon(item)}</Box>
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={getLabel(item)}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: isSelected ? 600 : 400,
                    noWrap: true,
                  }}
                />
                {isSelected && (
                  <CheckIcon
                    sx={{ fontSize: 16, color: 'primary.main', ml: 0.5 }}
                  />
                )}
              </ListItemButton>
            );
          })
        )}
      </List>
    </Box>
  );
}

// ─── Main component: Header-integrated context switcher ───
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
    switchOrg,
    switchProject,
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

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleSelectOrg = useCallback(
    (org: (typeof organisations)[0]) => {
      switchOrg(org.id);
      handleClose();
    },
    [switchOrg, handleClose]
  );

  const orgProjects = useMemo(
    () =>
      currentOrgId
        ? projects.filter((p) => p.orgId === currentOrgId)
        : projects,
    [projects, currentOrgId]
  );

  const handleSelectProject = useCallback(
    (proj: (typeof projects)[0]) => {
      switchProject(proj.id);
      handleClose();
    },
    [switchProject, handleClose]
  );

  const handleSelectEnv = useCallback(
    (env: (typeof environments)[0]) => {
      if (currentOrgId && currentProjectId) {
        switchEnvironment(currentOrgId, currentProjectId, env.environmentId);
      }
      handleClose();
    },
    [currentOrgId, currentProjectId, switchEnvironment, handleClose]
  );

  // Labels
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

  // ─── Trigger element ───
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
        },
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        {isLoading ? (
          <Skeleton width={60} height={16} sx={{ borderRadius: 0.5 }} />
        ) : (
          <>
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
                }}
              >
                {orgLabel} / {projLabel}
              </Typography>
            </Tooltip>
          </>
        )}
      </Box>
      <UnfoldMoreIcon
        sx={{
          fontSize: 16,
          opacity: 0.4,
          flexShrink: 0,
        }}
      />
    </Box>
  );

  const triggerElement = trigger;

  return (
    <>
      {triggerElement}

      {/* ─── Combined popover with all 3 sections ─── */}
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
        {/* Organisation */}
        <SelectionList
          title={t('sidebar.context.organisation', 'Organisation')}
          items={organisations}
          getKey={(o) => o.id}
          getLabel={(o) => o.displayName || o.orgName}
          getIcon={() => <OrgIcon sx={{ fontSize: 16, opacity: 0.6 }} />}
          selectedKey={currentOrgId}
          onSelect={handleSelectOrg}
          emptyMessage={t('sidebar.context.noOrgs')}
          searchable
          onManageClick={() => {
            handleClose();
            navigate('/admin/workspace?tab=organisations');
          }}
          manageTooltip={t('sidebar.context.manage')}
        />

        <Divider />

        {/* Project */}
        <SelectionList
          title={t('sidebar.context.project', 'Project')}
          items={orgProjects}
          getKey={(p) => p.id}
          getLabel={(p) => p.displayName || p.projectName}
          getIcon={() => <ProjectIcon sx={{ fontSize: 16, opacity: 0.6 }} />}
          selectedKey={currentProjectId}
          onSelect={handleSelectProject}
          emptyMessage={t('sidebar.context.noProjects')}
          searchable
          onManageClick={() => {
            handleClose();
            navigate('/admin/workspace?tab=projects');
          }}
          manageTooltip={t('sidebar.context.manage')}
        />

        <Divider />

        {/* Environment */}
        <SelectionList
          title={t('sidebar.context.environment', 'Environment')}
          items={environments}
          getKey={(e) => e.environmentId}
          getLabel={(e) => e.displayName || e.environmentName}
          getIcon={(e) => {
            const c = getEnvironmentColor(e.environmentType, e.color);
            return (
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: c,
                  boxShadow: `0 0 4px ${alpha(c, 0.5)}`,
                }}
              />
            );
          }}
          selectedKey={currentEnvironmentId}
          onSelect={handleSelectEnv}
          emptyMessage={t('sidebar.context.noEnvironments')}
          onManageClick={() => {
            handleClose();
            navigate('/admin/workspace?tab=environments');
          }}
          manageTooltip={t('sidebar.context.manage')}
        />
      </Popover>
    </>
  );
};

export default SidebarContextSwitcher;
