import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Paper,
  Chip,
  Tooltip,
  Skeleton,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Group as CohortIcon,
  People as PeopleIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  getCohorts,
  createCohort,
  deleteCohort,
  computeCohort,
  previewCohort,
  getAnalyticsEventNames,
} from '@/services/argus/argusAnalytics';
import type {
  ArgusCohort,
  ArgusCohortRule,
  ArgusCohortDefinition,
  AnalyticsEventNameEntry,
} from '@/services/argus/argusTypes';

// ─── Constants ───────────────────────────────────────────────────────────────

const OPERATORS = [
  { value: '>=', label: '≥' },
  { value: '<=', label: '≤' },
  { value: '==', label: '=' },
  { value: '>', label: '>' },
  { value: '<', label: '<' },
] as const;

const TIME_RANGES = [
  { value: '1d', label: '1 day' },
  { value: '3d', label: '3 days' },
  { value: '7d', label: '7 days' },
  { value: '14d', label: '14 days' },
  { value: '30d', label: '30 days' },
  { value: '60d', label: '60 days' },
  { value: '90d', label: '90 days' },
] as const;

const DEFAULT_RULE: ArgusCohortRule = {
  event: '',
  operator: '>=',
  count: 1,
  timeRange: '7d',
};

// ─── Cohort Builder Dialog ───────────────────────────────────────────────────

interface CohortBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    definition: ArgusCohortDefinition;
  }) => Promise<void>;
  projectId: string;
  eventNames: AnalyticsEventNameEntry[];
}

