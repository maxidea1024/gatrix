import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Collapse,
  alpha,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  People as PeopleIcon,
  AttachMoney as RevenueIcon,
  Warning as WarningIcon,
  CreditCard as PaidIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  formatCompactNumber,
  formatWithCommas,
  needsCompactTooltip,
} from '@/utils/numberFormat';

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

  const statCards = [
    {
      icon: <PeopleIcon />,
      color: theme.palette.primary.main,
      label: t('argus.userProfiles.totalUsers', 'Total Users'),
      value: totalUsers,
    },
    {
      icon: <PaidIcon />,
      color: '#4caf50',
      label: t('argus.userProfiles.paidUsers', 'Paid Users'),
      value: paidUsers,
    },
    {
      icon: <RevenueIcon />,
      color: '#ffd700',
      label: t('argus.userProfiles.avgRevenue', 'Average Revenue'),
      value: typeof avgRevenue === 'number' ? `$${avgRevenue.toFixed(1)}` : '$0.0',
    },
    {
      icon: <WarningIcon />,
      color: '#f44336',
      label: t('argus.userProfiles.churnRiskUsers', 'At-Risk Users'),
      value: churnRiskCount,
    },
  ];

  return (
    <Collapse in={!statsCollapsed} sx={{ flexShrink: 0 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
          mb: 1.5,
        }}
      >
        {statCards.map((card, idx) => (
          <Paper
            key={idx}
            elevation={0}
            sx={{
              p: 1.5,
              background: isDark
                ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
              border: `1px solid ${alpha(card.color, 0.2)}`,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                color: card.color,
                flexShrink: 0,
              }}
            >
              {React.cloneElement(card.icon, { sx: { fontSize: 18 } })}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Tooltip
                title={
                  typeof card.value === 'number' && needsCompactTooltip(card.value)
                    ? formatWithCommas(card.value)
                    : ''
                }
                arrow
                placement="top"
              >
                <Typography
                  variant="h6"
                  fontWeight={800}
                  sx={{ lineHeight: 1.1, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {typeof card.value === 'number'
                    ? formatCompactNumber(card.value)
                    : (card.value ?? '-')}
                </Typography>
              </Tooltip>
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#888' : '#777',
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  display: 'block',
                  mt: 0.25,
                }}
              >
                {card.label}
              </Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Collapse>
  );
};

export default UserProfileStatsBar;
