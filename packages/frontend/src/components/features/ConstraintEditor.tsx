/**
 * ConstraintEditor Component
 *
 * Unleash-style constraint editor for feature flag segments.
 * Allows creating conditions like:
 * - userId IN ['user1', 'user2']
 * - version >= 2.0.0
 * - country NOT_IN ['CN', 'KR']
 */
import React from "react";
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
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator,
  TextFields as TextFieldsIcon,
  PriorityHigh as InvertIcon,
  Abc as StringIcon,
  Numbers as NumberIcon,
  ToggleOn as BooleanIcon,
  Schedule as DateTimeIcon,
  LocalOffer as SemverIcon,
  HelpOutline as MissingIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import LocalizedDateTimePicker from "@/components/common/LocalizedDateTimePicker";

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
  // String operators
  | "str_eq"
  | "str_neq"
  | "str_contains"
  | "str_starts_with"
  | "str_ends_with"
  | "str_regex"
  // Number operators
  | "num_eq"
  | "num_gt"
  | "num_gte"
  | "num_lt"
  | "num_lte"
  | "num_in"
  | "num_not_in"
  // Boolean operators
  | "bool_is"
  // Date operators
  | "date_gt"
  | "date_gte"
  | "date_lt"
  | "date_lte"
  // Semver operators
  | "semver_eq"
  | "semver_gt"
  | "semver_gte"
  | "semver_lt"
  | "semver_lte"
  | "semver_in"
  | "semver_not_in";

export interface ContextField {
  fieldName: string;
  displayName: string;
  description?: string;
  fieldType: "string" | "number" | "boolean" | "date" | "semver";
  legalValues?: string[];
}

interface ConstraintEditorProps {
  constraints: Constraint[];
  onChange: (constraints: Constraint[]) => void;
  contextFields: ContextField[];
  disabled?: boolean;
}

// Operator options grouped by type
const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: "str_eq", label: "equals" },
    { value: "str_neq", label: "not equals" },
    { value: "str_contains", label: "contains" },
    { value: "str_starts_with", label: "starts with" },
    { value: "str_ends_with", label: "ends with" },
    { value: "str_in", label: "in list" },
    { value: "str_not_in", label: "not in list" },
    { value: "str_regex", label: "matches regex" },
  ],
  number: [
    { value: "num_eq", label: "=" },
    { value: "num_gt", label: ">" },
    { value: "num_gte", label: ">=" },
    { value: "num_lt", label: "<" },
    { value: "num_lte", label: "<=" },
    { value: "num_in", label: "in list" },
    { value: "num_not_in", label: "not in list" },
  ],
  boolean: [{ value: "bool_is", label: "is" }],
  date: [
    { value: "date_gt", label: "after" },
    { value: "date_gte", label: "on or after" },
    { value: "date_lt", label: "before" },
    { value: "date_lte", label: "on or before" },
  ],
  semver: [
    { value: "semver_eq", label: "=" },
    { value: "semver_gt", label: ">" },
    { value: "semver_gte", label: ">=" },
    { value: "semver_lt", label: "<" },
    { value: "semver_lte", label: "<=" },
    { value: "semver_in", label: "in list" },
    { value: "semver_not_in", label: "not in list" },
  ],
};

// Inverted operator labels (shown when constraint.inverted is true)
const INVERTED_OPERATOR_LABELS: Record<string, string> = {
  str_eq: "does not equal",
  str_neq: "equals",
  str_contains: "does not contain",
  str_starts_with: "does not start with",
  str_ends_with: "does not end with",
  str_in: "not in list",
  str_not_in: "in list",
  str_regex: "does not match regex",
  num_eq: "≠",
  num_gt: "≤",
  num_gte: "<",
  num_lt: "≥",
  num_lte: ">",
  num_in: "not in list",
  num_not_in: "in list",
  bool_is: "is not",
  date_gt: "on or before",
  date_gte: "before",
  date_lt: "on or after",
  date_lte: "after",
  semver_eq: "≠",
  semver_gt: "≤",
  semver_gte: "<",
  semver_lt: "≥",
  semver_lte: ">",
  semver_in: "not in list",
  semver_not_in: "in list",
};

// Get operator label based on inverted state
const getOperatorLabel = (
  operator: string,
  inverted: boolean,
  operators: { value: string; label: string }[],
): string => {
  if (inverted && INVERTED_OPERATOR_LABELS[operator]) {
    return INVERTED_OPERATOR_LABELS[operator];
  }
  return operators.find((op) => op.value === operator)?.label || operator;
};

