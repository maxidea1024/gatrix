/**
 * Spreadsheet Excel Utilities (ExcelJS)
 *
 * Converts between Univer IWorkbookData (JSON snapshot) and ExcelJS workbook
 * for XLSX import/export WITH full styling support.
 *
 * Supports: cell values, types, formulas, merged cells, sheet names,
 * column widths, row heights, font styles, backgrounds, borders, alignment.
 */

import ExcelJS from 'exceljs';

// ─── Univer Types (minimal subset for conversion) ───

interface UniverCellData {
  v?: string | number | boolean;
  t?: number;  // 1=string, 2=number, 3=boolean, 4=force-text
  f?: string;  // formula
  s?: string | Record<string, any>;  // style ID (string) or inline style object
  p?: any;     // rich text (IDocumentData)
}

interface UniverMergeRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

interface UniverWorksheetData {
  id?: string;
  name?: string;
  cellData?: Record<string, Record<string, UniverCellData>>;
  mergeData?: UniverMergeRange[];
  rowCount?: number;
  columnCount?: number;
  defaultRowHeight?: number;
  defaultColumnWidth?: number;
  columnData?: Record<string, { w?: number; hd?: number }>;
  rowData?: Record<string, { h?: number; hd?: number }>;
  tabColor?: string;
  hidden?: number;
}

interface UniverWorkbookData {
  id?: string;
  appVersion?: string;
  name?: string;
  sheets?: Record<string, UniverWorksheetData>;
  sheetOrder?: string[];
  styles?: Record<string, any>;
}

// ─── Univer Style Helpers ───

/**
 * Check if a Univer style value is "on/active".
 * Values can be: number (0=off, 1=on), object ({s: 0|1}), or boolean.
 */
function isTruthyStyleValue(val: any): boolean {
  if (val === undefined || val === null || val === 0 || val === false) return false;
  if (typeof val === 'number') return val > 0;
  if (typeof val === 'object' && 's' in val) return val.s > 0;
  if (typeof val === 'boolean') return val;
  return true; // non-zero, non-null = truthy
}

function resolveStyle(
  s: string | Record<string, any> | undefined,
  styles: Record<string, any> | undefined
): any | null {
  if (s === undefined || s === null) return null;
  // Inline style object — use directly
  if (typeof s === 'object') return s;
  // String ID — look up in styles map
  if (typeof s === 'string' && styles) return styles[s] || null;
  return null;
}

function univerColorToHex(color: any): string | undefined {
  if (!color) return undefined;
  if (typeof color === 'string') {
    return color.replace('#', '');
  }
  if (color.rgb) return color.rgb.replace('#', '');
  return undefined;
}

function univerBorderToExcel(border: any): Partial<ExcelJS.Border> | undefined {
  if (!border) return undefined;
  const style = border.s || border.style;
  const color = univerColorToHex(border.cl || border.color);
  const styleMap: Record<number | string, ExcelJS.BorderStyle> = {
    1: 'thin', 2: 'medium', 3: 'thick', 4: 'dashed', 5: 'dotted',
    6: 'double', 7: 'hair', 8: 'mediumDashed', 9: 'dashDot',
    thin: 'thin', medium: 'medium', thick: 'thick', dashed: 'dashed',
    dotted: 'dotted', double: 'double',
  };
  return {
    style: styleMap[style] || 'thin',
    color: color ? { argb: `FF${color}` } : undefined,
  };
}

function univerAlignToExcel(ht: number | undefined, vt: number | undefined): Partial<ExcelJS.Alignment> {
  const align: Partial<ExcelJS.Alignment> = {};
  // Horizontal: 0=left, 1=center, 2=right, 3=justify
  if (ht === 0) align.horizontal = 'left';
  else if (ht === 1) align.horizontal = 'center';
  else if (ht === 2) align.horizontal = 'right';
  else if (ht === 3) align.horizontal = 'justify';
  // Vertical: 0=top, 1=middle, 2=bottom
  if (vt === 0) align.vertical = 'top';
  else if (vt === 1) align.vertical = 'middle';
  else if (vt === 2) align.vertical = 'bottom';
  return align;
}

