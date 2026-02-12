import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

/**
 * Active status icon - filled green circle with checkmark
 */
const ActiveIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="9" fill="#16a34a" />
    <path
      d="M6 10.5L8.5 13L14 7.5"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </SvgIcon>
);

/**
 * Archived status icon - grey box with down arrow
 */
const ArchivedIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 20 20">
    <rect x="2" y="3" width="16" height="4" rx="1.5" fill="#9ca3af" />
    <path
      d="M3.5 7v8a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5V7"
      fill="#d1d5db"
      stroke="#9ca3af"
      strokeWidth="0.5"
    />
    <path
      d="M10 9.5v4M8 11.5l2 2 2-2"
      stroke="#6b7280"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </SvgIcon>
);

/**
 * Stale status icon - red triangle with exclamation mark
 */
const StaleStatusIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 20 20">
    <path d="M10 2L18.66 17H1.34L10 2z" fill="#ef4444" stroke="#dc2626" strokeWidth="0.5" />
    <rect x="9" y="7" width="2" height="5" rx="1" fill="white" />
    <circle cx="10" cy="14.5" r="1.2" fill="white" />
  </SvgIcon>
);

/**
 * Potentially Stale status icon - amber diamond with clock
 */
const PotentiallyStaleIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 20 20">
    <path
      d="M10 1.5L18.5 10L10 18.5L1.5 10L10 1.5z"
      fill="#f59e0b"
      stroke="#d97706"
      strokeWidth="0.5"
    />
    <circle cx="10" cy="10" r="4" fill="none" stroke="white" strokeWidth="1.5" />
    <path
      d="M10 8v2.5l1.5 1"
      stroke="white"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </SvgIcon>
);

export type FlagStatus = 'active' | 'archived' | 'stale' | 'potentiallyStale';

interface FlagStatusIconProps {
  status: FlagStatus | string;
  size?: number;
}

/**
 * Returns a custom SVG icon for the given flag status.
 */
const FlagStatusIcon: React.FC<FlagStatusIconProps> = ({ status, size = 16 }) => {
  const iconProps: SvgIconProps = { sx: { fontSize: size } };
  switch (status) {
    case 'active':
      return <ActiveIcon {...iconProps} />;
    case 'archived':
      return <ArchivedIcon {...iconProps} />;
    case 'stale':
      return <StaleStatusIcon {...iconProps} />;
    case 'potentiallyStale':
      return <PotentiallyStaleIcon {...iconProps} />;
    default:
      return null;
  }
};

export default FlagStatusIcon;
