import React, { useState, useCallback } from 'react';
import {
  Select,
  MenuItem,
  Box,
  Typography,
  SelectChangeEvent,
  Tooltip,
  Divider,
  ListItemIcon,
  alpha,
  keyframes,
} from '@mui/material';
import { Settings as SettingsIcon, Public as EnvironmentIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useEnvironment } from '@/contexts/EnvironmentContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';

// Shine animation - light sweeping across periodically
const shineAnimation = keyframes`
  0% {
    left: -100%;
  }
  10% {
    left: 100%;
  }
  100% {
    left: 100%;
  }
`;

// Environment type colors
const getEnvironmentColor = (type: string, customColor?: string): string => {
  if (customColor) return customColor;
  switch (type) {
    case 'production':
      return '#d32f2f'; // Red
    case 'staging':
      return '#ed6c02'; // Orange
    case 'development':
      return '#2e7d32'; // Green
    default:
      return '#757575'; // Grey
  }
};

interface EnvironmentSelectorProps {
  variant?: 'select' | 'chip';
  size?: 'small' | 'medium';
}

export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  variant = 'select',
  size = 'small',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const { environments, currentEnvironment, currentEnvironmentId, isLoading, switchEnvironment } =
    useEnvironment();

  const canManageEnvironments = hasPermission([PERMISSIONS.ENVIRONMENTS_MANAGE]);

  const handleSelectOpen = useCallback(() => {
    setIsSelectOpen(true);
  }, []);

  const handleSelectClose = useCallback(() => {
    setIsSelectOpen(false);
  }, []);

  const handleChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    // Skip if manage menu item (handled by onClick)
    if (value === '__manage__') {
      return;
    }
    switchEnvironment(value);
  };

  const handleManageClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsSelectOpen(false);
    navigate('/settings/environments');
  };

  // Show nothing only if there are truly no environments (not just loading)
  // Keep the component mounted during loading to prevent flickering
  if (!isLoading && environments.length === 0) {
    return null;
  }

  // During initial load with no data, show a placeholder to prevent layout shift
  if (isLoading && environments.length === 0) {
    return (
      <Select
        value=""
        size={size}
        disabled
        displayEmpty
        sx={{
          minWidth: 140,
          '.MuiSelect-select': {
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
          },
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'inherit',
          '.MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(255, 255, 255, 0.3)',
          },
          '.MuiSvgIcon-root': {
            color: 'inherit',
          },
        }}
      >
        <MenuItem value="">
          <Typography variant="body2" sx={{ opacity: 0.5 }}>
            {t('common.loading')}
          </Typography>
        </MenuItem>
      </Select>
    );
  }

  // If only one environment exists, just show a highlighted badge (no dropdown needed)
  if (environments.length === 1 && currentEnvironment) {
    const envColor = getEnvironmentColor(
      currentEnvironment.environmentType,
      currentEnvironment.color
    );
    return (
      <Tooltip title={t('environments.currentEnvironment')} arrow>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: envColor,
            boxShadow: `0 0 8px ${alpha(envColor, 0.5)}, inset 0 1px 0 ${alpha('#fff', 0.2)}`,
            border: `1px solid ${alpha('#fff', 0.3)}`,
          }}
        >
          <EnvironmentIcon sx={{ fontSize: 18, color: '#fff', opacity: 0.9 }} />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {currentEnvironment.displayName || currentEnvironment.environmentName}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  if (variant === 'chip' && currentEnvironment) {
    const envColor = getEnvironmentColor(
      currentEnvironment.environmentType,
      currentEnvironment.color
    );
    // Chip variant with dropdown on click - simplified as just showing current
    return (
      <Tooltip title={t('environments.switchEnvironment')} arrow>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
            backgroundColor: envColor,
            boxShadow: `0 0 8px ${alpha(envColor, 0.5)}, inset 0 1px 0 ${alpha('#fff', 0.2)}`,
            border: `1px solid ${alpha('#fff', 0.3)}`,
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              boxShadow: `0 0 12px ${alpha(envColor, 0.7)}, inset 0 1px 0 ${alpha('#fff', 0.3)}`,
              transform: 'scale(1.02)',
            },
          }}
        >
          <EnvironmentIcon sx={{ fontSize: 18, color: '#fff', opacity: 0.9 }} />
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {currentEnvironment.displayName || currentEnvironment.environmentName}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const envColor = currentEnvironment
    ? getEnvironmentColor(currentEnvironment.environmentType, currentEnvironment.color)
    : '#757575';

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        backgroundColor: envColor,
        boxShadow: `0 0 8px ${alpha(envColor, 0.5)}, inset 0 1px 0 ${alpha('#fff', 0.2)}`,
        border: `1px solid ${alpha('#fff', 0.3)}`,
        transition: 'all 0.2s ease-in-out',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: `0 0 12px ${alpha(envColor, 0.7)}, inset 0 1px 0 ${alpha('#fff', 0.3)}`,
          transform: 'scale(1.02)',
        },
        // Shine effect overlay
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '60%',
          height: '100%',
          background: `linear-gradient(
              90deg,
              transparent,
              ${alpha('#fff', 0.15)},
              ${alpha('#fff', 0.3)},
              ${alpha('#fff', 0.15)},
              transparent
            )`,
          animation: `${shineAnimation} 4s ease-in-out infinite`,
          pointerEvents: 'none',
        },
      }}
    >
      <EnvironmentIcon sx={{ fontSize: 18, color: '#fff', opacity: 0.9, zIndex: 1 }} />
      <Select
        value={currentEnvironmentId || ''}
        onChange={handleChange}
        open={isSelectOpen}
        onOpen={handleSelectOpen}
        onClose={handleSelectClose}
        size={size}
        displayEmpty
        variant="standard"
        sx={{
          minWidth: 100,
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.875rem',
          letterSpacing: '0.02em',
          zIndex: 1,
          '.MuiSelect-select': {
            py: 0.25,
            pr: '20px !important',
            display: 'flex',
            alignItems: 'center',
          },
          '&:before, &:after': {
            display: 'none',
          },
          '.MuiSvgIcon-root': {
            color: '#fff',
            right: 0,
          },
          '.MuiInput-input:focus': {
            backgroundColor: 'transparent',
          },
        }}
        renderValue={() => (
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: '#fff',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {currentEnvironment?.displayName || currentEnvironment?.environmentName || ''}
          </Typography>
        )}
      >
        {environments.map((env) => {
          const itemColor = getEnvironmentColor(env.environmentType, env.color);
          const isSelected = env.environment === currentEnvironmentId;
          return (
            <MenuItem
              key={env.environment}
              value={env.environment}
              sx={{
                backgroundColor: isSelected ? alpha(itemColor, 0.15) : 'transparent',
                '&:hover': {
                  backgroundColor: alpha(itemColor, 0.1),
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: 0.5,
                    backgroundColor: itemColor,
                    boxShadow: `0 0 4px ${alpha(itemColor, 0.5)}`,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {env.displayName || env.environmentName}
                </Typography>
              </Box>
            </MenuItem>
          );
        })}
        {canManageEnvironments && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem value="__manage__" onClick={handleManageClick}>
              <ListItemIcon sx={{ minWidth: 28 }}>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <Typography variant="body2">{t('environments.manage')}</Typography>
            </MenuItem>
          </>
        )}
      </Select>
    </Box>
  );
};

export default EnvironmentSelector;
