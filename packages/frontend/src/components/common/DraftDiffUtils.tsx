/**
 * DraftDiffUtils
 *
 * Shared diff-building utilities and display components used by
 * DraftChangesDialog and DraftConfirmDialog.
 */
import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import {
  CheckCircleOutline as EnabledIcon,
  HighlightOff as DisabledIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import * as draftService from '../../services/draftService';

export interface Environment {
  environmentId: string;
  displayName: string;
}

export interface TargetDiff {
  targetId: string;
  targetName: string;
  targetType: string;
  envDiffs: Array<{
    envId: string;
    envName: string;
    changes: React.ReactNode[];
  }>;
}

// Deep equality check
export function deepEqual(a: any, b: any): boolean {
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

// Toggle change component
export const ToggleChange: React.FC<{
  label: string;
  fieldKey: string;
  oldVal: boolean;
  newVal: boolean;
  t: (key: string) => string;
}> = ({ label, fieldKey, oldVal, newVal, t }) => {
  const isToggle = fieldKey === 'isEnabled';
  const onLabel = isToggle ? t('draft.changes.active') : t('common.enabled');
  const offLabel = isToggle
    ? t('draft.changes.inactive')
    : t('common.disabled');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography
        variant="body2"
        fontWeight={600}
        color="text.secondary"
        sx={{ minWidth: 120 }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {oldVal ? (
          <Chip
            icon={<EnabledIcon sx={{ fontSize: 14 }} />}
            label={onLabel}
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 22 }}
          />
        ) : (
          <Chip
            icon={<DisabledIcon sx={{ fontSize: 14 }} />}
            label={offLabel}
            size="small"
            color="error"
            variant="outlined"
            sx={{ height: 22 }}
          />
        )}
        <ArrowIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        {newVal ? (
          <Chip
            icon={<EnabledIcon sx={{ fontSize: 14 }} />}
            label={onLabel}
            size="small"
            color="success"
            sx={{ height: 22 }}
          />
        ) : (
          <Chip
            icon={<DisabledIcon sx={{ fontSize: 14 }} />}
            label={offLabel}
            size="small"
            color="error"
            sx={{ height: 22 }}
          />
        )}
      </Box>
    </Box>
  );
};

// Format value for display
export function formatValue(val: any): string {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    const s = JSON.stringify(val);
    return s.length > 60 ? `${s.substring(0, 60)}...` : s;
  }
  const s = String(val);
  return s.length > 60 ? `${s.substring(0, 60)}...` : s;
}

// Value change component
export const ValueChange: React.FC<{
  label: string;
  oldVal: any;
  newVal: any;
}> = ({ label, oldVal, newVal }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
    <Typography
      variant="body2"
      fontWeight={600}
      color="text.secondary"
      sx={{ minWidth: 120, flexShrink: 0 }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Typography
        variant="body2"
        sx={{
          textDecoration: 'line-through',
          color: 'error.main',
          wordBreak: 'break-all',
        }}
      >
        {formatValue(oldVal)}
      </Typography>
      <ArrowIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
      <Typography
        variant="body2"
        sx={{ color: 'success.main', fontWeight: 500, wordBreak: 'break-all' }}
      >
        {formatValue(newVal)}
      </Typography>
    </Box>
  </Box>
);

// Strategy list component
const StrategyList: React.FC<{
  strategies: any[];
  t: (key: string, fallback?: any) => string;
}> = ({ strategies, t }) => {
  if (!strategies || strategies.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" fontStyle="italic">
        {t('draft.changes.noStrategies')}
      </Typography>
    );
  }
  return (
    <Stack spacing={0.25}>
      {strategies.map((s: any, idx: number) => {
        const name =
          s.title ||
          t(
            `featureFlags.strategies.${s.strategyName || s.name}.title`,
            s.strategyName || s.name || ''
          );
        const rollout = s.parameters?.rollout;
        const isDisabled = s.disabled === true;
        return (
          <Typography
            key={idx}
            variant="body2"
            sx={{
              ...(isDisabled && {
                textDecoration: 'line-through',
                color: 'text.disabled',
              }),
            }}
          >
            {idx + 1}. {name}
            {rollout !== undefined ? ` (${rollout}%)` : ''}
            {isDisabled ? ` (${t('common.disabled')})` : ''}
          </Typography>
        );
      })}
    </Stack>
  );
};

