import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  Chip,
  MenuItem,
  Stack,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  TableSortLabel,
  FormControlLabel,
  Checkbox,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  Divider,
  FormHelperText,
  Paper,
  Collapse,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  ViewColumn as ViewColumnIcon,
  List as ListIcon,
  ContentCopy as ContentCopyIcon,
  Code as CodeIcon,
  CardGiftcard as CardGiftcardIcon,
  HourglassEmpty as HourglassEmptyIcon,
  Download as DownloadIcon,
  ArrowDropDown as ArrowDropDownIcon,
  CheckCircle as CheckCircleIcon,
  TableChart as TableChartIcon,
  Description as ExcelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import SearchTextField from '../../components/common/SearchTextField';
import { parseApiErrorMessage } from '../../utils/errorUtils';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import RecordDetailDialog, {
  DetailField,
} from '../../components/common/RecordDetailDialog';
import {
  showChangeRequestCreatedToast,
  getActionLabel,
} from '../../utils/changeRequestToast';
import { ChangeRequestSubmitButtons } from '../../components/common/ChangeRequestSubmitButtons';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useGlobalPageSize } from '@/hooks/useGlobalPageSize';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import SimplePagination from '@/components/common/SimplePagination';
import {
  couponService,
  CouponSetting,
  CouponStatus,
  CouponType,
  IssuedCouponCode,
} from '@/services/couponService';
import {
  generateExampleCouponCode,
  CodePattern,
} from '@/utils/couponCodeGenerator';
import { usePlatformConfig } from '@/contexts/PlatformConfigContext';
import { useGameWorld } from '@/contexts/GameWorldContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import PageContentLoader from '@/components/common/PageContentLoader';

import DynamicFilterBar, {
  FilterDefinition,
  ActiveFilter,
} from '@/components/common/DynamicFilterBar';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import {
  formatDateTime,
  parseUTCForPicker,
  formatRelativeTime,
  formatDateTimeDetailed,
} from '@/utils/dateFormat';
import { useI18n } from '@/contexts/I18nContext';
import ColumnSettingsDialog, {
  ColumnConfig,
} from '@/components/common/ColumnSettingsDialog';
import ResizableDrawer from '@/components/common/ResizableDrawer';

import RewardSelector from '@/components/game/RewardSelector';
import RewardDisplay from '@/components/game/RewardDisplay';
import TargetSettingsGroup, {
  ChannelSubchannelData,
} from '@/components/game/TargetSettingsGroup';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Dayjs } from 'dayjs';
import { exportToFile, ExportColumn } from '../../utils/exportImportUtils';
import ExportImportMenuItems from '../../components/common/ExportImportMenuItems';
import ImportDialog from '../../components/common/ImportDialog';
import PageHeader from '@/components/common/PageHeader';
import TagSelector from '@/components/common/TagSelector';
import TagChips from '@/components/common/TagChips';

