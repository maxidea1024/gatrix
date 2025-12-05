import React from 'react';
import {
  Box,
  Typography,
  Checkbox,
  Chip,
  CircularProgress,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  alpha,
  useTheme,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as UncheckedIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Permission } from '@/types';
import { PERMISSION_CATEGORIES, ALL_PERMISSIONS } from '@/types/permissions';

export interface Environment {
  id: string;
  name: string;
  displayName?: string;
  environmentName?: string;
}

interface PermissionSelectorProps {
  permissions: Permission[];
  onChange: (permissions: Permission[]) => void;
  loading?: boolean;
  showTitle?: boolean;
  showSelectAll?: boolean;
  showPermissionCategories?: boolean; // Show permission categories (default: true)
  // Environment access props
  environments?: Environment[];
  allowAllEnvs?: boolean;
  selectedEnvIds?: string[];
  onAllowAllEnvsChange?: (allowAll: boolean) => void;
  onEnvIdsChange?: (envIds: string[]) => void;
  showEnvironments?: boolean;
}

// Convert PERMISSION_CATEGORIES object to array for iteration
const categoryEntries = Object.entries(PERMISSION_CATEGORIES).map(([id, category]) => ({
  id,
  ...category,
}));

/**
 * Reusable permission selector component
 * Used in user edit dialog and promote user dialog
 */