// Strategy summary component
export const StrategySummary: React.FC<{
  label: string;
  oldStrategies: any[];
  newStrategies: any[];
  t: (key: string, fallback?: any) => string;
}> = ({ label, oldStrategies, newStrategies, t }) => {
  return (
    <Box>
      <Typography
        variant="body2"
        fontWeight={600}
        color="text.secondary"
        sx={{ mb: 0.5 }}
      >
        {label}
      </Typography>
      <Box sx={{ display: 'flex', gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="error.main" fontWeight={600}>
            {t('common.before')}
          </Typography>
          <StrategyList strategies={oldStrategies} t={t} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="success.main" fontWeight={600}>
            {t('common.after')}
          </Typography>
          <StrategyList strategies={newStrategies} t={t} />
        </Box>
      </Box>
    </Box>
  );
};

// Format a single variant for display
function formatVariant(v: any): string {
  const name = v.name || v.variantName || '—';
  const val =
    v.value !== undefined && v.value !== null && v.value !== ''
      ? formatValue(v.value)
      : null;
  const weight = v.weight !== undefined ? v.weight : null;
  let result = name;
  if (val !== null) result += ` = ${val}`;
  if (weight !== null) result += ` (${weight}%)`;
  return result;
}

// Variant diff component - shows only changed variants individually
const VariantSummary: React.FC<{
  label: string;
  oldVariants: any[];
  newVariants: any[];
  t: (key: string, fallback?: any) => string;
}> = ({ label, oldVariants, newVariants, t }) => {
  const oldArr = Array.isArray(oldVariants) ? oldVariants : [];
  const newArr = Array.isArray(newVariants) ? newVariants : [];

  // Build maps by name for matching
  const oldMap = new Map<string, any>();
  oldArr.forEach((v) => oldMap.set(v.name || v.variantName || '', v));
  const newMap = new Map<string, any>();
  newArr.forEach((v) => newMap.set(v.name || v.variantName || '', v));

  const diffs: React.ReactNode[] = [];

  // Removed variants
  oldArr.forEach((ov) => {
    const name = ov.name || ov.variantName || '';
    if (!newMap.has(name)) {
      diffs.push(
        <Box
          key={`del-${name}`}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <Chip
            label={t('common.delete')}
            size="small"
            color="error"
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
          <Typography
            variant="body2"
            sx={{ textDecoration: 'line-through', color: 'error.main' }}
          >
            {formatVariant(ov)}
          </Typography>
        </Box>
      );
    }
  });

  // Added variants
  newArr.forEach((nv) => {
    const name = nv.name || nv.variantName || '';
    if (!oldMap.has(name)) {
      diffs.push(
        <Box
          key={`add-${name}`}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <Chip
            label={t('common.add')}
            size="small"
            color="success"
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
          <Typography
            variant="body2"
            sx={{ color: 'success.main', fontWeight: 500 }}
          >
            {formatVariant(nv)}
          </Typography>
        </Box>
      );
    }
  });

  // Modified variants (same name, different content)
  newArr.forEach((nv) => {
    const name = nv.name || nv.variantName || '';
    const ov = oldMap.get(name);
    if (!ov) return;
    const normOld = normalizeForComparison(ov);
    const normNew = normalizeForComparison(nv);
    if (deepEqual(normOld, normNew)) return;

    // Build per-field diffs
    const fieldChanges: React.ReactNode[] = [];
    const oldVal =
      ov.value !== undefined && ov.value !== null ? formatValue(ov.value) : '—';
    const newVal =
      nv.value !== undefined && nv.value !== null ? formatValue(nv.value) : '—';
    if (oldVal !== newVal) {
      fieldChanges.push(
        <Typography key="val" variant="body2" component="span">
          {t('draft.changes.variants')}:{' '}
          <span
            style={{
              textDecoration: 'line-through',
              color: 'inherit',
              opacity: 0.6,
            }}
          >
            {oldVal}
          </span>
          {' → '}
          <strong>{newVal}</strong>
        </Typography>
      );
    }
    if (ov.weight !== nv.weight) {
      fieldChanges.push(
        <Typography key="wt" variant="body2" component="span">
          {t('common.weight')}:{' '}
          <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>
            {ov.weight}%
          </span>
          {' → '}
          <strong>{nv.weight}%</strong>
        </Typography>
      );
    }

    if (fieldChanges.length > 0) {
      diffs.push(
        <Box key={`mod-${name}`}>
          <Typography variant="body2" fontWeight={600}>
            {name}
          </Typography>
          <Stack spacing={0.25} sx={{ pl: 2 }}>
            {fieldChanges}
          </Stack>
        </Box>
      );
    }
  });

  if (diffs.length === 0) return null;

  return (
    <Box>
      <Typography
        variant="body2"
        fontWeight={600}
        color="text.secondary"
        sx={{ mb: 0.5 }}
      >
        {label}
      </Typography>
      <Stack spacing={0.25}>{diffs}</Stack>
    </Box>
  );
};

// Normalize strategy/variant objects for comparison
// Strips metadata fields and normalizes types so that
// structurally equivalent objects are considered equal.
function normalizeForComparison(val: any): any {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) return val.map(normalizeForComparison);
  if (typeof val === 'object') {
    const sorted: Record<string, any> = {};
    for (const k of Object.keys(val).sort()) {
      // Skip runtime-only / metadata fields
      if (
        ['id', 'createdAt', 'updatedAt', 'sortOrder', 'environment'].includes(k)
      )
        continue;
      sorted[k] = normalizeForComparison(val[k]);
    }
    return sorted;
  }
  // Normalize numeric strings to numbers for comparison
  if (typeof val === 'string' && val !== '' && !isNaN(Number(val))) {
    return Number(val);
  }
  return val;
}

// Array fields that need normalization before comparison
const ARRAY_FIELDS = new Set(['strategies', 'variants']);

// Build diff changes for one environment
export function buildEnvChanges(
  draftEnv: Record<string, any>,
  pubEnv: Record<string, any>,
  t: (key: string, fallback?: any) => string
): React.ReactNode[] {
  const draftFields = typeof draftEnv === 'object' ? draftEnv : {};
  const pubFields = typeof pubEnv === 'object' ? pubEnv || {} : {};

  // Define field groups for logical display
  const GROUPS: Array<{ key: string; fields: string[] }> = [
    { key: 'toggle', fields: ['isEnabled'] },
    {
      key: 'override',
      fields: ['overrideEnabledValue', 'overrideDisabledValue'],
    },
    { key: 'values', fields: ['enabledValue', 'disabledValue'] },
    { key: 'impression', fields: ['impressionDataEnabled'] },
    { key: 'strategies', fields: ['strategies'] },
    { key: 'variants', fields: ['variants'] },
    { key: 'release', fields: ['_releaseFlowChanged'] },
  ];

  // Collect other fields not in any group
  const knownFields = new Set(GROUPS.flatMap((g) => g.fields));
  const otherFields = Object.keys(draftFields).filter(
    (k) => !knownFields.has(k)
  );
  if (otherFields.length > 0) {
    GROUPS.push({ key: 'other', fields: otherFields });
  }

  const result: React.ReactNode[] = [];

  for (const group of GROUPS) {
    const groupChanges: React.ReactNode[] = [];

    for (const fieldKey of group.fields) {
      if (!(fieldKey in draftFields)) continue;
      const draftVal = draftFields[fieldKey];
      const pubVal = pubFields[fieldKey];

      // Normalize boolean/falsy values to avoid false diffs
      if (BOOLEAN_FIELDS.has(fieldKey)) {
        const normDraft = !!draftVal;
        const normPub = !!pubVal;
        if (normDraft === normPub) continue;
      } else if (ARRAY_FIELDS.has(fieldKey)) {
        const normDraft = normalizeForComparison(draftVal);
        const normPub = normalizeForComparison(pubVal);
        if (deepEqual(normDraft, normPub)) continue;
      } else {
        if (deepEqual(draftVal, pubVal)) continue;
      }

      const fieldLabel = FIELD_LABELS[fieldKey]
        ? t(FIELD_LABELS[fieldKey])
        : fieldKey;

      if (MARKER_FIELDS.has(fieldKey)) {
        groupChanges.push(
          <Box
            key={fieldKey}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}
          >
            <Typography
              variant="body2"
              fontWeight={600}
              color="text.secondary"
              sx={{ minWidth: 120 }}
            >
              {fieldLabel}
            </Typography>
            <Chip
              label={t('draft.changes.modified')}
              size="small"
              color="warning"
              sx={{ height: 22 }}
            />
          </Box>
        );
      } else if (BOOLEAN_FIELDS.has(fieldKey)) {
        groupChanges.push(
          <ToggleChange
            key={fieldKey}
            label={fieldLabel}
            fieldKey={fieldKey}
            oldVal={pubVal ?? false}
            newVal={draftVal as boolean}
            t={t}
          />
        );
      } else if (fieldKey === 'strategies') {
        groupChanges.push(
          <StrategySummary
            key={fieldKey}
            label={fieldLabel}
            oldStrategies={pubVal || []}
            newStrategies={(draftVal as any[]) || []}
            t={t}
          />
        );
      } else if (fieldKey === 'variants') {
        const variantNode = (
          <VariantSummary
            key={fieldKey}
            label={fieldLabel}
            oldVariants={pubVal || []}
            newVariants={(draftVal as any[]) || []}
            t={t}
          />
        );
        // VariantSummary returns null when no real diffs
        groupChanges.push(variantNode);
      } else {
        groupChanges.push(
          <ValueChange
            key={fieldKey}
            label={fieldLabel}
            oldVal={pubVal}
            newVal={draftVal}
          />
        );
      }
    }

    if (groupChanges.length > 0) {
      result.push(
        <Box
          key={group.key}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            px: 1.5,
            py: 1,
          }}
        >
          {groupChanges}
        </Box>
      );
    }
  }

  return result;
}

