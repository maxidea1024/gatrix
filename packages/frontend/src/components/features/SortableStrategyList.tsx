/**
 * SortableStrategyList Component
 *
 * Drag-and-drop sortable list of activation strategies.
 * Strategies are evaluated in OR logic (first truthy match wins).
 */
import React from "react";
import {
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  IconButton,
  Chip,
  Divider,
  Tooltip,
  Stack,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Slider,
  Autocomplete,
  Paper,
  Button,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Add as AddIcon,
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
import ConstraintEditor, { Constraint, ContextField } from "./ConstraintEditor";

// ==================== Types ====================

interface Strategy {
  id: string;
  name: string;
  title: string;
  parameters: Record<string, any>;
  constraints: Constraint[];
  segments?: string[];
  sortOrder: number;
  disabled?: boolean;
}

interface SortableStrategyListProps {
  strategies: Strategy[];
  onChange: (strategies: Strategy[]) => void;
  segments: any[];
  contextFields: ContextField[];
  expandedSegments: Set<string>;
  setExpandedSegments: React.Dispatch<React.SetStateAction<Set<string>>>;
  canManage: boolean;
  onEditStrategy: (strategy: Strategy) => void;
  onDeleteStrategy: (strategyId: string, index: number) => void;
}

// ==================== Sortable Strategy Item ====================

interface SortableStrategyItemProps {
  id: string;
  strategy: Strategy;
  index: number;
  strategies: Strategy[];
  onChange: (strategies: Strategy[]) => void;
  segments: any[];
  contextFields: ContextField[];
  expandedSegments: Set<string>;
  setExpandedSegments: React.Dispatch<React.SetStateAction<Set<string>>>;
  canManage: boolean;
  showDragHandle: boolean;
  showOrDivider: boolean;
  onEditStrategy: (strategy: Strategy) => void;
  onDeleteStrategy: (strategyId: string, index: number) => void;
}

const SortableStrategyItem: React.FC<SortableStrategyItemProps> = ({
  id,
  strategy,
  index,
  strategies,
  onChange,
  segments,
  contextFields,
  expandedSegments,
  setExpandedSegments,
  canManage,
  showDragHandle,
  showOrDivider,
  onEditStrategy,
  onDeleteStrategy,
}) => {
  const { t } = useTranslation();
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

  // Update single strategy
  const updateStrategy = (updates: Partial<Strategy>) => {
    const newStrategies = [...strategies];
    newStrategies[index] = { ...newStrategies[index], ...updates };
    onChange(newStrategies);
  };

  // Toggle segment expansion
  const toggleSegmentExpanded = (segmentName: string) => {
    const key = `${index}-${segmentName}`;
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedSegments(newExpanded);
  };

  // Remove segment
  const handleRemoveSegment = (segmentName: string) => {
    const newSegments = (strategy.segments || []).filter(
      (s) => s !== segmentName,
    );
    updateStrategy({ segments: newSegments });
  };

  // Get segment display info
  const getSegmentInfo = (segmentName: string) => {
    const seg = segments.find((s: any) => s.segmentName === segmentName);
    return seg || { segmentName, displayName: segmentName, constraints: [] };
  };

  // Get operator display
  const getOperatorDisplay = (operator: string): string => {
    const opMap: Record<string, string> = {
      str_eq: "=",
      str_neq: "≠",
      str_contains: "∋",
      str_starts_with: "⊆",
      str_ends_with: "⊇",
      str_in: "∈",
      str_not_in: "∉",
      num_eq: "=",
      num_gt: ">",
      num_gte: "≥",
      num_lt: "<",
      num_lte: "≤",
      bool_is: "=",
      date_gt: ">",
      date_gte: "≥",
      date_lt: "<",
      date_lte: "≤",
      semver_eq: "=",
      semver_gt: ">",
      semver_gte: "≥",
      semver_lt: "<",
      semver_lte: "≤",
    };
    return opMap[operator] || operator;
  };

  // Get value display
  const getValueDisplay = (c: Constraint): string => {
    if (c.values && c.values.length > 0) {
      return c.values.length <= 3
        ? c.values.join(", ")
        : `${c.values.slice(0, 3).join(", ")}... (+${c.values.length - 3})`;
    }
    return c.value || "";
  };

  return (
    <Box ref={setNodeRef} style={style}>
      {/* OR divider between strategies */}
      {showOrDivider && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
          <Divider sx={{ flexGrow: 1 }} />
          <Chip
            label="OR"
            size="small"
            variant="outlined"
            color="secondary"
            sx={{ fontWeight: 600 }}
          />
          <Divider sx={{ flexGrow: 1 }} />
        </Box>
      )}

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              width: "100%",
            }}
          >
            {/* Drag Handle */}
            {showDragHandle && canManage && (
              <Box
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                sx={{
                  cursor: "grab",
                  display: "flex",
                  alignItems: "center",
                  color: "text.secondary",
                  "&:active": { cursor: "grabbing" },
                }}
              >
                <DragIcon />
              </Box>
            )}

            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={500}>
                {strategy.title || strategy.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {strategy.constraints?.length || 0}{" "}
                {t("featureFlags.constraints")}
              </Typography>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={!strategy.disabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    updateStrategy({ disabled: !e.target.checked });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  disabled={!canManage}
                />
              }
              label=""
              onClick={(e) => e.stopPropagation()}
            />
          </Box>
        </AccordionSummary>

        <AccordionDetails>
          <Stack spacing={2}>
            {/* Strategy Type Select */}
            <FormControl fullWidth size="small">
              <InputLabel>{t("featureFlags.strategyType")}</InputLabel>
              <Select
                value={strategy.name || "default"}
                label={t("featureFlags.strategyType")}
                onChange={(e) => updateStrategy({ name: e.target.value })}
                disabled={!canManage}
              >
                <MenuItem value="default">
                  {t("featureFlags.strategyTypes.default")}
                </MenuItem>
                <MenuItem value="flexibleRollout">
                  {t("featureFlags.strategyTypes.flexibleRollout")}
                </MenuItem>
                <MenuItem value="userWithId">
                  {t("featureFlags.strategyTypes.userWithId")}
                </MenuItem>
                <MenuItem value="gradualRolloutUserId">
                  {t("featureFlags.strategyTypes.gradualRolloutUserId")}
                </MenuItem>
                <MenuItem value="remoteAddress">
                  {t("featureFlags.strategyTypes.remoteAddress")}
                </MenuItem>
                <MenuItem value="applicationHostname">
                  {t("featureFlags.strategyTypes.applicationHostname")}
                </MenuItem>
              </Select>
            </FormControl>

            {/* Flexible Rollout Parameters */}
            {strategy.name === "flexibleRollout" && (
              <Box sx={{ px: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t("featureFlags.rolloutPercentage")}:{" "}
                  {strategy.parameters?.rollout || 100}%
                </Typography>
                <Slider
                  value={strategy.parameters?.rollout ?? 100}
                  onChange={(_, value) =>
                    updateStrategy({
                      parameters: {
                        ...strategy.parameters,
                        rollout: value as number,
                      },
                    })
                  }
                  min={0}
                  max={100}
                  valueLabelDisplay="auto"
                  disabled={!canManage}
                />
                <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                  <InputLabel>{t("featureFlags.stickiness")}</InputLabel>
                  <Select
                    value={strategy.parameters?.stickiness || "default"}
                    label={t("featureFlags.stickiness")}
                    onChange={(e) =>
                      updateStrategy({
                        parameters: {
                          ...strategy.parameters,
                          stickiness: e.target.value,
                        },
                      })
                    }
                    disabled={!canManage}
                  >
                    <MenuItem value="default">
                      {t("featureFlags.stickinessOptions.default")}
                    </MenuItem>
                    <MenuItem value="userId">
                      {t("featureFlags.stickinessOptions.userId")}
                    </MenuItem>
                    <MenuItem value="sessionId">
                      {t("featureFlags.stickinessOptions.sessionId")}
                    </MenuItem>
                    <MenuItem value="random">
                      {t("featureFlags.stickinessOptions.random")}
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            {/* Segments Section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t("featureFlags.segments")}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 1,
                  alignItems: "center",
                }}
              >
                {(strategy.segments || []).map((segmentName: string) => {
                  const segInfo = getSegmentInfo(segmentName);
                  const expandKey = `${index}-${segmentName}`;
                  const isExpanded = expandedSegments.has(expandKey);

                  return (
                    <Box key={segmentName}>
                      <Chip
                        label={segInfo.displayName || segmentName}
                        onDelete={
                          canManage
                            ? () => handleRemoveSegment(segmentName)
                            : undefined
                        }
                        onClick={() => toggleSegmentExpanded(segmentName)}
                        color="primary"
                        variant={isExpanded ? "filled" : "outlined"}
                        size="small"
                      />
                      {isExpanded && segInfo.constraints?.length > 0 && (
                        <Paper
                          elevation={2}
                          sx={{
                            mt: 1,
                            p: 1.5,
                            backgroundColor: "background.default",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 1,
                            }}
                          >
                            {segInfo.constraints.map(
                              (c: Constraint, cIdx: number) => (
                                <React.Fragment key={cIdx}>
                                  {cIdx > 0 && (
                                    <Chip
                                      label="AND"
                                      size="small"
                                      sx={{
                                        alignSelf: "center",
                                        height: 18,
                                        fontSize: "0.65rem",
                                      }}
                                    />
                                  )}
                                  <Box
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                      flexWrap: "wrap",
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{ minWidth: 80 }}
                                    >
                                      {c.contextName}
                                    </Typography>
                                    <Chip
                                      label={
                                        c.inverted
                                          ? `NOT ${getOperatorDisplay(c.operator)}`
                                          : getOperatorDisplay(c.operator)
                                      }
                                      size="small"
                                      variant="outlined"
                                      sx={{ height: 22, fontSize: "0.75rem" }}
                                    />
                                    <Typography
                                      variant="body2"
                                      fontWeight={600}
                                    >
                                      {getValueDisplay(c)}
                                    </Typography>
                                  </Box>
                                </React.Fragment>
                              ),
                            )}
                          </Box>
                        </Paper>
                      )}
                    </Box>
                  );
                })}

                {/* Add segment selector */}
                <Autocomplete
                  size="small"
                  sx={{ minWidth: 200, flexShrink: 0 }}
                  options={segments.filter(
                    (s: any) =>
                      !(strategy.segments || []).includes(s.segmentName),
                  )}
                  getOptionLabel={(option: any) =>
                    option.displayName || option.segmentName
                  }
                  value={null}
                  onChange={(_, selected) => {
                    if (selected) {
                      updateStrategy({
                        segments: [
                          ...(strategy.segments || []),
                          selected.segmentName,
                        ],
                      });
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={t("featureFlags.selectSegments")}
                      size="small"
                    />
                  )}
                  disabled={!canManage || segments.length === 0}
                  noOptionsText={t("featureFlags.noSegments")}
                  clearOnBlur
                  blurOnSelect
                />
              </Box>
            </Box>

            {/* AND Indicator */}
            {(strategy.segments?.length > 0 ||
              strategy.constraints?.length > 0) && (
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}
              >
                <Divider sx={{ flexGrow: 1 }} />
                <Chip
                  label="AND"
                  size="small"
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
                <Divider sx={{ flexGrow: 1 }} />
              </Box>
            )}

            {/* Constraints Section */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t("featureFlags.constraints")}
              </Typography>
              <ConstraintEditor
                constraints={strategy.constraints || []}
                onChange={(newConstraints) =>
                  updateStrategy({ constraints: newConstraints })
                }
                contextFields={contextFields}
                disabled={!canManage}
              />
            </Box>

            {/* Strategy Actions */}
            {canManage && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 1,
                  pt: 1,
                }}
              >
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => onDeleteStrategy(strategy.id, index)}
                >
                  {t("common.delete")}
                </Button>
              </Box>
            )}
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

