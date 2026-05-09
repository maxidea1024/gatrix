import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

/**
 * Custom Ripple icon — concentric circles radiating from center,
 * like a stone dropped in water. Distinct from WiFi-style arcs.
 */
const RippleIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Center dot */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      {/* Inner ring */}
      <circle
        cx="12"
        cy="12"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        opacity="0.75"
      />
      {/* Outer ring */}
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
    </SvgIcon>
  );
};

export default RippleIcon;
