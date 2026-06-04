import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Paper,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Lock as LockIcon,
  ArrowForward as ArrowForwardIcon,
  Warning as WarningIcon,
  Storage as StorageIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface ApiErrorDialogProps {
  open: boolean;
  onClose: () => void;
  type?: 'LOCKED' | 'CONFLICT' | 'DUPLICATE' | 'GENERIC';
  lockedInfo?: {
    lockedBy?: number | string;
    changeRequestId?: string;
    changeRequestTitle?: string;
  };
  conflictData?: {
    originalDraftBase?: any;
    currentLive?: any;
    userDraft?: any;
    [key: string]: any;
  };
  message?: string;
  onDelete?: () => void; // Optional delete callback for conflict/duplicate errors
}

const ApiErrorDialog: React.FC<ApiErrorDialogProps> = ({
  open,
  onClose,
  type = 'GENERIC',
  lockedInfo,
  conflictData,
  message,
  onDelete,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleViewChangeRequest = () => {
    if (lockedInfo?.changeRequestId) {
      navigate(`/admin/change-requests/${lockedInfo.changeRequestId}`);
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete?.();
    onClose();
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return '-';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color:
            type === 'LOCKED'
              ? 'error.main'
              : type === 'DUPLICATE'
                ? 'error.main'
                : 'warning.main',
        }}
      >
        {type === 'LOCKED' ? <LockIcon /> : <WarningIcon />}
        {type === 'LOCKED'
          ? t('errors.RESOURCE_LOCKED_TITLE')
          : type === 'DUPLICATE'
            ? t('errors.DUPLICATE_ENTRY_TITLE')
            : t('errors.CR_DATA_CONFLICT')}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {type === 'LOCKED' && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {t('errors.RESOURCE_LOCKED', {
                  changeRequestTitle:
                    lockedInfo?.changeRequestTitle || t('common.unknown'),
                })}
              </Typography>

              {lockedInfo?.changeRequestId && (
                <Paper
                  variant="outlined"
                  sx={{ p: 2, mt: 2, bgcolor: 'action.hover' }}
                >
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    {t('auditLogs.resourceId')}: {lockedInfo.changeRequestId}
                  </Typography>
                  {lockedInfo.changeRequestTitle && (
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                      {lockedInfo.changeRequestTitle}
                    </Typography>
                  )}
                </Paper>
              )}
            </Box>
          )}

          {type === 'CONFLICT' && (
            <Box>
              <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
                {t('changeRequest.conflictDialog.description')}
              </Typography>

              <Stack spacing={2}>
                {conflictData?.currentLive && (
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mb: 0.5,
                      }}
                    >
                      <StorageIcon fontSize="small" color="primary" />{' '}
                      {t('changeRequest.conflictDialog.liveData')}
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: 'action.hover',
                        maxHeight: 200,
                        overflow: 'auto',
                      }}
                    >
                      <Typography
                        component="pre"
                        variant="caption"
                        sx={{ whiteSpace: 'pre-wrap' }}
                      >
                        {formatValue(conflictData.currentLive)}
                      </Typography>
                    </Paper>
                  </Box>
                )}

                {conflictData?.originalDraftBase && (
                  <Box>
                    <Typography
                      variant="subtitle2"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        mb: 0.5,
                      }}
                    >
                      <HistoryIcon fontSize="small" color="info" />{' '}
                      {t('changeRequest.conflictDialog.originalData')}
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        bgcolor: 'action.hover',
                        maxHeight: 200,
                        overflow: 'auto',
                      }}
                    >
                      <Typography
                        component="pre"
                        variant="caption"
                        sx={{ whiteSpace: 'pre-wrap' }}
                      >
                        {formatValue(conflictData.originalDraftBase)}
                      </Typography>
                    </Paper>
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {type === 'DUPLICATE' && (
            <Box>
              <Typography variant="body1" gutterBottom sx={{ mb: 2 }}>
                {t('changeRequest.duplicateDialog.description')}
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: (theme) => alpha(theme.palette.error.main, 0.05),
                  borderColor: 'error.main',
                }}
              >
                <Typography
                  variant="subtitle2"
                  color="error"
                  sx={{ mb: 1, fontWeight: 'bold' }}
                >
                  {t('common.details')}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ wordBreak: 'break-all' }}
                >
                  {message}
                </Typography>
              </Paper>
              <Typography
                variant="body2"
                sx={{ mt: 2, color: 'text.secondary' }}
              >
                {t('changeRequest.duplicateDialog.guide')}
              </Typography>
            </Box>
          )}

          {type === 'GENERIC' && (
            <Typography variant="body1">
              {message || t('common.genericError')}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} color="inherit">
          {t('common.close')}
        </Button>
        {(type === 'DUPLICATE' || type === 'CONFLICT') && onDelete && (
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            startIcon={<DeleteIcon />}
          >
            {t('changeRequest.actions.delete')}
          </Button>
        )}
        {type === 'LOCKED' && lockedInfo?.changeRequestId && (
          <Button
            onClick={handleViewChangeRequest}
            variant="contained"
            color="primary"
            endIcon={<ArrowForwardIcon />}
          >
            {t('auditLogs.actions.view')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ApiErrorDialog;
