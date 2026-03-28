import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  Alert,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ChangeRequestSubmitButtons } from './ChangeRequestSubmitButtons';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (skipCr?: boolean) => void;
  title: string;
  message: string;
  warning?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  loading?: boolean;
  requiresApproval?: boolean;
  children?: React.ReactNode;
}

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  warning,
  confirmButtonText,
  cancelButtonText,
  loading = false,
  requiresApproval = false,
  children,
}) => {
  const { t } = useTranslation();

  const handleConfirm = (skipCr?: boolean) => {
    onConfirm(skipCr);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          p: 1,
        },
      }}
    >
      <DialogTitle sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <WarningIcon color="error" />
          <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pb: 2 }}>
        <Typography variant="body1" sx={{ mb: 2, color: 'text.primary' }}>
          {message}
        </Typography>

        {children}

        {warning && (
          <Alert
            severity="warning"
            sx={{
              mt: 2,
              '& .MuiAlert-message': {
                fontSize: '0.875rem',
              },
            }}
          >
            {warning}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          disabled={loading}
          sx={{ minWidth: 80 }}
        >
          {cancelButtonText || t('common.cancel')}
        </Button>

        <ChangeRequestSubmitButtons
          action="delete"
          requiresApproval={requiresApproval}
          saving={loading}
          onSave={handleConfirm}
          disabled={loading}
          title={confirmButtonText}
        />
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteDialog;
