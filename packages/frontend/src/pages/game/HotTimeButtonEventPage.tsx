import React from 'react';
import { Box, Typography } from '@mui/material';
import { Whatshot as WhatshotIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';

const HotTimeButtonEventPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<WhatshotIcon />}
        title={t('hotTimeButtonEvent.title')}
        subtitle={t('hotTimeButtonEvent.subtitle')}
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

export default HotTimeButtonEventPage;
