/**
 * OperatorIcon - Custom SVG icons for constraint operators
 * Each operator has a distinct visual representation with strong colors
 * for quick recognition. Familiar shapes inspired by IDE editors.
 */
import React from 'react';
import { Box, SxProps, Theme, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface OperatorIconProps {
  operator: string;
  inverted?: boolean;
  size?: number;
  showTooltip?: boolean;
  sx?: SxProps<Theme>;
}

interface OpStyle {
  bg: string;
  fg: string;
  label: string; // Short label shown inside the icon
}

// Operator visual styles — short label + colors
const operatorStyles: Record<string, OpStyle> = {
  // String operators — blue family
  str_eq: { bg: '#dbeafe', fg: '#1e40af', label: '=' },
  str_contains: { bg: '#dbeafe', fg: '#1e40af', label: '⊃' },
  str_starts_with: { bg: '#dbeafe', fg: '#1e40af', label: 'A…' },
  str_ends_with: { bg: '#dbeafe', fg: '#1e40af', label: '…Z' },
  str_in: { bg: '#dbeafe', fg: '#1e40af', label: '∈' },
  str_regex: { bg: '#dbeafe', fg: '#1e40af', label: '.*' },

  // Number operators — green family
  num_eq: { bg: '#d1fae5', fg: '#166534', label: '=' },
  num_gt: { bg: '#d1fae5', fg: '#166534', label: '>' },
  num_gte: { bg: '#d1fae5', fg: '#166534', label: '≥' },
  num_lt: { bg: '#d1fae5', fg: '#166534', label: '<' },
  num_lte: { bg: '#d1fae5', fg: '#166534', label: '≤' },
  num_in: { bg: '#d1fae5', fg: '#166534', label: '∈' },

  // Boolean operators — orange family
  bool_is: { bg: '#ffedd5', fg: '#c2410c', label: '=' },

  // Date operators — purple family
  date_eq: { bg: '#f3e8ff', fg: '#7e22ce', label: '=' },
  date_gt: { bg: '#f3e8ff', fg: '#7e22ce', label: '>' },
  date_gte: { bg: '#f3e8ff', fg: '#7e22ce', label: '≥' },
  date_lt: { bg: '#f3e8ff', fg: '#7e22ce', label: '<' },
  date_lte: { bg: '#f3e8ff', fg: '#7e22ce', label: '≤' },

  // Semver operators — indigo family
  semver_eq: { bg: '#e0e7ff', fg: '#3730a3', label: '=' },
  semver_gt: { bg: '#e0e7ff', fg: '#3730a3', label: '>' },
  semver_gte: { bg: '#e0e7ff', fg: '#3730a3', label: '≥' },
  semver_lt: { bg: '#e0e7ff', fg: '#3730a3', label: '<' },
  semver_lte: { bg: '#e0e7ff', fg: '#3730a3', label: '≤' },
  semver_in: { bg: '#e0e7ff', fg: '#3730a3', label: '∈' },

  // Existence operators — gray family
  exists: { bg: '#e5e7eb', fg: '#374151', label: '∃' },
  not_exists: { bg: '#fde8e8', fg: '#991b1b', label: '∄' },

  // Array operators — teal family
  arr_any: { bg: '#ccfbf1', fg: '#115e59', label: '⊃' },
  arr_all: { bg: '#ccfbf1', fg: '#115e59', label: '⊇' },
  arr_empty: { bg: '#ccfbf1', fg: '#115e59', label: '∅' },
};

// Inverted operator overrides
const invertedStyles: Record<string, Partial<OpStyle>> = {
  str_eq: { label: '≠', bg: '#fde8e8', fg: '#991b1b' },
  str_in: { label: '∉', bg: '#fde8e8', fg: '#991b1b' },
  num_eq: { label: '≠', bg: '#fde8e8', fg: '#991b1b' },
  num_in: { label: '∉', bg: '#fde8e8', fg: '#991b1b' },
  semver_eq: { label: '≠', bg: '#fde8e8', fg: '#991b1b' },
  semver_in: { label: '∉', bg: '#fde8e8', fg: '#991b1b' },
  arr_any: { label: '⊅', bg: '#fde8e8', fg: '#991b1b' },
  exists: { label: '∄', bg: '#fde8e8', fg: '#991b1b' },
  not_exists: { label: '∃', bg: '#e5e7eb', fg: '#374151' },
};

const defaultStyle: OpStyle = { bg: '#f5f5f5', fg: '#757575', label: '?' };

const OperatorIcon: React.FC<OperatorIconProps> = ({
  operator,
  inverted,
  size = 20,
  showTooltip = true,
  sx,
}) => {
  const { t } = useTranslation();

  // Get the style
  let style = operatorStyles[operator] || defaultStyle;
  if (inverted && invertedStyles[operator]) {
    style = { ...style, ...invertedStyles[operator] };
  }

  // Tooltip: localized operator description + example
  const descText = showTooltip ? t(`constraints.operatorDesc.${operator}`, operator) : '';
  const exampleText = showTooltip ? t(`constraints.operatorExample.${operator}`, '') : '';

  // Calculate font size relative to icon size — keep symbols large and readable
  const labelLen = style.label.length;
  let fontSize: number;
  if (labelLen <= 1) {
    fontSize = size * 0.75;
  } else if (labelLen <= 2) {
    fontSize = size * 0.62;
  } else {
    fontSize = size * 0.5;
  }

  const icon = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        ...sx,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1" y="1" width="22" height="22" rx="5" fill={style.bg} />
        <text
          x="12"
          y="12"
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="'Inter','Segoe UI',sans-serif"
          fontSize={fontSize}
          fontWeight={900}
          fill={style.fg}
        >
          {style.label}
        </text>
      </svg>
    </Box>
  );

  if (showTooltip && descText) {
    const tooltipContent = (
      <Box sx={{ maxWidth: 340 }}>
        <Box sx={{ fontWeight: 500, fontSize: '0.8rem', mb: exampleText ? 0.75 : 0 }}>
          {descText}
        </Box>
        {exampleText && (
          <Box
            sx={{
              bgcolor: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '4px',
              px: 1,
              py: 0.6,
              fontSize: '0.75rem',
              fontWeight: 500,
              fontFamily: "'Consolas','Monaco','Courier New',monospace",
              lineHeight: 1.5,
              opacity: 0.9,
            }}
          >
            {exampleText}
          </Box>
        )}
      </Box>
    );
    return (
      <Tooltip title={tooltipContent} arrow placement="top">
        {icon}
      </Tooltip>
    );
  }

  return icon;
};

export default OperatorIcon;