// ─── Export: Univer → XLSX ───

/**
 * Export current Univer workbook to an XLSX file download.
 */
export async function exportToXlsx(univerAPI: any, filename: string): Promise<void> {
  const workbook = univerAPI.getActiveWorkbook();
  if (!workbook) {
    throw new Error('No active workbook');
  }

  const snapshot: UniverWorkbookData = workbook.save();
  const wb = await univerSnapshotToExcelJS(snapshot);
  await downloadWorkbook(wb, filename);
}

/**
 * Export from raw Univer snapshot JSON (for use outside the editor, e.g. list page).
 */
export async function exportSnapshotToXlsx(snapshotJson: string, filename: string): Promise<void> {
  const snapshot: UniverWorkbookData = JSON.parse(snapshotJson);
  const wb = await univerSnapshotToExcelJS(snapshot);
  await downloadWorkbook(wb, filename);
}

async function downloadWorkbook(wb: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function univerSnapshotToExcelJS(data: UniverWorkbookData): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const sheets = data.sheets || {};
  const sheetOrder = data.sheetOrder || Object.keys(sheets);
  const styles = data.styles || {};

  for (const sheetId of sheetOrder) {
    const sheet = sheets[sheetId];
    if (!sheet) continue;
    convertUniverSheetToExcelJS(wb, sheet, styles);
  }

  return wb;
}

function convertUniverSheetToExcelJS(
  wb: ExcelJS.Workbook,
  sheet: UniverWorksheetData,
  styles: Record<string, any>
): void {
  const ws = wb.addWorksheet(sheet.name || 'Sheet');
  const cellData = sheet.cellData || {};

  // Column widths
  if (sheet.columnData) {
    const colIndices = Object.keys(sheet.columnData).map(Number).sort((a, b) => a - b);
    const maxCol = colIndices.length > 0 ? Math.max(...colIndices) : 0;
    for (let i = 0; i <= maxCol; i++) {
      const col = ws.getColumn(i + 1); // ExcelJS is 1-indexed
      const colInfo = sheet.columnData[String(i)];
      if (colInfo?.w) {
        // ExcelJS width is in characters (~7.5px per char)
        col.width = Math.round(colInfo.w / 7.5 * 10) / 10;
      } else if (sheet.defaultColumnWidth) {
        col.width = Math.round(sheet.defaultColumnWidth / 7.5 * 10) / 10;
      }
    }
  }

  // Row heights + cell data
  const rowIndices = Object.keys(cellData).map(Number).sort((a, b) => a - b);
  for (const r of rowIndices) {
    const row = cellData[String(r)];
    if (!row) continue;

    const excelRow = ws.getRow(r + 1); // ExcelJS is 1-indexed

    // Row height (Univer uses px, ExcelJS uses points; 1pt ≈ 1.333px)
    if (sheet.rowData?.[String(r)]?.h) {
      excelRow.height = Math.round(sheet.rowData[String(r)].h! / 1.333 * 10) / 10;
    }

    const colIndices = Object.keys(row).map(Number).sort((a, b) => a - b);
    for (const c of colIndices) {
      const uCell = row[String(c)];
      if (!uCell) continue;

      const cell = excelRow.getCell(c + 1);
      let hasContent = false;

      // Formula
      if (uCell.f) {
        let formulaStr = uCell.f;
        if (formulaStr.startsWith('=')) {
          formulaStr = formulaStr.substring(1);
        }

        // 수식 내부에 큰따옴표(" ")로 감싸진 문자열을 제외하고 대괄호('[', ']')가 있는지 확인
        // 대괄호는 외부 참조(External Links: [1]Sheet1!A1)나 표 참조(Table1[Column1])에 사용되는데,
        // 현재 ExcelJS로 내보낼 때 해당 메타데이터를 유지하지 않으므로 엑셀에서 '제거된 레코드' 손상 오류를 발생시킴.
        const stringRemoved = formulaStr.replace(/"[^"]*"/g, '');
        const hasExternalOrTableRef = stringRemoved.includes('[') && stringRemoved.includes(']');

        if (hasExternalOrTableRef && uCell.v !== undefined && uCell.v !== null) {
          // 파일 손상을 막기 위해 수식을 제거하고 계산된 결과값만 기록
          if (typeof uCell.v === 'number' || uCell.t === 2) {
            cell.value = Number(uCell.v);
          } else if (typeof uCell.v === 'boolean' || uCell.t === 3) {
            cell.value = Boolean(uCell.v);
          } else {
            cell.value = String(uCell.v);
          }
        } else {
          // 정상적인 수식은 그대로 내보냄 (결과값도 함께 내보내면 엑셀에서 최초 로딩 시 계산 오류를 방지함)
          cell.value = { formula: formulaStr, result: uCell.v } as ExcelJS.CellFormulaValue;
        }
        hasContent = true;
      }
      // Rich text → plain text
      else if (uCell.p && uCell.v === undefined) {
        const text = extractRichTextPlain(uCell.p);
        if (text) {
          cell.value = text;
          hasContent = true;
        }
      }
      // Value
      else if (uCell.v !== undefined && uCell.v !== null) {
        if (typeof uCell.v === 'number' || uCell.t === 2) {
          cell.value = Number(uCell.v);
        } else if (typeof uCell.v === 'boolean' || uCell.t === 3) {
          cell.value = Boolean(uCell.v);
        } else {
          cell.value = String(uCell.v);
        }
        hasContent = true;
      }

      // Apply styles (even for empty cells — borders, backgrounds, etc.)
      const style = resolveStyle(uCell.s, styles);
      if (style) {
        applyStyleToCell(cell, style);
        hasContent = true;
      }

      // If nothing at all, skip
      if (!hasContent) continue;
    }
  }

  // Merged cells
  if (sheet.mergeData) {
    for (const m of sheet.mergeData) {
      ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1);
    }
  }
}

