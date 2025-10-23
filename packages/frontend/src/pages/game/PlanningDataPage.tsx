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
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService, { PlanningDataStats } from '../../services/planningDataService';
import SimplePagination from '../../components/common/SimplePagination';
import { useDebounce } from '../../hooks/useDebounce';

const PlanningDataPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Force reload translations on mount
  useEffect(() => {
    i18n.reloadResources();
  }, [i18n]);

  // State
  const [stats, setStats] = useState<PlanningDataStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
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

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await planningDataService.getStats();
      setStats(data);
    } catch (error: any) {
      // Extract user-friendly error message
      let errorMessage = t('planningData.errors.loadStatsFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRebuild = async () => {
    try {
      setRebuilding(true);
      const result = await planningDataService.rebuildRewardLookup();
      enqueueSnackbar(t('planningData.rebuildSuccess'), { variant: 'success' });
      // Reload stats
      await loadStats();
    } catch (error: any) {
      // Extract user-friendly error message
      let errorMessage = t('planningData.errors.rebuildFailed');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('function')) {
        errorMessage = error.message;
      }
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setRebuilding(false);
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
          const language = i18n.language === 'zh' ? 'cn' : i18n.language === 'en' ? 'en' : 'kr';
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
            startIcon={rebuilding ? <CircularProgress size={20} /> : <RefreshIcon />}
            onClick={handleRebuild}
            disabled={loading || rebuilding}
          >
            {t('planningData.rebuildData')}
          </Button>
        </Box>
      </Box>

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
                              flexGrow: 1,
                              maxWidth: 750,
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
                            sx={{ ml: 1 }}
                          />
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
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell width="150px">
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
                                          <TableCell>
                                            <Chip label={item.id} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell>{displayName}</TableCell>
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
                                flexGrow: 1,
                                maxWidth: 750,
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
                              sx={{ ml: 1 }}
                            />
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
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell width="150px">
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
                                        <TableRow key={item.id} hover>
                                          <TableCell>
                                            <Chip label={item.id} size="small" variant="outlined" />
                                          </TableCell>
                                          <TableCell>{displayName}</TableCell>
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
            </CardContent>
          </Card>
        </>
      ) : null}
    </Box>
  );
};

export default PlanningDataPage;

