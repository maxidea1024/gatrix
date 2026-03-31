import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Chip,
  TextField,
  FormControl,
  Checkbox,
  Alert,
  Tooltip,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ClickAwayListener,
  Select,
  MenuItem,
  InputLabel,
  Menu,
  Collapse,
  ButtonBase,
  alpha,
} from '@mui/material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  VpnKey as VpnKeyIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Security as SecurityIcon,
  ViewColumn as ViewColumnIcon,
  DragIndicator as DragIndicatorIcon,
  MoreVert as MoreVertIcon,
  Business as OrgIcon,
  Folder as ProjectIcon,
  ExpandMore as ExpandMoreIcon,
  ChevronRight as ChevronRightIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import { ApiAccessToken, TokenType } from '@/types/apiToken';
import SearchTextField from '../../components/common/SearchTextField';
import { apiTokenService } from '@/services/apiTokenService';
import { Environment } from '@/services/environmentService';
import { useEnvironments } from '@/contexts/EnvironmentContext';
import SimplePagination from '@/components/common/SimplePagination';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import PageContentLoader from '@/components/common/PageContentLoader';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import { formatRelativeTime } from '@/utils/dateFormat';
import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '@/components/common/DynamicFilterBar';
import { useI18n } from '@/contexts/I18nContext';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalPageSize } from '@/hooks/useGlobalPageSize';
import { P } from '@/types/permissions';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageHeader from '@/components/common/PageHeader';

interface CreateTokenData {
  tokenName: string;
  description?: string;
  tokenType: TokenType;
  allowAllEnvironments: boolean;
  environments: string[];
  expiresAt?: string;
  selectedProjectId?: string;
}

// Supported token types (client+server 'all' type is not supported)
const SUPPORTED_TOKEN_TYPES: TokenType[] = [
  'client',
  'server',
  'edge',
  'universal_client',
];

// Column definition interface
interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
}

// Sortable list item component for drag and drop
interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (id: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
  column,
  onToggleVisibility,
}) => {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: 'grab',
            display: 'flex',
            alignItems: 'center',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        </Box>
      }
    >
      <ListItemButton
        dense
        onClick={() => onToggleVisibility(column.id)}
        sx={{ pr: 6 }}
      >
        <Checkbox
          edge="start"
          checked={column.visible}
          tabIndex={-1}
          disableRipple
          size="small"
          icon={<VisibilityOffIcon fontSize="small" />}
          checkedIcon={<VisibilityIcon fontSize="small" />}
        />
        <ListItemText
          primary={t(column.labelKey)}
          slotProps={{ primary: { variant: 'body2' } }}
        />
      </ListItemButton>
    </ListItem>
  );
};

// Default column configuration
const defaultColumns: ColumnConfig[] = [
  { id: 'tokenName', labelKey: 'apiTokens.tokenName', visible: true },
  { id: 'tokenType', labelKey: 'apiTokens.tokenType', visible: true },
  { id: 'project', labelKey: 'common.project', visible: true },
  { id: 'environments', labelKey: 'apiTokens.environments', visible: true },
  { id: 'description', labelKey: 'apiTokens.description', visible: true },
  { id: 'usageCount', labelKey: 'apiTokens.usageCount', visible: true },
  { id: 'lastUsedAt', labelKey: 'apiTokens.lastUsedAt', visible: true },
  { id: 'expiresAt', labelKey: 'apiTokens.expiresAt', visible: true },
  { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
];

// Helper function to get date locale
const getDateLocale = () => {
  const lang = localStorage.getItem('i18nextLng') || 'ko';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('zh')) return 'zh-cn';
  return 'en';
};

// ==================== ProjectTreeSelector Component ====================
// Tree-style project selector matching AppBar EnvironmentSelector (without environments)

interface ProjectTreeSelectorProps {
  organisations: { id: string; orgName: string; displayName: string }[];
  projects: {
    id: string;
    orgId: string;
    projectName: string;
    displayName: string;
  }[];
  selectedProjectId?: string;
  onSelect: (projectId: string) => void;
  helperText?: string;
  disabled?: boolean;
}

