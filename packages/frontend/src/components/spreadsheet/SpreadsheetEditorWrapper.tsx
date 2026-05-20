import React, { useEffect, useRef, useCallback } from 'react';
import {
  createUniver,
  defaultTheme,
  LocaleType,
  mergeLocales,
} from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';

import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import UniverPresetSheetsCoreKoKR from '@univerjs/preset-sheets-core/locales/ko-KR';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import UniverPresetSheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import UniverPresetSheetsFilterKoKR from '@univerjs/preset-sheets-filter/locales/ko-KR';
import UniverPresetSheetsFilterZhCN from '@univerjs/preset-sheets-filter/locales/zh-CN';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-filter/lib/index.css';
// Immediately neutralize Univer's `* { scrollbar-color: initial; scrollbar-width: initial }` reset.
// This runs synchronously at module load time (same as CSS imports above), so there's
// no flash of browser-default scrollbar. Actual styling is in scrollbar.css.
(function neutralizeUniverScrollbarReset() {
  if (typeof document === 'undefined') return;
  const id = 'univer-scrollbar-override';
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = '* { scrollbar-color: unset; scrollbar-width: unset; }';
  document.head.appendChild(s);
})();

import { useTranslation } from 'react-i18next';
import { useTheme } from '@/contexts/ThemeContext';

// ==================== Types ====================

export interface SpreadsheetEditorWrapperProps {
  /** Spreadsheet ID (used for persisting view state in localStorage) */
  spreadsheetId?: string;
  /** Initial workbook data (Univer IWorkbookData JSON string or null for new) */
  initialData: string | null;
  /** Called when content changes (debounce handled externally via useAutoSave) */
  onContentChange?: () => void;
  /** Called to get current workbook snapshot for saving */
  getSnapshotRef?: React.MutableRefObject<(() => string | null) | null>;
  /** Ref to access Univer API (for export/import) */
  univerAPIRef?: React.MutableRefObject<any | null>;
  /** Read-only mode */
  readOnly?: boolean;
}

// ==================== Theme ====================

/**
 * Gatrix-aligned Univer theme — Indigo-violet primary palette.
 * Extends the default Univer theme with colors matching the Gatrix design system.
 */
const gatrixUniverTheme = {
  ...defaultTheme,
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
  },
  gray: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#a1a1aa',
    400: '#71717a',
    500: '#52525b',
    600: '#3f3f46',
    700: '#2a2a2e',
    800: '#1e1e1e',
    900: '#121212',
  },
};

// ==================== Locale Helper ====================

function getUniverLocale(lang: string): LocaleType {
  if (lang.startsWith('ko')) return LocaleType.KO_KR;
  if (lang.startsWith('zh')) return LocaleType.ZH_CN;
  if (lang.startsWith('ja')) return LocaleType.JA_JP;
  if (lang.startsWith('vi')) return LocaleType.VI_VN;
  if (lang.startsWith('ru')) return LocaleType.RU_RU;
  return LocaleType.EN_US;
}

// ==================== Component ====================

