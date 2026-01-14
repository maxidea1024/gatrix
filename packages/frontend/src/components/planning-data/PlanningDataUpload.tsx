import React, { useState, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
  Checkbox,
  ListItemButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Description as DescriptionIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService, { PreviewDiffResult } from '../../services/planningDataService';

interface PlanningDataUploadProps {
  onUploadSuccess?: () => void;
  onClose?: () => void;
}

const SUPPORTED_FILES = [
  // Reward data
  { name: 'reward-type-list.json', category: 'Reward', description: 'Reward type list' },
  { name: 'reward-lookup-kr.json', category: 'Reward', description: 'Reward lookup (Korean)' },
  { name: 'reward-lookup-en.json', category: 'Reward', description: 'Reward lookup (English)' },
  { name: 'reward-lookup-zh.json', category: 'Reward', description: 'Reward lookup (Chinese)' },
  // UI data
  { name: 'ui-list-data-kr.json', category: 'UI', description: 'UI list data (Korean)' },
  { name: 'ui-list-data-en.json', category: 'UI', description: 'UI list data (English)' },
  { name: 'ui-list-data-zh.json', category: 'UI', description: 'UI list data (Chinese)' },
  // Event data - HotTimeBuff
  { name: 'hottimebuff-lookup-kr.json', category: 'Event', description: 'HotTimeBuff (Korean)' },
  { name: 'hottimebuff-lookup-en.json', category: 'Event', description: 'HotTimeBuff (English)' },
  { name: 'hottimebuff-lookup-zh.json', category: 'Event', description: 'HotTimeBuff (Chinese)' },
  // Event data - EventPage
  { name: 'eventpage-lookup-kr.json', category: 'Event', description: 'EventPage (Korean)' },
  { name: 'eventpage-lookup-en.json', category: 'Event', description: 'EventPage (English)' },
  { name: 'eventpage-lookup-zh.json', category: 'Event', description: 'EventPage (Chinese)' },
  // Event data - LiveEvent
  { name: 'liveevent-lookup-kr.json', category: 'Event', description: 'LiveEvent (Korean)' },
  { name: 'liveevent-lookup-en.json', category: 'Event', description: 'LiveEvent (English)' },
  { name: 'liveevent-lookup-zh.json', category: 'Event', description: 'LiveEvent (Chinese)' },
  // Event data - MateRecruiting
  { name: 'materecruiting-lookup-kr.json', category: 'Event', description: 'MateRecruiting (Korean)' },
  { name: 'materecruiting-lookup-en.json', category: 'Event', description: 'MateRecruiting (English)' },
  { name: 'materecruiting-lookup-zh.json', category: 'Event', description: 'MateRecruiting (Chinese)' },
  // Event data - OceanNpcArea
  { name: 'oceannpcarea-lookup-kr.json', category: 'Event', description: 'OceanNpcArea (Korean)' },
  { name: 'oceannpcarea-lookup-en.json', category: 'Event', description: 'OceanNpcArea (English)' },
  { name: 'oceannpcarea-lookup-zh.json', category: 'Event', description: 'OceanNpcArea (Chinese)' },
  // CashShop data (unified multi-language file)
  { name: 'cashshop-lookup.json', category: 'CashShop', description: 'CashShop (Unified Multi-Language)' },
];

const REQUIRED_FILES = SUPPORTED_FILES.map(f => f.name);

export const PlanningDataUpload: React.FC<PlanningDataUploadProps> = ({ onUploadSuccess, onClose }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOverRef = useRef<HTMLDivElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [filesToUpload, setFilesToUpload] = useState<Set<string>>(new Set());
  const [showSupportedFilesDialog, setShowSupportedFilesDialog] = useState(false);
  const [invalidFileName, setInvalidFileName] = useState<string | null>(null);
  const [uploadComment, setUploadComment] = useState('');
  const [showAlreadyUpToDateDialog, setShowAlreadyUpToDateDialog] = useState(false);
  const [forceUploading, setForceUploading] = useState(false);

  // Preview diff state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewDiffResult | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFilesSelected(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFilesSelected(files);
    }
  };

  const handleFilesSelected = (files: File[]) => {
    // Validate file names
    const validFiles = files.filter((file) => {
      if (!REQUIRED_FILES.includes(file.name)) {
        setInvalidFileName(file.name);
        setShowSupportedFilesDialog(true);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      // Auto-check all selected files
      const fileNames = new Set(validFiles.map((f) => f.name));
      setFilesToUpload(fileNames);
    }
  };

  // Called when user clicks "Upload" button - shows preview first
  const handleUpload = async () => {
    if (filesToUpload.size === 0) {
      enqueueSnackbar(t('planningData.upload.selectFilesToUpload') || 'Please select files to upload', { variant: 'warning' });
      return;
    }

    try {
      setIsPreviewLoading(true);

      // Filter files to preview
      const filesToPreviewArray = selectedFiles.filter((file) => filesToUpload.has(file.name));
      const result = await planningDataService.previewDiff(filesToPreviewArray);

      // If no changes, show already up to date dialog
      if (result.changedFiles.length === 0) {
        setShowAlreadyUpToDateDialog(true);
        return;
      }

      // Show preview dialog with changes
      setPreviewResult(result);
      setShowPreviewDialog(true);
    } catch (error: any) {
      const errorMessage = error.message || t('planningData.upload.previewFailed') || 'Preview failed';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Called when user confirms upload from preview dialog
  const handleConfirmUpload = async () => {
    setShowPreviewDialog(false);

    try {
      setUploading(true);
      setUploadProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // Filter files to upload
      const filesToUploadArray = selectedFiles.filter((file) => filesToUpload.has(file.name));
      const result = await planningDataService.uploadPlanningData(filesToUploadArray, uploadComment || undefined);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Check if upload was skipped (no changes)
      if (result.stats?.skipped) {
        setShowAlreadyUpToDateDialog(true);
      } else {
        // Localize the success message with file count
        const localizedMessage = t('planningData.upload.filesUploadedAndCached', {
          count: result.filesUploaded?.length || filesToUploadArray.length,
        });
        enqueueSnackbar(localizedMessage, { variant: 'success' });

        // Only trigger refresh on actual upload
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      }
      setSelectedFiles([]);
      setFilesToUpload(new Set());
      setUploadComment('');
      setPreviewResult(null);
    } catch (error: any) {
      const errorMessage = error.message || t('planningData.upload.uploadFailed') || 'Upload failed';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Force upload - bypasses hash check
  const handleForceUpload = async () => {
    setShowAlreadyUpToDateDialog(false);

    try {
      setForceUploading(true);
      setUploading(true);
      setUploadProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // Filter files to upload
      const filesToUploadArray = selectedFiles.filter((file) => filesToUpload.has(file.name));
      const result = await planningDataService.uploadPlanningData(filesToUploadArray, uploadComment || undefined, true);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Localize the success message with file count
      const localizedMessage = t('planningData.upload.filesUploadedAndCached', {
        count: result.filesUploaded?.length || filesToUploadArray.length,
      });
      enqueueSnackbar(localizedMessage, { variant: 'success' });

      // Trigger refresh
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      setSelectedFiles([]);
      setFilesToUpload(new Set());
      setUploadComment('');
      setPreviewResult(null);
    } catch (error: any) {
      const errorMessage = error.message || t('planningData.upload.uploadFailed') || 'Upload failed';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setForceUploading(false);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handlePreviewDiff = async () => {
    if (filesToUpload.size === 0) {
      enqueueSnackbar(t('planningData.upload.selectFilesToUpload') || 'Please select files to preview', { variant: 'warning' });
      return;
    }

    try {
      setIsPreviewLoading(true);

      // Filter files to preview
      const filesToPreviewArray = selectedFiles.filter((file) => filesToUpload.has(file.name));
      const result = await planningDataService.previewDiff(filesToPreviewArray);

      setPreviewResult(result);
      setShowPreviewDialog(true);
    } catch (error: any) {
      const errorMessage = error.message || t('planningData.upload.previewFailed') || 'Preview failed';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setFilesToUpload(new Set());
    setUploadComment('');
    setPreviewResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleFile = (fileName: string) => {
    const newSet = new Set(filesToUpload);
    if (newSet.has(fileName)) {
      newSet.delete(fileName);
    } else {
      newSet.add(fileName);
    }
    setFilesToUpload(newSet);
  };

  const selectedFileNames = selectedFiles.map((f) => f.name);
  const missingFiles = REQUIRED_FILES.filter((f) => !selectedFileNames.includes(f));

  return (
    <Box>
      {/* Upload Progress */}
      {uploading && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2">
              {t('planningData.upload.uploading') || 'Uploading...'}
            </Typography>
            <Typography variant="body2" color="primary">
              {uploadProgress}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={uploadProgress} />
        </Box>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUploadIcon />
            {t('planningData.upload.title') || 'Upload Planning Data'}
          </Typography>

          {/* Info about data conversion settings */}
          <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
            <Typography variant="body2" component="div">
              {t('planningData.upload.conversionNote') || 'Data is filtered based on country code during conversion.'}
              <Box component="span" sx={{ fontFamily: 'monospace', ml: 1 }}>
                (binaryCode=cn, countryCode=6)
              </Box>
            </Typography>
          </Alert>

          {/* Drag & Drop Area */}
          <Box
            ref={dragOverRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              backgroundColor: dragOver ? 'action.hover' : 'background.paper',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              mb: 2,
            }}
          >
            <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="body1" gutterBottom>
              {t('planningData.upload.dragDrop') || 'Drag and drop files here'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {t('planningData.upload.or') || 'or'}
            </Typography>
            <Button
              variant="outlined"
              component="label"
              disabled={uploading}
            >
              {t('planningData.upload.selectFiles') || 'Select Files'}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleFileInputChange}
                accept=".json"
              />
            </Button>
          </Box>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('planningData.upload.selectedFiles') || 'Selected Files'} ({selectedFiles.length}/{REQUIRED_FILES.length})
              </Typography>
              <Box
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  maxHeight: 300,
                  overflow: 'auto',
                  mb: 2,
                }}
              >
                <List dense sx={{ py: 0 }}>
                  {selectedFiles.map((file) => (
                    <ListItemButton
                      key={file.name}
                      onClick={() => handleToggleFile(file.name)}
                      sx={{
                        py: 1,
                        '&:hover': {
                          backgroundColor: 'action.hover',
                        },
                      }}
                    >
                      <Checkbox
                        edge="start"
                        checked={filesToUpload.has(file.name)}
                        tabIndex={-1}
                        disableRipple
                        sx={{ mr: 1 }}
                      />
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / 1024 / 1024).toFixed(2)} MB`}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>

              {/* Missing Files */}
              {missingFiles.length > 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    {t('planningData.upload.missingFiles') || 'Missing files'}:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {missingFiles.map((file) => (
                      <Chip key={file} label={file} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Alert>
              )}

              {/* Upload Comment */}
              <TextField
                fullWidth
                multiline
                rows={3}
                label={t('planningData.upload.comment') || 'Upload Comment'}
                placeholder={t('planningData.upload.commentPlaceholder') || 'Optional comment about this upload'}
                value={uploadComment}
                onChange={(e) => setUploadComment(e.target.value)}
                disabled={uploading}
                sx={{ mt: 2 }}
              />
            </Box>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={(uploading || isPreviewLoading) ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              onClick={handleUpload}
              disabled={uploading || isPreviewLoading || filesToUpload.size === 0}
            >
              {t('planningData.upload.upload') || 'Upload'} ({filesToUpload.size})
            </Button>
            <Button
              variant="outlined"
              onClick={handleClear}
              disabled={uploading || selectedFiles.length === 0}
            >
              {t('common.clear') || 'Clear'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Supported Files Dialog */}
      <Dialog
        open={showSupportedFilesDialog}
        onClose={() => setShowSupportedFilesDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {invalidFileName ? `인식할 수 없는 파일입니다: ${invalidFileName}` : '지원하는 파일 목록'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              다음 파일들을 업로드할 수 있습니다:
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>파일명</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>카테고리</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>설명</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {SUPPORTED_FILES.map((file) => (
                    <TableRow key={file.name}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {file.name}
                      </TableCell>
                      <TableCell>
                        <Chip label={file.category} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{file.description}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSupportedFilesDialog(false)} variant="contained">
            확인
          </Button>
        </DialogActions>
      </Dialog>

      {/* Already Up To Date Dialog */}
      <Dialog
        open={showAlreadyUpToDateDialog}
        onClose={() => {
          setShowAlreadyUpToDateDialog(false);
          if (onClose) onClose();
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="info" />
          {t('planningData.upload.alreadyUpToDateTitle') || 'Already Up To Date'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('planningData.upload.alreadyUpToDate') || 'The data is already up to date. No changes were detected.'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            {t('planningData.upload.forceUploadHint') || 'If you want to re-upload the data anyway, use the Force Upload button.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setShowAlreadyUpToDateDialog(false);
              if (onClose) onClose();
            }}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleForceUpload}
            disabled={forceUploading}
            startIcon={forceUploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          >
            {t('planningData.upload.forceUpload') || 'Force Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Preview Diff Dialog */}
      <Dialog
        open={showPreviewDialog}
        onClose={() => setShowPreviewDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="info" />
          {t('planningData.upload.previewChangesTitle') || 'Preview Changes'}
        </DialogTitle>
        <DialogContent sx={{ maxHeight: '70vh' }}>
          {previewResult && (
            <Box>
              {/* Summary */}
              <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  label={`${previewResult.changedFiles.length} ${t('planningData.upload.filesChanged') || 'files changed'}`}
                  color={previewResult.changedFiles.length > 0 ? 'warning' : 'default'}
                />
                <Chip
                  label={`+${previewResult.summary.totalAdded} ${t('planningData.history.added') || 'added'}`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  label={`-${previewResult.summary.totalRemoved} ${t('planningData.history.removed') || 'removed'}`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  label={`~${previewResult.summary.totalModified} ${t('planningData.history.modified') || 'modified'}`}
                  color="warning"
                  variant="outlined"
                />
              </Box>

              {previewResult.changedFiles.length === 0 ? (
                <Alert severity="info">
                  {t('planningData.upload.noChangesDetected') || 'No changes detected. The data is already up to date.'}
                </Alert>
              ) : (
                <Box>
                  {Object.entries(previewResult.fileDiffs).map(([fileName, fileDiff]) => (
                    <Box key={fileName} sx={{ mb: 3 }}>
                      <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                        📄 {fileName}
                      </Typography>

                      {/* Modified items */}
                      {fileDiff.modified?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                            ~ {t('planningData.history.modified')}: {fileDiff.modified.length}
                          </Typography>
                          <Box
                            component="table"
                            sx={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              border: '1px dashed',
                              borderColor: 'divider',
                              '& th, & td': {
                                borderBottom: '1px dashed',
                                borderRight: '1px dashed',
                                borderColor: 'divider',
                                p: 0.5,
                                textAlign: 'left',
                              },
                              '& th:last-child, & td:last-child': {
                                borderRight: 'none',
                              },
                              '& th': {
                                bgcolor: 'action.hover',
                                fontWeight: 'bold',
                              },
                              '& tbody tr:nth-of-type(odd)': {
                                bgcolor: 'rgba(255, 255, 255, 0.02)',
                              },
                            }}
                          >
                            <thead>
                              <tr>
                                <Box component="th" sx={{ width: '35%' }}>{t('planningData.history.path')}</Box>
                                <Box component="th" sx={{ width: '32%', color: 'error.main' }}>{t('planningData.history.before')}</Box>
                                <Box component="th" sx={{ width: '32%', color: 'success.main' }}>{t('planningData.history.after')}</Box>
                              </tr>
                            </thead>
                            <tbody>
                              {fileDiff.modified.slice(0, 10).map((item, idx) => (
                                <tr key={idx}>
                                  <td>{item.path}</td>
                                  <Box component="td" sx={{ color: 'error.main', textDecoration: 'line-through', wordBreak: 'break-all' }}>
                                    {typeof item.before === 'string' ? item.before : JSON.stringify(item.before)}
                                  </Box>
                                  <Box component="td" sx={{ color: 'success.main', wordBreak: 'break-all' }}>
                                    {typeof item.after === 'string' ? item.after : JSON.stringify(item.after)}
                                  </Box>
                                </tr>
                              ))}
                            </tbody>
                          </Box>
                          {fileDiff.modified.length > 10 && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              +{fileDiff.modified.length - 10} more...
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Added items */}
                      {fileDiff.added?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="success.main" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                            + {t('planningData.history.added')}: {fileDiff.added.length}
                          </Typography>
                          <Box
                            component="table"
                            sx={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              border: '1px dashed',
                              borderColor: 'divider',
                              '& th, & td': {
                                borderBottom: '1px dashed',
                                borderRight: '1px dashed',
                                borderColor: 'divider',
                                p: 0.5,
                                textAlign: 'left',
                              },
                              '& th:last-child, & td:last-child': {
                                borderRight: 'none',
                              },
                              '& th': {
                                bgcolor: 'action.hover',
                                fontWeight: 'bold',
                              },
                              '& tbody tr:nth-of-type(odd)': {
                                bgcolor: 'rgba(255, 255, 255, 0.02)',
                              },
                            }}
                          >
                            <thead>
                              <tr>
                                <Box component="th" sx={{ width: '40%' }}>{t('planningData.history.path')}</Box>
                                <Box component="th" sx={{ color: 'success.main' }}>{t('planningData.history.value')}</Box>
                              </tr>
                            </thead>
                            <tbody>
                              {fileDiff.added.slice(0, 10).map((item, idx) => (
                                <tr key={idx}>
                                  <td>{item.path}</td>
                                  <Box component="td" sx={{ color: 'success.main', wordBreak: 'break-all' }}>
                                    {typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}
                                  </Box>
                                </tr>
                              ))}
                            </tbody>
                          </Box>
                          {fileDiff.added.length > 10 && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              +{fileDiff.added.length - 10} more...
                            </Typography>
                          )}
                        </Box>
                      )}

                      {/* Removed items */}
                      {fileDiff.removed?.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="caption" color="error.main" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                            − {t('planningData.history.removed')}: {fileDiff.removed.length}
                          </Typography>
                          <Box
                            component="table"
                            sx={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              border: '1px dashed',
                              borderColor: 'divider',
                              '& th, & td': {
                                borderBottom: '1px dashed',
                                borderRight: '1px dashed',
                                borderColor: 'divider',
                                p: 0.5,
                                textAlign: 'left',
                              },
                              '& th:last-child, & td:last-child': {
                                borderRight: 'none',
                              },
                              '& th': {
                                bgcolor: 'action.hover',
                                fontWeight: 'bold',
                              },
                              '& tbody tr:nth-of-type(odd)': {
                                bgcolor: 'rgba(255, 255, 255, 0.02)',
                              },
                            }}
                          >
                            <thead>
                              <tr>
                                <Box component="th" sx={{ width: '40%' }}>{t('planningData.history.path')}</Box>
                                <Box component="th" sx={{ color: 'error.main' }}>{t('planningData.history.value')}</Box>
                              </tr>
                            </thead>
                            <tbody>
                              {fileDiff.removed.slice(0, 10).map((item, idx) => (
                                <tr key={idx}>
                                  <td>{item.path}</td>
                                  <Box component="td" sx={{ color: 'error.main', textDecoration: 'line-through', wordBreak: 'break-all' }}>
                                    {typeof item.value === 'string' ? item.value : JSON.stringify(item.value)}
                                  </Box>
                                </tr>
                              ))}
                            </tbody>
                          </Box>
                          {fileDiff.removed.length > 10 && (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              +{fileDiff.removed.length - 10} more...
                            </Typography>
                          )}
                        </Box>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setShowPreviewDialog(false)}>
            {t('common.cancel') || 'Cancel'}
          </Button>
          {previewResult && previewResult.changedFiles.length > 0 && (
            <Button
              variant="contained"
              startIcon={<CloudUploadIcon />}
              onClick={handleConfirmUpload}
            >
              {t('common.apply') || 'Apply'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlanningDataUpload;

