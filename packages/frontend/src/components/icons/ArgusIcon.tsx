import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

/**
 * Custom Argus icon — inspired by Argus Panoptes, the all-seeing guardian.
 *
 * Design: A bold, geometric vigilant eye set within a diamond/rhombus frame.
 * The diamond suggests a gem/focus point while the eye conveys monitoring
 * and deep observability.  Clean strokes optimised for 16–48 px rendering.
 */
const ArgusIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* Diamond frame — rotated square */}
      <path
        d="M12 1.5 L22.5 12 L12 22.5 L1.5 12 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Eye shape — two mirrored arcs */}
      <path
        d="M6 12 Q9 8, 12 8 Q15 8, 18 12 Q15 16, 12 16 Q9 16, 6 12 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Iris */}
      <circle
        cx="12"
        cy="12"
        r="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />

      {/* Pupil */}
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </SvgIcon>
  );
};

export default ArgusIcon;
