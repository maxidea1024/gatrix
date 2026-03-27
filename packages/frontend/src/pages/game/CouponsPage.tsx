import React from 'react';
import { Box, Typography } from '@mui/material';
import { ConfirmationNumber as ConfirmationNumberIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';

const CouponsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<ConfirmationNumberIcon />}
        title={t('coupons.title')}
        subtitle={t('coupons.subtitle')}
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

export default CouponsPage;
