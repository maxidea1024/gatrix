import React, { useCallback } from 'react';
import { IconButton, Tooltip, useTheme } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';

interface CsvColumn {
  key: string;
  label: string;
}

interface CsvExportButtonProps {
  /** Data rows to export */
  data: Record<string, any>[];
  /** Filename without extension */
  filename?: string;
  /** Column definitions. If omitted, all keys from the first row are used. */
  columns?: CsvColumn[];
  /** Disabled state */
  disabled?: boolean;
}

function escapeCsvValue(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CsvExportButton: React.FC<CsvExportButtonProps> = ({
  data,
  filename = 'analytics_export',
  columns,
  disabled = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleExport = useCallback(() => {
    if (!data || data.length === 0) return;

    // Determine columns
    const cols: CsvColumn[] =
      columns || Object.keys(data[0]).map((key) => ({ key, label: key }));

    // Build CSV string
    const header = cols.map((c) => escapeCsvValue(c.label)).join(',');
    const rows = data.map((row) =>
      cols.map((c) => escapeCsvValue(row[c.key])).join(',')
    );
    const csv = [header, ...rows].join('\n');

    // Add BOM for Excel compatibility with UTF-8
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data, filename, columns]);

  return (
    <Tooltip title="Export CSV" arrow>
      <span>
        <IconButton
          size="small"
          onClick={handleExport}
          disabled={disabled || !data || data.length === 0}
          sx={{
            color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
            borderRadius: 1.5,
            p: 0.75,
            '&:hover': {
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              color: theme.palette.primary.main,
            },
          }}
        >
          <DownloadIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
};

export default CsvExportButton;
