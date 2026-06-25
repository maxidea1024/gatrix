/**
 * CSV Export Utility
 * - BOM-prefixed UTF-8 for Excel Korean compatibility
 * - Handles special characters (commas, quotes, newlines)
 * - Auto-formats dates and numbers
 */

export interface CsvColumn<T = Record<string, any>> {
  key: keyof T | string;
  label: string;
  formatter?: (value: any, row: T) => string;
}

function escapeCell(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

export function toCsvString<T extends Record<string, any>>(
  data: T[],
  columns: CsvColumn<T>[]
): string {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const raw = getNestedValue(row, col.key as string);
        const formatted = col.formatter ? col.formatter(raw, row) : raw;
        return escapeCell(formatted);
      })
      .join(',')
  );
  return [header, ...rows].join('\r\n');
}

export function downloadCsv<T extends Record<string, any>>(
  data: T[],
  columns: CsvColumn<T>[],
  filename: string
): void {
  const csv = toCsvString(data, columns);
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const csvFormatters = {
  currency: (value: any) => {
    const num = Number(value) || 0;
    return `$${num.toFixed(2)}`;
  },
  date: (value: any) => {
    if (!value) return '';
    return new Date(value).toLocaleString();
  },
  dateShort: (value: any) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString();
  },
  percent: (value: any) => {
    const num = Number(value) || 0;
    return `${num.toFixed(1)}%`;
  },
  number: (value: any) => {
    const num = Number(value) || 0;
    return num.toLocaleString();
  },
};
