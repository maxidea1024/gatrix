/**
 * Shared component for rendering change item diffs.
 * Used in both the Submit form and the Change History tab to ensure a unified display.
 */
import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { useTranslation } from 'react-i18next';
import FeatureFlagDiffRenderer from './FeatureFlagDiffRenderer';
import {
  ConstraintDisplay,
  ConstraintValue,
} from '../../features/ConstraintDisplay';

// Shared table sx for bordered rounded tables
const BORDERED_TABLE_SX = {
  borderCollapse: 'separate' as const,
  borderSpacing: 0,
  borderRadius: 1,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  '& td, & th': {
    py: 0.75,
    px: 1.5,
    borderRight: '1px solid',
    borderBottom: '1px solid',
    borderColor: 'divider',
    '&:last-child': { borderRight: 'none' },
  },
  '& tr:last-child td': { borderBottom: 'none' },
};

// Fields to hide from diff display
const HIDDEN_FIELDS = [
  'updatedBy',
  'createdBy',
  'updatedAt',
  'createdAt',
  'id',
  'version',
  'environment',
];

// Fields that need special rendering (not plain text)
const CONSTRAINT_FIELDS = ['constraints'];

interface ChangeOp {
  field: string;
  oldValue: any;
  newValue: any;
  operation?: string;
}

interface ChangeItemData {
  table: string;
  targetId: string;
  operation: string;
  changes: ChangeOp[];
  afterData?: any;
  beforeDraftData?: any;
  displayName?: string;
}

interface ChangeItemDiffDisplayProps {
  item: ChangeItemData;
  envNameMap?: Map<string, string>;
  formatFieldName: (table: string, field: string) => string;
  formatValue: (value: any, fieldName?: string) => string;
}

/**
 * Render a constraints diff showing old vs new constraints.
 * Matches constraints by contextName to identify modifications vs additions/removals.
 */
