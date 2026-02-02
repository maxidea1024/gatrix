/**
 * Environment Settings Card - Unleash-style environment configuration card
 *
 * Features:
 * - Expandable accordion with environment name, strategy count, toggle
 * - Shows strategies with OR separators when expanded
 * - Edit button opens drawer for detailed editing
 */
import React from "react";
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  Stack,
  Divider,
  Tooltip,
  CircularProgress,
  useTheme,
} from "@mui/material";
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  MoreVert as MoreIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import FeatureSwitch from "../common/FeatureSwitch";
import { getContrastColor } from "../../utils/colorUtils";

export interface Strategy {
  id?: string;
  name: string;
  title?: string;
  parameters?: Record<string, any>;
  constraints?: any[];
  segments?: string[];
  sortOrder?: number;
  disabled?: boolean;
}

export interface EnvironmentMetrics {
  totalYes: number;
  totalNo: number;
  total: number;
}

export interface EnvironmentData {
  environment: string;
  displayName: string;
  color?: string;
  isEnabled: boolean;
  strategies: Strategy[];
  variants?: any[];
  lastSeenAt?: string;
}

interface EnvironmentSettingsCardProps {
  envData: EnvironmentData;
  segments: any[];
  isArchived?: boolean;
  canManage: boolean;
  metrics?: EnvironmentMetrics;
  onToggle: () => void;
  onEditClick: () => void;
  onAddStrategy: () => void;
  onEditStrategy: (strategy: Strategy) => void;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  getStrategyTitle: (strategyName: string) => string;
}

