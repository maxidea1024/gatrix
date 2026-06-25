import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, useTheme, alpha, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Skeleton, Chip, LinearProgress, TextField, InputAdornment,
  ToggleButton, ToggleButtonGroup, Button, CircularProgress, Avatar,
  Select, MenuItem, Collapse, Tooltip, Slider, Autocomplete, Checkbox, FormControlLabel,
  IconButton,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon, ShoppingCart as CartIcon,
  People as PeopleIcon, TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  Category as ProductIcon,
  AccountBalance as EconomyIcon,
  Diamond as DiamondIcon,
  Timeline as LtvIcon,
  ArrowDropUp, ArrowDropDown, ExpandMore, ExpandLess,
  OpenInNew as DrillIcon,
  Search as SearchIcon,
  PersonAdd as NewUserIcon,
  Repeat as RepeatIcon,
  Percent as PercentIcon,
  ReceiptLong as LedgerIcon,
  Explore as DiscoverIcon,
  FilterList as FilterIcon,
  Save as SaveIcon,
  BarChart as BarChartIcon,
  Close as CloseIcon,
  Bookmark as BookmarkIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import DateRangeSelector, {
  DateRangeValue, dateRangeToApiParams,
} from '@/components/common/DateRangeSelector';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import ResizableDrawer from '@/components/common/ResizableDrawer';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { stringToColor, getInitials } from '@/utils/argusHelpers';
import {
  getRevenueAnalytics, getRevenueProducts, getRevenueProductsTrend,
  getRevenueEconomy, getRevenueTopSpenders, getRevenueLtv,
  getRevenueProductDetail, getRevenueCohort, getRevenueFunnel,
  getRevenueLtvCohorts, getRevenueSegmentComparison,
  getRevenueTransactions, getRevenueProductHourly, getTransactionFacets,
  type RevenueData, type ProductRevenue, type ProductTrendData,
  type EconomyData, type TopSpendersData, type LtvData,
  type ProductDetailData, type ProductsResponse,
  type CohortData, type FunnelData, type CohortLtvData, type SegmentComparisonData,
  type TransactionRow, type TransactionResponse, type TransactionGroupedRow,
  type TransactionGroupedResponse, type LedgerGroupBy, type FacetValue,
  type HourlyHeatmapCell,
} from '@/services/argus/argusAnalytics';
import { generateInsights, buildSegmentMatrix, type Insight, type SegmentVerdict } from './revenueInsights';
import { downloadCsv, type CsvColumn } from '@/utils/csvExport';
import { Line } from 'react-chartjs-2';
import {
  discoverQuery,
  getDiscoverVolume,
  listSavedQueries,
  createSavedQuery,
  updateSavedQuery,
  deleteSavedQuery,
} from '@/services/argus/argusIssues';
import {
  QueryAQLEditor,
  DISCOVER_CONFIG,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import SaveQueryDialog from '@/components/argus/SaveQueryDialog';
import DeleteQueryConfirmDialog from '@/components/argus/DeleteQueryConfirmDialog';
import { GroupBySelector, VolumeChart } from './components/discoverHelpers';
import { DiscoverSavedPanel } from './components/DiscoverDialogs';
import { ArgusSavedQuery } from '@/services/argus/argusTypes';

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionId = 'overview' | 'ledger' | 'discover' | 'products' | 'economy' | 'spenders' | 'ltv';

interface NavItem {
  id: SectionId;
  labelKey: string;
  fallback: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', labelKey: 'argus.revenue.sectionOverview', fallback: 'Overview', icon: <MoneyIcon sx={{ fontSize: 18 }} /> },
  { id: 'ledger', labelKey: 'argus.revenue.sectionLedger', fallback: 'Ledger', icon: <LedgerIcon sx={{ fontSize: 18 }} /> },
  { id: 'discover', labelKey: 'argus.revenue.sectionDiscover', fallback: 'Discover', icon: <DiscoverIcon sx={{ fontSize: 18 }} /> },
  { id: 'products', labelKey: 'argus.revenue.sectionProducts', fallback: 'Products', icon: <ProductIcon sx={{ fontSize: 18 }} /> },
  { id: 'economy', labelKey: 'argus.revenue.sectionEconomy', fallback: 'Economy', icon: <EconomyIcon sx={{ fontSize: 18 }} /> },
  { id: 'spenders', labelKey: 'argus.revenue.sectionSpenders', fallback: 'Top Spenders', icon: <DiamondIcon sx={{ fontSize: 18 }} /> },
  { id: 'ltv', labelKey: 'argus.revenue.sectionLtv', fallback: 'LTV', icon: <LtvIcon sx={{ fontSize: 18 }} /> },
];

// ─── Balance Gauge ───────────────────────────────────────────────────────────

interface BalanceGaugeProps {
  ratio: number;
}

const BalanceGauge: React.FC<BalanceGaugeProps> = ({ ratio }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  // Normalize percentage for the progress bar. We assume center 1.0 (50%) of a 0.0 to 2.0 scale.
  const percentage = Math.min(Math.max((ratio / 2) * 100, 0), 100);
  
  let statusText = t('argus.revenue.healthy', 'Healthy Balance');
  let color = '#4caf50';
  let desc = t('argus.revenue.healthyDesc', 'Currency faucet and sink are well balanced.');

  if (ratio > 1.2) {
    statusText = t('argus.revenue.inflationRisk', '⚠ Inflation Risk');
    color = '#f44336';
    desc = t('argus.revenue.inflationRiskDesc', 'Sources are significantly higher than sinks.');
  } else if (ratio < 0.8) {
    statusText = t('argus.revenue.sinkDeficit', '⚠ Sink Deficit');
    color = '#ff9800';
    desc = t('argus.revenue.sinkDeficitDesc', 'Sinks exceed sources; currency is being drained.');
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        borderColor: alpha(color, 0.2),
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {t('argus.revenue.economyBalance', 'ECONOMY BALANCE STATUS')}
        </Typography>
        <Chip
          label={statusText}
          size="small"
          sx={{
            bgcolor: alpha(color, 0.1),
            color: color,
            fontWeight: 700,
            fontSize: 11,
          }}
        />
      </Box>

      <Box sx={{ position: 'relative', height: 8, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 4, my: 3 }}>
        {/* Midpoint line at 1.0 (50%) */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: -4,
            bottom: -4,
            width: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          }}
        />
        {/* Marker */}
        <Box
          sx={{
            position: 'absolute',
            left: `${percentage}%`,
            top: -4,
            transform: 'translateX(-50%)',
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: color,
            border: '2px solid #fff',
            boxShadow: 2,
            transition: 'left 0.3s ease',
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'text.secondary', fontWeight: 600, mb: 1.5 }}>
        <span>0.0 ({t('argus.revenue.sinkOnly', 'Sink Heavy')})</span>
        <span style={{ color: ratio >= 0.8 && ratio <= 1.2 ? color : undefined }}>1.0 ({t('argus.revenue.balanced', 'Balanced')})</span>
        <span>2.0+ ({t('argus.revenue.sourceHeavy', 'Source Heavy')})</span>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11, mt: 1, fontStyle: 'italic' }}>
        {desc}
      </Typography>
    </Paper>
  );
};

// ─── KPI Card ────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  sub?: string;
  change?: number;
  onClick?: () => void;
  sparkData?: number[];
}

