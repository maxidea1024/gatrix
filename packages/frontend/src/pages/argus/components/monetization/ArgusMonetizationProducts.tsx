import React from 'react';
import {
  Box,
  Typography,
  alpha,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TextField,
  InputAdornment,
  Button,
  LinearProgress,
  Avatar,
  Skeleton,
  Tooltip,
  CircularProgress,
  useTheme,
  Chip,
} from '@mui/material';
import {
  Category as ProductIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import { stringToColor, getInitials } from '@/utils/argusHelpers';
import { downloadCsv } from '@/utils/csvExport';
import { fmt, fmtNum, CHART_COLORS } from './MonetizationHelpers';
import { ARGUS_SEMANTIC } from '../../argusThemeTokens';

interface ArgusMonetizationProductsProps {
  products: any[];
  productSearch: string;
  setProductSearch: (s: string) => void;
  productTrend: any[];
  loading: boolean;
  isDark: boolean;
  t: any;
  handleChartZoom: (
    rawPeriods: string[]
  ) => (startIdx: number, endIdx: number) => void;
  selectedProduct: any;
  setSelectedProduct: (p: any) => void;
  productDetail: any;
  productDetailLoading: boolean;
  loadingMoreBuyers: boolean;
  heatmapData: any[];
  heatmapLoading: boolean;
  openProductDetail: (p: any) => void;
  loadMoreBuyers: () => void;
  categoryBreakdown: any[];
  firstPurchaseProducts: any[];
  navigate: any;
}

export const ArgusMonetizationProducts: React.FC<
  ArgusMonetizationProductsProps
> = ({
  products,
  productSearch,
  setProductSearch,
  productTrend,
  loading,
  isDark,
  t,
  handleChartZoom,
  selectedProduct,
  setSelectedProduct,
  productDetail,
  productDetailLoading,
  loadingMoreBuyers,
  heatmapData,
  heatmapLoading,
  openProductDetail,
  loadMoreBuyers,
  categoryBreakdown,
  firstPurchaseProducts,
  navigate,
}) => {
  const theme = useTheme();

  if (products.length === 0)
    return (
      <EmptyPagePlaceholder
        icon={<ProductIcon sx={{ fontSize: 48 }} />}
        message={t('argus.monetization.noProducts', 'No product data')}
        subtitle={t(
          'argus.monetization.noProductsDesc',
          'No product_name property found in purchase events'
        )}
      />
    );

  const filtered = productSearch
    ? products.filter(
        (p) =>
          p.product_name.toLowerCase().includes(productSearch.toLowerCase()) ||
          p.product_id.toLowerCase().includes(productSearch.toLowerCase())
      )
    : products;

  // Build trend chart datasets from productTrend (top 5)
  const hasTrend = productTrend.length > 0 && productTrend[0].trend.length > 0;
  const trendRawPeriods = hasTrend
    ? productTrend[0].trend.map((d: any) => d.period)
    : [];
  const trendDatasets = hasTrend
    ? productTrend.map((pt, i) => ({
        label: pt.product_name,
        data: pt.trend.map((d: any) => d.revenue),
        color: CHART_COLORS[i % CHART_COLORS.length],
      }))
    : [];

  return (
    <>
      {/* Top 5 Product Trend Chart */}
      {hasTrend && (
        <ArgusVolumeChart
          title={t(
            'argus.monetization.productTrend',
            'Top 5 Product Revenue Trend'
          )}
          rawPeriods={trendRawPeriods}
          labels={[]}
          datasets={trendDatasets}
          loading={loading}
          storagePrefix="argus_product_trend"
          showCompactToggle={false}
          mb={3}
          onZoom={handleChartZoom(trendRawPeriods)}
        />
      )}

      {/* Product Table */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        }}
      >
        <Box
          sx={{ p: 1.5, pl: 2, display: 'flex', gap: 1, alignItems: 'center' }}
        >
          <TextField
            size="small"
            placeholder={t(
              'argus.monetization.searchProducts',
              'Search products...'
            )}
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 18, opacity: 0.5 }} />
                </InputAdornment>
              ),
            }}
            sx={{ width: 280 }}
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              downloadCsv(
                filtered,
                [
                  { key: 'product_name', label: 'Product' },
                  { key: 'product_id', label: 'Product ID' },
                  {
                    key: 'revenue',
                    label: 'Revenue',
                    formatter: (v: any) => `$${(Number(v) || 0).toFixed(2)}`,
                  },
                  {
                    key: 'percentage',
                    label: 'Share %',
                    formatter: (v: any) => `${(Number(v) || 0).toFixed(1)}%`,
                  },
                  { key: 'transactions', label: 'Transactions' },
                  { key: 'buyers', label: 'Buyers' },
                  {
                    key: 'refund_rate',
                    label: 'Refund Rate %',
                    formatter: (v: any) => `${(Number(v) || 0).toFixed(1)}%`,
                  },
                ],
                `products_${new Date().toISOString().slice(0, 10)}`
              )
            }
            sx={{
              fontSize: 11,
              textTransform: 'none',
              minWidth: 'auto',
              px: 1.5,
            }}
          >
            📥 CSV
          </Button>
        </Box>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>
                {t('argus.monetization.productName', 'Product')}
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                {t('argus.monetization.totalRevenue', 'Revenue')}
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                {t('argus.monetization.share', 'Share')}
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                {t('argus.monetization.transactions', 'Transactions')}
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                {t('argus.monetization.buyers', 'Buyers')}
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">
                {t('argus.monetization.refundRate', 'Refund Rate')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((p, i) => (
              <TableRow
                key={p.product_name}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => openProductDetail(p)}
              >
                <TableCell>{i + 1}</TableCell>
                <TableCell>
                  <Typography fontWeight={600} fontSize={13}>
                    {p.product_name}
                  </Typography>
                  {p.product_id && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        fontFamily: 'monospace',
                        fontSize: 11,
                      }}
                    >
                      {p.product_id}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight={600} fontSize={13}>
                    {fmt(p.revenue)}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 1,
                    }}
                  >
                    <LinearProgress
                      variant="determinate"
                      value={p.percentage}
                      sx={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3 }}
                    />
                    <Typography fontSize={12} color="text.secondary">
                      {p.percentage.toFixed(1)}%
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {p.transactions.toLocaleString()}
                </TableCell>
                <TableCell align="right">{p.buyers.toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 0.5,
                    }}
                  >
                    <Typography
                      fontSize={12}
                      color={
                        p.refund_rate > 10
                          ? ARGUS_SEMANTIC.negative
                          : p.refund_rate > 5
                            ? ARGUS_SEMANTIC.warning
                            : 'text.secondary'
                      }
                    >
                      {p.refund_rate > 0 ? `${p.refund_rate.toFixed(1)}%` : '—'}
                    </Typography>
                    {p.refund_rate > 10 && (
                      <Chip
                        size="small"
                        label="!"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 700,
                          bgcolor: alpha(
                            ARGUS_SEMANTIC.negative,
                            isDark ? 0.15 : 0.08
                          ),
                          color: ARGUS_SEMANTIC.negative,
                          border: 'none',
                          minWidth: 0,
                          px: 0.5,
                        }}
                      />
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Category Breakdown */}
      {categoryBreakdown.length > 1 && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            mt: 3,
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('argus.monetization.categoryBreakdown', 'Revenue by Category')}
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  {t('argus.monetization.category', 'Category')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  {t('argus.monetization.totalRevenue', 'Revenue')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  {t('argus.monetization.transactions', 'Transactions')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  %
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const totalCatRevenue = categoryBreakdown.reduce(
                  (s, c) => s + c.revenue,
                  0
                );
                return categoryBreakdown.map((c) => (
                  <TableRow key={c.category} hover>
                    <TableCell>
                      <Chip
                        label={c.category}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontSize={13} fontWeight={600}>
                        {fmt(c.revenue)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {c.transactions.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 1,
                        }}
                      >
                        <LinearProgress
                          variant="determinate"
                          value={
                            totalCatRevenue > 0
                              ? Math.min(
                                  (c.revenue / totalCatRevenue) * 100,
                                  100
                                )
                              : 0
                          }
                          sx={{
                            flex: 1,
                            maxWidth: 60,
                            height: 6,
                            borderRadius: 3,
                          }}
                        />
                        <Typography fontSize={12} color="text.secondary">
                          {totalCatRevenue > 0
                            ? ((c.revenue / totalCatRevenue) * 100).toFixed(1)
                            : '0'}
                          %
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* First Purchase Products — which products drive initial conversion */}
      {firstPurchaseProducts.length > 0 && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            mt: 3,
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t(
                'argus.monetization.firstPurchaseProducts',
                'First Purchase Products'
              )}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t(
                'argus.monetization.firstPurchaseDesc',
                'Products that drive first-time conversions'
              )}
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  {t('argus.monetization.productName', 'Product')}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  {t(
                    'argus.monetization.firstPurchaseCount',
                    'First Purchases'
                  )}
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">
                  %
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(() => {
                const totalFirst = firstPurchaseProducts.reduce(
                  (s, p) => s + p.first_purchase_count,
                  0
                );
                return firstPurchaseProducts.map((p, i) => (
                  <TableRow key={p.product_name} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600} fontSize={13}>
                        {p.product_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {p.first_purchase_count.toLocaleString()}
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 1,
                        }}
                      >
                        <LinearProgress
                          variant="determinate"
                          value={
                            totalFirst > 0
                              ? Math.min(
                                  (p.first_purchase_count / totalFirst) * 100,
                                  100
                                )
                              : 0
                          }
                          sx={{
                            flex: 1,
                            maxWidth: 60,
                            height: 6,
                            borderRadius: 3,
                            '& .MuiLinearProgress-bar': {
                              bgcolor: ARGUS_SEMANTIC.positive,
                            },
                          }}
                        />
                        <Typography fontSize={12} color="text.secondary">
                          {totalFirst > 0
                            ? (
                                (p.first_purchase_count / totalFirst) *
                                100
                              ).toFixed(1)
                            : '0'}
                          %
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Product Detail Drawer */}
      <ResizableDrawer
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.product_name}
        subtitle={selectedProduct?.product_id}
        storageKey="argus-revenue-product-detail"
        defaultWidth={700}
      >
        {productDetailLoading ? (
          <Box
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              overflow: 'auto',
              flex: 1,
            }}
          >
            <Skeleton variant="rounded" height={24} width={200} />
            <ArgusChartSkeleton height={220} />
            <Skeleton variant="rounded" height={200} />
          </Box>
        ) : productDetail ? (
          <Box
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
              overflow: 'auto',
              flex: 1,
            }}
          >
            {/* Summary KPIs */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  flex: 1,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t('argus.monetization.totalRevenue', 'Revenue')}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {fmt(productDetail.summary.total_revenue)}
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  flex: 1,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t('argus.monetization.transactions', 'Transactions')}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {productDetail.summary.total_transactions.toLocaleString()}
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  flex: 1,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {t('argus.monetization.buyers', 'Buyers')}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {productDetail.buyers.length.toLocaleString()}
                  {productDetail.has_more ? '+' : ''}
                </Typography>
              </Paper>
            </Box>

            {/* Volume chart */}
            {productDetail.trend.length > 0 && (
              <ArgusVolumeChart
                title={t(
                  'argus.monetization.dailyTrend',
                  'Daily Revenue Trend'
                )}
                rawPeriods={productDetail.trend.map((d: any) => d.period)}
                labels={[]}
                datasets={[
                  {
                    label: t('argus.monetization.totalRevenue', 'Revenue'),
                    data: productDetail.trend.map((d: any) => d.revenue),
                    color: ARGUS_SEMANTIC.positive,
                  },
                  {
                    label: t('argus.monetization.transactions', 'Transactions'),
                    data: productDetail.trend.map((d: any) => d.transactions),
                    color: theme.palette.primary.main,
                  },
                ]}
                loading={false}
                storagePrefix="argus_product_detail_trend"
                showCompactToggle={false}
                mb={0}
                onZoom={handleChartZoom(
                  productDetail.trend.map((d: any) => d.period)
                )}
              />
            )}

            {/* Buyer list */}
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                {t('argus.monetization.buyerList', 'Buyers')}
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('argus.monetization.userId', 'User ID')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('argus.monetization.totalSpent', 'Total Spent')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('argus.monetization.purchaseCount', 'Purchases')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('argus.monetization.lastPurchase', 'Last Purchase')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productDetail.buyers.map((b: any) => (
                    <TableRow key={b.user_id} hover>
                      <TableCell>
                        <Box
                          onClick={() =>
                            navigate(
                              `/argus/analytics/users/${encodeURIComponent(b.user_id)}`
                            )
                          }
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' },
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              fontSize: 12,
                              bgcolor: stringToColor(b.user_id),
                            }}
                          >
                            {getInitials(b.user_id)}
                          </Avatar>
                          <Typography
                            fontSize={13}
                            fontWeight={600}
                            color="primary"
                            sx={{ fontFamily: 'monospace' }}
                          >
                            {b.user_id}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">{fmt(b.total_spent)}</TableCell>
                      <TableCell align="right">{b.purchase_count}</TableCell>
                      <TableCell align="right">
                        <Typography fontSize={12} color="text.secondary">
                          {new Date(b.last_purchase).toLocaleDateString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {productDetail.has_more && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={loadMoreBuyers}
                    disabled={loadingMoreBuyers}
                    startIcon={
                      loadingMoreBuyers ? (
                        <CircularProgress size={16} />
                      ) : undefined
                    }
                  >
                    {loadingMoreBuyers
                      ? t('common.loading', 'Loading...')
                      : t('argus.monetization.loadMore', 'Load More')}
                  </Button>
                </Box>
              )}
            </Box>

            {/* Hourly Heatmap */}
            {selectedProduct &&
              (() => {
                const dayLabels = [
                  'Mon',
                  'Tue',
                  'Wed',
                  'Thu',
                  'Fri',
                  'Sat',
                  'Sun',
                ];
                const maxRevenue = Math.max(
                  ...heatmapData.map((h: any) => h.revenue),
                  1
                );

                return (
                  <Box>
                    <Typography
                      variant="subtitle2"
                      fontWeight={700}
                      sx={{ mb: 1 }}
                    >
                      Time of Day (Sales Heatmap)
                    </Typography>
                    {heatmapLoading ? (
                      <Skeleton variant="rounded" height={180} />
                    ) : heatmapData.length > 0 ? (
                      <Box sx={{ overflowX: 'auto' }}>
                        {/* Hour labels */}
                        <Box
                          sx={{
                            display: 'flex',
                            gap: '2px',
                            mb: '2px',
                            pl: '40px',
                          }}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <Box
                              key={h}
                              sx={{
                                width: 22,
                                textAlign: 'center',
                                fontSize: 9,
                                color: 'text.secondary',
                              }}
                            >
                              {h}
                            </Box>
                          ))}
                        </Box>
                        {/* Grid rows */}
                        {dayLabels.map((day, di) => (
                          <Box
                            key={di}
                            sx={{
                              display: 'flex',
                              gap: '2px',
                              mb: '2px',
                              alignItems: 'center',
                            }}
                          >
                            <Typography
                              sx={{
                                width: 36,
                                fontSize: 10,
                                color: 'text.secondary',
                                textAlign: 'right',
                                mr: '4px',
                              }}
                            >
                              {day}
                            </Typography>
                            {Array.from({ length: 24 }, (_, h) => {
                              const cell = heatmapData.find(
                                (c: any) =>
                                  c.day_of_week === di + 1 && c.hour === h
                              );
                              const intensity = cell
                                ? cell.revenue / maxRevenue
                                : 0;
                              return (
                                <Tooltip
                                  key={h}
                                  title={
                                    cell
                                      ? `${fmt(cell.revenue)} (${cell.count} txn)`
                                      : '-'
                                  }
                                  arrow
                                >
                                  <Box
                                    sx={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: '3px',
                                      bgcolor:
                                        intensity > 0
                                          ? alpha(
                                              ARGUS_SEMANTIC.positive,
                                              Math.min(
                                                intensity * 0.85 + 0.15,
                                                1
                                              )
                                            )
                                          : isDark
                                            ? 'rgba(255,255,255,0.04)'
                                            : 'rgba(0,0,0,0.04)',
                                      cursor: 'default',
                                      transition: 'transform 0.1s',
                                      '&:hover': {
                                        transform: 'scale(1.3)',
                                        zIndex: 1,
                                      },
                                    }}
                                  />
                                </Tooltip>
                              );
                            })}
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography fontSize={12} color="text.secondary">
                        {t(
                          'argus.monetization.noHeatmapData',
                          'No hourly data available'
                        )}
                      </Typography>
                    )}
                  </Box>
                );
              })()}
          </Box>
        ) : null}
      </ResizableDrawer>
    </>
  );
};
