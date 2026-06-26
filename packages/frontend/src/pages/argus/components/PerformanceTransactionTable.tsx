import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Speed as SpeedIcon,
  Schedule as ScheduleIcon,
  Timeline as TimelineIcon,
  ManageSearch as SpanSearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SafeTooltip from '@/components/common/SafeTooltip';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

import { ArgusTransaction } from '@/services/argusService';
import { formatCompactNumber } from '@/utils/numberFormat';
import SimplePagination from '@/components/common/SimplePagination';
import useGlobalPageSize from '@/hooks/useGlobalPageSize';
import { getMethodColor, parseTransaction } from './performanceHelpers';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

interface PerformanceTransactionTableProps {
  transactions: ArgusTransaction[];
  loading: boolean;
  onTxnClick: (txnName: string) => void;
}

const PerformanceTransactionTable: React.FC<
  PerformanceTransactionTableProps
> = ({ transactions, loading, onTxnClick }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';

  const [perfPage, setPerfPage] = useState(0);
  const [perfRowsPerPage, setPerfRowsPerPage] = useGlobalPageSize();

  // Reset page on data change
  useEffect(() => {
    setPerfPage(0);
  }, [transactions]);

  return (
    <PageContentLoader
      loading={loading && transactions.length === 0}
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {/* Performance Summary Stats */}
      {transactions.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 2,
            mb: 3,
            flexShrink: 0,
          }}
        >
          {(() => {
            const totalCount = transactions.reduce(
              (s, t) => s + Number(t.count),
              0
            );
            const avgP95 =
              transactions.reduce((s, t) => s + Number(t.p95), 0) /
              transactions.length;
            const avgDur =
              transactions.reduce((s, t) => s + Number(t.avg_duration), 0) /
              transactions.length;
            const avgErr =
              transactions.reduce((s, t) => s + Number(t.error_rate), 0) /
              transactions.length;
            const slowest = transactions.reduce(
              (max, t) => (Number(t.p95) > Number(max.p95) ? t : max),
              transactions[0]
            );
            return [
              {
                label: t(
                  'argus.performance.totalTransactions',
                  'Total Transactions'
                ),
                value: formatCompactNumber(totalCount),
                color: '#7c4dff',
                icon: <SpeedIcon />,
              },
              {
                label: t('argus.performance.avgP95', 'Avg. P95'),
                value: `${avgP95.toFixed(0)}ms`,
                color:
                  avgP95 > 3000
                    ? ARGUS_SEMANTIC.negative
                    : avgP95 > 1000
                      ? ARGUS_SEMANTIC.warning
                      : ARGUS_SEMANTIC.positive,
                icon: <TimelineIcon />,
              },
              {
                label: t('argus.performance.avgDuration', 'Avg. Duration'),
                value: `${avgDur.toFixed(0)}ms`,
                color: ARGUS_SEMANTIC.info,
                icon: <ScheduleIcon />,
              },
              {
                label: t('argus.performance.avgErrorRate', 'Avg. Error Rate'),
                value: `${avgErr.toFixed(2)}%`,
                color:
                  avgErr > 5
                    ? ARGUS_SEMANTIC.negative
                    : avgErr > 1
                      ? ARGUS_SEMANTIC.warning
                      : ARGUS_SEMANTIC.positive,
                icon: <SpeedIcon />,
              },
              {
                label: t(
                  'argus.performance.slowestEndpoint',
                  'Slowest Endpoint'
                ),
                value: `${parseTransaction(slowest.name).path.slice(0, 20)}`,
                color: ARGUS_SEMANTIC.negative,
                icon: <SpeedIcon />,
                subtitle: `P95: ${Number(slowest.p95).toFixed(0)}ms`,
              },
            ].map((card, idx) => (
              <Paper
                key={idx}
                elevation={0}
                sx={{
                  p: 2,
                  background: isDark
                    ? `linear-gradient(135deg, ${alpha(card.color, 0.12)}, ${alpha(card.color, 0.03)})`
                    : `linear-gradient(135deg, ${alpha(card.color, 0.06)}, ${alpha(card.color, 0.01)})`,
                  border: `1px solid ${alpha(card.color, 0.2)}`,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  transition: 'all 0.2s',
                  '&:hover': { transform: 'translateY(-1px)' },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: alpha(card.color, isDark ? 0.2 : 0.1),
                    color: card.color,
                  }}
                >
                  {React.cloneElement(card.icon, { sx: { fontSize: 18 } })}
                </Box>
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={800}
                    sx={{
                      lineHeight: 1.2,
                      fontSize: '1rem',
                      color: card.color,
                    }}
                  >
                    {card.value}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: isDark ? '#888' : '#777',
                      fontWeight: 500,
                      fontSize: '0.6rem',
                    }}
                  >
                    {card.label}
                  </Typography>
                  {(card as any).subtitle && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        color: isDark ? '#555' : '#bbb',
                        fontSize: '0.58rem',
                      }}
                    >
                      {(card as any).subtitle}
                    </Typography>
                  )}
                </Box>
              </Paper>
            ));
          })()}
        </Box>
      )}

      {/* Transaction Table */}
      {transactions.length === 0 ? (
        <EmptyPlaceholder
          icon={<SpeedIcon sx={{ fontSize: 48 }} />}
          message={t('argus.performance.noTransactions')}
          minHeight={250}
        />
      ) : (
        <Paper
          elevation={0}
          sx={{
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
            overflow: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            opacity: loading ? 0.55 : 1,
            transition: 'opacity 0.15s ease',
            pointerEvents: loading ? 'none' : 'auto',
          }}
        >
          {/* Table Header */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '2fr repeat(5, 1fr)',
              gap: 0,
              px: 0,
              py: 0,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.02)',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              position: 'sticky',
              top: 0,
              zIndex: 2,
              bgcolor: isDark ? '#1e1e1e' : '#fafafa',
            }}
          >
            <Typography
              variant="caption"
              fontWeight={600}
              sx={{ px: 2, py: 1.2 }}
            >
              {t('argus.performance.transactionName')}
            </Typography>
            {[
              t('argus.performance.count'),
              t('argus.performance.avgDuration'),
              'P50',
              'P95',
              t('argus.performance.errorRate'),
            ].map((header) => (
              <Typography
                key={header}
                variant="caption"
                fontWeight={600}
                sx={{
                  textAlign: 'right',
                  px: 2,
                  py: 1.2,
                  borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                {header}
              </Typography>
            ))}
          </Box>

          {transactions
            .slice(
              perfPage * perfRowsPerPage,
              perfPage * perfRowsPerPage + perfRowsPerPage
            )
            .map((txn, idx) => {
              const p95Val = Number(txn.p95);
              const p50Val = Number(txn.p50);
              const errRate = Number(txn.error_rate);
              const maxP95 = Math.max(
                ...transactions.map((t) => Number(t.p95)),
                1
              );
              const { method, path: txnPath } = parseTransaction(txn.name);
              return (
                <Box
                  key={`${txn.name}-${idx}`}
                  onClick={() => onTxnClick(txn.name)}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '2fr repeat(5, 1fr)',
                    gap: 0,
                    px: 0,
                    py: 0,
                    alignItems: 'stretch',
                    cursor: 'pointer',
                    borderBottom:
                      idx < perfRowsPerPage - 1
                        ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`
                        : 'none',
                    transition: 'background 0.15s',
                    '&:hover': {
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.02)'
                        : 'rgba(0,0,0,0.015)',
                    },
                  }}
                >
                  {/* Transaction Name */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      overflow: 'hidden',
                      px: 2,
                      py: 1.2,
                    }}
                  >
                    <Box sx={{ width: 55, flexShrink: 0 }}>
                      <Chip
                        label={method}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          borderRadius: 0.8,
                          width: '100%',
                          backgroundColor: alpha(getMethodColor(method), 0.12),
                          color: getMethodColor(method),
                          border: 'none',
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      fontWeight={500}
                      noWrap
                      sx={{ flex: 1 }}
                    >
                      {txnPath}
                    </Typography>
                    <SafeTooltip
                      title={t(
                        'argus.performance.searchSpans',
                        'Search spans in Trace Explorer'
                      )}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/argus/explore/traces?q=description:"${txnPath}"`
                          );
                        }}
                        sx={{
                          p: 0.3,
                          opacity: 0.4,
                          '&:hover': { opacity: 1 },
                        }}
                      >
                        <SpanSearchIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </SafeTooltip>
                  </Box>

                  {/* Count */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      px: 2,
                      py: 1.2,
                      borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    <Typography variant="body2">
                      {formatCompactNumber(Number(txn.count))}
                    </Typography>
                  </Box>

                  {/* Avg Duration */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      px: 2,
                      py: 1.2,
                      borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    <Typography variant="body2">
                      {Number(txn.avg_duration).toFixed(0)}ms
                    </Typography>
                  </Box>

                  {/* P50 with mini bar */}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.2,
                      textAlign: 'right',
                      borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                      {p50Val.toFixed(0)}ms
                    </Typography>
                    <Box
                      sx={{
                        minWidth: 0,
                        height: 3,
                        borderRadius: 2,
                        mt: 0.3,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.04)',
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: 0,
                          height: '100%',
                          borderRadius: 2,
                          width: `${(p50Val / maxP95) * 100}%`,
                          backgroundColor: ARGUS_SEMANTIC.positive,
                          transition: 'width 0.3s',
                        }}
                      />
                    </Box>
                  </Box>

                  {/* P95 with mini bar */}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.2,
                      textAlign: 'right',
                      borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        fontSize: '0.82rem',
                        color:
                          p95Val > 3000
                            ? ARGUS_SEMANTIC.negative
                            : p95Val > 1000
                              ? ARGUS_SEMANTIC.warning
                              : 'inherit',
                      }}
                    >
                      {p95Val.toFixed(0)}ms
                    </Typography>
                    <Box
                      sx={{
                        minWidth: 0,
                        height: 3,
                        borderRadius: 2,
                        mt: 0.3,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(0,0,0,0.04)',
                      }}
                    >
                      <Box
                        sx={{
                          minWidth: 0,
                          height: '100%',
                          borderRadius: 2,
                          width: `${(p95Val / maxP95) * 100}%`,
                          backgroundColor:
                            p95Val > 3000
                              ? ARGUS_SEMANTIC.negative
                              : p95Val > 1000
                                ? ARGUS_SEMANTIC.warning
                                : '#7c4dff',
                          transition: 'width 0.3s',
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Error Rate with bar */}
                  <Box
                    sx={{
                      px: 2,
                      py: 1.2,
                      borderLeft: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: 1,
                        mb: 0.3,
                      }}
                    >
                      <Box
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.04)'
                            : 'rgba(0,0,0,0.04)',
                          overflow: 'hidden',
                        }}
                      >
                        <Box
                          sx={{
                            minWidth: 0,
                            height: '100%',
                            borderRadius: 3,
                            width: `${Math.min(errRate, 100)}%`,
                            backgroundColor:
                              errRate > 5
                                ? ARGUS_SEMANTIC.negative
                                : errRate > 1
                                  ? ARGUS_SEMANTIC.warning
                                  : ARGUS_SEMANTIC.positive,
                            transition: 'width 0.3s',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          fontSize: '0.78rem',
                          flexShrink: 0,
                          minWidth: 38,
                          textAlign: 'right',
                          color:
                            errRate > 5
                              ? ARGUS_SEMANTIC.negative
                              : errRate > 1
                                ? ARGUS_SEMANTIC.warning
                                : ARGUS_SEMANTIC.positive,
                        }}
                      >
                        {errRate.toFixed(1)}%
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              );
            })}
        </Paper>
      )}

      {/* Pagination */}
      {transactions.length > 0 && (
        <Box sx={{ mt: 2, flexShrink: 0 }}>
          <SimplePagination
            count={transactions.length}
            page={perfPage}
            rowsPerPage={perfRowsPerPage}
            onPageChange={(_, newPage) => setPerfPage(newPage)}
            onRowsPerPageChange={(e) => {
              setPerfRowsPerPage(Number(e.target.value));
              setPerfPage(0);
            }}
            rowsPerPageOptions={[5, 10, 15, 20, 25, 50, 100]}
            size="small"
          />
        </Box>
      )}
    </PageContentLoader>
  );
};

export default React.memo(PerformanceTransactionTable);
