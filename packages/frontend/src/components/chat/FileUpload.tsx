import React, { useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Alert,
} from '@mui/material';
import {
  AttachFile as AttachIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  InsertDriveFile as FileIcon,
  LocationOn as LocationIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  onLocationShare?: (location: { latitude: number; longitude: number; name?: string; address?: string }) => void;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  multiple?: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  onLocationShare,
  maxFileSize = 10,
  allowedTypes = ['image/*', 'video/*', 'audio/*', 'application/*', 'text/*'],
  multiple = true,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [locationDialog, setLocationDialog] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFileInputClick = (accept?: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept || allowedTypes.join(',');
      fileInputRef.current.click();
    }
    handleMenuClose();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    // Validate file sizes
    const oversizedFiles = files.filter(file => file.size > maxFileSize * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      enqueueSnackbar(
        t('chat.fileTooLarge', 'File is too large. Maximum size is {{size}}MB', { size: maxFileSize }),
        { variant: 'error' }
      );
      return;
    }

    // Validate file types
    const invalidFiles = files.filter(file => {
      return !allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1));
        }
        return file.type === type;
      });
    });

    if (invalidFiles.length > 0) {
      enqueueSnackbar(
        t('chat.unsupportedFileType', 'Unsupported file type'),
        { variant: 'error' }
      );
      return;
    }

    onFileSelect(files);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLocationShare = async () => {
    setLocationDialog(true);
    setGettingLocation(true);
    handleMenuClose();

    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported');
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });

      const { latitude, longitude } = position.coords;
      
      // Try to get address using reverse geocoding (optional)
      let address = '';
      try {
        const response = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        const data = await response.json();
        address = data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      } catch {
        address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }

      if (onLocationShare) {
        onLocationShare({
          latitude,
          longitude,
          name: t('chat.currentLocation', 'Current Location'),
          address,
        });
      }

      setLocationDialog(false);
      enqueueSnackbar(
        t('chat.locationShared', 'Location shared successfully'),
        { variant: 'success' }
      );
    } catch (error) {
      console.error('Error getting location:', error);
      enqueueSnackbar(
        t('chat.locationError', 'Failed to get location. Please check your permissions.'),
        { variant: 'error' }
      );
      setLocationDialog(false);
    } finally {
      setGettingLocation(false);
    }
  };

  const menuItems = [
    {
      icon: <ImageIcon />,
      label: t('chat.uploadImage', 'Upload Image'),
      accept: 'image/*',
      onClick: () => handleFileInputClick('image/*'),
    },
    {
      icon: <VideoIcon />,
      label: t('chat.uploadVideo', 'Upload Video'),
      accept: 'video/*',
      onClick: () => handleFileInputClick('video/*'),
    },
    {
      icon: <AudioIcon />,
      label: t('chat.uploadAudio', 'Upload Audio'),
      accept: 'audio/*',
      onClick: () => handleFileInputClick('audio/*'),
    },
    {
      icon: <FileIcon />,
      label: t('chat.uploadFile', 'Upload File'),
      accept: undefined,
      onClick: () => handleFileInputClick(),
    },
    {
      icon: <LocationIcon />,
      label: t('chat.shareLocation', 'Share Location'),
      onClick: handleLocationShare,
    },
  ];

  return (
    <>
      <IconButton
        size="small"
        onClick={handleMenuOpen}
        sx={{ color: 'text.secondary' }}
      >
        <AttachIcon />
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        {menuItems.map((item, index) => (
          <MenuItem key={index} onClick={item.onClick}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Location Dialog */}
      <Dialog open={locationDialog} onClose={() => setLocationDialog(false)}>
        <DialogTitle>
          {t('chat.shareLocation', 'Share Location')}
        </DialogTitle>
        <DialogContent>
          {gettingLocation ? (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                {t('chat.gettingLocation', 'Getting your location...')}
              </Typography>
              <LinearProgress />
            </Box>
          ) : (
            <Alert severity="info">
              {t('chat.locationPermission', 'Please allow location access to share your current location.')}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLocationDialog(false)} startIcon={<CancelIcon />}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <Box sx={{ position: 'fixed', bottom: 16, right: 16, width: 300 }}>
          <Alert severity="info">
            <Typography variant="body2">
              {t('chat.uploading', 'Uploading...')} {uploadProgress}%
            </Typography>
            <LinearProgress variant="determinate" value={uploadProgress} sx={{ mt: 1 }} />
          </Alert>
        </Box>
      )}
    </>
  );
};

export default FileUpload;
