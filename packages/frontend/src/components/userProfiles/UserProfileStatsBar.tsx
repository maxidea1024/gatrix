import React from 'react';
import {
  Box,
  Typography,
  Collapse,
  Tooltip,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  formatCompactNumber,
  formatWithCommas,
  needsCompactTooltip,
} from '@/utils/numberFormat';
import { argusBorder } from '@/pages/argus/argusThemeTokens';

interface UserProfileStatsBarProps {
  statsCollapsed: boolean;
  totalUsers: number;
  paidUsers: number;
  avgRevenue: number;
  churnRiskCount: number;
}

export const UserProfileStatsBar: React.FC<UserProfileStatsBarProps> = ({
  statsCollapsed,
  totalUsers,
  paidUsers,
  avgRevenue,
  churnRiskCount,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const borderColor = argusBorder(isDark);

  const statItems = [
    {
      label: t('argus.userProfiles.totalUsers', 'Total Users'),
      value: totalUsers,
      format: (v: number) => formatCompactNumber(v),
      raw: totalUsers,
    },
    {
      label: t('argus.userProfiles.paidUsers', 'Paid Users'),
      value: paidUsers,
      format: (v: number) => formatCompactNumber(v),
      raw: paidUsers,
    },
    {
      label: t('argus.userProfiles.avgRevenue', 'Average Revenue'),
      value: avgRevenue,
      format: (v: number) => `$${v.toFixed(1)}`,
      raw: null,
    },
    {
      label: t('argus.userProfiles.churnRiskUsers', 'At-Risk Users'),
      value: churnRiskCount,
      format: (v: number) => formatCompactNumber(v),
      raw: churnRiskCount,
    },
  ];

  return (
    <Collapse in={!statsCollapsed} sx={{ flexShrink: 0 }}>
      <Box
        sx={{
          display: 'flex',
          border: `1px solid ${borderColor}`,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(255,255,255,0.015)' : '#fff',
          mb: 1.5,
        }}
      >
        {statItems.map((item, i) => (
          <Box
            key={item.label}
            sx={{
              flex: 1,
              minWidth: 0,
              p: 1.5,
              borderRight:
                i < statItems.length - 1
                  ? `1px solid ${borderColor}`
                  : undefined,
              display: 'flex',
              flexDirection: 'column',
              gap: 0.3,
            }}
          >
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 600,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {item.label}
            </Typography>
            <Tooltip
              title={
                item.raw != null && needsCompactTooltip(item.raw)
                  ? formatWithCommas(item.raw)
                  : ''
              }
              arrow
              placement="top"
            >
              <Typography
                sx={{
                  fontSize: 22,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {item.format(item.value)}
              </Typography>
            </Tooltip>
          </Box>
        ))}
      </Box>
    </Collapse>
  );
};

export default UserProfileStatsBar;
