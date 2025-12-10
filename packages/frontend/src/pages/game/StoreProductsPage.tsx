import React from 'react';
import { Box, Typography } from '@mui/material';
import { Storefront as StorefrontIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const StoreProductsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorefrontIcon />
            {t('storeProducts.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('storeProducts.subtitle')}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default StoreProductsPage;