// Check if operator expects multiple values
const isMultiValueOperator = (operator: ConstraintOperator): boolean => {
  return (
    operator === "str_in" ||
    operator === "str_not_in" ||
    operator === "num_in" ||
    operator === "num_not_in" ||
    operator === "semver_in" ||
    operator === "semver_not_in"
  );
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
  handleConstraintChange: (
    index: number,
    field: keyof Constraint,
    value: any,
  ) => void;
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} variant="outlined" sx={{ p: 1.5 }}>
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        {/* Drag Handle - only show when there are 2+ constraints */}
        {showDragHandle && (
          <Box
            {...attributes}
            {...listeners}
            sx={{
              cursor: disabled ? "default" : "grab",
              display: "flex",
              alignItems: "center",
              color: "text.secondary",
              mt: 1,
              "&:active": { cursor: "grabbing" },
            }}
          >
            <DragIndicator />
          </Box>
        )}

        {/* Context Field Selector */}
        <FormControl
          size="small"
          sx={{ minWidth: 150, flex: "1 1 150px" }}
          error={isFieldEmpty}
        >
          <Select
            value={constraint.contextName}
            onChange={(e) =>
              handleConstraintChange(index, "contextName", e.target.value)
            }
            displayEmpty
            disabled={disabled}
            renderValue={(selected) => {
              if (!selected) {
                return (
                  <em style={{ color: "gray" }}>
                    {t("featureFlags.selectContextField")}
                  </em>
                );
              }
              const selectedField = contextFields.find(
                (f) => f.fieldName === selected,
              );
              // Show missing icon for deleted/unknown fields
              if (!selectedField) {
                return (
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    <Tooltip title={t("featureFlags.missingContextField")}>
                      <MissingIcon
                        sx={{ fontSize: 16, color: "error.main", mr: 1 }}
                      />
                    </Tooltip>
                    <Typography sx={{ color: "error.main" }}>
                      {selected}
                    </Typography>
                  </Box>
                );
              }
              const getTypeIconForRender = (type: string) => {
                switch (type) {
                  case "string":
                    return (
                      <StringIcon
                        sx={{ fontSize: 16, color: "info.main", mr: 1 }}
                      />
                    );
                  case "number":
                    return (
                      <NumberIcon
                        sx={{ fontSize: 16, color: "success.main", mr: 1 }}
                      />
                    );
                  case "boolean":
                    return (
                      <BooleanIcon
                        sx={{ fontSize: 16, color: "warning.main", mr: 1 }}
                      />
                    );
                  case "date":
                    return (
                      <DateTimeIcon
                        sx={{ fontSize: 16, color: "secondary.main", mr: 1 }}
                      />
                    );
                  case "semver":
                    return (
                      <SemverIcon
                        sx={{ fontSize: 16, color: "primary.main", mr: 1 }}
                      />
                    );
                  default:
                    return (
                      <StringIcon
                        sx={{ fontSize: 16, color: "text.disabled", mr: 1 }}
                      />
                    );
                }
              };
              return (
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  {getTypeIconForRender(selectedField.fieldType)}
                  {selectedField.displayName || selectedField.fieldName}
                </Box>
              );
            }}
          >
            <MenuItem value="" disabled>
              <em>{t("featureFlags.selectContextField")}</em>
            </MenuItem>
            {contextFields.map((field) => {
              const isUsed = usedFieldNames.includes(field.fieldName);
              // Get icon for field type
              const getTypeIcon = (type: string) => {
                switch (type) {
                  case "string":
                    return (
                      <StringIcon sx={{ fontSize: 16, color: "info.main" }} />
                    );
                  case "number":
                    return (
                      <NumberIcon
                        sx={{ fontSize: 16, color: "success.main" }}
                      />
                    );
                  case "boolean":
                    return (
                      <BooleanIcon
                        sx={{ fontSize: 16, color: "warning.main" }}
                      />
                    );
                  case "date":
                    return (
                      <DateTimeIcon
                        sx={{ fontSize: 16, color: "secondary.main" }}
                      />
                    );
                  case "semver":
                    return (
                      <SemverIcon
                        sx={{ fontSize: 16, color: "primary.main" }}
                      />
                    );
                  default:
                    return (
                      <StringIcon
                        sx={{ fontSize: 16, color: "text.disabled" }}
                      />
                    );
                }
              };
              return (
                <MenuItem
                  key={field.fieldName}
                  value={field.fieldName}
                  disabled={isUsed}
                  sx={{
                    display: "flex",
                    gap: 1.5,
                    alignItems: "flex-start",
                    py: 1,
                  }}
                >
                  <Tooltip title={field.fieldType}>
                    <Box
                      sx={{ display: "flex", alignItems: "center", mt: 0.5 }}
                    >
                      {getTypeIcon(field.fieldType)}
                    </Box>
                  </Tooltip>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2">
                      {field.displayName || field.fieldName}
                      {isUsed && ` (${t("featureFlags.alreadyUsed")})`}
                    </Typography>
                    {field.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        {field.description}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              );
            })}
          </Select>
          {isFieldEmpty && (
            <FormHelperText>{t("featureFlags.fieldRequired")}</FormHelperText>
          )}
        </FormControl>

        {/* Inverted (!) - placed before operator for natural reading order */}
        <Tooltip title={t("featureFlags.invertedHelp")}>
          <span>
            <IconButton
              size="small"
              onClick={() =>
                handleConstraintChange(index, "inverted", !constraint.inverted)
              }
              disabled={disabled}
              sx={{
                width: 32,
                height: 32,
                color: constraint.inverted ? "warning.main" : "text.disabled",
                bgcolor: constraint.inverted
                  ? "action.selected"
                  : "transparent",
                "&:hover": {
                  bgcolor: "action.hover",
                },
              }}
            >
              <InvertIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* Operator Selector */}
        <FormControl size="small" sx={{ minWidth: 130, flex: "1 1 130px" }}>
          <Select
            value={validOperator}
            onChange={(e) =>
              handleConstraintChange(index, "operator", e.target.value)
            }
            disabled={disabled}
            renderValue={(selected) => {
              const label = getOperatorLabel(
                selected as string,
                constraint.inverted || false,
                operators,
              );
              return (
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {constraint.inverted && (
                    <Typography
                      component="span"
                      sx={{ color: "warning.main", fontWeight: 600 }}
                    >
                      NOT
                    </Typography>
                  )}
                  <Typography component="span">
                    {t(
                      `featureFlags.operators.${selected}${constraint.inverted ? "_inverted" : ""}`,
                      label,
                    )}
                  </Typography>
                </Box>
              );
            }}
          >
            {operators.map((op) => (
              <MenuItem key={op.value} value={op.value}>
                {t(`featureFlags.operators.${op.value}`, op.label)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Value Input */}
        <Box sx={{ flex: "2 1 200px", minWidth: 150 }}>
          {renderValueInput(constraint, index)}
          {!isFieldEmpty && isValueEmpty && (
            <Typography
              variant="caption"
              color="error"
              sx={{ display: "block", mt: 0.5 }}
            >
              {t("featureFlags.valueRequired")}
            </Typography>
          )}
        </Box>

        {/* Constraint Options & Delete */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          {/* Case Insensitive - always show but disable for non-string operators */}
          <Tooltip title={t("featureFlags.caseInsensitiveHelp")}>
            <span>
              <IconButton
                size="small"
                onClick={() =>
                  handleConstraintChange(
                    index,
                    "caseInsensitive",
                    !constraint.caseInsensitive,
                  )
                }
                disabled={disabled || !validOperator.startsWith("str_")}
                sx={{
                  width: 32,
                  height: 32,
                  color: constraint.caseInsensitive
                    ? "primary.main"
                    : "text.disabled",
                  bgcolor: constraint.caseInsensitive
                    ? "action.selected"
                    : "transparent",
                  "&:hover": {
                    bgcolor: "action.hover",
                  },
                }}
              >
                <TextFieldsIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {/* Delete Button */}
          <Tooltip title={t("common.delete")}>
            <span>
              <IconButton
                size="small"
                onClick={() => handleRemoveConstraint(index)}
                disabled={disabled}
                sx={{
                  width: 32,
                  height: 32,
                  color: "text.secondary",
                  "&:hover": {
                    bgcolor: "action.hover",
                    color: "error.main",
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
    [constraints],
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
    }),
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
    return field?.fieldType || "string";
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
  const getValidOperator = (
    contextName: string,
    currentOperator: ConstraintOperator,
  ): string => {
    const operators = getOperatorsForField(contextName);
    const isValid = operators.some((op) => op.value === currentOperator);
    return isValid ? currentOperator : operators[0]?.value || "str_eq";
  };

  const handleAddConstraint = () => {
    // Don't auto-select context field - user should explicitly choose
    const defaultOperators = OPERATORS_BY_TYPE.string;

    onChange([
      ...constraints,
      {
        contextName: "", // Empty - user must select
        operator: defaultOperators[0].value as ConstraintOperator,
        value: "",
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

  const handleConstraintChange = (
    index: number,
    field: keyof Constraint,
    value: any,
  ) => {
    const newConstraints = [...constraints];
    const constraint = { ...newConstraints[index] };

    if (field === "contextName") {
      // When context field changes, reset operator to first valid one for the new type
      const newField = contextFields.find((f) => f.fieldName === value);
      const newType = newField?.fieldType || "string";
      const newOperators =
        OPERATORS_BY_TYPE[newType] || OPERATORS_BY_TYPE.string;
      constraint.contextName = value;
      constraint.operator = newOperators[0].value as ConstraintOperator;
      constraint.value = "";
      constraint.values = [];
    } else if (field === "operator") {
      constraint.operator = value as ConstraintOperator;
      // Reset values when switching between single/multi value operators
      if (isMultiValueOperator(value)) {
        constraint.value = undefined;
        constraint.values = constraint.values || [];
      } else {
        constraint.values = undefined;
        constraint.value = constraint.value || "";
      }
    } else {
      (constraint as any)[field] = value;
    }

    newConstraints[index] = constraint;
    onChange(newConstraints);
  };

  const renderValueInput = (constraint: Constraint, index: number) => {
    const fieldType = getFieldType(constraint.contextName);
    const legalValues = getLegalValues(constraint.contextName);
    const isMultiValue = isMultiValueOperator(constraint.operator);

    // Boolean type - simple toggle
    if (fieldType === "boolean") {
      return (
        <FormControl fullWidth size="small">
          <Select
            value={constraint.value || "true"}
            onChange={(e) =>
              handleConstraintChange(index, "value", e.target.value)
            }
            displayEmpty
            disabled={disabled}
          >
            <MenuItem value="true">True</MenuItem>
            <MenuItem value="false">False</MenuItem>
          </Select>
        </FormControl>
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
            onChange={(_, newValue) =>
              handleConstraintChange(index, "values", newValue)
            }
            renderTags={(value, getTagProps) =>
              value.map((option, idx) => (
                <Chip
                  size="small"
                  label={option}
                  {...getTagProps({ index: idx })}
                  key={idx}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder={t("featureFlags.selectValues")}
              />
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
          onChange={(_, newValue) =>
            handleConstraintChange(index, "values", newValue)
          }
          renderTags={(value, getTagProps) =>
            value.map((option, idx) => (
              <Chip
                size="small"
                label={option}
                {...getTagProps({ index: idx })}
                key={idx}
              />
            ))
          }
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder={t("featureFlags.typeAndPressEnter")}
            />
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
            value={constraint.value || ""}
            onChange={(e) =>
              handleConstraintChange(index, "value", e.target.value)
            }
            displayEmpty
            disabled={disabled}
          >
            <MenuItem value="" disabled>
              <em>{t("featureFlags.selectValue")}</em>
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
    if (fieldType === "date") {
      return (
        <LocalizedDateTimePicker
          value={constraint.value || null}
          onChange={(isoString: string) => {
            // LocalizedDateTimePicker already returns UTC ISO string
            handleConstraintChange(index, "value", isoString);
          }}
          disabled={disabled}
        />
      );
    }

    // Number input
    if (fieldType === "number") {
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          placeholder="0"
          value={constraint.value || ""}
          onChange={(e) =>
            handleConstraintChange(index, "value", e.target.value)
          }
          disabled={disabled}
        />
      );
    }

    // Default text input
    return (
      <TextField
        fullWidth
        size="small"
        placeholder={
          fieldType === "semver" ? "e.g., 1.0.0" : t("featureFlags.enterValue")
        }
        value={constraint.value || ""}
        onChange={(e) => handleConstraintChange(index, "value", e.target.value)}
        disabled={disabled}
      />
    );
  };

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          {t("featureFlags.constraintsList")}
        </Typography>
        {!disabled && constraints.length > 0 && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={handleAddConstraint}
          >
            {t("featureFlags.addConstraint")}
          </Button>
        )}
      </Box>

      {constraints.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ borderStyle: "dashed", p: 3, textAlign: "center" }}
        >
          <Typography variant="body2" color="text.secondary">
            {t("featureFlags.noConstraints")}
          </Typography>
          {!disabled && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddConstraint}
              sx={{ mt: 1 }}
            >
              {t("featureFlags.addFirstConstraint")}
            </Button>
          )}
        </Paper>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={constraintIds}
            strategy={verticalListSortingStrategy}
          >
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {constraints.map((constraint, index) => {
                // Get valid operator for current field type
                const validOperator = getValidOperator(
                  constraint.contextName,
                  constraint.operator,
                );
                const operators = getOperatorsForField(constraint.contextName);
                const usedFieldNames = getUsedFieldNames(index);
                const isFieldEmpty = !constraint.contextName;
                const isValueEmpty = isMultiValueOperator(constraint.operator)
                  ? !constraint.values?.length
                  : !constraint.value;

                return (
                  <React.Fragment key={constraintIds[index]}>
                    {/* AND chip between constraints */}
                    {index > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "center",
                          py: 0.5,
                        }}
                      >
                        <Chip
                          label="AND"
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            bgcolor: "action.selected",
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
    </Box>
  );
};

export default ConstraintEditor;
