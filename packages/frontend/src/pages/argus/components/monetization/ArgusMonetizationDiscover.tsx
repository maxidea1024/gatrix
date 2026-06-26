import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Select,
  MenuItem,
  CircularProgress,
  alpha,
} from '@mui/material';
import {
  Bookmark as BookmarkIcon,
  Save as SaveIcon,
  FileDownload as ExportIcon,
  Explore as DiscoverIcon,
} from '@mui/icons-material';
import {
  QueryAQLEditor,
  DISCOVER_CONFIG,
  type QueryAQLEditorHandle,
} from '@/components/argus/query-aql';
import { GroupBySelector, VolumeChart } from '../discoverHelpers';
import { downloadCsv } from '@/utils/csvExport';
import { fmt } from './MonetizationHelpers';
import { ARGUS_SEMANTIC } from '../../argusThemeTokens';
import { SectionLabel } from '../argusSharedComponents';

interface ArgusMonetizationDiscoverProps {
  discGroupBy: string[];
  setDiscGroupBy: React.Dispatch<React.SetStateAction<string[]>>;
  discQuery: string;
  setDiscQuery: (q: string) => void;
  discYAxis: string;
  setDiscYAxis: (y: string) => void;
  discLoading: boolean;
  discError: string | null;
  discHasQueried: boolean;
  discVolume: any[];
  discResults: any[];
  discResultsMeta: any[];
  discLimit: number;
  discOffset: number;
  setDiscOffset: (o: number) => void;
  runDiscoverQuery: (offset: number) => void;
  handleSearchSubmit: (val: string) => void;
  handleSearchChange: (val: string) => void;
  fetchFieldValues: (fieldKey: string) => Promise<string[]>;
  dateRange: any;
  setDateRange: (r: any) => void;
  setSavedQueriesOpen: (open: boolean) => void;
  setSaveDialogMode: (mode: 'new' | 'saveAs') => void;
  setSaveDialogOpen: (open: boolean) => void;
  isDark: boolean;
  t: any;
  navigate: any;
}

export const ArgusMonetizationDiscover: React.FC<
  ArgusMonetizationDiscoverProps
