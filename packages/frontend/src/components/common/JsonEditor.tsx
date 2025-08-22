import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Box, Typography, Alert } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number | string;
  readOnly?: boolean;
  error?: string;
  label?: string;
  placeholder?: string;
}

const JsonEditor: React.FC<JsonEditorProps> = ({
  value,
  onChange,
  height = 300,
  readOnly = false,
  error,
  label,
  placeholder = '{\n  "key": "value"\n}'
}) => {
  const theme = useTheme();
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // JSON 스키마 설정
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      allowComments: false,
      schemas: [],
      enableSchemaRequest: true
    });

    // 에디터 옵션 설정
    editor.updateOptions({
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      formatOnPaste: true,
      formatOnType: true,
      tabSize: 2,
      insertSpaces: true
    });

    // 포맷팅 단축키 설정
    editor.addAction({
      id: 'format-json',
      label: 'Format JSON',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
      run: () => {
        editor.getAction('editor.action.formatDocument').run();
      }
    });
  };

  const handleEditorChange = (newValue: string | undefined) => {
    if (newValue !== undefined) {
      onChange(newValue);
    }
  };

  // 값이 변경될 때 포맷팅
  useEffect(() => {
    if (editorRef.current && value) {
      try {
        const parsed = JSON.parse(value);
        const formatted = JSON.stringify(parsed, null, 2);
        if (formatted !== value) {
          editorRef.current.setValue(formatted);
        }
      } catch (error) {
        // JSON이 유효하지 않으면 포맷팅하지 않음
      }
    }
  }, []);

  const editorTheme = theme.palette.mode === 'dark' ? 'vs-dark' : 'vs';

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" gutterBottom>
          {label}
        </Typography>
      )}
      
      <Box
        sx={{
          border: error ? '1px solid' : '1px solid',
          borderColor: error ? 'error.main' : 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          '& .monaco-editor': {
            '& .margin': {
              backgroundColor: 'transparent'
            }
          }
        }}
      >
        <Editor
          height={height}
          defaultLanguage="json"
          value={value || placeholder}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme={editorTheme}
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
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
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            }
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Ctrl+F를 눌러 JSON을 포맷팅할 수 있습니다.
      </Typography>
    </Box>
  );
};

export default JsonEditor;
