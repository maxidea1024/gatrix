import React from 'react';
import { Box, Typography } from '@mui/material';
import { type WidgetConfig, type VizOptions } from './widgetTypes';

interface TextRendererProps {
  widget: WidgetConfig;
  isDark: boolean;
  vizOptions?: VizOptions;
}

/**
 * Text / Markdown widget renderer.
 * Shows the widget description or viz_options.markdown_content.
 */
const TextRenderer: React.FC<TextRendererProps> = ({
  widget,
  isDark,
  vizOptions,
}) => {
  const content =
    vizOptions?.markdown_content || widget.description || widget.title || '';
  const fontSize = vizOptions?.font_size ?? 14;

  if (!content) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          color: 'text.disabled',
        }}
      >
        <Typography sx={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
          Empty text widget
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        p: 1.5,
      }}
    >
      <Typography
        sx={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.6,
          color: 'text.primary',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          // Basic markdown-like formatting via CSS
          '& strong, & b': { fontWeight: 700 },
          '& em, & i': { fontStyle: 'italic' },
        }}
        dangerouslySetInnerHTML={{
          __html: simpleMarkdown(content),
        }}
      />
    </Box>
  );
};

/**
 * Very lightweight markdown-to-HTML converter for widget text.
 * Handles: **bold**, *italic*, `code`, links, headers, line breaks.
 */
function simpleMarkdown(text: string): string {
  return text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<strong style="font-size:1.1em">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="font-size:1.2em">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="font-size:1.4em">$1</strong>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`(.+?)`/g, '<code style="background:rgba(124,77,255,0.08);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
    // Links
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noopener" style="color:#7c4dff">$1</a>'
    )
    // Line breaks
    .replace(/\n/g, '<br />');
}

export default TextRenderer;
