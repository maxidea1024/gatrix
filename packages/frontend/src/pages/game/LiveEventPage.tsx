import React from 'react';
import { Box, Typography } from '@mui/material';
import { Celebration as CelebrationIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';

const LiveEventPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<CelebrationIcon />}
        title={t('liveEvent.title')}
        subtitle={t('liveEvent.subtitle')}
      />

      {/* Content will be added here */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="body2" color="text.secondary">
          {t('common.comingSoon')}
        </Typography>
      </Box>
    </Box>
  );
};

export default LiveEventPage;
