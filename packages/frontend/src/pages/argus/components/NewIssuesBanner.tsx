import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface NewIssuesBannerProps {
  /** Number of new issues detected via real-time connection */
  count: number;
  /** Called when banner is clicked to refresh */
  onClick: () => void;
}

/**
 * Animated banner notifying the user that new issues have arrived via SSE.
 * Appears above the issue list when count > 0.
 */
const NewIssuesBanner: React.FC<NewIssuesBannerProps> = ({
  count,
  onClick,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  if (count <= 0) return null;

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 1,
        px: 2,
        mb: 1,
        backgroundColor: alpha(theme.palette.primary.main, 0.08),
        border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        '&:hover': {
          backgroundColor: alpha(theme.palette.primary.main, 0.12),
          borderColor: theme.palette.primary.main,
        },
      }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: theme.palette.primary.main,
          animation: 'pulse 1.5s infinite',
          '@keyframes pulse': {
            '0%': { opacity: 1 },
            '50%': { opacity: 0.4 },
            '100%': { opacity: 1 },
          },
        }}
      />
      <Typography
        sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'primary.main' }}
      >
        {t('argus.realtime.newIssues', {
          count,
          defaultValue: '{{count}} new issues — click to refresh',
        })}
      </Typography>
    </Box>
  );
};

export default React.memo(NewIssuesBanner);