const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  permissions,
  onChange,
  loading = false,
  showTitle = true,
  showSelectAll = true,
  showPermissionCategories = true,
  environments = [],
  allowAllEnvs = false,
  selectedEnvIds = [],
  onAllowAllEnvsChange,
  onEnvIdsChange,
  showEnvironments = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const handleCategoryToggle = (categoryPermissions: Permission[], checked: boolean) => {
    if (checked) {
      onChange([...new Set([...permissions, ...categoryPermissions])]);
    } else {
      onChange(permissions.filter(p => !categoryPermissions.includes(p)));
    }
  };

  const handlePermissionToggle = (permission: Permission) => {
    if (permissions.includes(permission)) {
      onChange(permissions.filter(p => p !== permission));
    } else {
      onChange([...permissions, permission]);
    }
  };

  const handleSelectAll = () => {
    onChange([...ALL_PERMISSIONS]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getCategoryStats = (categoryPermissions: Permission[]) => {
    const selected = categoryPermissions.filter(p => permissions.includes(p)).length;
    return { selected, total: categoryPermissions.length };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box>
      {showTitle && (
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.primary' }}>
          {t('users.permissions')}
        </Typography>
      )}

      {showSelectAll && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={handleSelectAll}
          >
            {t('common.selectAll')}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={handleClearAll}
          >
            {t('common.clearAll')}
          </Button>
          <Typography
            variant="body2"
            sx={{
              ml: 'auto',
              alignSelf: 'center',
              color: 'text.secondary',
            }}
          >
            {permissions.length} / {ALL_PERMISSIONS.length} {t('users.permissionsSelected')}
          </Typography>
        </Box>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {showPermissionCategories && categoryEntries.map((category) => {
          const stats = getCategoryStats(category.permissions);
          const isAllSelected = stats.selected === stats.total;
          const isPartialSelected = stats.selected > 0 && stats.selected < stats.total;

          return (
            <Accordion
              key={category.id}
              defaultExpanded
              disableGutters
              sx={{
                bgcolor: theme.palette.mode === 'dark'
                  ? alpha(theme.palette.background.paper, 0.6)
                  : theme.palette.background.paper,
                border: 1,
                borderColor: 'divider',
                borderRadius: '8px !important',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { margin: 0 },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  minHeight: 48,
                  px: 2,
                  '& .MuiAccordionSummary-content': {
                    alignItems: 'center',
                    gap: 1,
                    my: 1,
                  },
                }}
              >
                <Checkbox
                  size="small"
                  checked={isAllSelected}
                  indeterminate={isPartialSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleCategoryToggle(category.permissions, e.target.checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ p: 0.5 }}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                  {t(category.label)}
                </Typography>
                <Chip
                  label={`${stats.selected}/${stats.total}`}
                  size="small"
                  color={isAllSelected ? 'success' : isPartialSelected ? 'warning' : 'default'}
                  variant={stats.selected > 0 ? 'filled' : 'outlined'}
                  sx={{ ml: 'auto', mr: 1, height: 24, fontSize: '0.75rem' }}
                />
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 1,
                }}>
                  {category.permissions.map((permission) => {
                    const isSelected = permissions.includes(permission);
                    const permissionKey = permission.replace('.', '_');
                    const tooltipText = t(`permissions.${permissionKey}_desc`, { defaultValue: '' });
                    return (
                      <Tooltip
                        key={permission}
                        title={
                          tooltipText ? (
                            <Box sx={{ p: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                                {t(`permissions.${permissionKey}`)}
                              </Typography>
                              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                                {tooltipText}
                              </Typography>
                            </Box>
                          ) : ''
                        }
                        arrow
                        placement="top"
                        enterDelay={300}
                      >
                        <Box
                          onClick={() => handlePermissionToggle(permission)}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1,
                            borderRadius: 1,
                            cursor: 'pointer',
                            border: 1,
                            borderColor: isSelected ? 'primary.main' : 'divider',
                            bgcolor: isSelected
                              ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
                              : 'transparent',
                            transition: 'all 0.15s ease',
                            '&:hover': {
                              borderColor: 'primary.main',
                              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.04),
                            },
                          }}
                        >
                          {isSelected ? (
                            <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                          ) : (
                            <UncheckedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                          )}
                          <Typography
                            variant="body2"
                            sx={{
                              color: isSelected ? 'primary.main' : 'text.secondary',
                              fontWeight: isSelected ? 500 : 400,
                              fontSize: '0.8125rem',
                              flex: 1,
                            }}
                          >
                            {t(`permissions.${permissionKey}`)}
                          </Typography>
                          {tooltipText && (
                            <InfoIcon sx={{ fontSize: 14, color: 'text.disabled', opacity: 0.6 }} />
                          )}
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
              </AccordionDetails>
            </Accordion>
          );
        })}

        {/* Environment Access Section */}
        {showEnvironments && environments.length > 0 && (
          <Accordion
            defaultExpanded
            disableGutters
            sx={{
              bgcolor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.background.paper, 0.6)
                : theme.palette.background.paper,
              border: 1,
              borderColor: 'divider',
              borderRadius: '8px !important',
              '&:before': { display: 'none' },
              '&.Mui-expanded': { margin: 0 },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                minHeight: 48,
                px: 2,
                '& .MuiAccordionSummary-content': {
                  alignItems: 'center',
                  gap: 1,
                  my: 1,
                },
              }}
            >
              <Checkbox
                size="small"
                checked={allowAllEnvs}
                onChange={(e) => {
                  e.stopPropagation();
                  onAllowAllEnvsChange?.(e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                sx={{ p: 0.5 }}
              />
              <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {t('permissions.categories.environments')}
              </Typography>
              <Chip
                label={allowAllEnvs ? t('common.all') : `${selectedEnvIds.length}/${environments.length}`}
                size="small"
                color={allowAllEnvs ? 'warning' : selectedEnvIds.length > 0 ? 'success' : 'default'}
                variant={allowAllEnvs || selectedEnvIds.length > 0 ? 'filled' : 'outlined'}
                sx={{ ml: 'auto', mr: 1, height: 24, fontSize: '0.75rem' }}
              />
            </AccordionSummary>
            <AccordionDetails sx={{ px: 2, pb: 2, pt: 0 }}>
              {allowAllEnvs && (
                <Alert
                  severity="warning"
                  icon={<WarningIcon fontSize="small" />}
                  sx={{ mb: 2, py: 0.5 }}
                >
                  <Typography variant="body2">
                    {t('users.allowAllEnvironmentsWarning')}
                  </Typography>
                </Alert>
              )}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 1,
                opacity: allowAllEnvs ? 0.5 : 1,
                pointerEvents: allowAllEnvs ? 'none' : 'auto',
              }}>
                {environments.map((env) => {
                  const isSelected = allowAllEnvs || selectedEnvIds.includes(env.id);
                  const displayName = env.displayName || env.environmentName || env.name;
                  return (
                    <Tooltip
                      key={env.id}
                      title={t('users.environmentAccessDesc', { name: displayName })}
                      arrow
                      placement="top"
                      enterDelay={300}
                    >
                      <Box
                        onClick={() => {
                          if (allowAllEnvs) return;
                          if (selectedEnvIds.includes(env.id)) {
                            onEnvIdsChange?.(selectedEnvIds.filter(id => id !== env.id));
                          } else {
                            onEnvIdsChange?.([...selectedEnvIds, env.id]);
                          }
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1,
                          borderRadius: 1,
                          cursor: allowAllEnvs ? 'default' : 'pointer',
                          border: 1,
                          borderColor: isSelected ? 'primary.main' : 'divider',
                          bgcolor: isSelected
                            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.2 : 0.08)
                            : 'transparent',
                          transition: 'all 0.15s ease',
                          '&:hover': allowAllEnvs ? {} : {
                            borderColor: 'primary.main',
                            bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.04),
                          },
                        }}
                      >
                        {isSelected ? (
                          <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        ) : (
                          <UncheckedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            color: isSelected ? 'primary.main' : 'text.secondary',
                            fontWeight: isSelected ? 500 : 400,
                            fontSize: '0.8125rem',
                            flex: 1,
                          }}
                        >
                          {displayName}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </AccordionDetails>
          </Accordion>
        )}
      </Box>
    </Box>
  );
};

export default PermissionSelector;

