import * as XLSX from 'xlsx';

// Date-time string for filenames (YYYY-MM-DDTHH-MM-SS)
export const getDateTimeStr = (): string => {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

// Download a Blob as a file
export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Column definition for export
export interface ExportColumn {
  key: string;
  header: string;
}

// Escape CSV value
const escapeCSV = (value: any): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// Export data to file (CSV, JSON, or XLSX)
export const exportToFile = (
  data: Record<string, any>[],
  columns: ExportColumn[],
  filenamePrefix: string,
  format: 'csv' | 'json' | 'xlsx'
): void => {
  const dateTimeStr = getDateTimeStr();
  let blob: Blob;
  let filename: string;

  if (format === 'csv') {
    const headerRow = columns.map((col) => escapeCSV(col.header)).join(',');
    const dataRows = data.map((row) =>
      columns.map((col) => escapeCSV(row[col.key])).join(',')
    );
    const csvContent = [headerRow, ...dataRows].join('\n');
    // Add BOM for Excel compatibility
    const bom = '\uFEFF';
    blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    filename = `${filenamePrefix}-${dateTimeStr}.csv`;
  } else if (format === 'json') {
    // Export with readable keys
    const jsonData = data.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        obj[col.header] = row[col.key] ?? '';
      });
      return obj;
    });
    blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: 'application/json',
    });
    filename = `${filenamePrefix}-${dateTimeStr}.json`;
  } else {
    // XLSX
    const sheetData = data.map((row) => {
      const obj: Record<string, any> = {};
      columns.forEach((col) => {
        obj[col.header] = row[col.key] ?? '';
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, filenamePrefix);

    // Auto-adjust column widths
    const colWidths = columns.map((col) => ({
      wch: Math.max(col.header.length, 15),
    }));
    worksheet['!cols'] = colWidths;

    const xlsxBuffer = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
    blob = new Blob([xlsxBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    filename = `${filenamePrefix}-${dateTimeStr}.xlsx`;
  }

  downloadBlob(blob, filename);
};

// Export raw JSON data (for complex structures like banners)
export const exportRawJson = (data: any, filenamePrefix: string): void => {
  const dateTimeStr = getDateTimeStr();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  downloadBlob(blob, `${filenamePrefix}-${dateTimeStr}.json`);
};

// Parse an import file (CSV, JSON, or XLSX) into an array of objects
export const parseImportFile = (file: File): Promise<Record<string, any>[]> => {
  return new Promise((resolve, reject) => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'json') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const result = JSON.parse(e.target?.result as string);
          const data = Array.isArray(result) ? result : [result];
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    } else if (extension === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = (e.target?.result as string).replace(/^\uFEFF/, ''); // Remove BOM
          const lines = text.split(/\r?\n/).filter((line) => line.trim());
          if (lines.length < 2) {
            resolve([]);
            return;
          }

          // Parse CSV header
          const headers = parseCSVLine(lines[0]);
          const data = lines.slice(1).map((line) => {
            const values = parseCSVLine(line);
            const obj: Record<string, any> = {};
            headers.forEach((header, index) => {
              obj[header] = values[index] || '';
            });
            return obj;
          });
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid CSV file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    } else if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target?.result, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const data =
            XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet);
          resolve(data);
        } catch (err) {
          reject(new Error('Invalid XLSX file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error(`Unsupported file format: ${extension}`));
    }
  });
};

// Parse a CSV line handling quoted values
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
};

// Get accepted file extensions string
export const getAcceptedFileTypes = (jsonOnly?: boolean): string => {
  if (jsonOnly) return '.json';
  return '.csv,.json,.xlsx,.xls';
};

// Get supported formats label
export const getSupportedFormatsLabel = (jsonOnly?: boolean): string => {
  if (jsonOnly) return 'JSON';
  return 'CSV, JSON, XLSX';
};
