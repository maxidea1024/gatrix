import React from "react";
import { Box, Typography, Button } from "@mui/material";
import { Add as AddIcon, Inbox as InboxIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface EmptyStateProps {
  /** Main message to display */
  message: string;
  /** Subtitle text shown below the main message */
  subtitle?: string;
  /** Icon to display (defaults to InboxIcon) */
  icon?: React.ReactNode;
  /** If provided, shows an "Add" button that calls this function */
  onAddClick?: () => void;
  /** Label for the add button (defaults to common.add) */
  addButtonLabel?: string;
  /** Whether the add button should be shown (defaults to true if onAddClick is provided) */
  showAddButton?: boolean;
  /** Minimum height of the empty state container */
  minHeight?: number | string;
}

/**
 * EmptyState component for displaying when there is no data.
 * Unlike EmptyTableRow, this is a standalone component that can be rendered
 * outside of a table structure, making it ideal for hiding table headers
 * when there's no data.
 */
const EmptyState: React.FC<EmptyStateProps> = ({
  message,
  subtitle,
  icon,
  onAddClick,
  addButtonLabel,
  showAddButton = true,
  minHeight = 200,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight,
        py: 6,
        gap: 1.5,
      }}
    >
      {/* Icon */}
      <Box sx={{ color: "text.disabled", mb: 1 }}>
        {icon || <InboxIcon sx={{ fontSize: 48 }} />}
      </Box>

      {/* Main message */}
      <Typography variant="body1" color="text.secondary" fontWeight={500}>
        {message}
      </Typography>

      {/* Subtitle / CTA */}
      {onAddClick && showAddButton ? (
        <Button
          variant="text"
          onClick={onAddClick}
          startIcon={<AddIcon />}
          sx={{
            mt: 0.5,
            textTransform: "none",
            fontSize: "0.875rem",
            color: "primary.main",
            fontWeight: 600,
            "&:hover": {
              backgroundColor: "transparent",
              textDecoration: "underline",
            },
          }}
        >
          {subtitle ||
            addButtonLabel ||
            (t("common.addFirstItem") !== "common.addFirstItem"
              ? t("common.addFirstItem")
              : t("common.add"))}
        </Button>
      ) : (
        subtitle && (
          <Typography variant="body2" color="text.disabled">
            {subtitle}
          </Typography>
        )
      )}
    </Box>
  );
};

export default EmptyState;
