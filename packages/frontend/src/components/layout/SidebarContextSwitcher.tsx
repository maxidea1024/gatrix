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
} from '@mui/material';
import {
  Business as OrgIcon,
  Folder as ProjectIcon,
  UnfoldMore as UnfoldMoreIcon,
  Search as SearchIcon,
  Check as CheckIcon,
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

// Fixed icon container width to ensure perfect alignment across all 3 rows
const ICON_CELL = 24;

interface SidebarContextSwitcherProps {
  collapsed: boolean;
}

// ─── Single row: label + unfold icon ───
interface ContextRowProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: (e: React.MouseEvent<HTMLElement>) => void;
  loading?: boolean;
  collapsed?: boolean;
  tooltipTitle?: string;
  isLast?: boolean;
  /** URL to navigate to for managing this entity */
  manageUrl?: string;
  onManageClick?: () => void;
  manageTooltip?: string;
}

const ContextRow: React.FC<ContextRowProps> = ({
  icon,
  label,
  sublabel,
  onClick,
  loading,
  collapsed,
  tooltipTitle,
  isLast,
  onManageClick,
  manageTooltip,
}) => {
  const content = (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: collapsed ? 0 : 1.25,
        py: 0.625,
        cursor: 'pointer',
        borderRadius: 0,
        justifyContent: collapsed ? 'center' : 'flex-start',
        transition: 'background-color 0.15s ease',
        borderBottom: !isLast && !collapsed ? '1px solid' : 'none',
        borderColor: 'divider',
        '&:hover': {
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(79,70,229,0.04)',
        },
      }}
    >
      {/* Fixed-width icon cell */}
      <Box
        sx={{
          width: ICON_CELL,
          height: ICON_CELL,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>

      {/* Label */}
      {!collapsed && (
        <>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {loading ? (
              <Skeleton width={80} height={16} sx={{ borderRadius: 0.5 }} />
            ) : (
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  fontSize: '0.8125rem',
                  lineHeight: 1.4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </Typography>
            )}
            {sublabel && !loading && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: '0.6875rem',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  opacity: 0.7,
                }}
              >
                {sublabel}
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              flexShrink: 0,
            }}
          >
            <UnfoldMoreIcon sx={{ fontSize: 14, opacity: 0.35 }} />
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
                    opacity: 0,
                    transition:
                      'opacity 0.15s ease, background-color 0.15s ease',
                    '.MuiBox-root:hover > &': { opacity: 1 },
                    '&:hover': {
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 13, opacity: 0.5 }} />
                </Box>
              </Tooltip>
            )}
          </Box>
        </>
      )}
    </Box>
  );

  if (collapsed && tooltipTitle) {
    return (
      <Tooltip title={tooltipTitle} placement="right" arrow>
        {content}
      </Tooltip>
    );
  }
  return content;
};

// ─── Searchable popover list ───
interface PopoverListProps<T> {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  getSublabel?: (item: T) => string | undefined;
  getIcon?: (item: T) => React.ReactNode;
  selectedKey: string | null;
  onSelect: (item: T) => void;
  emptyMessage: string;
  searchable?: boolean;
}

function PopoverList<T>({
  anchorEl,
  onClose,
  items,
  getKey,
  getLabel,
  getSublabel,
  getIcon,
  selectedKey,
  onSelect,
  emptyMessage,
  searchable = false,
}: PopoverListProps<T>) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => getLabel(item).toLowerCase().includes(q));
  }, [items, search, getLabel]);

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.5,
            minWidth: 220,
            maxWidth: 320,
            maxHeight: 360,
            borderRadius: 1.5,
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)'
                : '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          },
        },
      }}
      TransitionProps={{
        onEntered: () => {
          if (searchable && searchRef.current) {
            searchRef.current.focus();
          }
        },
      }}
    >
      {/* Search */}
      {searchable && items.length > 3 && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
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
            <SearchIcon sx={{ fontSize: 16, opacity: 0.4 }} />
            <InputBase
              inputRef={searchRef}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ fontSize: '0.8125rem', flex: 1 }}
              size="small"
            />
          </Box>
        </Box>
      )}

      {/* Items */}
      <List dense sx={{ py: 0.5, overflow: 'auto', maxHeight: 300 }}>
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
                onClick={() => {
                  onSelect(item);
                  handleClose();
                }}
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
                  secondary={getSublabel?.(item)}
                  primaryTypographyProps={{
                    variant: 'body2',
                    fontWeight: isSelected ? 600 : 400,
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
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
    </Popover>
  );
}

