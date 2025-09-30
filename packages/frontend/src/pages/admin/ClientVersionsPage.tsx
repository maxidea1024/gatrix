import React, { useState, useEffect, useCallback } from 'react';
import { devLogger, prodLogger } from '../../utils/logger';
import { usePageState } from '../../hooks/usePageState';
import * as XLSX from 'xlsx';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Menu,
  Paper,
  IconButton,
  TableSortLabel,
  Checkbox,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Fab,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
  Alert,
  Autocomplete,
  TextField,
  Divider,
  Drawer,
} from '@mui/material';
import {
  Add as AddIcon,

  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  ArrowDropDown as ArrowDropDownIcon,
  TableChart as TableChartIcon,
  Code as JsonIcon,
  Description as ExcelIcon,

  ContentCopy as CopyIcon,
  Cancel as CancelIcon,
  Close as CloseIcon,
  Update as UpdateIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useTheme } from '@mui/material/styles';
import { tagService, Tag } from '../../services/tagService';
import { 
  ClientVersion, 
  ClientVersionFilters, 
  ClientStatus,
  ClientStatusLabels,
  ClientStatusColors,
  BulkStatusUpdateRequest,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import ClientVersionForm from '../../components/admin/ClientVersionForm';
import BulkClientVersionForm from '../../components/admin/BulkClientVersionForm';
import PlatformDefaultsDialog from '../../components/admin/PlatformDefaultsDialog';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';

// HSV를 RGB로 변환하는 함수
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
};

// 버전별 색상을 HSV 기반으로 다양하게 생성하는 함수 (황금비 활용)
const getVersionColorStyle = (version: string, isDarkMode: boolean = false): { backgroundColor: string; color: string } => {
  // 개선된 해시 함수 (더 균등한 분포)
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    const char = version.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }

  // 황금비(φ ≈ 0.618)를 활용한 색상 분포로 더 균등하고 아름다운 색상 생성
  const goldenRatio = 0.618033988749;
  const baseHue = (Math.abs(hash) * goldenRatio) % 1; // 0-1 사이 값
  const hue = baseHue * 360; // 0-359도로 변환

  // 해시의 다른 부분을 활용해 채도와 명도 변화
  const saturationSeed = Math.abs(hash >> 8);
  const valueSeed = Math.abs(hash >> 16);

  // 다크모드에 따라 채도와 명도 조정
  let saturation, value;
  if (isDarkMode) {
    // 다크모드: 선명하면서도 눈에 부담 없는 색상
    saturation = 0.75 + (saturationSeed % 20) / 100; // 75-95% 채도
    value = 0.65 + (valueSeed % 25) / 100; // 65-90% 명도
  } else {
    // 라이트모드: 밝고 깔끔한 색상
    saturation = 0.70 + (saturationSeed % 25) / 100; // 70-95% 채도
    value = 0.80 + (valueSeed % 15) / 100; // 80-95% 명도
  }

  // HSV를 RGB로 변환
  const [r, g, b] = hsvToRgb(hue, saturation, value);

  // 배경색 생성
  const backgroundColor = `rgb(${r}, ${g}, ${b})`;

  // WCAG 2.1 기준에 따른 더 정확한 대비 계산
  const sRGB = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];

  // 4.5:1 대비율을 위한 텍스트 색상 결정
  const textColor = luminance > 0.179 ? '#000000' : '#ffffff';

  return {
    backgroundColor,
    color: textColor
  };
};

// 기존 MUI 색상 시스템과의 호환성을 위한 함수 (fallback용)
const getVersionColor = (version: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  // 간단한 해시 함수
  let hash = 0;
  for (let i = 0; i < version.length; i++) {
    const char = version.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }

  // 사용 가능한 색상 배열
  const colors: Array<'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = [
    'primary', 'secondary', 'error', 'info', 'success', 'warning'
  ];

  // 해시값을 색상 인덱스로 변환
  const colorIndex = Math.abs(hash) % colors.length;
  return colors[colorIndex];
};

const ClientVersionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  // 페이지 상태 관리 (localStorage 연동)
  const {
    pageState,
    updatePage,
    updateLimit,
    updateSort,
    updateFilters,
  } = usePageState({
    defaultState: {
      page: 1,
      limit: 10,
      sortBy: 'clientVersion',
      sortOrder: 'DESC',
      filters: {},
    },
    storageKey: 'clientVersionsPage',
  });

  // 상태 관리
  const [clientVersions, setClientVersions] = useState<ClientVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  
  // 선택 관리
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // 다이얼로그
  const [selectedClientVersion, setSelectedClientVersion] = useState<ClientVersion | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ClientStatus>(ClientStatus.ONLINE);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [bulkFormDialogOpen, setBulkFormDialogOpen] = useState(false);
  const [platformDefaultsDialogOpen, setPlatformDefaultsDialogOpen] = useState(false);
  const [editingClientVersion, setEditingClientVersion] = useState<ClientVersion | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);


  // 메타데이터
  const [platforms] = useState<string[]>(['pc', 'pc-wegame', 'ios', 'android', 'harmonyos']);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedClientVersionForTags, setSelectedClientVersionForTags] = useState<ClientVersion | null>(null);
  const [clientVersionTags, setClientVersionTags] = useState<Tag[]>([]);
  const [tagFilter, setTagFilter] = useState<Tag[]>([]);
  const [versions, setVersions] = useState<string[]>([]);

  // 내보내기 메뉴 상태
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedExportMenuAnchor, setSelectedExportMenuAnchor] = useState<null | HTMLElement>(null);

  // 사용 가능한 버전 목록 로드
  const loadAvailableVersions = useCallback(async () => {
    try {
      const versions = await ClientVersionService.getAvailableVersions();
      setVersions(versions);
    } catch (error) {
      prodLogger.error('Error loading available versions:', error);
    }
  }, []);

  // 클라이언트 버전 목록 로드
  const loadClientVersions = useCallback(async (customFilters?: ClientVersionFilters) => {
    try {
      setLoading(true);
      const filtersToUse = customFilters || pageState.filters || {};

      const result = await ClientVersionService.getClientVersions(
        pageState.page,
        pageState.limit,
        filtersToUse,
        pageState.sortBy || 'clientVersion',
        pageState.sortOrder || 'DESC'
      );

      if (result && result.clientVersions) {
        setClientVersions(result.clientVersions);
        setTotal(result.total || 0);
      } else {
        setClientVersions([]);
        setTotal(0);
      }
    } catch (error: any) {
      enqueueSnackbar(error.message || t('clientVersions.loadFailed'), { variant: 'error' });
      setClientVersions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [pageState.page, pageState.limit, pageState.sortBy, pageState.sortOrder, JSON.stringify(pageState.filters), enqueueSnackbar, t]);

  // 메타데이터 로드
  const loadMetadata = useCallback(async () => {
    try {
      const metadata = await ClientVersionService.getMetadata();
      if (metadata) {
        // platforms are hardcoded; metadata currently unused
      }
    } catch (error) {
      console.error('Error loading metadata:', error);
      // API 호출 실패 시 기본값 유지
    }
  }, []);

  // 태그 로드
  const loadTags = useCallback(async () => {
    try {
      const tags = await tagService.list();
      setAllTags(tags);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  }, []);

  // 초기 로드 (메타데이터와 태그만)
  useEffect(() => {
    loadMetadata();
    loadTags();
  }, [loadMetadata, loadTags]);

  // 버전 목록 별도 로드
  useEffect(() => {
    loadAvailableVersions();
  }, [loadAvailableVersions]);

  // pageState 변경 시 데이터 다시 로드 (클라이언트 버전 포함)
  useEffect(() => {
    loadClientVersions();
  }, [loadClientVersions]);





  // 필터 변경 핸들러
  const handleFilterChange = useCallback((newFilters: ClientVersionFilters) => {
    updateFilters(newFilters);
  }, [updateFilters]);

  // 태그 필터 변경 핸들러 (백엔드가 "tags"를 배열로 기대하므로 배열로 전달)
  const handleTagFilterChange = useCallback((tags: Tag[]) => {
    setTagFilter(tags);
    const tagIds = tags.map(tag => tag.id.toString());
    handleFilterChange({
      ...pageState.filters,
      tags: tagIds.length > 0 ? tagIds : undefined,
      // 더 이상 사용하지 않음
      tagIds: undefined as any,
    });
  }, [pageState.filters, handleFilterChange]);

  // 정렬은 고정 (버전 내림차순, 플랫폼 내림차순)
  // 정렬 변경 기능 비활성화

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    updatePage(newPage + 1); // MUI는 0부터 시작, 우리는 1부터 시작
  }, [updatePage]);

  // 페이지 크기 변경 핸들러
  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    updateLimit(newLimit);
  }, [updateLimit]);

  // 선택 관리
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(clientVersions.map(cv => cv.id));
    } else {
      setSelectedIds([]);
    }
    setSelectAll(checked);
  }, [clientVersions]);

  const handleSelectOne = useCallback((id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      setSelectAll(false);
    }
  }, []);



  // 삭제 핸들러
  const handleDelete = useCallback(async () => {
    if (!selectedClientVersion) return;

    try {
      await ClientVersionService.deleteClientVersion(selectedClientVersion.id);
      enqueueSnackbar(t('clientVersions.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedClientVersion(null);
      loadClientVersions();
      loadAvailableVersions(); // 버전 목록도 갱신
    } catch (error: any) {
      console.error('Error deleting client version:', error);
      enqueueSnackbar(error.message || t('clientVersions.deleteError'), { variant: 'error' });
    }
  }, [selectedClientVersion, t, enqueueSnackbar, loadClientVersions, loadAvailableVersions]);

  // 일괄 상태 변경 핸들러
  const handleBulkStatusUpdate = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      const request: BulkStatusUpdateRequest = {
        ids: selectedIds,
        clientStatus: bulkStatus,
      };

      const result = await ClientVersionService.bulkUpdateStatus(request);
      console.log('🔍 Bulk update result:', result);
      enqueueSnackbar(result?.message || t('clientVersions.statusUpdated'), { variant: 'success' });
      setBulkStatusDialogOpen(false);
      setSelectedIds([]);
      setSelectAll(false);
      loadClientVersions();
      loadAvailableVersions(); // 버전 목록도 갱신
    } catch (error: any) {
      console.error('Error updating status:', error);
      enqueueSnackbar(error.message || t('clientVersions.statusUpdateError'), { variant: 'error' });
    }
  }, [selectedIds, bulkStatus, enqueueSnackbar, loadClientVersions, loadAvailableVersions]);



  // 일괄 삭제 핸들러
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(id => ClientVersionService.deleteClientVersion(id)));
      enqueueSnackbar(t('clientVersions.bulkDeleteSuccess', { count: selectedIds.length }), { variant: 'success' });
      setSelectedIds([]);
      setSelectAll(false);
      setBulkDeleteDialogOpen(false);
      await loadClientVersions();
      loadAvailableVersions(); // 버전 목록도 갱신
    } catch (error: any) {
      console.error('Failed to delete client versions:', error);
      enqueueSnackbar(error.message || t('clientVersions.bulkDeleteError'), { variant: 'error' });
    }
  }, [selectedIds, t, enqueueSnackbar, loadClientVersions, loadAvailableVersions]);



  // 내보내기 함수들
  const handleExport = useCallback(async (format: 'csv' | 'json' | 'xlsx') => {
    try {
      let blob: Blob;
      let filename: string;
      const now = new Date();
      const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS

      if (format === 'csv') {
        blob = await ClientVersionService.exportToCSV(pageState.filters || {});
        filename = `client-versions-${dateTimeStr}.csv`;
      } else if (format === 'json') {
        // JSON 내보내기
        const result = await ClientVersionService.exportToCSV(pageState.filters || {}); // 같은 데이터 사용
        const text = await result.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',');
        const jsonData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header.replace(/"/g, '')] = values[index]?.replace(/"/g, '') || '';
          });
          return obj;
        });
        blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        filename = `client-versions-${dateTimeStr}.json`;
      } else if (format === 'xlsx') {
        // XLSX 내보내기
        const result = await ClientVersionService.exportToCSV(pageState.filters || {});
        const text = await result.text();
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
        const data = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          const obj: any = {};
          headers.forEach((header, index) => {
            obj[header] = values[index]?.replace(/"/g, '') || '';
          });
          return obj;
        });

        // XLSX 워크북 생성
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Client Versions');

        // 컬럼 너비 자동 조정
        const colWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
        worksheet['!cols'] = colWidths;

        // XLSX 파일 생성
        const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename = `client-versions-${dateTimeStr}.xlsx`;
      } else {
        enqueueSnackbar('Unsupported export format', { variant: 'warning' });
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

      enqueueSnackbar(t('clientVersions.exportSuccess'), { variant: 'success' });
      setExportMenuAnchor(null);
    } catch (error: any) {
      console.error('Error exporting:', error);
      enqueueSnackbar(error.message || t('clientVersions.exportError'), { variant: 'error' });
    }
  }, [pageState.filters, t, enqueueSnackbar]);

  // 선택된 항목 내보내기
  const handleExportSelected = useCallback(async (format: 'csv' | 'json' | 'xlsx') => {
    if (selectedIds.length === 0) return;

    try {
      const selectedVersions = clientVersions.filter(cv => selectedIds.includes(cv.id));
      let blob: Blob;
      let filename: string;
      const now = new Date();
      const dateTimeStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DDTHH-MM-SS

      if (format === 'csv') {
        const csvContent = [
          // CSV 헤더
          [
            'ID', 'Platform', 'Version', 'Status', 'Game Server', 'Game Server (Whitelist)',
            'Patch Address', 'Patch Address (Whitelist)', 'Guest Mode', 'External Click Link',
            'Memo', 'Custom Payload', 'Maintenance Start', 'Maintenance End', 'Maintenance Message',
            'Multi Language', 'Tags', 'Created By', 'Created By Email', 'Created At',
            'Updated By', 'Updated By Email', 'Updated At'
          ].join(','),
          // CSV 데이터
          ...selectedVersions.map(cv => [
            cv.id,
            `"${cv.platform}"`,
            `"${cv.clientVersion}"`,
            `"${cv.clientStatus}"`,
            `"${cv.gameServerAddress}"`,
            `"${cv.gameServerAddressForWhiteList || ''}"`,
            `"${cv.patchAddress}"`,
            `"${cv.patchAddressForWhiteList || ''}"`,
            cv.guestModeAllowed ? 'Yes' : 'No',
            `"${cv.externalClickLink || ''}"`,
            `"${cv.memo || ''}"`,
            `"${cv.customPayload || ''}"`,
            `"${cv.maintenanceStartDate || ''}"`,
            `"${cv.maintenanceEndDate || ''}"`,
            `"${cv.maintenanceMessage || ''}"`,
            cv.supportsMultiLanguage ? 'Yes' : 'No',
            `"${cv.tags ? cv.tags.map(tag => tag.name).join('; ') : ''}"`,
            `"${cv.createdByName || t('dashboard.unknown')}"`,
            `"${cv.createdByEmail || ''}"`,
            `"${new Date(cv.createdAt).toLocaleDateString()}"`,
            `"${cv.updatedByName || ''}"`,
            `"${cv.updatedByEmail || ''}"`,
            `"${new Date(cv.updatedAt).toLocaleDateString()}"`,
          ].join(','))
        ].join('\n');
        blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        filename = `client-versions-selected-${dateTimeStr}.csv`;
      } else if (format === 'json') {
        blob = new Blob([JSON.stringify(selectedVersions, null, 2)], { type: 'application/json' });
        filename = `client-versions-selected-${dateTimeStr}.json`;
      } else if (format === 'xlsx') {
        // XLSX 내보내기 - 선택된 항목들
        const headers = [
          'ID', 'Platform', 'Version', 'Status', 'Game Server', 'Game Server (Whitelist)',
          'Patch Address', 'Patch Address (Whitelist)', 'Guest Mode', 'External Click Link',
          'Memo', 'Custom Payload', 'Maintenance Start', 'Maintenance End', 'Maintenance Message',
          'Multi Language', 'Tags', 'Created By', 'Created By Email', 'Created At',
          'Updated By', 'Updated By Email', 'Updated At'
        ];

        const data = selectedVersions.map(cv => ({
          'ID': cv.id,
          'Platform': cv.platform,
          'Version': cv.clientVersion,
          'Status': cv.clientStatus,
          'Game Server': cv.gameServerAddress,
          'Game Server (Whitelist)': cv.gameServerAddressForWhiteList || '',
          'Patch Address': cv.patchAddress,
          'Patch Address (Whitelist)': cv.patchAddressForWhiteList || '',
          'Guest Mode': cv.guestModeAllowed ? 'Yes' : 'No',
          'External Click Link': cv.externalClickLink || '',
          'Memo': cv.memo || '',
          'Custom Payload': cv.customPayload || '',
          'Maintenance Start': cv.maintenanceStartDate || '',
          'Maintenance End': cv.maintenanceEndDate || '',
          'Maintenance Message': cv.maintenanceMessage || '',
          'Multi Language': cv.supportsMultiLanguage ? 'Yes' : 'No',
          'Tags': cv.tags ? cv.tags.map(tag => tag.name).join('; ') : '',
          'Created By': cv.createdByName || t('dashboard.unknown'),
          'Created By Email': cv.createdByEmail || '',
          'Created At': new Date(cv.createdAt).toLocaleDateString(),
          'Updated By': cv.updatedByName || '',
          'Updated By Email': cv.updatedByEmail || '',
          'Updated At': new Date(cv.updatedAt).toLocaleDateString(),
        }));

        // XLSX 워크북 생성
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Selected Client Versions');

        // 컬럼 너비 자동 조정
        const colWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
        worksheet['!cols'] = colWidths;

        // XLSX 파일 생성
        const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        blob = new Blob([xlsxBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        filename = `client-versions-selected-${dateTimeStr}.xlsx`;
      } else {
        enqueueSnackbar('Unsupported export format', { variant: 'warning' });
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

      enqueueSnackbar(t('clientVersions.exportSuccess'), { variant: 'success' });
      setSelectedExportMenuAnchor(null);
    } catch (error: any) {
      console.error('Failed to export selected versions:', error);
      enqueueSnackbar(error.message || t('clientVersions.exportSelectedError'), { variant: 'error' });
    }
  }, [selectedIds, clientVersions, t, enqueueSnackbar]);

  // 버전 복사 핸들러
  const handleCopyVersion = useCallback((clientVersion: ClientVersion) => {
    console.log('Copy button clicked for client version:', {
      id: clientVersion.id,
      clientVersion: clientVersion
    });

    // 복사할 데이터 준비 (버전 필드는 비움)
    const copiedData = {
      id: clientVersion.id, // 상세 재조회(maintenanceLocales 포함)를 위해 원본 id를 전달. 저장 시에는 isCopyMode로 신규 생성 처리됨
      platform: clientVersion.platform,
      clientVersion: '', // 버전은 비워둠
      clientStatus: clientVersion.clientStatus,
      gameServerAddress: clientVersion.gameServerAddress,
      gameServerAddressForWhiteList: clientVersion.gameServerAddressForWhiteList || '',
      patchAddress: clientVersion.patchAddress,
      patchAddressForWhiteList: clientVersion.patchAddressForWhiteList || '',
      guestModeAllowed: clientVersion.guestModeAllowed,
      externalClickLink: clientVersion.externalClickLink || '',
      memo: clientVersion.memo || '',
      customPayload: clientVersion.customPayload || '',
      maintenanceStartDate: clientVersion.maintenanceStartDate || '',
      maintenanceEndDate: clientVersion.maintenanceEndDate || '',
      maintenanceMessage: clientVersion.maintenanceMessage || '',
      supportsMultiLanguage: clientVersion.supportsMultiLanguage || false,
      maintenanceLocales: clientVersion.maintenanceLocales || [],
      tags: clientVersion.tags || [],
    };

    // 폼 다이얼로그를 열고 복사된 데이터로 초기화
    console.log('Setting copied data:', copiedData);
    setEditingClientVersion(copiedData as any);
    setIsCopyMode(true);
    setFormDialogOpen(true);


  }, [t, enqueueSnackbar]);

  // 태그 관련 핸들러
  const handleOpenTagDialog = useCallback(async (clientVersion: ClientVersion) => {
    try {
      setSelectedClientVersionForTags(clientVersion);
      const tags = await ClientVersionService.getTags(clientVersion.id!);
      setClientVersionTags(tags);
      setTagDialogOpen(true);
    } catch (error) {
      console.error('Error loading client version tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [t, enqueueSnackbar]);

  const handleSaveTags = useCallback(async (tagIds: number[]) => {
    if (!selectedClientVersionForTags?.id) return;

    try {
      await ClientVersionService.setTags(selectedClientVersionForTags.id, tagIds);
      setTagDialogOpen(false);
      enqueueSnackbar(t('common.success'), { variant: 'success' });
      // 필요시 목록 새로고침
      loadClientVersions();
      loadAvailableVersions(); // 버전 목록도 갱신
    } catch (error) {
      console.error('Error saving client version tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [selectedClientVersionForTags, t, enqueueSnackbar, loadClientVersions, loadAvailableVersions]);

  return (
    <Box sx={{ p: 3 }}>
      {/* 헤더 */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            {t('clientVersions.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('clientVersions.description')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          >
            {t('common.export')}
          </Button>
          <Menu
            anchorEl={exportMenuAnchor}
            open={Boolean(exportMenuAnchor)}
            onClose={() => setExportMenuAnchor(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
          >
            <MenuItem onClick={() => handleExport('csv')}>
              <TableChartIcon sx={{ mr: 1 }} />
              CSV
            </MenuItem>
            <MenuItem onClick={() => handleExport('json')}>
              <JsonIcon sx={{ mr: 1 }} />
              JSON
            </MenuItem>
            <MenuItem onClick={() => handleExport('xlsx')}>
              <ExcelIcon sx={{ mr: 1 }} />
              Excel (XLSX)
            </MenuItem>
          </Menu>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingClientVersion(null);
              setIsCopyMode(false);
              setFormDialogOpen(true);
            }}
          >
            {t('clientVersions.addIndividual')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => {
              setBulkFormDialogOpen(true);
            }}
          >
            {t('clientVersions.addBulk')}
          </Button>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Tooltip title={t('platformDefaults.title')}>
            <IconButton
              aria-label={t('platformDefaults.title')}
              onClick={() => {
                setPlatformDefaultsDialogOpen(true);
              }}
              size="medium"
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* 필터 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel shrink={true}>{t('clientVersions.version')}</InputLabel>
                <Select
                  value={pageState.filters?.version || ''}
                  label={t('clientVersions.version')}
                  onChange={(e) => handleFilterChange({ ...pageState.filters, version: e.target.value || undefined })}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>{t('common.all')}</em>
                  </MenuItem>
                  {versions.map((version) => (
                    <MenuItem key={version} value={version}>
                      {version}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel shrink={true}>{t('clientVersions.platform')}</InputLabel>
                <Select
                  value={pageState.filters?.platform || ''}
                  label={t('clientVersions.platform')}
                  onChange={(e) => handleFilterChange({ ...pageState.filters, platform: e.target.value || undefined })}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>{t('common.all')}</em>
                  </MenuItem>
                  {platforms.map((platform) => (
                    <MenuItem key={platform} value={platform}>
                      {platform}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel shrink={true}>{t('clientVersions.statusLabel')}</InputLabel>
                <Select
                  value={pageState.filters?.clientStatus || ''}
                  label={t('clientVersions.statusLabel')}
                  onChange={(e) => handleFilterChange({ ...pageState.filters, clientStatus: e.target.value as ClientStatus || undefined })}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>{t('common.all')}</em>
                  </MenuItem>
                  {Object.values(ClientStatus).map((status) => (
                    <MenuItem key={status} value={status}>
                      {t(ClientStatusLabels[status])}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel shrink={true}>{t('clientVersions.guestMode')}</InputLabel>
                <Select
                  value={pageState.filters?.guestModeAllowed?.toString() || ''}
                  label={t('clientVersions.guestMode')}
                  onChange={(e) => {
                    const value = e.target.value;
                    const guestModeValue = value === '' ? undefined : value === 'true';
                    console.log('Guest mode filter changed:', { value, guestModeValue });
                    handleFilterChange({
                      ...pageState.filters,
                      guestModeAllowed: guestModeValue
                    });
                  }}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>{t('common.all')}</em>
                  </MenuItem>
                  <MenuItem value="true">{t('common.yes')}</MenuItem>
                  <MenuItem value="false">{t('common.no')}</MenuItem>
                </Select>
              </FormControl>

              {/* 태그 필터 */}
              <Autocomplete
                multiple
                sx={{ minWidth: 400, flexShrink: 0 }}
                options={allTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                value={tagFilter}
                onChange={(_, value) => handleTagFilterChange(value)}
                slotProps={{
                  popper: {
                    style: {
                      zIndex: 9999
                    }
                  }
                }}
                renderValue={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                        <Chip
                          variant="outlined"
                          label={option.name}
                          size="small"
                          sx={{ bgcolor: option.color, color: '#fff', cursor: 'help' }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('common.tags')} size="small" />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* 일괄 작업 툴바 */}
      {selectedIds.length > 0 && (
        <Card sx={{ mb: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(110, 168, 255, 0.08)' : 'rgba(25, 118, 210, 0.04)' }}>
          <CardContent sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                {t('clientVersions.selectedCount', { count: selectedIds.length })}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => setBulkStatusDialogOpen(true)}
                  startIcon={<EditIcon />}
                >
                  {t('clientVersions.changeStatus')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  startIcon={<DeleteIcon />}
                >
                  {t('common.delete')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={(e) => setSelectedExportMenuAnchor(e.currentTarget)}
                  startIcon={<DownloadIcon />}
                  endIcon={<ArrowDropDownIcon />}
                >
                  {t('common.export')}
                </Button>
                <Menu
                  anchorEl={selectedExportMenuAnchor}
                  open={Boolean(selectedExportMenuAnchor)}
                  onClose={() => setSelectedExportMenuAnchor(null)}
                  anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                  }}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                  }}
                >
                  <MenuItem onClick={() => handleExportSelected('csv')}>
                    <TableChartIcon sx={{ mr: 1 }} />
                    CSV
                  </MenuItem>
                  <MenuItem onClick={() => handleExportSelected('json')}>
                    <JsonIcon sx={{ mr: 1 }} />
                    JSON
                  </MenuItem>
                  <MenuItem onClick={() => handleExportSelected('xlsx')}>
                    <ExcelIcon sx={{ mr: 1 }} />
                    Excel (XLSX)
                  </MenuItem>
                </Menu>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSelectedIds([]);
                    setSelectAll(false);
                  }}
                >
                  {t('common.clearSelection')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* 테이블 */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectAll}
                    indeterminate={selectedIds.length > 0 && selectedIds.length < clientVersions.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableCell>
                {/* 버전 컬럼을 맨 앞으로 이동 */}
                <TableCell>
                  {t('clientVersions.version')} ↓
                </TableCell>
                <TableCell>
                  {t('clientVersions.platform')} ↓
                </TableCell>
                <TableCell>
                  {t('clientVersions.statusLabel')}
                </TableCell>
                <TableCell>{t('clientVersions.gameServer')}</TableCell>
                <TableCell>{t('clientVersions.patchAddress')}</TableCell>
                <TableCell align="center">{t('clientVersions.guestMode')}</TableCell>
                <TableCell>
                  {t('common.createdAt')}
                </TableCell>
                <TableCell>{t('common.createdBy')}</TableCell>
                <TableCell>{t('common.tags')}</TableCell>
                <TableCell align="center">{t('common.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clientVersions.length === 0 ? (
                <EmptyTableRow
                  colSpan={12}
                  loading={loading}
                  message={t('clientVersions.noVersionsFound')}
                  loadingMessage={t('common.loadingClientVersions')}
                />
              ) : (
                clientVersions.map((clientVersion) => (
                <TableRow
                  key={clientVersion.id}
                  selected={selectedIds.includes(clientVersion.id)}
                  hover
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(clientVersion.id)}
                      onChange={(e) => handleSelectOne(clientVersion.id, e.target.checked)}
                    />
                  </TableCell>
                  {/* 버전 셀을 앞쪽으로 이동 */}
                  <TableCell>
                    <Chip
                      label={clientVersion.clientVersion}
                      variant="filled"
                      size="small"
                      sx={{
                        width: '100%',
                        justifyContent: 'center',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        ...getVersionColorStyle(clientVersion.clientVersion, theme.palette.mode === 'dark')
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={clientVersion.platform}
                      color="primary"
                      variant="outlined"
                      size="small"
                      sx={{ width: '100%', justifyContent: 'center', fontWeight: 600, borderRadius: '4px' }}
                    />
                  </TableCell>
                  <TableCell>
                    {clientVersion.clientStatus === ClientStatus.MAINTENANCE ? (
                      <Tooltip
                        title={
                          <Box>
                            {clientVersion.maintenanceMessage && (
                              <Typography variant="body2" sx={{ mb: 1 }}>
                                {clientVersion.maintenanceMessage}
                              </Typography>
                            )}
                            {clientVersion.maintenanceStartDate && (
                              <Typography variant="caption" display="block">
                                {t('clientVersions.maintenance.startDate')}: {new Date(clientVersion.maintenanceStartDate).toLocaleString()}
                              </Typography>
                            )}
                            {clientVersion.maintenanceEndDate && (
                              <Typography variant="caption" display="block">
                                {t('clientVersions.maintenance.endDate')}: {new Date(clientVersion.maintenanceEndDate).toLocaleString()}
                              </Typography>
                            )}
                          </Box>
                        }
                        arrow
                        placement="top"
                      >
                        <Chip
                          label={t(ClientStatusLabels[clientVersion.clientStatus])}
                          color={ClientStatusColors[clientVersion.clientStatus]}
                          size="small"
                        />
                      </Tooltip>
                    ) : (
                      <Chip
                        label={t(ClientStatusLabels[clientVersion.clientStatus])}
                        color={ClientStatusColors[clientVersion.clientStatus]}
                        size="small"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={clientVersion.gameServerAddress}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {clientVersion.gameServerAddress}
                        </Typography>
                      </Tooltip>
                      <Tooltip title={t('common.copy')}>
                        <IconButton size="small" onClick={async () => { await navigator.clipboard.writeText(clientVersion.gameServerAddress); enqueueSnackbar(t('common.copied', { type: t('clientVersions.gameServer'), value: clientVersion.gameServerAddress }), { variant: 'success' }); }}>
                          <CopyIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Tooltip title={clientVersion.patchAddress}>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 220 }}>
                          {clientVersion.patchAddress}
                        </Typography>
                      </Tooltip>
                      <Tooltip title={t('common.copy')}>
                        <IconButton size="small" onClick={async () => { await navigator.clipboard.writeText(clientVersion.patchAddress); enqueueSnackbar(t('common.copied', { type: t('clientVersions.patchAddress'), value: clientVersion.patchAddress }), { variant: 'success' }); }}>
                          <CopyIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={clientVersion.guestModeAllowed ? t('common.yes') : t('common.no')}
                      color={clientVersion.guestModeAllowed ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateTimeDetailed(clientVersion.createdAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {clientVersion.createdByName || t('dashboard.unknown')}
                      </Typography>
                      {clientVersion.createdByEmail && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          {clientVersion.createdByEmail}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 200, justifyContent: 'flex-start' }}>
                      {clientVersion.tags && clientVersion.tags.length > 0 ? (
                        clientVersion.tags.map((tag) => (
                          <Tooltip key={tag.id} title={tag.description || tag.name} arrow>
                            <Chip
                              label={tag.name}
                              size="small"
                              sx={{ bgcolor: tag.color, color: '#fff', cursor: 'help' }}
                            />
                          </Tooltip>
                        ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                      <Tooltip title={t('clientVersions.copyVersion')} arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleCopyVersion(clientVersion)}
                          color="primary"
                          sx={{
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'white',
                            },
                          }}
                        >
                          <CopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.edit')} arrow>
                        <IconButton
                          size="small"
                          onClick={() => {
                            console.log('Edit button clicked for client version:', {
                              id: clientVersion.id,
                              clientVersion: clientVersion
                            });
                            setEditingClientVersion(clientVersion);
                            setIsCopyMode(false);
                            setFormDialogOpen(true);
                          }}
                          color="info"
                          sx={{
                            '&:hover': {
                              backgroundColor: 'info.light',
                              color: 'white',
                            },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('common.delete')} arrow>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedClientVersion(clientVersion);
                            setDeleteDialogOpen(true);
                          }}
                          color="error"
                          sx={{
                            '&:hover': {
                              backgroundColor: 'error.light',
                              color: 'white',
                            },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* 페이지네이션 - 데이터가 있을 때만 표시 */}
        {total > 0 && (
          <SimplePagination
            count={total}
            page={pageState.page - 1} // MUI는 0부터 시작
            rowsPerPage={pageState.limit}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[5, 10, 25, 50, 100]}
          />
        )}
      </Card>



      {/* 삭제 확인 Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('clientVersions.deleteConfirmTitle')}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t('clientVersions.deleteConfirmMessage', {
              version: selectedClientVersion?.clientVersion
            })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* 일괄 상태 변경 Drawer */}
      <Drawer
        anchor="right"
        open={bulkStatusDialogOpen}
        onClose={() => setBulkStatusDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 450 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('clientVersions.bulkStatusTitle')}
          </Typography>
          <IconButton
            onClick={() => setBulkStatusDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>{t('clientVersions.statusLabel')}</InputLabel>
            <Select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ClientStatus)}
              label={t('clientVersions.statusLabel')}
              MenuProps={{
                PaperProps: {
                  style: {
                    zIndex: 9999
                  }
                }
              }}
            >
              {Object.values(ClientStatus).map((status) => (
                <MenuItem key={status} value={status}>
                  {t(ClientStatusLabels[status])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setBulkStatusDialogOpen(false)}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBulkStatusUpdate}
            variant="contained"
            startIcon={<UpdateIcon />}
          >
            {t('common.update')}
          </Button>
        </Box>
      </Drawer>



      {/* 클라이언트 버전 추가/편집 폼 */}
      <ClientVersionForm
        open={formDialogOpen}
        onClose={() => {
          setFormDialogOpen(false);
          setEditingClientVersion(null);
          setIsCopyMode(false);
        }}
        onSuccess={() => {
          loadClientVersions();
          loadAvailableVersions(); // 버전 목록도 갱신
          setFormDialogOpen(false);
          setEditingClientVersion(null);
          setIsCopyMode(false);
        }}
        clientVersion={editingClientVersion}
        isCopyMode={isCopyMode}
      />

      {/* 클라이언트 버전 간편 추가 폼 */}
      <BulkClientVersionForm
        open={bulkFormDialogOpen}
        onClose={() => {
          setBulkFormDialogOpen(false);
        }}
        onSuccess={() => {
          loadClientVersions();
          loadAvailableVersions(); // 버전 목록도 갱신
          setBulkFormDialogOpen(false);
        }}
      />

      {/* 플랫폼 기본값 설정 다이얼로그 */}
      <PlatformDefaultsDialog
        open={platformDefaultsDialogOpen}
        onClose={() => setPlatformDefaultsDialogOpen(false)}
      />

      {/* 일괄 삭제 확인 Drawer */}
      <Drawer
        anchor="right"
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 500 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DeleteIcon color="error" />
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {t('clientVersions.bulkDeleteTitle')}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setBulkDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t('clientVersions.bulkDeleteWarning')}
          </Alert>
          <Typography variant="body1">
            {t('clientVersions.bulkDeleteConfirm', { count: selectedIds.length })}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {t('clientVersions.selectedItems')}:
            </Typography>
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {clientVersions
                .filter(cv => selectedIds.includes(cv.id))
                .map(cv => (
                  <Box key={cv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                    <Chip label={cv.platform} size="small" color="primary" variant="outlined" sx={{ width: '100%', justifyContent: 'center', borderRadius: '4px' }} />
                    <Chip label={cv.clientVersion} size="small" color="info" variant="filled" sx={{ width: '100%', justifyContent: 'center', borderRadius: '4px' }} />
                  </Box>
                ))}
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setBulkDeleteDialogOpen(false)}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* 태그 관리 Drawer */}
      <Drawer
        anchor="right"
        open={tagDialogOpen}
        onClose={() => setTagDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('common.tags')} - {selectedClientVersionForTags?.clientVersion} ({selectedClientVersionForTags?.platform})
          </Typography>
          <IconButton
            onClick={() => setTagDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Autocomplete
            multiple
            options={allTags}
            getOptionLabel={(option) => option.name}
            filterSelectedOptions
            isOptionEqualToValue={(option, value) => option.id === value.id}
            value={clientVersionTags}
            onChange={(_, newValue) => setClientVersionTags(newValue)}
            slotProps={{
              popper: {
                style: {
                  zIndex: 9999
                }
              }
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                  <Chip
                    variant="outlined"
                    label={option.name}
                    size="small"
                    sx={{ bgcolor: option.color, color: '#fff', cursor: 'help' }}
                    {...getTagProps({ index })}
                  />
                </Tooltip>
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('common.tags')}
                placeholder={t('common.selectTags')}
                size="small"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={option.name}
                    size="small"
                    sx={{ bgcolor: option.color, color: '#fff', cursor: 'help' }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {option.description || t('tags.noDescription')}
                  </Typography>
                </Box>
              </li>
            )}
          />
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setTagDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => handleSaveTags(clientVersionTags.map(tag => tag.id))}
            variant="contained"
          >
            {t('common.save')}
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
};

export default ClientVersionsPage;
