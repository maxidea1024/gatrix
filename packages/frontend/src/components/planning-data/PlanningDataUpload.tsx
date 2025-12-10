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
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Description as DescriptionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService from '../../services/planningDataService';

interface PlanningDataUploadProps {
  onUploadSuccess?: () => void;
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
  // CashShop data
  { name: 'cashshop-lookup-kr.json', category: 'CashShop', description: 'CashShop (Korean)' },
  { name: 'cashshop-lookup-en.json', category: 'CashShop', description: 'CashShop (English)' },
  { name: 'cashshop-lookup-zh.json', category: 'CashShop', description: 'CashShop (Chinese)' },
];

const REQUIRED_FILES = SUPPORTED_FILES.map(f => f.name);

export const PlanningDataUpload: React.FC<PlanningDataUploadProps> = ({ onUploadSuccess }) => {
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

  const handleUpload = async () => {
    if (filesToUpload.size === 0) {
      enqueueSnackbar(t('planningData.upload.selectFilesToUpload') || 'Please select files to upload', { variant: 'warning' });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      // Filter files to upload
      const filesToUploadArray = selectedFiles.filter((file) => filesToUpload.has(file.name));
      const result = await planningDataService.uploadPlanningData(filesToUploadArray);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Localize the success message with file count
      const localizedMessage = t('planningData.upload.filesUploadedAndCached', {
        count: result.filesUploaded?.length || filesToUploadArray.length,
      });
      enqueueSnackbar(localizedMessage, { variant: 'success' });
      setSelectedFiles([]);
      setFilesToUpload(new Set());

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: any) {
      const errorMessage = error.message || t('planningData.upload.uploadFailed') || 'Upload failed';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setFilesToUpload(new Set());
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
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
            onClick={handleUpload}
            disabled={uploading || filesToUpload.size === 0}
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
    </Box>
  );
};

export default PlanningDataUpload;

