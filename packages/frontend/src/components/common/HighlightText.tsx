import React from 'react';
import { useTheme } from '@mui/material';

interface HighlightTextProps {
  /** The full text to display */
  text: string;
  /** The substring to highlight */
  highlight: string;
  /** Override dark mode detection (defaults to theme) */
  isDark?: boolean;
}

/**
 * Renders text with matching substrings highlighted.
 * Used across Argus issue lists, feedback lists, etc.
 */
const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  highlight,
  isDark: isDarkProp,
}) => {
  const theme = useTheme();
  const isDark = isDarkProp ?? theme.palette.mode === 'dark';

  if (!highlight.trim()) return <>{text}</>;

  // Escape regex special characters in the highlight term
  const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <span
            key={i}
            style={{
              backgroundColor: isDark
                ? 'rgba(255, 235, 59, 0.2)'
                : 'rgba(255, 235, 59, 0.4)',
              color: isDark ? '#ffd54f' : '#f57f17',
              borderRadius: '2px',
              padding: '0 2px',
            }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

export default React.memo(HighlightText);
