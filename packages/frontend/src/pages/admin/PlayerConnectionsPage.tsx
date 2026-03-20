import React from 'react';
import { Box, Typography, Paper, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { PeopleAlt as PeopleIcon } from '@mui/icons-material';
import PageHeader from '@/components/common/PageHeader';

/**
 * PlayerConnectionsPage
 *
 * This page is a placeholder for the player connections management feature.
 * Future features:
 * - Real-time player connection monitoring (concurrent users)
 * - Player kick functionality
 * - Connection statistics and analytics
 */
const PlayerConnectionsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        icon={<PeopleIcon />}
        title={t('playerConnections.title')}
        subtitle={t('playerConnections.subtitle')}
      />

      {/* Coming Soon Notice */}
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('playerConnections.comingSoon')}
        </Alert>

        <Typography variant="h6" gutterBottom>
          {t('playerConnections.plannedFeatures')}
        </Typography>
        <Box
          component="ul"
          sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto', mt: 2 }}
        >
          <li>
            <Typography variant="body2" color="text.secondary">
              {t('playerConnections.feature.monitoring')}
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="text.secondary">
              {t('playerConnections.feature.kick')}
            </Typography>
          </li>
          <li>
            <Typography variant="body2" color="text.secondary">
              {t('playerConnections.feature.statistics')}
            </Typography>
          </li>
        </Box>
      </Paper>
    </Box>
  );
};

export default PlayerConnectionsPage;
