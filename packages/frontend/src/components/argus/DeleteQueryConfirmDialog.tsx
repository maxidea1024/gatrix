import React from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface DeleteQueryConfirmDialogProps {
  open: boolean;
  queryName: string;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteQueryConfirmDialog: React.FC<DeleteQueryConfirmDialogProps> = ({
  open,
  queryName,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
        {t('argus.common.deleteQuery', 'Delete Query')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: '0.85rem' }}>
          {t(
            'argus.common.deleteQueryConfirm',
            'Are you sure you want to delete "{{name}}"? This action cannot be undone.',
            { name: queryName }
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {t('common.delete', 'Delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteQueryConfirmDialog;
