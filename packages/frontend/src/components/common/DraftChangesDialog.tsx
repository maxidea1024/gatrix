/**
 * DraftChangesDialog
 *
 * Unified dialog for viewing draft changes.
 * Works for both list page (all drafts) and detail page (single target).
 * Dynamically compares ALL fields — only displays actual differences.
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  Paper,
  Link,
} from '@mui/material';
import {
  CheckCircleOutline as EnabledIcon,
  HighlightOff as DisabledIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import * as draftService from '../../services/draftService';

interface Environment {
  environmentId: string;
  displayName: string;
}

interface DraftChangesDialogProps {
  open: boolean;
  onClose: () => void;
  // Target types to show (e.g. ['feature_flag', 'segment'])
  targetTypes: string[];
  environments: Environment[];
  projectApiPath: string;
}

// Deep equality check
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a == b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(a[key], b[key]));
}

// Known field labels
const FIELD_LABELS: Record<string, string> = {
  isEnabled: 'draft.changes.envToggle',
  strategies: 'draft.changes.strategies',
  variants: 'draft.changes.variants',
  enabledValue: 'draft.changes.enabledValue',
  disabledValue: 'draft.changes.disabledValue',
  overrideEnabledValue: 'draft.changes.overrideEnabled',
  overrideDisabledValue: 'draft.changes.overrideDisabled',
  impressionDataEnabled: 'draft.changes.impressionData',
  _releaseFlowChanged: 'draft.changes.releaseFlow',
};

// Boolean fields
const BOOLEAN_FIELDS = new Set([
  'isEnabled',
  'overrideEnabledValue',
  'overrideDisabledValue',
  'impressionDataEnabled',
]);

// Marker fields (just show "changed")
const MARKER_FIELDS = new Set(['_releaseFlowChanged']);

// Toggle change - use active/inactive for isEnabled, enabled/disabled for others
const ToggleChange: React.FC<{
  label: string;
  fieldKey: string;
  oldVal: boolean;
  newVal: boolean;
  t: (key: string) => string;
}> = ({ label, fieldKey, oldVal, newVal, t }) => {
  const isToggle = fieldKey === 'isEnabled';
  const onLabel = isToggle ? t('draft.changes.active') : t('common.enabled');
  const offLabel = isToggle ? t('draft.changes.inactive') : t('common.disabled');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
      <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ minWidth: 120 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {oldVal ? (
          <Chip icon={<EnabledIcon sx={{ fontSize: 14 }} />} label={onLabel} size="small" color="success" variant="outlined" sx={{ height: 22 }} />
        ) : (
          <Chip icon={<DisabledIcon sx={{ fontSize: 14 }} />} label={offLabel} size="small" color="error" variant="outlined" sx={{ height: 22 }} />
        )}
        <ArrowIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        {newVal ? (
          <Chip icon={<EnabledIcon sx={{ fontSize: 14 }} />} label={onLabel} size="small" color="success" sx={{ height: 22 }} />
        ) : (
          <Chip icon={<DisabledIcon sx={{ fontSize: 14 }} />} label={offLabel} size="small" color="error" sx={{ height: 22 }} />
        )}
      </Box>
    </Box>
  );
};

// Value change
const ValueChange: React.FC<{
  label: string;
  oldVal: any;
  newVal: any;
}> = ({ label, oldVal, newVal }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, py: 0.5 }}>
    <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ minWidth: 120, flexShrink: 0 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'error.main', wordBreak: 'break-all' }}>
        {formatValue(oldVal)}
      </Typography>
      <ArrowIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500, wordBreak: 'break-all' }}>
        {formatValue(newVal)}
      </Typography>
    </Box>
  </Box>
);

function formatValue(val: any): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    const s = JSON.stringify(val);
    return s.length > 60 ? `${s.substring(0, 60)}...` : s;
  }
  const s = String(val);
  return s.length > 60 ? `${s.substring(0, 60)}...` : s;
}

// Strategy summary
const StrategySummary: React.FC<{
  label: string;
  oldStrategies: any[];
  newStrategies: any[];
  t: (key: string, fallback?: any) => string;
}> = ({ label, oldStrategies, newStrategies, t }) => (
  <Box sx={{ py: 0.5 }}>
    <Typography variant="body2" fontWeight={600} color="text.secondary" gutterBottom>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', gap: 3 }}>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="error.main" fontWeight={600}>{t('common.before')}</Typography>
        <StrategyList strategies={oldStrategies} t={t} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="success.main" fontWeight={600}>{t('common.after')}</Typography>
        <StrategyList strategies={newStrategies} t={t} />
      </Box>
    </Box>
  </Box>
);

const StrategyList: React.FC<{
  strategies: any[];
  t: (key: string, fallback?: any) => string;
}> = ({ strategies, t }) => {
  if (!strategies || strategies.length === 0) {
    return <Typography variant="body2" color="text.secondary" fontStyle="italic">{t('draft.changes.noStrategies')}</Typography>;
  }
  return (
    <Stack spacing={0.25}>
      {strategies.map((s: any, idx: number) => {
        const name = s.title || t(`featureFlags.strategies.${s.strategyName || s.name}.title`, s.strategyName || s.name || '');
        const rollout = s.parameters?.rollout;
        return (
          <Typography key={idx} variant="body2">
            {idx + 1}. {name}{rollout !== undefined ? ` (${rollout}%)` : ''}
          </Typography>
        );
      })}
    </Stack>
  );
};

// Build diff changes for one environment
function buildEnvChanges(
  draftEnv: Record<string, any>,
  pubEnv: Record<string, any>,
  t: (key: string, fallback?: any) => string
): React.ReactNode[] {
  const changes: React.ReactNode[] = [];
  const draftFields = typeof draftEnv === 'object' ? draftEnv : {};
  const pubFields = typeof pubEnv === 'object' ? (pubEnv || {}) : {};

  for (const [fieldKey, draftVal] of Object.entries(draftFields)) {
    const pubVal = pubFields[fieldKey];
    if (deepEqual(draftVal, pubVal)) continue;

    const fieldLabel = FIELD_LABELS[fieldKey]
      ? t(FIELD_LABELS[fieldKey])
      : fieldKey;

    if (MARKER_FIELDS.has(fieldKey)) {
      changes.push(
        <Box key={fieldKey} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ minWidth: 120 }}>
            {fieldLabel}
          </Typography>
          <Chip label={t('draft.changes.modified')} size="small" color="warning" sx={{ height: 22 }} />
        </Box>
      );
    } else if (BOOLEAN_FIELDS.has(fieldKey)) {
      changes.push(
        <ToggleChange key={fieldKey} label={fieldLabel} fieldKey={fieldKey} oldVal={pubVal ?? false} newVal={draftVal as boolean} t={t} />
      );
    } else if (fieldKey === 'strategies') {
      changes.push(
        <StrategySummary key={fieldKey} label={fieldLabel} oldStrategies={pubVal || []} newStrategies={(draftVal as any[]) || []} t={t} />
      );
    } else if (fieldKey === 'variants') {
      const oldCount = Array.isArray(pubVal) ? pubVal.length : 0;
      const newCount = Array.isArray(draftVal) ? (draftVal as any[]).length : 0;
      changes.push(
        <ValueChange key={fieldKey} label={fieldLabel} oldVal={`${oldCount}${t('draft.changes.countUnit')}`} newVal={`${newCount}${t('draft.changes.countUnit')}`} />
      );
    } else {
      changes.push(
        <ValueChange key={fieldKey} label={fieldLabel} oldVal={pubVal} newVal={draftVal} />
      );
    }
  }
  return changes;
}

interface TargetDiff {
  targetId: string;
  targetName: string;
  targetType: string;
  envDiffs: Array<{ envId: string; envName: string; changes: React.ReactNode[] }>;
}

// Build diffs for one draft target
function buildTargetDiff(
  targetId: string,
  targetName: string,
  draftData: any,
  publishedData: any,
  environments: Environment[],
  t: (key: string, fallback?: any) => string
): Omit<TargetDiff, 'targetType'> | null {
  const draft = draftData || {};
  const published = publishedData || {};
  const envDiffs: TargetDiff['envDiffs'] = [];

  for (const envId of Object.keys(draft)) {
    const draftEnv = draft[envId];
    const pubEnv = published[envId];
    if (!draftEnv || deepEqual(draftEnv, pubEnv)) continue;

    const changes = buildEnvChanges(draftEnv, pubEnv || {}, t);
    if (changes.length > 0) {
      const envName = envId === '_global'
        ? t('draft.changes.globalSettings')
        : environments.find((e) => e.environmentId === envId)?.displayName || envId;
      envDiffs.push({ envId, envName, changes });
    }
  }

  // Sort: _global first
  envDiffs.sort((a, b) => {
    if (a.envId === '_global') return -1;
    if (b.envId === '_global') return 1;
    return 0;
  });

  return envDiffs.length > 0 ? { targetId, targetName, envDiffs } : null;
}

const DraftChangesDialog: React.FC<DraftChangesDialogProps> = ({
  open,
  onClose,
  targetTypes,
  environments,
  projectApiPath,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetDiffs, setTargetDiffs] = useState<TargetDiff[]>([]);

  useEffect(() => {
    if (!open) return;

    const fetchAndDiff = async () => {
      setLoading(true);
      setError(null);
      try {
        const results: TargetDiff[] = [];
        for (const tt of targetTypes) {
          const drafts = await draftService.listDrafts(tt, projectApiPath);
          for (const draft of drafts) {
            const name = (draft as any).targetDisplayName || draft.targetId;
            // Segments have no env grouping — compare flat fields
            if (tt === 'segment') {
              const draftData = draft.draftData || {};
              const pubData = (draft as any).publishedData || {};
              const changes = buildEnvChanges(draftData, pubData, t);
              if (changes.length > 0) {
                results.push({
                  targetId: draft.targetId,
                  targetName: name,
                  targetType: tt,
                  envDiffs: [{ envId: '_direct', envName: t('segments.title'), changes }],
                });
              }
            } else {
              const diff = buildTargetDiff(
                draft.targetId,
                name,
                draft.draftData,
                (draft as any).publishedData,
                environments,
                t
              );
              if (diff) results.push({ ...diff, targetType: tt });
            }
          }
        }
        setTargetDiffs(results);
      } catch {
        setError(t('draft.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchAndDiff();
  }, [open, targetTypes, projectApiPath, t, environments]);

  // Count total changes
  const totalChanges = targetDiffs.reduce(
    (sum, td) => sum + td.envDiffs.reduce((s, ed) => s + ed.changes.length, 0),
    0
  );

  // Navigate to target detail page
  const handleTargetClick = (targetType: string, targetName: string) => {
    onClose();
    if (targetType === 'segment') {
      navigate('/segments');
    } else {
      navigate(`/feature-flags/${targetName}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('draft.changes.title')}
        {!loading && totalChanges > 0 && (
          <Chip label={`${totalChanges}`} size="small" color="primary" sx={{ ml: 1, height: 22 }} />
        )}
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {!loading && !error && (
          <>
            {targetDiffs.length === 0 ? (
              <Alert severity="info">{t('draft.changes.noChanges')}</Alert>
            ) : (
              <Stack spacing={2}>
                {targetDiffs.map(({ targetId: tid, targetName: tName, targetType: tType, envDiffs }) => (
                  <Paper key={`${tType}-${tid}`} variant="outlined" sx={{ p: 2 }}>
                    <Link
                      component="button"
                      variant="subtitle1"
                      fontWeight={700}
                      underline="hover"
                      onClick={() => handleTargetClick(tType, tName)}
                      sx={{ cursor: 'pointer', mb: 1, display: 'block', textAlign: 'left' }}
                    >
                      {tName}
                    </Link>
                    <Stack spacing={1.5}>
                      {envDiffs.map(({ envId, envName, changes }) => (
                        <Box key={envId}>
                          <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom>
                            {envName}
                          </Typography>
                          <Divider sx={{ mb: 1 }} />
                          <Stack spacing={0.5}>{changes}</Stack>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DraftChangesDialog;
