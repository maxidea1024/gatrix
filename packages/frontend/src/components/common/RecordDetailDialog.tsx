import React from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

export interface DetailField {
  key: string;
  labelKey: string;
  /** Optional custom formatter. If not provided, String(value) is used. */
  format?: (value: any) => string;
  /** If true, display value in monospace font */
  mono?: boolean;
}

interface RecordDetailDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  data: Record<string, any> | null;
  fields: DetailField[];
}

const RecordDetailDialog: React.FC<RecordDetailDialogProps> = ({
  open,
  onClose,
  title,
  data,
  fields,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar(t('common.copied'), {
      variant: 'success',
      autoHideDuration: 1500,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        {data && (
          <TableContainer
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              mt: 1,
            }}
          >
            <Table size="small">
              <TableBody>
                {fields.map((field) => {
                  const rawValue = data[field.key];
                  const displayValue =
                    rawValue === null || rawValue === undefined
                      ? '-'
                      : field.format
                        ? field.format(rawValue)
                        : String(rawValue);
                  return (
                    <TableRow
                      key={field.key}
                      sx={{
                        '&:last-child td, &:last-child th': {
                          borderBottom: 0,
                        },
                      }}
                    >
                      <TableCell
                        component="th"
                        scope="row"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          whiteSpace: 'nowrap',
                          width: 160,
                          bgcolor: 'action.hover',
                          borderRight: 1,
                          borderColor: 'divider',
                        }}
                      >
                        {t(field.labelKey)}
                      </TableCell>
                      <TableCell sx={{ borderColor: 'divider' }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontFamily: field.mono ? 'monospace' : undefined,
                              wordBreak: 'break-all',
                            }}
                          >
                            {displayValue}
                          </Typography>
                          {displayValue !== '-' && (
                            <IconButton
                              size="small"
                              onClick={() =>
                                handleCopy(String(rawValue ?? ''))
                              }
                              sx={{
                                opacity: 0.4,
                                '&:hover': { opacity: 1 },
                                ml: 1,
                                flexShrink: 0,
                              }}
                            >
                              <CopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button
          size="small"
          variant="contained"
          startIcon={<CopyIcon />}
          onClick={() => {
            if (data) {
              navigator.clipboard.writeText(JSON.stringify(data, null, 2));
              enqueueSnackbar(t('common.copied'), {
                variant: 'success',
                autoHideDuration: 1500,
              });
            }
          }}
        >
          {t('common.copyJson')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecordDetailDialog;
