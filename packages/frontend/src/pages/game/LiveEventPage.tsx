import React from 'react';
import { Box, Typography } from '@mui/material';
import { Celebration as CelebrationIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';

const LiveEventPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ mt: 2 }}>
      <PageHeader title={t('liveEvent.title', 'Live Events')} />
      <Typography variant="body2" color="text.secondary">
        {t('common.comingSoon')}
      </Typography>
    </Box>
  );
};

export default LiveEventPage;
