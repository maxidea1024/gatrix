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
  Stack,
  Pagination,
  useTheme,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Feedback as FeedbackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import argusService, { ArgusFeedbackItem } from '@/services/argusService';

const PAGE_SIZE = 20;
const TIME_RANGES = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
];

const ArgusFeedbackPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const projectId = '1';

  const [items, setItems] = useState<ArgusFeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState('7d');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getFeedback(projectId, { period, page, limit: PAGE_SIZE });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, period, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePeriodChange = (_: React.MouseEvent<HTMLElement>, v: string | null) => {
    if (!v) return;
    setPeriod(v);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <FeedbackIcon sx={{ fontSize: 28, color: theme.palette.secondary.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.feedback.title')}
          </Typography>
          {!loading && <Chip label={`${total}`} size="small" variant="outlined" />}
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
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, width: '25%' }}>{t('argus.feedback.user')}</TableCell>
                <TableCell sx={{ fontWeight: 600, width: '45%' }}>{t('argus.feedback.comment')}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{t('argus.feedback.submittedAt')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary">{t('argus.feedback.noFeedback')}</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.event_id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {item.user_name || item.user_email || '-'}
                      </Typography>
                      {item.contact_email && (
                        <Typography variant="caption" color="text.secondary">
                          {item.contact_email}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {item.comments}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.submitted_at)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Stack alignItems="center">
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, v) => setPage(v)}
              color="primary"
              shape="rounded"
            />
          </Stack>
        )}
      </PageContentLoader>
    </Box>
  );
};

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d;
  }
}

export default ArgusFeedbackPage;
