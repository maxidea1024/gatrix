/**
 * Action Sets Management Page
 *
 * Allows administrators to manage action sets (automated actions triggered by signals).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Autocomplete,
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Collapse,
  Divider,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  SmartToy as SmartToyIcon,
  PlayArrow as PlayIcon,
  RemoveCircleOutline as RemoveIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  MoreVert as MoreVertIcon,
  Sensors as SensorsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import actionSetService, {
  ActionSet,
  ActionSetEvent,
} from '@/services/actionSetService';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import PageContentLoader from '@/components/common/PageContentLoader';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import featureFlagService from '@/services/featureFlagService';
import environmentService, { Environment } from '@/services/environmentService';
import signalEndpointService, {
  SignalEndpoint,
} from '@/services/signalEndpointService';
import { ErrorCodes, extractErrorCode } from '@gatrix/shared';

import { useOrgProject } from '@/contexts/OrgProjectContext';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
// Action type options
const ACTION_TYPES = [
  { value: 'TOGGLE_FLAG', labelKey: 'actionSets.actionTypes.toggleFlag' },
  { value: 'ENABLE_FLAG', labelKey: 'actionSets.actionTypes.enableFlag' },
  { value: 'DISABLE_FLAG', labelKey: 'actionSets.actionTypes.disableFlag' },
];

// ==================== Action Set Dialog ====================
interface ActionSetDialogProps {
  open: boolean;
  actionSet: ActionSet | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    source: string;
    sourceId: number;
    actions: Array<{
      actionType: string;
      sortOrder: number;
      params: Record<string, unknown>;
    }>;
  }) => void;
}

interface ActionItem {
  actionType: string;
  sortOrder: number;
  params: { flagName: string; environmentId: string };
}

const ActionSetDialog: React.FC<ActionSetDialogProps> = ({
  open,
  actionSet,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedEndpointId, setSelectedEndpointId] = useState<number | ''>('');
  const [actions, setActions] = useState<ActionItem[]>([
    {
      actionType: 'TOGGLE_FLAG',
      sortOrder: 0,
      params: { flagName: '', environmentId: '' },
    },
  ]);
  const [flagOptions, setFlagOptions] = useState<string[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [signalEndpoints, setSignalEndpoints] = useState<SignalEndpoint[]>([]);

  // Load flag options and environments when dialog opens
  useEffect(() => {
    if (!open) return;
    const loadData = async () => {
      try {
        const [flagResult, envResult, endpointResult] = await Promise.all([
          featureFlagService.getFeatureFlags(
            { limit: 1000, isArchived: false },
            projectApiPath
          ),
          environmentService.getEnvironments(projectApiPath),
          signalEndpointService.getAll(projectApiPath),
        ]);
        setFlagOptions(flagResult.flags.map((f) => f.flagName));
        setEnvironments(envResult);
        setSignalEndpoints(endpointResult);
      } catch {
        // Silently fail - user can still type manually
      }
    };
    loadData();
  }, [open]);

  useEffect(() => {
    if (actionSet) {
      setName(actionSet.name);
      setDescription(actionSet.description || '');
      setSelectedEndpointId(actionSet.sourceId || '');
      if (actionSet.actions && actionSet.actions.length > 0) {
        setActions(
          actionSet.actions.map((a) => ({
            actionType: a.actionType,
            sortOrder: a.sortOrder,
            params: {
              flagName:
                (a.executionParams as Record<string, string>)?.flagName || '',
              environmentId:
                (a.executionParams as Record<string, string>)?.environmentId ||
                '',
            },
          }))
        );
      } else {
        setActions([
          {
            actionType: 'TOGGLE_FLAG',
            sortOrder: 0,
            params: { flagName: '', environmentId: '' },
          },
        ]);
      }
    } else {
      setName('');
      setDescription('');
      setSelectedEndpointId('');
      setActions([
        {
          actionType: 'TOGGLE_FLAG',
          sortOrder: 0,
          params: { flagName: '', environmentId: '' },
        },
      ]);
    }
  }, [actionSet, open]);

  const handleAddAction = () => {
    setActions([
      ...actions,
      {
        actionType: 'TOGGLE_FLAG',
        sortOrder: actions.length,
        params: { flagName: '', environmentId: '' },
      },
    ]);
  };

  const handleRemoveAction = (index: number) => {
    if (actions.length === 1) return;
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionChange = (index: number, field: string, value: string) => {
    const updated = [...actions];
    if (field === 'actionType') {
      updated[index].actionType = value;
    } else {
      (updated[index].params as Record<string, string>)[field] = value;
    }
    setActions(updated);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (!selectedEndpointId) return;
    const validActions = actions.filter(
      (a) => a.params.flagName.trim() && a.params.environmentId.trim()
    );
    if (validActions.length === 0) return;

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      source: 'signal-endpoint',
      sourceId: selectedEndpointId as number,
      actions: validActions.map((a, i) => ({
        actionType: a.actionType,
        sortOrder: i,
        params: a.params,
      })),
    });
  };

  const isValid =
    name.trim() &&
    selectedEndpointId &&
    actions.some(
      (a) => a.params.flagName.trim() && a.params.environmentId.trim()
    );

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={
        actionSet
          ? t('actionSets.editActionSet')
          : t('actionSets.createActionSet')
      }
      subtitle={t('actionSets.drawerSubtitle')}
      storageKey="actionSetDrawerWidth"
      defaultWidth={600}
      minWidth={500}
      zIndex={1301}
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
        {/* Basic Information */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}
          >
            {t('actionSets.basicInfo')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              autoFocus
              label={t('actionSets.name')}
              fullWidth
              size="small"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText={t('actionSets.nameHelp')}
            />
            <TextField
              label={t('actionSets.description')}
              fullWidth
              multiline
              rows={2}
              size="small"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              helperText={t('actionSets.descriptionHelp')}
            />
            <FormControl size="small" fullWidth required>
              <InputLabel>{t('actionSets.signalEndpoint')}</InputLabel>
              <Select
                value={selectedEndpointId}
                label={t('actionSets.signalEndpoint')}
                onChange={(e) =>
                  setSelectedEndpointId(e.target.value as number)
                }
              >
                {signalEndpoints.map((ep) => (
                  <MenuItem key={ep.id} value={ep.id}>
                    <Box
                      sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}
                    >
                      <SensorsIcon
                        fontSize="small"
                        sx={{
                          mt: 0.3,
                          color: ep.isEnabled
                            ? 'success.main'
                            : 'text.disabled',
                        }}
                      />
                      <Box>
                        <Typography variant="body2">
                          {ep.name}
                          {!ep.isEnabled &&
                            ` (${t('signalEndpoints.disabled')})`}
                        </Typography>
                        {ep.description && (
                          <Typography variant="caption" color="text.secondary">
                            {ep.description}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
              {t('actionSets.signalEndpointHelp')}
            </Typography>
          </Box>
        </Paper>

        {/* Actions List */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, color: 'primary.main' }}
            >
              {t('actionSets.actionList')}
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddAction}
            >
              {t('actionSets.addAction')}
            </Button>
          </Box>

          {actions.map((action, index) => (
            <Paper
              key={index}
              variant="outlined"
              sx={{
                p: 2,
                mb: 1,
                display: 'flex',
                gap: 1,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
              }}
            >
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>{t('actionSets.actionType')}</InputLabel>
                <Select
                  value={action.actionType}
                  label={t('actionSets.actionType')}
                  onChange={(e) =>
                    handleActionChange(index, 'actionType', e.target.value)
                  }
                >
                  {ACTION_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {t(type.labelKey)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Autocomplete
                size="small"
                freeSolo
                options={flagOptions}
                value={action.params.flagName}
                onInputChange={(_e, value) =>
                  handleActionChange(index, 'flagName', value)
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('actionSets.flagName')} />
                )}
                sx={{ flex: 1, minWidth: 150 }}
              />
              <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
                <InputLabel>{t('common.environment')}</InputLabel>
                <Select
                  value={action.params.environmentId}
                  label={t('common.environment')}
                  onChange={(e) =>
                    handleActionChange(index, 'environmentId', e.target.value)
                  }
                >
                  {environments.map((env) => (
                    <MenuItem key={env.environmentId} value={env.environmentId}>
                      {env.displayName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleRemoveAction(index)}
                disabled={actions.length === 1}
                sx={{ mt: 0.5 }}
              >
                <RemoveIcon />
              </IconButton>
            </Paper>
          ))}
        </Paper>
      </Box>

      {/* Footer Actions */}
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
        <Button onClick={onClose} startIcon={<CancelIcon />}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!isValid}
        >
          {actionSet ? t('common.save') : t('common.add')}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

// ==================== Delete Confirm Dialog ====================
interface DeleteDialogProps {
  open: boolean;
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteDialog: React.FC<DeleteDialogProps> = ({
  open,
  name,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('actionSets.deleteActionSet')}</DialogTitle>
      <DialogContent>
        <Typography>
          {t('actionSets.deleteConfirmMessage', { name })}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          {t('common.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ==================== Main Page ====================
const ActionSetsPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission([P.ACTIONS_UPDATE]);

  const { t } = useTranslation();
  const [actionSets, setActionSets] = useState<ActionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [events, setEvents] = useState<Record<number, ActionSetEvent[]>>({});
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  // Dialog states
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    actionSet: ActionSet | null;
  }>({ open: false, actionSet: null });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: number;
    name: string;
  } | null>(null);

  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTarget, setMenuTarget] = useState<ActionSet | null>(null);

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    item: ActionSet
  ) => {
    setMenuAnchorEl(event.currentTarget);
    setMenuTarget(item);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuTarget(null);
  };

  const fetchActionSets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await actionSetService.getAll(projectApiPath);
      setActionSets(data);
    } catch (error) {
      enqueueSnackbar(t('actionSets.loadFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchActionSets();
  }, [fetchActionSets]);

  const fetchEvents = useCallback(
    async (id: number) => {
      try {
        const result = await actionSetService.getEvents(projectApiPath, id, 10);
        setEvents((prev) => ({ ...prev, [id]: result.data }));
      } catch (error) {
        enqueueSnackbar(t('actionSets.eventsLoadFailed'), { variant: 'error' });
      }
    },
    [t]
  );

  const handleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchEvents(id);
    }
  };

  const handleSaveActionSet = async (data: {
    name: string;
    description?: string;
    source: string;
    sourceId: number;
    actions: Array<{
      actionType: string;
      sortOrder: number;
      params: Record<string, unknown>;
    }>;
  }) => {
    // Transform params -> executionParams for backend
    const transformedData = {
      ...data,
      actions: data.actions.map((a) => ({
        actionType: a.actionType,
        sortOrder: a.sortOrder,
        executionParams: a.params,
      })),
    };
    try {
      if (editDialog.actionSet) {
        await actionSetService.update(
          projectApiPath,
          editDialog.actionSet.id,
          transformedData
        );
        enqueueSnackbar(t('actionSets.updateSuccess'), { variant: 'success' });
      } else {
        await actionSetService.create(projectApiPath, transformedData);
        enqueueSnackbar(t('actionSets.createSuccess'), { variant: 'success' });
      }
      setEditDialog({ open: false, actionSet: null });
      fetchActionSets();
    } catch (error: any) {
      const errorCode = extractErrorCode(error);
      if (errorCode === ErrorCodes.RESOURCE_ALREADY_EXISTS) {
        enqueueSnackbar(t('actionSets.duplicateName'), { variant: 'error' });
      } else {
        enqueueSnackbar(
          editDialog.actionSet
            ? t('actionSets.updateFailed')
            : t('actionSets.createFailed'),
          { variant: 'error' }
        );
      }
    }
  };

  const handleToggle = async (actionSet: ActionSet) => {
    try {
      await actionSetService.toggle(projectApiPath, actionSet.id);
      fetchActionSets();
    } catch (error) {
      enqueueSnackbar(t('actionSets.toggleFailed'), { variant: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog) return;
    try {
      await actionSetService.delete(projectApiPath, deleteDialog.id);
      enqueueSnackbar(t('actionSets.deleteSuccess'), { variant: 'success' });
      setDeleteDialog(null);
      fetchActionSets();
    } catch (error) {
      enqueueSnackbar(t('actionSets.deleteFailed'), { variant: 'error' });
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'started':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight="bold">
            {t('actionSets.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('actionSets.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchActionSets}
          >
            {t('common.refresh')}
          </Button>
          {actionSets.length > 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setEditDialog({ open: true, actionSet: null })}
            >
              {t('actionSets.createActionSet')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Content */}
      <PageContentLoader loading={loading}>
        {actionSets.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('actionSets.noActionSets')}
            onAddClick={
              canManage
                ? () => setEditDialog({ open: true, actionSet: null })
                : undefined
            }
            addButtonLabel={t('actionSets.createActionSet')}
          />
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={40} />
                  <TableCell>{t('actionSets.name')}</TableCell>
                  <TableCell>{t('common.description')}</TableCell>
                  <TableCell>{t('actionSets.source')}</TableCell>
                  <TableCell align="center">{t('actionSets.status')}</TableCell>
                  <TableCell align="center">
                    {t('actionSets.actionCount')}
                  </TableCell>
                  <TableCell align="center">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody
                sx={{
                  '& .MuiTableRow-root:nth-of-type(4n+1)': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark' ? '#1e2125' : '#f8f9fa',
                  },
                  '& .MuiTableRow-root:nth-of-type(4n+3)': {
                    backgroundColor: 'transparent',
                  },
                }}
              >
                {actionSets.map((actionSet) => (
                  <React.Fragment key={actionSet.id}>
                    <TableRow
                      hover
                      sx={{
                        '& > td': {
                          borderBottom:
                            expandedId === actionSet.id ? 'none' : undefined,
                        },
                      }}
                    >
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleExpand(actionSet.id)}
                        >
                          {expandedId === actionSet.id ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {actionSet.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {actionSet.description || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {(actionSet as any).sourceName ||
                            actionSet.source ||
                            '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Switch
                          checked={actionSet.isEnabled}
                          size="small"
                          onChange={() => handleToggle(actionSet)}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={actionSet.actions?.length || 0}
                          size="small"
                          variant="outlined"
                          icon={<PlayIcon sx={{ fontSize: 14 }} />}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, actionSet)}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Events */}
                    <TableRow hover>
                      <TableCell
                        colSpan={7}
                        sx={{
                          py: 0,
                          borderBottom:
                            expandedId === actionSet.id ? undefined : 'none',
                        }}
                      >
                        <Collapse in={expandedId === actionSet.id}>
                          <Box
                            sx={{
                              p: 2,
                              bgcolor: 'action.hover',
                              borderRadius: 1,
                              my: 1,
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              {t('actionSets.recentEvents')}
                            </Typography>
                            <Divider sx={{ mb: 1 }} />
                            {!events[actionSet.id] ||
                            events[actionSet.id].length === 0 ? (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ py: 1 }}
                              >
                                {t('actionSets.noEvents')}
                              </Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow hover>
                                    <TableCell>
                                      {t('actionSets.eventState')}
                                    </TableCell>
                                    <TableCell>
                                      {t('actionSets.eventSignalId')}
                                    </TableCell>
                                    <TableCell>
                                      {t('actionSets.eventDate')}
                                    </TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {events[actionSet.id].map((event) => (
                                    <TableRow key={event.id} hover>
                                      <TableCell>
                                        <Chip
                                          label={t(
                                            `actionSets.states.${event.eventState}`
                                          )}
                                          size="small"
                                          color={
                                            getStateColor(event.eventState) as
                                              | 'success'
                                              | 'error'
                                              | 'info'
                                              | 'default'
                                          }
                                        />
                                      </TableCell>
                                      <TableCell>
                                        {event.signalId || '-'}
                                      </TableCell>
                                      <TableCell>
                                        <Tooltip
                                          title={formatDateTimeDetailed(
                                            event.createdAt
                                          )}
                                        >
                                          <Typography variant="body2">
                                            {formatRelativeTime(
                                              event.createdAt
                                            )}
                                          </Typography>
                                        </Tooltip>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </PageContentLoader>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (menuTarget)
              setEditDialog({ open: true, actionSet: menuTarget });
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuTarget)
              setDeleteDialog({
                open: true,
                id: menuTarget.id,
                name: menuTarget.name,
              });
            handleMenuClose();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Dialogs */}
      <ActionSetDialog
        open={editDialog.open}
        actionSet={editDialog.actionSet}
        onClose={() => setEditDialog({ open: false, actionSet: null })}
        onSave={handleSaveActionSet}
      />

      {deleteDialog && (
        <DeleteDialog
          open={deleteDialog.open}
          name={deleteDialog.name}
          onClose={() => setDeleteDialog(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </Box>
  );
};

export default ActionSetsPage;
