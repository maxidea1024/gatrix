import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, useTheme, alpha, Paper, Table, TableHead, TableRow,
  TableCell, TableBody, Skeleton, Chip, LinearProgress, TextField, InputAdornment,
  ToggleButton, ToggleButtonGroup, Button, CircularProgress, Avatar,
  Select, MenuItem, Collapse, Tooltip, Slider, Autocomplete, Checkbox, FormControlLabel,
  IconButton, TableSortLabel, TableContainer,
} from '@mui/material';
import SimplePagination from '@/components/common/SimplePagination';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  Category as ProductIcon,
  AccountBalance as EconomyIcon,
  Diamond as DiamondIcon,
  Timeline as LtvIcon,
  ArrowDropUp, ArrowDropDown, ExpandMore, ExpandLess,
  OpenInNew as DrillIcon,
  Search as SearchIcon,
  ReceiptLong as LedgerIcon,
  Explore as DiscoverIcon,
  Save as SaveIcon,
  Bookmark as BookmarkIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatWith } from '@/utils/dateFormat';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import PageContentLoader from '@/components/common/PageContentLoader';
import DateRangeSelector, {
  DateRangeValue, dateRangeToApiParams, presetToHours, DateRangePresetOption, DEFAULT_PRESETS,
} from '@/components/common/DateRangeSelector';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import ArgusSegmentFilter, { type SegmentFilterValues } from './components/ArgusSegmentFilter';
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
import { generateInsights, buildSegmentMatrix, type Insight, type SegmentVerdict } from './monetizationInsights';
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
import useGlobalPageSize from '@/hooks/useGlobalPageSize';

import {
  type SectionId, type NavItem, NAV_ITEMS, MIN_HOURS_PER_SECTION, DEFAULT_PRESET_FOR_MIN,
  getPresetsForSection, pctChange, fmt, fmtNum, CHART_COLORS,
  BalanceGauge, KpiCard, SidebarItem,
} from './components/monetization/MonetizationHelpers';
import { ArgusMonetizationOverview } from './components/monetization/ArgusMonetizationOverview';
import { ArgusMonetizationSpenders } from './components/monetization/ArgusMonetizationSpenders';
import { ArgusMonetizationLtv } from './components/monetization/ArgusMonetizationLtv';
import { ArgusMonetizationProducts } from './components/monetization/ArgusMonetizationProducts';
import { ArgusMonetizationEconomy } from './components/monetization/ArgusMonetizationEconomy';
import { ArgusMonetizationLedger } from './components/monetization/ArgusMonetizationLedger';
import { ArgusMonetizationDiscover } from './components/monetization/ArgusMonetizationDiscover';
import { ArgusMonetizationAcquisition } from './components/monetization/ArgusMonetizationAcquisition';

// ═════════════════════════════════════════════════════════════════════════════
// Main Page
// ═════════════════════════════════════════════════════════════════════════════

const ALL_SECTION_IDS: SectionId[] = NAV_ITEMS.map((n) => n.id);

