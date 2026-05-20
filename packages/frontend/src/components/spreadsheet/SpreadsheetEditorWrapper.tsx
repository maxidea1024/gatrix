import React, { useEffect, useRef, useCallback } from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsFilterPreset } from '@univerjs/preset-sheets-filter';
import { UniverSheetsAdvancedPreset } from '@univerjs/preset-sheets-advanced';
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing';

import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import UniverPresetSheetsFilterEnUS from '@univerjs/preset-sheets-filter/locales/en-US';
import UniverPresetSheetsAdvancedEnUS from '@univerjs/preset-sheets-advanced/locales/en-US';
import UniverPresetSheetsDrawingEnUS from '@univerjs/preset-sheets-drawing/locales/en-US';

import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-filter/lib/index.css';
import '@univerjs/preset-sheets-advanced/lib/index.css';
import '@univerjs/preset-sheets-drawing/lib/index.css';

// ==================== Types ====================

export interface SpreadsheetEditorWrapperProps {
  /** Initial workbook data (Univer IWorkbookData JSON string or null for new) */
  initialData: string | null;
  /** Called when content changes (debounce handled externally via useAutoSave) */
  onContentChange?: () => void;
  /** Called to get current workbook snapshot for saving */
  getSnapshotRef?: React.MutableRefObject<(() => string | null) | null>;
  /** Read-only mode */
  readOnly?: boolean;
}

// ==================== Helper ====================

function getLocale(): LocaleType {
  try {
    const lang = localStorage.getItem('i18nextLng') || 'en';
    if (lang.startsWith('ko')) return LocaleType.KO_KR;
    if (lang.startsWith('zh')) return LocaleType.ZH_CN;
    return LocaleType.EN_US;
  } catch {
    return LocaleType.EN_US;
  }
}

// ==================== Component ====================

const SpreadsheetEditorWrapper: React.FC<SpreadsheetEditorWrapperProps> =
  React.memo(({ initialData, onContentChange, getSnapshotRef, readOnly }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const univerRef = useRef<ReturnType<typeof createUniver> | null>(null);
    const disposeRef = useRef<(() => void) | null>(null);
    const onContentChangeRef = useRef(onContentChange);
    onContentChangeRef.current = onContentChange;

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

    // Initialize Univer
    useEffect(() => {
      if (!containerRef.current) return;

      const locale = getLocale();

      const { univerAPI } = createUniver({
        locale,
        locales: {
          [LocaleType.EN_US]: mergeLocales(
            UniverPresetSheetsCoreEnUS,
            UniverPresetSheetsFilterEnUS,
            UniverPresetSheetsAdvancedEnUS,
            UniverPresetSheetsDrawingEnUS
          ),
        },
        presets: [
          UniverSheetsCorePreset({
            container: containerRef.current,
          }),
          UniverSheetsFilterPreset(),
          UniverSheetsDrawingPreset(),
          UniverSheetsAdvancedPreset(),
        ],
      });

      univerRef.current = { univerAPI } as any;

      // Load initial data or create empty workbook
      let workbookData: any = null;
      if (initialData) {
        try {
          workbookData = JSON.parse(initialData);
        } catch (err) {
          console.error('[SpreadsheetEditor] Failed to parse initialData:', err);
        }
      }

      univerAPI.createWorkbook(workbookData || {});

      // Listen for changes
      const subscription = univerAPI.onCommandExecuted(() => {
        onContentChangeRef.current?.();
      });

      disposeRef.current = () => {
        subscription?.dispose();
        univerAPI.dispose();
      };

      return () => {
        disposeRef.current?.();
        disposeRef.current = null;
        univerRef.current = null;
      };
      // Only run on mount — initialData changes are not hot-reloaded
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
  });

SpreadsheetEditorWrapper.displayName = 'SpreadsheetEditorWrapper';

export default SpreadsheetEditorWrapper;
