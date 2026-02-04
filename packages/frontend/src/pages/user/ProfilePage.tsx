import React, { useState, useEffect } from 'react';
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
  Stack,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Skeleton,
  alpha,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  PhotoCamera as PhotoCameraIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  Lock as LockIcon,
  Visibility,
  VisibilityOff,
  VpnKey as PermissionIcon,
  Public as EnvironmentIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { AuthService } from '@/services/auth';
import { useSnackbar } from 'notistack';
import { api } from '@/services/api';
import { Permission, getPermissionLabelKey, PERMISSION_CATEGORIES } from '@/types/permissions';
import { formatRelativeTime, formatDateTimeDetailed } from '@/utils/dateFormat';

interface Environment {
  environment: string;
  environmentName: string;
  displayName: string;
  color?: string;
  description?: string;
}

interface UserEnvironmentAccess {
  allowAllEnvironments: boolean;
  environments: string[]; // List of environment names
}

const ProfilePage: React.FC = () => {
  const { user, refreshAuth, permissions } = useAuth();
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

  // Environment access state
  const [environmentAccess, setEnvironmentAccess] = useState<UserEnvironmentAccess | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [envLoading, setEnvLoading] = useState(true);

  // Fetch environment access
  useEffect(() => {
    const fetchEnvironmentAccess = async () => {
      if (!user) return;

      try {
        setEnvLoading(true);
        const [accessResponse, envsResponse] = await Promise.all([
          api.get<UserEnvironmentAccess>('/admin/users/me/environments'),
          api.get<Environment[]>('/admin/environments'),
        ]);
        setEnvironmentAccess(accessResponse.data || null);
        setEnvironments(envsResponse.data || []);
      } catch (error) {
        console.error('Failed to fetch environment access:', error);
      } finally {
        setEnvLoading(false);
      }
    };

    fetchEnvironmentAccess();
  }, [user]);

  if (!user) {
    return (
      <Box
        sx={{ p: 3 }}
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Typography>{t('common.loading')}</Typography>
      </Box>
    );
  }

  // Get accessible environments
  const accessibleEnvironments = environmentAccess?.allowAllEnvironments
    ? environments
    : environments.filter((env) =>
        (
          environmentAccess?.environments ||
          (environmentAccess as any)?.environments ||
          []
        ).includes(env.environment)
      );

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
          enqueueSnackbar(uploadError.message || t('profile.avatarUploadFailed'), {
            variant: 'error',
          });
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
      enqueueSnackbar(error.message || t('profile.updateFailed'), {
        variant: 'error',
      });
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
      enqueueSnackbar(error.message || t('profile.passwordChangeFailed'), {
        variant: 'error',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending':
        return 'warning';
      case 'suspended':
        return 'error';
      default:
        return 'default';
    }
  };

  const getRoleColor = (role: string) => {
    return role === 'admin' ? 'primary' : 'secondary';
  };

  // Get auth type label
  const getAuthTypeLabel = (authType: string) => {
    switch (authType) {
      case 'local':
        return t('auth.providers.local');
      case 'google':
        return t('auth.providers.google');
      case 'github':
        return t('auth.providers.github');
      case 'qq':
        return t('auth.providers.qq');
      case 'wechat':
        return t('auth.providers.wechat');
      case 'baidu':
        return t('auth.providers.baidu');
      default:
        return authType;
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200 }}>
      {/* Profile Header */}
      <Card sx={{ mb: 3, overflow: 'visible' }}>
        <Box
          sx={{
            height: 120,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            borderRadius: 0,
          }}
        />
        <CardContent sx={{ pt: 0, pb: 3, position: 'relative' }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'center', sm: 'flex-start' },
              gap: 2,
            }}
          >
            {/* Avatar */}
            <Box sx={{ position: 'relative', mt: -6 }}>
              <Avatar
                src={avatarPreview || user.avatarUrl}
                sx={{
                  width: 100,
                  height: 100,
                  fontSize: '2.5rem',
                  bgcolor: theme.palette.primary.main,
                  border: `4px solid ${theme.palette.background.paper}`,
                  boxShadow: theme.shadows[4],
                }}
              >
                {!avatarPreview &&
                  !user.avatarUrl &&
                  (user.name || user.email)?.charAt(0).toUpperCase()}
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
                        bottom: 0,
                        right: 0,
                        bgcolor: 'background.paper',
                        border: `2px solid ${theme.palette.divider}`,
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      size="small"
                    >
                      <PhotoCameraIcon fontSize="small" />
                    </IconButton>
                  </label>
                </>
              )}
            </Box>

            {/* User Info */}
            <Box
              sx={{
                flex: 1,
                textAlign: { xs: 'center', sm: 'left' },
                mt: { xs: 1, sm: 2 },
              }}
            >
              {isEditing ? (
                <TextField
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  variant="outlined"
                  size="small"
                  sx={{ mb: 1, minWidth: 200 }}
                />
              ) : (
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {user.name || user.email}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {user.email}
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                justifyContent={{ xs: 'center', sm: 'flex-start' }}
                flexWrap="wrap"
              >
                <Chip
                  icon={<SecurityIcon />}
                  label={t(`roles.${user.role}`)}
                  color={getRoleColor(user.role || '')}
                  size="small"
                />
                <Chip
                  icon={<CheckCircleIcon />}
                  label={t(`users.statuses.${user.status}`)}
                  color={getStatusColor(user.status || '')}
                  size="small"
                  variant="outlined"
                />
              </Stack>
            </Box>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1, mt: { xs: 2, sm: 2 } }}>
              {isEditing ? (
                <>
                  <Button variant="outlined" startIcon={<CancelIcon />} onClick={handleEditToggle}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={
                      isLoading ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />
                    }
                    onClick={handleSave}
                    disabled={isLoading}
                  >
                    {isLoading ? t('common.saving') : t('common.save')}
                  </Button>
                </>
              ) : (
                <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEditToggle}>
                  {t('profile.editProfile')}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Left Column - Account Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          {/* Account Information */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <ScheduleIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('profile.accountInfo')}
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('profile.memberSince')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                  </Typography>
                </Box>
                {user.lastLoginAt && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('profile.lastLogin')}
                    </Typography>
                    <Tooltip title={formatDateTimeDetailed(user.lastLoginAt)} arrow>
                      <Typography variant="body2" sx={{ fontWeight: 500, cursor: 'help' }}>
                        {formatRelativeTime(user.lastLoginAt)}
                      </Typography>
                    </Tooltip>
                  </Box>
                )}
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('profile.authType')}
                  </Typography>
                  <Chip label={getAuthTypeLabel(user.authType)} size="small" variant="outlined" />
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* Security Settings - Only for local users */}
          {user.authType === 'local' && (
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <LockIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {t('profile.security')}
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Button
                  variant="outlined"
                  startIcon={<LockIcon />}
                  onClick={handlePasswordDialogOpen}
                  fullWidth
                >
                  {t('profile.changePassword')}
                </Button>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Right Column - Permissions & Environments */}
        <Grid size={{ xs: 12, md: 6 }}>
          {/* Permissions */}
          {user.role === 'admin' && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <PermissionIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {t('profile.permissions')}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('profile.permissionsDesc')}
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {permissions.includes('*') ? (
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 0,
                      bgcolor: alpha(theme.palette.success.main, 0.1),
                      border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <SecurityIcon sx={{ color: 'success.main' }} />
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, color: 'success.main' }}
                      >
                        {t('profile.superAdminAccess')}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {t('profile.superAdminAccessDesc')}
                    </Typography>
                  </Box>
                ) : permissions.length > 0 ? (
                  <Stack spacing={2}>
                    {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => {
                      const categoryPermissions = category.permissions.filter((p) =>
                        permissions.includes(p)
                      );
                      if (categoryPermissions.length === 0) return null;

                      return (
                        <Box key={categoryKey}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              display: 'block',
                              mb: 1,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                            }}
                          >
                            {t(category.label)}
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 0.75,
                            }}
                          >
                            {categoryPermissions.map((permission) => {
                              const isManage = permission.includes('.manage');
                              const permissionLabel = t(
                                getPermissionLabelKey(permission as Permission)
                              );
                              // Get localized description for tooltip (e.g., permissions.users_view_desc)
                              const descKey = `permissions.${permission.replace('.', '_')}_desc`;
                              const permissionDesc = t(descKey, {
                                defaultValue: '',
                              });
                              return (
                                <Tooltip
                                  key={permission}
                                  title={permissionDesc || permissionLabel}
                                  arrow
                                  placement="top"
                                >
                                  <Box
                                    sx={{
                                      px: 1,
                                      py: 0.5,
                                      borderRadius: 0,
                                      bgcolor: isManage
                                        ? alpha(theme.palette.warning.main, 0.15)
                                        : alpha(theme.palette.primary.main, 0.1),
                                      color: isManage ? 'warning.dark' : 'primary.main',
                                      fontWeight: 500,
                                      fontSize: '0.75rem',
                                      border: `1px solid ${isManage ? alpha(theme.palette.warning.main, 0.3) : alpha(theme.palette.primary.main, 0.2)}`,
                                      cursor: 'default',
                                      '&:hover': {
                                        bgcolor: isManage
                                          ? alpha(theme.palette.warning.main, 0.25)
                                          : alpha(theme.palette.primary.main, 0.15),
                                      },
                                    }}
                                  >
                                    {permissionLabel}
                                  </Box>
                                </Tooltip>
                              );
                            })}
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      color: 'text.secondary',
                    }}
                  >
                    <InfoIcon fontSize="small" />
                    <Typography variant="body2">{t('profile.noPermissions')}</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          )}

          {/* Accessible Environments */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <EnvironmentIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('profile.accessibleEnvironments')}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('profile.accessibleEnvironmentsDesc')}
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {envLoading ? (
                <Stack spacing={1}>
                  <Skeleton variant="rectangular" height={32} width="60%" />
                  <Skeleton variant="rectangular" height={32} width="40%" />
                </Stack>
              ) : environmentAccess?.allowAllEnvironments ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label={t('profile.allEnvironments')}
                  color="success"
                  variant="outlined"
                />
              ) : accessibleEnvironments.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {accessibleEnvironments.map((env) => (
                    <Tooltip
                      key={env.environment}
                      title={env.description || ''}
                      arrow
                      placement="top"
                    >
                      <Chip
                        label={env.displayName || env.environmentName}
                        size="small"
                        sx={{
                          bgcolor: env.color
                            ? alpha(env.color, 0.15)
                            : alpha(theme.palette.info.main, 0.1),
                          color: env.color || 'info.main',
                          fontWeight: 500,
                          borderLeft: `3px solid ${env.color || theme.palette.info.main}`,
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: 'text.secondary',
                  }}
                >
                  <InfoIcon fontSize="small" />
                  <Typography variant="body2">{t('profile.noEnvironments')}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
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
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  currentPassword: e.target.value,
                })
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          current: !showPasswords.current,
                        })
                      }
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
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  newPassword: e.target.value,
                })
              }
              helperText={t('auth.passwordHelp')}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          new: !showPasswords.new,
                        })
                      }
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
              onChange={(e) =>
                setPasswordData({
                  ...passwordData,
                  confirmPassword: e.target.value,
                })
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() =>
                        setShowPasswords({
                          ...showPasswords,
                          confirm: !showPasswords.confirm,
                        })
                      }
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
          <Button onClick={handlePasswordDialogClose}>{t('common.cancel')}</Button>
          <Button
            onClick={handlePasswordChange}
            variant="contained"
            disabled={
              passwordLoading ||
              !passwordData.currentPassword ||
              !passwordData.newPassword ||
              !passwordData.confirmPassword
            }
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
