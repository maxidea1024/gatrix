import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Grid,
  Chip,
  Button,
  TextField,
  IconButton,
  Divider,
  Paper,
  Stack,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';
import { useSnackbar } from 'notistack';
import { api } from '@/services/api';

const ProfilePage: React.FC = () => {
  const { user, refreshAuth } = useAuth();
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password change dialog state
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  if (!user) {
    return (
      <Box sx={{ p: 3 }} display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  const handleEditToggle = () => {
    if (isEditing) {
      setEditedName(user.name || '');
      setAvatarFile(null);
      setAvatarPreview(null);
    }
    setIsEditing(!isEditing);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        enqueueSnackbar(t('profile.invalidFileType'), { variant: 'error' });
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        enqueueSnackbar(t('profile.fileTooLarge'), { variant: 'error' });
        return;
      }

      setAvatarFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!editedName.trim()) {
      enqueueSnackbar(t('profile.nameRequired'), { variant: 'error' });
      return;
    }

    setIsLoading(true);
    try {
      let avatarUrl = user?.avatarUrl;

      // Upload avatar if a new file is selected
      if (avatarFile) {
        try {
          const uploadResponse = await api.upload('/upload/avatar', avatarFile, 'avatar');
          avatarUrl = uploadResponse.data.url;
          enqueueSnackbar(t('profile.avatarUploaded'), { variant: 'success' });
        } catch (uploadError: any) {
          enqueueSnackbar(uploadError.message || t('profile.avatarUploadFailed'), { variant: 'error' });
          return;
        }
      }

      // Update profile
      const updateData: any = { name: editedName.trim() };
      if (avatarUrl && avatarUrl !== user?.avatarUrl) {
        updateData.avatarUrl = avatarUrl;
      }

      await AuthService.updateProfile(updateData);
      await refreshAuth(); // 사용자 정보 새로고침
      enqueueSnackbar(t('profile.profileUpdated'), { variant: 'success' });
      setIsEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('profile.updateFailed'), { variant: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Password change handlers
  const handlePasswordDialogOpen = () => {
    setPasswordDialog(true);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  };

  const handlePasswordDialogClose = () => {
    setPasswordDialog(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setShowPasswords({
      current: false,
      new: false,
      confirm: false,
    });
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      enqueueSnackbar(t('auth.passwordsNotMatch'), { variant: 'error' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      enqueueSnackbar(t('auth.passwordTooShort'), { variant: 'error' });
      return;
    }

    setPasswordLoading(true);
    try {
      await AuthService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      enqueueSnackbar(t('profile.passwordChanged'), { variant: 'success' });
      handlePasswordDialogClose();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('profile.passwordChangeFailed'), { variant: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'primary' : 'secondary';
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          mb: 4,
          background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}15 100%)`,
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box sx={{ position: 'relative' }}>
              <Avatar
                src={avatarPreview || user.avatarUrl}
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '2rem',
                  bgcolor: theme.palette.primary.main,
                  border: `3px solid ${theme.palette.background.paper}`,
                  boxShadow: theme.shadows[3]
                }}
              >
                {!avatarPreview && !user.avatarUrl && (user.name || user.email)?.charAt(0).toUpperCase()}
              </Avatar>
              {isEditing && (
                <>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="avatar-upload"
                    type="file"
                    onChange={handleAvatarChange}
                  />
                  <label htmlFor="avatar-upload">
                    <IconButton
                      component="span"
                      sx={{
                        position: 'absolute',
                        bottom: -5,
                        right: -5,
                        bgcolor: 'background.paper',
                        border: `2px solid ${theme.palette.divider}`,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      size="small"
                    >
                      <PhotoCameraIcon fontSize="small" />
                    </IconButton>
                  </label>
                </>
              )}
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                {user.name || user.email}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Chip
                  icon={<SecurityIcon />}
                  label={user.role?.toUpperCase()}
                  color={getRoleColor(user.role || '')}
                  size="small"
                  variant="filled"
                />
                <Chip
                  label={user.status?.toUpperCase() || t('dashboard.unknown').toUpperCase()}
                  color={getStatusColor(user.status || '')}
                  size="small"
                  variant="outlined"
                />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                {t('profile.memberSince')}: {user.created_at ? new Date(user.created_at).toLocaleDateString() : t('dashboard.unknown')}
              </Typography>
            </Box>
          </Box>
          <Button
            variant={isEditing ? "outlined" : "contained"}
            startIcon={isEditing ? <CancelIcon /> : <EditIcon />}
            onClick={handleEditToggle}
            sx={{ minWidth: 120 }}
          >
            {isEditing ? t('common.cancel') : t('profile.editProfile')}
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid size={{ xs: 12 , md: 8 }}>
          <Card sx={{ height: 'fit-content' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('profile.personalInfo')}
                </Typography>
              </Box>

              <Stack spacing={3}>
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('profile.name')}
                  </Typography>
                  {isEditing ? (
                    <TextField
                      fullWidth
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      variant="outlined"
                      size="small"
                    />
                  ) : (
                    <Typography variant="body1" sx={{ py: 1 }}>
                      {user.name || user.email}
                    </Typography>
                  )}
                </Box>

                <Divider />

                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <EmailIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                    {t('auth.email')}
                  </Typography>
                  <Typography variant="body1" sx={{ py: 1 }}>
                    {user.email}
                  </Typography>
                </Box>

                {isEditing && (
                  <Box sx={{ pt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                      onClick={handleSave}
                      disabled={isLoading}
                      sx={{ mr: 1 }}
                    >
                      {isLoading ? t('common.saving') : t('common.save')}
                    </Button>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Account Information */}
        <Grid size={{ xs: 12 , md: 4 }}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('profile.accountInfo')}
                </Typography>
              </Box>

              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('profile.memberSince')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                  </Typography>
                </Box>

                {user.last_login_at && (
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('profile.lastLogin')}
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                      {new Date(user.last_login_at).toLocaleString()}
                    </Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('users.role')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {user.role}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('users.status')}
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {user.status}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Security Settings - Only for local users */}
          {user.authType === 'local' && (
            <Card sx={{ mt: 2 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <SecurityIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {t('profile.security')}
                  </Typography>
                </Box>

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t('profile.password')}
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<LockIcon />}
                      onClick={handlePasswordDialogOpen}
                      size="small"
                    >
                      {t('profile.changePassword')}
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Password Change Dialog */}
      <Dialog open={passwordDialog} onClose={handlePasswordDialogClose} maxWidth="sm" fullWidth>
        <DialogTitle>{t('profile.changePassword')}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label={t('profile.currentPassword')}
              type={showPasswords.current ? 'text' : 'password'}
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      edge="end"
                    >
                      {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label={t('profile.newPassword')}
              type={showPasswords.new ? 'text' : 'password'}
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              helperText={t('auth.passwordHelp')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      edge="end"
                    >
                      {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label={t('profile.confirmNewPassword')}
              type={showPasswords.confirm ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      edge="end"
                    >
                      {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePasswordDialogClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handlePasswordChange}
            variant="contained"
            disabled={passwordLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
            startIcon={passwordLoading ? <CircularProgress size={16} /> : undefined}
          >
            {passwordLoading ? t('common.saving') : t('profile.changePassword')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfilePage;
