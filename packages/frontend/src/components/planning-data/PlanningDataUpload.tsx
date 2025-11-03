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

const REQUIRED_FILES = [
  'reward-lookup.json',
  'reward-type-list.json',
  'reward-localization-kr.json',
  'reward-localization-us.json',
  'reward-localization-cn.json',
  'ui-list-data.json',
  'loctab.json',
];

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
        enqueueSnackbar(`Invalid file: ${file.name}. Expected one of: ${REQUIRED_FILES.join(', ')}`, {
          variant: 'warning',
        });
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
    </Box>
  );
};

export default PlanningDataUpload;

