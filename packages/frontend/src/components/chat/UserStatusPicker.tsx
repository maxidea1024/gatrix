import React, { useState } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  TextField,
  Typography,
  Chip,
  IconButton,
} from "@mui/material";
import {
  Circle as OnlineIcon,
  DoNotDisturb as BusyIcon,
  Schedule as AwayIcon,
  VisibilityOff as InvisibleIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";

export type UserStatus = "online" | "away" | "busy" | "invisible";

interface UserStatusPickerProps {
  open: boolean;
  onClose: () => void;
  currentStatus: UserStatus;
  currentMessage?: string;
  onStatusChange: (status: UserStatus, message?: string) => void;
  title?: string;
  subtitle?: string;
}

const UserStatusPicker: React.FC<UserStatusPickerProps> = ({
  open,
  onClose,
  currentStatus,
  currentMessage = "",
  onStatusChange,
  title,
  subtitle,
}) => {
  const { t } = useTranslation();
  const [selectedStatus, setSelectedStatus] =
    useState<UserStatus>(currentStatus);
  const [statusMessage, setStatusMessage] = useState(currentMessage);
  const [isEditingMessage, setIsEditingMessage] = useState(false);

  const statusOptions = [
    {
      value: "online" as UserStatus,
      label: t("chat.statusOnline"),
      icon: <OnlineIcon sx={{ color: "success.main" }} />,
      description: t("chat.statusOnlineDesc"),
    },
    {
      value: "away" as UserStatus,
      label: t("chat.statusAway"),
      icon: <AwayIcon sx={{ color: "warning.main" }} />,
      description: t("chat.statusAwayDesc"),
    },
    {
      value: "busy" as UserStatus,
      label: t("chat.statusBusy"),
      icon: <BusyIcon sx={{ color: "error.main" }} />,
      description: t("chat.statusBusyDesc"),
    },
    {
      value: "invisible" as UserStatus,
      label: t("chat.statusInvisible"),
      icon: <InvisibleIcon sx={{ color: "text.disabled" }} />,
      description: t("chat.statusInvisibleDesc"),
    },
  ];

  const handleSave = () => {
    onStatusChange(selectedStatus, statusMessage);
    onClose();
  };

  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    setStatusMessage(currentMessage);
    setIsEditingMessage(false);
    onClose();
  };

  const getStatusIcon = (status: UserStatus) => {
    const option = statusOptions.find((opt) => opt.value === status);
    return option?.icon || <OnlineIcon />;
  };

  const getStatusLabel = (status: UserStatus) => {
    const option = statusOptions.find((opt) => opt.value === status);
    return option?.label || t("chat.statusOnline");
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          minHeight: 400,
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Box display="flex" alignItems="center" gap={1}>
              {getStatusIcon(currentStatus)}
              <Typography variant="h6">
                {title || t("chat.setStatus")}
              </Typography>
            </Box>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleCancel} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Current Status Display */}
          <Box
            sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 0 }}
          >
            <Typography variant="subtitle2" gutterBottom>
              {t("chat.currentStatus")}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              {getStatusIcon(currentStatus)}
              <Typography variant="body1">
                {getStatusLabel(currentStatus)}
              </Typography>
            </Box>
            {currentMessage && (
              <Chip
                label={currentMessage}
                size="small"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            )}
          </Box>

          {/* Status Options */}
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t("chat.selectNewStatus")}
            </Typography>
            <List dense>
              {statusOptions.map((option) => (
                <ListItem key={option.value} disablePadding>
                  <ListItemButton
                    selected={selectedStatus === option.value}
                    onClick={() => setSelectedStatus(option.value)}
                    sx={{
                      borderRadius: 0,
                      mb: 0.5,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {option.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={option.label}
                      secondary={option.description}
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Status Message */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="subtitle2">
                {t("chat.statusMessage")}
              </Typography>
              <IconButton
                size="small"
                onClick={() => setIsEditingMessage(!isEditingMessage)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Box>
            {isEditingMessage ? (
              <TextField
                fullWidth
                size="small"
                value={statusMessage}
                onChange={(e) => setStatusMessage(e.target.value)}
                placeholder={t("chat.statusMessagePlaceholder")}
                autoFocus
                onBlur={() => setIsEditingMessage(false)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    setIsEditingMessage(false);
                  }
                }}
              />
            ) : (
              <Box
                onClick={() => setIsEditingMessage(true)}
                sx={{
                  p: 1,
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 0,
                  cursor: "text",
                  minHeight: 40,
                  display: "flex",
                  alignItems: "center",
                  backgroundColor: "background.paper",
                  "&:hover": {
                    borderColor: "primary.main",
                  },
                }}
              >
                <Typography
                  variant="body2"
                  color={statusMessage ? "text.primary" : "text.secondary"}
                >
                  {statusMessage || t("chat.statusMessagePlaceholder")}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCancel}>{t("common.cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={
            selectedStatus === currentStatus && statusMessage === currentMessage
          }
        >
          {t("chat.updateStatus")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserStatusPicker;