const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, color, sub, change, onClick, sparkData }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Paper
      elevation={0}
      onClick={onClick}
      sx={{
        p: 2.5,
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        gap: 2.5,
        bgcolor: isDark ? alpha(color, 0.06) : alpha(color, 0.03),
        border: '1px solid',
        borderColor: alpha(color, isDark ? 0.15 : 0.1),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 25px ${alpha(color, 0.15)}`,
          borderColor: alpha(color, 0.3),
        },
      }}
    >
      <Box
        sx={{
          p: 1.3,
          borderRadius: 2.5,
          background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.7)})`,
          color: '#fff',
          display: 'flex',
          boxShadow: `0 4px 12px ${alpha(color, 0.3)}`,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.3 }}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.5 }}>{value}</Typography>
          {change !== undefined && change !== null && isFinite(change) && (
            <Chip
              size="small"
              icon={change >= 0 ? <ArrowDropUp sx={{ fontSize: 16 }} /> : <ArrowDropDown sx={{ fontSize: 16 }} />}
              label={`${Math.abs(change).toFixed(1)}%`}
              sx={{
                height: 22, fontSize: 11, fontWeight: 700,
                bgcolor: alpha(change >= 0 ? '#4caf50' : '#f44336', isDark ? 0.15 : 0.08),
                color: change >= 0 ? '#4caf50' : '#f44336',
                border: 'none',
                '& .MuiChip-icon': { color: 'inherit', ml: 0.3 },
              }}
            />
          )}
        </Box>
        {sub && <Typography sx={{ fontSize: 11, mt: 0.3, display: 'block', color: 'text.secondary' }}>{sub}</Typography>}
      </Box>
      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <Box sx={{ width: 64, height: 28, flexShrink: 0, opacity: 0.9 }}>
          <Line
            data={{
              labels: sparkData.map((_, i) => i),
              datasets: [{
                data: sparkData,
                borderColor: color,
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                backgroundColor: alpha(color, 0.1),
                tension: 0.4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: { x: { display: false }, y: { display: false } },
              plugins: { legend: { display: false }, tooltip: { enabled: false, external: null as any } },
              animation: false,
            }}
          />
        </Box>
      )}
      {onClick && <DrillIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />}
    </Paper>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctChange(current: number, previous: number): number | undefined {
  if (!previous || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

const fmt = (n: number) =>
  n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `$${(n / 1000).toFixed(1)}K`
    : `$${n.toFixed(2)}`;

const fmtNum = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(1)}K`
    : n.toLocaleString();

const CHART_COLORS = ['#4caf50', '#2196f3', '#ff9800', '#e91e63', '#9c27b0'];

// ─── Sidebar Item ────────────────────────────────────────────────────────────

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
  t: (key: string) => string;
  detail?: string;
}

const SidebarItem: React.FC<SidebarItemProps> = React.memo(
  function SidebarItem({ item, active, isDark, onClick, t, detail }) {
    const theme = useTheme();
    return (
      <Box
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          px: 1.5, py: 1, mb: 0.3,
          borderRadius: '8px 0 0 8px',
          cursor: 'pointer', position: 'relative',
          backgroundColor: active
            ? alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08)
            : 'transparent',
          color: active ? theme.palette.primary.main : 'text.primary',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: active
              ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1)
              : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        {active && (
          <Box sx={{
            position: 'absolute', left: 0, top: '15%', bottom: '15%',
            width: 3, borderRadius: '0 4px 4px 0',
            background: `linear-gradient(180deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.5)})`,
          }} />
        )}
        <Box sx={{ display: 'flex', opacity: active ? 1 : 0.6, color: 'inherit' }}>
          {item.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: active ? 600 : 400 }}>
            {t(item.labelKey)}
          </Typography>
          {detail && (
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: active ? alpha(theme.palette.primary.main, 0.7) : 'text.disabled', mt: -0.2 }}>
              {detail}
            </Typography>
          )}
        </Box>
      </Box>
    );
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════════════

const ALL_SECTION_IDS: SectionId[] = NAV_ITEMS.map((n) => n.id);

const ArgusRevenuePage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');
  const navigate = useNavigate();

  // Section routing via URL query param (?tab=)
  const [searchParams, setSearchParams] = useSearchParams();
  const section = useMemo<SectionId>(() => {
    const tab = searchParams.get('tab') as SectionId;
    return ALL_SECTION_IDS.includes(tab) ? tab : 'overview';
  }, [searchParams]);
  const setSection = useCallback((id: SectionId) => {
    setSearchParams({ tab: id }, { replace: true });
  }, [setSearchParams]);
  const [dateRange, setDateRange] = useState<DateRangeValue>({ type: 'preset', preset: '30d' });

  // Data states
  const [data, setData] = useState<RevenueData | null>(null);
  const [products, setProducts] = useState<ProductRevenue[]>([]);
  const [firstPurchaseProducts, setFirstPurchaseProducts] = useState<{ product_name: string; first_purchase_count: number }[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<{ category: string; revenue: number; transactions: number; buyers: number }[]>([]);
  const [productTrend, setProductTrend] = useState<ProductTrendData[]>([]);
  const [economy, setEconomy] = useState<EconomyData | null>(null);
  const [spenders, setSpenders] = useState<TopSpendersData | null>(null);
  const [ltv, setLtv] = useState<LtvData | null>(null);
  const [cohort, setCohort] = useState<CohortData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [cohortLtv, setCohortLtv] = useState<CohortLtvData | null>(null);
  const [segmentComparison, setSegmentComparison] = useState<SegmentComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  // Track which sections have been loaded at least once (prevents full-page skeleton on revisit)
  const [loadedSections, setLoadedSections] = useState<Set<SectionId>>(new Set());

  // Filter states
  const [productSearch, setProductSearch] = useState('');
  const [economyCurrency, setEconomyCurrency] = useState<string>('gold');
  const [ltvCohortBy, setLtvCohortBy] = useState<string>('week');
  const [cacInput, setCacInput] = useState<number>(10);
  const [funnelOpen, setFunnelOpen] = useState(false);
  const [cohortOpen, setCohortOpen] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);

  // Transaction Ledger state
  const [txData, setTxData] = useState<TransactionResponse | TransactionGroupedResponse | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txType, setTxType] = useState<string>('all');
  const [txSearch, setTxSearch] = useState('');
  const [txSort, setTxSort] = useState<'timestamp' | 'amount'>('timestamp');
  const [txOrder, setTxOrder] = useState<'desc' | 'asc'>('desc');
  const [txOffset, setTxOffset] = useState(0);
  const txLimit = 30;

  const [txGroupBy, setTxGroupBy] = useState<LedgerGroupBy>('none');
  const [txMinAmount, setTxMinAmount] = useState<number | ''>('');
  const [txMaxAmount, setTxMaxAmount] = useState<number | ''>('');
  const [txSelectedUserIds, setTxSelectedUserIds] = useState<string[]>([]);
  const [txSelectedProducts, setTxSelectedProducts] = useState<string[]>([]);
  const [txSelectedReasons, setTxSelectedReasons] = useState<string[]>([]);
  const [txSelectedPaymentMethods, setTxSelectedPaymentMethods] = useState<string[]>([]);

  // Available facet values (fetched from backend)
  const [facetProducts, setFacetProducts] = useState<string[]>([]);
  const [facetReasons, setFacetReasons] = useState<string[]>([]);
  const [facetPaymentMethods, setFacetPaymentMethods] = useState<string[]>([]);

  // Revenue Discover states
  const [discQuery, setDiscQuery] = useState<string>('event_name:purchase');
  const [discFields, setDiscFields] = useState<string[]>(['event_id', 'timestamp', 'user_id', 'product_name', 'amount']);
  const [discGroupBy, setDiscGroupBy] = useState<string[]>([]);
  const [discOrderBy, setDiscOrderBy] = useState<string>('-timestamp');
  const [discYAxis, setDiscYAxis] = useState<string>('sum(amount)');
  const [discHasQueried, setDiscHasQueried] = useState<boolean>(false);
  const [discResults, setDiscResults] = useState<Record<string, any>[]>([]);
  const [discResultsMeta, setDiscResultsMeta] = useState<{ name: string; type: string }[]>([]);
  const [discVolume, setDiscVolume] = useState<{ bucket: string; level: string; count: number }[]>([]);
  const [discOffset, setDiscOffset] = useState<number>(0);
  const discLimit = 50;
  const [discLoading, setDiscLoading] = useState<boolean>(false);
  const [discError, setDiscError] = useState<string | null>(null);

  // Saved Queries states
  const [savedQueries, setSavedQueries] = useState<ArgusSavedQuery[]>([]);
  const [currentQueryId, setCurrentQueryId] = useState<number | null>(null);
  const [queryName, setQueryName] = useState<string>('New Revenue Query');
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [deleteTarget, setDeleteTarget] = useState<ArgusSavedQuery | null>(null);
  const [saveDialogMode, setSaveDialogMode] = useState<'new' | 'saveAs'>('new');
  const [txAdvancedOpen, setTxAdvancedOpen] = useState<boolean>(false);
  const [savedQueriesOpen, setSavedQueriesOpen] = useState<boolean>(false);

  // Product hourly heatmap
  const [heatmapData, setHeatmapData] = useState<HourlyHeatmapCell[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapLoadedFor, setHeatmapLoadedFor] = useState<string | null>(null);

  // Product detail drawer
  const [selectedProduct, setSelectedProduct] = useState<ProductRevenue | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetailData | null>(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);
  const [loadingMoreBuyers, setLoadingMoreBuyers] = useState(false);

  const apiParams = useMemo(() => dateRangeToApiParams(dateRange), [dateRange]);

  // Chart zoom handler: convert chart indices to custom date range
  const handleChartZoom = useCallback((rawPeriods: string[]) => {
    return (startIdx: number, endIdx: number) => {
      const si = Math.min(startIdx, endIdx);
      const ei = Math.max(startIdx, endIdx);
      if (rawPeriods[si] && rawPeriods[ei]) {
        const startDate = new Date(rawPeriods[si]);
        let endDate = new Date(rawPeriods[ei]);
        // Include the last bucket's end
        if (rawPeriods.length > 1) {
          const gap = new Date(rawPeriods[1]).getTime() - new Date(rawPeriods[0]).getTime();
          endDate = new Date(endDate.getTime() + gap);
        } else {
          endDate = new Date(endDate.getTime() + 86400000);
        }
        setDateRange({ type: 'custom', start: startDate, end: endDate });
      }
    };
  }, []);

  // Open product detail drawer
  const openProductDetail = useCallback(async (product: ProductRevenue) => {
    setSelectedProduct(product);
    setProductDetail(null);
    // Reset heatmap for new product (#3)
    setHeatmapData([]);
    setHeatmapLoadedFor(null);
    setProductDetailLoading(true);
    try {
      const detail = await getRevenueProductDetail(projectId, {
        ...apiParams,
        product_name: product.product_name,
        offset: 0,
        limit: 20,
      });
      setProductDetail(detail);
    } catch {
      // empty
    } finally {
      setProductDetailLoading(false);
    }
  }, [projectId, apiParams]);

  // Load more buyers
  const loadMoreBuyers = useCallback(async () => {
    if (!selectedProduct || !productDetail) return;
    setLoadingMoreBuyers(true);
    try {
      const more = await getRevenueProductDetail(projectId, {
        ...apiParams,
        product_name: selectedProduct.product_name,
        offset: productDetail.buyers.length,
        limit: 20,
      });
      setProductDetail((prev) => prev ? {
        ...prev,
        buyers: [...prev.buyers, ...more.buyers],
        has_more: more.has_more,
      } : prev);
    } catch {
      // empty
    } finally {
      setLoadingMoreBuyers(false);
    }
  }, [selectedProduct, productDetail, projectId, apiParams]);

  // Fix #1: Load heatmap via useEffect, not render body
  useEffect(() => {
    if (!selectedProduct || heatmapLoadedFor === selectedProduct.product_name) return;
    setHeatmapLoading(true);
    setHeatmapLoadedFor(selectedProduct.product_name);
    getRevenueProductHourly(projectId, { ...apiParams, product_name: selectedProduct.product_name, tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
      .then(res => setHeatmapData(res.heatmap))
      .catch(() => setHeatmapData([]))
      .finally(() => setHeatmapLoading(false));
  }, [selectedProduct, heatmapLoadedFor, projectId, apiParams]);

  // Fix #8: Reset stale txData when date range changes
  useEffect(() => {
    setTxData(null);
    setTxOffset(0);
  }, [apiParams]);

  // Load transactions ledger data
  const loadTx = useCallback(async (
    typeOverride?: string,
    offsetOverride?: number,
    sortOverride?: string,
    orderOverride?: string,
    groupByOverride?: LedgerGroupBy
  ) => {
    setTxLoading(true);
    try {
      const activeGroupBy = groupByOverride !== undefined ? groupByOverride : txGroupBy;
      const result = await getRevenueTransactions(projectId, {
        ...apiParams,
        type: typeOverride ?? txType,
        ...(txSearch ? { product: txSearch } : {}),
        sort: sortOverride ?? txSort,
        order: orderOverride ?? txOrder,
        offset: offsetOverride ?? txOffset,
        limit: txLimit,
        group_by: activeGroupBy,
        ...(txMinAmount !== '' ? { min_amount: Number(txMinAmount) } : {}),
        ...(txMaxAmount !== '' ? { max_amount: Number(txMaxAmount) } : {}),
        ...(txSelectedUserIds.length > 0 ? { user_ids: txSelectedUserIds.join(',') } : {}),
        ...(txSelectedProducts.length > 0 ? { products: txSelectedProducts.join(',') } : {}),
        ...(txSelectedReasons.length > 0 ? { reasons: txSelectedReasons.join(',') } : {}),
        ...(txSelectedPaymentMethods.length > 0 ? { payment_methods: txSelectedPaymentMethods.join(',') } : {}),
      });
      setTxData(result);
    } catch (e) {
      /* ignore */
    } finally {
      setTxLoading(false);
    }
  }, [
    projectId,
    apiParams,
    txType,
    txSearch,
    txSort,
    txOrder,
    txOffset,
    txGroupBy,
    txMinAmount,
    txMaxAmount,
    txSelectedUserIds,
    txSelectedProducts,
    txSelectedReasons,
    txSelectedPaymentMethods,
  ]);

  // Load ledger autocomplete facets when ledger section is open
  useEffect(() => {
    if (section !== 'ledger') return;
    getTransactionFacets(projectId, { ...apiParams, facet: 'product' })
      .then(res => setFacetProducts(res.map(r => r.value)))
      .catch(() => {});
    getTransactionFacets(projectId, { ...apiParams, facet: 'reason' })
      .then(res => setFacetReasons(res.map(r => r.value)))
      .catch(() => {});
    getTransactionFacets(projectId, { ...apiParams, facet: 'payment_method' })
      .then(res => setFacetPaymentMethods(res.map(r => r.value)))
      .catch(() => {});
  }, [projectId, apiParams, section]);

  // Automatically trigger fetch when filters or offsets change
  useEffect(() => {
    if (section === 'ledger') {
      loadTx();
    }
  }, [
    section,
    txType,
    txSort,
    txOrder,
    txOffset,
    txGroupBy,
    txMinAmount,
    txMaxAmount,
    txSelectedUserIds,
    txSelectedProducts,
    txSelectedReasons,
    txSelectedPaymentMethods,
  ]);

  // Load saved queries
  const loadSavedQueries = useCallback(async () => {
    try {
      const q = await listSavedQueries(projectId, 'revenue');
      setSavedQueries(q);
    } catch {
      // empty
    }
  }, [projectId]);

  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  // Handle saving a query
  const handleSaveQuery = async (name: string, existingQueryId: number | null) => {
    try {
      const config = section === 'discover' ? {
        q: discQuery,
        fields: discFields,
        groupBy: discGroupBy,
        orderBy: discOrderBy,
        yAxis: discYAxis,
      } : {
        type: txType,
        search: txSearch,
        sort: txSort,
        order: txOrder,
        group_by: txGroupBy,
        min_amount: txMinAmount,
        max_amount: txMaxAmount,
        user_ids: txSelectedUserIds,
        products: txSelectedProducts,
        reasons: txSelectedReasons,
        payment_methods: txSelectedPaymentMethods,
      };

      if (existingQueryId) {
        await updateSavedQuery(projectId, existingQueryId, {
          name,
          query_config: config,
        });
      } else {
        await createSavedQuery(projectId, {
          name,
          query_type: 'revenue',
          query_config: config,
          display_type: 'table',
        });
      }
      setSaveDialogOpen(false);
      loadSavedQueries();
    } catch (e) {
      console.error('Failed to save query:', e);
    }
  };

  // Handle deleting a query
  const handleDeleteQuery = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSavedQuery(projectId, deleteTarget.id);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadSavedQueries();
    } catch (e) {
      console.error('Failed to delete query:', e);
    }
  };

  // Handle loading a saved query configuration
  const handleLoadSavedQuery = useCallback((sq: ArgusSavedQuery) => {
    const config = sq.query_config || {};
    if (sq.query_config?.q !== undefined) {
      // It is a discover query
      setDiscQuery(config.q || '');
      setDiscFields(config.fields || ['event_id', 'timestamp', 'user_id', 'product_name', 'amount']);
      setDiscGroupBy(config.groupBy || []);
      setDiscOrderBy(config.orderBy || '-timestamp');
      setDiscYAxis(config.yAxis || 'sum(amount)');
      setSection('discover');
      setCurrentQueryId(sq.id);
      setQueryName(sq.name);
      setDiscOffset(0);
      setDiscHasQueried(false);
    } else {
      // It is a ledger query
      setTxType(config.type || 'all');
      setTxSearch(config.search || '');
      setTxSort(config.sort || 'timestamp');
      setTxOrder(config.order || 'desc');
      setTxGroupBy(config.group_by || 'none');
      setTxMinAmount(config.min_amount !== undefined ? config.min_amount : '');
      setTxMaxAmount(config.max_amount !== undefined ? config.max_amount : '');
      setTxSelectedUserIds(config.user_ids || []);
      setTxSelectedProducts(config.products || []);
      setTxSelectedReasons(config.reasons || []);
      setTxSelectedPaymentMethods(config.payment_methods || []);
      setSection('ledger');
      setTxOffset(0);
    }
  }, [setSection]);

  // Discover autocompletion search suggestions resolver
  const fetchFieldValues = useCallback(async (fieldKey: string): Promise<string[]> => {
    try {
      let facet = fieldKey;
      if (fieldKey === 'product_name') facet = 'product';
      else if (fieldKey === 'user_id') facet = 'user';
      else if (fieldKey === 'reason') facet = 'reason';
      else if (fieldKey === 'payment_method') facet = 'payment_method';

      const data = await getTransactionFacets(projectId, { ...apiParams, facet });
      return data.map(d => d.value);
    } catch {
      return [];
    }
  }, [projectId, apiParams]);

  // Run AQL query in discover mode
  const runDiscoverQuery = useCallback(async (offsetOverride?: number) => {
    setDiscLoading(true);
    setDiscError(null);
    setDiscHasQueried(true);
    const targetOffset = offsetOverride !== undefined ? offsetOverride : discOffset;
    try {
      const result = await discoverQuery(projectId, {
        fields: discFields,
        conditions: discQuery,
        groupBy: discGroupBy.length > 0 ? discGroupBy : undefined,
        limit: discLimit,
        offset: targetOffset,
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
        dataset: 'activities',
      });
      setDiscResults(result.data || []);
      setDiscResultsMeta(result.meta?.fields || []);

      // Fetch volume for visual chart
      const volData = await getDiscoverVolume(projectId, {
        period: apiParams.period,
        start: apiParams.start,
        end: apiParams.end,
        search: discQuery,
        dataset: 'activities',
      });
      setDiscVolume(volData);
    } catch (err: any) {
      setDiscError(err?.message || 'Query execution failed');
      setDiscResults([]);
      setDiscVolume([]);
    } finally {
      setDiscLoading(false);
    }
  }, [projectId, apiParams, discQuery, discFields, discGroupBy, discOffset]);

  // Handle Search Input in Discover
  const handleSearchSubmit = useCallback((q: string) => {
    setDiscQuery(q);
    setDiscOffset(0);
  }, []);

  const handleSearchChange = useCallback((q: string) => {
    setDiscQuery(q);
  }, []);

  // Load data based on active section — with per-section cache
  const loadedKeysRef = React.useRef<Record<string, string>>({});
  const loadData = useCallback(async () => {
    // Build a cache key that includes section-specific sub-params
    const cacheKey = JSON.stringify({
      projectId, apiParams,
      ...(section === 'economy' ? { economyCurrency } : {}),
      ...(section === 'ltv' ? { ltvCohortBy } : {}),
    });

    // Skip fetch entirely if this section was already loaded with the same params
    if (loadedKeysRef.current[section] === cacheKey) return;

    // Only show full skeleton if we have NO cached data at all for this section
    const hasCachedData = (() => {
      switch (section) {
        case 'overview': return !!data;
        case 'ledger': return true;
        case 'discover': return true;
        case 'products': return products.length > 0;
        case 'economy': return !!economy;
        case 'spenders': return !!spenders;
        case 'ltv': return !!ltv;
        default: return false;
      }
    })();
    if (!hasCachedData) setLoading(true);

    try {
      if (section === 'overview') {
        const [rev, coh, fun] = await Promise.all([
          getRevenueAnalytics(projectId, apiParams),
          getRevenueCohort(projectId, apiParams),
          getRevenueFunnel(projectId, apiParams),
        ]);
        setData(rev);
        setCohort(coh);
        setFunnel(fun);
      } else if (section === 'products') {
        const [prodResp, trend] = await Promise.all([
          getRevenueProducts(projectId, apiParams),
          getRevenueProductsTrend(projectId, apiParams),
        ]);
        setProducts(prodResp.products);
        setFirstPurchaseProducts(prodResp.first_purchase_products);
        setCategoryBreakdown(prodResp.category_breakdown || []);
        setProductTrend(trend);
      } else if (section === 'economy') {
        // Load both: unfiltered (for by_currency) and filtered (for flow chart)
        const economyParams = economyCurrency !== 'all'
          ? { ...apiParams, currency_type: economyCurrency }
          : apiParams;
        setEconomy(await getRevenueEconomy(projectId, economyParams));
      } else if (section === 'spenders') {
        const [sp, seg] = await Promise.all([
          getRevenueTopSpenders(projectId, apiParams),
          getRevenueSegmentComparison(projectId, apiParams),
        ]);
        setSpenders(sp);
        setSegmentComparison(seg);
      } else if (section === 'ltv') {
        const [ltvBase, ltvCoh] = await Promise.all([
          getRevenueLtv(projectId, apiParams),
          getRevenueLtvCohorts(projectId, { ...apiParams, cohort_by: ltvCohortBy }),
        ]);
        setLtv(ltvBase);
        setCohortLtv(ltvCoh);
      }
      loadedKeysRef.current[section] = cacheKey;
      setLoadedSections(prev => new Set(prev).add(section));
    } catch {
      // Data stays null → sections show empty state
    } finally {
      setLoading(false);
    }
  }, [projectId, section, apiParams, economyCurrency, ltvCohortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData(); }, [loadData]);

  // Synchronize economy currency if selection becomes invalid or is empty
  useEffect(() => {
    if (section === 'economy' && economy && economy.by_currency.length > 0) {
      const valid = economy.by_currency.some((c) => c.currency_type === economyCurrency);
      if (!valid) {
        setEconomyCurrency(economy.by_currency[0].currency_type);
      }
    }
  }, [section, economy, economyCurrency]);

  // When dateRange changes, clear cached data so it reloads
  useEffect(() => {
    setData(null);
    setProducts([]);
    setFirstPurchaseProducts([]);
    setCategoryBreakdown([]);
    setProductTrend([]);
    setEconomy(null);
    setSpenders(null);
    setLtv(null);
    setCohort(null);
    setFunnel(null);
    setCohortLtv(null);
    setSegmentComparison(null);
    setLoadedSections(new Set());
    loadedKeysRef.current = {};
  }, [dateRange]);

  // ─── Render Overview ──────────────────────────────────────────────────────

  const renderOverview = () => {
    if (!data) return <EmptyPagePlaceholder icon={<MoneyIcon sx={{ fontSize: 48 }} />} message={t('argus.revenue.noData', 'No data')} subtitle={t('argus.revenue.noDataDesc', 'No purchase events found')} />;

    const insights = generateInsights(data, products, spenders, t as any);
    const sparkRevenue = data.revenue_over_time.slice(-14).map(d => d.revenue);
    const hasAdRevenue = data.total_ad_revenue > 0;

    const severityColors: Record<string, string> = {
      positive: '#4caf50', warning: '#ff9800', critical: '#f44336', info: '#2196f3',
    };

    // Shared section header style
    const sectionHeaderSx = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.8, color: 'text.secondary', mb: 1.5 };

    return (
      <>
        {/* ════════ 1. HERO REVENUE PANEL ════════ */}
        <Paper elevation={0} sx={{
          p: 3, borderRadius: 3, mb: 3,
          background: isDark
            ? `linear-gradient(135deg, ${alpha('#4caf50', 0.08)} 0%, ${alpha('#2196f3', 0.05)} 100%)`
            : `linear-gradient(135deg, ${alpha('#4caf50', 0.04)} 0%, ${alpha('#2196f3', 0.02)} 100%)`,
          border: '1px solid', borderColor: isDark ? alpha('#4caf50', 0.15) : alpha('#4caf50', 0.1),
        }}>
          {/* Row 1: Blended Revenue (hero number) */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 0.3 }}>
                {hasAdRevenue ? t('argus.revenue.blendedRevenue', 'Blended Revenue') : t('argus.revenue.totalRevenue', 'Total Revenue')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5 }}>
                <Typography sx={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, lineHeight: 1.1 }}>
                  {fmt(hasAdRevenue ? data.blended_revenue : data.total_revenue)}
                </Typography>
                {(() => {
                  const chg = pctChange(
                    hasAdRevenue ? data.blended_revenue : data.total_revenue,
                    hasAdRevenue ? data.prev_blended_revenue : data.prev_total_revenue,
                  );
                  return chg !== undefined ? (
                    <Chip size="small"
                      icon={chg >= 0 ? <ArrowDropUp sx={{ fontSize: 16 }} /> : <ArrowDropDown sx={{ fontSize: 16 }} />}
                      label={`${Math.abs(chg).toFixed(1)}%`}
                      sx={{
                        height: 22, fontSize: 11, fontWeight: 700,
                        bgcolor: alpha(chg >= 0 ? '#4caf50' : '#f44336', isDark ? 0.15 : 0.08),
                        color: chg >= 0 ? '#4caf50' : '#f44336', border: 'none',
                        '& .MuiChip-icon': { color: 'inherit', ml: 0.2 },
                      }}
                    />
                  ) : null;
                })()}
              </Box>
            </Box>
            {/* Mini sparkline area */}
            {sparkRevenue.length > 3 && (
              <Box sx={{ width: 120, height: 40, display: 'flex', alignItems: 'flex-end', gap: '2px', opacity: 0.6 }}>
                {sparkRevenue.map((v, i) => {
                  const max = Math.max(...sparkRevenue);
                  return <Box key={i} sx={{ flex: 1, bgcolor: '#4caf50', borderRadius: '2px 2px 0 0', height: `${max > 0 ? (v / max) * 100 : 0}%`, minHeight: 2 }} />;
                })}
              </Box>
            )}
          </Box>

          {/* Row 2: IAP/Ad split (only if ad revenue exists) */}
          {hasAdRevenue && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5 }}>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ height: 6, flex: data.iap_share, bgcolor: '#4caf50', borderRadius: '3px 0 0 3px' }} />
                <Box sx={{ height: 6, flex: data.ad_share, bgcolor: '#2196f3', borderRadius: '0 3px 3px 0' }} />
              </Box>
              <Typography fontSize={11} color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                <Box component="span" sx={{ color: '#4caf50', fontWeight: 700 }}>IAP {fmt(data.total_revenue)} ({data.iap_share < 1 && data.iap_share > 0 ? '< 1' : data.iap_share.toFixed(0)}%)</Box>
                {' · '}
                <Box component="span" sx={{ color: '#2196f3', fontWeight: 700 }}>Ad {fmt(data.total_ad_revenue)} ({data.ad_share < 1 && data.ad_share > 0 ? '< 1' : data.ad_share.toFixed(0)}%)</Box>
              </Typography>
            </Box>
          )}

          {/* Row 3: Gross → Refund → Net flow (includes Ad if available) */}
          {(data.total_refunds > 0 || hasAdRevenue) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mt: 1, flexWrap: 'wrap' }}>
              <Typography fontSize={12} color="text.secondary">
                {t('argus.revenue.grossRevenue', 'Gross')} <Box component="span" fontWeight={700}>{fmt(data.total_revenue + (hasAdRevenue ? data.total_ad_revenue : 0))}</Box>
              </Typography>
              {data.total_refunds > 0 && (<>
                <Typography fontSize={12} color="text.secondary">→</Typography>
                <Typography fontSize={12} sx={{ color: '#f44336' }}>
                  {t('argus.revenue.totalRefunds', 'Refunds')} <Box component="span" fontWeight={700}>-{fmt(data.total_refunds)}</Box>
                  {' '}({data.refund_rate.toFixed(1)}%)
                </Typography>
              </>)}
              <Typography fontSize={12} color="text.secondary">→</Typography>
              <Typography fontSize={12} color="text.primary" fontWeight={700}>
                {t('argus.revenue.netRevenue', 'Net')} <Box component="span" fontWeight={700}>{fmt((data.total_revenue + (hasAdRevenue ? data.total_ad_revenue : 0)) - data.total_refunds)}</Box>
              </Typography>
            </Box>
          )}

          {/* Row 4: Key metrics line */}
          <Box sx={{
            display: 'flex', gap: 2.5, mt: 2, pt: 1.5,
            borderTop: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            flexWrap: 'wrap',
          }}>
            {[
              { label: t('argus.revenue.purchaseCount', 'Purchases'), value: data.total_transactions.toLocaleString(), prev: data.prev_total_transactions, icon: '🛒' },
              { label: t('argus.revenue.payingUsers', 'Payers'), value: data.total_paying_users.toLocaleString(), prev: data.prev_total_paying_users, icon: '👥' },
              { label: t('argus.revenue.conversionRate', 'Conversion'), value: `${data.conversion_rate.toFixed(2)}%`, prev: data.prev_conversion_rate, isPercent: true, icon: '🎯' },
              { label: t('argus.revenue.aov', 'AOV'), value: `$${data.avg_order_value.toFixed(2)}`, prev: data.prev_avg_order_value, icon: '💎' },
              { label: t('argus.revenue.arpu', 'ARPU'), value: `$${data.arpu.toFixed(2)}`, prev: data.prev_arpu, icon: '📊' },
              { label: t('argus.revenue.arppu', 'ARPPU'), value: `$${data.arppu.toFixed(2)}`, prev: data.prev_arppu, icon: '💰' },
            ].map((m) => {
              const chg = m.isPercent ? (Number(m.value.replace('%', '')) - (m.prev || 0)) : pctChange(parseFloat(m.value.replace(/[$,%]/g, '')) || 0, m.prev || 0);
              return (
                <Box key={m.label} sx={{ display: 'flex', flexDirection: 'column', minWidth: 80 }}>
                  <Typography fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {m.icon} {m.label}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                    <Typography fontSize={14} fontWeight={800}>{m.value}</Typography>
                    {chg !== undefined && Math.abs(chg) >= 0.1 && (
                      <Typography fontSize={10} fontWeight={700} sx={{ color: chg >= 0 ? '#4caf50' : '#f44336' }}>
                        {chg >= 0 ? '+' : ''}{typeof chg === 'number' ? (m.isPercent ? `${chg.toFixed(1)}%p` : `${chg.toFixed(1)}%`) : ''}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
            {/* New vs Repeat inline */}
            <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 100 }}>
              <Typography fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {t('argus.revenue.newVsRepeat', 'New vs Repeat')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4caf50' }} />
                  <Typography fontSize={12} fontWeight={700}>{data.first_purchasers.toLocaleString()}</Typography>
                </Box>
                <Typography fontSize={10} color="text.secondary">/</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff9800' }} />
                  <Typography fontSize={12} fontWeight={700}>{data.repeat_purchasers.toLocaleString()}</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ════════ 2. INSIGHTS ════════ */}
        {insights.length > 0 && (
          <Paper elevation={0} sx={{
            p: 2.5, borderRadius: 3, mb: 3,
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
            border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}>
            <Typography sx={sectionHeaderSx}>
              📊 {t('argus.revenue.insightsTitle', 'Revenue Insights')}
            </Typography>
            {(() => {
              const visibleInsights = showAllInsights ? insights : insights.slice(0, 3);
              return (
                <>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {visibleInsights.map((insight, idx) => (
                      <Box key={idx} sx={{
                        display: 'flex', gap: 1.5, alignItems: 'flex-start',
                        p: 1.5, borderRadius: 2,
                        bgcolor: isDark ? alpha(severityColors[insight.severity], 0.06) : alpha(severityColors[insight.severity], 0.03),
                        border: '1px solid', borderColor: alpha(severityColors[insight.severity], isDark ? 0.12 : 0.06),
                        ...(insight.drilldown ? { cursor: 'pointer', '&:hover': { bgcolor: isDark ? alpha(severityColors[insight.severity], 0.1) : alpha(severityColors[insight.severity], 0.06) } } : {}),
                      }}
                        onClick={() => {
                          if (!insight.drilldown) return;
                          if (insight.drilldown.type === 'scroll' && insight.drilldown.target) {
                            document.getElementById(insight.drilldown.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          } else if (insight.drilldown.type === 'ledger') {
                            const filterType = insight.drilldown.ledgerFilter?.type || 'all';
                            setTxType(filterType);
                            setTxOffset(0);
                            setTxGroupBy('none');
                            setTxMinAmount('');
                            setTxMaxAmount('');
                            setTxSelectedUserIds([]);
                            setTxSelectedProducts([]);
                            setTxSelectedReasons([]);
                            setTxSelectedPaymentMethods([]);
                            setSection('ledger');
                          }
                        }}
                      >
                        <Typography sx={{ fontSize: 18, lineHeight: 1, flexShrink: 0, mt: 0.2 }}>{insight.icon}</Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 700, color: severityColors[insight.severity] }}>
                            {insight.title}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.2 }}>
                            {insight.detail}
                          </Typography>
                          {insight.action && (
                            <Typography sx={{ fontSize: 11, fontWeight: 600, color: severityColors[insight.severity], mt: 0.5, fontStyle: 'italic' }}>
                              💡 {insight.action}
                            </Typography>
                          )}
                          {insight.drilldown && (
                            <Typography sx={{ fontSize: 10, color: 'primary.main', mt: 0.3, fontWeight: 600 }}>
                              🔗 {insight.drilldown.type === 'ledger' ? t('argus.revenue.viewInLedger', 'View in Transaction Ledger →') : t('argus.revenue.jumpToSection', 'Jump to section →')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                  {insights.length > 3 && (
                    <Box sx={{ textAlign: 'center', mt: 1 }}>
                      <Typography
                        onClick={() => setShowAllInsights(!showAllInsights)}
                        sx={{ fontSize: 11, fontWeight: 600, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {showAllInsights ? t('common.showLess', 'Show less') : t('common.showMore', '+{{count}} more', { count: insights.length - 3 })}
                      </Typography>
                    </Box>
                  )}
                </>
              );
            })()}
          </Paper>
        )}

        {/* ════════ 3. REVENUE TREND + COMPOSITION (70:30) ════════ */}
        <Box id="revenue-trend" sx={{ display: 'flex', gap: 2, mb: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Left: Trend Chart (70%) */}
          <Box sx={{ flex: 7, minWidth: 0 }}>
            <ArgusVolumeChart
              title={t('argus.revenue.dailyTrend', 'Daily Revenue Trend')}
              labels={data.revenue_over_time.map((d) =>
                new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              )}
              datasets={[
                { label: t('argus.revenue.iapRevenue', 'IAP Revenue'), data: data.revenue_over_time.map((d) => d.revenue), color: '#4caf50' },
                ...(hasAdRevenue ? [{
                  label: t('argus.revenue.adRevenue', 'Ad Revenue'),
                  data: data.revenue_over_time.map((d) => {
                    const match = data.ad_revenue_over_time.find(a => a.period === d.period);
                    return match ? match.ad_revenue : 0;
                  }),
                  color: '#2196f3',
                }] : []),
                { label: t('argus.revenue.transactions', 'Transactions'), data: data.revenue_over_time.map((d) => d.transactions), color: theme.palette.primary.main },
                ...(data.prev_revenue_over_time.length > 0 ? [{
                  label: t('argus.revenue.prevRevenue', 'Prev. Revenue'),
                  data: data.prev_revenue_over_time.map((d) => d.revenue),
                  color: alpha('#4caf50', 0.3),
                }] : []),
                ...(data.refunds_over_time.length > 0 ? [{
                  label: t('argus.revenue.totalRefunds', 'Refunds'),
                  data: data.revenue_over_time.map((d) => {
                    const match = data.refunds_over_time.find(r => r.period === d.period);
                    return match ? match.refunds : 0;
                  }),
                  color: '#f44336',
                }] : []),
              ]}
              loading={loading}
              storagePrefix="argus_revenue_trend"
              showCompactToggle={false}
              onZoom={handleChartZoom(data.revenue_over_time.map((d) => d.period))}
            />
          </Box>

          {/* Right: Composition Panel (30%) */}
          <Box sx={{ flex: 3, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Payment Method */}
            {data.revenue_by_payment_method.length > 1 && (
              <Paper elevation={0} sx={{
                p: 2, borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}>
                <Typography sx={{ ...sectionHeaderSx, mb: 1 }}>
                  💳 {t('argus.revenue.paymentMethod', 'Payment Method')}
                </Typography>
                {data.revenue_by_payment_method.map((pm) => {
                  const pct = data.total_revenue > 0 ? (pm.revenue / data.total_revenue) * 100 : 0;
                  const pmColors: Record<string, string> = { cash: '#2196f3', gift_card: '#ff9800', credit: '#9c27b0', promotion: '#4caf50' };
                  return (
                    <Box key={pm.payment_method} sx={{ mb: 0.8 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                        <Typography fontSize={11} fontWeight={600}>
                          {t(`argus.revenue.payment_${pm.payment_method}`, pm.payment_method)}
                        </Typography>
                        <Typography fontSize={11} fontWeight={700}>{pct.toFixed(0)}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={Math.min(pct, 100)}
                        sx={{ height: 4, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                          '& .MuiLinearProgress-bar': { bgcolor: pmColors[pm.payment_method] || '#607d8b', borderRadius: 2 },
                        }}
                      />
                    </Box>
                  );
                })}
              </Paper>
            )}

            {/* New vs Repeat visual */}
            {data.total_paying_users > 0 && (
              <Paper elevation={0} sx={{
                p: 2, borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
                border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              }}>
                <Typography sx={{ ...sectionHeaderSx, mb: 1 }}>
                  {t('argus.revenue.purchaserMix', 'Purchaser Mix')}
                </Typography>
                {data.repeat_purchasers === 0 ? (
                  <Typography fontSize={12} fontWeight={600} color="text.secondary">
                    {t('argus.revenue.allNewPurchasers', 'All purchasers are first-time buyers')}
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1, mb: 0.8 }}>
                    <Box sx={{ flex: data.first_purchasers, height: 20, bgcolor: '#4caf50', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography fontSize={9} fontWeight={700} color="#fff">{t('argus.revenue.new', 'New')} {((data.first_purchasers / data.total_paying_users) * 100).toFixed(0)}%</Typography>
                    </Box>
                    <Box sx={{ flex: data.repeat_purchasers, height: 20, bgcolor: '#ff9800', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography fontSize={9} fontWeight={700} color="#fff">{t('argus.revenue.repeat', 'Repeat')} {((data.repeat_purchasers / data.total_paying_users) * 100).toFixed(0)}%</Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            )}
          </Box>
        </Box>

        {/* ARPDAU trend */}
        {data.revenue_over_time.some((d) => d.arpdau > 0) && (
          <ArgusVolumeChart
            title={t('argus.revenue.arpdauTrend', 'ARPDAU (Avg Revenue Per Daily Active User)')}
            labels={data.revenue_over_time.map((d) =>
              new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            )}
            datasets={[
              { label: 'ARPDAU', data: data.revenue_over_time.map((d) => d.arpdau), color: '#ff9800' },
            ]}
            loading={loading}
            storagePrefix="argus_arpdau_trend"
            showCompactToggle={false}
            mb={3}
            onZoom={handleChartZoom(data.revenue_over_time.map((d) => d.period))}
          />
        )}

        {/* ════════ 4. AD REVENUE DETAIL ════════ */}
        {hasAdRevenue && (
          <Paper elevation={0} sx={{
            p: 2.5, borderRadius: 3, mb: 3,
            bgcolor: isDark ? alpha('#2196f3', 0.04) : alpha('#2196f3', 0.02),
            border: '1px solid', borderColor: alpha('#2196f3', isDark ? 0.15 : 0.08),
          }}>
            {/* Ad Revenue Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography sx={sectionHeaderSx}>📺 {t('argus.revenue.adRevenueDetail', 'Ad Revenue')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 3 }}>
                {[
                  { label: t('argus.revenue.adRevenueTotal', 'Revenue'), value: fmt(data.total_ad_revenue) },
                  { label: t('argus.revenue.avgEcpm', 'eCPM'), value: `$${data.avg_ecpm.toFixed(2)}` },
                  { label: t('argus.revenue.totalImpressions', 'Impressions'), value: data.total_impressions.toLocaleString() },
                  { label: t('argus.revenue.adClicks', 'Clicks'), value: data.total_ad_clicks.toLocaleString() },
                ].map((m) => (
                  <Box key={m.label} sx={{ textAlign: 'center' }}>
                    <Typography fontSize={10} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.3 }}>{m.label}</Typography>
                    <Typography fontSize={16} fontWeight={800}>{m.value}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* 3-column breakdown */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
              {/* By Ad Type */}
              <Box>
                <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
                  {t('argus.revenue.byAdType', 'By Type')}
                </Typography>
                {data.revenue_by_ad_type.slice(0, 5).map((at) => (
                  <Box key={at.ad_type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.4 }}>
                    <Typography fontSize={12} fontWeight={600} sx={{ textTransform: 'capitalize' }}>{at.ad_type.replace(/_/g, ' ')}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'baseline' }}>
                      <Typography fontSize={12} fontWeight={700}>{fmt(at.revenue)}</Typography>
                      <Typography fontSize={10} color="text.secondary">${at.ecpm.toFixed(1)}</Typography>
                    </Box>
                  </Box>
                ))}
                {data.revenue_by_ad_type.length > 5 && (
                  <Typography fontSize={10} color="text.secondary" sx={{ mt: 0.5 }}>+{data.revenue_by_ad_type.length - 5} more</Typography>
                )}
              </Box>

              {/* By Placement */}
              <Box>
                <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
                  {t('argus.revenue.byPlacement', 'By Placement')}
                </Typography>
                {data.revenue_by_placement.slice(0, 5).map((p) => (
                  <Box key={p.placement} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.4 }}>
                    <Typography fontSize={12} fontWeight={600} sx={{ textTransform: 'capitalize' }}>{p.placement.replace(/_/g, ' ')}</Typography>
                    <Typography fontSize={12} fontWeight={700}>{fmt(p.revenue)}</Typography>
                  </Box>
                ))}
                {data.revenue_by_placement.length > 5 && (
                  <Typography fontSize={10} color="text.secondary" sx={{ mt: 0.5 }}>+{data.revenue_by_placement.length - 5} more</Typography>
                )}
              </Box>

              {/* By SDK */}
              <Box>
                <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
                  {t('argus.revenue.bySdk', 'By SDK')}
                </Typography>
                {data.revenue_by_sdk.map((s) => (
                  <Box key={s.sdk} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.4 }}>
                    <Typography fontSize={12} fontWeight={600}>{s.sdk}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'baseline' }}>
                      <Typography fontSize={12} fontWeight={700}>{fmt(s.revenue)}</Typography>
                      <Typography fontSize={10} color="text.secondary">${s.ecpm.toFixed(1)}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>
        )}

        {/* ════════ 5. REVENUE HEALTH (Refund + Grants unified) ════════ */}
        {(data.refund_reasons.length > 0 || data.total_granted > 0) && (
          <Paper elevation={0} sx={{
            p: 2.5, borderRadius: 3, mb: 3,
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}>
            <Typography sx={sectionHeaderSx}>⚕ {t('argus.revenue.revenueHealth', 'Revenue Health')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: data.refund_reasons.length > 0 && data.total_granted > 0 ? '1fr 1fr' : '1fr' }, gap: 3 }}>
              {/* Refund Analysis */}
              {data.refund_reasons.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
                    <Typography fontSize={13} fontWeight={700}>↩ {t('argus.revenue.refundAnalysis', 'Refund Analysis')}</Typography>
                    <Chip size="small" label={`${data.refund_rate.toFixed(1)}%`}
                      sx={{
                        height: 18, fontSize: 10, fontWeight: 700,
                        bgcolor: alpha(data.refund_rate > 5 ? '#f44336' : '#ff9800', isDark ? 0.15 : 0.08),
                        color: data.refund_rate > 5 ? '#f44336' : '#ff9800', border: 'none',
                      }}
                    />
                  </Box>
                  {(() => {
                    const REFUND_LABELS: Record<string, string> = {
                      policy_refund: t('argus.revenue.refund_policy', 'Policy Refund'),
                      technical_issue: t('argus.revenue.refund_technical', 'Technical Issue'),
                      accidental_purchase: t('argus.revenue.refund_accidental', 'Accidental Purchase'),
                      changed_mind: t('argus.revenue.refund_changed_mind', 'Changed Mind'),
                      not_as_expected: t('argus.revenue.refund_not_expected', 'Not as Expected'),
                      duplicate_charge: t('argus.revenue.refund_duplicate', 'Duplicate Charge'),
                      fraud: t('argus.revenue.refund_fraud', 'Fraud'),
                    };
                    const listedSum = data.refund_reasons.reduce((s, rr) => s + rr.amount, 0);
                    const otherAmount = data.total_refunds - listedSum;
                    const rows = [...data.refund_reasons, ...(otherAmount > 0.01 ? [{ reason: '__other__', amount: otherAmount, count: 0 }] : [])];
                    return rows.map((rr) => {
                      const pct = data.total_refunds > 0 ? (rr.amount / data.total_refunds) * 100 : 0;
                      const label = rr.reason === '__other__' ? t('common.other', 'Other') : (REFUND_LABELS[rr.reason] || rr.reason.replace(/_/g, ' '));
                      return (
                        <Box key={rr.reason} sx={{ mb: 0.8 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                            <Typography fontSize={12} fontWeight={600} sx={{ textTransform: 'capitalize' }}>{label}</Typography>
                            <Typography fontSize={12} fontWeight={700}>{fmt(rr.amount)} <Box component="span" fontSize={10} color="text.secondary">({pct.toFixed(0)}%)</Box></Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={Math.min(pct, 100)}
                            sx={{ height: 4, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                              '& .MuiLinearProgress-bar': { bgcolor: '#f44336', borderRadius: 2 },
                            }}
                          />
                        </Box>
                      );
                    });
                  })()}
                </Box>
              )}

              {/* Grants */}
              {data.total_granted > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
                    <Typography fontSize={13} fontWeight={700}>🎁 {t('argus.revenue.grantSummary', 'Free Grants')}</Typography>
                    <Typography fontSize={12} fontWeight={800}>{fmt(data.total_granted)}</Typography>
                  </Box>
                  <Typography fontSize={11} color="text.secondary" sx={{ mb: 1 }}>
                    {data.grant_count.toLocaleString()} {t('argus.revenue.cases', 'cases')} · {data.grant_users.toLocaleString()} {t('argus.revenue.users', 'users')}
                  </Typography>
                  {data.grants_by_reason.map((gr) => {
                    const pct = data.total_granted > 0 ? (gr.total_granted / data.total_granted) * 100 : 0;
                    return (
                      <Box key={gr.reason} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.3 }}>
                        <Typography fontSize={12} fontWeight={600}>{gr.reason}</Typography>
                        <Chip size="small" label={`${fmt(gr.total_granted)} (${pct.toFixed(0)}%)`}
                          sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: alpha('#ff9800', isDark ? 0.12 : 0.06), color: '#ff9800', border: 'none' }} />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Paper>
        )}

        {/* ════════ 6. SEGMENT PERFORMANCE MATRIX ════════ */}
        {(data.revenue_by_country.length > 0 || data.revenue_by_platform.length > 0) && (() => {
          const countryMatrix = buildSegmentMatrix(
            data.revenue_by_country, data.prev_revenue_by_country || [], data.total_revenue, 'country', t as any
          );
          const platformMatrix = buildSegmentMatrix(
            data.revenue_by_platform, data.prev_revenue_by_platform || [], data.total_revenue, 'platform', t as any
          );
          const verdictColors: Record<string, string> = {
            invest: '#4caf50', maintain: '#2196f3', opportunity: '#ff9800', review: '#f44336',
          };
          const renderMatrix = (title: string, matrix: SegmentVerdict[]) => (
            <Paper elevation={0} sx={{
              borderRadius: 3, overflow: 'hidden',
              bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
              border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            }}>
              <Box sx={{ p: 2, pb: 1 }}>
                <Typography sx={sectionHeaderSx}>{title}</Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.segment', 'Segment')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.revenue', 'Revenue')}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.change', 'Change')}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.verdict', 'Verdict')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {matrix.map((seg) => (
                    <TableRow key={seg.name} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' } }}>
                      <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{seg.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>{fmt(seg.revenue)}</TableCell>
                      <TableCell align="right">
                        {seg.changePct >= 99.9 ? (
                          <Chip size="small" label="NEW"
                            sx={{ height: 20, fontSize: 10, fontWeight: 700,
                              bgcolor: alpha('#2196f3', isDark ? 0.15 : 0.08),
                              color: '#2196f3', border: 'none',
                            }} />
                        ) : (
                          <Chip size="small" label={`${seg.changePct >= 0 ? '+' : ''}${seg.changePct.toFixed(1)}%`}
                            sx={{ height: 20, fontSize: 10, fontWeight: 700,
                              bgcolor: alpha(seg.changePct >= 0 ? '#4caf50' : '#f44336', isDark ? 0.15 : 0.08),
                              color: seg.changePct >= 0 ? '#4caf50' : '#f44336', border: 'none',
                            }} />
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={`${seg.verdictIcon} ${seg.verdictLabel}`}
                          sx={{ height: 20, fontSize: 10, fontWeight: 700,
                            bgcolor: alpha(verdictColors[seg.verdict], isDark ? 0.12 : 0.06),
                            color: verdictColors[seg.verdict], border: 'none',
                          }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          );
          return (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
              {countryMatrix.length > 0 && renderMatrix(t('argus.revenue.countryPerformance', 'Country Performance'), countryMatrix)}
              {platformMatrix.length > 0 && renderMatrix(t('argus.revenue.platformPerformance', 'Platform Performance'), platformMatrix)}
            </Box>
          );
        })()}

        {/* ════════ 7. FUNNEL & COHORT (collapsible) ════════ */}
        {funnel && funnel.stages.length > 0 && (
          <Paper elevation={0} sx={{
            borderRadius: 3, overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            mb: 2,
          }}>
            <Box
              onClick={() => setFunnelOpen(!funnelOpen)}
              sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' } }}
            >
              <Box>
                <Typography sx={sectionHeaderSx}>{t('argus.revenue.purchaseFunnel', 'Purchase Funnel')}</Typography>
                {!funnelOpen && (
                  <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.3 }}>
                    {funnel.stages[0]?.label}: {funnel.stages[0]?.users.toLocaleString()} → {funnel.stages[funnel.stages.length - 1]?.label}: {funnel.stages[funnel.stages.length - 1]?.users.toLocaleString()} ({((funnel.stages[funnel.stages.length - 1]?.users / (funnel.stages[0]?.users || 1)) * 100).toFixed(1)}% {t('argus.revenue.conversion', 'conversion')})
                  </Typography>
                )}
              </Box>
              {funnelOpen ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
            </Box>
            <Collapse in={funnelOpen}>
              <Box sx={{ px: 2, pb: 2 }}>
                {funnel.stages.map((stage, i) => {
                  const maxUsers = funnel.stages[0]?.users || 1;
                  const prevUsers = i > 0 ? funnel.stages[i - 1].users : maxUsers;
                  const convRate = prevUsers > 0 ? ((stage.users / prevUsers) * 100) : 0;
                  const totalRate = maxUsers > 0 ? ((stage.users / maxUsers) * 100) : 0;
                  return (
                    <Box key={stage.name} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
                        <Typography fontSize={13} fontWeight={600}>{stage.label}</Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <Typography fontSize={13} fontWeight={700}>{stage.users.toLocaleString()}</Typography>
                          {i > 0 && (
                            <Typography fontSize={11} color="text.secondary">
                              {convRate.toFixed(1)}% {t('argus.revenue.fromPrev', 'from prev')}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ position: 'relative', height: 24, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5', overflow: 'hidden' }}>
                        <Box sx={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${totalRate}%`,
                          background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${alpha(CHART_COLORS[i % CHART_COLORS.length], 0.5)})`,
                          borderRadius: 2, transition: 'width 0.5s ease',
                        }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Collapse>
          </Paper>
        )}

        {cohort && cohort.cohorts.length > 0 && (
          <Paper elevation={0} sx={{
            borderRadius: 3, overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255,255,255,0.03)' : '#fff',
            border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            mb: 3,
          }}>
            <Box
              onClick={() => setCohortOpen(!cohortOpen)}
              sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' } }}
            >
              <Box>
                <Typography sx={sectionHeaderSx}>{t('argus.revenue.revenueCohort', 'Revenue Cohort Analysis')}</Typography>
                {!cohortOpen && (
                  <Typography fontSize={12} color="text.secondary" sx={{ mt: 0.3 }}>
                    {cohort.cohorts.length} {t('argus.revenue.cohorts', 'cohorts')} · {t('argus.revenue.clickToExpand', 'Click to expand')}
                  </Typography>
                )}
              </Box>
              {cohortOpen ? <ExpandLess sx={{ color: 'text.secondary' }} /> : <ExpandMore sx={{ color: 'text.secondary' }} />}
            </Box>
            <Collapse in={cohortOpen}>
              <Box sx={{ p: 2, pt: 0, overflow: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>{t('argus.revenue.cohortWeek', 'Week')}</TableCell>
                      {cohort.cohorts[0]?.data.map((d) => (
                        <TableCell key={d.day} align="center" sx={{ fontWeight: 700, fontSize: 11 }}>D{d.day}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      const allValues = cohort.cohorts.flatMap((c) => c.data.map((d) => d.cumulative_revenue));
                      const maxVal = Math.max(...allValues, 1);
                      return cohort.cohorts.map((c) => (
                        <TableRow key={c.cohort_week}>
                          <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: 12 }}>
                            {new Date(c.cohort_week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </TableCell>
                          {c.data.map((d) => {
                            const intensity = maxVal > 0 ? d.cumulative_revenue / maxVal : 0;
                            return (
                              <TableCell key={d.day} align="center" sx={{
                                bgcolor: intensity > 0 ? alpha('#4caf50', Math.min(intensity * 0.8 + 0.1, 0.9)) : 'transparent',
                                color: intensity > 0.4 ? '#fff' : 'text.primary',
                                fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
                              }}>
                                {d.cumulative_revenue > 0 ? fmt(d.cumulative_revenue) : '-'}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </Paper>
        )}

        {/* ════════ 8. SECTION NAVIGATION STRIPS ════════ */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[
            {
              id: 'products' as SectionId, color: '#2196f3', icon: '📦',
              title: t('argus.revenue.topProducts', 'Top Products'),
              detail: products[0] ? `#1 ${products[0].product_name} ${fmt(products[0].revenue)} · ${products.length} ${t('argus.revenue.items', 'items')}` : t('argus.revenue.clickToAnalyze', 'Click to analyze'),
            },
            {
              id: 'spenders' as SectionId, color: '#ff9800', icon: '🐋',
              title: t('argus.revenue.topSpenders', 'Top Spenders'),
              detail: spenders ? `${t('argus.revenue.top', 'Top')} 10% → ${spenders.segments.find(s => s.segment === 'top_10pct')?.percentage.toFixed(1) || '-'}%` : `${data.total_paying_users.toLocaleString()} ${t('argus.revenue.payersToAnalyze', 'payers to analyze')}`,
            },
            {
              id: 'economy' as SectionId, color: '#4caf50', icon: '⚖️',
              title: t('argus.revenue.economyHealth', 'Economy Health'),
              detail: economy ? `${economy.by_currency[0]?.currency_type || '-'}: ${t('argus.revenue.ratio', 'Ratio')} ${economy.by_currency[0] ? (economy.by_currency[0].sink > 0 ? (economy.by_currency[0].source / economy.by_currency[0].sink).toFixed(2) : '∞') : '-'}` : t('argus.revenue.clickToAnalyze', 'Click to analyze'),
            },
            {
              id: 'ltv' as SectionId, color: '#9c27b0', icon: '📈',
              title: t('argus.revenue.ltv', 'Lifetime Value'),
              detail: ltv ? `${t('argus.revenue.d30Label', 'D30')} ${fmt(ltv.ltv_curve.find(c => c.day === 30)?.cumulative_revenue || ltv.ltv_curve[ltv.ltv_curve.length - 1]?.cumulative_revenue || 0)}${ltv.pltv_predictions?.length ? ` · ${t('argus.revenue.pltvLabel', 'pLTV')} ${fmt(ltv.pltv_predictions[0]?.predicted_ltv || 0)}` : ''}` : t('argus.revenue.clickToAnalyze', 'Click to analyze'),
            },
          ].map((nav) => (
            <Paper key={nav.id} elevation={0} onClick={() => setSection(nav.id)} sx={{
              px: 2.5, py: 1.5, borderRadius: 2, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              bgcolor: isDark ? alpha(nav.color, 0.04) : alpha(nav.color, 0.02),
              border: '1px solid', borderColor: alpha(nav.color, isDark ? 0.12 : 0.06),
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: alpha(nav.color, isDark ? 0.08 : 0.05), transform: 'translateX(4px)' },
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography fontSize={16}>{nav.icon}</Typography>
                <Box>
                  <Typography fontSize={13} fontWeight={700}>{nav.title}</Typography>
                  <Typography fontSize={12} color="text.secondary">{nav.detail}</Typography>
                </Box>
              </Box>
              <DrillIcon sx={{ fontSize: 16, color: nav.color, opacity: 0.6 }} />
            </Paper>
          ))}
        </Box>
      </>
    );
  };

  // ─── Render Ledger ────────────────────────────────────────────────────────

  const renderLedger = () => {
    const isGrouped = txGroupBy !== 'none';
    const isDataMatchingMode = txData && (isGrouped ? txData.mode === 'grouped' : txData.mode === 'flat');
    const hasData = isDataMatchingMode && (isGrouped
      ? Array.isArray((txData as TransactionGroupedResponse).groups) && (txData as TransactionGroupedResponse).groups.length > 0
      : Array.isArray((txData as TransactionResponse).transactions) && (txData as TransactionResponse).transactions.length > 0);

    const eventTypeLabels: Record<string, { icon: string; label: string; color: string }> = {
      purchase: { icon: '🛒', label: t('argus.revenue.txPurchase', 'Purchase'), color: '#4caf50' },
      refund: { icon: '↩️', label: t('argus.revenue.txRefund', 'Refund'), color: '#f44336' },
      grant: { icon: '🎁', label: t('argus.revenue.txGrant', 'Grant'), color: '#ff9800' },
      ad_impression: { icon: '📺', label: t('argus.revenue.txAd', 'Ad'), color: '#2196f3' },
    };

    const txCsvColumns: CsvColumn<any>[] = isGrouped
      ? [
          { key: 'group_key', label: 'Group Key' },
          { key: 'count', label: 'Transaction Count' },
          { key: 'total_amount', label: 'Total Amount', formatter: (v) => `$${(Number(v) || 0).toFixed(2)}` },
          { key: 'avg_amount', label: 'Average Amount', formatter: (v) => `$${(Number(v) || 0).toFixed(2)}` },
          { key: 'unique_users', label: 'Unique Users' },
          { key: 'first_at', label: 'First At', formatter: (v) => v ? new Date(v).toLocaleString() : '' },
          { key: 'last_at', label: 'Last At', formatter: (v) => v ? new Date(v).toLocaleString() : '' },
        ]
      : [
          { key: 'event_type', label: 'Type' },
          { key: 'timestamp', label: 'Time', formatter: (v) => v ? new Date(v).toLocaleString() : '' },
          { key: 'user_id', label: 'User ID' },
          { key: 'product_name', label: 'Product' },
          { key: 'amount', label: 'Amount', formatter: (v) => `$${(Number(v) || 0).toFixed(2)}` },
          { key: 'reason', label: 'Reason' },
          { key: 'payment_method', label: 'Payment Method' },
        ];

    // Presets definitions
    const presets = [
      {
        label: t('argus.revenue.presetReset', 'Reset All'),
        icon: <CloseIcon sx={{ fontSize: 14 }} />,
        action: () => {
          setTxType('all');
          setTxSearch('');
          setTxMinAmount('');
          setTxMaxAmount('');
          setTxSelectedUserIds([]);
          setTxSelectedProducts([]);
          setTxSelectedReasons([]);
          setTxSelectedPaymentMethods([]);
          setTxGroupBy('none');
          setTxOffset(0);
        },
      },
      {
        label: t('argus.revenue.presetVip', 'VIP Purchases (≥$100)'),
        icon: '💎',
        action: () => {
          setTxType('purchase');
          setTxMinAmount(100);
          setTxMaxAmount('');
          setTxGroupBy('none');
          setTxOffset(0);
        },
      },
      {
        label: t('argus.revenue.presetRefunds', 'Refunds (Technical)'),
        icon: '↩️',
        action: () => {
          setTxType('refund');
          setTxMinAmount('');
          setTxMaxAmount('');
          setTxSelectedReasons(['technical_issue', 'policy_violation']);
          setTxGroupBy('none');
          setTxOffset(0);
        },
      },
      {
        label: t('argus.revenue.presetGrants', 'Recent High Grants'),
        icon: '🎁',
        action: () => {
          setTxType('grant');
          setTxMinAmount(50);
          setTxMaxAmount('');
          setTxGroupBy('none');
          setTxOffset(0);
        },
      },
    ];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Paper elevation={0} sx={{
          p: 3, borderRadius: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <LedgerIcon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {t('argus.revenue.transactionLedger', 'Transaction Ledger')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('argus.revenue.ledgerDesc', 'Audit and analyze individual transaction events')}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              {isDataMatchingMode && txData && (
                <Chip
                  variant="outlined" size="small"
                  label={
                    isGrouped
                      ? `${((txData as TransactionGroupedResponse).total_groups || 0).toLocaleString()} ${t('argus.revenue.groups', 'groups')}`
                      : `${((txData as TransactionResponse).total_count || 0).toLocaleString()} ${t('argus.revenue.txTotal', 'transactions')}`
                  }
                  sx={{ fontSize: 11, fontWeight: 700 }}
                />
              )}
              <Button
                size="small" variant="outlined" startIcon={<BookmarkIcon sx={{ fontSize: 16 }} />}
                onClick={() => setSavedQueriesOpen(true)}
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                {t('argus.discover.savedQueries', 'Saved Queries')}
              </Button>
              <Button
                size="small" variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                onClick={() => { setSaveDialogMode('new'); setSaveDialogOpen(true); }}
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                {t('common.save', 'Save')}
              </Button>
              <Button
                size="small" variant="outlined" startIcon={<ExportIcon sx={{ fontSize: 16 }} />}
                onClick={async () => {
                  if (!txData) return;
                  try {
                    const fullResult = await getRevenueTransactions(projectId, {
                      ...apiParams,
                      type: txType,
                      ...(txSearch ? { product: txSearch } : {}),
                      sort: txSort, order: txOrder,
                      group_by: txGroupBy,
                      ...(txMinAmount !== '' ? { min_amount: Number(txMinAmount) } : {}),
                      ...(txMaxAmount !== '' ? { max_amount: Number(txMaxAmount) } : {}),
                      ...(txSelectedUserIds.length > 0 ? { user_ids: txSelectedUserIds.join(',') } : {}),
                      ...(txSelectedProducts.length > 0 ? { products: txSelectedProducts.join(',') } : {}),
                      ...(txSelectedReasons.length > 0 ? { reasons: txSelectedReasons.join(',') } : {}),
                      ...(txSelectedPaymentMethods.length > 0 ? { payment_methods: txSelectedPaymentMethods.join(',') } : {}),
                      offset: 0, limit: 10000,
                    });
                    const rowsToExport = isGrouped
                      ? (fullResult as TransactionGroupedResponse).groups
                      : (fullResult as TransactionResponse).transactions;
                    downloadCsv(rowsToExport, txCsvColumns, `ledger_${txGroupBy}_${txType}_${new Date().toISOString().slice(0, 10)}`);
                  } catch {
                    const rowsToExport = isGrouped
                      ? ((txData as TransactionGroupedResponse).groups || [])
                      : ((txData as TransactionResponse).transactions || []);
                    downloadCsv(rowsToExport, txCsvColumns, `ledger_${txGroupBy}_${txType}_${new Date().toISOString().slice(0, 10)}`);
                  }
                }}
                disabled={!hasData}
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                📥 CSV
              </Button>
            </Box>
          </Box>

          {/* Quick Presets */}
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', mr: 1 }}>
              🎯 {t('argus.revenue.presets', 'Presets')}:
            </Typography>
            {presets.map((p, idx) => (
              <Chip
                key={idx}
                label={p.label}
                icon={typeof p.icon === 'string' ? undefined : p.icon}
                avatar={typeof p.icon === 'string' ? <Avatar sx={{ bgcolor: 'transparent', fontSize: 12 }}>{p.icon}</Avatar> : undefined}
                onClick={p.action}
                clickable
                variant="outlined"
                sx={{
                  fontSize: 11, fontWeight: 600, height: 26,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                  transition: 'all 0.2s',
                  '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }
                }}
              />
            ))}
          </Box>

          {/* Main Filter Bar */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <ToggleButtonGroup
                size="small" exclusive
                value={txType}
                onChange={(_, v) => { if (v) { setTxType(v); setTxOffset(0); } }}
                sx={{ '& .MuiToggleButton-root': { fontSize: 11, px: 2, py: 0.5, textTransform: 'none', fontWeight: 600 } }}
              >
                <ToggleButton value="all">{t('argus.revenue.txAll', 'All')}</ToggleButton>
                <ToggleButton value="purchase">🛒 {t('argus.revenue.txPurchase', 'Purchase')}</ToggleButton>
                <ToggleButton value="refund">↩️ {t('argus.revenue.txRefund', 'Refund')}</ToggleButton>
                <ToggleButton value="grant">🎁 {t('argus.revenue.txGrant', 'Grant')}</ToggleButton>
                <ToggleButton value="ad_impression">📺 {t('argus.revenue.txAd', 'Ad')}</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                size="small" placeholder={t('argus.revenue.txSearchPlaceholder', 'Search user or product...')}
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setTxOffset(0); loadTx(); } }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment>,
                  sx: { fontSize: 12, height: 32 },
                }}
                sx={{ width: 260 }}
              />
            </Box>
            <Box>
              <Button
                variant={txAdvancedOpen ? 'contained' : 'outlined'}
                size="small" startIcon={<FilterIcon />}
                onClick={() => setTxAdvancedOpen(!txAdvancedOpen)}
                sx={{ fontSize: 11, textTransform: 'none', fontWeight: 600, height: 32 }}
              >
                {txAdvancedOpen ? t('argus.revenue.hideFilters', 'Hide Filters') : t('argus.revenue.advancedFilters', 'Advanced Filters')}
              </Button>
            </Box>
          </Box>

          {/* Advanced Collapsible Filter Panel */}
          <Collapse in={txAdvancedOpen}>
            <Paper variant="outlined" sx={{ p: 2.5, mb: 3, mt: 2, borderRadius: 2, bgcolor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2.5 }}>
                {/* Product autocomplete filter */}
                <Autocomplete
                  multiple size="small"
                  options={facetProducts}
                  value={txSelectedProducts}
                  onChange={(_, val) => { setTxSelectedProducts(val); setTxOffset(0); }}
                  renderInput={(params) => <TextField {...params} label={t('argus.revenue.filterProducts', 'Filter Products')} />}
                  renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} />)}
                  sx={{ '& .MuiInputBase-root': { fontSize: 12 } }}
                />

                {/* Refund reason filter (visible for refunds or all) */}
                {(txType === 'all' || txType === 'refund') && (
                  <Autocomplete
                    multiple size="small"
                    options={facetReasons}
                    value={txSelectedReasons}
                    onChange={(_, val) => { setTxSelectedReasons(val); setTxOffset(0); }}
                    renderInput={(params) => <TextField {...params} label={t('argus.revenue.filterReasons', 'Refund Reasons')} />}
                    renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} />)}
                    sx={{ '& .MuiInputBase-root': { fontSize: 12 } }}
                  />
                )}

                {/* Payment method filter */}
                {(txType === 'all' || txType === 'purchase') && (
                  <Autocomplete
                    multiple size="small"
                    options={facetPaymentMethods}
                    value={txSelectedPaymentMethods}
                    onChange={(_, val) => { setTxSelectedPaymentMethods(val); setTxOffset(0); }}
                    renderInput={(params) => <TextField {...params} label={t('argus.revenue.filterPayment', 'Payment Methods')} />}
                    renderTags={(value, getTagProps) => value.map((option, index) => <Chip size="small" label={option} {...getTagProps({ index })} />)}
                    sx={{ '& .MuiInputBase-root': { fontSize: 12 } }}
                  />
                )}

                {/* Amount range filters */}
                <Box>
                  <Typography fontSize={11} fontWeight={600} color="text.secondary" gutterBottom>
                    💰 {t('argus.revenue.amountRange', 'Amount Range')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      size="small" type="number" placeholder="Min"
                      value={txMinAmount}
                      onChange={(e) => { setTxMinAmount(e.target.value === '' ? '' : Number(e.target.value)); setTxOffset(0); }}
                      inputProps={{ style: { fontSize: 11, padding: '6px 8px' } }}
                    />
                    <Typography fontSize={11} color="text.secondary">—</Typography>
                    <TextField
                      size="small" type="number" placeholder="Max"
                      value={txMaxAmount}
                      onChange={(e) => { setTxMaxAmount(e.target.value === '' ? '' : Number(e.target.value)); setTxOffset(0); }}
                      inputProps={{ style: { fontSize: 11, padding: '6px 8px' } }}
                    />
                  </Box>
                </Box>

                {/* User IDs multiple filter */}
                <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}>
                  <Typography fontSize={11} fontWeight={600} color="text.secondary" gutterBottom>
                    👤 {t('argus.revenue.filterUsers', 'Filter User IDs (comma-separated)')}
                  </Typography>
                  <TextField
                    fullWidth size="small" placeholder="user_123, user_456"
                    value={txSelectedUserIds.join(', ')}
                    onChange={(e) => {
                      const uids = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                      setTxSelectedUserIds(uids);
                      setTxOffset(0);
                    }}
                    inputProps={{ style: { fontSize: 11, padding: '6px 8px' } }}
                  />
                </Box>
              </Box>
            </Paper>
          </Collapse>

          {/* Group By selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, borderTop: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', pt: 2.5 }}>
            <Typography fontSize={12} fontWeight={700} color="text.secondary">
              🔍 {t('argus.revenue.groupBy', 'Group By')}:
            </Typography>
            <ToggleButtonGroup
              size="small" exclusive
              value={txGroupBy}
              onChange={(_, v) => { if (v) { setTxGroupBy(v); setTxOffset(0); } }}
              sx={{ '& .MuiToggleButton-root': { fontSize: 10, px: 1.5, py: 0.3, textTransform: 'none', fontWeight: 600 } }}
            >
              <ToggleButton value="none">{t('argus.revenue.groupNone', 'None')}</ToggleButton>
              <ToggleButton value="product">📦 {t('argus.revenue.groupProduct', 'Product')}</ToggleButton>
              <ToggleButton value="user">👤 {t('argus.revenue.groupUser', 'User')}</ToggleButton>
              <ToggleButton value="day">📅 {t('argus.revenue.groupDay', 'Day')}</ToggleButton>
              <ToggleButton value="hour">⏰ {t('argus.revenue.groupHour', 'Hour')}</ToggleButton>
              <ToggleButton value="reason">📋 {t('argus.revenue.groupReason', 'Reason')}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Summary widgets / aggregates */}
          {isDataMatchingMode && txData && (
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
              {txData.summary.purchase_count > 0 && (
                <Chip size="small" sx={{ fontSize: 11, bgcolor: alpha('#4caf50', 0.1), color: '#4caf50', fontWeight: 700, px: 0.5 }}
                  label={`🛒 ${t('argus.revenue.purchaseShort', 'Purchase')}: ${fmt(txData.summary.purchase_total)} (${txData.summary.purchase_count.toLocaleString()})`} />
              )}
              {txData.summary.refund_count > 0 && (
                <Chip size="small" sx={{ fontSize: 11, bgcolor: alpha('#f44336', 0.1), color: '#f44336', fontWeight: 700, px: 0.5 }}
                  label={`↩️ ${t('argus.revenue.refundShort', 'Refund')}: -${fmt(txData.summary.refund_total)} (${txData.summary.refund_count.toLocaleString()})`} />
              )}
              {txData.summary.grant_count > 0 && (
                <Chip size="small" sx={{ fontSize: 11, bgcolor: alpha('#ff9800', 0.1), color: '#ff9800', fontWeight: 700, px: 0.5 }}
                  label={`🎁 ${t('argus.revenue.grantShort', 'Grant')}: ${fmt(txData.summary.grant_total)} (${txData.summary.grant_count.toLocaleString()})`} />
              )}
              {txData.summary.ad_count > 0 && (
                <Chip size="small" sx={{ fontSize: 11, bgcolor: alpha('#2196f3', 0.1), color: '#2196f3', fontWeight: 700, px: 0.5 }}
                  label={`📺 ${t('argus.revenue.adShort', 'Ad')}: ${fmt(txData.summary.ad_total)} (${txData.summary.ad_count.toLocaleString()})`} />
              )}
            </Box>
          )}

          {/* Grouped mode: Top Groups visualization */}
          {isGrouped && hasData && (
            <Box sx={{ mb: 4 }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 2 }}>
                📊 {t('argus.revenue.topGroups', 'Top Groups by Total Revenue')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                {(txData as TransactionGroupedResponse).groups.slice(0, 6).map((group, idx) => {
                  const maxAmt = Math.max(...(txData as TransactionGroupedResponse).groups.map(g => g.total_amount), 1);
                  const percent = Math.min((group.total_amount / maxAmt) * 100, 100);
                  return (
                    <Box key={idx} sx={{ p: 1.5, borderRadius: 2, border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', bgcolor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography fontSize={12} fontWeight={700} noWrap sx={{ maxWidth: '60%' }}>
                          {group.group_key || '—'}
                        </Typography>
                        <Typography fontSize={12} fontWeight={800} color="primary.main">
                          {fmt(group.total_amount)}
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={percent} sx={{ height: 6, borderRadius: 3, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                        <Typography fontSize={10} color="text.secondary">
                          {group.count.toLocaleString()} {t('argus.revenue.events', 'events')}
                        </Typography>
                        <Typography fontSize={10} color="text.secondary">
                          {group.unique_users.toLocaleString()} {t('argus.revenue.users', 'users')}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Loading */}
          {txLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

          {/* Ledger Content: Flat Table vs Grouped Table */}
          {hasData ? (
            <Box sx={{ overflowX: 'auto' }}>
              {!isGrouped ? (
                // ─── FLAT MODE TABLE ───
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11, width: 50 }}>{t('argus.revenue.txType', 'Type')}</TableCell>
                      <TableCell
                        sx={{ fontWeight: 700, fontSize: 11, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => { const newOrder = txSort === 'timestamp' && txOrder === 'desc' ? 'asc' : 'desc'; setTxSort('timestamp'); setTxOrder(newOrder as any); }}
                      >
                        {t('argus.revenue.txTime', 'Time')} {txSort === 'timestamp' ? (txOrder === 'desc' ? '▼' : '▲') : ''}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.txUser', 'User')}</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.txProduct', 'Product')}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, fontSize: 11, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => { const newOrder = txSort === 'amount' && txOrder === 'desc' ? 'asc' : 'desc'; setTxSort('amount'); setTxOrder(newOrder as any); }}
                      >
                        {t('argus.revenue.txAmount', 'Amount')} {txSort === 'amount' ? (txOrder === 'desc' ? '▼' : '▲') : ''}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.txReason', 'Details')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(txData as TransactionResponse).transactions.map((tx, idx) => {
                      const meta = eventTypeLabels[tx.event_type] || { icon: '❓', label: tx.event_type, color: '#999' };
                      return (
                        <TableRow key={`${tx.event_id}-${idx}`} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' } }}>
                          <TableCell>
                            <Chip size="small" label={`${meta.icon} ${meta.label}`}
                              sx={{ fontSize: 10, fontWeight: 700, height: 20, bgcolor: alpha(meta.color, isDark ? 0.15 : 0.08), color: meta.color, border: 'none' }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            {new Date(tx.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell>
                            {tx.user_id ? (
                              <Typography
                                component="span"
                                onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(tx.user_id)}`)}
                                sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              >
                                {tx.user_id.slice(0, 16)}{tx.user_id.length > 16 ? '…' : ''}
                              </Typography>
                            ) : <Typography fontSize={12} color="text.secondary">—</Typography>}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{tx.product_name || (tx.ad_type ? tx.ad_type.replace(/_/g, ' ') : '—')}</TableCell>
                          <TableCell align="right" sx={{
                            fontSize: 12, fontWeight: 700,
                            color: tx.event_type === 'refund' ? '#f44336' : tx.event_type === 'grant' ? '#ff9800' : 'text.primary',
                          }}>
                            {tx.event_type === 'refund' ? '-' : ''}{fmt(tx.amount)}
                          </TableCell>
                          <TableCell sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'capitalize' }}>
                            {tx.reason ? tx.reason.replace(/_/g, ' ') : (tx.payment_method ? tx.payment_method.replace(/_/g, ' ') : '—')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                // ─── GROUPED MODE TABLE ───
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.groupKey', 'Group Key')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.groupCount', 'Count')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.groupTotal', 'Total Amount')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.groupAvg', 'Average Amount')}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.groupUniqueUsers', 'Unique Users')}</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.groupRange', 'Activity Range')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(txData as TransactionGroupedResponse).groups.map((group, idx) => (
                      <TableRow key={idx} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' } }}>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>
                          {txGroupBy === 'user' ? (
                            <Typography
                              component="span"
                              onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(group.group_key)}`)}
                              sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {group.group_key || '—'}
                            </Typography>
                          ) : (
                            group.group_key || '—'
                          )}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{group.count.toLocaleString()}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 800, color: 'primary.main' }}>{fmt(group.total_amount)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{fmt(group.avg_amount)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{group.unique_users.toLocaleString()}</TableCell>
                        <TableCell sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                          {group.first_at ? new Date(group.first_at).toLocaleDateString() : ''}
                          {group.last_at && group.last_at !== group.first_at ? ` ~ ${new Date(group.last_at).toLocaleDateString()}` : ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          ) : (
            !txLoading && (
              <Typography fontSize={12} color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
                {t('argus.revenue.txEmpty', 'No transactions found for the selected filters.')}
              </Typography>
            )
          )}

          {/* Pagination */}
          {isDataMatchingMode && txData && (isGrouped ? (txData as TransactionGroupedResponse).total_groups || 0 : (txData as TransactionResponse).total_count || 0) > txLimit && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, pt: 2, borderTop: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
              <Typography fontSize={11} color="text.secondary">
                {txOffset + 1}–{Math.min(txOffset + txLimit, isGrouped ? (txData as TransactionGroupedResponse).total_groups || 0 : (txData as TransactionResponse).total_count || 0)} / {(isGrouped ? (txData as TransactionGroupedResponse).total_groups || 0 : (txData as TransactionResponse).total_count || 0).toLocaleString()}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" disabled={txOffset === 0} onClick={() => setTxOffset(Math.max(0, txOffset - txLimit))}
                  sx={{ fontSize: 11, textTransform: 'none', minWidth: 'auto', px: 2 }}>
                  ← {t('argus.revenue.txPrev', 'Prev')}
                </Button>
                <Button size="small" variant="outlined" disabled={isGrouped ? ((txData as TransactionGroupedResponse).groups || []).length < txLimit : !(txData as TransactionResponse).has_more} onClick={() => setTxOffset(txOffset + txLimit)}
                  sx={{ fontSize: 11, textTransform: 'none', minWidth: 'auto', px: 2 }}>
                  {t('argus.revenue.txNext', 'Next')} →
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    );
  };

  // ─── Render Discover ──────────────────────────────────────────────────────

  const renderDiscover = () => {
    const dslEditorRef = React.createRef<QueryAQLEditorHandle>();

    const handleSearchClick = () => {
      setDiscOffset(0);
      runDiscoverQuery(0);
    };

    const toggleGroupBy = (col: string) => {
      setDiscGroupBy((prev) =>
        prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
      );
    };

    // Columns that can be grouped in ClickHouse discover query
    const groupableColumns = [
      'event_name',
      'user_id',
      'properties.product_name',
      'properties.reason',
      'properties.payment_method',
      'country',
      'platform',
    ];

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Paper elevation={0} sx={{
          p: 3, borderRadius: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <DiscoverIcon sx={{ color: 'primary.main', fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {t('argus.revenue.sectionDiscover', 'Revenue Discover')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('argus.revenue.discoverDesc', 'Write AQL queries, slice and aggregate revenue dataset freely')}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small" variant="outlined" startIcon={<BookmarkIcon sx={{ fontSize: 16 }} />}
                onClick={() => setSavedQueriesOpen(true)}
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                {t('argus.discover.savedQueries', 'Saved Queries')}
              </Button>
              <Button
                size="small" variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                onClick={() => { setSaveDialogMode('new'); setSaveDialogOpen(true); }}
                sx={{ textTransform: 'none', fontSize: 12 }}
              >
                {t('common.save', 'Save')}
              </Button>
            </Box>
          </Box>

          {/* AQL Query Editor Bar */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 280 }}>
              <GroupBySelector
                groupBy={discGroupBy}
                columns={groupableColumns}
                onToggle={toggleGroupBy}
                isDark={isDark}
              />
              <Box sx={{ flex: 1 }}>
                <QueryAQLEditor
                  ref={dslEditorRef}
                  config={DISCOVER_CONFIG}
                  initialQuery={discQuery}
                  onSearch={handleSearchSubmit}
                  onChange={handleSearchChange}
                  fetchFieldValues={fetchFieldValues}
                  placeholder={t('argus.discover.searchPlaceholder', 'event_name:purchase product_name:"Gem Pack"...')}
                />
              </Box>
            </Box>

            {/* Y-Axis Selector */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography fontSize={11} fontWeight={700} color="text.secondary">Y-Axis:</Typography>
              <Select
                size="small"
                value={discYAxis}
                onChange={(e) => setDiscYAxis(e.target.value)}
                sx={{ fontSize: 12, height: 32, minWidth: 140 }}
              >
                <MenuItem value="count()">count()</MenuItem>
                <MenuItem value="sum(amount)">sum(amount)</MenuItem>
                <MenuItem value="avg(amount)">avg(amount)</MenuItem>
                <MenuItem value="uniq(user_id)">count_unique(user_id)</MenuItem>
              </Select>
            </Box>

            <Button
              variant="contained" size="small" onClick={handleSearchClick} disabled={discLoading}
              sx={{ height: 32, px: 3, textTransform: 'none', fontWeight: 700 }}
            >
              {discLoading ? <CircularProgress size={16} color="inherit" /> : t('argus.discover.runQuery', 'Run Query')}
            </Button>
          </Box>

          {discError && (
            <Paper variant="outlined" sx={{ p: 2, mb: 3, borderColor: '#f44336', bgcolor: alpha('#f44336', 0.05), borderRadius: 2 }}>
              <Typography color="#f44336" fontSize={12} fontWeight={600}>
                ❌ Query Error: {discError}
              </Typography>
            </Paper>
          )}

          {/* Volume Time Series Chart */}
          {discHasQueried && discVolume.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <VolumeChart
                data={discVolume}
                isDark={isDark}
                period={dateRange.type === 'preset' ? dateRange.preset : '30d'}
                loading={discLoading}
                onZoom={(start, end) => setDateRange({ type: 'custom', start: new Date(start), end: new Date(end) })}
              />
            </Box>
          )}

          {/* Results Table */}
          {discHasQueried && !discLoading && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography fontSize={11} fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  📋 {t('argus.discover.resultsTable', 'Query Results')}
                </Typography>
                {discResults.length > 0 && (
                  <Button
                    size="small" variant="outlined" startIcon={<ExportIcon sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      const csvCols = discResultsMeta.map(f => ({
                        key: f.name,
                        label: f.name,
                      }));
                      downloadCsv(discResults, csvCols, `discover_${new Date().toISOString().slice(0, 10)}`);
                    }}
                    sx={{ fontSize: 11, textTransform: 'none' }}
                  >
                    📥 CSV
                  </Button>
                )}
              </Box>

              {discResults.length > 0 ? (
                <Box sx={{ overflowX: 'auto', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {discResultsMeta.map((meta, i) => (
                          <TableCell key={i} sx={{ fontWeight: 700, fontSize: 11 }}>
                            {meta.name}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {discResults.map((row, rowIdx) => (
                        <TableRow key={rowIdx} sx={{ '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' } }}>
                          {discResultsMeta.map((meta, colIdx) => {
                            const val = row[meta.name];
                            return (
                              <TableCell key={colIdx} sx={{ fontSize: 12 }}>
                                {meta.name === 'user_id' && val ? (
                                  <Typography
                                    component="span"
                                    onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(val)}`)}
                                    sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                                  >
                                    {val.slice(0, 16)}{val.length > 16 ? '…' : ''}
                                  </Typography>
                                ) : meta.name === 'timestamp' && val ? (
                                  new Date(val).toLocaleString()
                                ) : typeof val === 'number' && meta.name.includes('amount') ? (
                                  fmt(val)
                                ) : (
                                  String(val ?? '—')
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Typography fontSize={12} color="text.secondary" sx={{ textAlign: 'center', py: 6 }}>
                  {t('argus.discover.noResults', 'No records match the query conditions.')}
                </Typography>
              )}

              {/* Pagination */}
              {discResults.length >= discLimit && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
                  <Button
                    size="small" variant="outlined" disabled={discOffset === 0}
                    onClick={() => { const o = Math.max(0, discOffset - discLimit); setDiscOffset(o); runDiscoverQuery(o); }}
                    sx={{ fontSize: 11, textTransform: 'none' }}
                  >
                    ← {t('argus.discover.prev', 'Prev')}
                  </Button>
                  <Button
                    size="small" variant="outlined" disabled={discResults.length < discLimit}
                    onClick={() => { const o = discOffset + discLimit; setDiscOffset(o); runDiscoverQuery(o); }}
                    sx={{ fontSize: 11, textTransform: 'none' }}
                  >
                    {t('argus.discover.next', 'Next')} →
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Box>
    );
  };

  // ─── Render Products ──────────────────────────────────────────────────────

  const renderProducts = () => {
    if (products.length === 0) return <EmptyPagePlaceholder icon={<ProductIcon sx={{ fontSize: 48 }} />} message={t('argus.revenue.noProducts', 'No product data')} subtitle={t('argus.revenue.noProductsDesc', 'No product_name property found in purchase events')} />;

    const filtered = productSearch
      ? products.filter((p) => p.product_name.toLowerCase().includes(productSearch.toLowerCase()) || p.product_id.toLowerCase().includes(productSearch.toLowerCase()))
      : products;

    // Build trend chart datasets from productTrend (top 5)
    const hasTrend = productTrend.length > 0 && productTrend[0].trend.length > 0;
    const trendLabels = hasTrend
      ? productTrend[0].trend.map((d) => new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))
      : [];
    const trendRawPeriods = hasTrend ? productTrend[0].trend.map((d) => d.period) : [];
    const trendDatasets = hasTrend
      ? productTrend.map((pt, i) => ({
          label: pt.product_name,
          data: pt.trend.map((d) => d.revenue),
          color: CHART_COLORS[i % CHART_COLORS.length],
        }))
      : [];

    return (
      <>
        {/* Top 5 Product Trend Chart */}
        {hasTrend && (
          <ArgusVolumeChart
            title={t('argus.revenue.productTrend', 'Top 5 Product Revenue Trend')}
            labels={trendLabels}
            datasets={trendDatasets}
            loading={loading}
            storagePrefix="argus_product_trend"
            showCompactToggle={false}
            mb={3}
            onZoom={handleChartZoom(trendRawPeriods)}
          />
        )}

        {/* Product Table */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
          <Box sx={{ p: 1.5, pl: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              size="small"
              placeholder={t('argus.revenue.searchProducts', 'Search products...')}
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
              size="small" variant="outlined"
              onClick={() => downloadCsv(filtered, [
                { key: 'product_name', label: 'Product' },
                { key: 'product_id', label: 'Product ID' },
                { key: 'revenue', label: 'Revenue', formatter: (v: any) => `$${(Number(v) || 0).toFixed(2)}` },
                { key: 'percentage', label: 'Share %', formatter: (v: any) => `${(Number(v) || 0).toFixed(1)}%` },
                { key: 'transactions', label: 'Transactions' },
                { key: 'buyers', label: 'Buyers' },
                { key: 'refund_rate', label: 'Refund Rate %', formatter: (v: any) => `${(Number(v) || 0).toFixed(1)}%` },
              ], `products_${new Date().toISOString().slice(0, 10)}`)}
              sx={{ fontSize: 11, textTransform: 'none', minWidth: 'auto', px: 1.5 }}
            >
              📥 CSV
            </Button>
          </Box>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.revenue.productName', 'Product')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.totalRevenue', 'Revenue')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.share', 'Share')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.transactions', 'Transactions')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.buyers', 'Buyers')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.refundRate', 'Refund Rate')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((p, i) => (
                <TableRow key={p.product_name} hover sx={{ cursor: 'pointer' }} onClick={() => openProductDetail(p)}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={13}>{p.product_name}</Typography>
                    {p.product_id && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace', fontSize: 11 }}>{p.product_id}</Typography>}
                  </TableCell>
                  <TableCell align="right"><Typography fontWeight={600} fontSize={13}>{fmt(p.revenue)}</Typography></TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      <LinearProgress variant="determinate" value={p.percentage} sx={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3 }} />
                      <Typography fontSize={12} color="text.secondary">{p.percentage.toFixed(1)}%</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{p.transactions.toLocaleString()}</TableCell>
                  <TableCell align="right">{p.buyers.toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Typography fontSize={12} color={p.refund_rate > 10 ? '#f44336' : p.refund_rate > 5 ? '#ff9800' : 'text.secondary'}>
                        {p.refund_rate > 0 ? `${p.refund_rate.toFixed(1)}%` : '—'}
                      </Typography>
                      {p.refund_rate > 10 && (
                        <Chip size="small" label="⚠" sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: alpha('#f44336', isDark ? 0.15 : 0.08), color: '#f44336', border: 'none', minWidth: 0, px: 0.5 }} />
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* Product Detail Drawer */}

        {/* Category Breakdown */}
        {categoryBreakdown.length > 1 && (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', mt: 3 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>{t('argus.revenue.categoryBreakdown', 'Revenue by Category')}</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{t('argus.revenue.category', 'Category')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.totalRevenue', 'Revenue')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.transactions', 'Transactions')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">%</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const totalCatRevenue = categoryBreakdown.reduce((s, c) => s + c.revenue, 0);
                  return categoryBreakdown.map((c) => (
                    <TableRow key={c.category} hover>
                      <TableCell><Chip label={c.category} size="small" sx={{ fontWeight: 600 }} /></TableCell>
                      <TableCell align="right"><Typography fontSize={13} fontWeight={600}>{fmt(c.revenue)}</Typography></TableCell>
                      <TableCell align="right">{c.transactions.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <LinearProgress variant="determinate" value={totalCatRevenue > 0 ? Math.min((c.revenue / totalCatRevenue) * 100, 100) : 0}
                            sx={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3 }} />
                          <Typography fontSize={12} color="text.secondary">{totalCatRevenue > 0 ? ((c.revenue / totalCatRevenue) * 100).toFixed(1) : '0'}%</Typography>
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
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff', mt: 3 }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>{t('argus.revenue.firstPurchaseProducts', 'First Purchase Products')}</Typography>
              <Typography variant="caption" color="text.secondary">{t('argus.revenue.firstPurchaseDesc', 'Products that drive first-time conversions')}</Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t('argus.revenue.productName', 'Product')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.firstPurchaseCount', 'First Purchases')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">%</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  const totalFirst = firstPurchaseProducts.reduce((s, p) => s + p.first_purchase_count, 0);
                  return firstPurchaseProducts.map((p, i) => (
                    <TableRow key={p.product_name} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell><Typography fontWeight={600} fontSize={13}>{p.product_name}</Typography></TableCell>
                      <TableCell align="right">{p.first_purchase_count.toLocaleString()}</TableCell>
                      <TableCell align="right">
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                          <LinearProgress variant="determinate" value={totalFirst > 0 ? Math.min((p.first_purchase_count / totalFirst) * 100, 100) : 0}
                            sx={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { bgcolor: '#4caf50' } }} />
                          <Typography fontSize={12} color="text.secondary">{totalFirst > 0 ? ((p.first_purchase_count / totalFirst) * 100).toFixed(1) : '0'}%</Typography>
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
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', flex: 1 }}>
              <Skeleton variant="rounded" height={24} width={200} />
              <ArgusChartSkeleton height={220} />
              <Skeleton variant="rounded" height={200} />
            </Box>
          ) : productDetail ? (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 3, overflow: 'auto', flex: 1 }}>
              {/* Summary KPIs */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                  <Typography variant="caption" color="text.secondary">{t('argus.revenue.totalRevenue', 'Revenue')}</Typography>
                  <Typography variant="h6" fontWeight={700}>{fmt(productDetail.summary.total_revenue)}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                  <Typography variant="caption" color="text.secondary">{t('argus.revenue.transactions', 'Transactions')}</Typography>
                  <Typography variant="h6" fontWeight={700}>{productDetail.summary.total_transactions.toLocaleString()}</Typography>
                </Paper>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, flex: 1, textAlign: 'center', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                  <Typography variant="caption" color="text.secondary">{t('argus.revenue.buyers', 'Buyers')}</Typography>
                  <Typography variant="h6" fontWeight={700}>{productDetail.buyers.length.toLocaleString()}{productDetail.has_more ? '+' : ''}</Typography>
                </Paper>
              </Box>

              {/* Volume chart */}
              {productDetail.trend.length > 0 && (
                <ArgusVolumeChart
                  title={t('argus.revenue.dailyTrend', 'Daily Revenue Trend')}
                  labels={productDetail.trend.map((d) => new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}
                  datasets={[
                    { label: t('argus.revenue.totalRevenue', 'Revenue'), data: productDetail.trend.map((d) => d.revenue), color: '#4caf50' },
                    { label: t('argus.revenue.transactions', 'Transactions'), data: productDetail.trend.map((d) => d.transactions), color: theme.palette.primary.main },
                  ]}
                  loading={false}
                  storagePrefix="argus_product_detail_trend"
                  showCompactToggle={false}
                  mb={0}
                  onZoom={handleChartZoom(productDetail.trend.map((d) => d.period))}
                />
              )}

              {/* Buyer list */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>{t('argus.revenue.buyerList', 'Buyers')}</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>{t('argus.revenue.userId', 'User ID')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.totalSpent', 'Total Spent')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.purchaseCount', 'Purchases')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.lastPurchase', 'Last Purchase')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {productDetail.buyers.map((b) => (
                      <TableRow key={b.user_id} hover>
                        <TableCell>
                          <Box
                            onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(b.user_id)}`)}
                            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                          >
                            <Avatar src={b.avatar_url || undefined} sx={{ width: 28, height: 28, fontSize: 12, bgcolor: stringToColor(b.user_id) }}>
                              {getInitials(b.user_id)}
                            </Avatar>
                            <Typography fontSize={13} fontWeight={600} color="primary" sx={{ fontFamily: 'monospace' }}>{b.user_id}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="right">{fmt(b.total_spent)}</TableCell>
                        <TableCell align="right">{b.purchase_count}</TableCell>
                        <TableCell align="right"><Typography fontSize={12} color="text.secondary">{new Date(b.last_purchase).toLocaleDateString()}</Typography></TableCell>
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
                      startIcon={loadingMoreBuyers ? <CircularProgress size={16} /> : undefined}
                    >
                      {loadingMoreBuyers ? t('common.loading', 'Loading...') : t('argus.revenue.loadMore', 'Load More')}
                    </Button>
                  </Box>
                )}
              </Box>

              {/* Hourly Heatmap */}
              {selectedProduct && (() => {
                const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                const maxRevenue = Math.max(...heatmapData.map(h => h.revenue), 1);

                return (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      🕐 {t('argus.revenue.hourlyHeatmap', 'Sales by Time of Day')}
                    </Typography>
                    {heatmapLoading ? (
                      <Skeleton variant="rounded" height={180} />
                    ) : heatmapData.length > 0 ? (
                      <Box sx={{ overflowX: 'auto' }}>
                        {/* Hour labels */}
                        <Box sx={{ display: 'flex', gap: '2px', mb: '2px', pl: '40px' }}>
                          {Array.from({ length: 24 }, (_, h) => (
                            <Box key={h} sx={{ width: 22, textAlign: 'center', fontSize: 9, color: 'text.secondary' }}>
                              {h}
                            </Box>
                          ))}
                        </Box>
                        {/* Grid rows */}
                        {dayLabels.map((day, di) => (
                          <Box key={di} sx={{ display: 'flex', gap: '2px', mb: '2px', alignItems: 'center' }}>
                            <Typography sx={{ width: 36, fontSize: 10, color: 'text.secondary', textAlign: 'right', mr: '4px' }}>{day}</Typography>
                            {Array.from({ length: 24 }, (_, h) => {
                              const cell = heatmapData.find(c => c.day_of_week === (di + 1) && c.hour === h);
                              const intensity = cell ? cell.revenue / maxRevenue : 0;
                              return (
                                <Tooltip key={h} title={cell ? `${fmt(cell.revenue)} (${cell.count} txn)` : '-'} arrow>
                                  <Box sx={{
                                    width: 22, height: 22, borderRadius: '3px',
                                    bgcolor: intensity > 0 ? alpha('#4caf50', Math.min(intensity * 0.85 + 0.15, 1)) : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'),
                                    cursor: 'default',
                                    transition: 'transform 0.1s',
                                    '&:hover': { transform: 'scale(1.3)', zIndex: 1 },
                                  }} />
                                </Tooltip>
                              );
                            })}
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography fontSize={12} color="text.secondary">{t('argus.revenue.noHeatmapData', 'No hourly data available')}</Typography>
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

  // ─── Render Economy ───────────────────────────────────────────────────────

  const renderEconomy = () => {
    if (!economy || (economy.by_currency.length === 0 && economy.flow_over_time.length === 0)) {
      return <EmptyPagePlaceholder icon={<EconomyIcon sx={{ fontSize: 48 }} />} message={t('argus.revenue.noEconomy', 'No economy data')} subtitle={t('argus.revenue.noEconomyDesc', 'No resource_source / resource_sink events found')} />;
    }

    const selectedCurrencyData = economy.by_currency.find(c => c.currency_type === economyCurrency) || economy.by_currency[0];
    const currentSource = selectedCurrencyData ? selectedCurrencyData.source : 0;
    const currentSink = selectedCurrencyData ? selectedCurrencyData.sink : 0;
    const currentRatio = currentSink > 0 ? currentSource / currentSink : 0;
    const currentNetFlow = currentSource - currentSink;

    // Currency type options for filter
    const currencyOptions = economy.by_currency.map((c) => c.currency_type);
    const filteredTopSinks = economy.top_sinks.filter(s => s.currency_type === economyCurrency);

    return (
      <>
        {/* Currency Type Filter & Title */}
        {currencyOptions.length > 1 && (
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight={700}>
              {t('argus.revenue.economyDashboard', 'Economy Dashboard')}
            </Typography>
            <ToggleButtonGroup
              value={economyCurrency}
              exclusive
              onChange={(_, v) => v && setEconomyCurrency(v)}
              size="small"
            >
              {currencyOptions.map((ct) => (
                <ToggleButton key={ct} value={ct} sx={{ px: 2, fontWeight: 700, textTransform: 'uppercase' }}>
                  {ct}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' }, gap: 3 }}>
          {/* Left Column: Summary Metrics, Balance Gauge, and Currency Summary Table */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Balance Status Gauge */}
            <BalanceGauge ratio={currentRatio} />

            {/* Summary KPIs */}
            <KpiCard
              icon={<TrendingIcon />}
              label={`${t('argus.revenue.totalSource', 'Total Source')} (${economyCurrency.toUpperCase()})`}
              value={fmtNum(currentSource)}
              color="#4caf50"
            />
            <KpiCard
              icon={<TrendingDownIcon />}
              label={`${t('argus.revenue.totalSink', 'Total Sink')} (${economyCurrency.toUpperCase()})`}
              value={fmtNum(currentSink)}
              color="#f44336"
            />
            <KpiCard
              icon={<EconomyIcon />}
              label={`${t('argus.revenue.netFlow', 'Net Flow')} (${economyCurrency.toUpperCase()})`}
              value={(currentNetFlow >= 0 ? '+' : '') + fmtNum(currentNetFlow)}
              color={currentNetFlow >= 0 ? '#ff9800' : '#4caf50'}
              sub={currentNetFlow > 0 ? t('argus.revenue.inflationRisk', '⚠ Inflation risk') : t('argus.revenue.healthy', 'Healthy')}
            />

            {/* Currency Summary Table */}
            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700}>{t('argus.revenue.byCurrency', 'Currency Summary')}</Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>{t('argus.revenue.currencyType', 'Currency')}</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">{t('argus.revenue.netFlow', 'Net Flow')}</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11 }} align="right">{t('argus.revenue.sourceSinkRatio', 'Ratio')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {economy.by_currency.map((c) => {
                    const r = c.sink > 0 ? c.source / c.sink : 0;
                    const isSelected = c.currency_type === economyCurrency;
                    return (
                      <TableRow
                        key={c.currency_type}
                        hover
                        selected={isSelected}
                        onClick={() => setEconomyCurrency(c.currency_type)}
                        sx={{ cursor: 'pointer', '&.Mui-selected': { bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' } }}
                      >
                        <TableCell sx={{ py: 1.5 }}>
                          <Chip
                            label={c.currency_type.toUpperCase()}
                            size="small"
                            sx={{ fontWeight: 800, fontSize: 10, cursor: 'pointer' }}
                            color={isSelected ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography fontSize={12} fontWeight={600} color={c.net_flow >= 0 ? '#ff9800' : '#4caf50'}>
                            {c.net_flow >= 0 ? '+' : ''}{fmtNum(c.net_flow)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography fontSize={12} fontWeight={600} color={r > 1.2 ? '#f44336' : r < 0.8 ? '#ff9800' : '#4caf50'}>
                            {r.toFixed(2)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Paper>
          </Box>

          {/* Right Column: Time-series Charts & Top spending item Table */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Flow chart */}
            <ArgusVolumeChart
              title={`${t('argus.revenue.dailyFlow', 'Daily Flow')} - ${economyCurrency.toUpperCase()}`}
              labels={economy.flow_over_time.map((d) =>
                new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              )}
              datasets={[
                { label: t('argus.revenue.source', 'Source'), data: economy.flow_over_time.map((d) => d.source), color: '#4caf50' },
                { label: t('argus.revenue.sink', 'Sink'), data: economy.flow_over_time.map((d) => d.sink), color: '#f44336' },
              ]}
              loading={loading}
              storagePrefix="argus_economy_flow"
              showCompactToggle={false}
              onZoom={handleChartZoom(economy.flow_over_time.map((d) => d.period))}
            />

            {/* Source/Sink Ratio Trend — inflation tracking */}
            {economy.ratio_trend && economy.ratio_trend.length > 0 && (
              <ArgusVolumeChart
                title={`${t('argus.revenue.ratioTrend', 'Ratio Trend')} - ${economyCurrency.toUpperCase()}`}
                labels={economy.ratio_trend.map((d) =>
                  new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                )}
                datasets={[
                  { label: t('argus.revenue.sourceSinkRatio', 'Ratio'), data: economy.ratio_trend.map((d) => d.ratio), color: '#ff9800' },
                ]}
                loading={loading}
                storagePrefix="argus_economy_ratio"
                showCompactToggle={false}
                onZoom={handleChartZoom(economy.ratio_trend.map((d) => d.period))}
              />
            )}

            {/* Top sinks table */}
            {filteredTopSinks.length > 0 && (
              <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {t('argus.revenue.topSinks', 'Top Spending Items')} ({economyCurrency.toUpperCase()})
                  </Typography>
                </Box>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{t('argus.revenue.itemName', 'Item')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.totalSpent', 'Total Spent')}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.transactions', 'Transactions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTopSinks.map((s, i) => (
                      <TableRow key={`${s.item_name}-${s.currency_type}`} hover>
                        <TableCell sx={{ py: 1.5 }}>{i + 1}</TableCell>
                        <TableCell sx={{ py: 1.5 }}>
                          <Typography fontWeight={600} fontSize={13}>{s.item_name}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>
                          <Typography fontWeight={600} fontSize={13} color="text.primary">{fmtNum(s.total_spent)}</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ py: 1.5 }}>{s.transaction_count.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </Box>
        </Box>
      </>
    );
  };

  // ─── Render Spenders ──────────────────────────────────────────────────────

  const renderSpenders = () => {
    if (!spenders || spenders.total_spenders === 0) {
      return <EmptyPagePlaceholder icon={<DiamondIcon sx={{ fontSize: 48 }} />} message={t('argus.revenue.noSpenders', 'No spender data')} subtitle={t('argus.revenue.noSpendersDesc', 'No purchase events found')} />;
    }

    const segmentLabels: Record<string, string> = {
      top_1_pct: t('argus.revenue.top1Pct', 'Top 1% (Whales)'),
      top_10_pct: t('argus.revenue.top10Pct', 'Top 10%'),
      bottom_90_pct: t('argus.revenue.bottom90Pct', 'Bottom 90%'),
    };
    const segmentColors: Record<string, string> = {
      top_1_pct: '#f44336',
      top_10_pct: '#ff9800',
      bottom_90_pct: '#4caf50',
    };

    return (
      <>
        {/* ═══ Whale Health Check ═══ */}
        <Paper elevation={0} sx={{
          p: 2.5, borderRadius: 3, mb: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
          border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 1.5 }}>
            🐋 {t('argus.revenue.whaleHealthCheck', 'Whale Health Check')}
          </Typography>

          {/* Revenue Concentration */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {spenders.segments.map((seg) => {
              const segColor = seg.segment === 'top_1_pct' ? '#f44336' : seg.segment === 'top_10_pct' ? '#ff9800' : '#4caf50';
              const isRisky = seg.percentage > (seg.segment === 'top_1_pct' ? 30 : seg.segment === 'top_10_pct' ? 65 : 100);
              return (
                <Box key={seg.segment} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.3 }}>
                      <Typography fontSize={12} fontWeight={600}>
                        {segmentLabels[seg.segment] || seg.segment}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.8 }}>
                        <Typography fontSize={13} fontWeight={800} sx={{ color: segColor }}>
                          {seg.percentage.toFixed(1)}%
                        </Typography>
                        <Typography fontSize={11} color="text.secondary">
                          {fmt(seg.revenue)} · {seg.user_count.toLocaleString()} {t('argus.revenue.users', 'users')}
                        </Typography>
                      </Box>
                    </Box>
                    <LinearProgress variant="determinate" value={Math.min(seg.percentage, 100)}
                      sx={{ height: 8, borderRadius: 4, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        '& .MuiLinearProgress-bar': { bgcolor: segColor, borderRadius: 4 },
                      }}
                    />
                  </Box>
                  {isRisky && (
                    <Chip size="small" label={`⚠ ${t('argus.revenue.highRisk', 'High')}`} sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: alpha('#f44336', isDark ? 0.15 : 0.08), color: '#f44336', border: 'none' }} />
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Whale Insight */}
          {(() => {
            const top1 = spenders.segments.find(s => s.segment === 'top_1_pct');
            const top10 = spenders.segments.find(s => s.segment === 'top_10_pct');
            if (top10 && top10.percentage > 65) {
              return (
                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: isDark ? alpha('#f44336', 0.06) : alpha('#f44336', 0.03), border: '1px solid', borderColor: alpha('#f44336', isDark ? 0.12 : 0.06) }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#f44336' }}>
                    ⚠ {t('argus.revenue.whaleConcentrationWarning', '{{pct}}% of revenue concentrated in Top 10%', { pct: top10.percentage.toFixed(0) })}{top1 ? ` (Top 1% → ${top1.percentage.toFixed(0)}%)` : ''}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.3 }}>
                    → {t('argus.revenue.whaleConcentrationDetail', 'Revenue crash risk if whale users churn. Consider mid-tier growth programs & VIP retention.')}
                  </Typography>
                </Box>
              );
            }
            return null;
          })()}

          {/* Top Spenders Mini Cards */}
          {spenders.top_users.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', mb: 1 }}>
                🏆 {t('argus.revenue.topSpenders', 'Top Spenders')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {spenders.top_users.slice(0, 5).map((u, i) => (
                  <Chip
                    key={u.user_id}
                    size="small"
                    avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 9, bgcolor: stringToColor(u.user_id) }}>{getInitials(u.user_id)}</Avatar>}
                    label={`${u.user_id.slice(0, 8)}… ${fmt(u.total_spent)}`}
                    onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(u.user_id)}`)}
                    sx={{ fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      bgcolor: i === 0 ? alpha('#f44336', isDark ? 0.12 : 0.06) : 'transparent',
                      '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Segment cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, mb: 3 }}>
          {spenders.segments.map((seg) => (
            <Paper key={seg.segment} elevation={0} sx={{
              p: 2.5, borderRadius: 3, textAlign: 'center',
              bgcolor: isDark ? alpha(segmentColors[seg.segment] || '#999', 0.06) : alpha(segmentColors[seg.segment] || '#999', 0.03),
              border: '1px solid', borderColor: alpha(segmentColors[seg.segment] || '#999', isDark ? 0.15 : 0.1),
            }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>{segmentLabels[seg.segment] || seg.segment}</Typography>
              <Typography variant="h4" fontWeight={800} sx={{ color: segmentColors[seg.segment] }}>{seg.percentage.toFixed(1)}%</Typography>
              <Typography variant="caption" color="text.secondary">{t('argus.revenue.ofRevenue', 'of revenue')}</Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" fontSize={13}>{seg.user_count.toLocaleString()} {t('argus.revenue.users', 'users')} · {fmt(seg.revenue)}</Typography>
              </Box>
            </Paper>
          ))}
        </Box>

        {/* Spending distribution chart */}
        {spenders.distribution.length > 0 && (
          <ArgusVolumeChart
            title={t('argus.revenue.spendDistribution', 'Spending Distribution')}
            labels={spenders.distribution.map((d) => `$${fmtNum(d.range_start)}~$${fmtNum(d.range_end)}`)}
            datasets={[
              { label: t('argus.revenue.users', 'Users'), data: spenders.distribution.map((d) => d.user_count), color: '#2196f3' },
            ]}
            loading={loading}
            storagePrefix="argus_spend_dist"
            showCompactToggle={false}
            mb={3}
          />
        )}

        {/* Whale dependency trend */}
        {spenders.whale_trend.length > 0 && (
          <ArgusVolumeChart
            title={t('argus.revenue.whaleTrend', 'Top 10% Revenue Share Trend')}
            labels={spenders.whale_trend.map((d) =>
              new Date(d.period).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            )}
            datasets={[
              { label: t('argus.revenue.top10PctShare', 'Top 10% Share'), data: spenders.whale_trend.map((d) => d.top10_pct_share), color: '#f44336' },
            ]}
            loading={loading}
            storagePrefix="argus_whale_trend"
            showCompactToggle={false}
            mb={3}
            onZoom={handleChartZoom(spenders.whale_trend.map((d) => d.period))}
          />
        )}

        {/* Top individual spenders table */}
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" fontWeight={700}>{t('argus.revenue.topIndividualSpenders', 'Top 10 Individual Spenders')}</Typography>
            <Button
              size="small" variant="outlined"
              onClick={() => downloadCsv(spenders.top_users, [
                { key: 'user_id', label: 'User ID' },
                { key: 'total_spent', label: 'Total Spent', formatter: (v: any) => `$${(Number(v) || 0).toFixed(2)}` },
                { key: 'purchase_count', label: 'Purchases' },
                { key: 'percentage', label: 'Share %', formatter: (v: any) => `${(Number(v) || 0).toFixed(1)}%` },
              ], `top_spenders_${new Date().toISOString().slice(0, 10)}`)}
              sx={{ fontSize: 11, textTransform: 'none', minWidth: 'auto', px: 1.5 }}
            >
              📥 CSV
            </Button>
          </Box>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.revenue.userId', 'User ID')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.totalSpent', 'Total Spent')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.purchaseCount', 'Purchases')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.share', 'Share')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {spenders.top_users.map((u, i) => (
                <TableRow key={u.user_id} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <Box
                      onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(u.user_id)}`)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    >
                      <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: stringToColor(u.user_id) }}>
                        {getInitials(u.user_id)}
                      </Avatar>
                      <Typography fontWeight={600} fontSize={13} color="primary">{u.user_id}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right"><Typography fontWeight={600} fontSize={13}>{fmt(u.total_spent)}</Typography></TableCell>
                  <TableCell align="right">{u.purchase_count}</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                      <LinearProgress variant="determinate" value={Math.min(u.percentage, 100)} sx={{ flex: 1, maxWidth: 60, height: 6, borderRadius: 3 }} />
                      <Typography fontSize={12} color="text.secondary">{u.percentage.toFixed(1)}%</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>

        {/* Segment Comparison: Whales vs Normal */}
        {segmentComparison && segmentComparison.segments.length > 0 && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{t('argus.revenue.segmentComparison', 'Whale vs Normal Comparison')}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${segmentComparison.segments.length}, 1fr)` }, gap: 2 }}>
              {segmentComparison.segments.map((seg) => (
                <Paper key={seg.segment} variant="outlined" sx={{
                  p: 2.5, borderRadius: 3,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                  borderColor: seg.segment === 'whales' ? alpha('#f44336', 0.4) : alpha('#4caf50', 0.4),
                }}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{
                    color: seg.segment === 'whales' ? '#f44336' : '#4caf50',
                    textTransform: 'uppercase', mb: 1.5,
                  }}>
                    {seg.segment === 'whales' ? `🐳 ${t('argus.revenue.whales', 'Whales')} (Top 10%)` : `👤 ${t('argus.revenue.normalUsers', 'Normal Users')}`}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 2 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('argus.revenue.users', 'Users')}</Typography>
                      <Typography fontWeight={700}>{seg.user_count.toLocaleString()}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('argus.revenue.totalRevenue', 'Revenue')}</Typography>
                      <Typography fontWeight={700}>{fmt(seg.total_revenue)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('argus.revenue.avgSpend', 'Avg Spend')}</Typography>
                      <Typography fontWeight={700}>{fmt(seg.avg_spend)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('argus.revenue.avgPurchases', 'Avg Purchases')}</Typography>
                      <Typography fontWeight={700}>{seg.avg_purchases.toFixed(1)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('argus.revenue.aov', 'AOV')}</Typography>
                      <Typography fontWeight={700}>{fmt(seg.avg_order_value)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">{t('argus.revenue.avgActiveDays', 'Avg Active Days')}</Typography>
                      <Typography fontWeight={700}>{seg.avg_active_days.toFixed(1)}</Typography>
                    </Box>
                  </Box>
                  {seg.top_products.length > 0 && (
                    <>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>{t('argus.revenue.topProducts', 'Top Products')}</Typography>
                      {seg.top_products.map((p, i) => (
                        <Box key={p.product_name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.3 }}>
                          <Typography fontSize={12}>{i + 1}. {p.product_name}</Typography>
                          <Typography fontSize={12} color="text.secondary">{p.count}</Typography>
                        </Box>
                      ))}
                    </>
                  )}
                </Paper>
              ))}
            </Box>
          </Box>
        )}
      </>
    );
  };

  // ─── Render LTV ───────────────────────────────────────────────────────────

  const renderLtv = () => {
    if (!ltv || ltv.ltv_curve.length === 0) {
      return <EmptyPagePlaceholder icon={<LtvIcon sx={{ fontSize: 48 }} />} message={t('argus.revenue.noLtv', 'No LTV data')} subtitle={t('argus.revenue.noLtvDesc', 'Need purchase events with user tracking')} />;
    }

    // Show LTV milestones with user_count
    const milestones = [0, 1, 7, 14, 30, 60, 90].filter((d) => ltv.ltv_curve.some((c) => c.day === d));
    const milestoneData = milestones.map((d) => ltv.ltv_curve.find((c) => c.day === d)!).filter(Boolean);

    // D1 value for growth multiplier calculation
    const d1LtvObj = ltv.ltv_curve.find(c => c.day === 1);
    const d1LtvVal = d1LtvObj ? d1LtvObj.cumulative_revenue : 0;

    // BEP (Payback Day) calculation
    const paybackObj = ltv.ltv_curve.find(c => c.cumulative_revenue >= cacInput);
    const isPaybackReached = !!paybackObj;
    const paybackDayText = isPaybackReached ? `D${paybackObj.day}` : t('argus.revenue.notReached', 'Not Reached');

    return (
      <>
        {/* LTV Header with CAC input and Payback Period */}
        <Box sx={{ mb: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>
              {t('argus.revenue.ltvAnalysis', 'LTV & ROAS Simulator')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('argus.revenue.ltvDesc', 'Track Lifetime Value progression, Customer Acquisition Cost (CAC) payback, and multiplier growth.')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label={t('argus.revenue.targetCac', 'Target CAC')}
              type="number"
              size="small"
              value={cacInput === 0 ? '' : cacInput}
              onChange={(e) => setCacInput(Math.max(0, Number(e.target.value) || 0))}
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              sx={{ width: 140 }}
            />
          </Box>
        </Box>

        {/* Milestone cards with user count, Multiplier and ROAS */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 2, mb: 3 }}>
          {/* Special BEP Payback Period Card */}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              textAlign: 'center',
              border: '2px solid',
              borderColor: isPaybackReached ? '#4caf50' : 'divider',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            <Typography variant="caption" color="text.secondary" fontWeight={700}>
              {t('argus.revenue.paybackPeriod', 'PAYBACK PERIOD')}
            </Typography>
            <Typography variant="h5" fontWeight={800} color={isPaybackReached ? '#4caf50' : 'text.primary'} sx={{ my: 0.5 }}>
              {paybackDayText}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {isPaybackReached
                ? t('argus.revenue.bepReached', '100% ROAS Achieved')
                : t('argus.revenue.bepNotReached', 'Below Target CAC')}
            </Typography>
          </Paper>

          {milestoneData.map((m) => {
            const roasVal = cacInput > 0 ? ((m.cumulative_revenue / cacInput) * 100).toFixed(1) + '%' : '-';
            const mult = d1LtvVal > 0 ? (m.cumulative_revenue / d1LtvVal).toFixed(1) + 'x' : '1.0x';
            return (
              <Paper
                key={m.day}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  Day {m.day}
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ my: 0.5 }}>
                  {fmt(m.cumulative_revenue)}
                </Typography>
                <Box sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>
                  <div style={{ color: m.cumulative_revenue >= cacInput ? '#4caf50' : '#ff9800' }}>
                    {roasVal} ROAS
                  </div>
                  {m.day > 1 && (
                    <div style={{ fontSize: 10, marginTop: 2, opacity: 0.8 }}>
                      {mult} of D1
                    </div>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>

        {/* pLTV Predictions — Milestone Cards */}
        {ltv.pltv_predictions && ltv.pltv_predictions.length > 0 && (
          <Paper elevation={0} sx={{
            p: 2.5, borderRadius: 3, mb: 3,
            bgcolor: isDark ? alpha('#9c27b0', 0.04) : alpha('#9c27b0', 0.02),
            border: '1px dashed', borderColor: alpha('#9c27b0', isDark ? 0.2 : 0.15),
          }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#9c27b0' }}>
                  🔮 {t('argus.revenue.pltvPrediction', 'Predicted LTV (pLTV)')}
                </Typography>
                <Typography fontSize={11} color="text.secondary">
                  {t('argus.revenue.pltvDesc', 'Log-curve fit: y = a·ln(x+1) + b')}
                </Typography>
              </Box>
              <Chip size="small"
                label={`R² = ${(ltv.pltv_confidence * 100).toFixed(1)}%`}
                sx={{
                  height: 22, fontSize: 11, fontWeight: 700,
                  bgcolor: alpha(ltv.pltv_confidence >= 0.9 ? '#4caf50' : ltv.pltv_confidence >= 0.7 ? '#ff9800' : '#f44336', isDark ? 0.15 : 0.08),
                  color: ltv.pltv_confidence >= 0.9 ? '#4caf50' : ltv.pltv_confidence >= 0.7 ? '#ff9800' : '#f44336',
                  border: 'none',
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {ltv.pltv_predictions.map((pred) => {
                const roasVal = cacInput > 0 ? ((pred.predicted_ltv / cacInput) * 100).toFixed(1) + '%' : '-';
                return (
                  <Box key={pred.day} sx={{
                    flex: '1 1 100px', minWidth: 90, textAlign: 'center',
                    p: 1.5, borderRadius: 2,
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                    border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }}>
                    <Typography fontSize={10} color="text.secondary" fontWeight={700}>D{pred.day}</Typography>
                    <Typography fontSize={16} fontWeight={800} sx={{ color: '#9c27b0' }}>
                      {fmt(pred.predicted_ltv)}
                    </Typography>
                    {cacInput > 0 && (
                      <Typography fontSize={10} sx={{ color: pred.predicted_ltv >= cacInput ? '#4caf50' : '#ff9800', fontWeight: 600 }}>
                        {roasVal} ROAS
                      </Typography>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Paper>
        )}

        {/* Dual LTV chart: cumulative + daily + pLTV prediction */}
        {(() => {
          // Build unified labels: actual days + predicted extension
          const actualDays = ltv.ltv_curve.map(d => d.day);
          const maxActualDay = actualDays.length > 0 ? Math.max(...actualDays) : 0;
          const hasPltv = ltv.pltv_curve && ltv.pltv_curve.length > 0;

          // Extended labels: actual + predicted-only days
          const predOnlyDays = hasPltv
            ? ltv.pltv_curve.filter(p => p.day > maxActualDay).map(p => p.day)
            : [];
          const allDays = [...actualDays, ...predOnlyDays];
          const labels = allDays.map(d => `D${d}`);

          // Actual data padded with null for predicted extension
          const actualCumulative = [
            ...ltv.ltv_curve.map(d => d.cumulative_revenue),
            ...predOnlyDays.map(() => null as number | null),
          ];
          const actualDaily = [
            ...ltv.ltv_curve.map(d => d.daily_revenue),
            ...predOnlyDays.map(() => null as number | null),
          ];

          // Predicted line: null for days before prediction starts, then predicted values
          const predLine = hasPltv
            ? allDays.map(day => {
                const pt = ltv.pltv_curve.find(p => p.day === day);
                return pt ? pt.predicted_ltv : null;
              })
            : [];

          return (
            <ArgusVolumeChart
              title={t('argus.revenue.ltvCurve', 'Revenue LTV Curve')}
              labels={labels}
              datasets={[
                { label: t('argus.revenue.cumulativeRevenue', 'Cumulative Revenue'), data: actualCumulative as number[], color: '#4caf50' },
                { label: t('argus.revenue.dailyRevenue', 'Daily Revenue'), data: actualDaily as number[], color: '#2196f3' },
                ...(hasPltv ? [{
                  label: t('argus.revenue.pltvLine', 'Predicted LTV'),
                  data: predLine as number[],
                  color: '#9c27b0',
                }] : []),
              ]}
              loading={loading}
              storagePrefix="argus_revenue_ltv"
              showCompactToggle={false}
              mb={3}
            />
          );
        })()}

        {/* Cohort LTV Comparison */}
        {cohortLtv && cohortLtv.cohorts.length > 0 && (
          <Box sx={{ mt: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>{t('argus.revenue.cohortLtv', 'LTV by Cohort')}</Typography>
              <Select
                size="small"
                value={ltvCohortBy}
                onChange={(e) => setLtvCohortBy(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="week">{t('argus.revenue.byWeek', 'By Install Week')}</MenuItem>
                <MenuItem value="platform">{t('argus.revenue.byPlatform', 'By Platform')}</MenuItem>
                <MenuItem value="country">{t('argus.revenue.byCountry', 'By Country')}</MenuItem>
              </Select>
            </Box>
            <ArgusVolumeChart
              title=""
              labels={(() => {
                const maxLen = Math.max(...cohortLtv.cohorts.map((c) => c.ltv_curve.length));
                const ref = cohortLtv.cohorts.find((c) => c.ltv_curve.length === maxLen);
                return ref ? ref.ltv_curve.map((d) => `D${d.day}`) : [];
              })()}
              datasets={cohortLtv.cohorts.map((c, i) => ({
                label: ltvCohortBy === 'week'
                  ? new Date(c.label).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                  : c.label || t('common.unknown', 'Unknown'),
                data: c.ltv_curve.map((d) => d.cumulative_revenue),
                color: CHART_COLORS[i % CHART_COLORS.length],
              }))}
              loading={loading}
              storagePrefix="argus_cohort_ltv"
              showCompactToggle={false}
              mb={0}
            />
          </Box>
        )}

        {/* LTV detailed breakdown table */}
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff' }}>
          <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('argus.revenue.ltvBreakdownTable', 'LTV Detailed Breakdown')}
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>{t('argus.revenue.cohortDay', 'Day')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.cumulativeLtv', 'Cumulative LTV')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.dailyRevenue', 'Daily Revenue')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.multiplier', 'Multiplier')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.roas', 'ROAS')}</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">{t('argus.revenue.users', 'Cohort Users')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ltv.ltv_curve.map((row) => {
                const multVal = d1LtvVal > 0 ? (row.cumulative_revenue / d1LtvVal).toFixed(2) + 'x' : '-';
                const roasPercent = cacInput > 0 ? ((row.cumulative_revenue / cacInput) * 100).toFixed(1) + '%' : '-';
                const isBep = row.cumulative_revenue >= cacInput;
                return (
                  <TableRow key={row.day} hover>
                    <TableCell>Day {row.day}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600} fontSize={13}>{fmt(row.cumulative_revenue)}</Typography>
                    </TableCell>
                    <TableCell align="right">{fmt(row.daily_revenue)}</TableCell>
                    <TableCell align="right">{row.day === 1 ? '1.00x (Ref)' : multVal}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600} fontSize={13} color={isBep ? '#4caf50' : '#ff9800'}>
                        {roasPercent}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{row.user_count.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </>
    );
  };

  // ─── Render Content ───────────────────────────────────────────────────────

  const renderContent = () => {
    // Check if this section has cached data to show
    const hasSectionData = (() => {
      switch (section) {
        case 'overview': return !!data;
        case 'ledger': return true;
        case 'discover': return true;
        case 'products': return products.length > 0;
        case 'economy': return !!economy;
        case 'spenders': return !!spenders;
        case 'ltv': return !!ltv;
        default: return false;
      }
    })();

    // Full-page skeleton only when: loading AND no cached data for this section
    if (loading && !hasSectionData) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={80} />)}
          </Box>
          <ArgusChartSkeleton height={300} />
        </Box>
      );
    }

    // If we have cached data but are refreshing, show content with a subtle top loading bar
    const content = (() => {
      switch (section) {
        case 'overview': return renderOverview();
        case 'ledger': return renderLedger();
        case 'discover': return renderDiscover();
        case 'products': return renderProducts();
        case 'economy': return renderEconomy();
        case 'spenders': return renderSpenders();
        case 'ltv': return renderLtv();
        default: return null;
      }
    })();

    return (
      <>
        {loading && hasSectionData && (
          <LinearProgress sx={{ mb: 1, borderRadius: 1, height: 2, opacity: 0.6 }} />
        )}
        {content}
      </>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PageHeader
        title={
          <ArgusBreadcrumbs paths={[
            { label: t('argus.analytics.title', 'Analytics'), to: '/argus/analytics' },
            { label: t('argus.revenue', 'Revenue') },
          ]} size="title" />
        }
        subtitle={t('argus.revenue.subtitle', 'Track purchase events and revenue metrics')}
        actions={<DateRangeSelector value={dateRange} onChange={setDateRange} />}
        actionsUpdateTrigger={JSON.stringify(dateRange)}
      />

      <Box sx={{ display: 'flex', flex: 1, ml: -2, mr: -2, mb: -2 }}>
        {/* ══════ LEFT SIDEBAR ══════ */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            pt: 1,
            pl: 2,
          }}
        >
          <Box sx={{ position: 'sticky', top: 2, pr: 1 }}>
            {NAV_ITEMS.map((item) => {
              // Compute detail string for each sidebar item
              let detail: string | undefined;
              if (!loading) {
                switch (item.id) {
                  case 'overview': detail = data ? fmt(data.total_revenue) : undefined; break;
                  case 'ledger': detail = undefined; break;
                  case 'discover': detail = undefined; break;
                  case 'products': detail = products.length > 0 ? `${products.length} items` : undefined; break;
                  case 'economy': detail = economy?.by_currency[0] ? `Ratio ${(economy.by_currency[0].sink > 0 ? economy.by_currency[0].source / economy.by_currency[0].sink : 0).toFixed(2)}` : undefined; break;
                  case 'spenders': detail = spenders?.segments.find(s => s.segment === 'top_10pct') ? `Top10 ${spenders!.segments.find(s => s.segment === 'top_10pct')!.percentage.toFixed(0)}%` : undefined; break;
                  case 'ltv': detail = ltv ? `D30 ${fmt(ltv.ltv_curve.find(c => c.day === 30)?.cumulative_revenue || ltv.ltv_curve[ltv.ltv_curve.length - 1]?.cumulative_revenue || 0)}` : undefined; break;
                }
              }
              return (
                <SidebarItem
                  key={item.id}
                  item={item}
                  active={section === item.id}
                  isDark={isDark}
                  onClick={() => setSection(item.id)}
                  t={t}
                  detail={detail}
                />
              );
            })}
          </Box>
        </Box>

        {/* ══════ RIGHT CONTENT ══════ */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 1, pl: 3, pr: 2, pb: 6 }}>
          {renderContent()}
        </Box>
      </Box>

      {/* Dialogs and Panels */}
      <SaveQueryDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        name={queryName}
        onNameChange={setQueryName}
        onSave={handleSaveQuery}
        mode={saveDialogMode}
        savedQueries={savedQueries}
        currentQueryId={currentQueryId}
      />

      <DeleteQueryConfirmDialog
        open={deleteDialogOpen}
        queryName={deleteTarget?.name || ''}
        onClose={() => { setDeleteDialogOpen(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteQuery}
      />

      <DiscoverSavedPanel
        open={savedQueriesOpen}
        onClose={() => setSavedQueriesOpen(false)}
        savedQueries={savedQueries}
        onLoad={handleLoadSavedQuery}
        onDelete={(id) => {
          const target = savedQueries.find(q => q.id === id);
          if (target) {
            setDeleteTarget(target);
            setDeleteDialogOpen(true);
          }
        }}
      />
    </Box>
  );
};

export default ArgusRevenuePage;
