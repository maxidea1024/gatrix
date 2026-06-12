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
      {/* Diamond (filled) → eye cutout → iris (filled) → pupil cutout
          Using evenodd: alternating fill/hole for each nested shape */}
      <path
        d={[
          // Outer diamond
          'M12 1.5 L22.5 12 L12 22.5 L1.5 12 Z',
          // Eye cutout (hole in diamond)
          'M6 12 Q9 8, 12 8 Q15 8, 18 12 Q15 16, 12 16 Q9 16, 6 12 Z',
          // Iris ring (filled again inside eye hole) — circle approximation
          'M12 9.4 A2.6 2.6 0 1 1 12 14.6 A2.6 2.6 0 1 1 12 9.4 Z',
          // Pupil hole (cutout inside iris)
          'M12 11 A1 1 0 1 1 12 13 A1 1 0 1 1 12 11 Z',
        ].join(' ')}
        fill="currentColor"
        fillRule="evenodd"
      />
    </SvgIcon>
  );
};

export default ArgusIcon;
