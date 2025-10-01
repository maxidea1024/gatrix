import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Alert,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  FormatAlignLeft as FormatIcon,
  CheckCircle as ValidIcon,
  Error as ErrorIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import Editor from '@monaco-editor/react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: 'json' | 'yaml';
  height?: number | string;
  readOnly?: boolean;
  placeholder?: string;
  showValidation?: boolean;
  showFormatButton?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  height = 300,
  readOnly = false,
  placeholder,
  showValidation = true,
  showFormatButton = true,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const editorRef = useRef<any>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  // Handle editor mount
  const handleEditorDidMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      fontSize: 14,
      lineNumbers: 'on',
      folding: true,
      bracketMatching: 'always',
      autoIndent: 'full',
      formatOnPaste: true,
      formatOnType: true,
    });

    // Set up validation for JSON
    if (language === 'json') {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [],
        enableSchemaRequest: false,
      });
    }
  }, [language]);

  // Handle value change
  const handleChange = useCallback((newValue: string | undefined) => {
    const val = newValue || '';
    onChange(val);
    
    if (showValidation) {
      validateContent(val);
    }
  }, [onChange, showValidation]);

  // Validate content
  const validateContent = useCallback((content: string) => {
    if (!content.trim()) {
      setValidationError(null);
      setIsValid(true);
      return;
    }

    try {
      if (language === 'json') {
        JSON.parse(content);
      } else if (language === 'yaml') {
        // Basic YAML validation (you might want to use a proper YAML parser)
        if (content.includes('\t')) {
          throw new Error('YAML should use spaces, not tabs for indentation');
        }
      }
      setValidationError(null);
      setIsValid(true);
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : 'Invalid syntax');
      setIsValid(false);
    }
  }, [language]);

  // Format code
  const formatCode = useCallback(() => {
    if (!editorRef.current) return;

    try {
      if (language === 'json') {
        const parsed = JSON.parse(value);
        const formatted = JSON.stringify(parsed, null, 2);
        onChange(formatted);
      } else if (language === 'yaml') {
        // Basic YAML formatting (you might want to use a proper YAML formatter)
        const lines = value.split('\n');
        const formatted = lines
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
        onChange(formatted);
      }
    } catch (error) {
      console.error('Format error:', error);
    }
  }, [value, onChange, language]);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
  }, [isFullscreen]);

  const editorContent = (
    <Box sx={{ position: 'relative', height: isFullscreen ? '80vh' : height }}>
      {/* Toolbar */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
        }}
      >
        <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon fontSize="small" />
          {language === 'json' ? t('remoteConfig.editor.jsonEditor') : t('remoteConfig.editor.yamlEditor')}
        </Typography>
        
        <Stack direction="row" spacing={1}>
          {showValidation && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {isValid ? (
                <Tooltip title={t('remoteConfig.editor.syntaxValid')}>
                  <ValidIcon color="success" fontSize="small" />
                </Tooltip>
              ) : (
                <Tooltip title={validationError || 'Syntax error'}>
                  <ErrorIcon color="error" fontSize="small" />
                </Tooltip>
              )}
            </Box>
          )}
          
          {showFormatButton && !readOnly && (
            <Tooltip title={t('remoteConfig.editor.formatCode')}>
              <IconButton size="small" onClick={formatCode}>
                <FormatIcon />
              </IconButton>
            </Tooltip>
          )}
          
          <Tooltip title={isFullscreen ? t('remoteConfig.editor.exitFullscreen') : t('remoteConfig.editor.fullscreen')}>
            <IconButton size="small" onClick={toggleFullscreen}>
              {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {/* Editor */}
      <Box sx={{ height: `calc(100% - 48px)` }}>
        <Editor
          height="100%"
          language={language}
          value={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          theme={isDark ? 'vs-dark' : 'light'}
          options={{
            readOnly,
            placeholder,
          }}
        />
      </Box>

      {/* Validation Error */}
      {showValidation && validationError && (
        <Alert 
          severity="error" 
          sx={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            borderRadius: 0,
            zIndex: 1000,
          }}
        >
          {t('remoteConfig.editor.syntaxError', { error: validationError })}
        </Alert>
      )}
    </Box>
  );

  if (isFullscreen) {
    return (
      <Dialog
        open={isFullscreen}
        onClose={toggleFullscreen}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: { width: '95vw', height: '90vh', maxHeight: '90vh' }
        }}
      >
        <DialogTitle sx={{ p: 0 }}>
          {editorContent}
        </DialogTitle>
      </Dialog>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {editorContent}
    </Paper>
  );
};

export default CodeEditor;