const SpreadsheetEditorWrapper: React.FC<SpreadsheetEditorWrapperProps> =
  React.memo(
    ({
      spreadsheetId,
      initialData,
      onContentChange,
      getSnapshotRef,
      univerAPIRef,
      readOnly,
    }) => {
      const containerRef = useRef<HTMLDivElement>(null);
      const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
      const disposeRef = useRef<(() => void) | null>(null);
      const onContentChangeRef = useRef(onContentChange);
      onContentChangeRef.current = onContentChange;

      const { isDark } = useTheme();
      const { i18n } = useTranslation();

      // Get snapshot function — exposed to parent
      const getSnapshot = useCallback((): string | null => {
        if (!univerRef.current) return null;
        try {
          const workbook = univerRef.current.univerAPI.getActiveWorkbook();
          if (!workbook) return null;
          const snapshot = workbook.save();
          return JSON.stringify(snapshot);
        } catch (err) {
          console.error('[SpreadsheetEditor] Failed to get snapshot:', err);
          return null;
        }
      }, []);

      // Expose getSnapshot to parent via ref
      useEffect(() => {
        if (getSnapshotRef) {
          getSnapshotRef.current = getSnapshot;
        }
        return () => {
          if (getSnapshotRef) {
            getSnapshotRef.current = null;
          }
        };
      }, [getSnapshot, getSnapshotRef]);

      // Expose univerAPI to parent via ref (for XLSX export/import)
      useEffect(() => {
        if (univerAPIRef) {
          univerAPIRef.current = univerRef.current?.univerAPI || null;
        }
        return () => {
          if (univerAPIRef) {
            univerAPIRef.current = null;
          }
        };
      }, [univerAPIRef]);

      // Initialize Univer (wait for web fonts to load first)
      useEffect(() => {
        if (!containerRef.current) return;
        let cancelled = false;
        const container = containerRef.current;

        // Wait for web fonts to finish loading so Univer sees them as available
        document.fonts.ready.then(() => {
          if (cancelled || !container) return;

          const locale = getUniverLocale(i18n.language);

          const { univerAPI } = createUniver({
            locale,
            darkMode: isDark,
            theme: gatrixUniverTheme,
            locales: {
              [LocaleType.EN_US]: mergeLocales(
                UniverPresetSheetsCoreEnUS,
                UniverPresetSheetsFilterEnUS
              ),
              [LocaleType.KO_KR]: mergeLocales(
                UniverPresetSheetsCoreKoKR,
                UniverPresetSheetsFilterKoKR,
                // Override untranslated statusbar keys
                {
                  statusbar: {
                    sum: '합계',
                    average: '평균',
                    min: '최소',
                    max: '최대',
                    count: '숫자 개수',
                    countA: '개수',
                  },
                }
              ),
              [LocaleType.ZH_CN]: mergeLocales(
                UniverPresetSheetsCoreZhCN,
                UniverPresetSheetsFilterZhCN,
                {
                  statusbar: {
                    sum: '求和',
                    average: '平均值',
                    min: '最小值',
                    max: '最大值',
                    count: '数值计数',
                    countA: '计数',
                  },
                }
              ),
            },
            presets: [
              UniverSheetsCorePreset({
                container,
                customFontFamily: {
                  override: true,
                  list: [
                    // ── 기본 (시스템 내장) ──
                    { value: 'Arial', label: 'Arial', category: 'sans-serif' },
                    {
                      value: 'Times New Roman',
                      label: 'Times New Roman',
                      category: 'serif',
                    },
                    {
                      value: 'Tahoma',
                      label: 'Tahoma',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Verdana',
                      label: 'Verdana',
                      category: 'sans-serif',
                    },
                    { value: 'Georgia', label: 'Georgia', category: 'serif' },
                    {
                      value: 'Consolas',
                      label: 'Consolas',
                      category: 'monospace',
                    },
                    // ── 웹 폰트 (Google Fonts) ──
                    { value: 'Inter', label: 'Inter', category: 'sans-serif' },
                    {
                      value: 'Roboto',
                      label: 'Roboto',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Open Sans',
                      label: 'Open Sans',
                      category: 'sans-serif',
                    },
                    { value: 'Lato', label: 'Lato', category: 'sans-serif' },
                    {
                      value: 'Montserrat',
                      label: 'Montserrat',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Poppins',
                      label: 'Poppins',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Fira Code',
                      label: 'Fira Code',
                      category: 'monospace',
                    },
                    // ── 한국어 (Google Fonts / CDN) ──
                    {
                      value: 'Noto Sans KR',
                      label: 'Noto Sans KR (본고딕)',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Noto Serif KR',
                      label: 'Noto Serif KR (본명조)',
                      category: 'serif',
                    },
                    {
                      value: 'Pretendard',
                      label: 'Pretendard',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Nanum Gothic',
                      label: '나눔고딕',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Nanum Myeongjo',
                      label: '나눔명조',
                      category: 'serif',
                    },
                    {
                      value: 'D2Coding',
                      label: 'D2Coding',
                      category: 'monospace',
                    },
                    // ── 중국어 (Google Fonts / 시스템) ──
                    {
                      value: 'Noto Sans SC',
                      label: 'Noto Sans SC (思源黑体)',
                      category: 'sans-serif',
                    },
                    {
                      value: 'Noto Serif SC',
                      label: 'Noto Serif SC (思源宋体)',
                      category: 'serif',
                    },
                    {
                      value: 'Microsoft YaHei',
                      label: '微软雅黑',
                      category: 'sans-serif',
                    },
                  ],
                },
              }),
              UniverSheetsFilterPreset(),
            ],
          });

          univerRef.current = { univerAPI } as any;
          // Expose to parent for XLSX export/import
          if (univerAPIRef) {
            univerAPIRef.current = univerAPI;
          }

          // Load initial data or create empty workbook
          let workbookData: any = null;
          if (initialData) {
            try {
              workbookData = JSON.parse(initialData);
            } catch (err) {
              console.error(
                '[SpreadsheetEditor] Failed to parse initialData:',
                err
              );
            }
          }

          univerAPI.createWorkbook(workbookData || {});

          // Restore last viewed sheet from localStorage
          if (spreadsheetId) {
            try {
              const saved = localStorage.getItem(`ss-view-${spreadsheetId}`);
              if (saved) {
                const viewState = JSON.parse(saved);
                if (viewState.sheetId) {
                  const wb = univerAPI.getActiveWorkbook();
                  const sheet = wb?.getSheetBySheetId(viewState.sheetId);
                  if (sheet) {
                    sheet.activate();
                  }
                }
              }
            } catch {
              /* ignore */
            }
          }

          // Listen for data-modifying changes only (MUTATION type)
          // Exclude scroll, selection, and other non-data operations
          const NON_DATA_MUTATIONS = new Set([
            // Scroll & viewport (confirmed via console: type=1 on scroll)
            'sheet.operation.set-scroll',
            'sheet.mutation.set-scroll-relative',
            'sheet.operation.set-scroll-relative',
            'sheet.command.set-scroll-relative',
            'sheet.mutation.scroll',
            // Selection (confirmed via console: type=1 on click/select)
            'sheet.operation.set-selections',
            'sheet.mutation.set-selections',
            'doc.operation.set-selections',
            'sheet.operation.set-activate-cell-edit',
            // Worksheet activation
            'sheet.operation.set-worksheet-active',
            'sheet.mutation.set-worksheet-active-operation',
            // Focus / UI / initial load
            'sheet.operation.set-focus',
            'doc.mutation.rich-text-editing',
            'doc.command-replace-snapshot',
          ]);

          const subscription = univerAPI.onCommandExecuted((command: any) => {
            if (command.type === 2) return; // Always skip OPERATION
            if (NON_DATA_MUTATIONS.has(command.id)) return; // Skip known non-data mutations

            if (command.type === 1) {
              onContentChangeRef.current?.();
            }
          });

          // Track sheet tab switches → save to localStorage
          const viewSubscription = univerAPI.onCommandExecuted(
            (command: any) => {
              if (
                command.id === 'sheet.operation.set-worksheet-active' &&
                spreadsheetId
              ) {
                try {
                  const wb = univerAPI.getActiveWorkbook();
                  if (wb) {
                    const activeSheet = wb.getActiveSheet();
                    const viewState: any = {
                      sheetId: activeSheet?.getSheetId(),
                    };
                    localStorage.setItem(
                      `ss-view-${spreadsheetId}`,
                      JSON.stringify(viewState)
                    );
                  }
                } catch {
                  /* ignore */
                }
              }
            }
          );

          disposeRef.current = () => {
            // Save view state to localStorage before disposing
            if (spreadsheetId) {
              try {
                const wb = univerAPI.getActiveWorkbook();
                if (wb) {
                  const activeSheet = wb.getActiveSheet();
                  const viewState: any = { sheetId: activeSheet?.getSheetId() };
                  localStorage.setItem(
                    `ss-view-${spreadsheetId}`,
                    JSON.stringify(viewState)
                  );
                }
              } catch {
                /* ignore */
              }
            }
            subscription?.dispose();
            viewSubscription?.dispose();
            univerAPI.dispose();
          };
        });

        return () => {
          cancelled = true;
          disposeRef.current?.();
          disposeRef.current = null;
          univerRef.current = null;
        };
        // Only run on mount — initialData changes are not hot-reloaded
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      // Toggle dark mode reactively when theme changes
      useEffect(() => {
        if (univerRef.current) {
          try {
            univerRef.current.univerAPI.toggleDarkMode(isDark);
          } catch {
            // Ignore if API not ready
          }
        }
      }, [isDark]);

      return (
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
        />
      );
    }
  );

SpreadsheetEditorWrapper.displayName = 'SpreadsheetEditorWrapper';

export default SpreadsheetEditorWrapper;