// Build diffs for one draft target
export function buildTargetDiff(
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
      const envName =
        envId === '_global'
          ? t('draft.changes.globalSettings')
          : environments.find((e) => e.environmentId === envId)?.displayName ||
            envId;
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

// Fetch and build all diffs for given target types
export async function fetchAllDiffs(
  targetTypes: string[],
  environments: Environment[],
  projectApiPath: string,
  t: (key: string, fallback?: any) => string
): Promise<TargetDiff[]> {
  const results: TargetDiff[] = [];
  // Auto-discard drafts that have no real changes
  for (const tt of targetTypes) {
    const drafts = await draftService.listDrafts(tt, projectApiPath);
    for (const draft of drafts) {
      const name = (draft as any).targetDisplayName || draft.targetId;
      if (tt === 'segment') {
        const dData = draft.draftData || {};
        const pubData = (draft as any).publishedData || {};
        const action = dData._action || 'update';

        if (action === 'create') {
          results.push({
            targetId: draft.targetId,
            targetName: dData.segmentName || name,
            targetType: tt,
            envDiffs: [
              {
                envId: '_create',
                envName: t('draft.changes.newSegment'),
                changes: [
                  <Chip
                    key="action"
                    label={t('draft.changes.newSegment')}
                    size="small"
                    color="success"
                    sx={{ height: 22 }}
                  />,
                ],
              },
            ],
          });
        } else if (action === 'delete') {
          results.push({
            targetId: draft.targetId,
            targetName: name,
            targetType: tt,
            envDiffs: [
              {
                envId: '_delete',
                envName: t('draft.changes.deleteSegment'),
                changes: [
                  <Chip
                    key="action"
                    label={t('draft.changes.deleteSegment')}
                    size="small"
                    color="error"
                    sx={{ height: 22 }}
                  />,
                ],
              },
            ],
          });
        } else {
          const changes = buildEnvChanges(dData, pubData, t);
          if (changes.length > 0) {
            results.push({
              targetId: draft.targetId,
              targetName: name,
              targetType: tt,
              envDiffs: [
                { envId: '_direct', envName: t('segments.title'), changes },
              ],
            });
          } else {
            // Auto-discard: no real changes in segment draft
            draftService
              .discardDraft(tt, draft.targetId, projectApiPath)
              .catch(() => {});
          }
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
        if (diff) {
          results.push({ ...diff, targetType: tt });
        } else {
          // Auto-discard: no real changes in feature flag draft
          draftService
            .discardDraft(tt, draft.targetId, projectApiPath)
            .catch(() => {});
        }
      }
    }
  }

  // Notify layout if any drafts were auto-discarded
  if (results.length === 0) {
    window.dispatchEvent(new Event('draft-changed'));
  }

  return results;
}