const ArgusMonetizationPage: React.FC = () => {
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
    // Auto-clamp dateRange if it's shorter than the section's minimum
    const minHours = MIN_HOURS_PER_SECTION[id];
    if (minHours) {
      setDateRange((prev) => {
        if (prev.type === 'preset' && prev.preset) {
          const h = presetToHours(prev.preset);
          if (h !== undefined && h < minHours) {
            return { type: 'preset', preset: DEFAULT_PRESET_FOR_MIN[minHours] || '24h' };
          }
        } else if (prev.type === 'custom' && prev.start && prev.end) {
          const s = typeof prev.start === 'string' ? new Date(prev.start) : prev.start;
          const e = typeof prev.end === 'string' ? new Date(prev.end) : prev.end;
          const diffH = (e.getTime() - s.getTime()) / (1000 * 60 * 60);
          if (diffH < minHours) {
            return { type: 'preset', preset: DEFAULT_PRESET_FOR_MIN[minHours] || '24h' };
          }
        }
        return prev;
      });
    }
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
  const [loading, setLoading] = useState(false);

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
  const [txQuery, setTxQuery] = useState<string>('');
  const [txSort, setTxSort] = useState<'timestamp' | 'amount'>('timestamp');
  const [txOrder, setTxOrder] = useState<'desc' | 'asc'>('desc');
  const [txOffset, setTxOffset] = useState(0);
  const [txLimit, setTxLimit] = useGlobalPageSize();
  const [txGroupBy, setTxGroupBy] = useState<LedgerGroupBy>('none');
  const [groupByAnchor, setGroupByAnchor] = useState<HTMLElement | null>(null);
  const [presetAnchor, setPresetAnchor] = useState<HTMLElement | null>(null);

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
  const [savedQueriesOpen, setSavedQueriesOpen] = useState<boolean>(false);
  const ledgerDslEditorRef = React.useRef<QueryAQLEditorHandle>(null);

  // Product hourly heatmap
  const [heatmapData, setHeatmapData] = useState<HourlyHeatmapCell[]>([]);
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  const [heatmapLoadedFor, setHeatmapLoadedFor] = useState<string | null>(null);

  // Product detail drawer
  const [selectedProduct, setSelectedProduct] = useState<ProductRevenue | null>(null);
  const [productDetail, setProductDetail] = useState<ProductDetailData | null>(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);
  const [loadingMoreBuyers, setLoadingMoreBuyers] = useState(false);

  // Segment filters
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilterValues>({});

  const apiParams = useMemo(() => {
    const base = dateRangeToApiParams(dateRange);
    // Merge segment filter values (remove undefined/empty)
    const merged = { ...base };
    if (segmentFilter.country) (merged as any).country = segmentFilter.country;
    if (segmentFilter.platform) (merged as any).platform = segmentFilter.platform;
    if (segmentFilter.app_version) (merged as any).app_version = segmentFilter.app_version;
    return merged;
  }, [dateRange, segmentFilter]);

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

  // Reset pagination when date range changes — don't clear txData to avoid layout jolt
  useEffect(() => {
    setTxOffset(0);
  }, [apiParams]);

  // Load transactions ledger data
  const loadTx = useCallback(async (
    offsetOverride?: number,
    sortOverride?: string,
    orderOverride?: string,
    groupByOverride?: LedgerGroupBy,
    limitOverride?: number
  ) => {
    setTxLoading(true);
    try {
      const activeGroupBy = groupByOverride !== undefined ? groupByOverride : txGroupBy;
      const result = await getRevenueTransactions(projectId, {
        ...apiParams,
        search: txQuery || undefined,
        sort: sortOverride ?? txSort,
        order: orderOverride ?? txOrder,
        offset: offsetOverride !== undefined ? offsetOverride : txOffset,
        limit: limitOverride !== undefined ? limitOverride : txLimit,
        group_by: activeGroupBy,
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
    txQuery,
    txSort,
    txOrder,
    txOffset,
    txLimit,
    txGroupBy,
  ]);

  // Automatically trigger fetch when filters or offsets change
  useEffect(() => {
    if (section === 'ledger') {
      loadTx();
    }
  }, [section, loadTx]);

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
        q: txQuery,
        sort: txSort,
        order: txOrder,
        group_by: txGroupBy,
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
      setTxQuery(config.q || '');
      setTxSort(config.sort || 'timestamp');
      setTxOrder(config.order || 'desc');
      setTxGroupBy(config.group_by || 'none');
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
      if (section === 'overview' || section === 'ledger' || section === 'discover') {
        // Overview data (revenue_over_time etc.) is needed for all three sections
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
    loadedKeysRef.current = {};
  }, [dateRange]);

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

    const content = (() => {
      switch (section) {
        case 'overview':
          return (
            <ArgusMonetizationOverview
              data={data}
              products={products}
              spenders={spenders}
              loading={loading}
              isDark={isDark}
              t={t}
              showAllInsights={showAllInsights}
              setShowAllInsights={setShowAllInsights}
              funnelOpen={funnelOpen}
              setFunnelOpen={setFunnelOpen}
              cohortOpen={cohortOpen}
              setCohortOpen={setCohortOpen}
              funnel={funnel}
              cohort={cohort}
              setTxQuery={setTxQuery}
              setTxOffset={setTxOffset}
              setTxGroupBy={setTxGroupBy}
              setSection={setSection}
              handleChartZoom={handleChartZoom}
              economy={economy}
              ltv={ltv}
            />
          );
        case 'ledger':
          return (
            <ArgusMonetizationLedger
              txGroupBy={txGroupBy}
              setTxGroupBy={setTxGroupBy}
              txData={txData}
              txLoading={txLoading}
              txQuery={txQuery}
              setTxQuery={setTxQuery}
              txOffset={txOffset}
              setTxOffset={setTxOffset}
              txLimit={txLimit}
              setTxLimit={setTxLimit}
              txSort={txSort}
              setTxSort={setTxSort}
              txOrder={txOrder}
              setTxOrder={setTxOrder}
              data={data}
              loading={loading}
              isDark={isDark}
              t={t}
              navigate={navigate}
              projectId={projectId}
              apiParams={apiParams}
              setSavedQueriesOpen={setSavedQueriesOpen}
              setSaveDialogMode={setSaveDialogMode}
              setSaveDialogOpen={setSaveDialogOpen}
              fetchFieldValues={fetchFieldValues}
              handleChartZoom={handleChartZoom}
              presetAnchor={presetAnchor}
              setPresetAnchor={setPresetAnchor}
              groupByAnchor={groupByAnchor}
              setGroupByAnchor={setGroupByAnchor}
              ledgerDslEditorRef={ledgerDslEditorRef}
            />
          );
        case 'discover':
          return (
            <ArgusMonetizationDiscover
              discGroupBy={discGroupBy}
              setDiscGroupBy={setDiscGroupBy}
              discQuery={discQuery}
              setDiscQuery={setDiscQuery}
              discYAxis={discYAxis}
              setDiscYAxis={setDiscYAxis}
              discLoading={discLoading}
              discError={discError}
              discHasQueried={discHasQueried}
              discVolume={discVolume}
              discResults={discResults}
              discResultsMeta={discResultsMeta}
              discLimit={discLimit}
              discOffset={discOffset}
              setDiscOffset={setDiscOffset}
              runDiscoverQuery={runDiscoverQuery}
              handleSearchSubmit={handleSearchSubmit}
              handleSearchChange={handleSearchChange}
              fetchFieldValues={fetchFieldValues}
              dateRange={dateRange}
              setDateRange={setDateRange}
              setSavedQueriesOpen={setSavedQueriesOpen}
              setSaveDialogMode={setSaveDialogMode}
              setSaveDialogOpen={setSaveDialogOpen}
              isDark={isDark}
              t={t}
              navigate={navigate}
            />
          );
        case 'products':
          return (
            <ArgusMonetizationProducts
              products={products}
              productSearch={productSearch}
              setProductSearch={setProductSearch}
              productTrend={productTrend}
              loading={loading}
              isDark={isDark}
              t={t}
              handleChartZoom={handleChartZoom}
              selectedProduct={selectedProduct}
              setSelectedProduct={setSelectedProduct}
              productDetail={productDetail}
              productDetailLoading={productDetailLoading}
              loadingMoreBuyers={loadingMoreBuyers}
              heatmapData={heatmapData}
              heatmapLoading={heatmapLoading}
              openProductDetail={openProductDetail}
              loadMoreBuyers={loadMoreBuyers}
              categoryBreakdown={categoryBreakdown}
              firstPurchaseProducts={firstPurchaseProducts}
              navigate={navigate}
            />
          );
        case 'economy':
          return (
            <ArgusMonetizationEconomy
              economy={economy}
              economyCurrency={economyCurrency}
              setEconomyCurrency={setEconomyCurrency}
              loading={loading}
              isDark={isDark}
              t={t}
              handleChartZoom={handleChartZoom}
            />
          );
        case 'spenders':
          return (
            <ArgusMonetizationSpenders
              spenders={spenders}
              segmentComparison={segmentComparison}
              loading={loading}
              isDark={isDark}
              t={t}
              navigate={navigate}
              handleChartZoom={handleChartZoom}
            />
          );
        case 'ltv':
          return (
            <ArgusMonetizationLtv
              ltv={ltv}
              loading={loading}
              isDark={isDark}
              t={t}
              cacInput={cacInput}
              setCacInput={setCacInput}
              cohortLtv={cohortLtv}
              ltvCohortBy={ltvCohortBy}
              setLtvCohortBy={setLtvCohortBy}
              handleChartZoom={handleChartZoom}
            />
          );
        case 'acquisition':
          return (
            <ArgusMonetizationAcquisition
              projectId={projectId}
              apiParams={apiParams}
              isDark={isDark}
              t={t}
              handleChartZoom={handleChartZoom}
            />
          );
        default: return null;
      }
    })();

    return (
      <PageContentLoader loading={loading && !hasSectionData} sx={(section === 'ledger' || section === 'acquisition') ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } : undefined}>
        {loading && hasSectionData && (
          <LinearProgress sx={{ mb: 1, borderRadius: 1, height: 2, opacity: 0.6 }} />
        )}
        {content}
      </PageContentLoader>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', ...((section === 'ledger' || section === 'acquisition') ? { height: '100%' } : { flex: 1 }) }}>
      <PageHeader
        title={
          <ArgusBreadcrumbs paths={[
            { label: t('argus.analytics.title', 'Analytics'), to: '/argus/analytics' },
            { label: t('argus.monetization', 'Monetization') },
          ]} size="title" />
        }
        subtitle={t('argus.monetization.subtitle', 'Track purchase events and revenue metrics')}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ArgusSegmentFilter
              value={segmentFilter}
              onChange={setSegmentFilter}
              countries={data?.revenue_by_country?.map((c: any) => c.country).filter(Boolean) || []}
              platforms={data?.revenue_by_platform?.map((p: any) => p.platform).filter(Boolean) || []}
            />
            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              presets={getPresetsForSection(section)}
            />
          </Box>
        }
        actionsUpdateTrigger={JSON.stringify({ dateRange, segmentFilter })}
      />

      <Box
        sx={{
          display: 'flex',
          gap: 2,
          flex: 1,
          mt: -2,
          ml: -2,
          mr: -2,
          mb: -2,
          ...(section === 'ledger' && { minHeight: 0 }),
        }}
      >
        {/* ══════ LEFT SIDEBAR ══════ */}
        <Box
          sx={{
            width: 220,
            flexShrink: 0,
            borderRight: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            pt: 2,
            pl: 2,
          }}
        >
          <Box sx={{ position: 'sticky', top: 2, pr: 1 }}>
            {NAV_ITEMS.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                active={section === item.id}
                isDark={isDark}
                onClick={() => setSection(item.id)}
                t={t}
              />
            ))}
          </Box>
        </Box>

        {/* ══════ RIGHT CONTENT ══════ */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 2, pr: 1, ...(section === 'ledger' ? { pb: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } : { pb: 6 }) }}>
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

export default ArgusMonetizationPage;
