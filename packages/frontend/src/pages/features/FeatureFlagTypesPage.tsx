import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { PERMISSIONS } from '../../types/permissions';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Stack,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  FormHelperText,
} from '@mui/material';
import {
  Edit as EditIcon,
  Refresh as RefreshIcon,
  RocketLaunch as ReleaseIcon,
  Science as ExperimentIcon,
  Build as OperationalIcon,
  PowerSettingsNew as KillSwitchIcon,
  VpnKey as PermissionIcon,
  Category as DefaultIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import api from '../../services/api';
import ResizableDrawer from '../../components/common/ResizableDrawer';
import { getFlagTypeIconByName } from '../../utils/flagTypeIcons';

interface FlagType {
  flagType: string;
  displayName: string;
  description: string | null;
  lifetimeDays: number | null;
  iconName: string | null;
  sortOrder: number;
}

// Icon mapping
const getTypeIcon = (iconName: string | null) => getFlagTypeIconByName(iconName);

const FeatureFlagTypesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.FEATURE_FLAGS_MANAGE]);

  // State
  const [types, setTypes] = useState<FlagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<FlagType | null>(null);
  const [saving, setSaving] = useState(false);

  // Load types
  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/features/types');
      setTypes(response.data?.types || []);
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, t('common.loadFailed')), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, t]);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  // Edit handler
  const handleEdit = (type: FlagType) => {
    setEditingType({ ...type });
    setEditDialogOpen(true);
  };

  // Save handler
  const handleSave = async () => {
    if (!editingType || !canManage) return;

    setSaving(true);
    try {
      await api.put(`/admin/features/types/${editingType.flagType}`, {
        lifetimeDays: editingType.lifetimeDays,
      });
      enqueueSnackbar(t('common.saveSuccess'), { variant: 'success' });
      setEditDialogOpen(false);
      setEditingType(null);
      loadTypes();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, t('common.saveFailed')), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Format lifetime display
  const formatLifetime = (days: number | null) => {
    if (days === null) return t('featureFlags.doesntExpire');
    return t('featureFlags.daysCount', { count: days });
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 3,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            fontWeight={600}
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <DefaultIcon color="primary" />
            {t('featureFlags.flagTypes')}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t('featureFlags.flagTypesDescription')}
          </Typography>
        </Box>
        <Tooltip title={t('common.refresh')}>
          <span>
            <IconButton onClick={loadTypes} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Types Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell align="center">{t('featureFlags.lifetime')}</TableCell>
                  {canManage && <TableCell align="center">{t('common.actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {types.map((type) => (
                  <TableRow key={type.flagType} hover>
                    <TableCell>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.5,
                        }}
                      >
                        {getTypeIcon(type.iconName)}
                        <Box>
                          <Typography fontWeight={500}>
                            {t(`featureFlags.flagTypes.${type.flagType}`, type.displayName)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t(
                              `featureFlags.flagTypes.${type.flagType}.desc`,
                              type.description || ''
                            )}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Typography
                        variant="body2"
                        color={type.lifetimeDays === null ? 'text.secondary' : 'text.primary'}
                      >
                        {formatLifetime(type.lifetimeDays)}
                      </Typography>
                    </TableCell>
                    {canManage && (
                      <TableCell align="center">
                        <Tooltip
                          title={
                            type.flagType === 'remoteConfig'
                              ? t('featureFlags.systemTypeCannotEdit')
                              : t('common.edit')
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => handleEdit(type)}
                              disabled={type.flagType === 'remoteConfig'}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Edit Drawer */}
      <ResizableDrawer
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        title={`${t('common.edit')}: ${editingType ? t(`featureFlags.flagTypes.${editingType.flagType}`, editingType.displayName) : ''}`}
        subtitle={t('featureFlags.editFlagTypeSubtitle')}
        storageKey="featureFlagTypeDrawerWidth"
        defaultWidth={400}
      >
        <Box sx={{ p: 3, flex: 1, overflow: 'auto' }}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                {t('featureFlags.expectedLifetime')}
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editingType?.lifetimeDays === null}
                    onChange={(e) =>
                      setEditingType((prev) =>
                        prev
                          ? {
                              ...prev,
                              lifetimeDays: e.target.checked ? null : 40,
                            }
                          : prev
                      )
                    }
                  />
                }
                label={t('featureFlags.doesntExpire')}
              />
              <FormHelperText sx={{ ml: 0, mt: -0.5 }}>
                {t('featureFlags.lifetimeHelp')}
              </FormHelperText>
            </Box>

            {editingType?.lifetimeDays !== null && (
              <TextField
                type="number"
                label={t('featureFlags.lifetimeInDays')}
                value={editingType?.lifetimeDays || ''}
                onChange={(e) =>
                  setEditingType((prev) =>
                    prev ? { ...prev, lifetimeDays: parseInt(e.target.value) || 0 } : prev
                  )
                }
                inputProps={{ min: 1, max: 365 }}
                size="small"
                sx={{ width: 180 }}
              />
            )}
          </Stack>
        </Box>

        {/* Footer Actions */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button variant="outlined" onClick={() => setEditDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {t('featureFlags.saveFlagType')}
          </Button>
        </Box>
      </ResizableDrawer>
    </Box>
  );
};

export default FeatureFlagTypesPage;
