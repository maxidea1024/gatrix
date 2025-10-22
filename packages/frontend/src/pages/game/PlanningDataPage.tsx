import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService, { PlanningDataStats } from '../../services/planningDataService';

const PlanningDataPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [stats, setStats] = useState<PlanningDataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await planningDataService.getStats();
      setStats(data);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('planningData.errors.loadStatsFailed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      const result = await planningDataService.rebuildRewardLookup();
      enqueueSnackbar(t('planningData.rebuildSuccess'), { variant: 'success' });
      // Reload stats
      await loadStats();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('planningData.errors.rebuildFailed'), { variant: 'error' });
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon />
            {t('planningData.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('planningData.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadStats}
            disabled={loading || rebuilding}
          >
            {t('common.refresh')}
          </Button>
          <Button
            variant="contained"
            startIcon={rebuilding ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={handleRebuild}
            disabled={loading || rebuilding}
          >
            {t('planningData.rebuildData')}
          </Button>
        </Box>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          {t('planningData.description')}
        </Typography>
      </Alert>

      {/* Statistics Cards */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : stats ? (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    {t('planningData.stats.totalRewardTypes')}
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats.totalRewardTypes}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    {t('planningData.stats.withTable')}
                  </Typography>
                  <Typography variant="h4" component="div" color="success.main">
                    {stats.rewardTypesWithTable}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    {t('planningData.stats.withoutTable')}
                  </Typography>
                  <Typography variant="h4" component="div" color="warning.main">
                    {stats.rewardTypesWithoutTable}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom variant="body2">
                    {t('planningData.stats.totalItems')}
                  </Typography>
                  <Typography variant="h4" component="div">
                    {stats.totalItems.toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Reward Types Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('planningData.rewardTypesList')}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('planningData.table.rewardType')}</TableCell>
                      <TableCell>{t('planningData.table.name')}</TableCell>
                      <TableCell align="center">{t('planningData.table.hasTable')}</TableCell>
                      <TableCell align="right">{t('planningData.table.itemCount')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.rewardTypes.map((type) => (
                      <TableRow key={type.value}>
                        <TableCell>
                          <Chip label={type.value} size="small" />
                        </TableCell>
                        <TableCell>{type.name}</TableCell>
                        <TableCell align="center">
                          {type.hasTable ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {type.hasTable ? type.itemCount.toLocaleString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Box>
  );
};

export default PlanningDataPage;

