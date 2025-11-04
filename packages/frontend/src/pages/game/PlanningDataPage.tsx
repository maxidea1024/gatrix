import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TableSortLabel,
  FormControlLabel,
  Checkbox,
  Tooltip,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  CardGiftcard as GiftIcon,
  Category as CategoryIcon,
  Schedule as ScheduleIcon,
  CloudUpload as CloudUploadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService, { PlanningDataStats, HotTimeBuffLookup, HotTimeBuffItem } from '../../services/planningDataService';
import SimplePagination from '../../components/common/SimplePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import PlanningDataUpload from '../../components/planning-data/PlanningDataUpload';

const PlanningDataPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [stats, setStats] = useState<PlanningDataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('planningDataActiveTab');
    return saved ? parseInt(saved) : 0;
  });
  const [uiListTab, setUiListTab] = useState(() => {
    const saved = sessionStorage.getItem('planningDataUiListTab');
    return saved ? parseInt(saved) : 0;
  });
  const [categoryItems, setCategoryItems] = useState<Record<string, any[]>>({});
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Reward type filter state - persist in sessionStorage
  const [selectedRewardTypeIndex, setSelectedRewardTypeIndex] = useState(() => {
    const saved = sessionStorage.getItem('planningDataSelectedRewardType');
    return saved ? parseInt(saved) : 0;
  });

  // Sort state
  const [sortBy, setSortBy] = useState<'id' | 'name'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // View all state - persist in sessionStorage
  const [viewAllRewardItems, setViewAllRewardItems] = useState(() => {
    const saved = sessionStorage.getItem('planningDataViewAllRewardItems');
    return saved === 'true';
  });
  const [viewAllUiItems, setViewAllUiItems] = useState(() => {
    const saved = sessionStorage.getItem('planningDataViewAllUiItems');
    return saved === 'true';
  });

  // HotTimeBuff state
  const [hotTimeBuffData, setHotTimeBuffData] = useState<HotTimeBuffLookup | null>(null);
  const [loadingHotTimeBuff, setLoadingHotTimeBuff] = useState(false);
  const [hotTimeBuffPage, setHotTimeBuffPage] = useState(0);
  const [hotTimeBuffRowsPerPage, setHotTimeBuffRowsPerPage] = useState(20);
  const [hotTimeBuffSearchTerm, setHotTimeBuffSearchTerm] = useState('');
  const debouncedHotTimeBuffSearchTerm = useDebounce(hotTimeBuffSearchTerm, 300);
  const [hotTimeBuffSortBy, setHotTimeBuffSortBy] = useState<'id' | 'startDate'>('id');
  const [hotTimeBuffSortOrder, setHotTimeBuffSortOrder] = useState<'asc' | 'desc'>('asc');
  const [viewAllHotTimeBuff, setViewAllHotTimeBuff] = useState(() => {
    const saved = sessionStorage.getItem('planningDataViewAllHotTimeBuff');
    return saved === 'true';
  });

  // EventPage state
  const [eventPageData, setEventPageData] = useState<any>(null);
  const [loadingEventPage, setLoadingEventPage] = useState(false);
  const [eventPagePage, setEventPagePage] = useState(0);
  const [eventPageRowsPerPage, setEventPageRowsPerPage] = useState(20);
  const [eventPageSearchTerm, setEventPageSearchTerm] = useState('');
  const debouncedEventPageSearchTerm = useDebounce(eventPageSearchTerm, 300);
  const [viewAllEventPage, setViewAllEventPage] = useState(() => {
    const saved = sessionStorage.getItem('planningDataViewAllEventPage');
    return saved === 'true';
  });

  // LiveEvent state
  const [liveEventData, setLiveEventData] = useState<any>(null);
  const [loadingLiveEvent, setLoadingLiveEvent] = useState(false);
  const [liveEventPage, setLiveEventPage] = useState(0);
  const [liveEventRowsPerPage, setLiveEventRowsPerPage] = useState(20);
  const [liveEventSearchTerm, setLiveEventSearchTerm] = useState('');
  const debouncedLiveEventSearchTerm = useDebounce(liveEventSearchTerm, 300);
  const [viewAllLiveEvent, setViewAllLiveEvent] = useState(() => {
    const saved = sessionStorage.getItem('planningDataViewAllLiveEvent');
    return saved === 'true';
  });

  // MateRecruitingGroup state
  const [mateRecruitingGroupData, setMateRecruitingGroupData] = useState<any>(null);
  const [loadingMateRecruitingGroup, setLoadingMateRecruitingGroup] = useState(false);
  const [mateRecruitingGroupPage, setMateRecruitingGroupPage] = useState(0);
  const [mateRecruitingGroupRowsPerPage, setMateRecruitingGroupRowsPerPage] = useState(20);
  const [mateRecruitingGroupSearchTerm, setMateRecruitingGroupSearchTerm] = useState('');
  const debouncedMateRecruitingGroupSearchTerm = useDebounce(mateRecruitingGroupSearchTerm, 300);
  const [viewAllMateRecruitingGroup, setViewAllMateRecruitingGroup] = useState(() => {
    const saved = sessionStorage.getItem('planningDataViewAllMateRecruitingGroup');
    return saved === 'true';
  });

  // OceanNpcAreaSpawner state
  const [oceanNpcAreaSpawnerData, setOceanNpcAreaSpawnerData] = useState<any>(null);
  const [loadingOceanNpcAreaSpawner, setLoadingOceanNpcAreaSpawner] = useState(false);
  const [oceanNpcAreaSpawnerPage, setOceanNpcAreaSpawnerPage] = useState(0);
  const [oceanNpcAreaSpawnerRowsPerPage, setOceanNpcAreaSpawnerRowsPerPage] = useState(20);
  const [oceanNpcAreaSpawnerSearchTerm, setOceanNpcAreaSpawnerSearchTerm] = useState('');
  const debouncedOceanNpcAreaSpawnerSearchTerm = useDebounce(oceanNpcAreaSpawnerSearchTerm, 300);
  const [viewAllOceanNpcAreaSpawner, setViewAllOceanNpcAreaSpawner] = useState(() => {
    const saved = sessionStorage.getItem('planningDataViewAllOceanNpcAreaSpawner');
    return saved === 'true';
  });



  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Reload data when language changes
  useEffect(() => {
    // Clear all cached data when language changes
    setHotTimeBuffData(null);
    setEventPageData(null);
    setLiveEventData(null);
    setMateRecruitingGroupData(null);
    setOceanNpcAreaSpawnerData(null);
    setCategoryItems({});

    // Reload current tab data
    if (activeTab === 2) {
      loadHotTimeBuff();
    } else if (activeTab === 3) {
      loadEventPage();
    } else if (activeTab === 4) {
      loadLiveEvent();
    } else if (activeTab === 5) {
      loadMateRecruitingGroup();
    } else if (activeTab === 6) {
      loadOceanNpcAreaSpawner();
    }
  }, [i18n.language]);

  // Load data for active tab when tab changes or on mount
  useEffect(() => {
    if (activeTab === 2 && !hotTimeBuffData) {
      loadHotTimeBuff();
    } else if (activeTab === 3 && !eventPageData) {
      loadEventPage();
    } else if (activeTab === 4 && !liveEventData) {
      loadLiveEvent();
    } else if (activeTab === 5 && !mateRecruitingGroupData) {
      loadMateRecruitingGroup();
    } else if (activeTab === 6 && !oceanNpcAreaSpawnerData) {
      loadOceanNpcAreaSpawner();
    }
  }, [activeTab, hotTimeBuffData, eventPageData, liveEventData, mateRecruitingGroupData, oceanNpcAreaSpawnerData]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await planningDataService.getStats();
      console.log('Stats data received:', data);
      if (!data) {
        throw new Error('Stats data is null or undefined');
      }
      setStats(data);
    } catch (error: any) {
      // Extract user-friendly error message
      let errorMessage = t('planningData.errors.loadStatsFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      console.error('Error loading stats:', error);
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadHotTimeBuff = async () => {
    try {
      setLoadingHotTimeBuff(true);
      const data = await planningDataService.getHotTimeBuffLookup();
      console.log('HotTimeBuff data loaded:', data);
      if (data?.items?.[0]) {
        console.log('First HotTimeBuff item:', data.items[0]);
      }
      setHotTimeBuffData(data);
    } catch (error: any) {
      let errorMessage = t('planningData.errors.loadStatsFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingHotTimeBuff(false);
    }
  };

  const loadEventPage = async () => {
    try {
      setLoadingEventPage(true);
      const data = await planningDataService.getEventPageLookup();
      console.log('EventPage data loaded:', data);
      if (data?.items?.[0]) {
        console.log('First EventPage item:', data.items[0]);
      }
      setEventPageData(data);
    } catch (error: any) {
      let errorMessage = t('planningData.errors.loadStatsFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingEventPage(false);
    }
  };

  const loadLiveEvent = async () => {
    try {
      setLoadingLiveEvent(true);
      const data = await planningDataService.getLiveEventLookup();
      console.log('LiveEvent data loaded:', data);
      if (data?.items?.[0]) {
        console.log('First LiveEvent item:', data.items[0]);
      }
      setLiveEventData(data);
    } catch (error: any) {
      let errorMessage = t('planningData.errors.loadStatsFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingLiveEvent(false);
    }
  };

  const loadMateRecruitingGroup = async () => {
    try {
      setLoadingMateRecruitingGroup(true);
      const data = await planningDataService.getMateRecruitingGroupLookup();
      setMateRecruitingGroupData(data);
    } catch (error: any) {
      let errorMessage = t('planningData.errors.loadStatsFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingMateRecruitingGroup(false);
    }
  };

  const loadOceanNpcAreaSpawner = async () => {
    try {
      setLoadingOceanNpcAreaSpawner(true);
      const data = await planningDataService.getOceanNpcAreaSpawnerLookup();
      setOceanNpcAreaSpawnerData(data);
    } catch (error: any) {
      let errorMessage = t('planningData.errors.loadStatsFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingOceanNpcAreaSpawner(false);
    }
  };

  const handleRebuild = async () => {
    // Open upload dialog
    setShowUploadDialog(true);
  };

  const handleUploadSuccess = async () => {
    // Close upload dialog
    setShowUploadDialog(false);

    // Refresh all data after successful upload
    // Reset all cached data to force reload
    setStats(null);
    setHotTimeBuffData(null);
    setEventPageData(null);
    setLiveEventData(null);
    setMateRecruitingGroupData(null);
    setOceanNpcAreaSpawnerData(null);
    setCategoryItems({});
    setRewardTypeItems({});

    // Reload stats which will trigger other data loads
    await loadStats();
  };



  // Copy to clipboard on Ctrl+Click
  const handleCellClick = (event: React.MouseEvent, text: string) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      navigator.clipboard.writeText(text).then(() => {
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' });
      }).catch(() => {
        enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
      });
    }
  };

  // UI List categories
  const uiListCategories = useMemo(() => {
    if (!stats?.uiListCounts) return [];
    return Object.entries(stats.uiListCounts).map(([key, count]) => ({
      key,
      count,
    }));
  }, [stats]);

  // Get current UI list category
  const currentCategory = useMemo(() => {
    if (uiListCategories.length === 0) return null;
    return uiListCategories[uiListTab]?.key || null;
  }, [uiListCategories, uiListTab]);

  // Load items for current category
  useEffect(() => {
    if (activeTab === 1 && currentCategory && !categoryItems[currentCategory]) {
      const loadItems = async () => {
        try {
          setLoadingCategory(currentCategory);
          const language = i18n.language === 'zh' ? 'cn' : i18n.language === 'en' ? 'en' : 'kr';
          const items = await planningDataService.getUIListItems(currentCategory, language);
          setCategoryItems(prev => ({ ...prev, [currentCategory]: items }));
        } catch (error: any) {
          // Extract user-friendly error message
          let errorMessage = t('planningData.errors.loadItemsFailed');
          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.message && !error.message.includes('function')) {
            errorMessage = error.message;
          }
          enqueueSnackbar(errorMessage, { variant: 'error' });
        } finally {
          setLoadingCategory(null);
        }
      };
      loadItems();
    }
  }, [activeTab, currentCategory, categoryItems, i18n.language, enqueueSnackbar, t]);

  // Get current selected reward type
  const currentRewardType = useMemo(() => {
    if (!stats?.rewardTypes || stats.rewardTypes.length === 0) return null;
    return stats.rewardTypes[selectedRewardTypeIndex] || null;
  }, [stats?.rewardTypes, selectedRewardTypeIndex]);

  // Load reward items for current reward type
  const [rewardTypeItems, setRewardTypeItems] = useState<Record<number, any[]>>({});
  const [loadingRewardType, setLoadingRewardType] = useState<number | null>(null);

  useEffect(() => {
    if (activeTab === 0 && currentRewardType && currentRewardType.hasTable && !rewardTypeItems[currentRewardType.value]) {
      const loadItems = async () => {
        try {
          setLoadingRewardType(currentRewardType.value);
          const language = i18n.language === 'zh' ? 'zh' : i18n.language === 'en' ? 'en' : 'kr';
          const items = await planningDataService.getRewardTypeItems(currentRewardType.value, language);
          setRewardTypeItems(prev => ({ ...prev, [currentRewardType.value]: items }));
        } catch (error: any) {
          // Extract user-friendly error message
          let errorMessage = t('planningData.errors.loadItemsFailed');
          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.message && !error.message.includes('function')) {
            errorMessage = error.message;
          }
          enqueueSnackbar(errorMessage, { variant: 'error' });
        } finally {
          setLoadingRewardType(null);
        }
      };
      loadItems();
    }
  }, [activeTab, currentRewardType, rewardTypeItems, i18n.language, enqueueSnackbar, t]);

  // Filtered reward items based on search
  const filteredRewardItems = useMemo(() => {
    if (!currentRewardType || !rewardTypeItems[currentRewardType.value]) return [];
    let items = rewardTypeItems[currentRewardType.value];

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      items = items.filter((item: any) => {
        // Search by ID (convert to string for comparison)
        const idMatch = item.id.toString().includes(searchLower);
        // Search by name
        const nameMatch = item.name?.toLowerCase().includes(searchLower);
        return idMatch || nameMatch;
      });
    }

    // Apply sorting
    const sorted = [...items].sort((a: any, b: any) => {
      let compareResult = 0;
      if (sortBy === 'id') {
        compareResult = a.id - b.id;
      } else {
        compareResult = (a.name || '').localeCompare(b.name || '');
      }
      return sortOrder === 'asc' ? compareResult : -compareResult;
    });

    return sorted;
  }, [currentRewardType, rewardTypeItems, debouncedSearchTerm, sortBy, sortOrder]);

  // Paginated reward items
  const paginatedRewardItems = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredRewardItems.slice(start, end);
  }, [filteredRewardItems, page, rowsPerPage]);

  // Filtered items based on search (for UI Lists tab)
  const filteredItems = useMemo(() => {
    if (!currentCategory || !categoryItems[currentCategory]) return [];
    let items = categoryItems[currentCategory];

    // Apply search filter
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      items = items.filter((item: any) => {
        // Search by ID (convert to string for comparison)
        const idMatch = item.id.toString().includes(searchLower);
        // Search by name
        const nameMatch = item.name?.toLowerCase().includes(searchLower);
        return idMatch || nameMatch;
      });
    }

    // Apply sorting
    const sorted = [...items].sort((a: any, b: any) => {
      let compareResult = 0;
      if (sortBy === 'id') {
        compareResult = a.id - b.id;
      } else {
        compareResult = (a.name || '').localeCompare(b.name || '');
      }
      return sortOrder === 'asc' ? compareResult : -compareResult;
    });

    return sorted;
  }, [currentCategory, categoryItems, debouncedSearchTerm, sortBy, sortOrder]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredItems.slice(start, end);
  }, [filteredItems, page, rowsPerPage]);

  // Handle tab changes
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    sessionStorage.setItem('planningDataActiveTab', newValue.toString());
    // Load data when switching to each tab
    if (newValue === 2 && !hotTimeBuffData) {
      loadHotTimeBuff();
    } else if (newValue === 3 && !eventPageData) {
      loadEventPage();
    } else if (newValue === 4 && !liveEventData) {
      loadLiveEvent();
    } else if (newValue === 5 && !mateRecruitingGroupData) {
      loadMateRecruitingGroup();
    } else if (newValue === 6 && !oceanNpcAreaSpawnerData) {
      loadOceanNpcAreaSpawner();
    }
  };

  const handleRewardTypeChange = (event: any) => {
    const newValue = typeof event === 'number' ? event : event.target.value;
    setSelectedRewardTypeIndex(newValue);
    sessionStorage.setItem('planningDataSelectedRewardType', newValue.toString());
    setPage(0); // Reset page when changing reward type
    setSearchTerm(''); // Clear search when changing reward type
  };

  const handleUiListTabChange = (event: any) => {
    const newValue = typeof event === 'number' ? event : event.target.value;
    setUiListTab(newValue);
    setPage(0); // Reset page when changing category
    setSearchTerm(''); // Clear search when changing category
    sessionStorage.setItem('planningDataUiListTab', newValue.toString());
  };

  // Handle pagination
  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: any) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle sort
  const handleSort = (column: 'id' | 'name') => {
    if (sortBy === column) {
      // Toggle sort order
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Change sort column and reset to ascending
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(0); // Reset to first page when sorting
  };

  // Filtered HotTimeBuff items based on search
  const filteredHotTimeBuffItems = useMemo(() => {
    if (!hotTimeBuffData?.items) return [];
    let items = hotTimeBuffData.items;

    // Apply search filter
    if (debouncedHotTimeBuffSearchTerm) {
      const searchLower = debouncedHotTimeBuffSearchTerm.toLowerCase();
      items = items.filter((item: HotTimeBuffItem) => {
        const idMatch = item.id.toString().includes(searchLower);
        const iconMatch = item.icon?.toLowerCase().includes(searchLower);
        const startDateMatch = item.startDate?.toLowerCase().includes(searchLower);
        const endDateMatch = item.endDate?.toLowerCase().includes(searchLower);
        return idMatch || iconMatch || startDateMatch || endDateMatch;
      });
    }

    // Apply sorting
    const sorted = [...items].sort((a: HotTimeBuffItem, b: HotTimeBuffItem) => {
      let compareResult = 0;
      if (hotTimeBuffSortBy === 'id') {
        compareResult = a.id - b.id;
      } else {
        compareResult = a.startDate.localeCompare(b.startDate);
      }
      return hotTimeBuffSortOrder === 'asc' ? compareResult : -compareResult;
    });

    return sorted;
  }, [hotTimeBuffData?.items, debouncedHotTimeBuffSearchTerm, hotTimeBuffSortBy, hotTimeBuffSortOrder]);

  // Paginated HotTimeBuff items
  const paginatedHotTimeBuffItems = useMemo(() => {
    const start = hotTimeBuffPage * hotTimeBuffRowsPerPage;
    const end = start + hotTimeBuffRowsPerPage;
    return filteredHotTimeBuffItems.slice(start, end);
  }, [filteredHotTimeBuffItems, hotTimeBuffPage, hotTimeBuffRowsPerPage]);

  // Handle HotTimeBuff pagination
  const handleHotTimeBuffPageChange = (_event: unknown, newPage: number) => {
    setHotTimeBuffPage(newPage);
  };

  const handleHotTimeBuffRowsPerPageChange = (event: any) => {
    setHotTimeBuffRowsPerPage(parseInt(event.target.value, 10));
    setHotTimeBuffPage(0);
  };

  // Handle HotTimeBuff sort
  const handleHotTimeBuffSort = (column: 'id' | 'startDate') => {
    if (hotTimeBuffSortBy === column) {
      setHotTimeBuffSortOrder(hotTimeBuffSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setHotTimeBuffSortBy(column);
      setHotTimeBuffSortOrder('asc');
    }
    setHotTimeBuffPage(0);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon />
            {t('planningData.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('planningData.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadStats}
            disabled={loading || rebuilding}
          >
            {t('common.refresh')}
          </Button>
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={handleRebuild}
            disabled={loading}
          >
            {t('planningData.uploadData')}
          </Button>
        </Box>
      </Box>

      {/* Upload Dialog Modal */}
      {showUploadDialog && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1300,
          }}
          onClick={() => setShowUploadDialog(false)}
        >
          <Card
            sx={{
              maxWidth: 600,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">{t('planningData.upload.title')}</Typography>
                <Button
                  size="small"
                  onClick={() => setShowUploadDialog(false)}
                  sx={{ minWidth: 'auto' }}
                >
                  ✕
                </Button>
              </Box>
              <PlanningDataUpload
                onUploadSuccess={handleUploadSuccess}
              />
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : stats ? (
        <>
          {/* Tabs */}
          <Card>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab
                icon={<GiftIcon />}
                iconPosition="start"
                label={t('planningData.tabs.rewardTypes')}
                sx={{ minHeight: 48 }}
              />
              <Tab
                icon={<CategoryIcon />}
                iconPosition="start"
                label={t('planningData.tabs.uiLists')}
                sx={{ minHeight: 48 }}
              />
              <Tab
                icon={<ScheduleIcon />}
                iconPosition="start"
                label="HotTimeBuff"
                sx={{ minHeight: 48 }}
              />
              <Tab
                icon={<ScheduleIcon />}
                iconPosition="start"
                label="EventPage"
                sx={{ minHeight: 48 }}
              />
              <Tab
                icon={<ScheduleIcon />}
                iconPosition="start"
                label="LiveEvent"
                sx={{ minHeight: 48 }}
              />
              <Tab
                icon={<ScheduleIcon />}
                iconPosition="start"
                label="MateRecruitingGroup"
                sx={{ minHeight: 48 }}
              />
              <Tab
                icon={<ScheduleIcon />}
                iconPosition="start"
                label="OceanNpcAreaSpawner"
                sx={{ minHeight: 48 }}
              />
            </Tabs>

            <CardContent>
              {/* Reward Types Table */}
              {activeTab === 0 && (
                <Box>
                  {/* Reward Type Items */}
                  {currentRewardType && (
                    <>
                      {/* Reward Type Selector - Always visible */}
                      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                        <FormControl sx={{ minWidth: 250 }}>
                          <InputLabel id="reward-type-select-label">
                            {t('planningData.table.rewardType')}
                          </InputLabel>
                          <Select
                            labelId="reward-type-select-label"
                            value={selectedRewardTypeIndex}
                            onChange={handleRewardTypeChange}
                            label={t('planningData.table.rewardType')}
                            size="small"
                          >
                            {stats.rewardTypes.map((type, index) => (
                              <MenuItem key={type.value} value={index}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                  <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                    [{type.value}] {t(type.nameKey)}
                                  </Typography>
                                  {type.hasTable && (
                                    <Chip label={type.itemCount} size="small" />
                                  )}
                                </Box>
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>

                        {/* Search box - only for types with table */}
                        {currentRewardType.hasTable && (
                          <TextField
                            placeholder={t('planningData.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => {
                              setSearchTerm(e.target.value);
                              setPage(0);
                            }}
                            sx={{
                              width: '30%',
                              '& .MuiOutlinedInput-root': {
                                height: '40px',
                                borderRadius: '20px',
                                bgcolor: 'background.paper',
                                transition: 'all 0.2s ease-in-out',
                                '& fieldset': {
                                  borderColor: 'divider',
                                },
                                '&:hover': {
                                  bgcolor: 'action.hover',
                                  '& fieldset': {
                                    borderColor: 'primary.light',
                                  }
                                },
                                '&.Mui-focused': {
                                  bgcolor: 'background.paper',
                                  boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                                  '& fieldset': {
                                    borderColor: 'primary.main',
                                    borderWidth: '1px',
                                  }
                                }
                              },
                              '& .MuiInputBase-input': {
                                fontSize: '0.875rem',
                              }
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                </InputAdornment>
                              ),
                              endAdornment: searchTerm && (
                                <InputAdornment position="end">
                                  <ClearIcon
                                    sx={{
                                      color: 'text.secondary',
                                      fontSize: 20,
                                      cursor: 'pointer',
                                      '&:hover': {
                                        color: 'text.primary',
                                      }
                                    }}
                                    onClick={() => {
                                      setSearchTerm('');
                                      setPage(0);
                                    }}
                                  />
                                </InputAdornment>
                              ),
                            }}
                            size="small"
                          />
                        )}

                        {/* View All checkbox - only for types with table */}
                        {currentRewardType.hasTable && (
                          <Tooltip title={t('planningData.viewAllWarning')} arrow>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={viewAllRewardItems}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setViewAllRewardItems(newValue);
                                    sessionStorage.setItem('planningDataViewAllRewardItems', newValue.toString());
                                  }}
                                  size="small"
                                />
                              }
                              label={t('planningData.viewAll')}
                            />
                          </Tooltip>
                        )}
                      </Box>

                      {loadingRewardType === currentRewardType.value ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                          <CircularProgress />
                        </Box>
                      ) : currentRewardType.hasTable && rewardTypeItems[currentRewardType.value] ? (
                        <>
                          {viewAllRewardItems ? (
                            /* Grid view - show all items in table-like layout */
                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                              gap: 0,
                              border: '1px dashed',
                              borderColor: 'divider',
                              borderRadius: 1,
                              overflow: 'hidden',
                            }}>
                              {filteredRewardItems.map((item: any) => {
                                // Get localized name based on current language
                                let displayName = item.name;
                                if (i18n.language === 'zh' && item.nameCn) {
                                  displayName = item.nameCn;
                                } else if (i18n.language === 'en' && item.nameEn) {
                                  displayName = item.nameEn;
                                } else if (item.nameKr) {
                                  displayName = item.nameKr;
                                }

                                const label = `${item.id}: ${displayName}`;

                                return (
                                  <Tooltip key={item.id} title={label} arrow>
                                    <Box
                                      sx={{
                                        p: 1,
                                        borderRight: '1px dashed',
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        bgcolor: 'background.paper',
                                        transition: 'background-color 0.2s',
                                        '&:hover': {
                                          bgcolor: 'action.hover',
                                        }
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          ) : (
                            /* Table view - paginated */
                            <>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small" sx={{ tableLayout: 'auto' }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>
                                        <TableSortLabel
                                          active={sortBy === 'id'}
                                          direction={sortBy === 'id' ? sortOrder : 'asc'}
                                          onClick={() => handleSort('id')}
                                        >
                                          ID
                                        </TableSortLabel>
                                      </TableCell>
                                      <TableCell>
                                        <TableSortLabel
                                          active={sortBy === 'name'}
                                          direction={sortBy === 'name' ? sortOrder : 'asc'}
                                          onClick={() => handleSort('name')}
                                        >
                                          {t('planningData.table.name')}
                                        </TableSortLabel>
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {paginatedRewardItems.map((item: any) => {
                                      // Get localized name based on current language
                                      let displayName = item.name;
                                      if (i18n.language === 'zh' && item.nameCn) {
                                        displayName = item.nameCn;
                                      } else if (i18n.language === 'en' && item.nameEn) {
                                        displayName = item.nameEn;
                                      } else if (item.nameKr) {
                                        displayName = item.nameKr;
                                      }

                                      return (
                                        <TableRow key={item.id} hover>
                                          <TableCell
                                            onClick={(e) => handleCellClick(e, item.id.toString())}
                                            sx={{ cursor: 'pointer' }}
                                          >
                                            <Chip label={item.id} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell
                                            onClick={(e) => handleCellClick(e, displayName)}
                                            sx={{ cursor: 'pointer' }}
                                          >
                                            {displayName}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableContainer>

                              {/* Pagination */}
                              {filteredRewardItems.length > 0 && (
                                <SimplePagination
                                  count={filteredRewardItems.length}
                                  page={page}
                                  rowsPerPage={rowsPerPage}
                                  onPageChange={handlePageChange}
                                  onRowsPerPageChange={handleRowsPerPageChange}
                                  rowsPerPageOptions={[10, 20, 50, 100]}
                                />
                              )}
                            </>
                          )}
                        </>
                      ) : !currentRewardType.hasTable ? (
                        <Box sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          py: 8,
                          px: 4,
                          bgcolor: 'background.paper',
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}>
                          <Typography variant="body1" color="text.primary" sx={{ mb: 1, fontWeight: 500 }}>
                            📊 {t(currentRewardType.nameKey)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 600 }}>
                            {t('planningData.noTableForRewardType')}
                          </Typography>
                        </Box>
                      ) : null}
                    </>
                  )}
                </Box>
              )}

              {/* UI Lists */}
              {activeTab === 1 && uiListCategories.length > 0 && (
                <Box>
                  {/* Category Items */}
                  {currentCategory && (
                    <>
                      {loadingCategory === currentCategory ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                          <CircularProgress />
                        </Box>
                      ) : categoryItems[currentCategory] ? (
                        <>
                          {/* Category Selector and Search Box */}
                          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                            <FormControl sx={{ minWidth: 250 }}>
                              <InputLabel id="category-select-label">
                                {t('planningData.category')}
                              </InputLabel>
                              <Select
                                labelId="category-select-label"
                                value={uiListTab}
                                onChange={handleUiListTabChange}
                                label={t('planningData.category')}
                                size="small"
                              >
                                {uiListCategories.map((category, index) => (
                                  <MenuItem key={category.key} value={index}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                                        {category.key}
                                      </Typography>
                                      <Chip label={category.count} size="small" />
                                    </Box>
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            <TextField
                              placeholder={t('planningData.searchPlaceholder')}
                              value={searchTerm}
                              onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(0); // Reset to first page when searching
                              }}
                              sx={{
                                width: '30%',
                                '& .MuiOutlinedInput-root': {
                                  height: '40px',
                                  borderRadius: '20px',
                                  bgcolor: 'background.paper',
                                  transition: 'all 0.2s ease-in-out',
                                  '& fieldset': {
                                    borderColor: 'divider',
                                  },
                                  '&:hover': {
                                    bgcolor: 'action.hover',
                                    '& fieldset': {
                                      borderColor: 'primary.light',
                                    }
                                  },
                                  '&.Mui-focused': {
                                    bgcolor: 'background.paper',
                                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                                    '& fieldset': {
                                      borderColor: 'primary.main',
                                      borderWidth: '1px',
                                    }
                                  }
                                },
                                '& .MuiInputBase-input': {
                                  fontSize: '0.875rem',
                                }
                              }}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                                  </InputAdornment>
                                ),
                                endAdornment: searchTerm && (
                                  <InputAdornment position="end">
                                    <ClearIcon
                                      sx={{
                                        color: 'text.secondary',
                                        fontSize: 20,
                                        cursor: 'pointer',
                                        '&:hover': {
                                          color: 'text.primary',
                                        }
                                      }}
                                      onClick={() => {
                                        setSearchTerm('');
                                        setPage(0);
                                      }}
                                    />
                                  </InputAdornment>
                                ),
                              }}
                              size="small"
                            />

                            {/* View All checkbox */}
                            <Tooltip title={t('planningData.viewAllWarning')} arrow>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={viewAllUiItems}
                                    onChange={(e) => {
                                      const newValue = e.target.checked;
                                      setViewAllUiItems(newValue);
                                      sessionStorage.setItem('planningDataViewAllUiItems', newValue.toString());
                                    }}
                                    size="small"
                                  />
                                }
                                label={t('planningData.viewAll')}
                              />
                            </Tooltip>
                          </Box>

                          {viewAllUiItems ? (
                            /* Grid view - show all items in table-like layout */
                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                              gap: 0,
                              border: '1px dashed',
                              borderColor: 'divider',
                              borderRadius: 1,
                              overflow: 'hidden',
                            }}>
                              {filteredItems.map((item: any) => {
                                // Get localized name based on current language
                                let displayName = item.name;
                                if (i18n.language === 'zh' && item.nameCn) {
                                  displayName = item.nameCn;
                                } else if (i18n.language === 'en' && item.nameEn) {
                                  displayName = item.nameEn;
                                } else if (item.nameKr) {
                                  displayName = item.nameKr;
                                }

                                const label = `${item.id}: ${displayName}`;
                                const tooltipTitle = item.hasError
                                  ? `⚠️ 오류: ${item.errorMessage}\n${label}`
                                  : label;

                                return (
                                  <Tooltip key={item.id} title={tooltipTitle} arrow>
                                    <Box
                                      sx={{
                                        p: 1,
                                        borderRight: '1px dashed',
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        bgcolor: item.hasError ? 'rgba(255, 205, 210, 0.3)' : 'background.paper',
                                        transition: 'background-color 0.2s',
                                        '&:hover': {
                                          bgcolor: item.hasError ? 'rgba(255, 205, 210, 0.5)' : 'action.hover',
                                        }
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          ) : (
                            /* Table view - paginated */
                            <>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small" sx={{ tableLayout: 'auto' }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>
                                        <TableSortLabel
                                          active={sortBy === 'id'}
                                          direction={sortBy === 'id' ? sortOrder : 'asc'}
                                          onClick={() => handleSort('id')}
                                        >
                                          ID
                                        </TableSortLabel>
                                      </TableCell>
                                      <TableCell>
                                        <TableSortLabel
                                          active={sortBy === 'name'}
                                          direction={sortBy === 'name' ? sortOrder : 'asc'}
                                          onClick={() => handleSort('name')}
                                        >
                                          {t('planningData.table.name')}
                                        </TableSortLabel>
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {paginatedItems.map((item: any) => {
                                      // Get localized name based on current language
                                      let displayName = item.name;
                                      if (i18n.language === 'zh' && item.nameCn) {
                                        displayName = item.nameCn;
                                      } else if (i18n.language === 'en' && item.nameEn) {
                                        displayName = item.nameEn;
                                      } else if (item.nameKr) {
                                        displayName = item.nameKr;
                                      }

                                      return (
                                        <TableRow
                                          key={item.id}
                                          hover
                                          sx={{
                                            bgcolor: item.hasError ? 'rgba(255, 205, 210, 0.3)' : 'inherit',
                                            '&:hover': {
                                              bgcolor: item.hasError ? 'rgba(255, 205, 210, 0.5)' : 'action.hover',
                                            }
                                          }}
                                        >
                                          <TableCell
                                            onClick={(e) => handleCellClick(e, item.id.toString())}
                                            sx={{ cursor: 'pointer' }}
                                          >
                                            <Chip label={item.id} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell
                                            onClick={(e) => handleCellClick(e, displayName)}
                                            sx={{ cursor: 'pointer' }}
                                          >
                                            <Tooltip title={item.hasError ? `⚠️ ${item.errorMessage}` : ''} arrow>
                                              <span>{displayName}</span>
                                            </Tooltip>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableContainer>

                              {/* Pagination */}
                              {filteredItems.length > 0 && (
                                <SimplePagination
                                  count={filteredItems.length}
                                  page={page}
                                  rowsPerPage={rowsPerPage}
                                  onPageChange={handlePageChange}
                                  onRowsPerPageChange={handleRowsPerPageChange}
                                  rowsPerPageOptions={[10, 20, 50, 100]}
                                />
                              )}
                            </>
                          )}
                        </>
                      ) : null}
                    </>
                  )}
                </Box>
              )}

              {/* HotTimeBuff Tab */}
              {activeTab === 2 && (
                <Box>
                  {/* Search and View All controls */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
                    {/* Search box */}
                    <TextField
                      placeholder={t('planningData.searchPlaceholder')}
                      value={hotTimeBuffSearchTerm}
                      onChange={(e) => {
                        setHotTimeBuffSearchTerm(e.target.value);
                        setHotTimeBuffPage(0);
                      }}
                      sx={{
                        width: '30%',
                        '& .MuiOutlinedInput-root': {
                          height: '40px',
                          borderRadius: '20px',
                          bgcolor: 'background.paper',
                          transition: 'all 0.2s ease-in-out',
                          '& fieldset': {
                            borderColor: 'divider',
                          },
                          '&:hover': {
                            bgcolor: 'action.hover',
                            '& fieldset': {
                              borderColor: 'primary.light',
                            }
                          },
                          '&.Mui-focused': {
                            bgcolor: 'background.paper',
                            boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                            '& fieldset': {
                              borderColor: 'primary.main',
                              borderWidth: '1px',
                            }
                          }
                        },
                        '& .MuiInputBase-input': {
                          fontSize: '0.875rem',
                        }
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        endAdornment: hotTimeBuffSearchTerm && (
                          <InputAdornment position="end">
                            <ClearIcon
                              sx={{
                                color: 'text.secondary',
                                fontSize: 20,
                                cursor: 'pointer',
                                '&:hover': {
                                  color: 'text.primary',
                                }
                              }}
                              onClick={() => {
                                setHotTimeBuffSearchTerm('');
                                setHotTimeBuffPage(0);
                              }}
                            />
                          </InputAdornment>
                        ),
                      }}
                      size="small"
                    />

                    {/* View All checkbox */}
                    <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 1 }}>
                      <Tooltip title={t('planningData.viewAllWarning')} arrow>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={viewAllHotTimeBuff}
                              onChange={(e) => {
                                const newValue = e.target.checked;
                                setViewAllHotTimeBuff(newValue);
                                sessionStorage.setItem('planningDataViewAllHotTimeBuff', newValue.toString());
                              }}
                              size="small"
                            />
                          }
                          label={t('planningData.viewAll')}
                        />
                      </Tooltip>
                    </Box>
                  </Box>

                  {loadingHotTimeBuff && !hotTimeBuffData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : hotTimeBuffData && hotTimeBuffData.items && hotTimeBuffData.items.length > 0 ? (
                    <>
                      {viewAllHotTimeBuff ? (
                        /* Grid view - show all items in table-like layout */
                        <Box sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: 0,
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                        }}>
                          {filteredHotTimeBuffItems.map((item: HotTimeBuffItem) => {
                            // Get localized world buff names based on current language
                            let buffNames = 'No Buff';
                            const lang = i18n.language;
                            const krNames = item.worldBuffNamesKr || item.worldBuffNames;
                            const enNames = item.worldBuffNamesEn;
                            const cnNames = item.worldBuffNamesCn;

                            if (lang === 'en') {
                              // If English names exist and are different from Korean (i.e., real translations)
                              if (enNames && enNames.length > 0 && enNames[0] !== krNames?.[0]) {
                                buffNames = enNames.join(', ');
                              } else {
                                buffNames = krNames?.join(', ') || 'No Buff';
                              }
                            } else if (lang === 'zh') {
                              // If Chinese names exist and are different from Korean (i.e., real translations)
                              if (cnNames && cnNames.length > 0 && cnNames[0] !== krNames?.[0]) {
                                buffNames = cnNames.join(', ');
                              } else {
                                buffNames = krNames?.join(', ') || 'No Buff';
                              }
                            } else {
                              // Korean or default
                              buffNames = krNames?.join(', ') || item.worldBuffId?.join(', ') || 'No Buff';
                            }
                            const label = `${item.id}: ${buffNames}`;
                            return (
                              <Tooltip key={item.id} title={label} arrow>
                                <Box
                                  sx={{
                                    p: 1,
                                    borderRight: '1px dashed',
                                    borderBottom: '1px dashed',
                                    borderColor: 'divider',
                                    fontSize: '0.8125rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    bgcolor: 'background.paper',
                                    transition: 'background-color 0.2s',
                                    '&:hover': {
                                      bgcolor: 'action.hover',
                                    }
                                  }}
                                >
                                  {label}
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      ) : (
                        /* Table view - paginated */
                        <>
                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small" sx={{ tableLayout: 'auto' }}>
                              <TableHead>
                                <TableRow>
                                  <TableCell>
                                    <TableSortLabel
                                      active={hotTimeBuffSortBy === 'id'}
                                      direction={hotTimeBuffSortOrder}
                                      onClick={() => handleHotTimeBuffSort('id')}
                                    >
                                      ID
                                    </TableSortLabel>
                                  </TableCell>
                                  <TableCell>Name</TableCell>
                                  <TableCell>Start Date</TableCell>
                                  <TableCell>End Date</TableCell>
                                  <TableCell>Period</TableCell>
                                  <TableCell>Start Hour</TableCell>
                                  <TableCell>End Hour</TableCell>
                                  <TableCell>Min Lv</TableCell>
                                  <TableCell>Max Lv</TableCell>
                                  <TableCell>Day of Week</TableCell>
                                  <TableCell>World Buff</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {paginatedHotTimeBuffItems.map((item: HotTimeBuffItem) => {
                                  // Format date - returns { display, utc }
                                  const formatDate = (isoString: string | null) => {
                                    if (!isoString) return { display: '-', utc: '' };
                                    try {
                                      const date = new Date(isoString);
                                      const localFormatted = formatDateTimeDetailed(isoString);
                                      // Remove milliseconds from UTC time (.000Z -> Z)
                                      const utcDate = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
                                      return { display: localFormatted, utc: utcDate };
                                    } catch {
                                      return { display: '-', utc: '' };
                                    }
                                  };

                                  // Calculate period in days
                                  const calculatePeriod = (startDate: string | null, endDate: string | null) => {
                                    if (!startDate || !endDate) return '-';
                                    try {
                                      const start = new Date(startDate);
                                      const end = new Date(endDate);
                                      const diffTime = Math.abs(end.getTime() - start.getTime());
                                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                      return `${diffDays} days`;
                                    } catch {
                                      return '-';
                                    }
                                  };

                                  // Format hour - returns { display, utc }
                                  const formatHour = (utcHour: number) => {
                                    // Create a date with the UTC hour
                                    const utcDate = new Date();
                                    utcDate.setUTCHours(utcHour, 0, 0, 0);

                                    // Format in user's timezone
                                    const localFormatted = formatDateTimeDetailed(utcDate.toISOString());
                                    const localTime = localFormatted.split(' ')[1] || '00:00:00';
                                    const localHourMin = localTime.substring(0, 5); // HH:mm

                                    // Format UTC time
                                    const utcFormatted = `${utcHour.toString().padStart(2, '0')}:00`;

                                    return { display: localHourMin, utc: utcFormatted };
                                  };

                                  const startDate = formatDate(item.startDate);
                                  const endDate = formatDate(item.endDate);
                                  const startHour = formatHour(item.startHour);
                                  const endHour = formatHour(item.endHour);

                                  return (
                                    <TableRow key={item.id} hover>
                                      <TableCell
                                        onClick={(e) => handleCellClick(e, item.id.toString())}
                                        sx={{ cursor: 'pointer' }}
                                      >
                                        <Chip label={item.id} size="small" variant="outlined" />
                                      </TableCell>
                                      <TableCell
                                        onClick={(e) => handleCellClick(e, item.name || '-')}
                                        sx={{ cursor: 'pointer' }}
                                      >
                                        {item.name || '-'}
                                      </TableCell>
                                      <Tooltip title={`UTC: ${startDate.utc}`} arrow>
                                        <TableCell
                                          onClick={(e) => handleCellClick(e, startDate.display)}
                                          sx={{ cursor: 'pointer' }}
                                        >
                                          {startDate.display}
                                        </TableCell>
                                      </Tooltip>
                                      <Tooltip title={`UTC: ${endDate.utc}`} arrow>
                                        <TableCell
                                          onClick={(e) => handleCellClick(e, endDate.display)}
                                          sx={{ cursor: 'pointer' }}
                                        >
                                          {endDate.display}
                                        </TableCell>
                                      </Tooltip>
                                      <TableCell>{calculatePeriod(item.startDate, item.endDate)}</TableCell>
                                      <Tooltip title={`UTC: ${startHour.utc}`} arrow>
                                        <TableCell>{startHour.display}</TableCell>
                                      </Tooltip>
                                      <Tooltip title={`UTC: ${endHour.utc}`} arrow>
                                        <TableCell>{endHour.display}</TableCell>
                                      </Tooltip>
                                      <TableCell>{item.minLv}</TableCell>
                                      <TableCell>{item.maxLv}</TableCell>
                                      <TableCell>{item.bitFlagDayOfWeek}</TableCell>
                                      <TableCell>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                          {item.worldBuffId && item.worldBuffId.length > 0 ? (
                                            item.worldBuffId.map((buffId, index) => {
                                              // Get localized world buff name based on current language
                                              let buffName = buffId;
                                              const lang = i18n.language;
                                              const krName = item.worldBuffNamesKr?.[index] || item.worldBuffNames?.[index];
                                              const enName = item.worldBuffNamesEn?.[index];
                                              const cnName = item.worldBuffNamesCn?.[index];

                                              if (lang === 'en') {
                                                // If English name exists and is different from Korean (i.e., real translation)
                                                if (enName && enName !== krName) {
                                                  buffName = enName;
                                                } else {
                                                  buffName = krName || buffId;
                                                }
                                              } else if (lang === 'zh') {
                                                // If Chinese name exists and is different from Korean (i.e., real translation)
                                                if (cnName && cnName !== krName) {
                                                  buffName = cnName;
                                                } else {
                                                  buffName = krName || buffId;
                                                }
                                              } else {
                                                // Korean or default
                                                buffName = krName || buffId;
                                              }
                                              return (
                                                <Chip
                                                  key={buffId}
                                                  label={`${buffId}: ${buffName}`}
                                                  size="small"
                                                  variant="outlined"
                                                />
                                              );
                                            })
                                          ) : (
                                            '-'
                                          )}
                                        </Box>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>

                          {/* Pagination */}
                          {filteredHotTimeBuffItems.length > 0 && (
                            <SimplePagination
                              count={filteredHotTimeBuffItems.length}
                              page={hotTimeBuffPage}
                              rowsPerPage={hotTimeBuffRowsPerPage}
                              onPageChange={handleHotTimeBuffPageChange}
                              onRowsPerPageChange={handleHotTimeBuffRowsPerPageChange}
                              rowsPerPageOptions={[10, 20, 50, 100]}
                            />
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                      {t('planningData.noData')}
                    </Typography>
                  )}
                </Box>
              )}

              {/* EventPage Tab */}
              {activeTab === 3 && (
                <Box>
                  {loadingEventPage && !eventPageData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                        <Chip label={`${t('planningData.count')}: ${eventPageData?.items?.length || 0}`} size="small" />
                        <TextField
                          placeholder={t('planningData.search')}
                          value={eventPageSearchTerm}
                          onChange={(e) => {
                            setEventPageSearchTerm(e.target.value);
                            setEventPagePage(0);
                          }}
                          sx={{
                            width: '30%',
                            '& .MuiOutlinedInput-root': {
                              height: '40px',
                              borderRadius: '20px',
                              bgcolor: 'background.paper',
                              transition: 'all 0.2s ease-in-out',
                              '& fieldset': {
                                borderColor: 'divider',
                              },
                              '&:hover': {
                                bgcolor: 'action.hover',
                                '& fieldset': {
                                  borderColor: 'primary.light',
                                }
                              },
                              '&.Mui-focused': {
                                bgcolor: 'background.paper',
                                boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                                '& fieldset': {
                                  borderColor: 'primary.main',
                                  borderWidth: '1px',
                                }
                              }
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '0.875rem',
                            }
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </InputAdornment>
                            ),
                            endAdornment: eventPageSearchTerm && (
                              <InputAdornment position="end">
                                <ClearIcon
                                  sx={{
                                    color: 'text.secondary',
                                    fontSize: 20,
                                    cursor: 'pointer',
                                    '&:hover': { color: 'text.primary' }
                                  }}
                                  onClick={() => {
                                    setEventPageSearchTerm('');
                                    setEventPagePage(0);
                                  }}
                                />
                              </InputAdornment>
                            ),
                          }}
                          size="small"
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 1 }}>
                          <Tooltip title={t('planningData.viewAllWarning')} arrow>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={viewAllEventPage}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setViewAllEventPage(newValue);
                                    sessionStorage.setItem('planningDataViewAllEventPage', newValue.toString());
                                  }}
                                  size="small"
                                />
                              }
                              label={t('planningData.viewAll')}
                            />
                          </Tooltip>
                        </Box>
                      </Box>
                      {eventPageData && eventPageData.items && eventPageData.items.length > 0 ? (
                        <>
                          {viewAllEventPage ? (
                            /* Grid view - show all items in table-like layout */
                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                              gap: 0,
                              border: '1px dashed',
                              borderColor: 'divider',
                              borderRadius: 1,
                              overflow: 'hidden',
                            }}>
                              {eventPageData.items.map((item: any) => {
                                const localizedName = item.name;
                                const groupType = [item.pageGroupName, item.typeName]
                                  .filter((v: any) => v && !String(v).startsWith('Unknown'))
                                  .join('/');
                                const label = groupType ? `${item.id}: ${localizedName} (${groupType})` : `${item.id}: ${localizedName}`;
                                const fullLabel = `ID: ${item.id}\nName: ${localizedName}\nPageGroup: ${(!item.pageGroupName || String(item.pageGroupName).startsWith('Unknown')) ? '-' : item.pageGroupName}\nType: ${(!item.typeName || String(item.typeName).startsWith('Unknown')) ? '-' : item.typeName}`;
                                return (
                                  <Tooltip key={item.id} title={fullLabel} arrow>
                                    <Box
                                      sx={{
                                        p: 1,
                                        borderRight: '1px dashed',
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        bgcolor: 'background.paper',
                                        transition: 'background-color 0.2s',
                                        '&:hover': {
                                          bgcolor: 'action.hover',
                                        }
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          ) : (
                            /* Table view - paginated */
                            <>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small" sx={{ tableLayout: 'auto' }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>ID</TableCell>
                                      <TableCell>Name</TableCell>
                                      <TableCell>PageGroup</TableCell>
                                      <TableCell>Type</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {eventPageData.items.slice(eventPagePage * eventPageRowsPerPage, (eventPagePage + 1) * eventPageRowsPerPage).map((item: any) => (
                                      <TableRow key={item.id} hover>
                                        <TableCell>
                                          <Chip label={item.id} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell>{(!item.pageGroupName || String(item.pageGroupName).startsWith('Unknown')) ? '-' : item.pageGroupName}</TableCell>
                                        <TableCell>{(!item.typeName || String(item.typeName).startsWith('Unknown')) ? '-' : item.typeName}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              {eventPageData.items.length > 0 && (
                                <SimplePagination
                                  count={eventPageData.items.length}
                                  page={eventPagePage}
                                  rowsPerPage={eventPageRowsPerPage}
                                  onPageChange={(_event, newPage) => setEventPagePage(newPage)}
                                  onRowsPerPageChange={(event) => setEventPageRowsPerPage(Number(event.target.value))}
                                  rowsPerPageOptions={[10, 20, 50, 100]}
                                />
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          {t('planningData.noData')}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              )}

              {/* LiveEvent Tab */}
              {activeTab === 4 && (
                <Box>
                  {loadingLiveEvent && !liveEventData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                        <Chip label={`${t('planningData.count')}: ${liveEventData?.items?.length || 0}`} size="small" />
                        <TextField
                          placeholder={t('planningData.search')}
                          value={liveEventSearchTerm}
                          onChange={(e) => {
                            setLiveEventSearchTerm(e.target.value);
                            setLiveEventPage(0);
                          }}
                          sx={{
                            width: '30%',
                            '& .MuiOutlinedInput-root': {
                              height: '40px',
                              borderRadius: '20px',
                              bgcolor: 'background.paper',
                              transition: 'all 0.2s ease-in-out',
                              '& fieldset': {
                                borderColor: 'divider',
                              },
                              '&:hover': {
                                bgcolor: 'action.hover',
                                '& fieldset': {
                                  borderColor: 'primary.light',
                                }
                              },
                              '&.Mui-focused': {
                                bgcolor: 'background.paper',
                                boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                                '& fieldset': {
                                  borderColor: 'primary.main',
                                  borderWidth: '1px',
                                }
                              }
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '0.875rem',
                            }
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </InputAdornment>
                            ),
                            endAdornment: liveEventSearchTerm && (
                              <InputAdornment position="end">
                                <ClearIcon
                                  sx={{
                                    color: 'text.secondary',
                                    fontSize: 20,
                                    cursor: 'pointer',
                                    '&:hover': { color: 'text.primary' }
                                  }}
                                  onClick={() => {
                                    setLiveEventSearchTerm('');
                                    setLiveEventPage(0);
                                  }}
                                />
                              </InputAdornment>
                            ),
                          }}
                          size="small"
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 1 }}>
                          <Tooltip title={t('planningData.viewAllWarning')} arrow>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={viewAllLiveEvent}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setViewAllLiveEvent(newValue);
                                    sessionStorage.setItem('planningDataViewAllLiveEvent', newValue.toString());
                                  }}
                                  size="small"
                                />
                              }
                              label={t('planningData.viewAll')}
                            />
                          </Tooltip>
                        </Box>
                      </Box>
                      {liveEventData && liveEventData.items && liveEventData.items.length > 0 ? (
                        <>
                          {viewAllLiveEvent ? (
                            /* Grid view - show all items in table-like layout */
                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                              gap: 0,
                              border: '1px dashed',
                              borderColor: 'divider',
                              borderRadius: 1,
                              overflow: 'hidden',
                            }}>
                              {liveEventData.items.map((item: any) => {
                                const localizedName = item.name;
                                const label = `${item.id}: ${localizedName ?? item.loginBgmTag ?? String(item.id)}`;
                                return (
                                  <Tooltip key={item.id} title={label} arrow>
                                    <Box
                                      sx={{
                                        p: 1,
                                        borderRight: '1px dashed',
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        bgcolor: 'background.paper',
                                        transition: 'background-color 0.2s',
                                        '&:hover': {
                                          bgcolor: 'action.hover',
                                        }
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          ) : (
                            /* Table view - paginated */
                            <>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small" sx={{ tableLayout: 'auto' }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>ID</TableCell>
                                      <TableCell>Name</TableCell>
                                      <TableCell>Start Date</TableCell>
                                      <TableCell>End Date</TableCell>
                                      <TableCell>Period</TableCell>
                                      <TableCell>Local Bitflag</TableCell>
                                      <TableCell>Is Quest</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {liveEventData.items.slice(liveEventPage * liveEventRowsPerPage, (liveEventPage + 1) * liveEventRowsPerPage).map((item: any) => {
                                      // Format date - returns { display, utc }
                                      const formatDate = (isoString: string | null) => {
                                        if (!isoString) return { display: '-', utc: '' };
                                        try {
                                          // Convert to ISO8601 if needed
                                          const iso = isoString.includes('T') ? isoString : new Date(isoString).toISOString();
                                          const date = new Date(iso);
                                          const localFormatted = formatDateTimeDetailed(iso);
                                          // Remove milliseconds from UTC time (.000Z -> Z)
                                          const utcDate = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
                                          return { display: localFormatted, utc: utcDate };
                                        } catch {
                                          return { display: '-', utc: '' };
                                        }
                                      };

                                      // Calculate period in days
                                      const calculatePeriod = (startDate: string | null, endDate: string | null) => {
                                        if (!startDate || !endDate) return '-';
                                        try {
                                          const startISO = startDate.includes('T') ? startDate : new Date(startDate).toISOString();
                                          const endISO = endDate.includes('T') ? endDate : new Date(endDate).toISOString();
                                          const start = new Date(startISO);
                                          const end = new Date(endISO);
                                          const diffTime = Math.abs(end.getTime() - start.getTime());
                                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                          return `${diffDays} days`;
                                        } catch {
                                          return '-';
                                        }
                                      };

                                      const startDate = formatDate(item.startDate);
                                      const endDate = formatDate(item.endDate);

                                      return (
                                        <TableRow key={item.id} hover>
                                          <TableCell>
                                            <Chip label={item.id} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell>{item.name ?? item.id}</TableCell>
                                          <Tooltip title={`UTC: ${startDate.utc}`} arrow>
                                            <TableCell
                                              onClick={(e) => handleCellClick(e, startDate.display)}
                                              sx={{ cursor: 'pointer' }}
                                            >
                                              {startDate.display}
                                            </TableCell>
                                          </Tooltip>
                                          <Tooltip title={`UTC: ${endDate.utc}`} arrow>
                                            <TableCell
                                              onClick={(e) => handleCellClick(e, endDate.display)}
                                              sx={{ cursor: 'pointer' }}
                                            >
                                              {endDate.display}
                                            </TableCell>
                                          </Tooltip>
                                          <TableCell>{calculatePeriod(item.startDate, item.endDate)}</TableCell>
                                          <TableCell>{item.localBitflag || '-'}</TableCell>
                                          <TableCell>{item.isQuest ? 'Yes' : 'No'}</TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              {liveEventData.items.length > 0 && (
                                <SimplePagination
                                  count={liveEventData.items.length}
                                  page={liveEventPage}
                                  rowsPerPage={liveEventRowsPerPage}
                                  onPageChange={(_event, newPage) => setLiveEventPage(newPage)}
                                  onRowsPerPageChange={(event) => setLiveEventRowsPerPage(Number(event.target.value))}
                                  rowsPerPageOptions={[10, 20, 50, 100]}
                                />
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          {t('planningData.noData')}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              )}

              {/* MateRecruitingGroup Tab */}
              {activeTab === 5 && (
                <Box>
                  {loadingMateRecruitingGroup && !mateRecruitingGroupData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                        <Chip label={`${t('planningData.count')}: ${mateRecruitingGroupData?.items?.length || 0}`} size="small" />
                        <TextField
                          placeholder={t('planningData.search')}
                          value={mateRecruitingGroupSearchTerm}
                          onChange={(e) => {
                            setMateRecruitingGroupSearchTerm(e.target.value);
                            setMateRecruitingGroupPage(0);
                          }}
                          sx={{
                            width: '30%',
                            '& .MuiOutlinedInput-root': {
                              height: '40px',
                              borderRadius: '20px',
                              bgcolor: 'background.paper',
                              transition: 'all 0.2s ease-in-out',
                              '& fieldset': {
                                borderColor: 'divider',
                              },
                              '&:hover': {
                                bgcolor: 'action.hover',
                                '& fieldset': {
                                  borderColor: 'primary.light',
                                }
                              },
                              '&.Mui-focused': {
                                bgcolor: 'background.paper',
                                boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                                '& fieldset': {
                                  borderColor: 'primary.main',
                                  borderWidth: '1px',
                                }
                              }
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '0.875rem',
                            }
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </InputAdornment>
                            ),
                            endAdornment: mateRecruitingGroupSearchTerm && (
                              <InputAdornment position="end">
                                <ClearIcon
                                  sx={{
                                    color: 'text.secondary',
                                    fontSize: 20,
                                    cursor: 'pointer',
                                    '&:hover': { color: 'text.primary' }
                                  }}
                                  onClick={() => {
                                    setMateRecruitingGroupSearchTerm('');
                                    setMateRecruitingGroupPage(0);
                                  }}
                                />
                              </InputAdornment>
                            ),
                          }}
                          size="small"
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 1 }}>
                          <Tooltip title={t('planningData.viewAllWarning')} arrow>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={viewAllMateRecruitingGroup}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setViewAllMateRecruitingGroup(newValue);
                                    sessionStorage.setItem('planningDataViewAllMateRecruitingGroup', newValue.toString());
                                  }}
                                  size="small"
                                />
                              }
                              label={t('planningData.viewAll')}
                            />
                          </Tooltip>
                        </Box>
                      </Box>
                      {mateRecruitingGroupData && mateRecruitingGroupData.items && mateRecruitingGroupData.items.length > 0 ? (
                        <>
                          {viewAllMateRecruitingGroup ? (
                            /* Grid view - show all items in table-like layout */
                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                              gap: 0,
                              border: '1px dashed',
                              borderColor: 'divider',
                              borderRadius: 1,
                              overflow: 'hidden',
                            }}>
                              {mateRecruitingGroupData.items.map((item: any) => {
                                const itemName = item.name;
                                const label = `${item.id}: ${itemName ?? (item.mateId ?? '')}`;
                                const tooltipTitle = item.mateExists === false
                                  ? `⚠️ 오류: 항해사가 MateTemplate에 존재하지 않습니다.\n${label}`
                                  : label;
                                return (
                                  <Tooltip key={item.id} title={tooltipTitle} arrow>
                                    <Box
                                      sx={{
                                        p: 1,
                                        borderRight: '1px dashed',
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        bgcolor: item.mateExists === false ? 'rgba(255, 205, 210, 0.3)' : 'background.paper',
                                        transition: 'background-color 0.2s',
                                        '&:hover': {
                                          bgcolor: item.mateExists === false ? 'rgba(255, 205, 210, 0.5)' : 'action.hover',
                                        }
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          ) : (
                            /* Table view - paginated */
                            <>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small" sx={{ tableLayout: 'auto' }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>ID</TableCell>
                                      <TableCell>Name</TableCell>
                                      <TableCell>Mate</TableCell>
                                      <TableCell>Group</TableCell>
                                      <TableCell>Towns</TableCell>
                                      <TableCell>Probability</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {mateRecruitingGroupData.items.slice(mateRecruitingGroupPage * mateRecruitingGroupRowsPerPage, (mateRecruitingGroupPage + 1) * mateRecruitingGroupRowsPerPage).map((item: any) => {
                                      const itemName = item.name;
                                      const mateName = item.mateName;

                                      return (
                                        <TableRow
                                          key={item.id}
                                          hover
                                          sx={{
                                            bgcolor: item.mateExists === false ? 'rgba(255, 205, 210, 0.3)' : 'inherit',
                                            '&:hover': {
                                              bgcolor: item.mateExists === false ? 'rgba(255, 205, 210, 0.5)' : 'action.hover',
                                            }
                                          }}
                                        >
                                          <TableCell>
                                            <Chip label={item.id} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell>
                                            <Tooltip title={item.mateExists === false ? '⚠️ 항해사가 MateTemplate에 존재하지 않습니다' : ''} arrow>
                                              <span>{itemName ?? item.mateId}</span>
                                            </Tooltip>
                                          </TableCell>
                                          <TableCell>
                                            <Tooltip title={item.mateExists === false ? '⚠️ 항해사가 MateTemplate에 존재하지 않습니다' : ''} arrow>
                                              <Chip
                                                label={`${item.mateId}: ${mateName ?? item.mateId}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ maxWidth: '100%' }}
                                              />
                                            </Tooltip>
                                          </TableCell>
                                          <TableCell>{item.group}</TableCell>
                                          <TableCell>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                              {item.towns && item.towns.length > 0 ? (
                                                item.towns.map((town: any) => {
                                                  // Get localized town name
                                                  let townName = town.nameKr;
                                                  if (i18n.language === 'zh' && town.nameCn) {
                                                    townName = town.nameCn;
                                                  } else if (i18n.language === 'en' && town.nameEn) {
                                                    townName = town.nameEn;
                                                  }

                                                  return (
                                                    <Chip
                                                      key={town.id}
                                                      label={`${town.id}: ${townName}`}
                                                      size="small"
                                                      variant="outlined"
                                                    />
                                                  );
                                                })
                                              ) : (
                                                '-'
                                              )}
                                            </Box>
                                          </TableCell>
                                          <TableCell>
                                            {item.probability ? `${item.probability}%` : '-'}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              {mateRecruitingGroupData.items.length > 0 && (
                                <SimplePagination
                                  count={mateRecruitingGroupData.items.length}
                                  page={mateRecruitingGroupPage}
                                  rowsPerPage={mateRecruitingGroupRowsPerPage}
                                  onPageChange={(_event, newPage) => setMateRecruitingGroupPage(newPage)}
                                  onRowsPerPageChange={(event) => setMateRecruitingGroupRowsPerPage(Number(event.target.value))}
                                  rowsPerPageOptions={[10, 20, 50, 100]}
                                />
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          {t('planningData.noData')}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              )}

              {/* OceanNpcAreaSpawner Tab */}
              {activeTab === 6 && (
                <Box>
                  {loadingOceanNpcAreaSpawner && !oceanNpcAreaSpawnerData ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                    <>
                      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
                        <Chip label={`${t('planningData.count')}: ${oceanNpcAreaSpawnerData?.items?.length || 0}`} size="small" />
                        <TextField
                          placeholder={t('planningData.search')}
                          value={oceanNpcAreaSpawnerSearchTerm}
                          onChange={(e) => {
                            setOceanNpcAreaSpawnerSearchTerm(e.target.value);
                            setOceanNpcAreaSpawnerPage(0);
                          }}
                          sx={{
                            width: '30%',
                            '& .MuiOutlinedInput-root': {
                              height: '40px',
                              borderRadius: '20px',
                              bgcolor: 'background.paper',
                              transition: 'all 0.2s ease-in-out',
                              '& fieldset': {
                                borderColor: 'divider',
                              },
                              '&:hover': {
                                bgcolor: 'action.hover',
                                '& fieldset': {
                                  borderColor: 'primary.light',
                                }
                              },
                              '&.Mui-focused': {
                                bgcolor: 'background.paper',
                                boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                                '& fieldset': {
                                  borderColor: 'primary.main',
                                  borderWidth: '1px',
                                }
                              }
                            },
                            '& .MuiInputBase-input': {
                              fontSize: '0.875rem',
                            }
                          }}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                              </InputAdornment>
                            ),
                            endAdornment: oceanNpcAreaSpawnerSearchTerm && (
                              <InputAdornment position="end">
                                <ClearIcon
                                  sx={{
                                    color: 'text.secondary',
                                    fontSize: 20,
                                    cursor: 'pointer',
                                    '&:hover': { color: 'text.primary' }
                                  }}
                                  onClick={() => {
                                    setOceanNpcAreaSpawnerSearchTerm('');
                                    setOceanNpcAreaSpawnerPage(0);
                                  }}
                                />
                              </InputAdornment>
                            ),
                          }}
                          size="small"
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', ml: 1, gap: 1 }}>
                          <Tooltip title={t('planningData.viewAllWarning')} arrow>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={viewAllOceanNpcAreaSpawner}
                                  onChange={(e) => {
                                    const newValue = e.target.checked;
                                    setViewAllOceanNpcAreaSpawner(newValue);
                                    sessionStorage.setItem('planningDataViewAllOceanNpcAreaSpawner', newValue.toString());
                                  }}
                                  size="small"
                                />
                              }
                              label={t('planningData.viewAll')}
                            />
                          </Tooltip>
                        </Box>
                      </Box>
                      {oceanNpcAreaSpawnerData && oceanNpcAreaSpawnerData.items && oceanNpcAreaSpawnerData.items.length > 0 ? (
                        <>
                          {viewAllOceanNpcAreaSpawner ? (
                            /* Grid view - show all items in table-like layout */
                            <Box sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                              gap: 0,
                              border: '1px dashed',
                              borderColor: 'divider',
                              borderRadius: 1,
                              overflow: 'hidden',
                            }}>
                              {oceanNpcAreaSpawnerData.items.map((item: any) => {
                                // Use localized name
                                const itemName = item.name;
                                const label = itemName ?? `${item.id}: ${item.oceanNpcId}`;
                                const tooltipTitle = item.npcExists === false
                                  ? `${t('planningData.error.npcNotFound')}\n${label}`
                                  : label;
                                return (
                                  <Tooltip key={item.id} title={tooltipTitle} arrow>
                                    <Box
                                      sx={{
                                        p: 1,
                                        borderRight: '1px dashed',
                                        borderBottom: '1px dashed',
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        bgcolor: item.npcExists === false ? 'rgba(255, 205, 210, 0.3)' : 'background.paper',
                                        transition: 'background-color 0.2s',
                                        '&:hover': {
                                          bgcolor: item.npcExists === false ? 'rgba(255, 205, 210, 0.5)' : 'action.hover',
                                        }
                                      }}
                                    >
                                      {label}
                                    </Box>
                                  </Tooltip>
                                );
                              })}
                            </Box>
                          ) : (
                            /* Table view - paginated */
                            <>
                              <TableContainer component={Paper} variant="outlined">
                                <Table size="small" sx={{ tableLayout: 'auto' }}>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>ID</TableCell>
                                      <TableCell>Name</TableCell>
                                      <TableCell>NPC</TableCell>
                                      <TableCell>Radius Type</TableCell>
                                      <TableCell>Radius</TableCell>
                                      <TableCell>Latitude</TableCell>
                                      <TableCell>Longitude</TableCell>
                                      <TableCell>Regen Time</TableCell>
                                      <TableCell>Start Date</TableCell>
                                      <TableCell>End Date</TableCell>
                                      <TableCell>Period</TableCell>
                                      <TableCell>Spawn Hours</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {oceanNpcAreaSpawnerData.items.slice(oceanNpcAreaSpawnerPage * oceanNpcAreaSpawnerRowsPerPage, (oceanNpcAreaSpawnerPage + 1) * oceanNpcAreaSpawnerRowsPerPage).map((item: any) => {
                                      // Radius type mapping with localization
                                      const radiusTypeMap: Record<number, string> = {
                                        0: t('planningData.radiusType.none'),
                                        1: t('planningData.radiusType.circle'),
                                        2: t('planningData.radiusType.square'),
                                        3: t('planningData.radiusType.region')
                                      };
                                      const radiusTypeName = radiusTypeMap[item.radiusType] || item.radiusType;

                                      // Format date - returns { display, utc }
                                      const formatDate = (isoString: string | null) => {
                                        if (!isoString) return { display: '-', utc: '' };
                                        try {
                                          // Convert to ISO8601 if needed
                                          const iso = isoString.includes('T') ? isoString : new Date(isoString).toISOString();
                                          const date = new Date(iso);
                                          const localFormatted = formatDateTimeDetailed(iso);
                                          // Remove milliseconds from UTC time (.000Z -> Z)
                                          const utcDate = date.toISOString().replace(/\.\d{3}Z$/, 'Z');
                                          return { display: localFormatted, utc: utcDate };
                                        } catch {
                                          return { display: '-', utc: '' };
                                        }
                                      };

                                      // Calculate period in days
                                      const calculatePeriod = (startDate: string | null, endDate: string | null) => {
                                        if (!startDate || !endDate) return '-';
                                        try {
                                          const startISO = startDate.includes('T') ? startDate : new Date(startDate).toISOString();
                                          const endISO = endDate.includes('T') ? endDate : new Date(endDate).toISOString();
                                          const start = new Date(startISO);
                                          const end = new Date(endISO);
                                          const diffTime = Math.abs(end.getTime() - start.getTime());
                                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                          return `${diffDays} days`;
                                        } catch {
                                          return '-';
                                        }
                                      };

                                      // Format spawn hours - returns { display, utc }
                                      const formatSpawnHours = (hours: number[] | null) => {
                                        if (!hours || !Array.isArray(hours) || hours.length === 0) return { display: '-', utc: '' };

                                        const formatted = hours.map(utcHour => {
                                          // Create a date with the UTC hour
                                          const utcDate = new Date();
                                          utcDate.setUTCHours(utcHour, 0, 0, 0);

                                          // Format in user's timezone
                                          const localFormatted = formatDateTimeDetailed(utcDate.toISOString());
                                          const localTime = localFormatted.split(' ')[1] || '00:00:00';
                                          const localHourMin = localTime.substring(0, 5); // HH:mm

                                          // Format UTC time
                                          const utcFormatted = `${utcHour.toString().padStart(2, '0')}:00`;

                                          return { local: localHourMin, utc: utcFormatted };
                                        });

                                        const displayText = formatted.map(h => h.local).join(', ');
                                        const utcText = formatted.map(h => h.utc).join(', ');
                                        return { display: displayText, utc: utcText };
                                      };

                                      // Use localized fields
                                      const itemName = item.name;
                                      const npcName = item.npcName;

                                      const startDate = formatDate(item.startDate);
                                      const endDate = formatDate(item.endDate);
                                      const spawnHours = formatSpawnHours(item.spawnHours);

                                      return (
                                        <TableRow
                                          key={item.id}
                                          hover
                                          sx={{
                                            bgcolor: item.npcExists === false ? 'rgba(255, 205, 210, 0.3)' : 'inherit',
                                            '&:hover': {
                                              bgcolor: item.npcExists === false ? 'rgba(255, 205, 210, 0.5)' : 'action.hover',
                                            }
                                          }}
                                        >
                                          <TableCell>
                                            <Chip label={item.id} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell>
                                            <Tooltip title={item.npcExists === false ? t('planningData.error.npcNotFound') : ''} arrow>
                                              <span>{itemName ?? `${item.id}: ${item.oceanNpcId}`}</span>
                                            </Tooltip>
                                          </TableCell>
                                          <TableCell>
                                            <Tooltip title={item.npcExists === false ? t('planningData.error.npcNotFound') : ''} arrow>
                                              <Chip
                                                label={`${item.oceanNpcId}: ${npcName ?? item.oceanNpcId}`}
                                                size="small"
                                                variant="outlined"
                                                sx={{ maxWidth: '100%' }}
                                              />
                                            </Tooltip>
                                          </TableCell>
                                          <TableCell>{radiusTypeName}</TableCell>
                                          <TableCell>{item.radius ?? '-'}</TableCell>
                                          <TableCell>{item.latitude?.toFixed(2) ?? '-'}</TableCell>
                                          <TableCell>{item.longitude?.toFixed(2) ?? '-'}</TableCell>
                                          <TableCell>{item.regenTime ? `${item.regenTime}s` : '-'}</TableCell>
                                          <Tooltip title={`UTC: ${startDate.utc}`} arrow>
                                            <TableCell
                                              onClick={(e) => handleCellClick(e, startDate.display)}
                                              sx={{ cursor: 'pointer' }}
                                            >
                                              {startDate.display}
                                            </TableCell>
                                          </Tooltip>
                                          <Tooltip title={`UTC: ${endDate.utc}`} arrow>
                                            <TableCell
                                              onClick={(e) => handleCellClick(e, endDate.display)}
                                              sx={{ cursor: 'pointer' }}
                                            >
                                              {endDate.display}
                                            </TableCell>
                                          </Tooltip>
                                          <TableCell>{calculatePeriod(item.startDate, item.endDate)}</TableCell>
                                          <Tooltip title={`UTC: ${spawnHours.utc}`} arrow>
                                            <TableCell>{spawnHours.display}</TableCell>
                                          </Tooltip>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                              {oceanNpcAreaSpawnerData.items.length > 0 && (
                                <SimplePagination
                                  count={oceanNpcAreaSpawnerData.items.length}
                                  page={oceanNpcAreaSpawnerPage}
                                  rowsPerPage={oceanNpcAreaSpawnerRowsPerPage}
                                  onPageChange={(_event, newPage) => setOceanNpcAreaSpawnerPage(newPage)}
                                  onRowsPerPageChange={(event) => setOceanNpcAreaSpawnerRowsPerPage(Number(event.target.value))}
                                  rowsPerPageOptions={[10, 20, 50, 100]}
                                />
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                          {t('planningData.noData')}
                        </Typography>
                      )}
                    </>
                  )}
                </Box>
              )}

            </CardContent>
          </Card>
        </>
      ) : null}
    </Box>
  );
};

export default PlanningDataPage;

