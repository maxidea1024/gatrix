import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  NewReleases as ReleasesIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusRelease } from '@/services/argusService';

const TIME_RANGES = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

const ArgusReleasesPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const projectId = '1';

  const [releases, setReleases] = useState<ArgusRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getReleases(projectId, period);
      setReleases(data);
    } catch (error) {
      console.error('Failed to fetch releases:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, v: string | null) => {
    if (!v) return;
    setPeriod(v);
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ReleasesIcon sx={{ fontSize: 28, color: theme.palette.info.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.releases.title')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ToggleButtonGroup value={period} exclusive onChange={handlePeriodChange} size="small">
            {TIME_RANGES.map((r) => (
              <ToggleButton key={r.value} value={r.value} sx={{ px: 1.2, py: 0.3, textTransform: 'none', fontSize: '0.75rem', minWidth: 36 }}>
                {r.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <IconButton onClick={fetchData} size="small"><RefreshIcon /></IconButton>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>{t('argus.releases.version')}</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.releases.errors')}</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.releases.issues')}</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.releases.users')}</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>{t('argus.releases.crashFreeRate')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('argus.releases.firstSeen')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('argus.releases.lastSeen')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {releases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">{t('argus.releases.noReleases')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                releases.map((r) => (
                  <TableRow key={r.release}>
                    <TableCell>
                      <Chip label={r.release} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">{Number(r.error_count).toLocaleString()}</TableCell>
                    <TableCell align="right">{Number(r.issue_count).toLocaleString()}</TableCell>
                    <TableCell align="right">{Number(r.affected_users).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={Number(r.crash_free_rate) < 95 ? 'error' : Number(r.crash_free_rate) < 99 ? 'warning.main' : 'success.main'}
                      >
                        {Number(r.crash_free_rate).toFixed(1)}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{formatDate(r.first_seen)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">{formatDate(r.last_seen)}</Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </PageContentLoader>
    </Box>
  );
};

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return d;
  }
}

export default ArgusReleasesPage;