// ─── Main component ───
const SidebarContextSwitcher: React.FC<SidebarContextSwitcherProps> = ({
  collapsed,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  // Popover anchors
  const [orgAnchor, setOrgAnchor] = useState<HTMLElement | null>(null);
  const [projAnchor, setProjAnchor] = useState<HTMLElement | null>(null);
  const [envAnchor, setEnvAnchor] = useState<HTMLElement | null>(null);

  const handleOrgClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setOrgAnchor(e.currentTarget);
  }, []);

  const handleSelectOrg = useCallback(
    (org: (typeof organisations)[0]) => {
      switchOrg(org.id);
    },
    [switchOrg]
  );

  const handleProjClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setProjAnchor(e.currentTarget);
  }, []);

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
    },
    [switchProject]
  );

  const handleEnvClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setEnvAnchor(e.currentTarget);
  }, []);

  const handleSelectEnv = useCallback(
    (env: (typeof environments)[0]) => {
      if (currentOrgId && currentProjectId) {
        switchEnvironment(currentOrgId, currentProjectId, env.environmentId);
      }
    },
    [currentOrgId, currentProjectId, switchEnvironment]
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

  // Environment color dot icon (consistent 18×18 cell like other icons)
  const envDotIcon = (
    <Box
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: envColor,
        boxShadow: `0 0 6px ${alpha(envColor, 0.5)}`,
      }}
    />
  );

  return (
    <Box
      sx={{
        mx: collapsed ? 0.5 : 0,
        my: 0,
        flexShrink: 0,
        borderRadius: 0,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(79,70,229,0.015)',
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
        boxShadow: (theme) =>
          theme.palette.mode === 'dark'
            ? '0 2px 6px rgba(0,0,0,0.3)'
            : '0 2px 6px rgba(0,0,0,0.06)',
      }}
    >
      {/* Org */}
      <ContextRow
        icon={<OrgIcon sx={{ fontSize: 16, opacity: 0.6 }} />}
        label={orgLabel}
        onClick={handleOrgClick}
        loading={orgLoading && organisations.length === 0}
        collapsed={collapsed}
        tooltipTitle={orgLabel}
        onManageClick={() => navigate('/admin/workspace?tab=organisations')}
        manageTooltip={t('sidebar.context.manage')}
      />

      {/* Project */}
      <ContextRow
        icon={<ProjectIcon sx={{ fontSize: 16, opacity: 0.6 }} />}
        label={projLabel}
        onClick={handleProjClick}
        loading={orgLoading && projects.length === 0}
        collapsed={collapsed}
        tooltipTitle={projLabel}
        onManageClick={() => navigate('/admin/workspace?tab=projects')}
        manageTooltip={t('sidebar.context.manage')}
      />

      {/* Environment */}
      <ContextRow
        icon={envDotIcon}
        label={envLabel}
        onClick={handleEnvClick}
        loading={envLoading && environments.length === 0}
        collapsed={collapsed}
        tooltipTitle={envLabel}
        isLast
        onManageClick={() => navigate('/admin/workspace?tab=environments')}
        manageTooltip={t('sidebar.context.manage')}
      />

      {/* Popovers */}
      <PopoverList
        anchorEl={orgAnchor}
        onClose={() => setOrgAnchor(null)}
        items={organisations}
        getKey={(o) => o.id}
        getLabel={(o) => o.displayName || o.orgName}
        getIcon={() => <OrgIcon sx={{ fontSize: 16, opacity: 0.6 }} />}
        selectedKey={currentOrgId}
        onSelect={handleSelectOrg}
        emptyMessage={t('sidebar.context.noOrgs')}
        searchable
      />

      <PopoverList
        anchorEl={projAnchor}
        onClose={() => setProjAnchor(null)}
        items={orgProjects}
        getKey={(p) => p.id}
        getLabel={(p) => p.displayName || p.projectName}
        getIcon={() => <ProjectIcon sx={{ fontSize: 16, opacity: 0.6 }} />}
        selectedKey={currentProjectId}
        onSelect={handleSelectProject}
        emptyMessage={t('sidebar.context.noProjects')}
        searchable
      />

      <PopoverList
        anchorEl={envAnchor}
        onClose={() => setEnvAnchor(null)}
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
      />
    </Box>
  );
};

export default SidebarContextSwitcher;
