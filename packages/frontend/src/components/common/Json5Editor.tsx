import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Alert, Menu, MenuItem, Divider, ListItemIcon, ListItemText } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { json5, json5ParseLinter } from 'codemirror-json5';
import { linter, lintGutter } from '@codemirror/lint';
import { openSearchPanel, gotoLine } from '@codemirror/search';
import { undo, redo, selectAll } from '@codemirror/commands';
import JSON5 from 'json5';
import { copyToClipboard } from '../../utils/clipboard';
import { useTranslation } from 'react-i18next';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import SearchIcon from '@mui/icons-material/Search';
import ShortcutIcon from '@mui/icons-material/Shortcut';

interface Json5EditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number | string;
  readOnly?: boolean;
  error?: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  onValidationError?: (error: string | null) => void;
}

const Json5Editor: React.FC<Json5EditorProps> = ({
  value,
  onChange,
  height = 300,
  readOnly = false,
  error,
  label,
  helperText,
  onValidationError
}) => {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const isUpdatingRef = useRef(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? { mouseX: event.clientX + 2, mouseY: event.clientY - 6 }
        : null,
    );
  }, [contextMenu]);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Context menu actions
  const handleCut = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
      copyToClipboard(selection);
      view.dispatch({
        changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: '' }
      });
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleCopy = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      const selection = view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to);
      copyToClipboard(selection);
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handlePaste = useCallback(async () => {
    const view = editorViewRef.current;
    if (view) {
      const text = await navigator.clipboard.readText();
      view.dispatch({
        changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: text }
      });
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleUndo = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      undo(view);
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleRedo = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      redo(view);
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleSelectAll = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      selectAll(view);
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleFind = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      openSearchPanel(view);
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleGoToLine = useCallback(() => {
    const view = editorViewRef.current;
    if (view) {
      gotoLine(view);
    }
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  // CodeMirror search dialog phrases for localization
  const getSearchPhrases = () => ({
    'Find': t('codemirror.find'),
    'Replace': t('codemirror.replace'),
    'next': t('codemirror.next'),
    'previous': t('codemirror.previous'),
    'all': t('codemirror.all'),
    'match case': t('codemirror.matchCase'),
    'by word': t('codemirror.byWord'),
    'regexp': t('codemirror.regexp'),
    'replace': t('codemirror.replaceAction'),
    'replace all': t('codemirror.replaceAll'),
    'close': t('codemirror.close'),
    'Go to line': t('codemirror.goToLine'),
    'go': t('codemirror.go'),
  });

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme.palette.mode === 'dark';

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isUpdatingRef.current) {
        const newValue = update.state.doc.toString();
        onChange(newValue);

        // Real-time JSON5 validation
        try {
          const trimmed = newValue.trim();
          if (trimmed.length === 0) {
            setInternalError(null);
            onValidationError?.(null);
          } else {
            JSON5.parse(trimmed);
            setInternalError(null);
            onValidationError?.(null);
          }
        } catch (e: any) {
          const errorMsg = e.message || 'Invalid JSON5';
          setInternalError(errorMsg);
          onValidationError?.(errorMsg);
        }
      }
    });

    const extensions = [
      basicSetup,
      json5(),
      linter(json5ParseLinter()),
      lintGutter(),
      updateListener,
      EditorView.editable.of(!readOnly),
      EditorState.phrases.of(getSearchPhrases()),
      EditorView.theme({
        '&': {
          height: typeof height === 'number' ? `${height}px` : height,
          border: '1px solid',
          borderColor: error ? theme.palette.error.main : theme.palette.divider,
          borderRadius: '4px',
          fontSize: '14px',
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          outline: 'none !important',
        },
        '&.cm-focused': {
          outline: 'none !important',
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'D2Coding, "NanumGothicCoding", "Source Han Mono", "Noto Sans Mono CJK KR", Menlo, Monaco, "Courier New", monospace',
        },
        '.cm-content': {
          padding: '8px',
          color: isDark ? '#d4d4d4' : '#333333',
        },
        '.cm-gutters': {
          backgroundColor: isDark ? '#252526' : '#f5f5f5',
          borderRight: '1px solid',
          borderColor: theme.palette.divider,
          color: isDark ? '#858585' : '#999999',
        },
        '.cm-activeLineGutter': {
          backgroundColor: isDark ? '#2a2d2e' : '#e8e8e8',
        },
        '.cm-activeLine': {
          backgroundColor: isDark ? '#2a2d2e40' : '#f0f0f040',
        },
        '.cm-cursor': {
          borderLeftColor: isDark ? '#ffffff' : '#000000',
        },
        // Selection styling - use high contrast colors
        '.cm-selectionBackground': {
          backgroundColor: isDark ? '#264f78 !important' : '#add6ff !important',
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: isDark ? '#264f78 !important' : '#add6ff !important',
        },
        // Force selected text to be visible using ::selection pseudo-element
        '.cm-content ::selection': {
          backgroundColor: isDark ? '#264f78' : '#add6ff',
          color: isDark ? '#ffffff' : '#000000',
        },
        '.cm-line ::selection': {
          backgroundColor: isDark ? '#264f78' : '#add6ff',
          color: isDark ? '#ffffff' : '#000000',
        },
        // JSON5 syntax highlighting for dark theme
        '.ͼb': { // boolean (true/false)
          color: isDark ? '#569cd6' : '#0000ff',
        },
        '.ͼc': { // number
          color: isDark ? '#b5cea8' : '#098658',
        },
        '.ͼd': { // string
          color: isDark ? '#ce9178' : '#a31515',
        },
        '.ͼe': { // property name
          color: isDark ? '#9cdcfe' : '#001080',
        },
        '.ͼm': { // comment
          color: isDark ? '#6a9955' : '#008000',
        },
        // Lint tooltip styling for dark theme
        '.cm-tooltip': {
          backgroundColor: isDark ? '#252526' : '#f5f5f5',
          color: isDark ? '#d4d4d4' : '#333333',
          border: `1px solid ${isDark ? '#454545' : '#c8c8c8'}`,
          borderRadius: '4px',
        },
        '.cm-tooltip-lint': {
          backgroundColor: isDark ? '#252526' : '#f5f5f5',
          color: isDark ? '#d4d4d4' : '#333333',
        },
        '.cm-diagnostic': {
          padding: '4px 8px',
        },
        '.cm-diagnostic-error': {
          borderLeftColor: '#f44336',
          color: isDark ? '#f48771' : '#d32f2f',
        },
        '.cm-diagnostic-warning': {
          borderLeftColor: '#ff9800',
          color: isDark ? '#ffb74d' : '#f57c00',
        },
        '.cm-lintPoint-error:after': {
          borderBottomColor: '#f44336',
        },
        '.cm-lintPoint-warning:after': {
          borderBottomColor: '#ff9800',
        },
      }),
    ];

    const state = EditorState.create({
      doc: value || '',
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [theme.palette.mode, i18n.language]); // Recreate on theme or language change

  // Update editor content when value prop changes externally
  useEffect(() => {
    const view = editorViewRef.current;
    if (view && !isUpdatingRef.current) {
      const currentValue = view.state.doc.toString();
      if (currentValue !== value) {
        isUpdatingRef.current = true;
        view.dispatch({
          changes: {
            from: 0,
            to: currentValue.length,
            insert: value || '',
          },
        });
        isUpdatingRef.current = false;
      }
    }
  }, [value]);

  const displayError = error || internalError;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: height === '100%' ? '100%' : 'auto' }}>
      {label && (
        <Typography variant="subtitle2" gutterBottom sx={{ flexShrink: 0 }}>
          {label}
        </Typography>
      )}

      <Box
        ref={containerRef}
        onContextMenu={handleContextMenu}
        sx={{
          flex: height === '100%' ? 1 : 'none',
          minHeight: 0,
          '& .cm-editor': {
            height: height === '100%' ? '100%' : undefined,
          }
        }}
      />

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleUndo} disabled={readOnly}>
          <ListItemIcon><UndoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.undo')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+Z</Typography>
        </MenuItem>
        <MenuItem onClick={handleRedo} disabled={readOnly}>
          <ListItemIcon><RedoIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.redo')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+Y</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleCut} disabled={readOnly}>
          <ListItemIcon><ContentCutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.cut')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+X</Typography>
        </MenuItem>
        <MenuItem onClick={handleCopy}>
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.copy')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+C</Typography>
        </MenuItem>
        <MenuItem onClick={handlePaste} disabled={readOnly}>
          <ListItemIcon><ContentPasteIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.paste')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+V</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSelectAll}>
          <ListItemIcon><SelectAllIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.selectAll')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+A</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleFind}>
          <ListItemIcon><SearchIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.find')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+F</Typography>
        </MenuItem>
        <MenuItem onClick={handleGoToLine}>
          <ListItemIcon><ShortcutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('codemirror.goToLine')}</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>Ctrl+G</Typography>
        </MenuItem>
      </Menu>

      {displayError && (
        <Alert severity="error" sx={{ mt: 1, flexShrink: 0 }}>
          {displayError}
        </Alert>
      )}

      {helperText && !displayError && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', flexShrink: 0 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default Json5Editor;