const ProjectTreeSelector: React.FC<ProjectTreeSelectorProps> = ({
  organisations,
  projects,
  selectedProjectId,
  onSelect,
  helperText,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const isOpen = Boolean(anchorEl);

  const handleOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (disabled) return;
      setAnchorEl(event.currentTarget);
      // Auto-expand org that contains the selected project
      if (selectedProjectId) {
        const proj = projects.find((p) => p.id === selectedProjectId);
        if (proj) {
          setExpandedOrgs((prev) => new Set(prev).add(proj.orgId));
        }
      }
    },
    [selectedProjectId, projects]
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

  const handleSelectProject = useCallback(
    (projectId: string) => {
      onSelect(projectId);
      handleClose();
    },
    [onSelect, handleClose]
  );

  // Build display label: Org / Project
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const selectedOrg = selectedProject
    ? organisations.find((o) => o.id === selectedProject.orgId)
    : null;

  const displayLabel = (() => {
    const parts: string[] = [];
    if (organisations.length > 1 && selectedOrg) {
      parts.push(selectedOrg.displayName || selectedOrg.orgName);
    }
    if (selectedProject) {
      parts.push(selectedProject.displayName || selectedProject.projectName);
    }
    return parts.join(' / ');
  })();

  const isMultiOrg = organisations.length > 1;

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mb: 0.5, display: 'block' }}
      >
        {t('common.project')}
      </Typography>
      <ButtonBase
        onClick={handleOpen}
        disabled={disabled}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: isOpen ? 'primary.main' : 'divider',
          width: '100%',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'text.primary',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            overflow: 'hidden',
          }}
        >
          <ProjectIcon sx={{ fontSize: 18, opacity: 0.7, flexShrink: 0 }} />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayLabel || t('apiTokens.universalClientHelp')}
          </Typography>
        </Box>
        <ArrowDropDownIcon
          sx={{
            fontSize: 20,
            opacity: 0.6,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        />
      </ButtonBase>

      {/* Tree dropdown popover */}
      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              minWidth: 280,
              maxWidth: 400,
              maxHeight: 350,
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              overflow: 'auto',
            },
          },
        }}
      >
        <Box sx={{ py: 0.5 }}>
          {organisations.map((org) => {
            const orgProjects = projects.filter((p) => p.orgId === org.id);
            const isOrgExpanded = expandedOrgs.has(org.id) || !isMultiOrg;

            // Single org: skip org header, show projects directly
            if (!isMultiOrg) {
              return (
                <React.Fragment key={org.id}>
                  {orgProjects.length === 0 ? (
                    <ListItemButton dense disabled sx={{ pl: 1.5, py: 0.75 }}>
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
                    orgProjects.map((proj) => {
                      const isSelected = proj.id === selectedProjectId;
                      return (
                        <ListItemButton
                          key={proj.id}
                          onClick={() => handleSelectProject(proj.id)}
                          dense
                          selected={isSelected}
                          sx={{
                            py: 0.5,
                            pl: 1.5,
                            '&.Mui-selected': {
                              backgroundColor: (theme) =>
                                alpha(
                                  theme.palette.primary.main,
                                  theme.palette.mode === 'dark' ? 0.15 : 0.08
                                ),
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <ProjectIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={proj.displayName || proj.projectName}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          />
                          {isSelected && (
                            <CheckIcon
                              sx={{
                                fontSize: 18,
                                color: 'success.main',
                                ml: 'auto',
                              }}
                            />
                          )}
                        </ListItemButton>
                      );
                    })
                  )}
                </React.Fragment>
              );
            }

            // Multi-org: show org header with expandable project list
            return (
              <React.Fragment key={org.id}>
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
                      fontWeight: 500,
                    }}
                  />
                </ListItemButton>

                <Collapse in={isOrgExpanded} timeout="auto">
                  {orgProjects.length === 0 ? (
                    <ListItemButton dense disabled sx={{ pl: 7, py: 0.75 }}>
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
                    orgProjects.map((proj) => {
                      const isSelected = proj.id === selectedProjectId;
                      return (
                        <ListItemButton
                          key={proj.id}
                          onClick={() => handleSelectProject(proj.id)}
                          dense
                          selected={isSelected}
                          sx={{
                            py: 0.5,
                            pl: 7,
                            '&.Mui-selected': {
                              backgroundColor: (theme) =>
                                alpha(
                                  theme.palette.primary.main,
                                  theme.palette.mode === 'dark' ? 0.15 : 0.08
                                ),
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <ProjectIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={proj.displayName || proj.projectName}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: isSelected ? 600 : 400,
                            }}
                          />
                          {isSelected && (
                            <CheckIcon
                              sx={{
                                fontSize: 18,
                                color: 'success.main',
                                ml: 'auto',
                              }}
                            />
                          )}
                        </ListItemButton>
                      );
                    })
                  )}
                </Collapse>
              </React.Fragment>
            );
          })}
        </Box>
      </Popover>

      {helperText && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, ml: 1.5 }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

const ApiTokensPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { language } = useI18n();
  const { hasPermission } = useAuth();

  // Check if user can manage (create/edit/delete) tokens
  const canManage = hasPermission([P.IP_WHITELIST_UPDATE]);
  const {
    currentProjectId,
    currentOrgId,
    projects,
    getProjectApiPath,
    organisations,
  } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const [tokens, setTokens] = useState<ApiAccessToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Column settings state
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('apiTokensColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<HTMLButtonElement | null>(null);

  const columnSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Dynamic filter state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiAccessToken | null>(
    null
  );

  // Environment state
  const { environments: envList } = useEnvironments();
  const environments: Environment[] = envList;
  const [fullEditingData, setFullEditingData] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState<CreateTokenData>({
    tokenName: '',
    description: '',
    tokenType: 'client',
    allowAllEnvironments: false,
    environments: [],
    selectedProjectId: currentProjectId || undefined,
  });

  const isDirty = useMemo(() => {
    if (!selectedToken || !fullEditingData) return true;

    const currentData = {
      tokenName: formData.tokenName.trim(),
      description: formData.description?.trim() || '',
      environmentId: formData.environments[0] || '',
      expiresAt: formData.expiresAt
        ? new Date(formData.expiresAt).toISOString()
        : undefined,
    };

    const originalData = {
      tokenName: fullEditingData.tokenName.trim(),
      description: fullEditingData.description?.trim() || '',
      environmentId: fullEditingData.environmentId || '',
      expiresAt: fullEditingData.expiresAt
        ? new Date(fullEditingData.expiresAt).toISOString()
        : undefined,
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [selectedToken, fullEditingData, formData]);

  // UI states
  const [newTokenValue, setNewTokenValue] = useState<string>('');
  const [newTokenInfo, setNewTokenInfo] = useState<any>(null);
  const [newTokenDialogOpen, setNewTokenDialogOpen] = useState<boolean>(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');

  // Bulk selection states
  const [selectedTokenIds, setSelectedTokenIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState<boolean>(false);

  // Bulk delete states
  const [bulkDeleteDrawerOpen, setBulkDeleteDrawerOpen] =
    useState<boolean>(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] =
    useState<string>('');

  // Regenerate confirmation state
  const [regenerateConfirmText, setRegenerateConfirmText] =
    useState<string>('');

  // Refs for focus management
  const tokenNameRef = useRef<HTMLInputElement>(null);
  const editTokenNameRef = useRef<HTMLInputElement>(null);
  const regenerateConfirmRef = useRef<HTMLInputElement>(null);
  const regenerateConfirmInputRef = useRef<HTMLInputElement>(null);

  // Action Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTargetToken, setMenuTargetToken] = useState<ApiAccessToken | null>(
    null
  );

  // Column handlers
  const handleToggleColumnVisibility = (columnId: string) => {
    const newColumns = columns.map((col) =>
      col.id === columnId ? { ...col, visible: !col.visible } : col
    );
    setColumns(newColumns);
    localStorage.setItem('apiTokensColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.removeItem('apiTokensColumns');
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);
      localStorage.setItem('apiTokensColumns', JSON.stringify(newColumns));
    }
  };

  // Filter definitions
  const availableFilters: FilterDefinition[] = [
    {
      key: 'tokenType',
      label: t('apiTokens.tokenType'),
      type: 'select',
      options: SUPPORTED_TOKEN_TYPES.map((type) => ({
        value: type,
        label: t(`apiTokens.types.${type}`),
      })),
    },
  ];

  // Filter handlers
  const handleFilterAdd = (filter: ActiveFilter) => {
    setActiveFilters([...activeFilters, filter]);
  };

  const handleFilterRemove = (filterKey: string) => {
    setActiveFilters(activeFilters.filter((f) => f.key !== filterKey));
  };

  const handleFilterChange = (filterKey: string, value: any) => {
    setActiveFilters(
      activeFilters.map((f) => (f.key === filterKey ? { ...f, value } : f))
    );
  };

  useEffect(() => {
    loadTokens();
  }, [page, rowsPerPage, sortBy, sortOrder, activeFilters, projectApiPath]);

  const loadTokens = async () => {
    try {
      setLoading(true);

      // Build filter params
      const filterParams: any = {};
      activeFilters.forEach((filter) => {
        if (
          filter.value !== undefined &&
          filter.value !== null &&
          filter.value !== ''
        ) {
          filterParams[filter.key] = filter.value;
        }
      });

      const response = await apiTokenService.getTokens(
        {
          page: page + 1,
          limit: rowsPerPage,
          sortBy,
          sortOrder,
          ...filterParams,
        },
        projectApiPath
      );
      setTokens(response.data || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Failed to load tokens:', error);
      enqueueSnackbar(t('apiTokens.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Render cell content based on column ID
  const renderCellContent = (token: ApiAccessToken, columnId: string) => {
    switch (columnId) {
      case 'tokenName':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  textDecoration: 'underline',
                },
              }}
              onClick={() => openEditDialog(token)}
            >
              {token.tokenName}
            </Typography>
            <Tooltip title={t('apiTokens.copyTokenName')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboardWithNotification(
                    token.tokenName,
                    () =>
                      enqueueSnackbar(t('common.copiedToClipboard'), {
                        variant: 'success',
                      }),
                    () =>
                      enqueueSnackbar(t('common.copyFailed'), {
                        variant: 'error',
                      })
                  );
                }}
                sx={{ p: 0.5 }}
              >
                <CopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      case 'tokenType':
        return (
          <Tooltip
            title={t(
              token.tokenType === 'client'
                ? 'apiTokens.clientTokenDescription'
                : 'apiTokens.serverTokenDescription'
            )}
            arrow
          >
            <Chip
              label={t(`apiTokens.types.${token.tokenType}`)}
              size="small"
              color={token.tokenType === 'server' ? 'primary' : 'success'}
              variant="filled"
              sx={{ borderRadius: '8px' }}
            />
          </Tooltip>
        );
      case 'environments': {
        const env = environments.find(
          (e) => e.environmentId === token.environmentId
        );
        return env ? (
          <Chip
            label={env.displayName || env.environmentName}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ borderRadius: '8px' }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            -
          </Typography>
        );
      }
      case 'universal_client': {
        const proj = projects.find((p) => p.id === (token as any).projectId);
        return (
          <Typography variant="body2">{proj?.projectName || '-'}</Typography>
        );
      }
      case 'description':
        return (
          <Typography
            variant="body2"
            sx={{
              maxWidth: 300,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {token.description || '-'}
          </Typography>
        );
      case 'usageCount':
        return (
          <Typography
            variant="body2"
            sx={{ fontWeight: 500 }}
            color={!token.usageCount ? 'text.secondary' : 'text.primary'}
          >
            {token.usageCount
              ? token.usageCount.toLocaleString()
              : t('apiTokens.neverUsed')}
          </Typography>
        );
      case 'lastUsedAt':
        return (
          <Typography variant="body2">
            {token.lastUsedAt
              ? formatRelativeTime(token.lastUsedAt)
              : t('apiTokens.neverUsed')}
          </Typography>
        );
      case 'expiresAt':
        return (
          <Typography variant="body2">
            {token.expiresAt
              ? formatRelativeTime(token.expiresAt)
              : t('apiTokens.noExpiration')}
          </Typography>
        );
      case 'createdAt':
        return (
          <Typography variant="body2">
            {formatRelativeTime(token.createdAt)}
          </Typography>
        );
      default:
        return null;
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(0); // Reset to first page when sorting
  };

  // 토큰 이름 Validation
  const isValidTokenName = (name: string): boolean => {
    return name.trim().length >= 3; // 최소 3자 이상
  };

  // 유효기간 Validation 함수
  const validateExpiresAt = (
    expiresAt: string | undefined
  ): { isValid: boolean; warning: string | null } => {
    if (!expiresAt) {
      return { isValid: true, warning: null }; // No expiration is valid
    }

    const expiresDate = dayjs(expiresAt);
    const now = dayjs();
    const fiveMinutesFromNow = now.add(5, 'minute');

    if (expiresDate.isBefore(now)) {
      return { isValid: false, warning: t('apiTokens.expiresAtPastError') };
    }

    if (expiresDate.isBefore(fiveMinutesFromNow)) {
      return { isValid: false, warning: t('apiTokens.expiresAtTooSoonError') };
    }

    return { isValid: true, warning: null };
  };

  const expiresAtValidation = validateExpiresAt(formData.expiresAt);

  const handleCreate = async () => {
    try {
      // Build project API path using the selected project's orgId (supports multi-org)
      const selectedProj = projects.find(
        (p) => p.id === formData.selectedProjectId
      );
      const createProjectApiPath =
        formData.selectedProjectId && selectedProj
          ? `/admin/orgs/${selectedProj.orgId}/projects/${formData.selectedProjectId}`
          : projectApiPath;

      const response = await apiTokenService.createToken(
        {
          tokenName: formData.tokenName,
          description: formData.description,
          tokenType: formData.tokenType,
          environmentId: formData.environments[0] || undefined,
          expiresAt: formData.expiresAt,
        },
        createProjectApiPath
      );
      console.log('Create token response:', response); // 디버깅용

      const selectedProject = projects.find(
        (p) => p.id === formData.selectedProjectId
      );
      const tokenInfo = {
        tokenName: formData.tokenName,
        description: formData.description,
        tokenType: formData.tokenType,
        expiresAt: formData.expiresAt,
        environmentId: formData.environments[0] || undefined,
        projectName: selectedProject?.projectName || '',
        isNew: true,
      };

      // Create Dialog를 먼저 Close
      setCreateDialogOpen(false);
      resetForm();

      // 백엔드 Response 구조 Confirm 및 토큰 값 추출
      const tokenValue =
        (response as any)?.data?.tokenValue ||
        (response as any)?.tokenValue ||
        '';
      console.log('Create response structure:', response); // 디버깅용
      console.log('Extracted token value:', tokenValue); // 디버깅용

      // Status를 순서대로 Settings하여 Dialog가 확실히 열리도록 함
      setNewTokenInfo(tokenInfo);
      setNewTokenValue(tokenValue);

      // 다음 렌더링 사이클에서 Dialog Open
      setTimeout(() => {
        setNewTokenDialogOpen(true);
      }, 0);

      // 토큰 목록은 백그라운드에서 Refresh (await 제거)
      loadTokens().catch(console.error);

      enqueueSnackbar(t('apiTokens.createSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to create token:', error);
      enqueueSnackbar(error.message || t('apiTokens.createFailed'), {
        variant: 'error',
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedToken) return;

    try {
      // Build project API path using the selected project's orgId (supports multi-org)
      const editProj = projects.find(
        (p) => p.id === formData.selectedProjectId
      );
      const editProjectApiPath =
        formData.selectedProjectId && editProj
          ? `/admin/orgs/${editProj.orgId}/projects/${formData.selectedProjectId}`
          : projectApiPath;

      await apiTokenService.updateToken(
        selectedToken.id as any,
        {
          tokenName: formData.tokenName,
          description: formData.description,
          environmentId: formData.environments[0] || undefined,
          expiresAt: formData.expiresAt,
        },
        editProjectApiPath
      );
      await loadTokens();
      setEditDialogOpen(false);
      setSelectedToken(null);
      setFullEditingData(null);
      resetForm();
      enqueueSnackbar(t('apiTokens.updateSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to update token:', error);
      enqueueSnackbar(error.message || t('apiTokens.updateFailed'), {
        variant: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedToken) return;

    // Check if the confirmation text matches the token name
    if (deleteConfirmText !== selectedToken.tokenName) {
      enqueueSnackbar(t('apiTokens.deleteConfirmMismatch'), {
        variant: 'error',
      });
      return;
    }

    try {
      await apiTokenService.deleteToken(
        selectedToken.id as any,
        projectApiPath
      );
      await loadTokens();
      setDeleteDialogOpen(false);
      setSelectedToken(null);
      setDeleteConfirmText('');
      enqueueSnackbar(t('apiTokens.deleteSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to delete token:', error);
      enqueueSnackbar(error.message || t('apiTokens.deleteFailed'), {
        variant: 'error',
      });
    }
  };

  const handleRegenerate = async () => {
    if (!selectedToken) return;

    try {
      const response = await apiTokenService.regenerateToken(
        selectedToken.id as any,
        projectApiPath
      );
      console.log('Regenerate token response:', response); // 디버깅용

      // 백엔드 Response 구조 Confirm 및 토큰 값 추출
      const tokenValue =
        (response as any)?.data?.tokenValue ||
        (response as any)?.tokenValue ||
        '';
      console.log('Regenerate response structure:', response); // 디버깅용
      console.log('Extracted token value:', tokenValue); // 디버깅용

      const tokenInfo = {
        tokenName: selectedToken.tokenName,
        description: selectedToken.description,
        tokenType: selectedToken.tokenType,
        expiresAt: selectedToken.expiresAt,
        isNew: false,
      };

      // Status를 순서대로 Settings하여 Dialog가 확실히 열리도록 함
      setNewTokenInfo(tokenInfo);
      setNewTokenValue(tokenValue);

      // 다음 렌더링 사이클에서 Dialog Open
      setTimeout(() => {
        setNewTokenDialogOpen(true);
      }, 0);
      setRegenerateDialogOpen(false);
      setSelectedToken(null);
      setRegenerateConfirmText('');
      loadTokens();
      enqueueSnackbar(t('apiTokens.regenerateSuccess'), { variant: 'success' });
    } catch (error: any) {
      console.error('Failed to regenerate token:', error);
      enqueueSnackbar(error.message || t('apiTokens.regenerateFailed'), {
        variant: 'error',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tokenName: '',
      description: '',
      tokenType: 'client',
      allowAllEnvironments: false,
      environments: [],
      selectedProjectId: currentProjectId || undefined,
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
    // Focus on token name field after dialog opens
    setTimeout(() => {
      tokenNameRef.current?.focus();
    }, 100);
  };

  const openEditDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setFormData({
      tokenName: token.tokenName,
      description: token.description || '',
      tokenType: token.tokenType,
      allowAllEnvironments: false,
      environments: token.environmentId ? [token.environmentId] : [],
      expiresAt: token.expiresAt
        ? new Date(token.expiresAt).toISOString().slice(0, 16)
        : undefined,
      selectedProjectId:
        (token as any).projectId || currentProjectId || undefined,
    });
    setFullEditingData(JSON.parse(JSON.stringify(token)));
    setEditDialogOpen(true);
    // Focus on token name field after dialog opens
    setTimeout(() => {
      editTokenNameRef.current?.focus();
    }, 100);
  };

  const openDeleteDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setDeleteConfirmText('');
    setDeleteDialogOpen(true);
  };

  const openRegenerateDialog = (token: ApiAccessToken) => {
    setSelectedToken(token);
    setRegenerateConfirmText('');
    setRegenerateDialogOpen(true);
    // Focus on confirm input field after dialog opens
    setTimeout(() => {
      if (regenerateConfirmRef.current) {
        // Try to focus on the actual input element inside TextField
        const inputElement =
          regenerateConfirmRef.current.querySelector('input');
        if (inputElement) {
          inputElement.focus();
        } else {
          // Fallback to the TextField itself
          regenerateConfirmRef.current.focus();
        }
      }
    }, 300);
  };

  const closeRegenerateDialog = () => {
    setRegenerateDialogOpen(false);
    setRegenerateConfirmText('');
    setSelectedToken(null);
  };

  const copyToClipboard = async (text: string) => {
    console.log(
      '[ApiTokensPage] copyToClipboard called, text length:',
      text.length
    );
    await copyToClipboardWithNotification(
      text,
      () => {
        console.log('[ApiTokensPage] Copy success callback');
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
      },
      () => {
        console.log('[ApiTokensPage] Copy error callback');
        enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
      }
    );
  };

  const copyTokenValue = async (token: ApiAccessToken) => {
    console.log('[ApiTokensPage] copyTokenValue called, token:', token);
    // Use tokenValue only (original token for copying)
    const tokenToCopy = (token as any).tokenValue;
    console.log(
      '[ApiTokensPage] tokenToCopy:',
      tokenToCopy ? `${tokenToCopy.substring(0, 10)}...` : 'EMPTY'
    );
    if (!tokenToCopy) {
      console.error('[ApiTokensPage] No token value found');
      enqueueSnackbar(t('apiTokens.tokenValueError'), { variant: 'error' });
      return;
    }
    await copyToClipboardWithNotification(
      tokenToCopy,
      () => {
        console.log('[ApiTokensPage] Token copy success callback');
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
      },
      () => {
        console.log('[ApiTokensPage] Token copy error callback');
        enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
      }
    );
  };

  const maskToken = (token: string) => {
    if (!token || token.length < 8) return token;
    return `${token.substring(0, 4)}${'•'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
  };

  // Bulk selection handlers
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedTokenIds(tokens.map((token) => token.id) as any);
    } else {
      setSelectedTokenIds([]);
    }
  };

  const handleSelectToken = (tokenId: number, checked: boolean) => {
    if (checked) {
      setSelectedTokenIds((prev) => [...prev, tokenId]);
    } else {
      setSelectedTokenIds((prev) => prev.filter((id) => id !== tokenId));
      setSelectAll(false);
    }
  };

  // Update selectAll state when individual selections change
  React.useEffect(() => {
    if (tokens.length > 0 && selectedTokenIds.length === tokens.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedTokenIds, tokens]);

  // Bulk actions
  const handleBulkDelete = () => {
    setBulkDeleteDrawerOpen(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setLoading(true);

      // Delete selected tokens
      for (const tokenId of selectedTokenIds) {
        await apiTokenService.deleteToken(tokenId, projectApiPath);
      }

      enqueueSnackbar(t('apiTokens.bulkDeleteSuccess'), { variant: 'success' });

      // Reset states
      setSelectedTokenIds([]);
      setSelectAll(false);
      setBulkDeleteDrawerOpen(false);
      setBulkDeleteConfirmText('');

      // Reload tokens
      await loadTokens();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      enqueueSnackbar(t('apiTokens.bulkDeleteFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const closeBulkDeleteDrawer = () => {
    setBulkDeleteDrawerOpen(false);
    setBulkDeleteConfirmText('');
  };

  const getTokenTypeColor = (type: TokenType) => {
    switch (type) {
      case 'admin' as any:
        return 'error';
      case 'server':
        return 'warning';
      case 'client':
        return 'primary';
      case 'universal_client':
        return 'info';
      default:
        return 'default';
    }
  };

  // Filter tokens based on debounced search term
  const filteredTokens = React.useMemo(() => {
    if (!debouncedSearchTerm.trim()) return tokens;

    const lowerSearch = debouncedSearchTerm.toLowerCase();
    return tokens.filter(
      (token) =>
        token.tokenName.toLowerCase().includes(lowerSearch) ||
        (token.description &&
          token.description.toLowerCase().includes(lowerSearch)) ||
        token.tokenType.toLowerCase().includes(lowerSearch)
    );
  }, [tokens, debouncedSearchTerm]);

  return (
    <>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <PageHeader
          icon={<VpnKeyIcon />}
          title={t('apiTokens.title')}
          subtitle={t('apiTokens.subtitle')}
          actions={
            canManage ? (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
              >
                {t('apiTokens.createToken')}
              </Button>
            ) : undefined
          }
        />

        {/* Bulk Actions */}
        {canManage && selectedTokenIds.length > 0 && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t('common.selectedItems', { count: selectedTokenIds.length })}
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleBulkDelete}
            >
              {t('apiTokens.bulkDelete')}
            </Button>
          </Box>
        )}

        {/* Filter and Column Settings */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {/* Search */}
              <SearchTextField
                placeholder={t('apiTokens.searchPlaceholder')}
                value={searchTerm}
                onChange={setSearchTerm}
              />

              {/* Column Settings Button */}
              <Tooltip title={t('common.columnSettings')}>
                <IconButton
                  onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                  sx={{
                    ml: 1,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ViewColumnIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </CardContent>
        </Card>

        {/* Tokens Table */}
        <PageContentLoader loading={loading}>
          {!filteredTokens || filteredTokens.length === 0 ? (
            <EmptyPagePlaceholder
              message={
                searchTerm
                  ? t('common.noSearchResults')
                  : t('apiTokens.noTokens')
              }
              subtitle={
                canManage && !searchTerm ? t('common.addFirstItem') : undefined
              }
              onAddClick={
                canManage && !searchTerm ? openCreateDialog : undefined
              }
              addButtonLabel={t('apiTokens.createToken')}
            />
          ) : (
            <Paper
              variant="outlined"
              sx={{ width: '100%', overflow: 'hidden' }}
            >
              <TableContainer>
                <Table stickyHeader sx={{ tableLayout: 'auto' }}>
                  <TableHead>
                    <TableRow>
                      {canManage && (
                        <TableCell padding="checkbox" sx={{ width: 50 }}>
                          <Checkbox
                            checked={selectAll}
                            indeterminate={
                              selectedTokenIds.length > 0 &&
                              selectedTokenIds.length < filteredTokens.length
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            disabled={filteredTokens.length === 0}
                          />
                        </TableCell>
                      )}
                      {columns
                        .filter((col) => col.visible)
                        .map((column) => (
                          <TableCell key={column.id}>
                            {t(column.labelKey)}
                          </TableCell>
                        ))}
                      <TableCell align="center" sx={{ width: 150 }}>
                        {t('common.actions')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTokens.map((token) => (
                      <TableRow
                        key={token.id}
                        hover
                        selected={selectedTokenIds.includes(token.id as any)}
                      >
                        {canManage && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedTokenIds.includes(
                                token.id as any
                              )}
                              onChange={(e) =>
                                handleSelectToken(
                                  token.id as any,
                                  e.target.checked
                                )
                              }
                            />
                          </TableCell>
                        )}
                        {columns
                          .filter((col) => col.visible)
                          .map((column) => (
                            <TableCell key={column.id}>
                              {renderCellContent(token, column.id)}
                            </TableCell>
                          ))}
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setMenuAnchorEl(e.currentTarget);
                              setMenuTargetToken(token);
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {!loading && tokens.length > 0 && (
                <SimplePagination
                  count={total}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                />
              )}
            </Paper>
          )}
        </PageContentLoader>
      </Box>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={() => {
          setMenuAnchorEl(null);
          setMenuTargetToken(null);
        }}
      >
        <MenuItem
          onClick={async () => {
            if (menuTargetToken) await copyTokenValue(menuTargetToken);
            setMenuAnchorEl(null);
            setMenuTargetToken(null);
          }}
        >
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('apiTokens.copyToken')}</ListItemText>
        </MenuItem>
        {canManage && [
          <MenuItem
            key="edit"
            onClick={() => {
              if (menuTargetToken) openEditDialog(menuTargetToken);
              setMenuAnchorEl(null);
              setMenuTargetToken(null);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('common.edit')}</ListItemText>
          </MenuItem>,
          <MenuItem
            key="regenerate"
            onClick={() => {
              if (menuTargetToken) openRegenerateDialog(menuTargetToken);
              setMenuAnchorEl(null);
              setMenuTargetToken(null);
            }}
          >
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('apiTokens.regenerateToken')}</ListItemText>
          </MenuItem>,
          <MenuItem
            key="delete"
            onClick={() => {
              if (menuTargetToken) openDeleteDialog(menuTargetToken);
              setMenuAnchorEl(null);
              setMenuTargetToken(null);
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>{t('common.delete')}</ListItemText>
          </MenuItem>,
        ]}
      </Menu>

      {/* Create Token Side Panel */}
      <ResizableDrawer
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        title={t('apiTokens.createToken')}
        subtitle={t('apiTokens.createTokenSubtitle')}
        storageKey="apiTokenCreateDrawerWidth"
        defaultWidth={550}
        minWidth={450}
        zIndex={1301}
        onEntered={() => tokenNameRef.current?.focus()}
      >
        {/* Content */}
        <Box
          sx={{
            flex: 1,
            p: 3,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {/* Basic Information Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
            >
              {t('apiTokens.basicInfoSection')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                inputRef={tokenNameRef}
                label={t('apiTokens.tokenName')}
                value={formData.tokenName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tokenName: e.target.value,
                  }))
                }
                fullWidth
                required
                size="small"
                error={
                  formData.tokenName.length > 0 &&
                  !isValidTokenName(formData.tokenName)
                }
                helperText={
                  formData.tokenName.length > 0 &&
                  !isValidTokenName(formData.tokenName)
                    ? t('apiTokens.tokenNameMinLength')
                    : t('apiTokens.tokenNameHelp')
                }
              />

              <TextField
                label={t('apiTokens.description')}
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                fullWidth
                multiline
                rows={2}
                size="small"
                placeholder={t('apiTokens.descriptionPlaceholder')}
              />
            </Box>
          </Paper>

          {/* Token Type & Scope Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
            >
              {t('apiTokens.tokenTypeSection')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Token Type Select */}
              <FormControl fullWidth size="small">
                <InputLabel>{t('apiTokens.tokenType')}</InputLabel>
                <Select
                  value={formData.tokenType}
                  label={t('apiTokens.tokenType')}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      tokenType: e.target.value as TokenType,
                    }))
                  }
                  renderValue={(value) => {
                    const labels: Record<string, string> = {
                      client: t('apiTokens.clientTokenType'),
                      server: t('apiTokens.serverTokenType'),
                      edge: t('apiTokens.edgeTokenType'),
                      universal_client: t('apiTokens.universalClientTokenType'),
                    };
                    return labels[value] || value;
                  }}
                >
                  <MenuItem value="client">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.clientTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.clientTokenDescription')}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="server">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.serverTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.serverTokenDescription')}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="edge">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.edgeTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.edgeTokenDescription')}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="universal_client">
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {t('apiTokens.universalClientTokenType')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('apiTokens.universalClientTokenDescription')}
                      </Typography>
                    </Box>
                  </MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, ml: 1.5 }}
                >
                  {t('apiTokens.tokenTypeNotEditable')}
                </Typography>
              </FormControl>

              {/* Project Select (tree-style like AppBar EnvironmentSelector) */}
              <ProjectTreeSelector
                organisations={organisations}
                projects={projects}
                selectedProjectId={formData.selectedProjectId}
                onSelect={(projectId) =>
                  setFormData((prev) => ({
                    ...prev,
                    selectedProjectId: projectId,
                    environments: [], // Reset environment when project changes
                  }))
                }
                helperText={t('apiTokens.universalClientHelp')}
              />

              {/* Environment Select - hidden for project tokens */}
              {formData.tokenType !== 'universal_client' && (
                <FormControl fullWidth size="small">
                  <InputLabel>{t('apiTokens.environmentAccess')}</InputLabel>
                  <Select
                    value={formData.environments[0] || ''}
                    label={t('apiTokens.environmentAccess')}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        allowAllEnvironments: false,
                        environments: [e.target.value as string],
                      }))
                    }
                    renderValue={(value) => {
                      const env = environments.find(
                        (e) => e.environmentId === value
                      );
                      return env ? env.displayName || env.environmentName : '';
                    }}
                  >
                    {environments.map((env) => (
                      <MenuItem
                        key={env.environmentId}
                        value={env.environmentId}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {env.displayName || env.environmentName}
                          </Typography>
                          {env.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {env.description}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, ml: 1.5 }}
                  >
                    {t('apiTokens.selectSingleEnvironment')}
                  </Typography>
                </FormControl>
              )}
            </Box>
          </Paper>

          {/* Expiration Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
            >
              {t('apiTokens.expirationSection')}
            </Typography>
            <LocalizationProvider
              dateAdapter={AdapterDayjs}
              adapterLocale={getDateLocale()}
            >
              <DateTimePicker
                label={t('apiTokens.expiresAt')}
                value={formData.expiresAt ? dayjs(formData.expiresAt) : null}
                onChange={(date) =>
                  setFormData((prev) => ({
                    ...prev,
                    expiresAt: date ? date.toISOString() : undefined,
                  }))
                }
                timeSteps={{ minutes: 1 }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    helperText:
                      expiresAtValidation.warning ||
                      t('apiTokens.expiresAtHelp'),
                    error: !expiresAtValidation.isValid,
                    slotProps: { input: { readOnly: true } },
                  },
                  actionBar: {
                    actions: ['clear', 'cancel', 'accept'],
                  },
                }}
              />
            </LocalizationProvider>
            {!expiresAtValidation.isValid && (
              <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                <Typography variant="caption">
                  {expiresAtValidation.warning}
                </Typography>
              </Alert>
            )}
          </Paper>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setCreateDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            startIcon={<VpnKeyIcon />}
            disabled={
              !isValidTokenName(formData.tokenName) ||
              !expiresAtValidation.isValid ||
              !formData.selectedProjectId ||
              (formData.tokenType !== 'universal_client' &&
                formData.environments.length === 0)
            }
          >
            {t('apiTokens.createToken')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Edit Token Side Panel */}
      <ResizableDrawer
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title={t('apiTokens.editToken')}
        subtitle={t('apiTokens.editTokenSubtitle')}
        storageKey="apiTokenEditDrawerWidth"
        defaultWidth={550}
        minWidth={450}
        zIndex={1301}
        onEntered={() => editTokenNameRef.current?.focus()}
      >
        {/* Content */}
        <Box
          sx={{
            flex: 1,
            p: 3,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {/* Basic Information Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
            >
              {t('apiTokens.basicInfoSection')}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                inputRef={editTokenNameRef}
                label={t('apiTokens.tokenName')}
                value={formData.tokenName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tokenName: e.target.value,
                  }))
                }
                fullWidth
                required
                size="small"
                error={
                  formData.tokenName.length > 0 &&
                  !isValidTokenName(formData.tokenName)
                }
                helperText={
                  formData.tokenName.length > 0 &&
                  !isValidTokenName(formData.tokenName)
                    ? t('apiTokens.tokenNameMinLength')
                    : t('apiTokens.tokenNameHelp')
                }
              />

              <TextField
                label={t('apiTokens.description')}
                value={formData.description || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                fullWidth
                multiline
                rows={2}
                size="small"
                placeholder={t('apiTokens.descriptionPlaceholder')}
              />
            </Box>
          </Paper>

          {/* Token Type & Scope Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
            >
              {t('apiTokens.tokenTypeSection')}
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Token Type (read-only in edit mode) */}
              <FormControl fullWidth size="small">
                <InputLabel>{t('apiTokens.tokenType')}</InputLabel>
                <Select
                  value={formData.tokenType}
                  label={t('apiTokens.tokenType')}
                  disabled
                  renderValue={(value) => {
                    const labels: Record<string, string> = {
                      client: t('apiTokens.clientTokenType'),
                      server: t('apiTokens.serverTokenType'),
                      edge: t('apiTokens.edgeTokenType'),
                      universal_client: t('apiTokens.universalClientTokenType'),
                    };
                    return labels[value] || value;
                  }}
                >
                  <MenuItem value={formData.tokenType}>
                    {(
                      {
                        client: t('apiTokens.clientTokenType'),
                        server: t('apiTokens.serverTokenType'),
                        edge: t('apiTokens.edgeTokenType'),
                        universal_client: t(
                          'apiTokens.universalClientTokenType'
                        ),
                      } as Record<string, string>
                    )[formData.tokenType] || formData.tokenType}
                  </MenuItem>
                </Select>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 0.5, ml: 1.5 }}
                >
                  {t('apiTokens.tokenTypeNotEditable')}
                </Typography>
              </FormControl>

              {/* Project Select (tree-style, disabled in edit mode) */}
              <ProjectTreeSelector
                organisations={organisations}
                projects={projects}
                selectedProjectId={formData.selectedProjectId}
                onSelect={() => {}}
                helperText={t('apiTokens.tokenTypeNotEditable')}
                disabled
              />

              {/* Environment Select - hidden for project tokens */}
              {formData.tokenType !== 'universal_client' && (
                <FormControl fullWidth size="small">
                  <InputLabel>{t('apiTokens.environmentAccess')}</InputLabel>
                  <Select
                    value={formData.environments[0] || ''}
                    label={t('apiTokens.environmentAccess')}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        allowAllEnvironments: false,
                        environments: [e.target.value as string],
                      }))
                    }
                    renderValue={(value) => {
                      const env = environments.find(
                        (e) => e.environmentId === value
                      );
                      return env ? env.displayName || env.environmentName : '';
                    }}
                  >
                    {environments.map((env) => (
                      <MenuItem
                        key={env.environmentId}
                        value={env.environmentId}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {env.displayName || env.environmentName}
                          </Typography>
                          {env.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {env.description}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Box>
          </Paper>

          {/* Expiration Section */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography
              variant="subtitle2"
              sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
            >
              {t('apiTokens.expirationSection')}
            </Typography>
            <LocalizationProvider
              dateAdapter={AdapterDayjs}
              adapterLocale={getDateLocale()}
            >
              <DateTimePicker
                label={t('apiTokens.expiresAt')}
                value={formData.expiresAt ? dayjs(formData.expiresAt) : null}
                onChange={(date) =>
                  setFormData((prev) => ({
                    ...prev,
                    expiresAt: date ? date.toISOString() : undefined,
                  }))
                }
                timeSteps={{ minutes: 1 }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    helperText:
                      expiresAtValidation.warning ||
                      t('apiTokens.expiresAtHelp'),
                    error: !expiresAtValidation.isValid,
                    slotProps: { input: { readOnly: true } },
                  },
                  actionBar: {
                    actions: ['clear', 'cancel', 'accept'],
                  },
                }}
              />
            </LocalizationProvider>
            {!expiresAtValidation.isValid && (
              <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                <Typography variant="caption">
                  {expiresAtValidation.warning}
                </Typography>
              </Alert>
            )}
          </Paper>
        </Box>

        {/* Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setEditDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleEdit}
            variant="contained"
            disabled={
              !isValidTokenName(formData.tokenName) ||
              !expiresAtValidation.isValid ||
              !formData.selectedProjectId ||
              (formData.tokenType !== 'universal_client' &&
                formData.environments.length === 0) ||
              (!!selectedToken && !isDirty)
            }
          >
            {t('common.update')}
          </Button>
        </Box>
      </ResizableDrawer>

      {/* Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        <Box
          sx={{
            p: 3,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'background.paper',
            position: 'sticky',
            top: 0,
            zIndex: 1301,
          }}
        >
          <Typography
            variant="h6"
            component="h2"
            sx={{ fontWeight: 600, color: 'error.main' }}
          >
            {t('apiTokens.deleteToken')}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Typography variant="body1" sx={{ mb: 3, fontWeight: 500 }}>
            {t('apiTokens.deleteConfirmation')}
          </Typography>

          {selectedToken && (
            <>
              <Box
                sx={{
                  mb: 3,
                  p: 3,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('apiTokens.tokenName')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {selectedToken.tokenName}
                </Typography>

                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  {t('apiTokens.tokenType')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(
                    `apiTokens.types.${selectedToken.tokenType}`,
                    selectedToken.tokenType
                  )}
                </Typography>
              </Box>

              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {t('apiTokens.deleteConfirmInstruction')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                <strong>{selectedToken.tokenName}</strong>
              </Typography>

              <TextField
                fullWidth
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={t('apiTokens.deleteConfirmPlaceholder')}
                size="medium"
                error={
                  deleteConfirmText.length > 0 &&
                  deleteConfirmText !== selectedToken.tokenName
                }
                helperText={
                  deleteConfirmText.length > 0 &&
                  deleteConfirmText !== selectedToken.tokenName
                    ? t('apiTokens.deleteConfirmMismatch')
                    : ''
                }
                sx={{ mb: 2 }}
              />
            </>
          )}
        </Box>

        <Box
          sx={{
            p: 3,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={() => setDeleteDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={
              !selectedToken || deleteConfirmText !== selectedToken.tokenName
            }
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* Regenerate Token Side Panel */}
      <Drawer
        anchor="right"
        open={regenerateDialogOpen}
        onClose={closeRegenerateDialog}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: 500,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        ModalProps={{
          keepMounted: false,
        }}
      >
        <Box
          sx={{
            p: 3,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'background.paper',
            position: 'sticky',
            top: 0,
            zIndex: 1300,
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.regenerateToken')}
          </Typography>
          <IconButton
            onClick={closeRegenerateDialog}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            {t('apiTokens.regenerateWarning')}
          </Alert>

          <Typography variant="body1" sx={{ mb: 3 }}>
            {t('apiTokens.regenerateConfirmation')}
          </Typography>

          {selectedToken && (
            <>
              <Box
                sx={{
                  p: 3,
                  bgcolor: 'background.default',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  mb: 3,
                }}
              >
                <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                  {selectedToken.tokenName}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  {t(
                    `apiTokens.${selectedToken.tokenType}TokenType`,
                    selectedToken.tokenType
                  )}
                </Typography>
                {selectedToken.description && (
                  <Typography variant="body2" color="text.secondary">
                    {selectedToken.description}
                  </Typography>
                )}
              </Box>

              {/* Confirmation Input */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                  {t('apiTokens.regenerateConfirmInstruction')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  <strong>{selectedToken.tokenName}</strong>
                </Typography>
                <TextField
                  fullWidth
                  ref={regenerateConfirmRef}
                  value={regenerateConfirmText}
                  onChange={(e) => setRegenerateConfirmText(e.target.value)}
                  placeholder={t('apiTokens.regenerateConfirmPlaceholder')}
                  size="medium"
                  error={
                    regenerateConfirmText.length > 0 &&
                    regenerateConfirmText !== selectedToken.tokenName
                  }
                  helperText={
                    regenerateConfirmText.length > 0 &&
                    regenerateConfirmText !== selectedToken.tokenName
                      ? t('apiTokens.regenerateConfirmMismatch')
                      : ''
                  }
                />
              </Box>
            </>
          )}
        </Box>

        <Box
          sx={{
            p: 3,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={closeRegenerateDialog} variant="outlined">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleRegenerate}
            color="primary"
            variant="contained"
            startIcon={<RefreshIcon />}
            disabled={
              !selectedToken ||
              regenerateConfirmText !== selectedToken.tokenName ||
              loading
            }
          >
            {t('apiTokens.regenerate')}
          </Button>
        </Box>
      </Drawer>

      {/* Bulk Delete Confirmation Drawer */}
      <Drawer
        anchor="right"
        open={bulkDeleteDrawerOpen}
        onClose={closeBulkDeleteDrawer}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
          },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: 1300,
          }}
        >
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('apiTokens.bulkDeleteConfirmation')}
          </Typography>
          <IconButton
            onClick={closeBulkDeleteDrawer}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ p: 3, flexGrow: 1 }}>
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              {t('apiTokens.bulkDeleteWarning')}
            </Typography>
          </Alert>

          {/* Selected Tokens List */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              {t('apiTokens.tokensToDelete', {
                count: selectedTokenIds.length,
              })}
              :
            </Typography>
            <Box
              sx={{
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 0,
                p: 1,
              }}
            >
              {tokens
                .filter((token) => selectedTokenIds.includes(token.id as any))
                .map((token) => (
                  <Box
                    key={token.id}
                    sx={{
                      p: 1.5,
                      mb: 1,
                      bgcolor: 'action.hover',
                      borderRadius: 0,
                      '&:last-child': { mb: 0 },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {token.tokenName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {token.tokenType} • {t('apiTokens.createdBy')}:{' '}
                      {token.creator?.name || 'Unknown'}
                    </Typography>
                  </Box>
                ))}
            </Box>
          </Box>

          {/* Confirmation Input */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {t('apiTokens.bulkDeleteConfirmInstruction')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mb: 2,
                p: 1,
                bgcolor: 'action.hover',
                borderRadius: 0,
                fontFamily: 'monospace',
                fontWeight: 600,
              }}
            >
              {t('apiTokens.deleteSelectedTokensText')}
            </Typography>
            <TextField
              fullWidth
              value={bulkDeleteConfirmText}
              onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
              placeholder={t('apiTokens.bulkDeleteConfirmPlaceholder')}
              variant="outlined"
              size="small"
            />
            {bulkDeleteConfirmText &&
              bulkDeleteConfirmText !==
                t('apiTokens.deleteSelectedTokensText') && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 1, display: 'block' }}
                >
                  {t('apiTokens.bulkDeleteConfirmMismatch')}
                </Typography>
              )}
          </Box>
        </Box>

        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            gap: 2,
            justifyContent: 'flex-end',
          }}
        >
          <Button onClick={closeBulkDeleteDrawer} variant="outlined">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
            disabled={
              bulkDeleteConfirmText !==
                t('apiTokens.deleteSelectedTokensText') || loading
            }
          >
            {t('apiTokens.bulkDelete')}
          </Button>
        </Box>
      </Drawer>

      {/* New Token Display Dialog */}
      <Dialog
        open={newTokenDialogOpen && !!newTokenInfo}
        onClose={() => {
          setNewTokenValue('');
          setNewTokenInfo(null);
          setNewTokenDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            maxWidth: '700px',
            width: '90%',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 32 }} />
            <Box>
              <Typography variant="h5" component="div" sx={{ fontWeight: 600 }}>
                {newTokenInfo?.isNew
                  ? t('apiTokens.tokenCreated')
                  : t('apiTokens.tokenRegenerated')}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* Token Summary */}
          {newTokenInfo && (
            <Box
              sx={{
                mb: 3,
                p: 3,
                bgcolor: 'background.paper',
                borderRadius: 0,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              <Typography
                variant="h6"
                sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
              >
                {t('apiTokens.tokenSummary')}
              </Typography>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    {t('apiTokens.tokenName')}
                  </Typography>
                  <Chip
                    label={newTokenInfo.tokenName}
                    variant="outlined"
                    size="small"
                  />
                </Box>
                {newTokenInfo.description && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontWeight: 500 }}
                    >
                      {t('apiTokens.description')}
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      sx={{ maxWidth: '60%', textAlign: 'right' }}
                    >
                      {newTokenInfo.description}
                    </Typography>
                  </Box>
                )}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    {t('apiTokens.tokenType')}
                  </Typography>
                  <Chip
                    label={String(
                      t(
                        `apiTokens.types.${newTokenInfo.tokenType}`,
                        newTokenInfo.tokenType
                      )
                    )}
                    color="primary"
                    size="small"
                  />
                </Box>

                {newTokenInfo.projectName && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontWeight: 500 }}
                    >
                      {t('common.project')}
                    </Typography>
                    <Chip
                      label={newTokenInfo.projectName}
                      variant="outlined"
                      size="small"
                    />
                  </Box>
                )}

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    {t('apiTokens.expiresAt')}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {newTokenInfo.expiresAt
                      ? formatRelativeTime(newTokenInfo.expiresAt)
                      : t('apiTokens.noExpiration')}
                  </Typography>
                </Box>

                {/* Environment Access - hidden for project tokens */}
                {newTokenInfo.tokenType !== 'universal_client' && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontWeight: 500 }}
                    >
                      {t('apiTokens.environments')}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                        justifyContent: 'flex-end',
                        maxWidth: '60%',
                      }}
                    >
                      {(() => {
                        const env = newTokenInfo.environmentId
                          ? environments.find(
                              (e) =>
                                e.environmentId === newTokenInfo.environmentId
                            )
                          : null;
                        return env ? (
                          <Chip
                            label={env.displayName || env.environmentName}
                            size="small"
                            variant="outlined"
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {t('apiTokens.noEnvironmentSelected')}
                          </Typography>
                        );
                      })()}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* Token Value */}
          {newTokenValue ? (
            <Box
              sx={{
                p: 2,
                bgcolor: 'action.hover',
                borderRadius: 0,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                {t('apiTokens.tokenValue')}
              </Typography>

              {/* Token Display with Copy Button */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  bgcolor: 'background.default',
                  borderRadius: 0,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="body2"
                  fontFamily="monospace"
                  sx={{
                    flex: 1,
                    fontSize: '0.875rem',
                    letterSpacing: '0.5px',
                    color: 'text.primary',
                  }}
                >
                  {maskToken(newTokenValue)}
                </Typography>
                <Tooltip title={t('apiTokens.copyTokenValue')}>
                  <IconButton
                    onClick={async () => await copyToClipboard(newTokenValue)}
                    size="small"
                    color="primary"
                  >
                    <CopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ) : (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2">
                {t('apiTokens.tokenValueError')}
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => {
              setNewTokenValue('');
              setNewTokenInfo(null);
              setNewTokenDialogOpen(false);
            }}
            variant="contained"
            startIcon={<CheckCircleIcon />}
            size="medium"
            sx={{
              px: 3,
              py: 1,
              fontWeight: 600,
              textTransform: 'none',
            }}
          >
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Column Settings Popover */}
      <Popover
        open={Boolean(columnSettingsAnchor)}
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        hideBackdrop
        disableScrollLock
      >
        <ClickAwayListener onClickAway={() => setColumnSettingsAnchor(null)}>
          <Box sx={{ p: 2, minWidth: 250 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1,
              }}
            >
              <Typography variant="subtitle2">
                {t('common.columnSettings')}
              </Typography>
              <Button size="small" onClick={handleResetColumns}>
                {t('common.reset')}
              </Button>
            </Box>
            <DndContext
              sensors={columnSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              modifiers={[restrictToVerticalAxis]}
            >
              <SortableContext
                items={columns.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <List dense>
                  {columns.map((column) => (
                    <SortableColumnItem
                      key={column.id}
                      column={column}
                      onToggleVisibility={handleToggleColumnVisibility}
                    />
                  ))}
                </List>
              </SortableContext>
            </DndContext>
          </Box>
        </ClickAwayListener>
      </Popover>
    </>
  );
};

export default ApiTokensPage;
