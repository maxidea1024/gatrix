import React, { useEffect, useState, useCallback, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import JSON5 from 'json5';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number | string;
  readOnly?: boolean;
  error?: string;
  label?: string;
  placeholder?: string;
  helperText?: string;
  /** Enable JSON5 mode (supports comments, trailing commas, unquoted keys, etc.) */
  json5Mode?: boolean;
  /** Callback for real-time validation error (JSON5 mode only) */
  onValidationError?: (error: string | null) => void;
  /** Callback for validation (isValid, errorMessage) - alias for onValidationError */
  onValidation?: (isValid: boolean, error?: string | null) => void;
}

const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  height = 300,
  readOnly = false,
  error,
  label,
  placeholder = '{\n  "key": "value"\n}',
  helperText,
  json5Mode = false,
  onValidationError,
  onValidation,
}) => {
  const theme = useTheme();
  const [internalError, setInternalError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  // Real-time JSON validation with debounce to prevent flickering
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = (value || '').trim();
      if (trimmed.length === 0) {
        if (onValidationError) onValidationError(null);
        if (onValidation) onValidation(true, null);
        setInternalError(null);
        return;
      }
      try {
        if (json5Mode) {
          JSON5.parse(trimmed);
        } else {
          JSON.parse(trimmed);
        }
        if (onValidationError) onValidationError(null);
        if (onValidation) onValidation(true, null);
        setInternalError(null);
      } catch (e: any) {
        const errorMsg =
          e.message || (json5Mode ? 'Invalid JSON5' : 'Invalid JSON');
        if (onValidationError) onValidationError(errorMsg);
        if (onValidation) onValidation(false, errorMsg);
        setInternalError(errorMsg);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, json5Mode]);

  // Displayed error: external error takes priority, then internal validation error
  const displayError = error || internalError;

  const isDark = theme.palette.mode === 'dark';

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val || '');
    },
    [onChange]
  );

  // Manual ResizeObserver instead of automaticLayout to avoid layout loops
  useEffect(() => {
    if (!containerRef.current || !editorRef.current) return;
    const ro = new ResizeObserver(() => {
      editorRef.current?.layout();
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Force EOL to LF to prevent cursor misalignment caused by \r\n
    const model = editor.getModel();
    if (model && monaco?.editor?.EndOfLineSequence) {
      model.setEOL(monaco.editor.EndOfLineSequence.LF);
    }

    // Trigger initial layout
    setTimeout(() => editor.layout(), 0);

    // Remeasure fonts after custom font load to prevent cursor gap
    if (
      typeof document !== 'undefined' &&
      document.fonts &&
      document.fonts.ready
    ) {
      document.fonts.ready.then(() => {
        if (monaco?.editor?.remeasureFonts) {
          monaco.editor.remeasureFonts();
        }
      });
    }
  }, []);

  // Check if height is 100% to use flex layout
  const isFlexHeight = height === '100%';

  // Compute height string for Monaco
  const editorHeight = isFlexHeight
    ? '100%'
    : typeof height === 'number'
      ? `${height}px`
      : height;

  return (
    <Box
      sx={
        isFlexHeight
          ? { display: 'flex', flexDirection: 'column', height: '100%' }
          : undefined
      }
    >
      {label && (
        <Typography variant="subtitle2" gutterBottom sx={{ flexShrink: 0 }}>
          {label}
        </Typography>
      )}

      <Box
        ref={containerRef}
        sx={{
          border: '1px solid',
          borderColor: displayError ? 'error.main' : 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          ...(isFlexHeight && {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }),
          position: 'relative',
          transition: 'border-color 0.2s ease-in-out',
          // Suppress Monaco Find Widget tooltip flicker inside MUI Drawers
          '& .monaco-editor .find-widget .button': {
            title: 'none',
          },
          '& .monaco-editor .monaco-hover': {
            pointerEvents: 'auto !important',
          },
          // Prevent tooltip overlay flicker by stabilizing the hover widget
          '& .monaco-editor .monaco-hover-content': {
            pointerEvents: 'auto !important',
          },
          // Force Find Widget tooltips to not cause reflow
          '& .monaco-editor .find-widget .monaco-action-bar .action-label[title]':
            {
              overflow: 'visible',
            },
        }}
      >
        <Editor
          height={editorHeight}
          language={json5Mode ? 'javascript' : 'json'}
          value={value !== undefined ? value : placeholder}
          theme={isDark ? 'vs-dark' : 'light'}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            fontSize: 14,
            fontFamily:
              '"D2Coding", "NanumGothicCoding", "Consolas", "Courier New", monospace',
            lineNumbers: 'on',
            folding: true,
            padding: { top: 8, bottom: 8 },
            renderLineHighlight: 'none',
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            bracketPairColorization: { enabled: true },
            // Disable automaticLayout - we use ResizeObserver instead
            automaticLayout: false,
            // Disable hover for stability inside MUI Drawer
            hover: { enabled: false },
            // Disable parameter hints to avoid tooltip conflicts
            parameterHints: { enabled: false },
          }}
        />
      </Box>

      <Box sx={{ minHeight: '1.25rem' }}>
        {error ? (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        ) : helperText ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 1, display: 'block' }}
          >
            {helperText}
          </Typography>
        ) : (
          /* Empty placeholder to reserve space */
          <Box sx={{ height: 1 }} />
        )}
      </Box>
    </Box>
  );
};

// Custom comparator: skip function props (onChange, onValidation, etc.)
// which are typically recreated on every parent render.
export default React.memo(JsonEditor, (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.height === nextProps.height &&
    prevProps.error === nextProps.error &&
    prevProps.label === nextProps.label &&
    prevProps.helperText === nextProps.helperText &&
    prevProps.json5Mode === nextProps.json5Mode &&
    prevProps.placeholder === nextProps.placeholder
  );
});

// Utility function to parse JSON5 and convert to standard JSON object
export const parseJson5 = (
  text: string
): { success: boolean; data?: any; error?: string } => {
  try {
    const trimmed = (text || '').trim();
    if (trimmed.length === 0) {
      return { success: true, data: {} };
    }
    const data = JSON5.parse(trimmed);
    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message || 'Invalid JSON5 format' };
  }
};

// Utility function to stringify object to JSON5 format (actually uses standard JSON for storage)
export const stringifyJson5 = (obj: any, pretty = true): string => {
  if (obj === null || obj === undefined) {
    return '{}';
  }
  return pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
};
