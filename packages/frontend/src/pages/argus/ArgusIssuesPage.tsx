import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Stack,
  Pagination,
  useTheme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  ErrorOutline as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BugReport as BugReportIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import argusService, {
  ArgusIssue,
  ArgusIssueListParams,
} from '@/services/argusService';

const PAGE_SIZE = 25;

const LEVEL_COLORS: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
  fatal: 'error',
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'default',
};

const LEVEL_ICONS: Record<string, React.ReactElement> = {
  fatal: <ErrorIcon fontSize="small" />,
  error: <ErrorIcon fontSize="small" />,
  warning: <WarningIcon fontSize="small" />,
  info: <InfoIcon fontSize="small" />,
};

const STATUS_COLORS: Record<string, 'error' | 'warning' | 'success' | 'default'> = {
  unresolved: 'error',
  resolved: 'success',
  ignored: 'default',
};

interface ArgusIssuesPageProps {
  projectId?: string | number;
}

const ArgusIssuesPage: React.FC<ArgusIssuesPageProps> = ({ projectId: propProjectId }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Use projectId from props or URL param
  const projectId = propProjectId || searchParams.get('projectId') || '1';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  const [issues, setIssues] = useState<ArgusIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'unresolved');
  const [level, setLevel] = useState(searchParams.get('level') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'last_seen');

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params: ArgusIssueListParams = {
        status: status || undefined,
        level: level || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: (currentPage - 1) * PAGE_SIZE,
        search: search || undefined,
      };
      const result = await argusService.listIssues(projectId, params);
      setIssues(result.data);
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to fetch issues:', error);
      setIssues([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [projectId, status, level, sort, currentPage, search]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  };

  const handleIssueClick = (issue: ArgusIssue) => {
    navigate(`/argus/issues/${projectId}/${issue.id}`);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <BugReportIcon sx={{ fontSize: 28, color: theme.palette.error.main }} />
          <Typography variant="h5" fontWeight={700}>
            Argus Issues
          </Typography>
          {!loading && (
            <Chip
              label={`${total} issues`}
              size="small"
              color="default"
              variant="outlined"
            />
          )}
        </Box>
        <IconButton onClick={fetchIssues} disabled={loading}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Filters */}
      <Paper
        sx={{
          p: 2,
          mb: 2,
          display: 'flex',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <TextField
          size="small"
          placeholder="Search issues..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const params = new URLSearchParams(searchParams);
              params.set('search', search);
              params.set('page', '1');
              setSearchParams(params);
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={status}
            label="Status"
            onChange={(e) => {
              setStatus(e.target.value);
              const params = new URLSearchParams(searchParams);
              params.set('status', e.target.value);
              params.set('page', '1');
              setSearchParams(params);
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="unresolved">Unresolved</MenuItem>
            <MenuItem value="resolved">Resolved</MenuItem>
            <MenuItem value="ignored">Ignored</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Level</InputLabel>
          <Select
            value={level}
            label="Level"
            onChange={(e) => {
              setLevel(e.target.value);
              const params = new URLSearchParams(searchParams);
              params.set('level', e.target.value);
              params.set('page', '1');
              setSearchParams(params);
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="fatal">Fatal</MenuItem>
            <MenuItem value="error">Error</MenuItem>
            <MenuItem value="warning">Warning</MenuItem>
            <MenuItem value="info">Info</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Sort</InputLabel>
          <Select
            value={sort}
            label="Sort"
            onChange={(e) => {
              setSort(e.target.value);
              const params = new URLSearchParams(searchParams);
              params.set('sort', e.target.value);
              setSearchParams(params);
            }}
          >
            <MenuItem value="last_seen">Last Seen</MenuItem>
            <MenuItem value="first_seen">First Seen</MenuItem>
            <MenuItem value="event_count">Events</MenuItem>
            <MenuItem value="user_count">Users</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {/* Issues Table */}
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: '45%' }}>Issue</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Level</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Events</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'right' }}>Users</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Last Seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton width="80%" /></TableCell>
                  <TableCell><Skeleton width={60} /></TableCell>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={40} /></TableCell>
                  <TableCell><Skeleton width={40} /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                </TableRow>
              ))
            ) : issues.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No issues found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              issues.map((issue) => (
                <TableRow
                  key={issue.id}
                  hover
                  onClick={() => handleIssueClick(issue)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: theme.palette.action.hover,
                    },
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 500,
                        }}
                      >
                        {issue.title}
                        {issue.is_regression ? (
                          <Chip
                            label="Regression"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                          />
                        ) : null}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {issue.culprit || issue.fingerprint?.slice(0, 12)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={LEVEL_ICONS[issue.level]}
                      label={issue.level}
                      size="small"
                      color={LEVEL_COLORS[issue.level] || 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={issue.status}
                      size="small"
                      color={STATUS_COLORS[issue.status] || 'default'}
                      variant="filled"
                      sx={{ textTransform: 'capitalize' }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={500}>
                      {issue.event_count?.toLocaleString() || 0}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">
                      {issue.user_count?.toLocaleString() || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {issue.last_seen ? formatTimeAgo(issue.last_seen) : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Stack alignItems="center">
          <Pagination
            count={totalPages}
            page={currentPage}
            onChange={handlePageChange}
            color="primary"
            shape="rounded"
          />
        </Stack>
      )}
    </Box>
  );
};

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export default ArgusIssuesPage;