> = ({
  discGroupBy,
  setDiscGroupBy,
  discQuery,
  setDiscQuery,
  discYAxis,
  setDiscYAxis,
  discLoading,
  discError,
  discHasQueried,
  discVolume,
  discResults,
  discResultsMeta,
  discLimit,
  discOffset,
  setDiscOffset,
  runDiscoverQuery,
  handleSearchSubmit,
  handleSearchChange,
  fetchFieldValues,
  dateRange,
  setDateRange,
  setSavedQueriesOpen,
  setSaveDialogMode,
  setSaveDialogOpen,
  isDark,
  t,
  navigate,
}) => {
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
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
          border: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <DiscoverIcon sx={{ color: 'primary.main', fontSize: 28 }} />
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {t('argus.monetization.sectionDiscover', 'Revenue Discover')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t(
                  'argus.monetization.discoverDesc',
                  'Write AQL queries, slice and aggregate revenue dataset freely'
                )}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<BookmarkIcon sx={{ fontSize: 16 }} />}
              onClick={() => setSavedQueriesOpen(true)}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              {t('argus.discover.savedQueries', 'Saved Queries')}
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
              onClick={() => {
                setSaveDialogMode('new');
                setSaveDialogOpen(true);
              }}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              {t('common.save', 'Save')}
            </Button>
          </Box>
        </Box>

        {/* AQL Query Editor Bar */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 3,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              flex: 1,
              minWidth: 280,
            }}
          >
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
                placeholder={t(
                  'argus.discover.searchPlaceholder',
                  'event_name:purchase product_name:"Gem Pack"...'
                )}
              />
            </Box>
          </Box>

          {/* Y-Axis Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography fontSize={11} fontWeight={700} color="text.secondary">
              Y-Axis:
            </Typography>
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
            variant="contained"
            size="small"
            onClick={handleSearchClick}
            disabled={discLoading}
            sx={{ height: 32, px: 3, textTransform: 'none', fontWeight: 700 }}
          >
            {discLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              t('argus.discover.runQuery', 'Run Query')
            )}
          </Button>
        </Box>

        {discError && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 3,
              borderColor: ARGUS_SEMANTIC.negative,
              bgcolor: alpha(ARGUS_SEMANTIC.negative, 0.04),
              borderRadius: 2,
            }}
          >
            <Typography
              color={ARGUS_SEMANTIC.negative}
              fontSize={12}
              fontWeight={600}
            >
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
              onZoom={(start: any, end: any) =>
                setDateRange({
                  type: 'custom',
                  start: new Date(start),
                  end: new Date(end),
                })
              }
            />
          </Box>
        )}

        {/* Results Table */}
        {discHasQueried && !discLoading && (
          <Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
              }}
            >
              <SectionLabel>
                {t('argus.discover.resultsTable', 'Query Results')}
              </SectionLabel>
              {discResults.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ExportIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    const csvCols = discResultsMeta.map((f: any) => ({
                      key: f.name,
                      label: f.name,
                    }));
                    downloadCsv(
                      discResults,
                      csvCols,
                      `discover_${new Date().toISOString().slice(0, 10)}`
                    );
                  }}
                  sx={{ fontSize: 11, textTransform: 'none' }}
                >
                  📥 CSV
                </Button>
              )}
            </Box>

            {discResults.length > 0 ? (
              <Box
                sx={{
                  overflowX: 'auto',
                  border: '1px solid',
                  borderColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.06)',
                  borderRadius: 2,
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {discResultsMeta.map((meta: any, i: number) => (
                        <TableCell
                          key={i}
                          sx={{ fontWeight: 700, fontSize: 11 }}
                        >
                          {meta.name}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {discResults.map((row: any, rowIdx: number) => (
                      <TableRow
                        key={rowIdx}
                        sx={{
                          '&:hover': {
                            bgcolor: isDark
                              ? 'rgba(255,255,255,0.03)'
                              : 'rgba(0,0,0,0.015)',
                          },
                        }}
                      >
                        {discResultsMeta.map((meta: any, colIdx: number) => {
                          const val = row[meta.name];
                          return (
                            <TableCell key={colIdx} sx={{ fontSize: 12 }}>
                              {meta.name === 'user_id' && val ? (
                                <Typography
                                  component="span"
                                  onClick={() =>
                                    navigate(
                                      `/argus/analytics/users/${encodeURIComponent(val)}`
                                    )
                                  }
                                  sx={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: 'primary.main',
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' },
                                  }}
                                >
                                  {val.slice(0, 16)}
                                  {val.length > 16 ? '…' : ''}
                                </Typography>
                              ) : meta.name === 'timestamp' && val ? (
                                new Date(val).toLocaleString()
                              ) : typeof val === 'number' &&
                                meta.name.includes('amount') ? (
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
              <Typography
                fontSize={12}
                color="text.secondary"
                sx={{ textAlign: 'center', py: 6 }}
              >
                {t(
                  'argus.discover.noResults',
                  'No records match the query conditions.'
                )}
              </Typography>
            )}

            {/* Pagination */}
            {discResults.length >= discLimit && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 1,
                  mt: 3,
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  disabled={discOffset === 0}
                  onClick={() => {
                    const o = Math.max(0, discOffset - discLimit);
                    setDiscOffset(o);
                    runDiscoverQuery(o);
                  }}
                  sx={{ fontSize: 11, textTransform: 'none' }}
                >
                  ← {t('argus.discover.prev', 'Prev')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={discResults.length < discLimit}
                  onClick={() => {
                    const o = discOffset + discLimit;
                    setDiscOffset(o);
                    runDiscoverQuery(o);
                  }}
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
