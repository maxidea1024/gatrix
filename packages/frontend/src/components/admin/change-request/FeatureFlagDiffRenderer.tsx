/**
 * Feature Flag Diff Renderer
 *
 * Renders structured diff for Feature Flag draftData instead of raw JSON.
 * Compares draftData (new) vs beforeDraftData (current) per environment.
 */

import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Collapse,
  IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { useTranslation } from 'react-i18next';

interface FeatureFlagDiffRendererProps {
  draftData: Record<string, any>;
  beforeDraftData?: Record<string, any> | null;
  envNameMap: Map<string, string>;
}

interface VariantInfo {
  variantName: string;
  weight: number;
  value?: string;
  valueType?: string;
  stickiness?: string;
}

interface StrategyInfo {
  name?: string;
  strategyName?: string;
  parameters?: Record<string, any>;
  constraints?: any[];
  [key: string]: any;
}

// Fields that should be excluded from diff display
const METADATA_FIELDS = ['_flagName', '_timestamp'];
const SKIP_FIELDS = ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'environmentId', 'projectId'];
// Complex fields rendered by dedicated sub-components
const COMPLEX_FIELDS = ['variants', 'strategies'];

/**
 * Create a comparable fingerprint from a strategy using only semantic fields,
 * ignoring all DB metadata (id, timestamps, sortOrder, etc.)
 */
function strategyFingerprint(s: StrategyInfo): string {
  const name = s.name || s.strategyName || '';
  const params = s.parameters ? JSON.stringify(s.parameters, Object.keys(s.parameters).sort()) : '{}';
  return `${name}::${params}`;
}

/**
 * Compare two values, handling JSON deep comparison and null/false/0 equivalence
 */
