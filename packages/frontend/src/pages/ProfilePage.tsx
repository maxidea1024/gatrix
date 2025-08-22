import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Avatar,
  Grid,
  // Divider,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  Visibility,
  VisibilityOff,
  PhotoCamera,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Layout } from '@/components/layout/Layout';
import { useAuth } from '@/hooks/useAuth';
// import { useTranslations } from '@/contexts/I18nContext';

// Validation schemas
const profileSchema = yup.object({
  name: yup
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .required('Name is required'),
  avatar_url: yup.string().url('Please enter a valid URL').optional(),
});

const passwordSchema = yup.object({
  currentPassword: yup.string().required('Current password is required'),
  newPassword: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('New password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your password'),
});

const ProfilePage: React.FC = () => {
  const { user, updateProfile, changePassword, isLoading } = useAuth();
  // const { t, profile: profileT, auth } = useTranslations();
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile form
  const profileForm = useForm({
    resolver: yupResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      avatar_url: user?.avatar_url || '',
    },
  });

  // Password form
  const passwordForm = useForm({
    resolver: yupResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const handleProfileSubmit = async (data: { name: string; avatar_url?: string }) => {
    try {
      setErrorMessage(null);
      await updateProfile(data);
      setSuccessMessage(profileT.profileUpdated);
      setIsEditingProfile(false);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to update profile');
    }
  };

  const handlePasswordSubmit = async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      setErrorMessage(null);
      await changePassword(data.currentPassword, data.newPassword);
      setSuccessMessage(profileT.passwordChanged);
      setIsChangingPassword(false);
      passwordForm.reset();
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to change password');
    }
  };

  const handleCancelEdit = () => {
    profileForm.reset({
      name: user?.name || '',
      avatar_url: user?.avatar_url || '',
    });
    setIsEditingProfile(false);
    setErrorMessage(null);
  };

  const handleCancelPasswordChange = () => {
    passwordForm.reset();
    setIsChangingPassword(false);
    setErrorMessage(null);
  };

  if (!user) {
    return (
      <Layout title={profileT.title}>
        <Box sx={{ p: 3 }} display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title={profileT.title}>
      <Box sx={{ p: 3 }}>
        {/* Success/Error Messages */}
        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccessMessage(null)}>
            {successMessage}
          </Alert>
        )}
        
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage(null)}>
            {errorMessage}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Profile Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {profileT.personalInfo}
                  </Typography>
                  {!isEditingProfile && (
                    <IconButton onClick={() => setIsEditingProfile(true)}>
                      <Edit />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                  <Avatar
                    src={user.avatar_url}
                    sx={{ width: 100, height: 100, mb: 2 }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </Avatar>
                  {isEditingProfile && (
                    <IconButton color="primary" component="label">
                      <PhotoCamera />
                      <input type="file" hidden accept="image/*" />
                    </IconButton>
                  )}
                </Box>

                <Box component="form" onSubmit={profileForm.handleSubmit(handleProfileSubmit)}>
                  <Controller
                    name="name"
                    control={profileForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label={auth.name}
                        disabled={!isEditingProfile}
                        error={!!profileForm.formState.errors.name}
                        helperText={profileForm.formState.errors.name?.message}
                        margin="normal"
                      />
                    )}
                  />

                  <TextField
                    fullWidth
                    label={auth.email}
                    value={user.email}
                    disabled
                    margin="normal"
                  />

                  <Controller
                    name="avatar_url"
                    control={profileForm.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Avatar URL"
                        disabled={!isEditingProfile}
                        error={!!profileForm.formState.errors.avatar_url}
                        helperText={profileForm.formState.errors.avatar_url?.message}
                        margin="normal"
                      />
                    )}
                  />

                  {isEditingProfile && (
                    <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                      <Button
                        type="submit"
                        variant="contained"
                        startIcon={<Save />}
                        disabled={isLoading}
                      >
                        {t('common.save')}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Cancel />}
                        onClick={handleCancelEdit}
                      >
                        {t('common.cancel')}
                      </Button>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Account Information */}
          <Grid item xs={12} md={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {profileT.accountInfo}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Role
                    </Typography>
                    <Chip 
                      label={user.role.toUpperCase()} 
                      color={user.role === 'admin' ? 'primary' : 'default'}
                      size="small"
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Status
                    </Typography>
                    <Chip 
                      label={user.status.toUpperCase()} 
                      color={user.status === 'active' ? 'success' : 'warning'}
                      size="small"
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Email Verified
                    </Typography>
                    <Chip 
                      label={user.email_verified ? 'Yes' : 'No'} 
                      color={user.email_verified ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Last Login
                    </Typography>
                    <Typography variant="body2">
                      {user.last_login_at 
                        ? new Date(user.last_login_at).toLocaleString()
                        : 'Never'
                      }
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Member Since
                    </Typography>
                    <Typography variant="body2">
                      {new Date(user.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {profileT.securitySettings}
                  </Typography>
                  {!isChangingPassword && (
                    <Button
                      variant="outlined"
                      onClick={() => setIsChangingPassword(true)}
                    >
                      {profileT.changePassword}
                    </Button>
                  )}
                </Box>

                {isChangingPassword && (
                  <Box component="form" onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}>
                    <Controller
                      name="currentPassword"
                      control={passwordForm.control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={profileT.currentPassword}
                          type={showCurrentPassword ? 'text' : 'password'}
                          error={!!passwordForm.formState.errors.currentPassword}
                          helperText={passwordForm.formState.errors.currentPassword?.message}
                          margin="normal"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                  edge="end"
                                >
                                  {showCurrentPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />

                    <Controller
                      name="newPassword"
                      control={passwordForm.control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={profileT.newPassword}
                          type={showNewPassword ? 'text' : 'password'}
                          error={!!passwordForm.formState.errors.newPassword}
                          helperText={passwordForm.formState.errors.newPassword?.message}
                          margin="normal"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowNewPassword(!showNewPassword)}
                                  edge="end"
                                >
                                  {showNewPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />

                    <Controller
                      name="confirmPassword"
                      control={passwordForm.control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label={profileT.confirmNewPassword}
                          type={showConfirmPassword ? 'text' : 'password'}
                          error={!!passwordForm.formState.errors.confirmPassword}
                          helperText={passwordForm.formState.errors.confirmPassword?.message}
                          margin="normal"
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                  edge="end"
                                >
                                  {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      )}
                    />

                    <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={isLoading}
                      >
                        {profileT.changePassword}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleCancelPasswordChange}
                      >
                        {t('common.cancel')}
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Layout>
  );
};

export default ProfilePage;
