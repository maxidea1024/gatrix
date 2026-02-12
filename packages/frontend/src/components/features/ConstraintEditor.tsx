/**
 * ConstraintEditor Component
 *
 * Unleash-style constraint editor for feature flag segments.
 * Allows creating conditions like:
 * - userId IN ['user1', 'user2']
 * - version >= 2.0.0
 * - country NOT_IN ['CN', 'KR']
 */
import React from 'react';
import {
  Box,
  Card,
  IconButton,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Chip,
  Autocomplete,
  Tooltip,
  FormHelperText,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator,
  TextFields as TextFieldsIcon,
  PriorityHigh as InvertIcon,
  HelpOutline as MissingIcon,
} from '@mui/icons-material';
import FieldTypeIcon from '../common/FieldTypeIcon';
import OperatorIcon from '../common/OperatorIcon';
import { useTranslation } from 'react-i18next';
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
import LocalizedDateTimePicker from '@/components/common/LocalizedDateTimePicker';
import CountrySelect from '@/components/common/CountrySelect';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// Constraint types matching backend FeatureFlag.ts
export interface Constraint {
  contextName: string;
  operator: ConstraintOperator;
  value?: string;
  values?: string[];
  inverted?: boolean;
  caseInsensitive?: boolean;
}

export type ConstraintOperator =
  // String operators (use inverted flag for negation)
  | 'str_eq'
  | 'str_contains'
  | 'str_starts_with'
  | 'str_ends_with'
  | 'str_in'
  | 'str_regex'
  // Number operators
  | 'num_eq'
  | 'num_gt'
  | 'num_gte'
  | 'num_lt'
  | 'num_lte'
  | 'num_in'
  // Boolean operators
  | 'bool_is'
  // Date operators
  | 'date_eq'
  | 'date_gt'
  | 'date_gte'
  | 'date_lt'
  | 'date_lte'
  // Semver operators
  | 'semver_eq'
  | 'semver_gt'
  | 'semver_gte'
  | 'semver_lt'
  | 'semver_lte'
  | 'semver_in'
  // Common operators (type-agnostic)
  | 'exists'
  | 'not_exists'
  // Array operators
  | 'arr_any'
  | 'arr_all'
  | 'arr_empty';

export interface ContextField {
  fieldName: string;
  displayName: string;
  description?: string;
  fieldType: 'string' | 'number' | 'boolean' | 'date' | 'semver' | 'array' | 'country';
  legalValues?: string[];
}

interface ConstraintEditorProps {
  constraints: Constraint[];
  onChange: (constraints: Constraint[]) => void;
  contextFields: ContextField[];
  disabled?: boolean;
}

// Common operators available for all field types
const COMMON_OPERATORS = [
  { value: 'exists', label: 'has a value' },
  { value: 'not_exists', label: 'has no value' },
];

// Operator options grouped by type
const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: 'str_eq', label: 'equals' },
    { value: 'str_contains', label: 'contains' },
    { value: 'str_starts_with', label: 'starts with' },
    { value: 'str_ends_with', label: 'ends with' },
    { value: 'str_in', label: 'in list' },
    { value: 'str_regex', label: 'matches regex' },
    ...COMMON_OPERATORS,
  ],
  number: [
    { value: 'num_eq', label: '=' },
    { value: 'num_gt', label: '>' },
    { value: 'num_gte', label: '>=' },
    { value: 'num_lt', label: '<' },
    { value: 'num_lte', label: '<=' },
    { value: 'num_in', label: 'in list' },
    ...COMMON_OPERATORS,
  ],
  boolean: [{ value: 'bool_is', label: 'is' }, ...COMMON_OPERATORS],
  date: [
    { value: 'date_eq', label: 'equals' },
    { value: 'date_gt', label: 'after' },
    { value: 'date_gte', label: 'on or after' },
    { value: 'date_lt', label: 'before' },
    { value: 'date_lte', label: 'on or before' },
    ...COMMON_OPERATORS,
  ],
  semver: [
    { value: 'semver_eq', label: '=' },
    { value: 'semver_gt', label: '>' },
    { value: 'semver_gte', label: '>=' },
    { value: 'semver_lt', label: '<' },
    { value: 'semver_lte', label: '<=' },
    { value: 'semver_in', label: 'in list' },
    ...COMMON_OPERATORS,
  ],
  array: [
    { value: 'arr_any', label: 'includes' },
    { value: 'arr_all', label: 'includes all' },
    { value: 'arr_empty', label: 'is empty' },
    ...COMMON_OPERATORS,
  ],
  country: [
    { value: 'str_eq', label: 'equals' },
    { value: 'str_in', label: 'in list' },
    ...COMMON_OPERATORS,
  ],
};