function applyStyleToCell(cell: ExcelJS.Cell, style: any): void {
  // Font
  const font: Partial<ExcelJS.Font> = {};
  if (style.ff) font.name = style.ff;
  if (style.fs) font.size = style.fs;
  if (isTruthyStyleValue(style.bl)) font.bold = true;
  if (isTruthyStyleValue(style.it)) font.italic = true;
  if (isTruthyStyleValue(style.ul)) font.underline = true;
  if (isTruthyStyleValue(style.st)) font.strike = true;
  if (style.cl) {
    const hex = univerColorToHex(style.cl);
    if (hex) font.color = { argb: `FF${hex}` };
  }
  if (Object.keys(font).length > 0) cell.font = font;

  // Fill (background)
  if (style.bg) {
    const hex = univerColorToHex(style.bg);
    if (hex) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${hex}` },
      };
    }
  }

  // Borders
  const bd = style.bd;
  if (bd) {
    const border: Partial<ExcelJS.Borders> = {};
    if (bd.t) border.top = univerBorderToExcel(bd.t);
    if (bd.b) border.bottom = univerBorderToExcel(bd.b);
    if (bd.l) border.left = univerBorderToExcel(bd.l);
    if (bd.r) border.right = univerBorderToExcel(bd.r);
    if (Object.keys(border).length > 0) cell.border = border;
  }

  // Alignment
  const align = univerAlignToExcel(style.ht, style.vt);
  if (style.tb === 1) align.wrapText = true; // text wrap
  if (Object.keys(align).length > 0) cell.alignment = align;
}

function extractRichTextPlain(p: any): string {
  try {
    if (typeof p === 'string') return p;
    if (p?.body?.dataStream) {
      return p.body.dataStream.replace(/[\r\n\x00-\x1f]+$/g, '');
    }
    return '';
  } catch {
    return '';
  }
}

// ─── Import: XLSX → Univer ───

/**
 * Parse an XLSX file and convert to Univer IWorkbookData JSON string.
 */
export async function importFromXlsx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);

  const univerData = excelJSToUniverSnapshot(wb);
  return JSON.stringify(univerData);
}

function excelJSToUniverSnapshot(wb: ExcelJS.Workbook): UniverWorkbookData {
  const sheets: Record<string, UniverWorksheetData> = {};
  const sheetOrder: string[] = [];
  const styles: Record<string, any> = {};
  let styleCounter = 0;

  wb.eachSheet((worksheet, sheetIndex) => {
    const sheetId = `sheet_${sheetIndex}`;
    sheetOrder.push(sheetId);

    const cellData: Record<string, Record<string, UniverCellData>> = {};
    const mergeData: UniverMergeRange[] = [];
    const columnData: Record<string, { w?: number }> = {};
    const rowData: Record<string, { h?: number }> = {};

    // Column widths
    if (worksheet.columns) {
      worksheet.columns.forEach((col, i) => {
        if (col && col.width) {
          columnData[String(i)] = { w: Math.round(col.width * 7.5) };
        }
      });
    }

    // Rows
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const r = rowNumber - 1; // 0-indexed

      // Row height (ExcelJS returns points; Univer uses px; 1pt ≈ 1.333px)
      if (row.height) {
        rowData[String(r)] = { h: Math.round(row.height * 1.333) };
      }

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const c = colNumber - 1; // 0-indexed
        if (!cellData[String(r)]) cellData[String(r)] = {};

        const univerCell: UniverCellData = {};

        // Formula
        if (cell.formula) {
          univerCell.f = cell.formula;
        }

        // Value
        const val = cell.value;
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && 'formula' in val) {
            // Regular formula: { formula: '=A1+B1', result: 123 }
            univerCell.f = (val as any).formula;
            if ((val as any).result !== undefined) {
              univerCell.v = (val as any).result;
              univerCell.t = typeof (val as any).result === 'number' ? 2 : 1;
            }
          } else if (typeof val === 'object' && 'sharedFormula' in val) {
            // Shared formula: { sharedFormula: '=A1+B1', result: 456 }
            univerCell.f = (val as any).sharedFormula;
            if ((val as any).result !== undefined) {
              univerCell.v = (val as any).result;
              univerCell.t = typeof (val as any).result === 'number' ? 2 : 1;
            }
          } else if (typeof val === 'object' && 'hyperlink' in val) {
            // Hyperlink: { hyperlink: 'https://...', text: 'link text' }
            univerCell.v = (val as any).text || (val as any).hyperlink || '';
            univerCell.t = 1;
          } else if (typeof val === 'object' && 'error' in val) {
            // Error: { error: '#REF!' }
            univerCell.v = (val as any).error || '#ERROR!';
            univerCell.t = 1;
          } else if (typeof val === 'number') {
            univerCell.v = val;
            univerCell.t = 2;
          } else if (typeof val === 'boolean') {
            univerCell.v = val;
            univerCell.t = 3;
          } else if (val instanceof Date) {
            univerCell.v = val.getTime();
            univerCell.t = 2;
          } else if (typeof val === 'object' && 'richText' in val) {
            // Rich text → plain string
            univerCell.v = (val as any).richText?.map((rt: any) => rt.text).join('') || '';
            univerCell.t = 1;
          } else if (typeof val === 'object') {
            // Fallback: extract result if available, otherwise skip
            if (val && 'result' in val && (val as any).result !== undefined) {
              univerCell.v = (val as any).result;
              univerCell.t = typeof (val as any).result === 'number' ? 2 : 1;
            } else {
              // Last resort: try JSON or skip
              univerCell.v = '';
              univerCell.t = 1;
            }
          } else {
            univerCell.v = String(val);
            univerCell.t = 1;
          }
        }

        // Import styles (before skip check — styled empty cells should be kept)
        const styleObj = extractCellStyle(cell);
        if (styleObj && Object.keys(styleObj).length > 0) {
          const styleId = `s_${styleCounter++}`;
          styles[styleId] = styleObj;
          univerCell.s = styleId;
        }

        // Skip truly empty cells (no value, no formula, no style)
        if (univerCell.v === undefined && !univerCell.f && !univerCell.s) return;

        cellData[String(r)][String(c)] = univerCell;
      });
    });

    // Merged cells
    const merges = (worksheet as any)._merges || {};
    for (const key of Object.keys(merges)) {
      const merge = merges[key];
      if (merge?.model) {
        mergeData.push({
          startRow: merge.model.top - 1,
          endRow: merge.model.bottom - 1,
          startColumn: merge.model.left - 1,
          endColumn: merge.model.right - 1,
        });
      }
    }

    sheets[sheetId] = {
      id: sheetId,
      name: worksheet.name,
      cellData,
      mergeData: mergeData.length > 0 ? mergeData : undefined,
      rowCount: Math.max(worksheet.rowCount || 0, 100),
      columnCount: Math.max(worksheet.columnCount || 0, 26),
      defaultRowHeight: 24,
      defaultColumnWidth: 88,
      columnData: Object.keys(columnData).length > 0 ? columnData : undefined,
      rowData: Object.keys(rowData).length > 0 ? rowData : undefined,
    };
  });

  return {
    id: 'imported_workbook',
    appVersion: '0.0.0',
    sheets,
    sheetOrder,
    styles,
  };
}

function extractCellStyle(cell: ExcelJS.Cell): any {
  const style: any = {};

  // Font
  if (cell.font) {
    if (cell.font.name) style.ff = cell.font.name;
    if (cell.font.size) style.fs = cell.font.size;
    if (cell.font.bold) style.bl = 1;
    if (cell.font.italic) style.it = 1;
    if (cell.font.underline) style.ul = { s: 1 };
    if (cell.font.strike) style.st = { s: 1 };
    if (cell.font.color?.argb) {
      style.cl = { rgb: '#' + cell.font.color.argb.substring(2) };
    }
  }

  // Fill
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  if (fill?.type === 'pattern' && fill.fgColor?.argb) {
    style.bg = { rgb: '#' + fill.fgColor.argb.substring(2) };
  }

  // Border
  if (cell.border) {
    const bd: any = {};
    if (cell.border.top) bd.t = excelBorderToUniver(cell.border.top);
    if (cell.border.bottom) bd.b = excelBorderToUniver(cell.border.bottom);
    if (cell.border.left) bd.l = excelBorderToUniver(cell.border.left);
    if (cell.border.right) bd.r = excelBorderToUniver(cell.border.right);
    if (Object.keys(bd).length > 0) style.bd = bd;
  }

  // Alignment
  if (cell.alignment) {
    const hMap: Record<string, number> = { left: 0, center: 1, right: 2, justify: 3 };
    const vMap: Record<string, number> = { top: 0, middle: 1, bottom: 2 };
    if (cell.alignment.horizontal && hMap[cell.alignment.horizontal] !== undefined) {
      style.ht = hMap[cell.alignment.horizontal];
    }
    if (cell.alignment.vertical && vMap[cell.alignment.vertical] !== undefined) {
      style.vt = vMap[cell.alignment.vertical];
    }
    if (cell.alignment.wrapText) style.tb = 1;
  }

  return style;
}

function excelBorderToUniver(border: Partial<ExcelJS.Border>): any {
  const styleMap: Record<string, number> = {
    thin: 1, medium: 2, thick: 3, dashed: 4, dotted: 5,
    double: 6, hair: 7, mediumDashed: 8, dashDot: 9,
  };
  const result: any = {
    s: styleMap[border.style || 'thin'] || 1,
  };
  if (border.color?.argb) {
    result.cl = { rgb: '#' + border.color.argb.substring(2) };
  }
  return result;
}
