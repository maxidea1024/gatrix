import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Paper,
  Chip,
  Tabs,
  Tab,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  useTheme,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getRevenueUserSummary, type UserFinancialResponse, type UserFinancialTransaction } from '@/services/argus/argusAnalytics';
import { downloadCsv, type CsvColumn } from '@/utils/csvExport';
import { ARGUS_SEMANTIC } from '@/pages/argus/argusThemeTokens';

interface UserProfileFinanceTabProps {
  projectId: string;
  userId: string;
}

type TopProduct = { name: string; count: number; total: number };
function computeTopProducts(purchases: UserFinancialTransaction[]): TopProduct[] {
  const m = new Map<string, TopProduct>();
  purchases.forEach((p) => {
    const ex = m.get(p.product_name) ?? {
      name: p.product_name,
      count: 0,
      total: 0,
    };
    m.set(p.product_name, {
      ...ex,
      count: ex.count + 1,
      total: ex.total + (p.amount || 0),
    });
  });
  return [...m.values()]
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 5);
}

export const UserProfileFinanceTab: React.FC<UserProfileFinanceTabProps> = ({
  projectId,
  userId,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [finData, setFinData] = useState<UserFinancialResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const subTabParam = searchParams.get('subTab');

  const finSubTab = useMemo(() => {
    switch (subTabParam) {
      case 'refunds': return 1;
      case 'grants': return 2;
      case 'purchases':
      default:
        return 0;
    }
  }, [subTabParam]);

  const setFinSubTab = (newSubTab: number) => {
    const params = new URLSearchParams(searchParams);
    switch (newSubTab) {
      case 1:
        params.set('subTab', 'refunds');
        break;
      case 2:
        params.set('subTab', 'grants');
        break;
      case 0:
      default:
        params.set('subTab', 'purchases');
        break;
    }
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getRevenueUserSummary(projectId, { user_id: userId, period: '90d' })
      .then((data) => setFinData(data))
      .catch(() =>
        setFinData({
          summary: {
            total_purchases: 0,
            purchase_count: 0,
            total_refunds: 0,
            refund_count: 0,
            total_grants: 0,
            grant_count: 0,
            net_revenue: 0,
            refund_rate: 0,
            first_purchase: null,
            last_purchase: null,
          },
          purchases: [],
          refunds: [],
          grants: [],
        })
      )
      .finally(() => setLoading(false));
  }, [projectId, userId]);

  const topProducts = useMemo(
    () => (finData ? computeTopProducts(finData.purchases) : []),
    [finData]
  );

  const finCsvCols: CsvColumn<{
    timestamp: string;
    product_name: string;
    amount: number;
    reason: string;
    payment_method: string;
  }>[] = [
    {
      key: 'timestamp',
      label: 'Time',
      formatter: (v: any) => (v ? new Date(v).toLocaleString() : ''),
    },
    { key: 'product_name', label: 'Product' },
    {
      key: 'amount',
      label: 'Amount',
      formatter: (v: any) => `$${(Number(v) || 0).toFixed(2)}`,
    },
    { key: 'reason', label: 'Reason' },
    { key: 'payment_method', label: 'Payment' },
  ];

  const fmt = (n: number) =>
    n >= 1000000
      ? `$${(n / 1000000).toFixed(1)}M`
      : n >= 1000
        ? `$${(n / 1000).toFixed(1)}K`
        : `$${n.toFixed(2)}`;

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (!finData) {
    return (
      <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
        <Typography fontSize={13}>
          {t('argus.userProfiles.financeLoadError', 'Failed to load financial data')}
        </Typography>
      </Box>
    );
  }

  const rows =
    finSubTab === 0
      ? finData.purchases
      : finSubTab === 1
        ? finData.refunds
        : finData.grants;
  const typeLabel =
    finSubTab === 0 ? 'purchases' : finSubTab === 1 ? 'refunds' : 'grants';

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Summary cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            textAlign: 'center',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>
            {t('argus.userProfiles.totalPurchases', 'Purchases')}
          </Typography>
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 800,
              color: ARGUS_SEMANTIC.positive,
              mt: 0.5,
            }}
          >
            {fmt(finData.summary.total_purchases)}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
            {finData.summary.purchase_count} {t('argus.userProfiles.items', 'items')}
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            textAlign: 'center',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>
            {t('argus.userProfiles.totalRefunds', 'Refunds')}
          </Typography>
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 800,
              color: ARGUS_SEMANTIC.negative,
              mt: 0.5,
            }}
          >
            -{fmt(finData.summary.total_refunds)}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
            {finData.summary.refund_count} {t('argus.userProfiles.items', 'items')}
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            textAlign: 'center',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>
            {t('argus.userProfiles.totalGrants', 'Grants')}
          </Typography>
          <Typography
            sx={{
              fontSize: 16,
              fontWeight: 800,
              color: ARGUS_SEMANTIC.warning,
              mt: 0.5,
            }}
          >
            {fmt(finData.summary.total_grants)}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
            {finData.summary.grant_count} {t('argus.userProfiles.items', 'items')}
          </Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 2,
            textAlign: 'center',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Typography sx={{ fontSize: 10, color: 'text.secondary', fontWeight: 600 }}>
            {t('argus.userProfiles.netRevenue', 'Net Revenue')}
          </Typography>
          <Typography sx={{ fontSize: 16, fontWeight: 800, mt: 0.5 }}>
            {fmt(finData.summary.net_revenue)}
          </Typography>
          {finData.summary.refund_rate > 20 && (
            <Chip
              size="small"
              label={`⚠ ${finData.summary.refund_rate.toFixed(0)}% refund`}
              sx={{
                fontSize: 9,
                height: 18,
                bgcolor: 'rgba(244,67,54,0.1)',
                color: ARGUS_SEMANTIC.negative,
                fontWeight: 700,
                mt: 0.5,
              }}
            />
          )}
        </Paper>
      </Box>

      {/* Top Products */}
      {topProducts.length > 0 && (() => {
        const maxCount = topProducts[0].count;
        return (
          <Box
            sx={{
              p: 1.8,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fafafa',
            }}
          >
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 700,
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                mb: 1.5,
              }}
            >
              {t('argus.userProfiles.topProducts', 'Top {{n}} Preferred Products', {
                n: topProducts.length,
              })}
            </Typography>
            {topProducts.map((p, i) => (
              <Box key={p.name} sx={{ mb: i < topProducts.length - 1 ? 1.5 : 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography
                    sx={{
                      fontSize: 12,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      mr: 1,
                    }}
                  >
                    #{i + 1} {p.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                      {t('argus.userProfiles.purchaseCount', '{{n}} purchases', { n: p.count })}
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                      {fmt(p.total)}
                    </Typography>
                  </Box>
                </Box>
                <Box
                  sx={{
                    height: 4,
                    borderRadius: 2,
                    bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      width: `${(p.count / maxCount) * 100}%`,
                      bgcolor: theme.palette.primary.main,
                      borderRadius: 2,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </Box>
              </Box>
            ))}
          </Box>
        );
      })()}

      {/* Sub-tabs */}
      <Tabs
        value={finSubTab}
        onChange={(_, v) => setFinSubTab(v)}
        sx={{
          minHeight: 32,
          '& .MuiTab-root': {
            minHeight: 32,
            fontSize: 12,
            textTransform: 'none',
            py: 0.5,
            fontWeight: 600,
          },
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Tab
          label={`🛒 ${t('argus.userProfiles.purchaseHistory', 'Purchases')} (${finData.purchases.length})`}
        />
        <Tab
          label={`↩️ ${t('argus.userProfiles.refundHistory', 'Refunds')} (${finData.refunds.length})`}
        />
        <Tab
          label={`🎁 ${t('argus.userProfiles.grantHistory', 'Grants')} (${finData.grants.length})`}
        />
      </Tabs>

      {/* Transaction table */}
      {rows.length > 0 ? (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => downloadCsv(rows, finCsvCols, `user_${userId}_${typeLabel}`)}
              sx={{ fontSize: 11, textTransform: 'none', minWidth: 'auto', px: 1.5 }}
            >
              📥 CSV
            </Button>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                  {t('argus.userProfiles.time', 'Time')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                  {t('argus.userProfiles.product', 'Product')}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>
                  {t('argus.userProfiles.amount', 'Amount')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>
                  {finSubTab >= 1
                    ? t('argus.userProfiles.reason', 'Reason')
                    : t('argus.userProfiles.payment', 'Payment')}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={`${row.event_id}-${i}`}>
                  <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {new Date(row.timestamp).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>
                    {row.product_name || '—'}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontSize: 12,
                      fontWeight: 700,
                      color:
                        finSubTab === 1
                          ? ARGUS_SEMANTIC.negative
                          : 'text.primary',
                    }}
                  >
                    {finSubTab === 1 ? '-' : ''}
                    {fmt(row.amount)}
                  </TableCell>
                  <TableCell
                    sx={{
                      fontSize: 12,
                      color: 'text.secondary',
                      textTransform: 'capitalize',
                    }}
                  >
                    {finSubTab >= 1
                      ? (row.reason || '—').replace(/_/g, ' ')
                      : row.payment_method || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      ) : (
        <Typography fontSize={13} color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          {t('argus.userProfiles.noFinanceData', 'No records found')}
        </Typography>
      )}
    </Box>
  );
};

export default UserProfileFinanceTab;