function valuesEqual(a: any, b: any): boolean {
  if (a === b) return true;
  // Treat null/undefined/'' as equivalent
  if ((a === null || a === undefined || a === '') &&
      (b === null || b === undefined || b === '')) {
    return true;
  }
  // Treat empty array and null/undefined as equivalent
  if (Array.isArray(a) && a.length === 0 && (b === null || b === undefined)) return true;
  if (Array.isArray(b) && b.length === 0 && (a === null || a === undefined)) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Render a boolean/toggle value as a styled chip (ON / OFF)
 */
const BooleanChip: React.FC<{ value: boolean }> = ({ value }) => (
  <Chip
    label={value ? 'ON' : 'OFF'}
    size="small"
    sx={{
      height: 22,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.5px',
      bgcolor: value ? 'success.main' : 'action.disabledBackground',
      color: value ? '#fff' : 'text.secondary',
    }}
  />
);

/**
 * Render a single value in a readable format
 */
const ValueDisplay: React.FC<{ value: any }> = ({ value }) => {
  if (value === null || value === undefined) return <Typography variant="body2" color="text.disabled">-</Typography>;
  if (typeof value === 'boolean') {
    return <BooleanChip value={value} />;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{String(value)}</Typography>;
  }
  // Fallback for complex objects
  return <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{JSON.stringify(value)}</Typography>;
};

/**
 * Render a change arrow: oldValue → newValue
 */
const ChangeArrow: React.FC<{ oldValue: any; newValue: any }> = ({ oldValue, newValue }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
    <ValueDisplay value={oldValue} />
    <ArrowForwardIcon sx={{ fontSize: 16, color: 'warning.main', mx: 0.5 }} />
    <ValueDisplay value={newValue} />
  </Box>
);

/**
 * Render variant changes as a structured table
 */
const VariantsDiff: React.FC<{
  newVariants: VariantInfo[];
  oldVariants?: VariantInfo[];
}> = ({ newVariants, oldVariants }) => {
  const { t } = useTranslation();

  const oldMap = new Map<string, VariantInfo>();
  if (oldVariants) {
    oldVariants.forEach(v => oldMap.set(v.variantName, v));
  }

  const newMap = new Map<string, VariantInfo>();
  newVariants.forEach(v => newMap.set(v.variantName, v));

  // Find deleted variants (in old but not in new)
  const deletedVariants = oldVariants
    ? oldVariants.filter(v => !newMap.has(v.variantName))
    : [];

  if (newVariants.length === 0 && deletedVariants.length === 0) {
    return null;
  }

  return (
    <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', '& td, & th': { py: 0.25, px: 1, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderRight: 'none' } }, '& tr:last-child td': { borderBottom: 'none' } }}>
      <TableBody sx={{ '& td': { verticalAlign: 'middle' } }}>
        <TableRow sx={{ '& td': { fontWeight: 600, fontSize: 11, color: 'text.secondary' } }}>
          <TableCell sx={{ width: 140, maxWidth: 140 }}>{t('featureFlags.variantName', { defaultValue: 'Variant' })}</TableCell>
          <TableCell>{t('featureFlags.weight', { defaultValue: 'Weight' })}</TableCell>
          <TableCell>{t('featureFlags.value', { defaultValue: 'Value' })}</TableCell>
          <TableCell width={30}><SwapVertIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></TableCell>
        </TableRow>

        {/* Deleted variants */}
        {deletedVariants.map((v) => (
          <TableRow key={`del-${v.variantName}`} sx={{ bgcolor: 'rgba(211, 47, 47, 0.08)' }}>
            <TableCell>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, textDecoration: 'line-through', color: 'error.main', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {v.variantName}
              </Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'error.main' }}>{v.weight}</Typography>
            </TableCell>
            <TableCell>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, color: 'error.main' }}>{v.value ?? ''}</Typography>
            </TableCell>
            <TableCell>
              <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
            </TableCell>
          </TableRow>
        ))}

        {/* New and existing variants */}
        {newVariants.map((v) => {
          const old = oldMap.get(v.variantName);
          const weightChanged = old && old.weight !== v.weight;
          const valueChanged = old && !valuesEqual(old.value, v.value);
          const isNew = !old;

          return (
            <TableRow
              key={v.variantName}
              sx={{
                bgcolor: isNew
                  ? 'rgba(46, 125, 50, 0.08)'
                  : (weightChanged || valueChanged)
                    ? 'rgba(255, 152, 0, 0.08)'
                    : undefined,
              }}
            >
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.variantName}
                </Typography>
              </TableCell>
              <TableCell>
                {weightChanged ? (
                  <ChangeArrow oldValue={old.weight} newValue={v.weight} />
                ) : (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{v.weight}</Typography>
                )}
              </TableCell>
              <TableCell>
                {valueChanged ? (
                  <ChangeArrow oldValue={old.value} newValue={v.value} />
                ) : (
                  <ValueDisplay value={v.value ?? ''} />
                )}
              </TableCell>
              <TableCell>
                {isNew && <AddCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

/**
 * Render strategies diff as a structured table.
 * Matches strategies by name/type first, then shows parameter-level diffs.
 * Only truly new or deleted strategies are shown as added/removed.
 */
const StrategiesDiff: React.FC<{
  newStrategies: StrategyInfo[];
  oldStrategies?: StrategyInfo[];
}> = ({ newStrategies, oldStrategies }) => {
  const { t } = useTranslation();

  if (newStrategies.length === 0 && (!oldStrategies || oldStrategies.length === 0)) return null;

  const getStrategyName = (s: StrategyInfo) => s.name || s.strategyName || 'unknown';

  // Localize strategy name using existing i18n keys (fallback to raw name)
  const localizeStrategyName = (rawName: string) => {
    const key = `featureFlags.strategyTypes.${rawName}`;
    const localized = t(key, { defaultValue: '' });
    return localized || rawName;
  };

  // Build indexed lists by strategy name for matching
  const oldByName = new Map<string, StrategyInfo[]>();
  (oldStrategies || []).forEach(s => {
    const name = getStrategyName(s);
    if (!oldByName.has(name)) oldByName.set(name, []);
    oldByName.get(name)!.push(s);
  });

  const newByName = new Map<string, StrategyInfo[]>();
  newStrategies.forEach(s => {
    const name = getStrategyName(s);
    if (!newByName.has(name)) newByName.set(name, []);
    newByName.get(name)!.push(s);
  });

  type RowData =
    | { type: 'added'; strategy: StrategyInfo; key: string }
    | { type: 'removed'; strategy: StrategyInfo; key: string }
    | { type: 'modified'; strategy: StrategyInfo; oldStrategy: StrategyInfo; key: string };

  const rows: RowData[] = [];

  // Process all strategy names
  const allNames = new Set([...oldByName.keys(), ...newByName.keys()]);

  allNames.forEach(name => {
    const oldList = [...(oldByName.get(name) || [])];
    const newList = [...(newByName.get(name) || [])];

    // Match by exact fingerprint first (unchanged strategies)
    const unmatchedOld: StrategyInfo[] = [];
    const remainingNew = [...newList];

    oldList.forEach(oldS => {
      const oldFp = strategyFingerprint(oldS);
      const exactIdx = remainingNew.findIndex(n => strategyFingerprint(n) === oldFp);
      if (exactIdx >= 0) {
        remainingNew.splice(exactIdx, 1); // exact match, skip
      } else {
        unmatchedOld.push(oldS);
      }
    });

    // Pair remaining old with remaining new as modifications
    const pairCount = Math.min(unmatchedOld.length, remainingNew.length);
    for (let i = 0; i < pairCount; i++) {
      rows.push({
        type: 'modified',
        strategy: remainingNew[i],
        oldStrategy: unmatchedOld[i],
        key: `mod-${name}-${i}`,
      });
    }

    // Leftover old = removed
    for (let i = pairCount; i < unmatchedOld.length; i++) {
      rows.push({ type: 'removed', strategy: unmatchedOld[i], key: `del-${name}-${i}` });
    }

    // Leftover new = added
    for (let i = pairCount; i < remainingNew.length; i++) {
      rows.push({ type: 'added', strategy: remainingNew[i], key: `add-${name}-${i}` });
    }
  });

  if (rows.length === 0) return null;

  const INNER_TABLE_SX = {
    borderCollapse: 'separate' as const,
    borderSpacing: 0,
    borderRadius: 0.5,
    overflow: 'hidden',
    border: '1px solid',
    borderColor: 'divider',
    '& td': {
      py: 0.15, px: 0.75,
      borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider',
      '&:last-child': { borderRight: 'none' },
    },
    '& tr:last-child td': { borderBottom: 'none' },
  };

  // Render parameter table for a strategy (with optional diff highlighting)
  const renderParams = (params: [string, any][], oldParams?: Map<string, any>) => (
    <Table size="small" sx={INNER_TABLE_SX}>
      <TableBody>
        {params.map(([k, v]) => {
          const oldVal = oldParams?.get(k);
          const changed = oldParams !== undefined && oldVal !== undefined && String(oldVal) !== String(v);
          return (
            <TableRow key={k}>
              <TableCell sx={{ width: 100, maxWidth: 100 }}>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>{k}</Typography>
              </TableCell>
              <TableCell>
                {changed ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, color: 'error.main', textDecoration: 'line-through' }}>{String(oldVal)}</Typography>
                    <ArrowForwardIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11, color: 'success.main', fontWeight: 600 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Typography>
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Typography>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider', '& td, & th': { py: 0.25, px: 1, borderRight: '1px solid', borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderRight: 'none' } }, '& tr:last-child td': { borderBottom: 'none' } }}>
      <TableBody>
        <TableRow sx={{ '& td': { fontWeight: 600, fontSize: 11, color: 'text.secondary' } }}>
          <TableCell sx={{ width: 140, maxWidth: 140 }}>{t('featureFlags.strategy')}</TableCell>
          <TableCell>{t('featureFlags.parameters')}</TableCell>
          <TableCell width={30}><SwapVertIcon sx={{ fontSize: 14, color: 'text.disabled' }} /></TableCell>
        </TableRow>
        {rows.map((row) => {
          if (row.type === 'modified') {
            const name = getStrategyName(row.strategy);
            const newParams = row.strategy.parameters ? Object.entries(row.strategy.parameters) : [];
            const oldParamMap = new Map(Object.entries(row.oldStrategy.parameters || {}));
            return (
              <TableRow key={row.key} sx={{ bgcolor: 'rgba(255, 152, 0, 0.08)' }}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {localizeStrategyName(name)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {newParams.length > 0 ? renderParams(newParams, oldParamMap) : (
                    <Typography variant="body2" color="text.disabled" sx={{ fontSize: 11 }}>-</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label="MOD" size="small" sx={{ height: 18, fontSize: 9, fontWeight: 700, minWidth: 36, bgcolor: 'warning.main', color: '#fff' }} />
                </TableCell>
              </TableRow>
            );
          }

          const strategy = row.strategy;
          const name = getStrategyName(strategy);
          const params = strategy.parameters ? Object.entries(strategy.parameters) : [];
          const isAdded = row.type === 'added';

          return (
            <TableRow
              key={row.key}
              sx={{
                bgcolor: isAdded ? 'rgba(46, 125, 50, 0.08)' : 'rgba(211, 47, 47, 0.08)',
              }}
            >
              <TableCell>
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: isAdded ? 'text.primary' : 'error.main',
                    textDecoration: isAdded ? 'none' : 'line-through',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {localizeStrategyName(name)}
                </Typography>
              </TableCell>
              <TableCell>
                {params.length > 0 ? renderParams(params) : (
                  <Typography variant="body2" color="text.disabled" sx={{ fontSize: 11 }}>-</Typography>
                )}
              </TableCell>
              <TableCell>
                {isAdded
                  ? <AddCircleOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
                  : <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
                }
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

/**
 * Render a single environment's changes
 */
const EnvChanges: React.FC<{
  envName: string;
  envData: Record<string, any>;
  beforeEnvData?: Record<string, any> | null;
}> = ({ envName, envData, beforeEnvData }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(true);

  if (!envData || typeof envData !== 'object') return null;

  // Extract complex fields — only compare if the field actually exists in draftData
  // If a field is undefined in draftData, it means it wasn't changed (not submitted)
  const hasVariantsInDraft = 'variants' in envData;
  const hasStrategiesInDraft = 'strategies' in envData;
  const variants = hasVariantsInDraft ? (envData.variants || []) as VariantInfo[] : [];
  const beforeVariants = (beforeEnvData?.variants || []) as VariantInfo[];
  const strategies = hasStrategiesInDraft ? (envData.strategies || []) as StrategyInfo[] : [];
  const beforeStrategies = (beforeEnvData?.strategies || []) as StrategyInfo[];

  // Collect simple field changes (excluding complex fields handled separately)
  const fieldChanges: Array<{ field: string; oldValue: any; newValue: any; changed: boolean }> = [];
  const simpleFields = Object.keys(envData).filter(
    k => !COMPLEX_FIELDS.includes(k) && !METADATA_FIELDS.includes(k) && !SKIP_FIELDS.includes(k)
  );

  for (const field of simpleFields) {
    const newVal = envData[field];
    const oldVal = beforeEnvData?.[field];
    const changed = beforeEnvData ? !valuesEqual(oldVal, newVal) : false;
    fieldChanges.push({ field, oldValue: oldVal, newValue: newVal, changed });
  }

  // If beforeData exists, show only changed fields; otherwise show all fields
  const visibleFields = beforeEnvData
    ? fieldChanges.filter(f => f.changed)
    : fieldChanges;

  // Only compare variants/strategies if they were actually included in the draft
  const variantsChanged = hasVariantsInDraft && !valuesEqual(variants, beforeVariants);
  const strategiesChanged = hasStrategiesInDraft && !valuesEqual(strategies, beforeStrategies);

  const totalChanges = visibleFields.length
    + (variantsChanged ? 1 : 0)
    + (strategiesChanged ? 1 : 0);

  return (
    <Box sx={{ mb: 1 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          p: 0.5,
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <IconButton size="small" sx={{ p: 0 }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        <Chip
          label="MOD"
          size="small"
          color="warning"
          sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
        />
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 13 }}>
          {envName}
        </Typography>
        {totalChanges > 0 && (
          <Typography variant="caption" color="text.secondary">
            ({totalChanges} {t('changeRequest.changesCount', { defaultValue: 'changes' })})
          </Typography>
        )}
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ pl: 3, pt: 0.5 }}>
          {/* Simple field changes */}
          {visibleFields.map(({ field, oldValue, newValue, changed }) => (
            <Box key={field} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 100, color: 'text.secondary' }}>
                {field}
              </Typography>
              {changed && beforeEnvData ? (
                <ChangeArrow oldValue={oldValue} newValue={newValue} />
              ) : (
                <ValueDisplay value={newValue} />
              )}
            </Box>
          ))}

          {/* Variants */}
          {variantsChanged && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                {t('featureFlags.variants')}
              </Typography>
              {variants.length === 0 && beforeVariants.length > 0 ? (
                // All variants deleted
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25, ml: 1 }}>
                  <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
                  <Typography variant="body2" sx={{ fontSize: 12, color: 'error.main' }}>
                    {beforeVariants.length} {t('featureFlags.variants')} {t('changeRequest.removed')}
                  </Typography>
                </Box>
              ) : (
                <VariantsDiff newVariants={variants} oldVariants={beforeVariants} />
              )}
            </Box>
          )}

          {/* Strategies */}
          {strategiesChanged && (
            <Box sx={{ mt: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                {t('featureFlags.strategies')}
              </Typography>
              {strategies.length === 0 && beforeStrategies.length > 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.25, ml: 1 }}>
                  <RemoveCircleOutlineIcon sx={{ fontSize: 14, color: 'error.main' }} />
                  <Typography variant="body2" sx={{ fontSize: 12, color: 'error.main' }}>
                    {beforeStrategies.length} {t('featureFlags.strategies')} {t('changeRequest.removed')}
                  </Typography>
                </Box>
              ) : (
                <StrategiesDiff newStrategies={strategies} oldStrategies={beforeStrategies} />
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
};

/**
 * Main Feature Flag Diff Renderer
 *
 * Parses draftData by environment and renders structured diffs.
 * beforeDraftData is the entire flag object (single env), used directly as env-level comparison.
 */
const FeatureFlagDiffRenderer: React.FC<FeatureFlagDiffRendererProps> = ({
  draftData,
  beforeDraftData,
  envNameMap,
}) => {
  if (!draftData || typeof draftData !== 'object') return null;

  // Collect environment entries (keys that are not metadata)
  const envEntries = Object.entries(draftData).filter(
    ([key]) => !key.startsWith('_') && !METADATA_FIELDS.includes(key)
  );

  if (envEntries.length === 0) return null;

  return (
    <Box sx={{ width: '100%' }}>
      {envEntries.map(([envId, envData]) => {
        const envName = envNameMap.get(envId) || envId;
        // beforeDraftData may be keyed by envId (new) or a flat flag object (legacy)
        // Try envId key first, then check if it looks like a flat flag object
        let beforeEnvData: Record<string, any> | null = null;
        if (beforeDraftData && typeof beforeDraftData === 'object') {
          if (beforeDraftData[envId] && typeof beforeDraftData[envId] === 'object') {
            // New structure: { envId: { strategies, variants, isEnabled, ... } }
            beforeEnvData = beforeDraftData[envId] as Record<string, any>;
          } else if ('strategies' in beforeDraftData || 'variants' in beforeDraftData || 'isEnabled' in beforeDraftData) {
            // Legacy structure: flat flag object with strategies/variants directly
            beforeEnvData = beforeDraftData;
          }
        }

        return (
          <EnvChanges
            key={envId}
            envName={envName}
            envData={envData as Record<string, any>}
            beforeEnvData={beforeEnvData}
          />
        );
      })}
    </Box>
  );
};

export default FeatureFlagDiffRenderer;
