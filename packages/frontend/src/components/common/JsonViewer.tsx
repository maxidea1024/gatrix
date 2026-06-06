import React from 'react';
import { Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/common/CopyButton';

export interface JsonViewerProps {
  data: Record<string, unknown>;
  isDark: boolean;
  maxHeight?: number;
}

/**
 * Syntax-highlighted JSON viewer with copy support.
 * Reusable across issue detail, feedback detail, etc.
 */
const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  isDark,
  maxHeight = 350,
}) => {
  const jsonString = JSON.stringify(data, null, 2);

  const colors = isDark
    ? {
        key: '#9cdcfe',
        str: '#ce9178',
        num: '#b5cea8',
        bool: '#569cd6',
        null: '#569cd6',
      }
    : {
        key: '#a31515',
        str: '#0451a5',
        num: '#098658',
        bool: '#0000ff',
        null: '#0000ff',
      };

  const html = jsonString.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let color = colors.num;
      if (/^"/.test(match)) {
        color = /:$/.test(match) ? colors.key : colors.str;
      } else if (/true|false/.test(match)) color = colors.bool;
      else if (/null/.test(match)) color = colors.null;
      return `<span style="color: ${color}">${match}</span>`;
    }
  );

  return (
    <Box sx={{ position: 'relative' }}>
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
        <CopyButton text={jsonString} />
      </Box>
      <Box
        component="pre"
        sx={{
          margin: 0,
          fontSize: '0.8rem',
          lineHeight: 1.5,
          backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)',
          borderRadius: 1.5,
          p: 2,
          maxHeight,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: isDark ? '#e2e8f0' : '#334155',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}`,
          '&::-webkit-scrollbar': { width: '6px', height: '6px' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.2)'
              : 'rgba(0,0,0,0.2)',
            borderRadius: '3px',
          },
        }}
      >
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </Box>
    </Box>
  );
};

export default JsonViewer;