const EnvironmentSettingsCard: React.FC<EnvironmentSettingsCardProps> = ({
  envData,
  segments,
  isArchived,
  canManage,
  metrics,
  onToggle,
  onEditClick,
  onAddStrategy,
  onEditStrategy,
  expanded,
  onExpandChange,
  getStrategyTitle,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const strategies = envData.strategies || [];
  const strategiesCount = strategies.length;

  // Get segment names for display
  const getSegmentNames = (segmentIds: string[] = []) => {
    return segmentIds
      .map((id) => segments.find((s) => s.id === id)?.name || id)
      .join(", ");
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderLeftWidth: 4,
        borderLeftColor: envData.color || "#888",
        overflow: "hidden",
      }}
    >
      <Accordion
        expanded={expanded}
        onChange={(_, isExpanded) => onExpandChange?.(isExpanded)}
        disableGutters
        sx={{
          "&:before": { display: "none" },
          bgcolor: "transparent",
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            px: 2,
            "& .MuiAccordionSummary-content": {
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1 }}>
            {/* Environment name and info */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t("featureFlags.environment")}
              </Typography>
              <Typography variant="subtitle1" fontWeight={600}>
                {envData.displayName}
              </Typography>
            </Box>

            {/* Strategy count */}
            <Chip
              label={t("featureFlags.strategiesCount", {
                count: strategiesCount,
              })}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: 2 }}
            />
          </Box>

          {/* Right side: metrics gauge + toggle */}
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {metrics && metrics.total > 0 ? (
              (() => {
                const yesPercent = Math.round(
                  (metrics.totalYes / metrics.total) * 100,
                );
                const noPercent = 100 - yesPercent;
                const radius = 18;
                const cx = 20;
                const cy = 20;

                // Calculate arc path for pie chart
                const getArcPath = (
                  startAngle: number,
                  endAngle: number,
                  r: number,
                ) => {
                  const startRad = ((startAngle - 90) * Math.PI) / 180;
                  const endRad = ((endAngle - 90) * Math.PI) / 180;
                  const x1 = cx + r * Math.cos(startRad);
                  const y1 = cy + r * Math.sin(startRad);
                  const x2 = cx + r * Math.cos(endRad);
                  const y2 = cy + r * Math.sin(endRad);
                  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
                };

                const yesAngle = (yesPercent / 100) * 360;

                return (
                  <Tooltip
                    title={`${t("featureFlags.metrics.exposedTrue")}: ${metrics.totalYes} (${yesPercent}%) / ${t("featureFlags.metrics.exposedFalse")}: ${metrics.totalNo} (${noPercent}%)`}
                    arrow
                  >
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        {/* No (red) - full circle background */}
                        <circle cx={cx} cy={cy} r={radius} fill="#ef5350" />
                        {/* Yes (green) - pie slice */}
                        {yesPercent > 0 && yesPercent < 100 && (
                          <path
                            d={getArcPath(0, yesAngle, radius)}
                            fill="#4caf50"
                          />
                        )}
                        {yesPercent >= 100 && (
                          <circle cx={cx} cy={cy} r={radius} fill="#4caf50" />
                        )}
                        {/* Center text */}
                        <text
                          x={cx}
                          y={cy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize="10"
                          fontWeight="bold"
                          fontFamily="system-ui, -apple-system, sans-serif"
                          fill="white"
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
                        >
                          {yesPercent}%
                        </text>
                      </svg>
                    </Box>
                  </Tooltip>
                );
              })()
            ) : (
              <Tooltip title={t("featureFlags.noMetricsYetHint")} arrow>
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <svg width="40" height="40" viewBox="0 0 40 40">
                    {/* Empty light circle for no metrics */}
                    <circle
                      cx={20}
                      cy={20}
                      r={18}
                      fill={
                        theme.palette.mode === "dark"
                          ? "rgba(255,255,255,0.05)"
                          : "rgba(0,0,0,0.04)"
                      }
                    />
                  </svg>
                </Box>
              </Tooltip>
            )}
            <FeatureSwitch
              size="small"
              checked={envData.isEnabled}
              onChange={onToggle}
              disabled={!canManage || isArchived}
            />
          </Box>
        </AccordionSummary>

        <AccordionDetails sx={{ px: 2, pt: 0, pb: 2 }}>
          {strategies.length === 0 ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {t("featureFlags.noStrategies")}
              </Typography>
              {canManage && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={onAddStrategy}
                  size="small"
                >
                  {t("featureFlags.addStrategy")}
                </Button>
              )}
            </Box>
          ) : (
            <Stack spacing={2}>
              {strategies.map((strategy, index) => (
                <React.Fragment key={strategy.id || index}>
                  {/* OR divider between strategies */}
                  {index > 0 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Divider sx={{ flexGrow: 1 }} />
                      <Chip
                        label="OR"
                        size="small"
                        variant="outlined"
                        color="secondary"
                        sx={{ fontWeight: 600, fontSize: "0.7rem" }}
                      />
                      <Divider sx={{ flexGrow: 1 }} />
                    </Box>
                  )}

                  {/* Strategy card */}
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Typography fontWeight={600}>
                            {getStrategyTitle(strategy.name)}
                          </Typography>
                          {strategy.disabled && (
                            <Chip
                              label={t("featureFlags.strategyDisabled")}
                              size="small"
                              color="warning"
                            />
                          )}
                        </Box>

                        {/* Segments */}
                        {strategy.segments && strategy.segments.length > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t("featureFlags.segment")}:
                            </Typography>
                            <Typography variant="body2">
                              {getSegmentNames(strategy.segments)}
                            </Typography>
                          </Box>
                        )}

                        {/* Rollout percentage */}
                        {strategy.parameters?.rollout !== undefined && (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t("featureFlags.rollout")}:
                            </Typography>
                            <Chip
                              label={`${strategy.parameters.rollout}%`}
                              size="small"
                              variant="outlined"
                            />
                            <Typography variant="body2" color="text.secondary">
                              {t("featureFlags.ofYourBase")}
                            </Typography>
                          </Box>
                        )}

                        {/* Constraints count */}
                        {strategy.constraints &&
                          strategy.constraints.length > 0 && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ mt: 0.5, display: "block" }}
                            >
                              +{strategy.constraints.length}{" "}
                              {t("featureFlags.constraints").toLowerCase()}
                            </Typography>
                          )}
                      </Box>

                      {/* Action buttons */}
                      {canManage && (
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Tooltip title={t("common.edit")}>
                            <IconButton
                              size="small"
                              onClick={() => onEditStrategy(strategy)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t("common.copy")}>
                            <IconButton size="small">
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <IconButton size="small">
                            <MoreIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </React.Fragment>
              ))}

              {/* Add strategy button */}
              {canManage && (
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={onAddStrategy}
                    size="small"
                  >
                    {t("featureFlags.addStrategy")}
                  </Button>
                </Box>
              )}
            </Stack>
          )}
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

export default EnvironmentSettingsCard;
