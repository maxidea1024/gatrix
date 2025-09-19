import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormGroup,
  Switch,
  Button,
  Typography,
  Box,
  Divider,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Close as CloseIcon,
  Security as SecurityIcon,
  Visibility as VisibilityIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';

interface PrivacySettingsData {
  channelInvitePolicy: 'everyone' | 'contacts_only' | 'nobody';
  directMessagePolicy: 'everyone' | 'contacts_only' | 'nobody';
  discoverableByEmail: boolean;
  discoverableByName: boolean;
  requireFriendRequest: boolean;
}

interface PrivacySettingsProps {
  open: boolean;
  onClose: () => void;
}

const PrivacySettings: React.FC<PrivacySettingsProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [settings, setSettings] = useState<PrivacySettingsData>({
    channelInvitePolicy: 'everyone',
    directMessagePolicy: 'everyone',
    discoverableByEmail: true,
    discoverableByName: true,
    requireFriendRequest: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 현재 설정 로드
  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/privacy/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(data.data);
        }
      }
    } catch (error) {
      console.error('Failed to load privacy settings:', error);
      enqueueSnackbar('Failed to load privacy settings', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 설정 저장
  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/privacy/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          enqueueSnackbar('Privacy settings saved successfully', { variant: 'success' });
          onClose();
        } else {
          enqueueSnackbar(data.error || 'Failed to save settings', { variant: 'error' });
        }
      } else {
        enqueueSnackbar('Failed to save settings', { variant: 'error' });
      }
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
      enqueueSnackbar('Failed to save settings', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 다이얼로그 열릴 때 설정 로드
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const handlePolicyChange = (field: keyof PrivacySettingsData, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSwitchChange = (field: keyof PrivacySettingsData, checked: boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: checked,
    }));
  };

  const getPolicyDescription = (policy: string) => {
    switch (policy) {
      case 'everyone':
        return 'Anyone can send you invitations or messages';
      case 'contacts_only':
        return 'Only your contacts can send you invitations or messages';
      case 'nobody':
        return 'No one can send you invitations or messages';
      default:
        return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <SecurityIcon />
            <Typography variant="h6">Privacy Settings</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Channel Invitations */}
            <Box mb={3}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <MessageIcon color="primary" />
                <Typography variant="h6">Channel Invitations</Typography>
              </Box>
              <FormControl component="fieldset">
                <FormLabel component="legend">Who can invite you to channels?</FormLabel>
                <RadioGroup
                  value={settings.channelInvitePolicy}
                  onChange={(e) => handlePolicyChange('channelInvitePolicy', e.target.value)}
                >
                  <FormControlLabel
                    value="everyone"
                    control={<Radio />}
                    label="Everyone"
                  />
                  <FormControlLabel
                    value="contacts_only"
                    control={<Radio />}
                    label="Contacts only"
                    disabled // TODO: Enable when contact system is implemented
                  />
                  <FormControlLabel
                    value="nobody"
                    control={<Radio />}
                    label="Nobody"
                  />
                </RadioGroup>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  {getPolicyDescription(settings.channelInvitePolicy)}
                </Typography>
              </FormControl>
            </Box>

            <Divider />

            {/* Direct Messages */}
            <Box my={3}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <MessageIcon color="primary" />
                <Typography variant="h6">Direct Messages</Typography>
              </Box>
              <FormControl component="fieldset">
                <FormLabel component="legend">Who can start direct conversations with you?</FormLabel>
                <RadioGroup
                  value={settings.directMessagePolicy}
                  onChange={(e) => handlePolicyChange('directMessagePolicy', e.target.value)}
                >
                  <FormControlLabel
                    value="everyone"
                    control={<Radio />}
                    label="Everyone"
                  />
                  <FormControlLabel
                    value="contacts_only"
                    control={<Radio />}
                    label="Contacts only"
                    disabled // TODO: Enable when contact system is implemented
                  />
                  <FormControlLabel
                    value="nobody"
                    control={<Radio />}
                    label="Nobody"
                  />
                </RadioGroup>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  {getPolicyDescription(settings.directMessagePolicy)}
                </Typography>
              </FormControl>
            </Box>

            <Divider />

            {/* Discovery Settings */}
            <Box mt={3}>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <VisibilityIcon color="primary" />
                <Typography variant="h6">Discovery Settings</Typography>
              </Box>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.discoverableByEmail}
                      onChange={(e) => handleSwitchChange('discoverableByEmail', e.target.checked)}
                    />
                  }
                  label="Allow others to find me by email"
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 4, mb: 2 }}>
                  When enabled, others can find you by searching your email address
                </Typography>

                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.discoverableByName}
                      onChange={(e) => handleSwitchChange('discoverableByName', e.target.checked)}
                    />
                  }
                  label="Allow others to find me by name"
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
                  When enabled, others can find you by searching your name
                </Typography>
              </FormGroup>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={saveSettings}
          disabled={loading || saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PrivacySettings;