const ConstraintsDiff: React.FC<{
  oldConstraints?: ConstraintValue[];
  newConstraints?: ConstraintValue[];
}> = ({ oldConstraints, newConstraints }) => {
  const { t } = useTranslation();

  const oldList = oldConstraints || [];
  const newList = newConstraints || [];

  // Full fingerprint for exact equality check
  const fingerprint = (c: ConstraintValue) =>
    `${c.contextName}::${c.operator}::${c.value ?? ''}::${(c.values || []).join(',')}::${c.caseInsensitive ?? ''}::${c.inverted ?? ''}`;

  type DiffRow =
    | { type: 'added'; constraint: ConstraintValue }
    | { type: 'removed'; constraint: ConstraintValue }
    | {
        type: 'modified';
        oldConstraint: ConstraintValue;
        newConstraint: ConstraintValue;
      };

  const rows: DiffRow[] = [];

  // Match old and new constraints by contextName
  const usedOldIndices = new Set<number>();
  const usedNewIndices = new Set<number>();

  // First pass: exact matches (unchanged) - skip them
  for (let ni = 0; ni < newList.length; ni++) {
    for (let oi = 0; oi < oldList.length; oi++) {
      if (usedOldIndices.has(oi) || usedNewIndices.has(ni)) continue;
      if (fingerprint(oldList[oi]) === fingerprint(newList[ni])) {
        usedOldIndices.add(oi);
        usedNewIndices.add(ni);
        break;
      }
    }
  }

  // Second pass: match remaining by contextName (these are modifications)
  for (let ni = 0; ni < newList.length; ni++) {
    if (usedNewIndices.has(ni)) continue;
    for (let oi = 0; oi < oldList.length; oi++) {
      if (usedOldIndices.has(oi)) continue;
      if (oldList[oi].contextName === newList[ni].contextName) {
        rows.push({
          type: 'modified',
          oldConstraint: oldList[oi],
          newConstraint: newList[ni],
        });
        usedOldIndices.add(oi);
        usedNewIndices.add(ni);
        break;
      }
    }
  }

  // Remaining old = removed
  for (let oi = 0; oi < oldList.length; oi++) {
    if (!usedOldIndices.has(oi)) {
      rows.push({ type: 'removed', constraint: oldList[oi] });
    }
  }

  // Remaining new = added
  for (let ni = 0; ni < newList.length; ni++) {
    if (!usedNewIndices.has(ni)) {
      rows.push({ type: 'added', constraint: newList[ni] });
    }
  }

  if (rows.length === 0) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontStyle: 'italic', py: 0.5 }}
      >
        {t('changeRequest.noChanges')}
      </Typography>
    );
  }

  const rowStyle = (type: 'added' | 'removed' | 'modified') => ({
    display: 'flex',
    alignItems: 'center',
    gap: 0.75,
    bgcolor:
      type === 'removed'
        ? 'rgba(211, 47, 47, 0.06)'
        : type === 'added'
          ? 'rgba(46, 125, 50, 0.06)'
          : 'rgba(255, 152, 0, 0.06)',
    borderRadius: 1,
    px: 1,
    py: 0.5,
    border: '1px solid',
    borderColor:
      type === 'removed'
        ? 'rgba(211, 47, 47, 0.15)'
        : type === 'added'
          ? 'rgba(46, 125, 50, 0.15)'
          : 'rgba(255, 152, 0, 0.15)',
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {rows.map((row, i) => {
        if (row.type === 'removed') {
          return (
            <Box key={`del-${i}`} sx={rowStyle('removed')}>
              <RemoveCircleOutlineIcon
                sx={{ fontSize: 14, color: 'error.main', flexShrink: 0 }}
              />
              <ConstraintDisplay constraint={row.constraint} compact noBorder />
            </Box>
          );
        }
        if (row.type === 'added') {
          return (
            <Box key={`add-${i}`} sx={rowStyle('added')}>
              <AddCircleOutlineIcon
                sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }}
              />
              <ConstraintDisplay constraint={row.constraint} compact noBorder />
            </Box>
          );
        }
        // Modified: show old → new
        return (
          <Box key={`mod-${i}`} sx={rowStyle('modified')}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                flex: 1,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  opacity: 0.7,
                }}
              >
                <RemoveCircleOutlineIcon
                  sx={{ fontSize: 12, color: 'error.main', flexShrink: 0 }}
                />
                <Box sx={{ textDecoration: 'line-through' }}>
                  <ConstraintDisplay
                    constraint={row.oldConstraint}
                    compact
                    noBorder
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <AddCircleOutlineIcon
                  sx={{ fontSize: 12, color: 'success.main', flexShrink: 0 }}
                />
                <ConstraintDisplay
                  constraint={row.newConstraint}
                  compact
                  noBorder
                />
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

const ChangeItemDiffDisplay: React.FC<ChangeItemDiffDisplayProps> = ({
  item,
  envNameMap,
  formatFieldName,
  formatValue,
}) => {
  const { t } = useTranslation();

  // Feature Flag: Use dedicated renderer
  if (
    item.table === 'g_feature_flags' &&
    item.afterData &&
    typeof item.afterData === 'object'
  ) {
    return (
      <FeatureFlagDiffRenderer
        draftData={item.afterData}
        beforeDraftData={item.beforeDraftData}
        envNameMap={envNameMap}
      />
    );
  }

  // DELETE operation
  if (item.operation === 'delete') {
    return (
      <Typography
        variant="body2"
        color="error"
        sx={{ textAlign: 'center', py: 2, fontStyle: 'italic' }}
      >
        {t('changeRequest.opDelete')}
      </Typography>
    );
  }

  // CREATE operation: Field | Value table
  if (item.operation === 'create' && item.changes.length > 0) {
    const filteredChanges = item.changes.filter(
      (c) => !HIDDEN_FIELDS.includes(c.field)
    );
    if (filteredChanges.length === 0) return null;

    return (
      <Table size="small" sx={BORDERED_TABLE_SX}>
        <TableBody>
          {filteredChanges.map((change, i) => (
            <TableRow key={i}>
              <TableCell
                sx={{
                  fontWeight: 600,
                  color: 'text.secondary',
                  width: '35%',
                  fontSize: '0.875rem',
                }}
              >
                {formatFieldName(item.table, change.field)}
              </TableCell>
              <TableCell
                sx={{
                  color: 'success.main',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}
              >
                {CONSTRAINT_FIELDS.includes(change.field) &&
                Array.isArray(change.newValue) ? (
                  <ConstraintsDiff newConstraints={change.newValue} />
                ) : (
                  formatValue(change.newValue, change.field)
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // UPDATE operation: SET/MOD/DEL chip list
  if (item.operation === 'update') {
    const filteredChanges = item.changes.filter(
      (c) =>
        !['updatedBy', 'createdBy', 'updatedAt', 'createdAt'].includes(c.field)
    );

    if (filteredChanges.length === 0) {
      return (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: 'center', py: 2 }}
        >
          {t('changeRequest.noChanges')}
        </Typography>
      );
    }

    return (
      <Table size="small" sx={BORDERED_TABLE_SX}>
        <TableBody>
          {filteredChanges.map((change, i) => (
            <TableRow key={i}>
              {/* Op chip */}
              <TableCell sx={{ width: 48, textAlign: 'center' }}>
                <Chip
                  label={
                    change.operation === 'added'
                      ? 'SET'
                      : change.operation === 'removed'
                        ? 'DEL'
                        : 'MOD'
                  }
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: 9,
                    fontWeight: 700,
                    minWidth: 36,
                    bgcolor:
                      change.operation === 'added'
                        ? 'success.main'
                        : change.operation === 'removed'
                          ? 'error.main'
                          : 'primary.main',
                    color: '#fff',
                  }}
                />
              </TableCell>
              {/* Field name */}
              <TableCell
                sx={{
                  fontWeight: 600,
                  color: 'text.secondary',
                  width: '30%',
                  fontSize: 12,
                  fontFamily: 'monospace',
                }}
              >
                {formatFieldName(item.table, change.field)}
              </TableCell>
              {/* Value change */}
              <TableCell sx={{ fontSize: 12, fontFamily: 'monospace' }}>
                {CONSTRAINT_FIELDS.includes(change.field) ? (
                  <ConstraintsDiff
                    oldConstraints={change.oldValue}
                    newConstraints={change.newValue}
                  />
                ) : change.operation === 'added' ? (
                  <Box
                    component="span"
                    sx={{ color: 'success.main', fontWeight: 500 }}
                  >
                    {formatValue(change.newValue, change.field)}
                  </Box>
                ) : change.operation === 'removed' ? (
                  <Box
                    component="span"
                    sx={{ color: 'error.main', textDecoration: 'line-through' }}
                  >
                    {formatValue(change.oldValue, change.field)}
                  </Box>
                ) : (
                  <>
                    <Box
                      component="span"
                      sx={{
                        color: 'error.main',
                        textDecoration: 'line-through',
                      }}
                    >
                      {formatValue(change.oldValue, change.field)}
                    </Box>
                    {' → '}
                    <Box
                      component="span"
                      sx={{ color: 'success.main', fontWeight: 500 }}
                    >
                      {formatValue(change.newValue, change.field)}
                    </Box>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return null;
};

export default ChangeItemDiffDisplay;
