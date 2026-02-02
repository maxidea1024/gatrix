import React from "react";
import {
  TableRow,
  TableCell,
  Typography,
  CircularProgress,
  Box,
  Button,
} from "@mui/material";
import { Add as AddIcon, Inbox as InboxIcon } from "@mui/icons-material";
import { useTranslation } from "react-i18next";

interface EmptyTableRowProps {
  colSpan: number;
  loading?: boolean;
  message: string;
  loadingMessage?: string;
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
}

const EmptyTableRow: React.FC<EmptyTableRowProps> = ({
  colSpan,
  loading = false,
  message,
  loadingMessage,
  subtitle,
  icon,
  onAddClick,
  addButtonLabel,
  showAddButton = true,
}) => {
  const { t } = useTranslation();
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        align="center"
        sx={{
          py: 8,
          height: 200,
          minHeight: 200,
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            gap: 1.5,
          }}
        >
          {loading ? (
            <CircularProgress size={32} />
          ) : (
            <>
              {/* Icon */}
              <Box sx={{ color: "text.disabled", mb: 1 }}>
                {icon || <InboxIcon sx={{ fontSize: 48 }} />}
              </Box>
              {/* Main message */}
              <Typography
                variant="body1"
                color="text.secondary"
                fontWeight={500}
              >
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
            </>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default EmptyTableRow;