// Inverted operator labels (shown when constraint.inverted is true)
const INVERTED_OPERATOR_LABELS: Record<string, string> = {
  str_eq: 'does not equal',
  str_contains: 'does not contain',
  str_starts_with: 'does not start with',
  str_ends_with: 'does not end with',
  str_in: 'not in list',
  str_regex: 'does not match regex',
  num_eq: '≠',
  num_gt: '≤',
  num_gte: '<',
  num_lt: '≥',
  num_lte: '>',
  num_in: 'not in list',
  bool_is: 'is not',
  date_eq: 'does not equal',
  date_gt: 'on or before',
  date_gte: 'before',
  date_lt: 'on or after',
  date_lte: 'after',
  semver_eq: '≠',
  semver_gt: '≤',
  semver_gte: '<',
  semver_lt: '≥',
  semver_lte: '>',
  semver_in: 'not in list',
  arr_any: 'does not include',
  arr_all: 'does not include all',
  arr_empty: 'is not empty',
  exists: 'has no value',
  not_exists: 'has a value',
};

// Get operator label based on inverted state
const getOperatorLabel = (
  operator: string,
  inverted: boolean,
  operators: { value: string; label: string }[]
): string => {
  if (inverted && INVERTED_OPERATOR_LABELS[operator]) {
    return INVERTED_OPERATOR_LABELS[operator];
  }
  return operators.find((op) => op.value === operator)?.label || operator;
};

// Check if operator expects multiple values
const isMultiValueOperator = (operator: ConstraintOperator): boolean => {
  return (
    operator === 'str_in' ||
    operator === 'num_in' ||
    operator === 'semver_in' ||
    operator === 'arr_any' ||
    operator === 'arr_all'
  );
};

// Check if operator requires no value input
const isValuelessOperator = (operator: ConstraintOperator): boolean => {
  return operator === 'exists' || operator === 'not_exists' || operator === 'arr_empty';
};

// Sortable constraint card component
interface SortableConstraintCardProps {
  id: string;
  constraint: Constraint;
  index: number;
  validOperator: string;
  operators: { value: string; label: string }[];
  usedFieldNames: string[];
  isFieldEmpty: boolean;
  isValueEmpty: boolean;
  disabled: boolean;
  contextFields: ContextField[];
  showDragHandle: boolean;
  t: (key: string, fallback?: string) => string;
  handleConstraintChange: (index: number, field: keyof Constraint, value: any) => void;
  handleRemoveConstraint: (index: number) => void;
  renderValueInput: (constraint: Constraint, index: number) => React.ReactNode;
}

