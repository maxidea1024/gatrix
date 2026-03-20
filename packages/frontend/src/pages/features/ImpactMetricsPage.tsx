/**
 * Impact Metrics Page
 *
 * Dedicated page for managing metric chart configurations
 * and monitoring metrics in a Grafana-like dashboard.
 */

import React from 'react';
import { Box } from '@mui/material';
import { ShowChart as ChartIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ImpactMetricsChart from '../../components/features/ImpactMetricsChart';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
import PageHeader from '@/components/common/PageHeader';

const ImpactMetricsPage: React.FC = () => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([P.FEATURES_UPDATE]);

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<ChartIcon />}
        title={t('impactMetrics.pageTitle')}
        subtitle={t('impactMetrics.pageDescription')}
      />

      {/* Chart Dashboard */}
      <ImpactMetricsChart canManage={canManage} hideTitle />
    </Box>
  );
};

export default ImpactMetricsPage;
