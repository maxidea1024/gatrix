import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { json5, json5ParseLinter } from 'codemirror-json5';
import { linter, lintGutter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';

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
        import('json5').then((JSON5) => {
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
        });
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
        },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: 'monospace',
        },
        '.cm-content': {
          padding: '8px',
        },
        '.cm-gutters': {
          backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5',
          borderRight: '1px solid',
          borderColor: theme.palette.divider,
        },
      }),
      ...(isDark ? [oneDark] : []),
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