// ==================== Main Component ====================

const SortableStrategyList: React.FC<SortableStrategyListProps> = ({
  strategies,
  onChange,
  segments,
  contextFields,
  expandedSegments,
  setExpandedSegments,
  canManage,
  onEditStrategy,
  onDeleteStrategy,
}) => {
  const { t } = useTranslation();

  // Generate strategy IDs
  const strategyIds = React.useMemo(
    () => strategies.map((s, idx) => s.id || `strategy-${idx}`),
    [strategies],
  );

  // DnD sensors
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

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = strategyIds.indexOf(active.id as string);
      const newIndex = strategyIds.indexOf(over.id as string);
      const newStrategies = arrayMove([...strategies], oldIndex, newIndex);
      // Update sortOrder
      const updated = newStrategies.map((s, idx) => ({ ...s, sortOrder: idx }));
      onChange(updated);
    }
  };

  if (strategies.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 3, color: "text.secondary" }}>
        <Typography>{t("featureFlags.noStrategies")}</Typography>
      </Box>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis]}
    >
      <SortableContext
        items={strategyIds}
        strategy={verticalListSortingStrategy}
      >
        <Stack spacing={0}>
          {strategies.map((strategy, index) => (
            <SortableStrategyItem
              key={strategyIds[index]}
              id={strategyIds[index]}
              strategy={strategy}
              index={index}
              strategies={strategies}
              onChange={onChange}
              segments={segments}
              contextFields={contextFields}
              expandedSegments={expandedSegments}
              setExpandedSegments={setExpandedSegments}
              canManage={canManage}
              showDragHandle={strategies.length > 1}
              showOrDivider={index > 0}
              onEditStrategy={onEditStrategy}
              onDeleteStrategy={onDeleteStrategy}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
};

export default SortableStrategyList;
