import React from 'react';
import { Box, Typography } from '@mui/material';
import { Whatshot as WhatshotIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const HotTimeButtonEventPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {t('common.comingSoon')}
      </Typography>
    </Box>
  );
};

export default HotTimeButtonEventPage;
