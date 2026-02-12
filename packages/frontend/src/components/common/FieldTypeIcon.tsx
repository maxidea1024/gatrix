/**
 * FieldTypeIcon - Custom SVG icons for context field types and value types
 * Each type has a distinct shape and strong color for quick recognition
 */
import React from 'react';
import { Box, SxProps, Theme } from '@mui/material';

interface FieldTypeIconProps {
  type: string;
  size?: number;
  sx?: SxProps<Theme>;
}

interface TypeStyle {
  bg: string;
  fg: string;
  render: (fg: string) => React.ReactNode;
}

const typeStyles: Record<string, TypeStyle> = {
  // "Aa" text icon for string
  string: {
    bg: '#dbeafe',
    fg: '#1e40af',
    render: (fg) => (
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontFamily="'Inter','Segoe UI',sans-serif"
        fontSize="12"
        fontWeight="900"
        fill={fg}
      >
        Aa
      </text>
    ),
  },
  // "#" hash icon for number
  number: {
    bg: '#d1fae5',
    fg: '#166534',
    render: (fg) => (
      <text
        x="12"
        y="17.5"
        textAnchor="middle"
        fontFamily="'Inter','Segoe UI',sans-serif"
        fontSize="15"
        fontWeight="900"
        fill={fg}
      >
        #
      </text>
    ),
  },
  // Toggle switch icon for boolean
  boolean: {
    bg: '#ffedd5',
    fg: '#c2410c',
    render: (fg) => (
      <>
        <rect
          x="4.5"
          y="7.5"
          width="15"
          height="9"
          rx="4.5"
          fill={fg}
          opacity={0.25}
          stroke={fg}
          strokeWidth="1.6"
        />
        <circle cx="15" cy="12" r="3.2" fill={fg} />
      </>
    ),
  },
  // Calendar icon for date/datetime
  date: {
    bg: '#f3e8ff',
    fg: '#7e22ce',
    render: (fg) => (
      <>
        <rect
          x="5"
          y="6"
          width="14"
          height="13"
          rx="2.5"
          fill="none"
          stroke={fg}
          strokeWidth="1.8"
        />
        <rect x="5" y="6" width="14" height="4.5" rx="2.5" fill={fg} opacity={0.3} />
        <line x1="5" y1="10.5" x2="19" y2="10.5" stroke={fg} strokeWidth="1.4" />
        <line x1="9" y1="4" x2="9" y2="7" stroke={fg} strokeWidth="2" strokeLinecap="round" />
        <line x1="15" y1="4" x2="15" y2="7" stroke={fg} strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="14.8" r="1.5" fill={fg} />
      </>
    ),
  },
  // Version badge with "v1" text for semver
  semver: {
    bg: '#e0e7ff',
    fg: '#3730a3',
    render: (fg) => (
      <>
        <rect
          x="3.5"
          y="6.5"
          width="17"
          height="11"
          rx="3.5"
          fill={fg}
          opacity={0.2}
          stroke={fg}
          strokeWidth="1.6"
        />
        <text
          x="12"
          y="15.5"
          textAnchor="middle"
          fontFamily="'Inter','Segoe UI',sans-serif"
          fontSize="9.5"
          fontWeight="900"
          fill={fg}
        >
          v1
        </text>
      </>
    ),
  },
  // Array brackets icon with dots
  array: {
    bg: '#ccfbf1',
    fg: '#115e59',
    render: (fg) => (
      <>
        <text
          x="5.5"
          y="17"
          textAnchor="middle"
          fontFamily="'Courier New',monospace"
          fontSize="16"
          fontWeight="900"
          fill={fg}
        >
          [
        </text>
        <circle cx="10.5" cy="12" r="1.5" fill={fg} />
        <circle cx="14.5" cy="12" r="1.5" fill={fg} />
        <text
          x="19.5"
          y="17"
          textAnchor="middle"
          fontFamily="'Courier New',monospace"
          fontSize="16"
          fontWeight="900"
          fill={fg}
        >
          ]
        </text>
      </>
    ),
  },
  // Flag icon for country
  country: {
    bg: '#dcfce7',
    fg: '#166534',
    render: (fg) => (
      <>
        {/* Flag pole */}
        <line x1="7" y1="4.5" x2="7" y2="19.5" stroke={fg} strokeWidth="2" strokeLinecap="round" />
        {/* Flag body */}
        <path
          d="M7,5 L18,7 L17,11.5 L7,13 Z"
          fill={fg}
          opacity={0.3}
          stroke={fg}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </>
    ),
  },
  // JSON object braces for json value type
  json: {
    bg: '#fce7f3',
    fg: '#be123c',
    render: (fg) => (
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontFamily="'Courier New',monospace"
        fontSize="14"
        fontWeight="900"
        fill={fg}
      >
        {'{ }'}
      </text>
    ),
  },
};

// Alias datetime → date
typeStyles.datetime = typeStyles.date;

const defaultStyle: TypeStyle = {
  bg: '#f5f5f5',
  fg: '#757575',
  render: typeStyles.string.render,
};

const FieldTypeIcon: React.FC<FieldTypeIconProps> = ({ type, size = 20, sx }) => {
  const style = typeStyles[type] || defaultStyle;

  return (
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
        {style.render(style.fg)}
      </svg>
    </Box>
  );
};

export default FieldTypeIcon;
