import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

const SettingsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
          {t('settings.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('settings.subtitle')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {t('settings.general.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settings.general.description')}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
