import React from 'react';
import {
  Box,
  Pagination,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Divider,
  SelectChangeEvent,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface SimplePaginationProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (event: unknown, newPage: number) => void;
  onRowsPerPageChange: (event: SelectChangeEvent<number> | any) => void;
  rowsPerPageOptions?: number[];
  showRowsPerPage?: boolean;
}

const SimplePagination: React.FC<SimplePaginationProps> = ({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 20, 25, 50, 100],
  showRowsPerPage = true,
}) => {
  const { t } = useTranslation();
  const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));
  const currentPage = page + 1; // Convert 0-based to 1-based

  const handlePageChange = (event: React.ChangeEvent<unknown>, newPage: number) => {
    // Ensure newPage is a valid number before converting
    const pageNumber = typeof newPage === 'number' ? newPage - 1 : 0;
    onPageChange(event, pageNumber); // Convert 1-based to 0-based
  };

  const handleRowsPerPageChange = (event: SelectChangeEvent<number>) => {
    // Always pass the event to the handler
    onRowsPerPageChange(event as any);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 2,
        flexWrap: 'wrap',
      }}
    >
      {/* Center - Pagination */}
      <Pagination
        count={totalPages}
        page={currentPage}
        onChange={handlePageChange}
        color="primary"
        shape="rounded"
        siblingCount={1}
        boundaryCount={1}
        showFirstButton
        showLastButton
      />

      {/* Right side - Divider and Rows per page selector */}
      {showRowsPerPage && (
        <>
          <Divider orientation="vertical" flexItem sx={{ height: 32 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControl size="small" variant="outlined">
              <Select
                value={rowsPerPage}
                onChange={handleRowsPerPageChange}
                sx={{
                  minWidth: 80,
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'divider',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  },
                }}
              >
                {rowsPerPageOptions.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="body2" color="text.secondary">
              {t('common.perPage')}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

export default SimplePagination;
