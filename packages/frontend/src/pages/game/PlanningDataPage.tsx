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
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService, { PlanningDataStats } from '../../services/planningDataService';
import RewardItemSelector, { RewardSelection } from '../../components/game/RewardItemSelector';
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

  // Reward type filter state
  const [selectedRewardType, setSelectedRewardType] = useState<number | 'all'>('all');

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
      enqueueSnackbar(error.message || t('planningData.errors.loadStatsFailed'), { variant: 'error' });
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
      enqueueSnackbar(error.message || t('planningData.errors.rebuildFailed'), { variant: 'error' });
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
          enqueueSnackbar(error.message || t('planningData.errors.loadItemsFailed'), { variant: 'error' });
        } finally {
          setLoadingCategory(null);
        }
      };
      loadItems();
    }
  }, [activeTab, currentCategory, categoryItems, i18n.language, enqueueSnackbar, t]);

  // Filtered items based on search
  const filteredItems = useMemo(() => {
    if (!currentCategory || !categoryItems[currentCategory]) return [];
    const items = categoryItems[currentCategory];

    if (!debouncedSearchTerm) return items;

    const searchLower = debouncedSearchTerm.toLowerCase();
    return items.filter((item: any) => {
      // Search by ID (convert to string for comparison)
      const idMatch = item.id.toString().includes(searchLower);
      // Search by name
      const nameMatch = item.name?.toLowerCase().includes(searchLower);
      return idMatch || nameMatch;
    });
  }, [currentCategory, categoryItems, debouncedSearchTerm]);

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

      {/* Statistics Summary */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : stats ? (
        <>
          {/* Simple Statistics Line */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {t('planningData.stats.totalRewardTypes')}: <strong>{stats.totalRewardTypes}</strong> | {' '}
                {t('planningData.stats.withTable')}: <strong style={{ color: '#2e7d32' }}>{stats.rewardTypesWithTable}</strong> | {' '}
                {t('planningData.stats.withoutTable')}: <strong style={{ color: '#ed6c02' }}>{stats.rewardTypesWithoutTable}</strong> | {' '}
                {t('planningData.stats.totalItems')}: <strong>{stats.totalItems.toLocaleString()}</strong>
              </Typography>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label={t('planningData.tabs.rewardTypes')} />
              <Tab label={t('planningData.tabs.uiLists')} />
            </Tabs>

            <CardContent>
              {/* Reward Types Table */}
              {activeTab === 0 && (
                <>
                  {/* Test Component */}
                  <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('planningData.testComponent.title')}
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      <RewardItemSelector
                        value={testReward}
                        onChange={setTestReward}
                      />
                    </Box>
                  </Alert>

                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>{t('planningData.table.rewardType')}</TableCell>
                          <TableCell>{t('planningData.table.name')}</TableCell>
                          <TableCell align="center">{t('planningData.table.hasTable')}</TableCell>
                          <TableCell align="right">{t('planningData.table.itemCount')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stats.rewardTypes.map((type) => {
                          const translatedName = t(type.nameKey);
                          // Debug: log if translation failed
                          if (translatedName === type.nameKey) {
                            console.warn(`Translation missing for key: ${type.nameKey}`);
                          }
                          return (
                            <TableRow key={type.value}>
                              <TableCell>
                                <Chip label={type.value} size="small" />
                              </TableCell>
                              <TableCell>{translatedName}</TableCell>
                              <TableCell align="center">
                                {type.hasTable ? (
                                  <CheckCircleIcon color="success" fontSize="small" />
                                ) : (
                                  <Typography variant="caption" color="text.secondary">-</Typography>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {type.hasTable ? type.itemCount.toLocaleString() : '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
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
                            <FormControl sx={{ minWidth: 200 }}>
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
                              }}
                              size="small"
                            />
                          </Box>

                          <TableContainer component={Paper} variant="outlined">
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell width="150px">ID</TableCell>
                                  <TableCell>{t('planningData.table.name')}</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {paginatedItems.map((item: any) => (
                                  <TableRow key={item.id} hover>
                                    <TableCell>
                                      <Chip label={item.id} size="small" variant="outlined" />
                                    </TableCell>
                                    <TableCell>{item.name}</TableCell>
                                  </TableRow>
                                ))}
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

