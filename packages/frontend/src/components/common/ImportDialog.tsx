import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Upload as UploadIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import {
  parseImportFile,
  getAcceptedFileTypes,
  getSupportedFormatsLabel,
} from '../../utils/exportImportUtils';

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: Record<string, any>[]) => void;
  title?: string;
  jsonOnly?: boolean;
}

const MAX_PREVIEW_ROWS = 5;
const MAX_PREVIEW_COLS = 6;

const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onClose,
  onImport,
  title,
  jsonOnly = false,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const resetState = useCallback(() => {
    setFile(null);
    setParsedData([]);
    setError(null);
    setParsing(false);
    setIsDragOver(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const processFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setError(null);
      setParsing(true);
      try {
        const data = await parseImportFile(selectedFile);
        setParsedData(data);
      } catch (err: any) {
        setError(err.message || t('common.importFailed'));
        setParsedData([]);
      } finally {
        setParsing(false);
      }
    },
    [t]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      if (selectedFile) {
        processFile(selectedFile);
      }
      // Reset input value so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const droppedFile = event.dataTransfer.files?.[0];
      if (droppedFile) {
        processFile(droppedFile);
      }
    },
    [processFile]
  );

  const handleImport = useCallback(() => {
    if (parsedData.length > 0) {
      onImport(parsedData);
      handleClose();
    }
  }, [parsedData, onImport, handleClose]);

  // Get preview columns
  const previewColumns =
    parsedData.length > 0
      ? Object.keys(parsedData[0]).slice(0, MAX_PREVIEW_COLS)
      : [];
  const totalColumns =
    parsedData.length > 0 ? Object.keys(parsedData[0]).length : 0;
  const previewRows = parsedData.slice(0, MAX_PREVIEW_ROWS);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title || t('common.import')}</DialogTitle>
      <DialogContent>
        {/* Drop zone */}
        <Box
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: isDragOver ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: isDragOver ? 'action.hover' : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.light',
              bgcolor: 'action.hover',
            },
            mb: 2,
          }}
        >
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" gutterBottom>
            {t('common.dragDropOrSelect')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('common.supportedFormats')}: {getSupportedFormatsLabel(jsonOnly)}
          </Typography>
        </Box>

        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptedFileTypes(jsonOnly)}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Loading */}
        {parsing && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* File info & Preview */}
        {file && parsedData.length > 0 && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <FileIcon color="primary" />
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {file.name}
              </Typography>
              <Chip
                label={t('common.rowCount', { count: parsedData.length })}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Button
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  resetState();
                }}
              >
                {t('common.clear')}
              </Button>
            </Box>

            <Typography variant="subtitle2" gutterBottom>
              {t('common.filePreview')}
            </Typography>
            <TableContainer sx={{ maxHeight: 250, mb: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {previewColumns.map((col) => (
                      <TableCell
                        key={col}
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </TableCell>
                    ))}
                    {totalColumns > MAX_PREVIEW_COLS && (
                      <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
                        ...+{totalColumns - MAX_PREVIEW_COLS}
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, idx) => (
                    <TableRow key={idx}>
                      {previewColumns.map((col) => (
                        <TableCell
                          key={col}
                          sx={{
                            fontSize: '0.75rem',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {typeof row[col] === 'object'
                            ? JSON.stringify(row[col])
                            : String(row[col] ?? '')}
                        </TableCell>
                      ))}
                      {totalColumns > MAX_PREVIEW_COLS && (
                        <TableCell
                          sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
                        >
                          ...
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {parsedData.length > MAX_PREVIEW_ROWS && (
              <Typography variant="caption" color="text.secondary">
                {t('common.rowCount', {
                  count: parsedData.length - MAX_PREVIEW_ROWS,
                })}{' '}
                {t('common.more')}...
              </Typography>
            )}

            <Alert severity="warning" sx={{ mt: 2 }}>
              {t('common.importConfirmMessage')}
            </Alert>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={parsedData.length === 0 || parsing}
          startIcon={<UploadIcon />}
        >
          {t('common.importAndOverwrite')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog;
