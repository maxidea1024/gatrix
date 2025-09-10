import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

const BaiduIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M7.5 8.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"
      />
      <path
        fill="currentColor"
        d="M16.5 8.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"
      />
      <path
        fill="currentColor"
        d="M4.5 12.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"
      />
      <path
        fill="currentColor"
        d="M19.5 12.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"
      />
      <path
        fill="currentColor"
        d="M12 6c1.4 0 2.5-1.1 2.5-2.5S13.4 1 12 1s-2.5 1.1-2.5 2.5S10.6 6 12 6z"
      />
      <path
        fill="currentColor"
        d="M12 23c4.4 0 8-2.7 8-6 0-2.2-1.8-4-4-4H8c-2.2 0-4 1.8-4 4 0 3.3 3.6 6 8 6z"
      />
    </SvgIcon>
  );
};

export default BaiduIcon;
