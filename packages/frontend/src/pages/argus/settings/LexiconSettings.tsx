import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Drawer,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  CircularProgress,
  alpha,
  useTheme,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Popover,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Shield as ShieldIcon,
  Close as CloseIcon,
  Person as PersonIcon,
  VisibilityOff as VisibilityOffIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  AutoFixHigh as SeedIcon,
} from '@mui/icons-material';
import { type IconProps } from '@phosphor-icons/react';
import { useSnackbar } from 'notistack';
import argusService, {
  ArgusLexiconEvent,
  ArgusLexiconProperty,
} from '@/services/argusService';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import {
  ICON_CATALOG,
  renderLexiconIcon,
  COLOR_PRESETS,
} from '@/utils/lexiconIcons';
import PageContentLoader from '@/components/common/PageContentLoader';

interface LexiconSettingsProps {
  projectId: string;
  isDark: boolean;
  t: (...args: any[]) => any;
}

const LexiconSettings: React.FC<LexiconSettingsProps> = ({
  projectId,
  isDark,
  t,
}) => {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const {
    localizeEventName,
    localizeEventDescription,
    localizePropertyName,
    localizePropertyDescription,
  } = useLocalizedLexicon();

  // State
  const [tabValue, setTabValue] = useState(0); // 0 = Events, 1 = Properties
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<ArgusLexiconEvent[]>([]);
  const [properties, setProperties] = useState<ArgusLexiconProperty[]>([]);
  const [seeding, setSeeding] = useState(false);

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('edit');
  const [selectedEvent, setSelectedEvent] = useState<ArgusLexiconEvent | null>(
    null
  );
  const [selectedProperty, setSelectedProperty] =
    useState<ArgusLexiconProperty | null>(null);

  // Edit/Create form states
  const [editEventName, setEditEventName] = useState('');
  const [editPropertyName, setEditPropertyName] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editStatus, setEditStatus] = useState<
    'active' | 'deprecated' | 'hidden'
  >('active');
  const [editOwner, setEditOwner] = useState('');
  const [editDataType, setEditDataType] = useState<
    'string' | 'number' | 'boolean' | 'date'
  >('string');
  const [editIcon, setEditIcon] = useState('');
  const [editIconColor, setEditIconColor] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Delete dialog states
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'event' | 'property';
    name: string;
  }>({
    open: false,
    type: 'event',
    name: '',
  });
  const [deleting, setDeleting] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (tabValue === 0) {
        const data = await argusService.getLexiconEvents(projectId);
        setEvents(data);
      } else {
        const data = await argusService.getLexiconProperties(projectId);
        setProperties(data);
      }
    } catch {
      enqueueSnackbar(
        t('argus.settings.lexicon.fetchError', 'Failed to load lexicon data'),
        { variant: 'error' }
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, tabValue, enqueueSnackbar, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Tab Change
  const handleTabChange = (_e: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setSearchQuery('');
  };

  // ── Seed reserved events/properties ──
  const handleSeed = async () => {
    setSeeding(true);
    try {
      await argusService.seedLexicon(projectId);
      enqueueSnackbar(
        t(
          'argus.settings.lexicon.seedSuccess',
          'Reserved events and properties seeded'
        ),
        { variant: 'success' }
      );
      fetchData();
    } catch {
      enqueueSnackbar(t('argus.settings.lexicon.seedError', 'Failed to seed'), {
        variant: 'error',
      });
    } finally {
      setSeeding(false);
    }
  };

  // ── Open Drawer for Create ──
  const handleOpenCreate = () => {
    setDrawerMode('create');
    setSelectedEvent(null);
    setSelectedProperty(null);
    setEditEventName('');
    setEditPropertyName('');
    setEditDisplayName('');
    setEditIcon('');
    setEditIconColor('');
    setEditDescription('');
    setEditCategory('');
    setEditStatus('active');
    setEditOwner('');
    setEditDataType('string');
    setEmojiPickerOpen(false);
    setDrawerOpen(true);
  };

  // ── Open Drawer for Edit Event ──
  const handleEditEvent = (ev: ArgusLexiconEvent) => {
    setDrawerMode('edit');
    setSelectedEvent(ev);
    setSelectedProperty(null);
    setEditDisplayName(ev.display_name || '');
    setEditDescription(ev.description || '');
    setEditCategory(ev.category || '');
    setEditStatus(ev.status || 'active');
    setEditOwner(ev.owner || '');
    setEditIcon(ev.icon || '');
    setEditIconColor(ev.icon_color || '');
    setEmojiPickerOpen(false);
    setDrawerOpen(true);
  };

  // ── Open Drawer for Edit Property ──
  const handleEditProperty = (prop: ArgusLexiconProperty) => {
    setDrawerMode('edit');
    setSelectedProperty(prop);
    setSelectedEvent(null);
    setEditDisplayName(prop.display_name || '');
    setEditDescription(prop.description || '');
    setEditDataType(prop.data_type || 'string');
    setEditStatus(prop.status || 'active');
    setDrawerOpen(true);
  };

  // ── Create Event ──
  const handleCreateEvent = async () => {
    if (!editEventName.trim()) return;
    setSaving(true);
    try {
      await argusService.createLexiconEvent(projectId, {
        event_name: editEventName.trim(),
        display_name: editDisplayName || undefined,
        icon: editIcon || undefined,
        icon_color: editIconColor || undefined,
        description: editDescription || undefined,
        category: editCategory || undefined,
        status: editStatus,
        owner: editOwner || undefined,
      });
      enqueueSnackbar(
        t('argus.settings.lexicon.saveSuccess', 'Event created successfully'),
        { variant: 'success' }
      );
      setDrawerOpen(false);
      fetchData();
    } catch {
      enqueueSnackbar(
        t('argus.settings.lexicon.saveError', 'Failed to create event'),
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Create Property ──
  const handleCreateProperty = async () => {
    if (!editPropertyName.trim()) return;
    setSaving(true);
    try {
      await argusService.createLexiconProperty(projectId, {
        property_name: editPropertyName.trim(),
        display_name: editDisplayName || undefined,
        description: editDescription || undefined,
        data_type: editDataType,
        status: editStatus,
      });
      enqueueSnackbar(
        t(
          'argus.settings.lexicon.saveSuccess',
          'Property created successfully'
        ),
        { variant: 'success' }
      );
      setDrawerOpen(false);
      fetchData();
    } catch {
      enqueueSnackbar(
        t('argus.settings.lexicon.saveError', 'Failed to create property'),
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Save Event Metadata ──
  const handleSaveEvent = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await argusService.updateLexiconEvent(
        projectId,
        selectedEvent.event_name,
        {
          display_name: editDisplayName || null,
          icon: editIcon || null,
          icon_color: editIconColor || null,
          description: editDescription || null,
          category: editCategory || null,
          status: editStatus,
          owner: editOwner || null,
        }
      );
      enqueueSnackbar(
        t(
          'argus.settings.lexicon.saveSuccess',
          'Event metadata saved successfully'
        ),
        { variant: 'success' }
      );
      setDrawerOpen(false);
      fetchData();
    } catch {
      enqueueSnackbar(
        t('argus.settings.lexicon.saveError', 'Failed to save event metadata'),
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Save Property Metadata ──
  const handleSaveProperty = async () => {
    if (!selectedProperty) return;
    setSaving(true);
    try {
      await argusService.updateLexiconProperty(
        projectId,
        selectedProperty.property_name,
        {
          display_name: editDisplayName || null,
          description: editDescription || null,
          data_type: editDataType,
          status: editStatus,
        }
      );
      enqueueSnackbar(
        t(
          'argus.settings.lexicon.saveSuccess',
          'Property metadata saved successfully'
        ),
        { variant: 'success' }
      );
      setDrawerOpen(false);
      fetchData();
    } catch {
      enqueueSnackbar(
        t(
          'argus.settings.lexicon.saveError',
          'Failed to save property metadata'
        ),
        { variant: 'error' }
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (deleteDialog.type === 'event') {
        await argusService.deleteLexiconEvent(projectId, deleteDialog.name);
      } else {
        await argusService.deleteLexiconProperty(projectId, deleteDialog.name);
      }
      enqueueSnackbar(
        t('argus.settings.lexicon.deleteSuccess', 'Deleted successfully'),
        { variant: 'success' }
      );
      setDeleteDialog({ open: false, type: 'event', name: '' });
      fetchData();
    } catch {
      enqueueSnackbar(
        t('argus.settings.lexicon.deleteFailed', 'Failed to delete'),
        { variant: 'error' }
      );
    } finally {
      setDeleting(false);
    }
  };

  // Filtering list
  const filteredEvents = useMemo(() => {
    if (tabValue !== 0) return [];
    return events.filter(
      (e) =>
        e.event_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.display_name || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        (e.category || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [events, searchQuery, tabValue]);

  const filteredProperties = useMemo(() => {
    if (tabValue !== 1) return [];
    return properties.filter(
      (p) =>
        p.property_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.display_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [properties, searchQuery, tabValue]);

  // Color theme helper
  const isReservedColor = isDark ? '#a78bfa' : '#6d28d9';
  const customColor = isDark ? '#2dd4bf' : '#0f766e';

  // Check if empty (for seed CTA)
  const isEmpty =
    tabValue === 0 ? events.length === 0 : properties.length === 0;

  // Determine drawer save handler
  const getDrawerSaveHandler = () => {
    if (drawerMode === 'create') {
      return tabValue === 0 ? handleCreateEvent : handleCreateProperty;
    }
    return selectedEvent ? handleSaveEvent : handleSaveProperty;
  };

  const getDrawerTitle = () => {
    if (drawerMode === 'create') {
      return tabValue === 0
        ? t('argus.settings.lexicon.createEvent', 'Create Event')
        : t('argus.settings.lexicon.createProperty', 'Create Property');
    }
    return selectedEvent
      ? t('argus.settings.lexicon.editEvent', 'Edit Event Metadata')
      : t('argus.settings.lexicon.editProperty', 'Edit Property Metadata');
  };

  return (
    <PageContentLoader loading={loading}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Description header */}
      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {t('argus.settings.lexicon.title', 'Lexicon (Data Dictionary)')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            'argus.settings.lexicon.subtitle',
            'Define display names, category tags, and descriptions for incoming events and properties to keep your tracking data clean and understandable for your team.'
          )}
        </Typography>
      </Box>

      {/* Tabs, search, and action buttons */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="lexicon sections"
        >
          <Tab label={t('argus.settings.lexicon.events', 'Events')} />
          <Tab label={t('argus.settings.lexicon.properties', 'Properties')} />
        </Tabs>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
          <TextField
            size="small"
            placeholder={t(
              'argus.settings.lexicon.search',
              'Search names, display names...'
            )}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{ width: 240 }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="disabled" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Tooltip
            title={t(
              'argus.settings.lexicon.seedReserved',
              'Seed system events & properties'
            )}
          >
            <Button
              size="small"
              variant="outlined"
              startIcon={
                seeding ? <CircularProgress size={16} /> : <SeedIcon />
              }
              onClick={handleSeed}
              disabled={seeding}
              sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
            >
              Seed
            </Button>
          </Tooltip>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            {tabValue === 0
              ? t('argus.settings.lexicon.addEvent', 'Add Event')
              : t('argus.settings.lexicon.addProperty', 'Add Property')}
          </Button>
        </Box>
      </Box>

      {/* Main Table view */}
      {isEmpty && !searchQuery ? (
        /* Empty State with Seed CTA */
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 10,
            gap: 2,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <SeedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
          <Typography variant="body1" color="text.secondary" fontWeight={500}>
            {tabValue === 0
              ? t('argus.settings.lexicon.emptyEvents', 'No events defined yet')
              : t(
                  'argus.settings.lexicon.emptyProperties',
                  'No properties defined yet'
                )}
          </Typography>
          <Typography
            variant="body2"
            color="text.disabled"
            sx={{ maxWidth: 400, textAlign: 'center' }}
          >
            {t(
              'argus.settings.lexicon.emptyHint',
              'Click "Seed" to populate system-defined events & properties, or "Add" to create your own.'
            )}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button
              variant="outlined"
              startIcon={
                seeding ? <CircularProgress size={16} /> : <SeedIcon />
              }
              onClick={handleSeed}
              disabled={seeding}
              sx={{ textTransform: 'none' }}
            >
              {t('argus.settings.lexicon.seedReserved', 'Seed System Events')}
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{ textTransform: 'none' }}
            >
              {tabValue === 0
                ? t('argus.settings.lexicon.addEvent', 'Add Event')
                : t('argus.settings.lexicon.addProperty', 'Add Property')}
            </Button>
          </Box>
        </Box>
      ) : tabValue === 0 ? (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        >
          <Table aria-label="lexicon events table">
            <TableHead
              sx={{
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.01)',
              }}
            >
              <TableRow>
                <TableCell style={{ fontWeight: 600, width: 56 }}></TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.eventName', 'Event Name')}
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.alias', 'Display Name')}
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.category', 'Category')}
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.status', 'Status')}
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.owner', 'Owner')}
                </TableCell>
                <TableCell align="right" style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.action', 'Actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('argus.settings.lexicon.noEvents', 'No events found')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((ev) => (
                  <TableRow
                    key={ev.event_name}
                    hover
                    sx={{ opacity: ev.status === 'deprecated' ? 0.6 : 1 }}
                  >
                    <TableCell sx={{ width: 56, px: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: ev.icon_color
                            ? alpha(ev.icon_color, isDark ? 0.18 : 0.12)
                            : isDark
                              ? 'rgba(99, 102, 241, 0.15)'
                              : 'rgba(99, 102, 241, 0.08)',
                          color:
                            ev.icon_color || (isDark ? '#a5b4fc' : '#4f46e5'),
                        }}
                      >
                        {renderLexiconIcon(
                          ev.icon,
                          20,
                          ev.icon_color || undefined
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          fontWeight={500}
                        >
                          {ev.event_name}
                        </Typography>
                        {ev.is_reserved ? (
                          <Chip
                            size="small"
                            icon={
                              <ShieldIcon
                                style={{ fontSize: 12, color: isReservedColor }}
                              />
                            }
                            label="System"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: alpha(isReservedColor, 0.1),
                              color: isReservedColor,
                              border: `1px solid ${alpha(isReservedColor, 0.2)}`,
                              fontWeight: 600,
                            }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="Custom"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: alpha(customColor, 0.1),
                              color: customColor,
                              border: `1px solid ${alpha(customColor, 0.2)}`,
                              fontWeight: 600,
                            }}
                          />
                        )}
                      </Box>
                      {localizeEventDescription(
                        ev.event_name,
                        ev.description,
                        ev.is_reserved
                      ) && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {localizeEventDescription(
                            ev.event_name,
                            ev.description,
                            ev.is_reserved
                          )}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {localizeEventName(
                        ev.event_name,
                        ev.display_name,
                        ev.is_reserved
                      ) !== ev.event_name
                        ? localizeEventName(
                            ev.event_name,
                            ev.display_name,
                            ev.is_reserved
                          )
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {ev.category ? (
                        <Chip
                          size="small"
                          label={ev.category}
                          variant="outlined"
                          sx={{ height: 22, fontSize: '0.75rem' }}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {ev.status === 'deprecated' && (
                        <Chip
                          size="small"
                          label="Deprecated"
                          color="warning"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                      )}
                      {ev.status === 'hidden' && (
                        <Chip
                          size="small"
                          icon={<VisibilityOffIcon style={{ fontSize: 12 }} />}
                          label="Hidden"
                          color="error"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                      )}
                      {ev.status === 'active' && (
                        <Chip
                          size="small"
                          label="Active"
                          color="success"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {ev.owner ? (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          <PersonIcon fontSize="inherit" color="action" />
                          <Typography variant="body2">{ev.owner}</Typography>
                        </Box>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleEditEvent(ev)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {!ev.is_reserved && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: 'event',
                                name: ev.event_name,
                              })
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        >
          <Table aria-label="lexicon properties table">
            <TableHead
              sx={{
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.02)'
                  : 'rgba(0,0,0,0.01)',
              }}
            >
              <TableRow>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.propertyName', 'Property Name')}
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.alias', 'Display Name')}
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.dataType', 'Data Type')}
                </TableCell>
                <TableCell style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.status', 'Status')}
                </TableCell>
                <TableCell align="right" style={{ fontWeight: 600 }}>
                  {t('argus.settings.lexicon.action', 'Actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProperties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t(
                        'argus.settings.lexicon.noProperties',
                        'No properties found'
                      )}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProperties.map((prop) => (
                  <TableRow
                    key={prop.property_name}
                    hover
                    sx={{ opacity: prop.status === 'deprecated' ? 0.6 : 1 }}
                  >
                    <TableCell>
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          fontWeight={500}
                        >
                          {prop.property_name}
                        </Typography>
                        {prop.is_reserved ? (
                          <Chip
                            size="small"
                            icon={
                              <ShieldIcon
                                style={{ fontSize: 12, color: isReservedColor }}
                              />
                            }
                            label="System"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: alpha(isReservedColor, 0.1),
                              color: isReservedColor,
                              border: `1px solid ${alpha(isReservedColor, 0.2)}`,
                              fontWeight: 600,
                            }}
                          />
                        ) : (
                          <Chip
                            size="small"
                            label="Custom"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              backgroundColor: alpha(customColor, 0.1),
                              color: customColor,
                              border: `1px solid ${alpha(customColor, 0.2)}`,
                              fontWeight: 600,
                            }}
                          />
                        )}
                      </Box>
                      {localizePropertyDescription(
                        prop.property_name,
                        prop.description,
                        prop.is_reserved
                      ) && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block', mt: 0.5 }}
                        >
                          {localizePropertyDescription(
                            prop.property_name,
                            prop.description,
                            prop.is_reserved
                          )}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {localizePropertyName(
                        prop.property_name,
                        prop.display_name,
                        prop.is_reserved
                      ) !== prop.property_name
                        ? localizePropertyName(
                            prop.property_name,
                            prop.display_name,
                            prop.is_reserved
                          )
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={prop.data_type?.toUpperCase() || 'STRING'}
                        color="secondary"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      {prop.status === 'deprecated' && (
                        <Chip
                          size="small"
                          label="Deprecated"
                          color="warning"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                      )}
                      {prop.status === 'hidden' && (
                        <Chip
                          size="small"
                          icon={<VisibilityOffIcon style={{ fontSize: 12 }} />}
                          label="Hidden"
                          color="error"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                      )}
                      {prop.status === 'active' && (
                        <Chip
                          size="small"
                          label="Active"
                          color="success"
                          variant="outlined"
                          sx={{ height: 20 }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          justifyContent: 'flex-end',
                        }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleEditProperty(prop)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {!prop.is_reserved && (
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: 'property',
                                name: prop.property_name,
                              })
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create/Edit Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      >
        <Box
          sx={{
            width: 400,
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {getDrawerTitle()}
            </Typography>
            {drawerMode === 'edit' && (
              <Typography
                variant="caption"
                color="text.secondary"
                fontFamily="monospace"
                sx={{ display: 'block', mt: 1 }}
              >
                {selectedEvent
                  ? selectedEvent.event_name
                  : selectedProperty?.property_name}
              </Typography>
            )}
          </Box>

          {/* Name field (only in create mode) */}
          {drawerMode === 'create' && tabValue === 0 && (
            <TextField
              fullWidth
              required
              label={t('argus.settings.lexicon.eventNameLabel', 'Event Key')}
              value={editEventName}
              onChange={(e) => setEditEventName(e.target.value)}
              placeholder={t(
                'argus.settings.lexicon.eventNamePlaceholder',
                'e.g. button_clicked'
              )}
              helperText={t(
                'argus.settings.lexicon.eventNameHint',
                'Unique event identifier (cannot be changed later)'
              )}
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
            />
          )}
          {drawerMode === 'create' && tabValue === 1 && (
            <TextField
              fullWidth
              required
              label={t(
                'argus.settings.lexicon.propertyNameLabel',
                'Property Key'
              )}
              value={editPropertyName}
              onChange={(e) => setEditPropertyName(e.target.value)}
              placeholder="e.g. plan_type"
              helperText={t(
                'argus.settings.lexicon.propertyNameHint',
                'Unique property identifier (cannot be changed later)'
              )}
              slotProps={{ htmlInput: { style: { fontFamily: 'monospace' } } }}
            />
          )}

          {/* Icon picker (Events only) */}
          {(tabValue === 0 || selectedEvent) && (
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 1, display: 'block' }}
              >
                {t('argus.settings.lexicon.iconLabel', 'Icon')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={(e) =>
                    setEmojiPickerOpen(emojiPickerOpen ? false : true)
                  }
                  id="icon-picker-anchor"
                  sx={{
                    minWidth: 48,
                    height: 48,
                    borderRadius: 2,
                    borderStyle: 'dashed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: editIconColor
                      ? alpha(editIconColor, isDark ? 0.18 : 0.12)
                      : 'transparent',
                    color: editIconColor || (isDark ? '#a5b4fc' : '#4f46e5'),
                    borderColor: editIconColor || undefined,
                  }}
                >
                  {editIcon ? (
                    renderLexiconIcon(editIcon, 24, editIconColor || undefined)
                  ) : (
                    <AddIcon fontSize="small" />
                  )}
                </Button>
                {editIcon && (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      {ICON_CATALOG.find((ic) => ic.name === editIcon)?.label ||
                        editIcon}
                    </Typography>
                    <IconButton size="small" onClick={() => setEditIcon('')}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
              <Popover
                open={emojiPickerOpen}
                anchorEl={document.getElementById('icon-picker-anchor')}
                onClose={() => setEmojiPickerOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                  paper: {
                    sx: {
                      p: 2,
                      maxWidth: 360,
                      maxHeight: 400,
                      overflow: 'auto',
                      borderRadius: 2,
                    },
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: 0.5,
                  }}
                >
                  {ICON_CATALOG.map((item) => {
                    const IconComp = item.component;
                    const isSelected = editIcon === item.name;
                    return (
                      <Tooltip key={item.name} title={item.label} arrow>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditIcon(item.name);
                            setEmojiPickerOpen(false);
                          }}
                          sx={{
                            width: 38,
                            height: 38,
                            borderRadius: 1.5,
                            color: isSelected
                              ? '#fff'
                              : isDark
                                ? '#a5b4fc'
                                : '#4f46e5',
                            backgroundColor: isSelected
                              ? isDark
                                ? '#4f46e5'
                                : '#4338ca'
                              : 'transparent',
                            '&:hover': {
                              backgroundColor: isSelected
                                ? isDark
                                  ? '#4338ca'
                                  : '#3730a3'
                                : alpha(isDark ? '#a5b4fc' : '#4f46e5', 0.08),
                            },
                          }}
                        >
                          <IconComp size={20} weight="regular" />
                        </IconButton>
                      </Tooltip>
                    );
                  })}
                </Box>
              </Popover>

              {/* Color picker */}
              <Box sx={{ mt: 1.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.75, display: 'block' }}
                >
                  {t('argus.settings.lexicon.iconColor', 'Icon Color')}
                </Typography>
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.75,
                    alignItems: 'center',
                  }}
                >
                  {COLOR_PRESETS.map((c) => (
                    <Box
                      key={c}
                      onClick={() =>
                        setEditIconColor(editIconColor === c ? '' : c)
                      }
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        bgcolor: c,
                        cursor: 'pointer',
                        border:
                          editIconColor === c
                            ? `2px solid ${isDark ? '#fff' : '#000'}`
                            : '2px solid transparent',
                        transition: 'all 0.15s',
                        '&:hover': { transform: 'scale(1.2)' },
                      }}
                    />
                  ))}
                  {editIconColor && (
                    <IconButton
                      size="small"
                      onClick={() => setEditIconColor('')}
                      sx={{ ml: 0.5 }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>
            </Box>
          )}

          {/* Common fields */}
          <TextField
            fullWidth
            label={t('argus.settings.lexicon.alias', 'Display Name')}
            value={editDisplayName}
            onChange={(e) => setEditDisplayName(e.target.value)}
            placeholder={
              drawerMode === 'create'
                ? 'e.g. Button Clicked'
                : selectedEvent
                  ? selectedEvent.event_name
                  : selectedProperty?.property_name
            }
          />

          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('argus.settings.lexicon.description', 'Description')}
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder={t(
              'argus.settings.lexicon.descPlaceholder',
              'What triggers this event/property?'
            )}
          />

          {/* Event-specific fields */}
          {(selectedEvent || (drawerMode === 'create' && tabValue === 0)) && (
            <>
              <TextField
                fullWidth
                label={t('argus.settings.lexicon.category', 'Category')}
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g. Onboarding, Payment"
              />
              <TextField
                fullWidth
                label={t('argus.settings.lexicon.owner', 'Owner (Team/User)')}
                value={editOwner}
                onChange={(e) => setEditOwner(e.target.value)}
                placeholder="e.g. Billing Team, admin"
              />
            </>
          )}

          {/* Property-specific fields */}
          {(selectedProperty ||
            (drawerMode === 'create' && tabValue === 1)) && (
            <FormControl fullWidth>
              <InputLabel id="data-type-select-label">
                {t('argus.settings.lexicon.dataType', 'Data Type')}
              </InputLabel>
              <Select
                labelId="data-type-select-label"
                value={editDataType}
                label={t('argus.settings.lexicon.dataType', 'Data Type')}
                onChange={(e) => setEditDataType(e.target.value as any)}
              >
                <MenuItem value="string">STRING</MenuItem>
                <MenuItem value="number">NUMBER</MenuItem>
                <MenuItem value="boolean">BOOLEAN</MenuItem>
                <MenuItem value="date">DATE</MenuItem>
              </Select>
            </FormControl>
          )}

          <FormControl fullWidth>
            <InputLabel id="status-select-label">
              {t('argus.settings.lexicon.status', 'Status')}
            </InputLabel>
            <Select
              labelId="status-select-label"
              value={editStatus}
              label={t('argus.settings.lexicon.status', 'Status')}
              onChange={(e) => setEditStatus(e.target.value as any)}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="deprecated">Deprecated (Mark warning)</MenuItem>
              <MenuItem value="hidden">Hidden (Hide in dropdowns)</MenuItem>
            </Select>
          </FormControl>

          {/* Drawer Actions */}
          <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => setDrawerOpen(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="contained"
              fullWidth
              disabled={
                saving ||
                (drawerMode === 'create' &&
                  tabValue === 0 &&
                  !editEventName.trim()) ||
                (drawerMode === 'create' &&
                  tabValue === 1 &&
                  !editPropertyName.trim())
              }
              onClick={getDrawerSaveHandler()}
            >
              {saving ? (
                <CircularProgress size={24} />
              ) : (
                t('common.save', 'Save')
              )}
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() =>
          setDeleteDialog({ open: false, type: 'event', name: '' })
        }
      >
        <DialogTitle>
          {t('argus.settings.lexicon.deleteConfirm', 'Delete Confirmation')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Typography
              component="span"
              fontFamily="monospace"
              fontWeight={600}
            >
              {deleteDialog.name}
            </Typography>{' '}
            {t(
              'argus.settings.lexicon.deleteMessage',
              'will be permanently removed from the lexicon. This action cannot be undone.'
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setDeleteDialog({ open: false, type: 'event', name: '' })
            }
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <CircularProgress size={20} />
            ) : (
              t('common.delete', 'Delete')
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </PageContentLoader>
  );
};

export default LexiconSettings;
