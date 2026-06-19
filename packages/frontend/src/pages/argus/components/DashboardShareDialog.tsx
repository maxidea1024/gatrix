import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  IconButton,
  TextField,
  Divider,
  Avatar,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Person as PersonIcon,
  Group as GroupIcon,
  Public as PublicIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService from '@/services/argusService';

interface DashboardShareDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  dashboard: {
    id: number;
    title: string;
    owner_user_id?: string | null;
    visibility?: string;
    shared_with?: string[] | string | null;
  };
  onUpdated?: () => void;
}

type Visibility = 'personal' | 'team' | 'project';

const DashboardShareDialog: React.FC<DashboardShareDialogProps> = ({
  open,
  onClose,
  projectId,
  dashboard,
  onUpdated,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const [visibility, setVisibility] = useState<Visibility>('project');
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [newUser, setNewUser] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && dashboard) {
      setVisibility((dashboard.visibility as Visibility) || 'project');
      const sw = dashboard.shared_with;
      if (Array.isArray(sw)) {
        setSharedWith(sw);
      } else if (typeof sw === 'string') {
        try {
          setSharedWith(JSON.parse(sw));
        } catch {
          setSharedWith([]);
        }
      } else {
        setSharedWith([]);
      }
    }
  }, [open, dashboard]);

  const handleAddUser = () => {
    const trimmed = newUser.trim().toLowerCase();
    if (trimmed && !sharedWith.some((u) => u.toLowerCase() === trimmed)) {
      setSharedWith([...sharedWith, trimmed]);
      setNewUser('');
    }
  };

  const handleRemoveUser = (user: string) => {
    setSharedWith(sharedWith.filter((u) => u !== user));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await argusService.updateDashboardSharing(projectId, dashboard.id, {
        visibility,
        shared_with: sharedWith,
      });
      onUpdated?.();
      onClose();
    } catch (err) {
      console.error('Failed to update sharing:', err);
    } finally {
      setSaving(false);
    }
  };

  const visibilityOptions: {
    value: Visibility;
    icon: React.ReactNode;
    label: string;
    desc: string;
  }[] = [
    {
      value: 'personal',
      icon: <PersonIcon />,
      label: t('argus.dashboards.sharing.personal'),
      desc: t('argus.dashboards.sharing.personalDesc'),
    },
    {
      value: 'team',
      icon: <GroupIcon />,
      label: t('argus.dashboards.sharing.team'),
      desc: t('argus.dashboards.sharing.teamDesc'),
    },
    {
      value: 'project',
      icon: <PublicIcon />,
      label: t('argus.dashboards.sharing.project'),
      desc: t('argus.dashboards.sharing.projectDesc'),
    },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: theme.palette.background.paper,
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          {t('argus.dashboards.sharing.title')}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1 }}>
        {/* Owner */}
        {dashboard.owner_user_id && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mb: 0.5, display: 'block' }}
            >
              {t('argus.dashboards.sharing.owner')}
            </Typography>
            <Chip
              avatar={
                <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                  {dashboard.owner_user_id[0]?.toUpperCase()}
                </Avatar>
              }
              label={dashboard.owner_user_id}
              size="small"
              variant="outlined"
            />
          </Box>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Visibility */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          {t('argus.dashboards.sharing.visibility')}
        </Typography>
        <RadioGroup
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as Visibility)}
        >
          {visibilityOptions.map((opt) => (
            <FormControlLabel
              key={opt.value}
              value={opt.value}
              control={<Radio size="small" />}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                    {opt.icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {opt.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {opt.desc}
                    </Typography>
                  </Box>
                </Box>
              }
              sx={{
                mx: 0,
                mb: 0.5,
                p: 1,
                borderRadius: 2,
                border: `1px solid ${visibility === opt.value ? theme.palette.primary.main : 'transparent'}`,
                bgcolor:
                  visibility === opt.value
                    ? alpha(theme.palette.primary.main, 0.04)
                    : 'transparent',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
              }}
            />
          ))}
        </RadioGroup>

        <Divider sx={{ my: 1.5 }} />

        {/* Shared With */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          {t('argus.dashboards.sharing.sharedWith')}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('argus.dashboards.sharing.addUser')}
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            InputProps={{
              startAdornment: (
                <PersonAddIcon
                  sx={{ mr: 1, color: 'text.disabled', fontSize: 18 }}
                />
              ),
            }}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={handleAddUser}
            disabled={!newUser.trim()}
          >
            {t('common.add', 'Add')}
          </Button>
        </Box>
        {sharedWith.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {sharedWith.map((user) => (
              <Chip
                key={user}
                label={user}
                size="small"
                onDelete={() => handleRemoveUser(user)}
                avatar={
                  <Avatar sx={{ width: 20, height: 20, fontSize: 10 }}>
                    {user[0]?.toUpperCase()}
                  </Avatar>
                }
              />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t('argus.dashboards.sharing.noSharedUsers')}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" size="small">
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={saving}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DashboardShareDialog;
