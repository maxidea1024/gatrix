import React, { useRef, useEffect, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import JSON5 from 'json5';
import { prodLogger } from '../../utils/logger';

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
  onValidationError
}) => {
  const theme = useTheme();
  const editorRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isUpdatingRef = useRef(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Real-time JSON5 validation
  useEffect(() => {
    if (json5Mode && onValidationError) {
      const trimmed = (value || '').trim();
      if (trimmed.length === 0) {
        onValidationError(null);
        setInternalError(null);
        return;
      }
      try {
        JSON5.parse(trimmed);
        onValidationError(null);
        setInternalError(null);
      } catch (e: any) {
        const errorMsg = e.message || 'Invalid JSON5';
        onValidationError(errorMsg);
        setInternalError(errorMsg);
      }
    }
  }, [value, json5Mode, onValidationError]);

  // Displayed error: external error takes priority, then internal validation error
  const displayError = error || (json5Mode ? internalError : null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    setIsLoading(false);

    try {
      if (json5Mode) {
        // JSON5 mode: Disable all validation in editor
        // Validation happens on save via parseJson5()
        if (monaco?.languages?.typescript?.javascriptDefaults) {
          monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: true,
          });
        }
      } else {
        // Standard JSON mode
        if (monaco?.languages?.json?.jsonDefaults) {
          monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            validate: true,
            allowComments: false,
            schemas: [],
            enableSchemaRequest: true
          });
        }
      }

      // 에디터 옵션 설정
      if (editor?.updateOptions) {
        editor.updateOptions({
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          formatOnPaste: false,
          formatOnType: false,
          tabSize: 2,
          insertSpaces: true,
          fixedOverflowWidgets: true,
          padding: { top: 8, bottom: 8 }
        });
      }

      // 에디터 DOM 요소의 포커스 스타일 제거
      const editorElement = editor.getDomNode();
      if (editorElement) {
        editorElement.style.outline = 'none';
        editorElement.style.border = 'none';
      }

      // 포맷팅 단축키 설정
      if (editor?.addAction && monaco?.KeyMod && monaco?.KeyCode) {
        editor.addAction({
          id: 'format-json',
          label: 'Format JSON',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
          run: () => {
            const formatAction = editor.getAction('editor.action.formatDocument');
            if (formatAction) {
              formatAction.run();
            }
          }
        });
      }
    } catch (error) {
      prodLogger.warn('Monaco Editor initialization warning:', error);
    }
  };

  const handleEditorChange = useCallback((newValue: string | undefined) => {
    if (newValue !== undefined && !isUpdatingRef.current) {
      onChange(newValue);
    }
  }, [onChange]);

  // value prop이 변경될 때 커서 위치 보존
  useEffect(() => {
    if (editorRef.current && value !== undefined) {
      const currentValue = editorRef.current.getValue();
      if (currentValue !== value) {
        const position = editorRef.current.getPosition();
        isUpdatingRef.current = true;
        editorRef.current.setValue(value);
        if (position) {
          editorRef.current.setPosition(position);
        }
        isUpdatingRef.current = false;
      }
    }
  }, [value]);

  const editorTheme = theme.palette.mode === 'dark' ? 'vs-dark' : 'vs';

  // Check if height is 100% to use flex layout
  const isFlexHeight = height === '100%';

  return (
    <Box sx={isFlexHeight ? { display: 'flex', flexDirection: 'column', height: '100%' } : undefined}>
      {label && (
        <Typography variant="subtitle2" gutterBottom sx={{ flexShrink: 0 }}>
          {label}
        </Typography>
      )}

      <Box
        sx={{
          border: '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          ...(isFlexHeight && { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }),
          overflow: 'hidden',
          position: 'relative',
          transition: 'border-color 0.2s ease-in-out',
          '&:focus-within': {
            borderColor: error ? 'error.main' : 'primary.main',
            borderWidth: '2px',
          },
          '& .monaco-editor': {
            '& .margin': {
              backgroundColor: 'transparent'
            },
            '& .monaco-editor-background': {
              backgroundColor: 'transparent'
            },
            '&.focused': {
              outline: 'none !important',
              border: 'none !important'
            }
          },
          '& .monaco-editor .decorationsOverviewRuler': {
            display: 'none'
          }
        }}
      >
        {isLoading && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: height,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              backgroundColor: 'background.paper',
              zIndex: 1
            }}
          >
            <CircularProgress size={24} />
          </Box>
        )}
        <Box sx={isFlexHeight ? { flex: 1, minHeight: 0 } : { height }}>
          <Editor
            height="100%"
            defaultLanguage={json5Mode ? 'javascript' : 'json'}
            defaultValue={value || placeholder}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            theme={editorTheme}
            loading={<CircularProgress size={24} />}
            options={{
              readOnly,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            formatOnPaste: false,
            formatOnType: false,
            tabSize: 2,
            insertSpaces: true,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'line',
            selectionHighlight: false,
            occurrencesHighlight: false,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            overviewRulerBorder: false,
            fixedOverflowWidgets: true,
            padding: { top: 8, bottom: 8 },
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            }
          }}
        />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {helperText && !error && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default JsonEditor;

// Utility function to parse JSON5 and convert to standard JSON object
export const parseJson5 = (text: string): { success: boolean; data?: any; error?: string } => {
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
