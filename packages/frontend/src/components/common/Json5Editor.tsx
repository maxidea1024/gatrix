import React, { useRef, useEffect, useState } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { json5, json5ParseLinter } from 'codemirror-json5';
import { linter, lintGutter } from '@codemirror/lint';
import JSON5 from 'json5';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const isUpdatingRef = useRef(false);
  const [internalError, setInternalError] = useState<string | null>(null);

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
      EditorView.theme({
        '&': {
          height: typeof height === 'number' ? `${height}px` : height,
          border: '1px solid',
          borderColor: error ? theme.palette.error.main : theme.palette.divider,
          borderRadius: '4px',
          fontSize: '14px',
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
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
  }, [theme.palette.mode]); // Only recreate on theme change

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
        sx={{ 
          flex: height === '100%' ? 1 : 'none',
          minHeight: 0,
          '& .cm-editor': {
            height: height === '100%' ? '100%' : undefined,
          }
        }} 
      />

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