const SortableConstraintCard: React.FC<SortableConstraintCardProps> = ({
  id,
  constraint,
  index,
  validOperator,
  operators,
  usedFieldNames,
  isFieldEmpty,
  isValueEmpty,
  disabled,
  contextFields,
  showDragHandle,
  t,
  handleConstraintChange,
  handleRemoveConstraint,
  renderValueInput,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} variant="outlined" sx={{ p: 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {/* Drag Handle - only show when there are 2+ constraints */}
        {showDragHandle && (
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: disabled ? 'default' : 'grab',
              display: 'flex',
              alignItems: 'center',
              color: 'text.secondary',
              mt: 1,
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicator />
          </Box>
        )}

        {/* Context Field Selector */}
        <FormControl size="small" sx={{ minWidth: 150, flex: '1 1 150px' }} error={isFieldEmpty}>
          <Select
            value={constraint.contextName}
            onChange={(e) => handleConstraintChange(index, 'contextName', e.target.value)}
            displayEmpty
            disabled={disabled}
            renderValue={(selected) => {
              if (!selected) {
                return <em style={{ color: 'gray' }}>{t('featureFlags.selectContextField')}</em>;
              }
              const selectedField = contextFields.find((f) => f.fieldName === selected);
              // Show missing icon for deleted/unknown fields
              if (!selectedField) {
                return (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title={t('featureFlags.missingContextField')} disableFocusListener>
                      <MissingIcon sx={{ fontSize: 16, color: 'error.main', mr: 1 }} />
                    </Tooltip>
                    <Typography sx={{ color: 'error.main' }}>{selected}</Typography>
                  </Box>
                );
              }
              return (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FieldTypeIcon type={selectedField.fieldType} size={16} sx={{ mr: 1 }} />
                  {selectedField.displayName || selectedField.fieldName}
                </Box>
              );
            }}
          >
            <MenuItem value="" disabled>
              <em>{t('featureFlags.selectContextField')}</em>
            </MenuItem>
            {contextFields.map((field) => {
              const isUsed = usedFieldNames.includes(field.fieldName);
              return (
                <MenuItem
                  key={field.fieldName}
                  value={field.fieldName}
                  disabled={isUsed}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    alignItems: 'flex-start',
                    py: 1,
                  }}
                >
                  <Tooltip title={field.fieldType} disableFocusListener>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                      <FieldTypeIcon type={field.fieldType} size={16} />
                    </Box>
                  </Tooltip>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2">
                      {field.displayName || field.fieldName}
                      {isUsed && ` (${t('featureFlags.alreadyUsed')})`}
                    </Typography>
                    {field.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {field.description}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
          {isFieldEmpty && <FormHelperText>{t('featureFlags.fieldRequired')}</FormHelperText>}
        </FormControl>

        {/* Inverted (!) - placed before operator for natural reading order */}
        <Tooltip title={t('featureFlags.invertedHelp')} disableFocusListener>
          <span>
            <IconButton
              size="small"
              onClick={() => handleConstraintChange(index, 'inverted', !constraint.inverted)}
              disabled={disabled}
              sx={{
                width: 32,
                height: 32,
                color: constraint.inverted ? 'warning.main' : 'text.disabled',
                bgcolor: constraint.inverted ? 'action.selected' : 'transparent',
                '&:hover': {
                  bgcolor: 'action.hover',
                },
              }}
            >
              <InvertIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* Operator Selector */}
        <FormControl size="small" sx={{ minWidth: 130, flex: '1 1 130px' }}>
          <Select
            value={validOperator}
            onChange={(e) => handleConstraintChange(index, 'operator', e.target.value)}
            disabled={disabled}
            renderValue={(selected) => {
              const label = getOperatorLabel(
                selected as string,
                constraint.inverted || false,
                operators
              );
              return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <OperatorIcon
                    operator={selected as string}
                    inverted={constraint.inverted}
                    size={16}
                    showTooltip={false}
                  />
                  {constraint.inverted && (
                    <Typography component="span" sx={{ color: 'warning.main', fontWeight: 600 }}>
                      NOT
                    </Typography>
                  )}
                  <Typography component="span">
                    {t(
                      `featureFlags.operators.${selected}${constraint.inverted ? '_inverted' : ''}`,
                      label
                    )}
                  </Typography>
                </Box>
              );
            }}
          >
            {operators.map((op) => (
              <MenuItem
                key={op.value}
                value={op.value}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <OperatorIcon operator={op.value} size={16} showTooltip={false} />
                {t(`featureFlags.operators.${op.value}`, op.label)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Value Input */}
        <Box sx={{ flex: '2 1 200px', minWidth: 150 }}>
          {renderValueInput(constraint, index)}
          {!isFieldEmpty && isValueEmpty && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {t('featureFlags.valueRequired')}
            </Typography>
          )}
        </Box>

        {/* Constraint Options & Delete */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          {/* Case Insensitive - always show but disable for non-string operators */}
          <Tooltip title={t('featureFlags.caseInsensitiveHelp')} disableFocusListener>
            <span>
              <IconButton
                size="small"
                onClick={() =>
                  handleConstraintChange(index, 'caseInsensitive', !constraint.caseInsensitive)
                }
                disabled={disabled || !validOperator.startsWith('str_')}
                sx={{
                  width: 32,
                  height: 32,
                  color: constraint.caseInsensitive ? 'primary.main' : 'text.disabled',
                  bgcolor: constraint.caseInsensitive ? 'action.selected' : 'transparent',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <TextFieldsIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {/* Delete Button */}
          <Tooltip title={t('common.delete')} disableFocusListener>
            <span>
              <IconButton
                size="small"
                onClick={() => handleRemoveConstraint(index)}
                disabled={disabled}
                sx={{
                  width: 32,
                  height: 32,
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'error.main',
                  },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>
    </Card>
  );
};

export const ConstraintEditor: React.FC<ConstraintEditorProps> = ({
  constraints,
  onChange,
  contextFields,
  disabled = false,
}) => {
  const { t } = useTranslation();

  // Generate unique IDs for constraints - regenerate when constraints length changes
  const constraintIds = React.useMemo(
    () => constraints.map((_, index) => `constraint-${index}`),
    [constraints]
  );

  // Only show drag handles when there are 2+ constraints
  const shouldShowDragHandle = constraints.length > 1;
  // Drag and drop sensors (vertical only)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = constraintIds.indexOf(active.id as string);
      const newIndex = constraintIds.indexOf(over.id as string);
      const newConstraints = arrayMove([...constraints], oldIndex, newIndex);
      onChange(newConstraints);
    }
  };

  const getFieldType = (contextName: string): string => {
    const field = contextFields.find((f) => f.fieldName === contextName);
    return field?.fieldType || 'string';
  };

  const getOperatorsForField = (contextName: string) => {
    const fieldType = getFieldType(contextName);
    return OPERATORS_BY_TYPE[fieldType] || OPERATORS_BY_TYPE.string;
  };

  const getLegalValues = (contextName: string): string[] => {
    const field = contextFields.find((f) => f.fieldName === contextName);
    return field?.legalValues || [];
  };

  // Get list of already used field names (for duplicate prevention)
  const getUsedFieldNames = (excludeIndex: number): string[] => {
    return constraints
      .filter((_, idx) => idx !== excludeIndex)
      .map((c) => c.contextName)
      .filter((name) => name); // Filter out empty names
  };

  // Get valid operator value - ensure operator is in the list for current field type
  const getValidOperator = (contextName: string, currentOperator: ConstraintOperator): string => {
    const operators = getOperatorsForField(contextName);
    const isValid = operators.some((op) => op.value === currentOperator);
    return isValid ? currentOperator : operators[0]?.value || 'str_eq';
  };

  const handleAddConstraint = () => {
    // Don't auto-select context field - user should explicitly choose
    const defaultOperators = OPERATORS_BY_TYPE.string;

    onChange([
      ...constraints,
      {
        contextName: '', // Empty - user must select
        operator: defaultOperators[0].value as ConstraintOperator,
        value: '',
        values: [],
        caseInsensitive: true, // Default to case insensitive
      },
    ]);
  };

  const handleRemoveConstraint = (index: number) => {
    const newConstraints = [...constraints];
    newConstraints.splice(index, 1);
    onChange(newConstraints);
  };

  const handleConstraintChange = (index: number, field: keyof Constraint, value: any) => {
    const newConstraints = [...constraints];
    const constraint = { ...newConstraints[index] };

    if (field === 'contextName') {
      // When context field changes, reset operator to first valid one for the new type
      const newField = contextFields.find((f) => f.fieldName === value);
      const newType = newField?.fieldType || 'string';
      const newOperators = OPERATORS_BY_TYPE[newType] || OPERATORS_BY_TYPE.string;
      constraint.contextName = value;
      constraint.operator = newOperators[0].value as ConstraintOperator;
      constraint.value = '';
      constraint.values = [];
    } else if (field === 'operator') {
      constraint.operator = value as ConstraintOperator;
      // Clear values for valueless operators (exists, not_exists, arr_empty)
      if (isValuelessOperator(value)) {
        constraint.value = undefined;
        constraint.values = undefined;
      } else if (isMultiValueOperator(value)) {
        // Reset values when switching between single/multi value operators
        constraint.value = undefined;
        constraint.values = constraint.values || [];
      } else {
        constraint.values = undefined;
        constraint.value = constraint.value || '';
      }
    } else {
      (constraint as any)[field] = value;
    }

    newConstraints[index] = constraint;
    onChange(newConstraints);
  };

  const renderValueInput = (constraint: Constraint, index: number) => {
    // Valueless operators (exists, not_exists, arr_empty) - no input needed
    if (isValuelessOperator(constraint.operator)) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1, fontStyle: 'italic' }}>
          {t('featureFlags.noValueRequired')}
        </Typography>
      );
    }

    const fieldType = getFieldType(constraint.contextName);
    const legalValues = getLegalValues(constraint.contextName);
    const isMultiValue = isMultiValueOperator(constraint.operator);

    // Boolean type - simple toggle
    if (fieldType === 'boolean') {
      return (
        <FormControl fullWidth size="small">
          <Select
            value={constraint.value || 'true'}
            onChange={(e) => handleConstraintChange(index, 'value', e.target.value)}
            displayEmpty
            disabled={disabled}
          >
            <MenuItem value="true">True</MenuItem>
            <MenuItem value="false">False</MenuItem>
          </Select>
        </FormControl>
      );
    }

    // Country type - use CountrySelect component
    if (fieldType === 'country') {
      if (isMultiValue) {
        return (
          <CountrySelect
            multiple
            value={constraint.values || []}
            onChange={(newValue) => handleConstraintChange(index, 'values', newValue || [])}
            placeholder={t('featureFlags.selectValues')}
            disabled={disabled}
            size="small"
          />
        );
      }
      return (
        <CountrySelect
          value={constraint.value || null}
          onChange={(newValue) => handleConstraintChange(index, 'value', newValue || '')}
          placeholder={t('featureFlags.selectValue')}
          disabled={disabled}
          size="small"
        />
      );
    }

    // Multi-value operators (IN, NOT_IN)
    if (isMultiValue) {
      if (legalValues.length > 0) {
        // Use autocomplete with predefined values only (no freeSolo)
        return (
          <Autocomplete
            multiple
            options={legalValues}
            value={constraint.values || []}
            onChange={(_, newValue) => handleConstraintChange(index, 'values', newValue)}
            renderTags={(value, getTagProps) =>
              value.map((option, idx) => (
                <Chip size="small" label={option} {...getTagProps({ index: idx })} key={idx} />
              ))
            }
            renderInput={(params) => (
              <TextField {...params} size="small" placeholder={t('featureFlags.selectValues')} />
            )}
            disabled={disabled}
          />
        );
      }
      // Free text input for multiple values (no legalValues defined)
      return (
        <Autocomplete
          multiple
          freeSolo
          options={[]}
          value={constraint.values || []}
          onChange={(_, newValue) => handleConstraintChange(index, 'values', newValue)}
          renderTags={(value, getTagProps) =>
            value.map((option, idx) => (
              <Chip size="small" label={option} {...getTagProps({ index: idx })} key={idx} />
            ))
          }
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder={t('featureFlags.typeAndPressEnter')} />
          )}
          disabled={disabled}
        />
      );
    }

    // Single value with legal values - use Select dropdown
    if (legalValues.length > 0) {
      return (
        <FormControl fullWidth size="small">
          <Select
            value={constraint.value || ''}
            onChange={(e) => handleConstraintChange(index, 'value', e.target.value)}
            displayEmpty
            disabled={disabled}
          >
            <MenuItem value="" disabled>
              <em>{t('featureFlags.selectValue')}</em>
            </MenuItem>
            {legalValues.map((v) => (
              <MenuItem key={v} value={v}>
                {v}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    // Date input
    if (fieldType === 'date') {
      return (
        <LocalizedDateTimePicker
          value={constraint.value || null}
          onChange={(isoString: string) => {
            // LocalizedDateTimePicker already returns UTC ISO string
            handleConstraintChange(index, 'value', isoString);
          }}
          disabled={disabled}
        />
      );
    }

    // Number input
    if (fieldType === 'number') {
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          placeholder="0"
          value={constraint.value || ''}
          onChange={(e) => handleConstraintChange(index, 'value', e.target.value)}
          disabled={disabled}
        />
      );
    }

    // Default text input
    return (
      <TextField
        fullWidth
        size="small"
        placeholder={fieldType === 'semver' ? 'e.g., 1.0.0' : t('featureFlags.enterValue')}
        value={constraint.value || ''}
        onChange={(e) => handleConstraintChange(index, 'value', e.target.value)}
        disabled={disabled}
      />
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {t('featureFlags.constraintsList')}
        </Typography>
      </Box>

      {constraints.length === 0 ? (
        <EmptyPlaceholder
          message={t('featureFlags.noConstraints')}
          description={t('featureFlags.noConstraintsGuide')}
          onAddClick={disabled ? undefined : handleAddConstraint}
          addButtonLabel={t('featureFlags.addFirstConstraint')}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext items={constraintIds} strategy={verticalListSortingStrategy}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {constraints.map((constraint, index) => {
                // Get valid operator for current field type
                const validOperator = getValidOperator(constraint.contextName, constraint.operator);
                const operators = getOperatorsForField(constraint.contextName);
                const usedFieldNames = getUsedFieldNames(index);
                const isFieldEmpty = !constraint.contextName;
                const isValueEmpty = isValuelessOperator(constraint.operator)
                  ? false
                  : isMultiValueOperator(constraint.operator)
                    ? !constraint.values?.length
                    : !constraint.value;

                return (
                  <React.Fragment key={constraintIds[index]}>
                    {/* AND chip between constraints */}
                    {index > 0 && (
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'center',
                          py: 0.5,
                        }}
                      >
                        <Chip
                          label="AND"
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            bgcolor: 'action.selected',
                          }}
                        />
                      </Box>
                    )}
                    <SortableConstraintCard
                      id={constraintIds[index]}
                      constraint={constraint}
                      index={index}
                      validOperator={validOperator}
                      operators={operators}
                      usedFieldNames={usedFieldNames}
                      isFieldEmpty={isFieldEmpty}
                      isValueEmpty={isValueEmpty}
                      disabled={disabled}
                      contextFields={contextFields}
                      showDragHandle={shouldShowDragHandle}
                      t={t}
                      handleConstraintChange={handleConstraintChange}
                      handleRemoveConstraint={handleRemoveConstraint}
                      renderValueInput={renderValueInput}
                    />
                  </React.Fragment>
                );
              })}
            </Box>
          </SortableContext>
        </DndContext>
      )}
      {!disabled && constraints.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddConstraint}
            sx={{ fontWeight: 600 }}
          >
            {t('featureFlags.addConstraint')}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ConstraintEditor;