// Coupon Settings page (list and management of coupon definitions)
const CouponSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useI18n();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;
  const { platforms, channels } = usePlatformConfig();
  const { worlds } = useGameWorld();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([P.COUPONS_UPDATE]);
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  // list state
  const [items, setItems] = useState<CouponSetting[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useGlobalPageSize();
  const [loading, setLoading] = useState(false);

  // selection state for table rows
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // filters with localStorage persistence
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(() => {
    const saved = localStorage.getItem('couponSettingsFilters');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const typeFilter = useMemo(() => {
    const f = activeFilters.find((f) => f.key === 'type');
    return f?.value as CouponType | undefined;
  }, [activeFilters]);

  const statusFilter = useMemo(() => {
    const f = activeFilters.find((f) => f.key === 'status');
    return f?.value as CouponStatus | undefined;
  }, [activeFilters]);

  const typeFilterString = useMemo(() => typeFilter || '', [typeFilter]);
  const statusFilterString = useMemo(() => statusFilter || '', [statusFilter]);

  // Issued codes drawer state
  const [openCodes, setOpenCodes] = useState(false);
  const [codesSetting, setCodesSetting] = useState<CouponSetting | null>(null);
  const [codesSearch, setCodesSearch] = useState('');
  const debouncedCodesSearch = useDebounce(codesSearch, 500);
  const [codesStatusFilter, setCodesStatusFilter] = useState<
    'ALL' | 'USED' | 'ISSUED'
  >('ALL');
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesStatsLoading, setCodesStatsLoading] = useState(false);
  const [codesItems, setCodesItems] = useState<IssuedCouponCode[]>([]);
  const [codesTotal, setCodesTotal] = useState(0);
  const [codesPage, setCodesPage] = useState(0);
  const [codesRowsPerPage, setCodesRowsPerPage] = useState(20);
  const [codesOrderBy, setCodesOrderBy] = useState<string>('usedAt');
  const [codesOrder, setCodesOrder] = useState<'asc' | 'desc'>('desc');
  const [codesExportMenuAnchor, setCodesExportMenuAnchor] =
    useState<null | HTMLElement>(null);
  const [codesStats, setCodesStats] = useState<{
    issued: number;
    used: number;
    unused: number;
  }>({ issued: 0, used: 0, unused: 0 });
  const [exportingCodes, setExportingCodes] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportProcessedCount, setExportProcessedCount] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx' | null>(null);
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const codesRequestIdRef = useRef(0);

  const [pageMenuAnchor, setPageMenuAnchor] = useState<HTMLElement | null>(
    null
  );
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [rowMenuAnchor, setRowMenuAnchor] = useState<HTMLElement | null>(null);
  const [rowMenuCoupon, setRowMenuCoupon] = useState<CouponSetting | null>(
    null
  );

  // Detail dialog state
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailCode, setDetailCode] = useState<IssuedCouponCode | null>(null);

  const handleOpenDetail = (code: IssuedCouponCode) => {
    setDetailCode(code);
    setDetailDialogOpen(true);
  };

  const DETAIL_FIELDS: DetailField[] = [
    { key: 'code', labelKey: 'coupons.issuedCodes.code', mono: true },
    { key: 'status', labelKey: 'coupons.issuedCodes.status' },
    {
      key: 'userId',
      labelKey: 'coupons.couponUsage.columns.userId',
      mono: true,
    },
    { key: 'userName', labelKey: 'coupons.couponUsage.columns.userName' },
    {
      key: 'characterId',
      labelKey: 'coupons.couponUsage.columns.characterId',
      mono: true,
    },
    { key: 'sequence', labelKey: 'coupons.couponUsage.columns.sequence' },
    { key: 'gameWorldId', labelKey: 'coupons.couponUsage.columns.gameWorldId' },
    { key: 'platform', labelKey: 'coupons.couponUsage.columns.platform' },
    { key: 'channel', labelKey: 'coupons.couponUsage.columns.channel' },
    { key: 'subchannel', labelKey: 'coupons.couponUsage.columns.subChannel' },
    {
      key: 'createdAt',
      labelKey: 'coupons.issuedCodes.issuedAt',
      format: (val) => formatDateTime(val),
    },
    {
      key: 'usedAt',
      labelKey: 'coupons.issuedCodes.usedAt',
      format: (val) => (val ? formatDateTime(val) : '-'),
    },
  ];

  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CouponSetting | null>(null);

  const handleCopyCode = async (code: string) => {
    copyToClipboardWithNotification(
      code,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  const handleCopyName = async (name: string) => {
    copyToClipboardWithNotification(
      name,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  // Export all issued codes to CSV/XLSX (chunked for large datasets)
  const handleExportIssuedCodes = useCallback(
    async (format: 'csv' | 'xlsx', useFilter: boolean = false) => {
      if (!codesSetting) {
        enqueueSnackbar(t('coupons.couponSettings.noDataToExport'), {
          variant: 'warning',
        });
        return;
      }

      const totalCodes = codesStats.issued || 0;
      const shouldShowProgress = totalCodes > 1000;

      // Only show progress dialog for large datasets
      if (shouldShowProgress) {
        setExportingCodes(true);
        setExportProgress(0);
        setExportProcessedCount(0);
        setExportError(null);
        setExportSuccess(false);
        setExportFormat(format);
      }

      setCodesExportMenuAnchor(null);
      exportAbortControllerRef.current = new AbortController();

      try {
        const now = new Date();
        const dateTimeStr = now
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const allCodes: IssuedCouponCode[] = [];
        const chunkSize = 1000;
        let hasMore = true;
        let cursorCreatedAt: string | undefined;
        let cursorId: string | undefined;

        // Fetch all codes in chunks using cursor-based pagination
        // (prevents row skipping when new codes are generated between chunks)
        while (hasMore && !exportAbortControllerRef.current?.signal.aborted) {
          // Check if export was cancelled
          if (exportAbortControllerRef.current?.signal.aborted) {
            throw new Error('Export cancelled');
          }

          try {
            const res = await couponService.getIssuedCodesForExport(
              projectApiPath,
              codesSetting.id,
              {
                limit: chunkSize,
                search: useFilter
                  ? debouncedCodesSearch || undefined
                  : undefined,
                status:
                  useFilter && codesStatusFilter !== 'ALL'
                    ? codesStatusFilter
                    : undefined,
                cursorCreatedAt,
                cursorId,
              }
            );
            allCodes.push(...(res.codes || []));
            hasMore = res.hasMore || false;
            cursorCreatedAt = res.nextCursorCreatedAt || undefined;
            cursorId = res.nextCursorId || undefined;

            // Update progress only for large datasets
            if (shouldShowProgress) {
              setExportProcessedCount(allCodes.length);
              const progress = Math.min(
                100,
                Math.round((allCodes.length / (totalCodes || 1)) * 100)
              );
              setExportProgress(progress);
            }
          } catch (error) {
            if ((error as any).name === 'AbortError') {
              throw new Error('Export cancelled');
            }
            throw error;
          }
        }

        if (allCodes.length === 0) {
          if (shouldShowProgress) {
            setExportError(t('coupons.couponSettings.noDataToExport'));
          } else {
            enqueueSnackbar(t('coupons.couponSettings.noDataToExport'), {
              variant: 'warning',
            });
          }
          return;
        }

        let blob: Blob;
        let filename: string;

        if (format === 'csv') {
          // CSV export
          const headers = [
            'Code',
            'Status',
            'User ID',
            'User Name',
            'Character ID',
            'Sequence',
            'Game World ID',
            'Platform',
            'Channel',
            'Subchannel',
            'Issued At',
            'Used At',
          ];
          const rows = allCodes.map((c) => [
            c.code,
            c.status,
            c.userId || '-',
            c.userName || '-',
            c.characterId || '-',
            c.sequence !== null && c.sequence !== undefined
              ? String(c.sequence)
              : '-',
            c.gameWorldId || '-',
            c.platform || '-',
            c.channel || '-',
            c.subchannel || '-',
            formatDateTime(c.createdAt),
            c.usedAt ? formatDateTime(c.usedAt) : '-',
          ]);

          const csvContent = [
            headers.join(','),
            ...rows.map((r) => r.join(',')),
          ].join('\n');

          blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          filename = `issued-codes-${codesSetting.code || 'export'}-${dateTimeStr}.csv`;
        } else if (format === 'xlsx') {
          // XLSX export using xlsx library
          const XLSX = await import('xlsx');
          const ws = XLSX.utils.json_to_sheet(
            allCodes.map((c) => ({
              Code: c.code,
              Status: c.status,
              'User ID': c.userId || '-',
              'User Name': c.userName || '-',
              'Character ID': c.characterId || '-',
              Sequence:
                c.sequence !== null && c.sequence !== undefined
                  ? c.sequence
                  : '-',
              'Game World ID': c.gameWorldId || '-',
              Platform: c.platform || '-',
              Channel: c.channel || '-',
              Subchannel: c.subchannel || '-',
              'Issued At': formatDateTime(c.createdAt),
              'Used At': c.usedAt ? formatDateTime(c.usedAt) : '-',
            }))
          );
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'Issued Codes');
          const xlsxBuffer = XLSX.write(wb, {
            bookType: 'xlsx',
            type: 'array',
          });
          blob = new Blob([xlsxBuffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          filename = `issued-codes-${codesSetting.code || 'export'}-${dateTimeStr}.xlsx`;
        } else {
          if (shouldShowProgress) {
            setExportError('Unsupported export format');
          } else {
            enqueueSnackbar('Unsupported export format', {
              variant: 'warning',
            });
          }
          return;
        }

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        if (shouldShowProgress) {
          setExportingCodes(false);
          setExportSuccess(true);
          setExportProgress(100);
        } else {
          enqueueSnackbar(t('coupons.couponSettings.exportSuccess'), {
            variant: 'success',
          });
        }
      } catch (error: any) {
        console.error('Error exporting issued codes:', error);
        // Don't show error dialog if export was cancelled
        if (error.message === 'Export cancelled') {
          if (shouldShowProgress) {
            setExportingCodes(false);
            setExportError(null);
            setExportSuccess(false);
            setExportProgress(0);
            setExportProcessedCount(0);
            setExportFormat(null);
          }
        } else {
          if (shouldShowProgress) {
            setExportingCodes(false);
            setExportError(
              error.message || t('coupons.couponSettings.exportError')
            );
          } else {
            enqueueSnackbar(
              parseApiErrorMessage(error, 'coupons.couponSettings.exportError'),
              {
                variant: 'error',
              }
            );
          }
        }
      } finally {
        exportAbortControllerRef.current = null;
      }
    },
    [
      codesSetting,
      debouncedCodesSearch,
      codesStatusFilter,
      codesStats?.issued || 0,
      t,
      enqueueSnackbar,
    ]
  );

  const handleOpenCodes = (it: CouponSetting) => {
    setCodesSetting(it);
    setOpenCodes(true);
    setCodesPage(0);
    setCodesStatusFilter('ALL');
    setCodesSearch('');
    setCodesOrderBy('usedAt');
    setCodesOrder('desc');
  };

  // form dialog state
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CouponSetting | null>(null);
  const [form, setForm] = useState<any>({
    code: '',
    type: 'NORMAL' as CouponType,
    name: '',
    description: '',
    quantity: 1,
    perUserLimit: 1,
    usageLimitType: 'USER' as any,
    maxTotalUses: null as any,
    startsAt: null as Dayjs | null,
    expiresAt: null as Dayjs | null,
    status: 'ACTIVE' as CouponStatus,
    rewardData: [],
    rewardTemplateId: null as string | null,
    rewardEmailTitle: '',
    rewardEmailBody: '',
    targetPlatforms: [] as string[],
    targetPlatformsInverted: false,
    targetChannelSubchannels: [] as Array<{
      channel: string;
      subchannels: string[];
    }>,
    targetChannelSubchannelsInverted: false,
    targetWorlds: [] as string[],
    targetWorldsInverted: false,
    targetUserIds: '' as string,
    targetUserIdsInverted: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [fullEditingData, setFullEditingData] = useState<any>(null);
  const [rewardMode, setRewardMode] = useState<'direct' | 'template'>('direct');
  // Track if description was manually edited by user
  const [isDescriptionManuallyEdited, setIsDescriptionManuallyEdited] =
    useState(false);
  // Collapsible group states (target settings is collapsed by default)
  const [expandedGroups, setExpandedGroups] = useState({
    basicInfo: true,
    codeQuantity: true,
    usageLimit: true,
    dateRange: true,
    rewards: true,
    rewardEmail: true,
  });

  const isDirty = useMemo(() => {
    if (!editing) return true;
    if (!fullEditingData) return true;

    const currentData = {
      code: form.code,
      type: form.type,
      name: form.name,
      description: form.description || '',
      perUserLimit: form.perUserLimit || 1,
      usageLimitType: form.usageLimitType || 'USER',
      maxTotalUses: form.maxTotalUses ?? null,
      startsAt: form.startsAt ? form.startsAt.toISOString() : null,
      expiresAt: form.expiresAt ? form.expiresAt.toISOString() : null,
      status: form.status,
      rewardMode,
      rewardData: rewardMode === 'direct' ? form.rewardData : null,
      rewardTemplateId:
        rewardMode === 'template' ? form.rewardTemplateId : null,
      rewardEmailTitle: form.rewardEmailTitle || '',
      rewardEmailBody: form.rewardEmailBody || '',
      targetPlatforms: [...(form.targetPlatforms || [])].sort(),
      targetPlatformsInverted: !!form.targetPlatformsInverted,
      targetChannelSubchannels: [...(form.targetChannelSubchannels || [])]
        .map((item) => ({
          channel: item.channel,
          subchannels: [...(item.subchannels || [])].sort(),
        }))
        .sort((a, b) => a.channel.localeCompare(b.channel)),
      targetChannelSubchannelsInverted: !!form.targetChannelSubchannelsInverted,
      targetWorlds: [...(form.targetWorlds || [])].sort(),
      targetWorldsInverted: !!form.targetWorldsInverted,
      targetUserIds: (form.targetUserIds || '')
        .split(',')
        .map((id: string) => id.trim())
        .filter((id: string) => id)
        .sort()
        .join(','),
      targetUserIdsInverted: !!form.targetUserIdsInverted,
      tags: (form.tags || []).map((t: any) => t.id).sort(),
    };

    const originalData = {
      code: fullEditingData.code || '',
      type: fullEditingData.type,
      name: fullEditingData.name,
      description: fullEditingData.description || '',
      perUserLimit: fullEditingData.perUserLimit || 1,
      usageLimitType: fullEditingData.usageLimitType || 'USER',
      maxTotalUses: fullEditingData.maxTotalUses ?? null,
      startsAt: fullEditingData.startsAt
        ? parseUTCForPicker(fullEditingData.startsAt)?.toISOString()
        : null,
      expiresAt: parseUTCForPicker(fullEditingData.expiresAt)?.toISOString(),
      status: fullEditingData.status,
      rewardMode: fullEditingData.rewardTemplateId ? 'template' : 'direct',
      rewardData: fullEditingData.rewardTemplateId
        ? null
        : fullEditingData.rewardData || [],
      rewardTemplateId: fullEditingData.rewardTemplateId || null,
      rewardEmailTitle: fullEditingData.rewardEmailTitle || '',
      rewardEmailBody: fullEditingData.rewardEmailBody || '',
      targetPlatforms: [...(fullEditingData.targetPlatforms || [])].sort(),
      targetPlatformsInverted: !!fullEditingData.targetPlatformsInverted,
      targetChannelSubchannels: (() => {
        const targetChannels = fullEditingData.targetChannels || [];
        const targetSubchannels = fullEditingData.targetSubchannels || [];
        const subchannelsByChannel: { [key: string]: string[] } = {};
        targetSubchannels.forEach((subchannelKey: string) => {
          const [channel, subchannel] = subchannelKey.split(':');
          if (channel && subchannel) {
            if (!subchannelsByChannel[channel])
              subchannelsByChannel[channel] = [];
            subchannelsByChannel[channel].push(subchannel);
          }
        });
        return targetChannels
          .map((channel: string) => ({
            channel,
            subchannels: [...(subchannelsByChannel[channel] || [])].sort(),
          }))
          .sort((a: any, b: any) => a.channel.localeCompare(b.channel));
      })(),
      targetChannelSubchannelsInverted:
        !!fullEditingData.targetChannelsInverted,
      targetWorlds: [...(fullEditingData.targetWorlds || [])].sort(),
      targetWorldsInverted: !!fullEditingData.targetWorldsInverted,
      targetUserIds: (fullEditingData.targetUsers || [])
        .map((id: string) => String(id).trim())
        .filter((id: string) => id)
        .sort()
        .join(','),
      targetUserIdsInverted: !!fullEditingData.targetUserIdsInverted,
      tags: ((fullEditingData as any).tags || []).map((t: any) => t.id).sort(),
    };

    return JSON.stringify(currentData) !== JSON.stringify(originalData);
  }, [editing, fullEditingData, form, rewardMode]);

  // Check if required fields are filled
  const isFormValid = useMemo(() => {
    return (
      !!form.name?.trim() &&
      !!form.expiresAt &&
      !!form.rewardEmailTitle?.trim() &&
      !!form.rewardEmailBody?.trim()
    );
  }, [form.name, form.expiresAt, form.rewardEmailTitle, form.rewardEmailBody]);

  // Ref for channel table container
  const channelTableRef = useRef<HTMLDivElement>(null);
  const platformTableRef = useRef<HTMLDivElement>(null);
  const worldTableRef = useRef<HTMLDivElement>(null);

  // Memoize code pattern example to prevent unnecessary re-generation
  const codePatternExample = useMemo(() => {
    return generateExampleCouponCode(
      (form.codePattern || 'ALPHANUMERIC_8') as CodePattern
    );
  }, [form.codePattern]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        channelTableRef.current &&
        !channelTableRef.current.contains(event.target as Node)
      ) {
        setForm((s: any) => ({
          ...s,
          _showChannelTable: false,
        }));
      }
      if (
        platformTableRef.current &&
        !platformTableRef.current.contains(event.target as Node)
      ) {
        setForm((s: any) => ({
          ...s,
          _showPlatformTable: false,
        }));
      }
      if (
        worldTableRef.current &&
        !worldTableRef.current.contains(event.target as Node)
      ) {
        setForm((s: any) => ({
          ...s,
          _showWorldTable: false,
        }));
      }
    };

    if (
      form._showChannelTable ||
      form._showPlatformTable ||
      form._showWorldTable
    ) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [form._showChannelTable, form._showPlatformTable, form._showWorldTable]);

  const resetForm = () => {
    setEditing(null);
    setFullEditingData(null);
    setForm({
      code: '',
      type: 'NORMAL',
      name: '',
      description: '',
      quantity: 1,
      perUserLimit: 1,
      usageLimitType: 'USER',
      maxTotalUses: null,
      startsAt: null,
      expiresAt: null,
      status: 'ACTIVE',
      rewardData: [],
      rewardTemplateId: null,
      rewardEmailTitle: '',
      rewardEmailBody: '',
      targetPlatforms: [],
      targetChannelSubchannels: [],
      targetWorlds: [],
      targetUserIds: '',
      tags: [],
    });
    setRewardMode('direct');
    setIsDescriptionManuallyEdited(false);
  };

  const availableFilterDefinitions: FilterDefinition[] = [
    {
      key: 'type',
      label: t('common.type'),
      type: 'select',
      options: [
        { value: 'SPECIAL', label: 'SPECIAL' },
        { value: 'NORMAL', label: 'NORMAL' },
      ],
    },
    {
      key: 'status',
      label: t('common.status'),
      type: 'select',
      options: [
        { value: 'ACTIVE', label: t('common.active') },
        { value: 'DISABLED', label: t('common.disabled') },
        { value: 'DELETED', label: t('status.deleted') },
      ],
    },
  ];

  // Column settings (visible columns with localStorage persistence)
  const defaultColumns: ColumnConfig[] = [
    { id: 'name', labelKey: 'common.name', visible: true },
    {
      id: 'code',
      labelKey: 'coupons.couponSettings.columns.code',
      visible: true,
    },
    { id: 'type', labelKey: 'common.type', visible: true },
    { id: 'status', labelKey: 'common.status', visible: true },
    { id: 'rewards', labelKey: 'surveys.participationRewards', visible: true },
    {
      id: 'usageRate',
      labelKey: 'coupons.couponSettings.columns.usageRate',
      visible: true,
    },
    { id: 'start', labelKey: 'common.start', visible: true },
    { id: 'end', labelKey: 'common.end', visible: true },
    { id: 'createdAt', labelKey: 'common.createdAt', visible: true },
    { id: 'description', labelKey: 'common.description', visible: true },
    { id: 'tags', labelKey: 'common.tags', visible: true },
  ];

  const [columnSettingsAnchor, setColumnSettingsAnchor] =
    useState<HTMLElement | null>(null);

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem('couponSettingsColumns');
    if (saved) {
      try {
        const savedColumns = JSON.parse(saved);
        const mergedColumns = savedColumns.map((savedCol: ColumnConfig) => {
          const defaultCol = defaultColumns.find((c) => c.id === savedCol.id);
          return defaultCol ? { ...defaultCol, ...savedCol } : savedCol;
        });
        const savedIds = new Set(savedColumns.map((c: ColumnConfig) => c.id));
        const newColumns = defaultColumns.filter((c) => !savedIds.has(c.id));
        return [...mergedColumns, ...newColumns];
      } catch (e) {
        return defaultColumns;
      }
    }
    return defaultColumns;
  });

  const visibleColumns = useMemo(
    () => columns.filter((col) => col.visible),
    [columns]
  );

  // Sorting state with localStorage persistence
  const [orderBy, setOrderBy] = useState<string>(() => {
    const saved = localStorage.getItem('couponSettingsSortBy');
    return saved || 'createdAt';
  });
  const [order, setOrder] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('couponSettingsSortOrder');
    return (saved as 'asc' | 'desc') || 'desc';
  });

  const handleSort = (colId: string) => {
    let newOrder: 'asc' | 'desc' = 'asc';
    if (orderBy === colId) {
      newOrder = order === 'asc' ? 'desc' : 'asc';
    }
    setOrderBy(colId);
    setOrder(newOrder);
    localStorage.setItem('couponSettingsSortBy', colId);
    localStorage.setItem('couponSettingsSortOrder', newOrder);
  };

  const sortedItems = useMemo(() => {
    const getVal = (it: CouponSetting) => {
      switch (orderBy) {
        case 'name':
          return (it.name || '').toLowerCase();
        case 'type':
          return it.type || '';
        case 'status':
          return it.status || '';
        case 'start':
          return it.startsAt || '';
        case 'end':
          return it.expiresAt || '';
        case 'description':
          return ((it as any).description || '').toLowerCase();
        case 'usageRate': {
          // Calculate usage rate percentage for sorting
          if (it.type === 'SPECIAL') {
            return it.maxTotalUses
              ? ((it.usedCount || 0) / it.maxTotalUses) * 100
              : 0;
          } else {
            const totalIssued = it.generatedCount || it.issuedCount || 0;
            return totalIssued > 0
              ? ((it.usedCount || 0) / totalIssued) * 100
              : 0;
          }
        }
        default:
          return '';
      }
    };
    const arr = [...items];
    arr.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (av < bv) return order === 'asc' ? -1 : 1;
      if (av > bv) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [items, orderBy, order]);
  const isSpecial = form.type === 'SPECIAL';
  const codeError =
    isSpecial &&
    (!form.code ||
      String(form.code).trim().length < 4 ||
      !/^[A-Z0-9]+$/.test(String(form.code).trim()));

  const getCodeErrorMessage = () => {
    if (!form.code || String(form.code).trim().length < 4) {
      return t('coupons.couponSettings.form.codeMinError');
    }
    if (!/^[A-Z0-9]+$/.test(String(form.code).trim())) {
      return t('coupons.couponSettings.form.codeFormatError');
    }
    return t('coupons.couponSettings.form.codeHelp');
  };

  const quantityError =
    form.type === 'NORMAL' &&
    form.quantity !== '' &&
    (form.quantity == null || Number(form.quantity) < 1);
  const maxTotalUsesError =
    isSpecial &&
    form.maxTotalUses !== null &&
    form.maxTotalUses !== '' &&
    Number(form.maxTotalUses) < 1;
  const perUserLimitError =
    form.type === 'NORMAL' &&
    form.perUserLimit !== '' &&
    (form.perUserLimit == null || Number(form.perUserLimit) < 1);

  const handleColumnsChange = (newColumns: ColumnConfig[]) => {
    setColumns(newColumns);
    localStorage.setItem('couponSettingsColumns', JSON.stringify(newColumns));
  };

  const handleResetColumns = () => {
    setColumns(defaultColumns);
    localStorage.setItem(
      'couponSettingsColumns',
      JSON.stringify(defaultColumns)
    );
  };

  const handleFilterAdd = (filter: ActiveFilter) => {
    const newFilters = [...activeFilters, filter];
    setActiveFilters(newFilters);
    localStorage.setItem('couponSettingsFilters', JSON.stringify(newFilters));
    setPage(0);
  };

  const handleFilterRemove = (filterKey: string) => {
    const newFilters = activeFilters.filter((f) => f.key !== filterKey);
    setActiveFilters(newFilters);
    localStorage.setItem('couponSettingsFilters', JSON.stringify(newFilters));
    setPage(0);
  };

  const handleDynamicFilterChange = (filterKey: string, value: any) => {
    const newFilters = activeFilters.map((f) =>
      f.key === filterKey ? { ...f, value } : f
    );
    setActiveFilters(newFilters);
    localStorage.setItem('couponSettingsFilters', JSON.stringify(newFilters));
    setPage(0);
  };

  const colCount = visibleColumns.length + (canManage ? 2 : 0); // +1 for actions, +1 for selection checkbox (only when canManage)

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(sortedItems.map((it) => it.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  };

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const res = await couponService.listSettings(projectApiPath, {
          page: page + 1,
          limit: rowsPerPage,
          search: debouncedSearchTerm || undefined,
          type: typeFilter || undefined,
          status: statusFilter || undefined,
        });
        setItems(res.settings || []);
        setTotal(res.total || 0);
      } finally {
        setLoading(false);
      }
    },
    [
      page,
      rowsPerPage,
      debouncedSearchTerm,
      typeFilterString,
      statusFilterString,
    ]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh for items with IN_PROGRESS generation status (partial update only)
  useEffect(() => {
    const inProgressItems = items.filter(
      (it) =>
        it.generationStatus === 'IN_PROGRESS' ||
        it.generationStatus === 'PENDING'
    );
    if (inProgressItems.length === 0) return;

    const interval = setInterval(async () => {
      try {
        // Fetch only the in-progress items to update their progress
        const updatedItems = await Promise.all(
          inProgressItems.map(async (it) => {
            const res = await couponService.getSetting(projectApiPath, it.id);
            return res.setting;
          })
        );

        // Update only the changed items in the list
        setItems((prevItems) =>
          prevItems.map((item) => {
            const updated = updatedItems.find((u) => u.id === item.id);
            return updated ? { ...item, ...updated } : item;
          })
        );
      } catch (error) {
        console.error('Failed to update progress', error);
      }
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [items]);

  const loadCodes = useCallback(async () => {
    if (!codesSetting) return;
    const requestId = ++codesRequestIdRef.current;
    setCodesLoading(true);
    try {
      const res = await couponService.getIssuedCodes(
        projectApiPath,
        codesSetting.id,
        {
          page: codesPage + 1,
          limit: codesRowsPerPage,
          search: debouncedCodesSearch || undefined,
          status: codesStatusFilter === 'ALL' ? undefined : codesStatusFilter,
          sortBy: codesOrderBy,
          sortOrder: codesOrder,
        }
      );
      // Discard stale response: a newer request has been issued
      if (requestId !== codesRequestIdRef.current) return;
      const data: any = (res as any).data ? (res as any).data : res;
      setCodesItems(data.codes || []);
      setCodesTotal(data.total || 0);
    } finally {
      if (requestId === codesRequestIdRef.current) {
        setCodesLoading(false);
      }
    }
  }, [
    codesSetting,
    codesPage,
    codesRowsPerPage,
    debouncedCodesSearch,
    codesStatusFilter,
    codesOrderBy,
    codesOrder,
  ]);

  // Load stats only once when drawer opens, not on every page change
  const loadCodesStats = useCallback(async () => {
    if (!codesSetting) return;
    setCodesStatsLoading(true);
    try {
      const stats = await couponService.getIssuedCodesStats(
        projectApiPath,
        codesSetting.id
      );
      setCodesStats(stats);
    } catch (error) {
      console.error('[loadCodesStats] Failed to load codes stats', error);
      setCodesStats({ issued: 0, used: 0, unused: 0 });
    } finally {
      setCodesStatsLoading(false);
    }
  }, [codesSetting]);

  // Load stats only when drawer opens (not on filter/page changes)
  useEffect(() => {
    if (openCodes && codesSetting) {
      loadCodesStats();
    }
  }, [openCodes, codesSetting, loadCodesStats]);

  // Load codes when drawer opens, or pagination/search/filter changes
  useEffect(() => {
    if (openCodes && codesSetting) {
      loadCodes();
    }
  }, [openCodes, codesSetting, loadCodes]);

  const handleSave = async (skipCr: boolean = false) => {
    // Basic validation
    if (!form.name) {
      enqueueSnackbar(t('coupons.couponSettings.form.nameRequired'), {
        variant: 'error',
      });
      return;
    }
    if (!form.expiresAt) {
      enqueueSnackbar(t('coupons.couponSettings.form.expiresAtRequired'), {
        variant: 'error',
      });
      return;
    }
    if (codeError || quantityError || maxTotalUsesError || perUserLimitError) {
      enqueueSnackbar(t('common.fixValidationErrors'), { variant: 'error' });
      return;
    }

    // Validate reward email fields
    if (!form.rewardEmailTitle || form.rewardEmailTitle.trim() === '') {
      enqueueSnackbar(
        t('coupons.couponSettings.form.rewardEmailTitleRequired'),
        {
          variant: 'error',
        }
      );
      return;
    }
    if (!form.rewardEmailBody || form.rewardEmailBody.trim() === '') {
      enqueueSnackbar(
        t('coupons.couponSettings.form.rewardEmailBodyRequired'),
        {
          variant: 'error',
        }
      );
      return;
    }

    // Validate that either rewardData or rewardTemplateId is provided
    if (
      rewardMode === 'direct' &&
      (!form.rewardData || form.rewardData.length === 0)
    ) {
      enqueueSnackbar(t('surveys.atLeastOneReward'), { variant: 'error' });
      return;
    }
    if (rewardMode === 'template' && !form.rewardTemplateId) {
      enqueueSnackbar(t('rewardSelector.selectTemplate'), { variant: 'error' });
      return;
    }

    // Convert targetChannelSubchannels to targetChannels and targetSubchannels for coupon API
    // targetSubchannels format: "channel:subchannel" (e.g., "official:global", "official:asia")
    const targetChannels: string[] = [];
    const targetSubchannels: string[] = [];
    if (
      form.targetChannelSubchannels &&
      form.targetChannelSubchannels.length > 0
    ) {
      form.targetChannelSubchannels.forEach((item: any) => {
        if (!targetChannels.includes(item.channel)) {
          targetChannels.push(item.channel);
        }
        item.subchannels.forEach((subchannel: string) => {
          // Format: "channel:subchannel"
          const subchannelKey = `${item.channel}:${subchannel}`;
          if (!targetSubchannels.includes(subchannelKey)) {
            targetSubchannels.push(subchannelKey);
          }
        });
      });
    }

    // Parse targetUserIds from string to array
    const targetUsers: string[] = [];
    if (form.targetUserIds && typeof form.targetUserIds === 'string') {
      const userIds = form.targetUserIds
        .split(',')
        .map((id: string) => id.trim())
        .filter((id: string) => id);
      targetUsers.push(...userIds);
    }

    const payload: any = {
      ...form,
      startsAt: form.startsAt
        ? (form.startsAt as Dayjs).toDate().toISOString()
        : null,
      expiresAt: (form.expiresAt as Dayjs).toDate().toISOString(),
      rewardData: rewardMode === 'direct' ? form.rewardData : null,
      rewardTemplateId:
        rewardMode === 'template' ? form.rewardTemplateId : null,
      // Remove targetChannelSubchannels and use targetChannels/targetSubchannels instead
      targetChannels: targetChannels.length > 0 ? targetChannels : null,
      targetSubchannels:
        targetSubchannels.length > 0 ? targetSubchannels : null,
      targetUsers: targetUsers.length > 0 ? targetUsers : null,
    };
    delete payload.targetChannelSubchannels;
    delete payload.targetChannelSubchannelsInverted;
    delete payload.targetUserIds;

    // Debug: log payload to inspect server-side validation issues
    console.log('[CouponSettings] create/update payload', {
      editing: !!editing,
      payload,
    });

    if (payload.type === 'SPECIAL') {
      // SPECIAL: per-user limit forced to 1
      payload.perUserLimit = 1;
    } else if (payload.type === 'NORMAL') {
      // NORMAL: backend autogenerates code; ignore maxTotalUses
      payload.code = null;
      payload.maxTotalUses = null;
      payload.quantity = form.quantity || 1;
      // Ensure numeric and >= 1
      payload.perUserLimit = Math.max(1, Number(form.perUserLimit ?? 1));
    }

    if (payload.maxTotalUses === '') payload.maxTotalUses = null;

    // quantity only for create
    if (editing) {
      delete payload.quantity;
      // For update, don't send startsAt if it's null (it's optional for updates)
      if (payload.startsAt === null) {
        delete payload.startsAt;
      }
    }

    try {
      if (editing) {
        const result = await couponService.updateSetting(
          projectApiPath,
          editing.id,
          payload,
          skipCr
        );
        setOpenForm(false);
        resetForm();
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate
          );
        } else {
          enqueueSnackbar(t('common.saveSuccess') as string, {
            variant: 'success',
          });
        }
        await load();
      } else {
        // For create: close form immediately and load in background
        const result = await couponService.createSetting(
          projectApiPath,
          payload,
          skipCr
        );
        setOpenForm(false);
        resetForm();

        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate
          );
        } else {
          // Show success message
          const isLargeQuantity =
            payload.type === 'NORMAL' && (payload.quantity || 1) >= 10000;
          if (isLargeQuantity) {
            enqueueSnackbar(
              t('coupons.couponSettings.generatingInBackground') as string,
              {
                variant: 'info',
              }
            );
          } else {
            enqueueSnackbar(t('common.saveSuccess') as string, {
              variant: 'success',
            });
          }
        }

        // Load list in background (don't await)
        load();
      }
    } catch (e) {
      const err: any = e;
      const errorMessage =
        err?.response?.data?.error?.message ||
        err?.message ||
        t('common.saveFailed');
      console.error(
        '[CouponSettings] save failed',
        err?.response?.status,
        err?.response?.data || err?.message || err
      );
      enqueueSnackbar(parseApiErrorMessage(err, 'common.saveFailed'), {
        variant: 'error',
      });
    }
  };

  const handleEdit = async (it: CouponSetting) => {
    setEditing(it);

    try {
      // Fetch full coupon setting with targeting data
      const res = await couponService.getSetting(projectApiPath, it.id);
      const fullSetting = res.setting;

      console.log(
        '[CouponSettings] handleEdit - fetched full setting',
        fullSetting
      );

      // Set reward mode and data based on rewardTemplateId
      if (fullSetting.rewardTemplateId) {
        setRewardMode('template');
      } else {
        setRewardMode('direct');
      }

      // Convert targetChannels and targetSubchannels to targetChannelSubchannels format
      // targetSubchannels format: "channel:subchannel" (e.g., "official:global", "official:asia")
      const targetChannelSubchannels: ChannelSubchannelData[] = [];
      const targetChannels = (fullSetting as any).targetChannels || [];
      const targetSubchannels = (fullSetting as any).targetSubchannels || [];

      console.log('[CouponSettings] handleEdit - raw data', {
        targetChannels,
        targetSubchannels,
      });

      // Parse targetSubchannels from "channel:subchannel" format
      const subchannelsByChannel: { [key: string]: string[] } = {};
      targetSubchannels.forEach((subchannelKey: string) => {
        const [channel, subchannel] = subchannelKey.split(':');
        if (channel && subchannel) {
          if (!subchannelsByChannel[channel]) {
            subchannelsByChannel[channel] = [];
          }
          subchannelsByChannel[channel].push(subchannel);
        }
      });

      // Build targetChannelSubchannels array
      if (targetChannels.length > 0) {
        targetChannels.forEach((channel: string) => {
          targetChannelSubchannels.push({
            channel,
            subchannels: subchannelsByChannel[channel] || [],
          });
        });
      }

      console.log(
        '[CouponSettings] handleEdit - converted targetChannelSubchannels',
        targetChannelSubchannels
      );

      const newForm = {
        code: fullSetting.code || '',
        type: fullSetting.type,
        name: (fullSetting as any).name,
        description: (fullSetting as any).description || '',
        quantity: 1,
        perUserLimit: fullSetting.perUserLimit || 1,
        usageLimitType: fullSetting.usageLimitType || 'USER',
        maxTotalUses: fullSetting.maxTotalUses ?? null,
        startsAt: parseUTCForPicker(fullSetting.startsAt),
        expiresAt: parseUTCForPicker(fullSetting.expiresAt),
        status: fullSetting.status,
        rewardData: fullSetting.rewardData || [],
        rewardTemplateId: fullSetting.rewardTemplateId || null,
        rewardEmailTitle: fullSetting.rewardEmailTitle || '',
        rewardEmailBody: fullSetting.rewardEmailBody || '',
        targetPlatforms: (fullSetting as any).targetPlatforms || [],
        targetPlatformsInverted:
          (fullSetting as any).targetPlatformsInverted || false,
        targetChannelSubchannels,
        targetChannelSubchannelsInverted:
          (fullSetting as any).targetChannelsInverted || false,
        targetWorlds: (fullSetting as any).targetWorlds || [],
        targetWorldsInverted:
          (fullSetting as any).targetWorldsInverted || false,
        targetUserIds: ((fullSetting as any).targetUsers || []).join(', '),
        targetUserIdsInverted:
          (fullSetting as any).targetUserIdsInverted || false,
        tags: (fullSetting as any).tags || [],
      };

      console.log('[CouponSettings] handleEdit - final form state', newForm);

      setFullEditingData(fullSetting);
      setForm(newForm);
      // When editing, mark description as manually edited (since it already has a value)
      setIsDescriptionManuallyEdited(true);
      // Open form after state is set
      setOpenForm(true);
    } catch (error) {
      console.error('[CouponSettings] handleEdit error:', error);
      enqueueSnackbar(parseApiErrorMessage(error, 'common.error'), {
        variant: 'error',
      });
    }
  };

  const handleDeleteClick = (setting: CouponSetting) => {
    setDeleteTarget(setting);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      await couponService.deleteSetting(projectApiPath, deleteTarget.id);
      enqueueSnackbar(t('coupons.couponSettings.deleteSuccess'), {
        variant: 'success',
      });
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      await load();
    } catch (error: any) {
      enqueueSnackbar(parseApiErrorMessage(error, 'common.error'), {
        variant: 'error',
      });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  return (
    <>
      {/* Search & Filters + Actions */}
      <Box sx={{ mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'nowrap',
            justifyContent: 'space-between',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              flexWrap: 'nowrap',
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            <SearchTextField
              placeholder={t('common.search') || ''}
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                setPage(0);
              }}
            />

            <DynamicFilterBar
              availableFilters={availableFilterDefinitions}
              activeFilters={activeFilters}
              onFilterAdd={handleFilterAdd}
              onFilterRemove={handleFilterRemove}
              onFilterChange={handleDynamicFilterChange}
              noWrap={true}
              afterFilterAddActions={
                <Tooltip title={t('common.columnSettings')}>
                  <IconButton
                    onClick={(e) => setColumnSettingsAnchor(e.currentTarget)}
                    sx={{
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ViewColumnIcon />
                  </IconButton>
                </Tooltip>
              }
            />
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flexShrink: 0,
            }}
          >
            {canManage && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  resetForm();
                  setOpenForm(true);
                }}
                sx={{ whiteSpace: 'nowrap' }}
              >
                {t('coupons.couponSettings.createCoupon')}
              </Button>
            )}
            <IconButton
              onClick={(e) => setPageMenuAnchor(e.currentTarget)}
              aria-label="more options"
              sx={{
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={pageMenuAnchor}
              open={Boolean(pageMenuAnchor)}
              onClose={() => setPageMenuAnchor(null)}
            >
              <ExportImportMenuItems
                onExport={(format) => {
                  setPageMenuAnchor(null);
                  const exportColumns: ExportColumn[] = [
                    { key: 'name', header: t('common.name') },
                    {
                      key: 'code',
                      header: t('coupons.couponSettings.columns.code'),
                    },
                    { key: 'type', header: t('common.type') },
                    { key: 'status', header: t('common.status') },
                    { key: 'description', header: t('common.description') },
                    { key: 'startsAt', header: t('common.start') },
                    { key: 'expiresAt', header: t('common.end') },
                    { key: 'createdAt', header: t('common.createdAt') },
                  ];
                  try {
                    exportToFile(
                      sortedItems,
                      exportColumns,
                      'coupon-definitions',
                      format
                    );
                    enqueueSnackbar(t('common.exportSuccess'), {
                      variant: 'success',
                    });
                  } catch (err) {
                    enqueueSnackbar(t('common.exportFailed'), {
                      variant: 'error',
                    });
                  }
                }}
                onImportClick={() => {
                  setPageMenuAnchor(null);
                  setImportDialogOpen(true);
                }}
              />
              <Divider />
              <MenuItem
                onClick={() => {
                  setPageMenuAnchor(null);
                  load();
                }}
                disabled={loading}
              >
                <ListItemIcon>
                  <RefreshIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{t('common.refresh')}</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </Box>

      {selectedIds.length > 0 && (
        <Typography variant="body2" sx={{ px: 2, pb: 1 }}>
          {t('common.selectedCount', { count: selectedIds.length })}
        </Typography>
      )}

      {/* List */}
      <PageContentLoader loading={loading}>
        {items.length === 0 ? (
          <EmptyPagePlaceholder
            message={t('coupons.couponSettings.noCoupons')}
            subtitle={canManage ? t('common.addFirstItem') : undefined}
            onAddClick={
              canManage
                ? () => {
                    resetForm();
                    setOpenForm(true);
                  }
                : undefined
            }
            addButtonLabel={t('coupons.couponSettings.addCoupon')}
          />
        ) : (
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ height: 48 }}>
                      {canManage && (
                        <TableCell padding="checkbox" sx={{ width: 48 }}>
                          <Checkbox
                            indeterminate={
                              sortedItems.some((it) =>
                                selectedIds.includes(it.id)
                              ) &&
                              !sortedItems.every((it) =>
                                selectedIds.includes(it.id)
                              )
                            }
                            checked={
                              sortedItems.length > 0 &&
                              sortedItems.every((it) =>
                                selectedIds.includes(it.id)
                              )
                            }
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </TableCell>
                      )}
                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.id}
                          sortDirection={
                            orderBy === col.id ? order : (false as any)
                          }
                          sx={{ py: 1, px: 2 }}
                          align={
                            ['type', 'status', 'usageRate'].includes(col.id)
                              ? 'center'
                              : 'left'
                          }
                        >
                          <TableSortLabel
                            active={orderBy === col.id}
                            direction={orderBy === col.id ? order : 'asc'}
                            onClick={() => handleSort(col.id)}
                          >
                            {t(col.labelKey)}
                          </TableSortLabel>
                        </TableCell>
                      ))}
                      {canManage && (
                        <TableCell align="center" sx={{ py: 1, px: 2 }}>
                          {t('common.actions')}
                        </TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedItems.map((it) => (
                      <TableRow key={it.id} hover sx={{ height: 48 }}>
                        {canManage && (
                          <TableCell padding="checkbox" sx={{ py: 1, px: 2 }}>
                            <Checkbox
                              checked={selectedIds.includes(it.id)}
                              onChange={(e) =>
                                handleSelectOne(it.id, e.target.checked)
                              }
                            />
                          </TableCell>
                        )}
                        {visibleColumns.map((col) => {
                          switch (col.id) {
                            case 'name':
                              return (
                                <TableCell key="name" sx={{ py: 1, px: 2 }}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 0.5,
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        cursor: 'pointer',
                                        '&:hover': {
                                          color: 'primary.main',
                                          textDecoration: 'underline',
                                        },
                                      }}
                                      onClick={() => handleEdit(it)}
                                    >
                                      {it.name}
                                    </Typography>
                                    <Tooltip
                                      title={t(
                                        'coupons.couponSettings.copyName'
                                      )}
                                    >
                                      <IconButton
                                        size="small"
                                        onClick={() => handleCopyName(it.name)}
                                      >
                                        <ContentCopyIcon
                                          sx={{ fontSize: 13 }}
                                        />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>
                                </TableCell>
                              );
                            case 'code':
                              return (
                                <TableCell key="code" sx={{ py: 1, px: 2 }}>
                                  {it.type === 'SPECIAL' ? (
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                      }}
                                    >
                                      <Tooltip
                                        title={t(
                                          'coupons.couponSettings.viewUsedCodes',
                                          '사용된 코드 수 보기'
                                        )}
                                      >
                                        <Chip
                                          size="small"
                                          variant="outlined"
                                          label={`${it.code || '-'}: ${(it.usedCount || 0).toLocaleString()}`}
                                          onClick={() => handleOpenCodes(it)}
                                          sx={{
                                            cursor: 'pointer',
                                            '&:hover': {
                                              bgcolor: 'action.hover',
                                              borderColor: 'primary.main',
                                            },
                                          }}
                                        />
                                      </Tooltip>
                                      {it.code && (
                                        <Tooltip
                                          title={t(
                                            'coupons.couponSettings.copyCode'
                                          )}
                                        >
                                          <IconButton
                                            size="small"
                                            onClick={() =>
                                              handleCopyCode(it.code!)
                                            }
                                          >
                                            <ContentCopyIcon
                                              sx={{ fontSize: 13 }}
                                            />
                                          </IconButton>
                                        </Tooltip>
                                      )}
                                    </Box>
                                  ) : (
                                    <Box>
                                      {it.generationStatus === 'IN_PROGRESS' ||
                                      it.generationStatus === 'PENDING' ? (
                                        <Box
                                          sx={{ width: '100%', minWidth: 200 }}
                                        >
                                          <Box
                                            sx={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 1,
                                            }}
                                          >
                                            <HourglassEmptyIcon
                                              fontSize="small"
                                              sx={{
                                                animation:
                                                  'spin 1s linear infinite',
                                                '@keyframes spin': {
                                                  '0%': {
                                                    transform: 'rotate(0deg)',
                                                  },
                                                  '100%': {
                                                    transform: 'rotate(360deg)',
                                                  },
                                                },
                                                flexShrink: 0,
                                                color: 'primary.main',
                                              }}
                                            />
                                            <Box
                                              sx={{
                                                position: 'relative',
                                                flex: 1,
                                                minWidth: 220,
                                              }}
                                            >
                                              <LinearProgress
                                                variant="determinate"
                                                value={
                                                  it.totalCount
                                                    ? Math.round(
                                                        ((it.generatedCount ||
                                                          0) /
                                                          it.totalCount) *
                                                          100
                                                      )
                                                    : 0
                                                }
                                                sx={{
                                                  height: 28,
                                                  borderRadius: 1,
                                                  backgroundColor:
                                                    'action.hover',
                                                  border: '1px dashed',
                                                  borderColor: 'divider',
                                                  '& .MuiLinearProgress-bar': {
                                                    backgroundColor:
                                                      'primary.main',
                                                  },
                                                }}
                                              />
                                              <Typography
                                                variant="caption"
                                                sx={{
                                                  position: 'absolute',
                                                  top: '50%',
                                                  left: '50%',
                                                  transform:
                                                    'translate(-50%, -50%)',
                                                  fontSize: '0.75rem',
                                                  color: 'text.primary',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {t(
                                                  'coupons.couponSettings.generatingCodes'
                                                )}{' '}
                                                (
                                                {(
                                                  it.generatedCount || 0
                                                ).toLocaleString()}{' '}
                                                /{' '}
                                                {(
                                                  it.totalCount || 0
                                                ).toLocaleString()}
                                                )
                                              </Typography>
                                            </Box>
                                          </Box>
                                        </Box>
                                      ) : (
                                        <Tooltip
                                          title={t(
                                            'coupons.couponSettings.viewIssuedCodes'
                                          )}
                                        >
                                          <Chip
                                            size="small"
                                            variant="outlined"
                                            label={`${t('coupons.couponSettings.issuedCount')}: ${(it.generatedCount || it.issuedCount || 0).toLocaleString()}`}
                                            onClick={() => handleOpenCodes(it)}
                                            sx={{
                                              cursor: 'pointer',
                                              '&:hover': {
                                                bgcolor: 'action.hover',
                                                borderColor: 'primary.main',
                                              },
                                            }}
                                          />
                                        </Tooltip>
                                      )}
                                    </Box>
                                  )}
                                </TableCell>
                              );
                            case 'type':
                              return (
                                <TableCell
                                  key="type"
                                  align="center"
                                  sx={{ py: 1, px: 2 }}
                                >
                                  <Chip
                                    size="small"
                                    label={it.type}
                                    color={
                                      it.type === 'SPECIAL' ? 'primary' : 'info'
                                    }
                                    variant="filled"
                                  />
                                </TableCell>
                              );
                            case 'status': {
                              // Display status based on actual database status and disabled reason
                              let displayLabel =
                                it.status === 'ACTIVE'
                                  ? t('common.active')
                                  : it.status === 'DISABLED'
                                    ? t('common.disabled')
                                    : t('status.deleted');
                              let displayColor:
                                | 'success'
                                | 'default'
                                | 'warning'
                                | 'error' =
                                it.status === 'ACTIVE'
                                  ? 'success'
                                  : it.status === 'DISABLED'
                                    ? 'default'
                                    : 'warning';

                              // If disabled, check the reason
                              if (it.status === 'DISABLED') {
                                if (
                                  it.disabledReason ===
                                  'All coupons have been used'
                                ) {
                                  displayLabel = t(
                                    'coupons.couponSettings.allUsed'
                                  );
                                  displayColor = 'error';
                                } else if (
                                  it.disabledReason === 'Expired by scheduler'
                                ) {
                                  displayLabel = t(
                                    'coupons.couponSettings.expired'
                                  );
                                  displayColor = 'warning';
                                }
                              }

                              return (
                                <TableCell
                                  key="status"
                                  align="center"
                                  sx={{ py: 1, px: 2 }}
                                >
                                  <Chip
                                    size="small"
                                    color={displayColor}
                                    label={displayLabel}
                                  />
                                </TableCell>
                              );
                            }
                            case 'usageRate': {
                              let numerator = it.usedCount || 0;
                              let denominator: number | string;
                              let percentage: number = 0;
                              let tooltipText = '';
                              let isUnlimitedSpecial = false;

                              if (it.type === 'SPECIAL') {
                                denominator =
                                  it.maxTotalUses ??
                                  t('coupons.couponSettings.form.unlimited');
                                if (it.maxTotalUses && it.maxTotalUses > 0) {
                                  percentage = Math.round(
                                    (numerator / it.maxTotalUses) * 100
                                  );
                                  tooltipText = `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`;
                                } else {
                                  isUnlimitedSpecial = true;
                                  tooltipText = `${numerator.toLocaleString()} / ${denominator}`;
                                }
                              } else {
                                const totalIssued =
                                  it.generatedCount || it.issuedCount || 0;
                                denominator = totalIssued;
                                if (totalIssued > 0) {
                                  percentage = Math.round(
                                    (numerator / totalIssued) * 100
                                  );
                                }
                                tooltipText = `${numerator.toLocaleString()} / ${denominator.toLocaleString()}`;
                              }

                              if (isUnlimitedSpecial) {
                                return (
                                  <TableCell
                                    key="usageRate"
                                    align="center"
                                    sx={{ py: 1, px: 2 }}
                                  >
                                    <Tooltip title={tooltipText}>
                                      <Box
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setCodesSetting(it);
                                          setCodesStatusFilter('USED');
                                          setCodesSearch('');
                                          setCodesPage(0);
                                          setOpenCodes(true);
                                        }}
                                        sx={{
                                          position: 'relative',
                                          width: '100%',
                                          minWidth: 120,
                                          cursor: 'pointer',
                                        }}
                                      >
                                        <LinearProgress
                                          variant="determinate"
                                          value={0}
                                          sx={{
                                            height: 24,
                                            borderRadius: 1,
                                            backgroundColor: 'action.hover',
                                            border: '1px dashed',
                                            borderColor: 'divider',
                                          }}
                                        />
                                        <Typography
                                          sx={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            fontWeight: 'bold',
                                            fontSize: '0.75rem',
                                            color: 'text.primary',
                                            cursor: 'help',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {numerator.toLocaleString()} /{' '}
                                          {denominator}
                                        </Typography>
                                      </Box>
                                    </Tooltip>
                                  </TableCell>
                                );
                              }

                              // Determine color based on percentage
                              let progressColor:
                                | 'inherit'
                                | 'primary'
                                | 'secondary'
                                | 'error'
                                | 'warning'
                                | 'info'
                                | 'success' = 'primary';
                              if (percentage >= 80) {
                                progressColor = 'error';
                              } else if (percentage >= 50) {
                                progressColor = 'warning';
                              }

                              return (
                                <TableCell
                                  key="usageRate"
                                  align="center"
                                  sx={{ py: 1, px: 2 }}
                                >
                                  <Tooltip title={tooltipText}>
                                    <Box
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCodesSetting(it);
                                        setCodesStatusFilter('USED');
                                        setCodesSearch('');
                                        setCodesPage(0);
                                        setOpenCodes(true);
                                      }}
                                      sx={{
                                        position: 'relative',
                                        width: '100%',
                                        minWidth: 120,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <LinearProgress
                                        variant="determinate"
                                        value={percentage}
                                        sx={{
                                          height: 24,
                                          borderRadius: 1,
                                          backgroundColor: 'action.hover',
                                          border: '1px dashed',
                                          borderColor: 'divider',
                                          '& .MuiLinearProgress-bar': {
                                            backgroundColor:
                                              progressColor === 'error'
                                                ? 'error.main'
                                                : progressColor === 'warning'
                                                  ? 'warning.main'
                                                  : 'primary.main',
                                          },
                                        }}
                                      />
                                      <Typography
                                        sx={{
                                          position: 'absolute',
                                          top: '50%',
                                          left: '50%',
                                          transform: 'translate(-50%, -50%)',
                                          fontWeight: 'bold',
                                          fontSize: '0.75rem',
                                          color: 'text.primary',
                                          cursor: 'help',
                                        }}
                                      >
                                        {percentage}%
                                      </Typography>
                                    </Box>
                                  </Tooltip>
                                </TableCell>
                              );
                            }
                            case 'start':
                              return (
                                <TableCell key="start" sx={{ py: 1, px: 2 }}>
                                  <Tooltip
                                    title={
                                      it.startsAt
                                        ? formatDateTimeDetailed(it.startsAt)
                                        : t(
                                            'coupons.couponSettings.immediateStart'
                                          )
                                    }
                                  >
                                    <Typography variant="caption">
                                      {it.startsAt
                                        ? formatRelativeTime(
                                            it.startsAt,
                                            undefined,
                                            language
                                          )
                                        : t(
                                            'coupons.couponSettings.immediateStart'
                                          )}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                              );
                            case 'end':
                              return (
                                <TableCell key="end" sx={{ py: 1, px: 2 }}>
                                  <Tooltip
                                    title={
                                      it.expiresAt
                                        ? formatDateTimeDetailed(it.expiresAt)
                                        : '-'
                                    }
                                  >
                                    <Typography variant="caption">
                                      {it.expiresAt
                                        ? formatRelativeTime(
                                            it.expiresAt,
                                            undefined,
                                            language
                                          )
                                        : '-'}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                              );
                            case 'createdAt':
                              return (
                                <TableCell
                                  key="createdAt"
                                  sx={{ py: 1, px: 2 }}
                                >
                                  <Tooltip
                                    title={formatDateTimeDetailed(
                                      (it as any).createdAt
                                    )}
                                  >
                                    <Typography variant="caption">
                                      {formatRelativeTime(
                                        (it as any).createdAt,
                                        undefined,
                                        language
                                      )}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                              );
                            case 'rewards':
                              return (
                                <TableCell key="rewards" sx={{ py: 1, px: 2 }}>
                                  <RewardDisplay
                                    rewards={it.rewardData || []}
                                    rewardTemplateId={it.rewardTemplateId}
                                    maxDisplay={3}
                                  />
                                </TableCell>
                              );
                            case 'description':
                              return (
                                <TableCell
                                  key="description"
                                  sx={{
                                    maxWidth: 240,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    py: 1,
                                    px: 2,
                                  }}
                                >
                                  <Typography variant="body2">
                                    {(it as any).description || '-'}
                                  </Typography>
                                </TableCell>
                              );
                            case 'tags':
                              return (
                                <TableCell key="tags" sx={{ py: 1, px: 2 }}>
                                  <TagChips
                                    tags={(it as any).tags}
                                    maxVisible={6}
                                  />
                                </TableCell>
                              );
                            default:
                              return null;
                          }
                        })}
                        {canManage && (
                          <TableCell align="center" sx={{ py: 1, px: 2 }}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                setRowMenuAnchor(e.currentTarget);
                                setRowMenuCoupon(it);
                              }}
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {!loading && items.length > 0 && (
                <SimplePagination
                  count={total}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={(_, newPage) => setPage(newPage)}
                  onRowsPerPageChange={(e: any) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(0);
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}
      </PageContentLoader>

      {/* Row Context Menu */}
      <Menu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={() => {
          setRowMenuAnchor(null);
          setRowMenuCoupon(null);
        }}
      >
        <MenuItem
          onClick={() => {
            if (rowMenuCoupon) handleEdit(rowMenuCoupon);
            setRowMenuAnchor(null);
            setRowMenuCoupon(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.edit')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (rowMenuCoupon) handleOpenCodes(rowMenuCoupon);
            setRowMenuAnchor(null);
            setRowMenuCoupon(null);
          }}
        >
          <ListItemIcon>
            <ListIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('coupons.couponSettings.viewIssuedCodes', 'View Issued Codes')}
          </ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            if (rowMenuCoupon) handleDeleteClick(rowMenuCoupon);
            setRowMenuAnchor(null);
            setRowMenuCoupon(null);
          }}
          disabled={rowMenuCoupon?.status === 'DELETED'}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('common.delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Column Settings Dialog */}
      <ColumnSettingsDialog
        anchorEl={columnSettingsAnchor}
        onClose={() => setColumnSettingsAnchor(null)}
        columns={columns}
        onColumnsChange={handleColumnsChange}
        onReset={handleResetColumns}
      />

      {/* Create/Edit Drawer */}
      <ResizableDrawer
        open={openForm}
        onClose={() => setOpenForm(false)}
        title={
          editing
            ? (t('coupons.couponSettings.editCoupon') as string)
            : (t('coupons.couponSettings.createCoupon') as string)
        }
        subtitle={t('coupons.couponSettings.subtitle') as string}
        storageKey="couponSettings.drawer.width"
        defaultWidth={720}
        minWidth={560}
      >
        {/* Body */}
        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* Status Checkbox */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox
                  checked={form.status === 'ACTIVE'}
                  onChange={(e) =>
                    setForm((s: any) => ({
                      ...s,
                      status: e.target.checked ? 'ACTIVE' : 'DISABLED',
                    }))
                  }
                />
                <Typography variant="body2">{t('common.enabled')}</Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', ml: 4, mt: 0.5 }}
              >
                {t('coupons.couponSettings.form.statusHelp')}
              </Typography>
            </Box>

            {/* Basic Information Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: expandedGroups.basicInfo ? 1 : 0,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedGroups((s) => ({ ...s, basicInfo: !s.basicInfo }))
                }
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, flex: 1 }}
                >
                  {t('common.basicInformation')}
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {expandedGroups.basicInfo ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
              </Box>
              <Collapse in={expandedGroups.basicInfo}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {/* Name */}
                  <TextField
                    required
                    autoFocus
                    label={t('coupons.couponSettings.form.name')}
                    value={form.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setForm((s: any) => ({
                        ...s,
                        name: newName,
                        description: !isDescriptionManuallyEdited
                          ? newName
                          : s.description,
                      }));
                    }}
                    helperText={t('coupons.couponSettings.form.nameHelp')}
                    fullWidth
                  />
                  {/* Description */}
                  <TextField
                    label={t('coupons.couponSettings.form.description')}
                    value={form.description}
                    onChange={(e) => {
                      setForm((s: any) => ({
                        ...s,
                        description: e.target.value,
                      }));
                      setIsDescriptionManuallyEdited(true);
                    }}
                    helperText={t(
                      'coupons.couponSettings.form.descriptionHelp'
                    )}
                    fullWidth
                  />
                  {/* Tags */}
                  <TagSelector
                    value={form.tags || []}
                    onChange={(tags) => setForm((s: any) => ({ ...s, tags }))}
                  />
                </Stack>
              </Collapse>
            </Paper>
            {/* Target Settings Group - moved right after basic info */}
            <TargetSettingsGroup
              targetPlatforms={form.targetPlatforms || []}
              targetPlatformsInverted={form.targetPlatformsInverted || false}
              platforms={platforms}
              onPlatformsChange={(platforms, inverted) =>
                setForm((s: any) => ({
                  ...s,
                  targetPlatforms: platforms,
                  targetPlatformsInverted: inverted,
                }))
              }
              targetChannelSubchannels={form.targetChannelSubchannels || []}
              targetChannelSubchannelsInverted={
                form.targetChannelSubchannelsInverted || false
              }
              channels={channels}
              onChannelsChange={(channels, inverted) =>
                setForm((s: any) => ({
                  ...s,
                  targetChannelSubchannels: channels,
                  targetChannelSubchannelsInverted: inverted,
                }))
              }
              targetWorlds={form.targetWorlds || []}
              targetWorldsInverted={form.targetWorldsInverted || false}
              worlds={worlds}
              onWorldsChange={(worlds, inverted) =>
                setForm((s: any) => ({
                  ...s,
                  targetWorlds: worlds,
                  targetWorldsInverted: inverted,
                }))
              }
              targetUserIds={form.targetUserIds || ''}
              targetUserIdsInverted={form.targetUserIdsInverted || false}
              onUserIdsChange={(ids) =>
                setForm((s: any) => ({ ...s, targetUserIds: ids }))
              }
              onUserIdsInvertedChange={(inverted) =>
                setForm((s: any) => ({ ...s, targetUserIdsInverted: inverted }))
              }
              showUserIdFilter={true}
            />

            {/* Code & Quantity Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: expandedGroups.codeQuantity ? 1 : 0,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedGroups((s) => ({
                    ...s,
                    codeQuantity: !s.codeQuantity,
                  }))
                }
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, flex: 1 }}
                >
                  {t('coupons.couponSettings.form.codeAndQuantity')}
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {expandedGroups.codeQuantity ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
              </Box>
              <Collapse in={expandedGroups.codeQuantity}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {/* Type and Code Pattern/Code in one row */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '160px 1fr',
                      gap: 2,
                    }}
                  >
                    {/* Type */}
                    <TextField
                      select
                      required
                      label={t('coupons.couponSettings.form.type')}
                      value={form.type}
                      disabled={!!editing}
                      onChange={(e) =>
                        setForm((s: any) => ({
                          ...s,
                          type: e.target.value,
                          perUserLimit:
                            e.target.value === 'SPECIAL' ? 1 : s.perUserLimit,
                          maxTotalUses:
                            e.target.value === 'NORMAL' ? null : s.maxTotalUses,
                          code: e.target.value === 'NORMAL' ? '' : s.code,
                          quantity:
                            e.target.value === 'NORMAL' ? s.quantity || 1 : 1,
                        }))
                      }
                      helperText={
                        !!editing
                          ? t('coupons.couponSettings.form.typeCannotBeChanged')
                          : undefined
                      }
                    >
                      <MenuItem value="SPECIAL">SPECIAL</MenuItem>
                      <MenuItem value="NORMAL">NORMAL</MenuItem>
                    </TextField>

                    {/* Code Pattern (NORMAL only) */}
                    {form.type === 'NORMAL' && (
                      <TextField
                        select
                        label={t('coupons.couponSettings.form.codePattern')}
                        value={form.codePattern || 'ALPHANUMERIC_8'}
                        onChange={(e) =>
                          setForm((s: any) => ({
                            ...s,
                            codePattern: e.target.value,
                          }))
                        }
                        disabled={!!editing}
                        helperText={
                          !!editing
                            ? t(
                                'coupons.couponSettings.form.codePatternCannotBeChanged'
                              )
                            : `예시: ${codePatternExample}`
                        }
                      >
                        <MenuItem value="ALPHANUMERIC_8">
                          {t('coupons.couponSettings.form.codePattern8')}
                        </MenuItem>
                        <MenuItem value="ALPHANUMERIC_16">
                          {t('coupons.couponSettings.form.codePattern16')}
                        </MenuItem>
                        <MenuItem value="ALPHANUMERIC_16_HYPHEN">
                          {t('coupons.couponSettings.form.codePattern16Hyphen')}
                        </MenuItem>
                      </TextField>
                    )}

                    {/* Code (SPECIAL only) */}
                    {form.type === 'SPECIAL' && (
                      <TextField
                        required
                        label={t('coupons.couponSettings.form.code')}
                        value={form.code}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase();
                          setForm((s: any) => ({ ...s, code: value }));
                        }}
                        error={codeError}
                        helperText={
                          codeError
                            ? getCodeErrorMessage()
                            : t('coupons.couponSettings.form.codeHelp')
                        }
                        inputProps={{
                          style: { textTransform: 'uppercase' },
                        }}
                      />
                    )}
                  </Box>

                  {/* Quantity (NORMAL only) */}
                  {form.type === 'NORMAL' && !editing && (
                    <TextField
                      type="number"
                      fullWidth
                      label={t('coupons.couponSettings.form.quantity')}
                      value={form.quantity}
                      onChange={(e) =>
                        setForm((s: any) => ({
                          ...s,
                          quantity:
                            e.target.value === '' ? '' : Number(e.target.value),
                        }))
                      }
                      error={quantityError}
                      helperText={
                        quantityError
                          ? t('coupons.couponSettings.form.quantityMinError')
                          : t('coupons.couponSettings.form.quantityHelp')
                      }
                      sx={{
                        '& input[type=number]': { MozAppearance: 'textfield' },
                        '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
                          { WebkitAppearance: 'none', margin: 0 },
                      }}
                    />
                  )}
                </Stack>
              </Collapse>
            </Paper>

            {/* Usage Limit Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: expandedGroups.usageLimit ? 1 : 0,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedGroups((s) => ({
                    ...s,
                    usageLimit: !s.usageLimit,
                  }))
                }
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, flex: 1 }}
                >
                  {t('coupons.couponSettings.form.usageLimit')}
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {expandedGroups.usageLimit ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
              </Box>
              <Collapse in={expandedGroups.usageLimit}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {/* Usage Limit Type + PerUserLimit (NORMAL only) */}
                  {form.type === 'NORMAL' && (
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '160px 1fr',
                        gap: 2,
                      }}
                    >
                      <TextField
                        select
                        label={t('coupons.couponSettings.form.usageLimitType')}
                        value={form.usageLimitType}
                        onChange={(e) =>
                          setForm((s: any) => ({
                            ...s,
                            usageLimitType: e.target.value,
                          }))
                        }
                        helperText={t(
                          'coupons.couponSettings.form.usageLimitTypeHelp'
                        )}
                      >
                        <MenuItem value="USER">
                          {t('coupons.couponSettings.form.usageLimitTypeUser')}
                        </MenuItem>
                        <MenuItem value="CHARACTER">
                          {t(
                            'coupons.couponSettings.form.usageLimitTypeCharacter'
                          )}
                        </MenuItem>
                      </TextField>
                      <TextField
                        type="number"
                        label={
                          form.usageLimitType === 'CHARACTER'
                            ? t('coupons.couponSettings.form.perCharacterLimit')
                            : t('coupons.couponSettings.form.perUserLimit')
                        }
                        value={form.perUserLimit}
                        onChange={(e) =>
                          setForm((s: any) => ({
                            ...s,
                            perUserLimit:
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                          }))
                        }
                        error={perUserLimitError}
                        helperText={
                          perUserLimitError
                            ? t(
                                'coupons.couponSettings.form.perUserLimitMinError'
                              )
                            : form.usageLimitType === 'CHARACTER'
                              ? t(
                                  'coupons.couponSettings.form.perCharacterLimitHelp'
                                )
                              : t(
                                  'coupons.couponSettings.form.perUserLimitHelp'
                                )
                        }
                        sx={{
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
                            { WebkitAppearance: 'none', margin: 0 },
                        }}
                      />
                    </Box>
                  )}
                  {/* MaxTotalUses + Unlimited (SPECIAL only) */}
                  {form.type === 'SPECIAL' && (
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <TextField
                        type="number"
                        fullWidth
                        label={t('coupons.couponSettings.form.maxTotalUses')}
                        value={form.maxTotalUses ?? ''}
                        onChange={(e) =>
                          setForm((s: any) => ({
                            ...s,
                            maxTotalUses:
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                          }))
                        }
                        error={maxTotalUsesError}
                        helperText={
                          maxTotalUsesError
                            ? t(
                                'coupons.couponSettings.form.maxTotalUsesMinError'
                              )
                            : t('coupons.couponSettings.form.maxTotalUsesHelp')
                        }
                        disabled={form.maxTotalUses === null}
                        sx={{
                          '& input[type=number]': {
                            MozAppearance: 'textfield',
                          },
                          '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button':
                            { WebkitAppearance: 'none', margin: 0 },
                        }}
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={form.maxTotalUses === null}
                            onChange={(e) =>
                              setForm((s: any) => ({
                                ...s,
                                maxTotalUses: e.target.checked
                                  ? null
                                  : (s.maxTotalUses ?? 0),
                              }))
                            }
                          />
                        }
                        label={t('coupons.couponSettings.form.unlimited')}
                      />
                    </Box>
                  )}
                </Stack>
              </Collapse>
            </Paper>

            {/* Date Range Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: expandedGroups.dateRange ? 1 : 0,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedGroups((s) => ({ ...s, dateRange: !s.dateRange }))
                }
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, flex: 1 }}
                >
                  {t('coupons.couponSettings.form.dateRange')}
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {expandedGroups.dateRange ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
              </Box>
              <Collapse in={expandedGroups.dateRange}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <DateTimePicker
                      label={t('coupons.couponSettings.form.startsAt')}
                      value={form.startsAt}
                      onChange={(date) =>
                        setForm((s: any) => ({ ...s, startsAt: date }))
                      }
                      timeSteps={{ minutes: 1 }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          slotProps: { input: { readOnly: true } },
                        },
                        actionBar: {
                          actions: ['clear', 'cancel', 'accept'],
                        },
                      }}
                    />
                    <DateTimePicker
                      label={t('coupons.couponSettings.form.expiresAt')}
                      value={form.expiresAt}
                      onChange={(date) =>
                        setForm((s: any) => ({ ...s, expiresAt: date }))
                      }
                      minDateTime={form.startsAt || undefined}
                      timeSteps={{ minutes: 1 }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          required: true,
                          slotProps: { input: { readOnly: true } },
                        },
                        actionBar: {
                          actions: ['clear', 'cancel', 'accept'],
                        },
                      }}
                    />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('coupons.couponSettings.form.startsAtHelp')} /{' '}
                    {t('coupons.couponSettings.form.expiresAtHelp')}
                  </Typography>
                  {form.expiresAt && (
                    <Typography variant="body2" color="text.secondary">
                      {(() => {
                        const e = form.expiresAt as Dayjs;
                        const endStr = e.format('YYYY-MM-DD HH:mm');
                        if (form.startsAt) {
                          const s = form.startsAt as Dayjs;
                          const startStr = s.format('YYYY-MM-DD HH:mm');
                          const days = Math.max(
                            0,
                            Math.ceil(e.diff(s, 'hour') / 24)
                          );
                          return `${t('coupons.couponSettings.form.applicablePeriod')}: ${startStr} ~ ${endStr} (${days}${t('common.day')})`;
                        } else {
                          return `${t('coupons.couponSettings.form.applicablePeriod')}: ${t('coupons.couponSettings.form.immediatelyAvailable')} ~ ${endStr}`;
                        }
                      })()}
                    </Typography>
                  )}
                </Stack>
              </Collapse>
            </Paper>

            {/* Rewards Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: expandedGroups.rewards ? 1 : 0,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedGroups((s) => ({ ...s, rewards: !s.rewards }))
                }
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, flex: 1 }}
                >
                  {t('surveys.participationRewards')}
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {expandedGroups.rewards ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
              </Box>
              <Collapse in={expandedGroups.rewards}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mb: 2 }}
                    >
                      {t('surveys.participationRewardsHelp')}
                    </Typography>
                    <RewardSelector
                      value={form.rewardData || []}
                      onChange={(rewards) =>
                        setForm((s: any) => ({ ...s, rewardData: rewards }))
                      }
                      onModeChange={(mode, templateId) => {
                        setRewardMode(mode);
                        if (mode === 'template') {
                          setForm((s: any) => ({
                            ...s,
                            rewardTemplateId: templateId || null,
                          }));
                        } else {
                          setForm((s: any) => ({
                            ...s,
                            rewardTemplateId: null,
                          }));
                        }
                      }}
                      minQuantity={1}
                      initialMode={rewardMode}
                      initialTemplateId={form.rewardTemplateId || ''}
                    />
                  </Box>
                </Stack>
              </Collapse>
            </Paper>

            {/* Reward Email Group */}
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: expandedGroups.rewardEmail ? 1 : 0,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedGroups((s) => ({
                    ...s,
                    rewardEmail: !s.rewardEmail,
                  }))
                }
              >
                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: 600, flex: 1 }}
                >
                  {t('coupons.couponSettings.form.rewardEmail')}
                </Typography>
                <IconButton size="small" sx={{ pointerEvents: 'none' }}>
                  {expandedGroups.rewardEmail ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </IconButton>
              </Box>
              <Collapse in={expandedGroups.rewardEmail}>
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    required
                    fullWidth
                    label={t('coupons.couponSettings.form.rewardEmailTitle')}
                    value={form.rewardEmailTitle || ''}
                    onChange={(e) =>
                      setForm((s: any) => ({
                        ...s,
                        rewardEmailTitle: e.target.value,
                      }))
                    }
                    placeholder={t(
                      'coupons.couponSettings.form.rewardEmailTitlePlaceholder'
                    )}
                    helperText={t(
                      'coupons.couponSettings.form.rewardEmailTitleHelp'
                    )}
                  />
                  <TextField
                    required
                    fullWidth
                    multiline
                    rows={4}
                    label={t('coupons.couponSettings.form.rewardEmailBody')}
                    value={form.rewardEmailBody || ''}
                    onChange={(e) =>
                      setForm((s: any) => ({
                        ...s,
                        rewardEmailBody: e.target.value,
                      }))
                    }
                    placeholder={t(
                      'coupons.couponSettings.form.rewardEmailBodyPlaceholder'
                    )}
                    helperText={t(
                      'coupons.couponSettings.form.rewardEmailBodyHelp'
                    )}
                  />
                </Stack>
              </Collapse>
            </Paper>
          </Stack>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button onClick={() => setOpenForm(false)}>
            {t('common.cancel')}
          </Button>
          <ChangeRequestSubmitButtons
            action={editing ? 'update' : 'create'}
            requiresApproval={requiresApproval}
            saving={submitting}
            onSave={handleSave}
            disabled={submitting || !isFormValid || (!!editing && !isDirty)}
          />
        </Box>
      </ResizableDrawer>

      {/* Issued Codes Drawer */}
      <ResizableDrawer
        open={openCodes}
        onClose={() => setOpenCodes(false)}
        title={
          codesSetting?.type === 'SPECIAL'
            ? (t('coupons.couponUsage.title', 'Coupon Usage') as string)
            : (t('coupons.couponSettings.issuedCodesDrawer.title') as string)
        }
        subtitle={
          codesSetting
            ? `${t('coupons.couponSettings.issuedCodesDrawer.subtitlePrefix')} ${(codesSetting as any).name}`
            : ''
        }
        storageKey="couponSettings.issuedCodes.drawer.width"
        defaultWidth={720}
        minWidth={560}
      >
        <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
          <Stack spacing={2}>
            {/* Statistics Cards – compact, clickable status filter toggles (only for NORMAL type) */}
            {codesSetting?.type !== 'SPECIAL' && (
              <Stack direction="row" spacing={1}>
                {[
                  {
                    filter: 'ALL' as const,
                    label: t('coupons.couponSettings.statistics.total'),
                    value: codesStats?.issued || 0,
                    gradient:
                      'linear-gradient(135deg, #5c6bc0 0%, #3949ab 100%)',
                    shadow: 'rgba(92,107,192,0.4)',
                    icon: <ListIcon sx={{ color: 'inherit', fontSize: 20 }} />,
                  },
                  {
                    filter: 'USED' as const,
                    label: t('coupons.couponSettings.statistics.used'),
                    value: codesStats?.used || 0,
                    gradient:
                      'linear-gradient(135deg, #66bb6a 0%, #43a047 100%)',
                    shadow: 'rgba(102,187,106,0.4)',
                    icon: (
                      <CheckCircleIcon
                        sx={{ color: 'inherit', fontSize: 20 }}
                      />
                    ),
                  },
                  {
                    filter: 'ISSUED' as const,
                    label: t('coupons.couponSettings.statistics.unused'),
                    value: codesStats?.unused || 0,
                    gradient:
                      'linear-gradient(135deg, #ffa726 0%, #fb8c00 100%)',
                    shadow: 'rgba(255,167,38,0.4)',
                    icon: (
                      <HourglassEmptyIcon
                        sx={{ color: 'inherit', fontSize: 20 }}
                      />
                    ),
                  },
                ].map((card) => (
                  <Card
                    key={card.filter}
                    sx={{
                      flex: 1,
                      cursor: 'pointer',
                      border: 1.5,
                      borderRadius: 1.5,
                      ...(codesStatusFilter === card.filter
                        ? {
                            borderColor: 'transparent',
                            background: card.gradient,
                            color: '#fff',
                            boxShadow: `0 2px 8px ${card.shadow}`,
                          }
                        : {
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                          }),
                      transition: 'all 0.2s ease',
                      '&:hover':
                        codesStatusFilter !== card.filter
                          ? { borderColor: 'primary.light' }
                          : {},
                    }}
                    onClick={() => {
                      setCodesStatusFilter(card.filter);
                      setCodesPage(0);
                    }}
                  >
                    <CardContent sx={{ p: '8px 12px !important' }}>
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        {card.icon}
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 700,
                            lineHeight: 1.2,
                            color:
                              codesStatusFilter === card.filter
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
                              codesStatusFilter === card.filter
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
            )}

            {/* Search and Export */}
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ width: '100%' }}
            >
              <SearchTextField
                placeholder={
                  t(
                    'coupons.couponSettings.issuedCodesDrawer.searchPlaceholder'
                  ) as string
                }
                value={codesSearch}
                onChange={setCodesSearch}
                sx={{ maxWidth: 'none', flex: 1 }}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                endIcon={<ArrowDropDownIcon />}
                onClick={(e) => setCodesExportMenuAnchor(e.currentTarget)}
                disabled={exportingCodes}
                sx={{ minWidth: 130, height: 40, flexShrink: 0 }}
              >
                {t('common.export')}
              </Button>
              <Menu
                anchorEl={codesExportMenuAnchor}
                open={Boolean(codesExportMenuAnchor)}
                onClose={() => setCodesExportMenuAnchor(null)}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                {(codesStatusFilter !== 'ALL' || debouncedCodesSearch) && (
                  <Box>
                    <MenuItem
                      disabled
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        opacity: '1 !important',
                        minHeight: 32,
                      }}
                    >
                      {t(
                        'coupons.couponSettings.exportFiltered',
                        '필터링된 데이터'
                      )}
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleExportIssuedCodes('csv', true)}
                      disabled={exportingCodes}
                    >
                      <TableChartIcon sx={{ mr: 1 }} />
                      CSV (
                      {t(
                        'coupons.couponSettings.exportFilterApplied',
                        '필터 적용'
                      )}
                      )
                    </MenuItem>
                    <MenuItem
                      onClick={() => handleExportIssuedCodes('xlsx', true)}
                      disabled={exportingCodes}
                    >
                      <ExcelIcon sx={{ mr: 1 }} />
                      Excel (
                      {t(
                        'coupons.couponSettings.exportFilterApplied',
                        '필터 적용'
                      )}
                      )
                    </MenuItem>
                    <Divider />
                    <MenuItem
                      disabled
                      sx={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        opacity: '1 !important',
                        minHeight: 32,
                      }}
                    >
                      {t('coupons.couponSettings.exportAll', '전체 데이터')}
                    </MenuItem>
                  </Box>
                )}
                <MenuItem
                  onClick={() => handleExportIssuedCodes('csv', false)}
                  disabled={exportingCodes}
                >
                  <TableChartIcon sx={{ mr: 1 }} />
                  CSV
                  {codesStatusFilter !== 'ALL' || debouncedCodesSearch
                    ? ` (${t('coupons.couponSettings.exportAllLabel', '전체')})`
                    : ''}
                </MenuItem>
                <MenuItem
                  onClick={() => handleExportIssuedCodes('xlsx', false)}
                  disabled={exportingCodes}
                >
                  <ExcelIcon sx={{ mr: 1 }} />
                  Excel
                  {codesStatusFilter !== 'ALL' || debouncedCodesSearch
                    ? ` (${t('coupons.couponSettings.exportAllLabel', '전체')})`
                    : ''}
                </MenuItem>
              </Menu>
            </Stack>

            {codesLoading ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {t('common.loading')}
                </Typography>
              </Box>
            ) : codesItems.length === 0 ? (
              codesSetting?.generationStatus === 'FAILED' ? (
                <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
                  <Typography
                    variant="h6"
                    color="error"
                    sx={{
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                    }}
                  >
                    ⚠️ {t('coupons.couponSettings.generationFailed')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('coupons.couponSettings.generationFailedDescription')}
                  </Typography>
                </Box>
              ) : codesSetting?.generationStatus === 'IN_PROGRESS' ||
                codesSetting?.generationStatus === 'PENDING' ? (
                <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
                  <Typography
                    variant="body1"
                    color="warning.main"
                    sx={{
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                    }}
                  >
                    <HourglassEmptyIcon fontSize="small" />
                    {t('coupons.couponSettings.generatingInBackground')}
                  </Typography>
                </Box>
              ) : (
                <EmptyPagePlaceholder message={t('common.noData')} />
              )
            ) : (
              <Card variant="outlined">
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ height: 48 }}>
                          <TableCell
                            sx={{ py: 1, px: 2 }}
                            sortDirection={
                              codesOrderBy === 'code' ? codesOrder : false
                            }
                          >
                            <TableSortLabel
                              active={codesOrderBy === 'code'}
                              direction={
                                codesOrderBy === 'code' ? codesOrder : 'asc'
                              }
                              onClick={() => {
                                const isAsc =
                                  codesOrderBy === 'code' &&
                                  codesOrder === 'asc';
                                setCodesOrder(isAsc ? 'desc' : 'asc');
                                setCodesOrderBy('code');
                                setCodesPage(0);
                              }}
                            >
                              {t('coupons.issuedCodes.code')}
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{ py: 1, px: 2 }}
                            sortDirection={
                              codesOrderBy === 'status' ? codesOrder : false
                            }
                          >
                            <TableSortLabel
                              active={codesOrderBy === 'status'}
                              direction={
                                codesOrderBy === 'status' ? codesOrder : 'asc'
                              }
                              onClick={() => {
                                const isAsc =
                                  codesOrderBy === 'status' &&
                                  codesOrder === 'asc';
                                setCodesOrder(isAsc ? 'desc' : 'asc');
                                setCodesOrderBy('status');
                                setCodesPage(0);
                              }}
                            >
                              {t('coupons.issuedCodes.status')}
                            </TableSortLabel>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.userId')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.userName')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.characterId')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.sequence')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.gameWorldId')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.platform')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.channel')}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ py: 1, px: 2 }}>
                            <Typography variant="caption" fontWeight="bold">
                              {t('coupons.couponUsage.columns.subChannel')}
                            </Typography>
                          </TableCell>
                          <TableCell
                            sx={{ py: 1, px: 2 }}
                            sortDirection={
                              codesOrderBy === 'createdAt' ? codesOrder : false
                            }
                          >
                            <TableSortLabel
                              active={codesOrderBy === 'createdAt'}
                              direction={
                                codesOrderBy === 'createdAt'
                                  ? codesOrder
                                  : 'asc'
                              }
                              onClick={() => {
                                const isAsc =
                                  codesOrderBy === 'createdAt' &&
                                  codesOrder === 'asc';
                                setCodesOrder(isAsc ? 'desc' : 'asc');
                                setCodesOrderBy('createdAt');
                                setCodesPage(0);
                              }}
                            >
                              {t('coupons.issuedCodes.issuedAt')}
                            </TableSortLabel>
                          </TableCell>
                          <TableCell
                            sx={{ py: 1, px: 2 }}
                            sortDirection={
                              codesOrderBy === 'usedAt' ? codesOrder : false
                            }
                          >
                            <TableSortLabel
                              active={codesOrderBy === 'usedAt'}
                              direction={
                                codesOrderBy === 'usedAt' ? codesOrder : 'asc'
                              }
                              onClick={() => {
                                const isAsc =
                                  codesOrderBy === 'usedAt' &&
                                  codesOrder === 'asc';
                                setCodesOrder(isAsc ? 'desc' : 'asc');
                                setCodesOrderBy('usedAt');
                                setCodesPage(0);
                              }}
                            >
                              {t('coupons.issuedCodes.usedAt')}
                            </TableSortLabel>
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {codesItems.map((c) => (
                          <TableRow key={c.id} hover sx={{ height: 48 }}>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 0.5,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{ fontFamily: 'monospace' }}
                                >
                                  {c.code}
                                </Typography>
                                <Tooltip
                                  title={t('coupons.couponSettings.copyCode')}
                                >
                                  <IconButton
                                    size="small"
                                    onClick={() => handleCopyCode(c.code)}
                                  >
                                    <ContentCopyIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Chip
                                size="small"
                                color={
                                  c.status === 'USED'
                                    ? 'success'
                                    : c.status === 'REVOKED'
                                      ? 'warning'
                                      : 'default'
                                }
                                label={
                                  c.status === 'USED'
                                    ? t('coupons.issuedCodes.statusUsed')
                                    : c.status === 'REVOKED'
                                      ? t('coupons.issuedCodes.statusRevoked')
                                      : t('coupons.issuedCodes.statusIssued')
                                }
                              />
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography
                                variant="caption"
                                sx={
                                  c.userId
                                    ? {
                                        cursor: 'pointer',
                                        color: 'primary.main',
                                        '&:hover': {
                                          textDecoration: 'underline',
                                        },
                                      }
                                    : {}
                                }
                                onClick={() => c.userId && handleOpenDetail(c)}
                              >
                                {c.userId || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography
                                variant="caption"
                                sx={
                                  c.userName
                                    ? {
                                        cursor: 'pointer',
                                        color: 'primary.main',
                                        '&:hover': {
                                          textDecoration: 'underline',
                                        },
                                      }
                                    : {}
                                }
                                onClick={() =>
                                  c.userName && handleOpenDetail(c)
                                }
                              >
                                {c.userName || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography
                                variant="caption"
                                sx={
                                  c.characterId
                                    ? {
                                        cursor: 'pointer',
                                        color: 'primary.main',
                                        '&:hover': {
                                          textDecoration: 'underline',
                                        },
                                      }
                                    : {}
                                }
                                onClick={() =>
                                  c.characterId && handleOpenDetail(c)
                                }
                              >
                                {c.characterId || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography variant="caption">
                                {c.sequence ?? '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography variant="caption">
                                {c.gameWorldId || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography variant="caption">
                                {c.platform || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography variant="caption">
                                {c.channel || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Typography variant="caption">
                                {c.subchannel || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              <Tooltip
                                title={formatDateTimeDetailed(c.createdAt)}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{ cursor: 'help' }}
                                >
                                  {formatRelativeTime(
                                    c.createdAt,
                                    undefined,
                                    language
                                  )}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell sx={{ py: 1, px: 2 }}>
                              {c.usedAt ? (
                                <Tooltip
                                  title={formatDateTimeDetailed(c.usedAt)}
                                >
                                  <Typography
                                    variant="caption"
                                    sx={{ cursor: 'help' }}
                                  >
                                    {formatRelativeTime(
                                      c.usedAt,
                                      undefined,
                                      language
                                    )}
                                  </Typography>
                                </Tooltip>
                              ) : (
                                <Typography variant="caption">-</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}
          </Stack>
        </Box>
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'center',
            gap: 2,
            bgcolor: 'background.paper',
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <SimplePagination
            count={codesTotal}
            page={codesPage}
            rowsPerPage={codesRowsPerPage}
            onPageChange={(_, p) => setCodesPage(p)}
            onRowsPerPageChange={(e) => {
              const val = Number(e.target.value);
              setCodesRowsPerPage(val);
              setCodesPage(0);
            }}
          />
        </Box>
      </ResizableDrawer>

      {/* Detail Dialog */}
      <RecordDetailDialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        title={t('playerConnections.allPlayers.viewDetails')}
        data={detailCode}
        fields={DETAIL_FIELDS}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t('coupons.couponSettings.deleteConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {t('coupons.couponSettings.deleteConfirmMessage', {
              name: deleteTarget?.name || '',
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
          >
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Export Progress Dialog - Only show for large datasets (>1000 codes) */}
      <Dialog
        open={
          (exportingCodes || exportSuccess || exportError !== null) &&
          (codesStats.issued || 0) > 1000
        }
        onClose={() => {
          if (!exportingCodes) {
            setExportSuccess(false);
            setExportError(null);
            setExportProgress(0);
            setExportProcessedCount(0);
            setExportFormat(null);
          }
        }}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={exportingCodes}
      >
        <DialogTitle>
          {exportSuccess
            ? t('coupons.couponSettings.exportDialog.completed')
            : exportError
              ? t('coupons.couponSettings.exportDialog.failed')
              : t('coupons.couponSettings.exportDialog.title')}
        </DialogTitle>
        <DialogContent sx={{ py: 3 }}>
          {exportingCodes ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {t('coupons.couponSettings.exportDialog.processing')}
              </Typography>
              <Box>
                <LinearProgress
                  variant="determinate"
                  value={exportProgress}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {t('coupons.couponSettings.exportDialog.progress', {
                    current: exportProcessedCount.toLocaleString(),
                    total: (codesStats.issued || 0).toLocaleString(),
                  })}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: 'primary.main' }}
                >
                  {exportProgress}%
                </Typography>
              </Box>
            </Box>
          ) : exportSuccess ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                alignItems: 'center',
                py: 2,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 48, color: 'success.main' }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: 'center' }}
              >
                {t('coupons.couponSettings.exportDialog.completed')}
              </Typography>
            </Box>
          ) : exportError ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2" color="error">
                {exportError}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {exportingCodes ? (
            <Button
              onClick={() => {
                // Abort the export operation immediately
                exportAbortControllerRef.current?.abort();
                // Reset all export states immediately
                setExportingCodes(false);
                setExportProgress(0);
                setExportProcessedCount(0);
                setExportFormat(null);
                setExportError(null);
                setExportSuccess(false);
              }}
              color="inherit"
            >
              {t('coupons.couponSettings.exportDialog.cancel')}
            </Button>
          ) : exportSuccess ? (
            <Button
              onClick={() => {
                setExportSuccess(false);
                setExportProgress(0);
                setExportProcessedCount(0);
                setExportFormat(null);
                enqueueSnackbar(t('coupons.couponSettings.exportSuccess'), {
                  variant: 'success',
                });
              }}
              variant="contained"
              color="primary"
            >
              {t('coupons.couponSettings.exportDialog.close')}
            </Button>
          ) : exportError ? (
            <>
              <Button
                onClick={() => {
                  setExportError(null);
                  setExportProgress(0);
                  setExportProcessedCount(0);
                  setExportFormat(null);
                }}
                color="inherit"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => {
                  if (exportFormat) {
                    handleExportIssuedCodes(exportFormat);
                  }
                }}
                variant="contained"
                color="primary"
              >
                {t('coupons.couponSettings.exportDialog.retry')}
              </Button>
            </>
          ) : null}
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <ImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        title={t('common.import')}
        onImport={async (data) => {
          let successCount = 0;
          let failCount = 0;
          for (const item of data) {
            try {
              await couponService.createSetting(projectApiPath, {
                name: item[t('common.name')] || item.name || '',
                code:
                  item[t('coupons.couponSettings.columns.code')] ||
                  item.code ||
                  '',
                type: (item[t('common.type')] ||
                  item.type ||
                  'NORMAL') as CouponType,
                status: (item[t('common.status')] ||
                  item.status ||
                  'ACTIVE') as CouponStatus,
                description:
                  item[t('common.description')] || item.description || '',
                startsAt: item.startsAt || new Date().toISOString(),
                expiresAt:
                  item.expiresAt ||
                  new Date(
                    Date.now() + 365 * 24 * 60 * 60 * 1000
                  ).toISOString(),
              });
              successCount++;
            } catch (err) {
              failCount++;
            }
          }
          if (successCount > 0) {
            enqueueSnackbar(t('common.importSuccess'), { variant: 'success' });
            window.location.reload();
          }
          if (failCount > 0) {
            enqueueSnackbar(t('common.importFailed'), { variant: 'error' });
          }
        }}
      />
    </>
  );
};

export default CouponSettingsPage;
