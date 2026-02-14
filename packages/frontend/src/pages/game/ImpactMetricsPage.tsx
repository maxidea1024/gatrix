/**
 * Impact Metrics Page
 *
 * Dedicated page for managing metric chart configurations
 * and monitoring metrics in a Grafana-like dashboard.
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { ShowChart as ChartIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ImpactMetricsChart from '../../components/features/ImpactMetricsChart';

const ImpactMetricsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <ChartIcon sx={{ fontSize: 28, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            {t('impactMetrics.pageTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('impactMetrics.pageDescription')}
          </Typography>
        </Box>
      </Box>

      {/* Chart Dashboard */}
      <ImpactMetricsChart canManage hideTitle />
    </Box>
  );
};

export default ImpactMetricsPage;
