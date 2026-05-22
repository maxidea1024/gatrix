import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  IconButton,
  Tooltip,
  Stack,
  Card,
  CardContent,
  Chip,
  Skeleton,
  TextField,
  MenuItem,
  Paper,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import ResizableDrawer from '../common/ResizableDrawer';
import SimplePagination from '../common/SimplePagination';
import EmptyPagePlaceholder from '../common/EmptyPagePlaceholder';
import PageContentLoader from '../common/PageContentLoader';
import SearchTextField from '../common/SearchTextField';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useDebounce } from '@/hooks/useDebounce';
import surveyService, { SurveyLog, Survey } from '@/services/surveyService';
import {
  formatRelativeTime,
  formatDateTimeDetailed,
  formatDateTime,
} from '@/utils/dateFormat';
import { useI18n } from '@/contexts/I18nContext';
import RewardDisplay from './RewardDisplay';
import RecordDetailDialog, { DetailField } from '../common/RecordDetailDialog';

interface SurveyLogsDrawerProps {
  open: boolean;
  onClose: () => void;
  survey: Survey | null;
}

const SurveyLogsDrawer: React.FC<SurveyLogsDrawerProps> = ({
  open,
  onClose,
  survey,
}) => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const [logs, setLogs] = useState<SurveyLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [actionFilter, setActionFilter] = useState<'ALL' | 'JOINED' | 'SENT'>(
    'ALL'
  );
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<SurveyLog | null>(null);

  const handleOpenDetail = (log: SurveyLog) => {
    setDetailLog(log);
    setDetailDialogOpen(true);
  };

  const DETAIL_FIELDS: DetailField[] = [
    {
      key: 'accountId',
      labelKey: 'surveys.logs.columns.accountId',
      mono: true,
    },
    { key: 'userName', labelKey: 'coupons.couponUsage.columns.userName' },
    { key: 'action', labelKey: 'surveys.logs.columns.action' },
    {
      key: 'characterId',
      labelKey: 'playerConnections.allPlayers.characterId',
      mono: true,
    },
    { key: 'worldId', labelKey: 'surveys.logs.columns.worldId' },
    { key: 'platform', labelKey: 'coupons.couponUsage.columns.platform' },
    { key: 'channel', labelKey: 'coupons.couponUsage.columns.channel' },
    { key: 'subchannel', labelKey: 'coupons.couponUsage.columns.subChannel' },
    {
      key: 'createdAt',
      labelKey: 'surveys.logs.columns.createdAt',
      format: (val) => formatDateTime(val),
    },
  ];

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'createdAt' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  // Stats
  const [stats, setStats] = useState<{
    total: number;
    joined: number;
    sent: number;
  }>({
    total: 0,
    joined: 0,
    sent: 0,
  });

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    enqueueSnackbar(t('common.copied'), {
      variant: 'success',
      autoHideDuration: 1500,
    });
  };

  const loadLogs = useCallback(async () => {
    if (!survey) return;
    setLoading(true);
    try {
      const res = await surveyService.getSurveyLogs(projectApiPath, {
        surveyId: survey.id,
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearch || undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        sortBy,
        sortOrder,
      });
      setLogs(res.logs || []);
      setTotal(res.pagination.total || 0);
    } catch (err) {
      console.error('Failed to load survey logs', err);
    } finally {
      setLoading(false);
    }
  }, [
    survey,
    projectApiPath,
    page,
    rowsPerPage,
    debouncedSearch,
    actionFilter,
    sortBy,
    sortOrder,
  ]);

  // Load stats (all + joined + sent counts)
  const loadStats = useCallback(async () => {
    if (!survey) return;
    try {
      const [allRes, joinedRes, sentRes] = await Promise.all([
        surveyService.getSurveyLogs(projectApiPath, {
          surveyId: survey.id,
          limit: 1,
        }),
        surveyService.getSurveyLogs(projectApiPath, {
          surveyId: survey.id,
          action: 'JOINED',
          limit: 1,
        }),
        surveyService.getSurveyLogs(projectApiPath, {
          surveyId: survey.id,
          action: 'SENT',
          limit: 1,
        }),
      ]);
      setStats({
        total: allRes.pagination.total,
        joined: joinedRes.pagination.total,
        sent: sentRes.pagination.total,
      });
    } catch (err) {
      console.error('Failed to load survey log stats', err);
    }
  }, [survey, projectApiPath]);

  useEffect(() => {
    if (open && survey) {
      loadStats();
    }
  }, [open, survey, loadStats]);

  useEffect(() => {
    if (open && survey) {
      loadLogs();
    }
  }, [open, survey, loadLogs]);

  // Reset state when survey changes
  useEffect(() => {
    if (open) {
      setPage(0);
      setSearchTerm('');
      setActionFilter('ALL');
      setSortBy('createdAt');
      setSortOrder('desc');
    }
  }, [survey?.id, open]);

  const statCards = useMemo(
    () => [
      {
        label: t('surveys.logsDrawer.total'),
        value: stats.total,
        filter: 'ALL' as const,
        gradient: 'linear-gradient(135deg, #5c6bc0 0%, #3949ab 100%)',
        shadow: 'rgba(92,107,192,0.4)',
      },
      {
        label: t('surveys.logsDrawer.joined'),
        value: stats.joined,
        filter: 'JOINED' as const,
        gradient: 'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)',
        shadow: 'rgba(102,187,106,0.4)',
      },
      {
        label: t('surveys.logsDrawer.sent'),
        value: stats.sent,
        filter: 'SENT' as const,
        gradient: 'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)',
        shadow: 'rgba(255,167,38,0.4)',
      },
    ],
    [stats, t]
  );

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('surveys.logsDrawer.title') as string}
      subtitle={survey ? `${survey.surveyTitle}` : ''}
      storageKey="surveyLogsDrawerWidth"
      defaultWidth={720}
      minWidth={560}
    >
      <Box sx={{ p: 3, overflowY: 'auto', flex: 1 }}>
        <Stack spacing={2}>
          {/* Statistics Cards */}
          <Stack direction="row" spacing={1}>
            {statCards.map((card) => (
              <Card
                key={card.filter}
                sx={{
                  flex: 1,
                  cursor: 'pointer',
                  border: 1.5,
                  borderRadius: 1.5,
                  ...(actionFilter === card.filter
                    ? {
                        borderColor: 'transparent',
                        background: card.gradient,
                        boxShadow: `0 2px 8px ${card.shadow}`,
                      }
                    : {
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                      }),
                  transition: 'all 0.2s ease',
                  '&:hover':
                    actionFilter !== card.filter
                      ? { borderColor: 'primary.light' }
                      : {},
                }}
                onClick={() => {
                  setActionFilter(card.filter);
                  setPage(0);
                }}
              >
                <CardContent sx={{ p: '8px 12px !important' }}>
                  <Stack direction="row" alignItems="baseline" spacing={1}>
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 700,
                        lineHeight: 1.2,
                        color:
                          actionFilter === card.filter
                            ? '#fff'
                            : 'text.primary',
                      }}
                    >
                      {card.value.toLocaleString()}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color:
                          actionFilter === card.filter
                            ? 'rgba(255,255,255,0.8)'
                            : 'text.secondary',
                        fontWeight: 500,
                      }}
                    >
                      {card.label}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>

          {/* Search */}
          <SearchTextField
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t(
              'surveys.logsDrawer.searchPlaceholder')}
            size="small"
          />

          {/* Table Area */}
          <PageContentLoader loading={loading}>
            {logs.length === 0 ? (
              <Box sx={{ mt: 2 }}>
                <EmptyPagePlaceholder
                  message={t('surveys.logs.noRecords')}
                />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sortDirection={sortBy === 'action' ? sortOrder : false}
                      >
                        <TableSortLabel
                          active={sortBy === 'action'}
                          direction={sortBy === 'action' ? sortOrder : 'asc'}
                          onClick={() => handleSort('action')}
                        >
                          {t('surveys.logs.columns.action')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sortDirection={
                          sortBy === 'accountId' ? sortOrder : false
                        }
                      >
                        <TableSortLabel
                          active={sortBy === 'accountId'}
                          direction={sortBy === 'accountId' ? sortOrder : 'asc'}
                          onClick={() => handleSort('accountId')}
                        >
                          {t('surveys.logs.columns.accountId')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sortDirection={
                          sortBy === 'userName' ? sortOrder : false
                        }
                      >
                        <TableSortLabel
                          active={sortBy === 'userName'}
                          direction={sortBy === 'userName' ? sortOrder : 'asc'}
                          onClick={() => handleSort('userName')}
                        >
                          {t(
                            'coupons.couponUsage.columns.userName')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sortDirection={sortBy === 'worldId' ? sortOrder : false}
                      >
                        <TableSortLabel
                          active={sortBy === 'worldId'}
                          direction={sortBy === 'worldId' ? sortOrder : 'asc'}
                          onClick={() => handleSort('worldId')}
                        >
                          {t('surveys.logs.columns.worldId')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sortDirection={
                          sortBy === 'platform' ? sortOrder : false
                        }
                      >
                        <TableSortLabel
                          active={sortBy === 'platform'}
                          direction={sortBy === 'platform' ? sortOrder : 'asc'}
                          onClick={() => handleSort('platform')}
                        >
                          {t(
                            'coupons.couponUsage.columns.platform')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sortDirection={sortBy === 'channel' ? sortOrder : false}
                      >
                        <TableSortLabel
                          active={sortBy === 'channel'}
                          direction={sortBy === 'channel' ? sortOrder : 'asc'}
                          onClick={() => handleSort('channel')}
                        >
                          {t('coupons.couponUsage.columns.channel')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sortDirection={
                          sortBy === 'subchannel' ? sortOrder : false
                        }
                      >
                        <TableSortLabel
                          active={sortBy === 'subchannel'}
                          direction={
                            sortBy === 'subchannel' ? sortOrder : 'asc'
                          }
                          onClick={() => handleSort('subchannel')}
                        >
                          {t(
                            'coupons.couponUsage.columns.subChannel')}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell
                        sortDirection={
                          sortBy === 'createdAt' ? sortOrder : false
                        }
                      >
                        <TableSortLabel
                          active={sortBy === 'createdAt'}
                          direction={
                            sortBy === 'createdAt' ? sortOrder : 'desc'
                          }
                          onClick={() => handleSort('createdAt')}
                        >
                          {t('surveys.logs.columns.createdAt')}
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} hover>
                        <TableCell>
                          <Chip
                            label={t(
                              `surveys.logsDrawer.action.${log.action}`,
                              log.action
                            )}
                            size="small"
                            color={
                              log.action === 'JOINED' ? 'success' : 'warning'
                            }
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="body2"
                              noWrap
                              sx={{
                                cursor: 'pointer',
                                color: 'primary.main',
                                '&:hover': { textDecoration: 'underline' },
                              }}
                              onClick={() => handleOpenDetail(log)}
                            >
                              {log.accountId}
                            </Typography>
                            <Tooltip title={t('common.copy')}>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(log.accountId)}
                              >
                                <ContentCopyIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={
                              log.userName
                                ? {
                                    cursor: 'pointer',
                                    color: 'primary.main',
                                    '&:hover': { textDecoration: 'underline' },
                                  }
                                : {}
                            }
                            onClick={() =>
                              log.userName && handleOpenDetail(log)
                            }
                          >
                            {log.userName || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {log.worldId || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {log.platform || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {log.channel || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {log.subchannel || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Tooltip
                            title={formatDateTimeDetailed(log.createdAt)}
                          >
                            <Typography variant="caption" noWrap>
                              {formatRelativeTime(
                                log.createdAt,
                                undefined,
                                language
                              )}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </PageContentLoader>

          {/* Pagination */}
          {total > 0 && (
            <SimplePagination
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={setPage}
              onRowsPerPageChange={(rpp) => {
                setRowsPerPage(rpp);
                setPage(0);
              }}
            />
          )}
        </Stack>
      </Box>

      {/* Detail Dialog */}
      <RecordDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        title={t('playerConnections.allPlayers.viewDetails')}
        data={detailLog}
        fields={DETAIL_FIELDS}
      />
    </ResizableDrawer>
  );
};

export default SurveyLogsDrawer;