const CohortBuilderDialog: React.FC<CohortBuilderDialogProps> = ({
  open,
  onClose,
  onSave,
  projectId,
  eventNames,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<ArgusCohortRule[]>([{ ...DEFAULT_RULE }]);
  const [combinator, setCombinator] = useState<'and' | 'or'>('and');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setRules([{ ...DEFAULT_RULE }]);
      setCombinator('and');
      setPreviewCount(null);
    }
  }, [open]);

  // Auto-preview with debounce
  useEffect(() => {
    if (!open) return;
    const validRules = rules.filter((r) => r.event);
    if (validRules.length === 0) {
      setPreviewCount(null);
      return;
    }

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const result = await previewCohort(projectId, {
          rules: validRules,
          combinator,
        });
        setPreviewCount(result.user_count);
      } catch {
        setPreviewCount(null);
      } finally {
        setPreviewing(false);
      }
    }, 500);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [open, rules, combinator, projectId]);

  const updateRule = (index: number, field: keyof ArgusCohortRule, value: any) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const addRule = () => setRules((prev) => [...prev, { ...DEFAULT_RULE }]);

  const removeRule = (index: number) => {
    if (rules.length <= 1) return;
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const validRules = rules.filter((r) => r.event);
    if (!name || validRules.length === 0) return;
    setSaving(true);
    try {
      await onSave({
        name,
        description: description || undefined,
        definition: { rules: validRules, combinator },
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{t('argus.cohorts.createCohort')}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Name & Description */}
          <TextField
            label={t('argus.cohorts.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
            required
            placeholder="e.g. Power Users"
          />
          <TextField
            label={t('argus.cohorts.descriptionOptional')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            size="small"
            multiline
            rows={2}
          />

          <Divider />

          {/* Rules */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography variant="subtitle2" fontWeight={700}>
                {t('argus.cohorts.rules')}
              </Typography>
              <ToggleButtonGroup
                value={combinator}
                exclusive
                onChange={(_, v) => v && setCombinator(v)}
                size="small"
                sx={{ ml: 'auto' }}
              >
                <ToggleButton value="and" sx={{ px: 2, py: 0.3, fontSize: 12 }}>
                  AND
                </ToggleButton>
                <ToggleButton value="or" sx={{ px: 2, py: 0.3, fontSize: 12 }}>
                  OR
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {rules.map((rule, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  mb: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {index > 0 && (
                  <Chip
                    label={combinator.toUpperCase()}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{
                      height: 22,
                      fontSize: 10,
                      fontWeight: 700,
                      position: 'absolute',
                      mt: -4.5,
                      ml: 2,
                    }}
                  />
                )}

                {/* Event selector */}
                <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
                  <InputLabel>{t('argus.cohorts.event')}</InputLabel>
                  <Select
                    value={rule.event}
                    label={t('argus.cohorts.event')}
                    onChange={(e) =>
                      updateRule(index, 'event', e.target.value)
                    }
                  >
                    {eventNames.map((en) => (
                      <MenuItem key={en.name} value={en.name}>
                        {en.display_name || en.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Operator */}
                <FormControl size="small" sx={{ minWidth: 70 }}>
                  <Select
                    value={rule.operator}
                    onChange={(e) =>
                      updateRule(index, 'operator', e.target.value)
                    }
                  >
                    {OPERATORS.map((op) => (
                      <MenuItem key={op.value} value={op.value}>
                        {op.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Count */}
                <TextField
                  type="number"
                  size="small"
                  value={rule.count}
                  onChange={(e) =>
                    updateRule(index, 'count', Math.max(0, parseInt(e.target.value) || 0))
                  }
                  sx={{ width: 80 }}
                  inputProps={{ min: 0 }}
                />

                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {t('argus.cohorts.timesIn')}
                </Typography>

                {/* Time range */}
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={rule.timeRange}
                    onChange={(e) =>
                      updateRule(index, 'timeRange', e.target.value)
                    }
                  >
                    {TIME_RANGES.map((tr) => (
                      <MenuItem key={tr.value} value={tr.value}>
                        {tr.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Delete rule */}
                <IconButton
                  size="small"
                  onClick={() => removeRule(index)}
                  disabled={rules.length <= 1}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={addRule}
              sx={{ mt: 0.5 }}
            >
              {t('argus.cohorts.addRule')}
            </Button>
          </Box>

          <Divider />

          {/* Preview */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              p: 2,
              borderRadius: 2,
              bgcolor: isDark
                ? alpha(theme.palette.primary.main, 0.08)
                : alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}
          >
            <PeopleIcon color="primary" />
            <Typography variant="body2" fontWeight={600}>
              {t('argus.cohorts.matchingUsers')}
            </Typography>
            {previewing ? (
              <CircularProgress size={18} />
            ) : previewCount !== null ? (
              <Typography variant="h6" fontWeight={700} color="primary">
                {previewCount.toLocaleString()}
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {t('argus.cohorts.setRulesToPreview')}
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          {t('argus.cohorts.cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name || rules.every((r) => !r.event) || saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {t('argus.cohorts.createCohort')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusCohortPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');

  const [cohorts, setCohorts] = useState<ArgusCohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [eventNames, setEventNames] = useState<AnalyticsEventNameEntry[]>([]);

  const loadCohorts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCohorts(projectId);
      setCohorts(data);
    } catch {
      setCohorts([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCohorts();
    getAnalyticsEventNames(projectId).then(setEventNames).catch(() => {});
  }, [loadCohorts, projectId]);

  const handleCreate = async (data: {
    name: string;
    description?: string;
    definition: ArgusCohortDefinition;
  }) => {
    await createCohort(projectId, data);
    await loadCohorts();
  };

  const handleDelete = async (cohortId: number) => {
    await deleteCohort(projectId, cohortId);
    await loadCohorts();
  };

  const handleCompute = async (cohortId: number) => {
    await computeCohort(projectId, cohortId);
    await loadCohorts();
  };

  // Kebab menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCohortId, setMenuCohortId] = useState<number | null>(null);

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuCohortId(null);
  };

  return (
    <Box>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
                to: '/argus/analytics',
              },
              { label: t('argus.cohorts', 'Cohorts') },
            ]}
            size="title"
          />
        }
        subtitle={t(
          'argus.cohorts.subtitle',
          'Create behavioral segments to filter analysis by user groups'
        )}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            size="small"
          >
            {t('argus.cohorts.createCohort')}
          </Button>
        }
      />

      <PageContentLoader loading={loading && cohorts.length === 0}>
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            borderRadius: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.cohorts.name')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.cohorts.rules')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  {t('argus.cohorts.userCount')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.cohorts.lastComputed')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  {t('argus.kpiAlerts.actions')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : cohorts.map((cohort) => (
                    <TableRow key={cohort.id} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>
                            {cohort.name}
                          </Typography>
                          {cohort.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {cohort.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {cohort.definition.rules.map((rule, i) => (
                            <Chip
                              key={i}
                              label={`${rule.event} ${rule.operator} ${rule.count} (${rule.timeRange})`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 11, height: 22 }}
                            />
                          ))}
                          {cohort.definition.rules.length > 1 && (
                            <Chip
                              label={cohort.definition.combinator.toUpperCase()}
                              size="small"
                              color="primary"
                              sx={{ fontSize: 10, height: 20, fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700}>
                          {cohort.user_count.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize={13} color="text.secondary">
                          {cohort.last_computed
                            ? new Date(cohort.last_computed).toLocaleString()
                            : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setMenuAnchorEl(e.currentTarget);
                            setMenuCohortId(cohort.id);
                          }}
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
              {!loading && cohorts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CohortIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">{t('argus.cohorts.noCohorts')}</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </PageContentLoader>

      {/* Cohort Builder Dialog */}
      <CohortBuilderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleCreate}
        projectId={projectId}
        eventNames={eventNames}
      />

      {/* Kebab Menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={Boolean(menuAnchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            if (menuCohortId !== null) handleCompute(menuCohortId);
            handleMenuClose();
          }}
        >
          <ListItemIcon><RefreshIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('argus.cohorts.compute', 'Recompute')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuCohortId !== null) handleDelete(menuCohortId);
            handleMenuClose();
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>{t('argus.cohorts.delete', 'Delete')}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ArgusCohortPage;
