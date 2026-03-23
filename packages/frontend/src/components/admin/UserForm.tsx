import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Box,
  CircularProgress,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { User, Tag } from '@/types';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import TagSelector from '../common/TagSelector';

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: UserFormData) => Promise<void>;
  user?: User | null;
  loading?: boolean;
}

export interface UserFormData {
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'user';
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  emailVerified: boolean;
  tags: number[];
}

const UserForm: React.FC<UserFormProps> = ({
  open,
  onClose,
  onSubmit,
  user,
  loading = false,
}) => {
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UserFormData>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'user',
      status: 'active',
      emailVerified: true,
      tags: [],
    },
  });



  // User data to form initialization
  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        tags: user.tags?.map((tag) => tag.id) || [],
      });
      setSelectedTags(user.tags || []);
    } else {
      reset({
        name: '',
        email: '',
        password: '',
        role: 'user',
        status: 'active',
        emailVerified: true,
        tags: [],
      });
      setSelectedTags([]);
    }
  }, [user, reset]);

  const handleFormSubmit = async (data: UserFormData) => {
    const formData = {
      ...data,
      tags: selectedTags.map((tag) => tag.id),
    };
    await onSubmit(formData);
  };

  const handleClose = () => {
    reset();
    setSelectedTags([]);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Name */}
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Name is required' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Name"
                  fullWidth
                  error={!!errors.name}
                  helperText={errors.name?.message}
                />
              )}
            />

            {/* Email */}
            <Controller
              name="email"
              control={control}
              rules={{
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address',
                },
              }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Email"
                  type="email"
                  fullWidth
                  error={!!errors.email}
                  helperText={errors.email?.message}
                />
              )}
            />

            {/* Password (only for new users) */}
            {!user && (
              <Controller
                name="password"
                control={control}
                rules={{
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Password"
                    type="password"
                    fullWidth
                    error={!!errors.password}
                    helperText={errors.password?.message}
                  />
                )}
              />
            )}

            {/* Role */}
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select {...field} label="Role">
                    <MenuItem value="user">User</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            {/* Status */}
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select {...field} label="Status">
                    <MenuItem value="pending">Pending</MenuItem>
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="suspended">Suspended</MenuItem>
                    <MenuItem value="deleted">Deleted</MenuItem>
                  </Select>
                </FormControl>
              )}
            />

            {/* Email Verified */}
            <Controller
              name="emailVerified"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Checkbox {...field} checked={field.value} />}
                  label="Email Verified"
                />
              )}
            />

            {/* Tags */}
            <TagSelector
              value={selectedTags}
              onChange={setSelectedTags}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Saving...' : user ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserForm;
