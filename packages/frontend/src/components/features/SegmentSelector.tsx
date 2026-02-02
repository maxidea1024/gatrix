/**
 * SegmentSelector - Unleash-style segment selection component
 * Clean UI for selecting segments and viewing their constraints
 */
import React, { useState } from "react";
import {
  Box,
  Typography,
  Chip,
  Select,
  MenuItem,
  FormControl,
  Paper,
  IconButton,
  Collapse,
  Stack,
  Tooltip,
} from "@mui/material";
import GroupIcon from "@mui/icons-material/Group";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { ConstraintList, ConstraintValue } from "./ConstraintDisplay";

export interface Segment {
  id?: string;
  segmentName: string;
  displayName?: string;
  constraints?: ConstraintValue[];
  isActive?: boolean;
}

interface SegmentSelectorProps {
  selectedSegments: string[];
  availableSegments: Segment[];
  onSegmentAdd: (segmentName: string) => void;
  onSegmentRemove: (segmentName: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
}

const SegmentSelector: React.FC<SegmentSelectorProps> = ({
  selectedSegments,
  availableSegments,
  onSegmentAdd,
  onSegmentRemove,
  disabled = false,
  t,
}) => {
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);

  // Filter out already selected segments
  const unselectedSegments = availableSegments.filter(
    (s) => !selectedSegments.includes(s.segmentName),
  );

  const toggleExpand = (segmentName: string) => {
    setExpandedSegment(expandedSegment === segmentName ? null : segmentName);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 1 }}>
        <Typography variant="subtitle2">
          {t("featureFlags.segments")}
        </Typography>
        <Tooltip title={t("featureFlags.segmentSelectorHelp")}>
          <HelpOutlineIcon sx={{ fontSize: 16, color: "text.secondary" }} />
        </Tooltip>
      </Box>

      {/* Segment Selector Dropdown */}
      <FormControl size="small" sx={{ minWidth: 200, mb: 2 }}>
        <Select
          value=""
          displayEmpty
          disabled={disabled || unselectedSegments.length === 0}
          onChange={(e) => {
            if (e.target.value) {
              onSegmentAdd(e.target.value as string);
            }
          }}
          renderValue={() => (
            <Typography color="text.secondary">
              {t("featureFlags.selectSegments")}
            </Typography>
          )}
        >
          {unselectedSegments.map((seg) => (
            <MenuItem key={seg.segmentName} value={seg.segmentName}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <GroupIcon sx={{ fontSize: 18, color: "action.active" }} />
                <span>{seg.displayName || seg.segmentName}</span>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Selected Segments */}
      {selectedSegments.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 1, display: "block" }}
          >
            {t("featureFlags.selectedSegments")}
          </Typography>

          {/* Segment chips with AND separators */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              alignItems: "center",
              mb: 1,
            }}
          >
            {selectedSegments.map((segName, idx) => {
              const seg = availableSegments.find(
                (s) => s.segmentName === segName,
              );
              const isExpanded = expandedSegment === segName;

              return (
                <React.Fragment key={segName}>
                  {idx > 0 && (
                    <Chip
                      label="AND"
                      size="small"
                      sx={{
                        height: 24,
                        fontSize: "0.7rem",
                        bgcolor: "grey.200",
                        fontWeight: 600,
                      }}
                    />
                  )}
                  <Chip
                    icon={<GroupIcon sx={{ fontSize: 16 }} />}
                    label={
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <span>{seg?.displayName || segName}</span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(segName);
                          }}
                          sx={{ p: 0, color: "inherit" }}
                        >
                          <Tooltip
                            title={
                              isExpanded
                                ? t("featureFlags.hideSegmentConstraints")
                                : t("featureFlags.showSegmentConstraints")
                            }
                          >
                            {isExpanded ? (
                              <VisibilityOffIcon sx={{ fontSize: 14 }} />
                            ) : (
                              <VisibilityIcon sx={{ fontSize: 14 }} />
                            )}
                          </Tooltip>
                        </IconButton>
                      </Box>
                    }
                    onDelete={
                      disabled ? undefined : () => onSegmentRemove(segName)
                    }
                    variant="outlined"
                    color="primary"
                    sx={{
                      "& .MuiChip-label": { pr: 0.5 },
                      "& .MuiChip-deleteIcon": { ml: 0 },
                    }}
                  />
                </React.Fragment>
              );
            })}
          </Box>

          {/* Segment Preview */}
          {selectedSegments.map((segName) => {
            const seg = availableSegments.find(
              (s) => s.segmentName === segName,
            );
            const isExpanded = expandedSegment === segName;

            return (
              <Collapse key={segName} in={isExpanded}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    mt: 1,
                    mb: 1,
                    bgcolor: "grey.50",
                    borderColor: "primary.light",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Segment
                    </Typography>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      color="primary.main"
                    >
                      {seg?.displayName || segName}
                    </Typography>
                  </Box>
                  <ConstraintList constraints={seg?.constraints || []} />
                </Paper>
              </Collapse>
            );
          })}
        </Box>
      )}

      {/* AND separator before Constraints section */}
      {selectedSegments.length > 0 && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, my: 2 }}>
          <Box sx={{ flex: 1, borderBottom: 1, borderColor: "divider" }} />
          <Chip
            label="AND"
            size="small"
            sx={{
              height: 22,
              fontSize: "0.7rem",
              bgcolor: "action.selected",
              fontWeight: 600,
            }}
          />
          <Box sx={{ flex: 1, borderBottom: 1, borderColor: "divider" }} />
        </Box>
      )}
    </Box>
  );
};

export default SegmentSelector;
