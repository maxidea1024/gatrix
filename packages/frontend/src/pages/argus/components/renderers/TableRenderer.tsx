import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  IconButton,
  alpha,
} from '@mui/material';
import {
  FirstPage as FirstPageIcon,
  LastPage as LastPageIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
} from '@mui/icons-material';
import { type VizOptions, formatValue } from './widgetTypes';

interface TableRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
}

type SortDirection = 'asc' | 'desc';

const TableRenderer: React.FC<TableRendererProps> = ({
  data,
  isDark,
  vizOptions,
}) => {
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [page, setPage] = useState(0);

  const rowsPerPage = vizOptions?.rows_per_page ?? 10;
  const columnConfigs = vizOptions?.column_config;

  // Determine columns
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    const keys = Object.keys(data[0]);

    return keys
      .map((key) => {
        const config = columnConfigs?.find((c) => c.key === key);
        if (config?.visible === false) return null;

        return {
          key,
          displayName: config?.display_name || key,
          width: config?.width,
          sortable: config?.sortable !== false,
          align:
            config?.align ||
            (typeof data[0][key] === 'number' ? 'right' : 'left'),
        };
      })
      .filter(Boolean) as {
      key: string;
      displayName: string;
      width?: number | 'auto';
      sortable: boolean;
      align: 'left' | 'center' | 'right';
    }[];
  }, [data, columnConfigs]);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortBy || !data) return data;

    return [...data].sort((a, b) => {
      const va = a[sortBy];
      const vb = b[sortBy];

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      const numA = Number(va);
      const numB = Number(vb);

      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDir === 'asc' ? numA - numB : numB - numA;
      }

      const strA = String(va).toLowerCase();
      const strB = String(vb).toLowerCase();
      return sortDir === 'asc'
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
  }, [data, sortBy, sortDir]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const start = page * rowsPerPage;
    return sortedData.slice(start, start + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);

  const totalPages = Math.ceil((data?.length || 0) / rowsPerPage);

  const handleSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(key);
        setSortDir('desc');
      }
      setPage(0);
    },
    [sortBy]
  );

  if (columns.length === 0) return null;

  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.align as any}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    py: 0.5,
                    px: 1,
                    borderBottom: `1px solid ${borderColor}`,
                    backgroundColor: isDark
                      ? 'rgba(30,30,46,0.95)'
                      : 'rgba(255,255,255,0.95)',
                    whiteSpace: 'nowrap',
                    ...(col.width && col.width !== 'auto'
                      ? { width: col.width }
                      : {}),
                  }}
                >
                  {col.sortable ? (
                    <TableSortLabel
                      active={sortBy === col.key}
                      direction={sortBy === col.key ? sortDir : 'desc'}
                      onClick={() => handleSort(col.key)}
                      sx={{ fontSize: '0.7rem' }}
                    >
                      {col.displayName}
                    </TableSortLabel>
                  ) : (
                    col.displayName
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, ri) => (
              <TableRow
                key={ri}
                hover
                sx={{
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(124,77,255,0.05)'
                      : 'rgba(124,77,255,0.03)',
                  },
                }}
              >
                {columns.map((col) => {
                  const value = row[col.key];
                  const isNum =
                    typeof value === 'number' || !isNaN(Number(value));

                  return (
                    <TableCell
                      key={col.key}
                      align={col.align as any}
                      sx={{
                        fontSize: '0.7rem',
                        py: 0.4,
                        px: 1,
                        borderBottom: `1px solid ${borderColor}`,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 200,
                      }}
                    >
                      {isNum
                        ? formatValue(Number(value), vizOptions)
                        : String(value ?? '')}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 0.5,
            py: 0.3,
            px: 1,
            borderTop: `1px solid ${borderColor}`,
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{ fontSize: '0.65rem', color: 'text.secondary', mr: 1 }}
          >
            {page * rowsPerPage + 1}–
            {Math.min((page + 1) * rowsPerPage, data.length)} / {data.length}
          </Typography>
          <IconButton
            size="small"
            disabled={page === 0}
            onClick={() => setPage(0)}
            sx={{ p: 0.3 }}
          >
            <FirstPageIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton
            size="small"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            sx={{ p: 0.3 }}
          >
            <PrevIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton
            size="small"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            sx={{ p: 0.3 }}
          >
            <NextIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <IconButton
            size="small"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
            sx={{ p: 0.3 }}
          >
            <LastPageIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

export default TableRenderer;
