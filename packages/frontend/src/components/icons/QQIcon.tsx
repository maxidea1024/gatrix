import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

const QQIcon: React.FC<SvgIconProps> = (props) => {
  return (
    <SvgIcon {...props} viewBox="0 0 24 24">
      {/* QQ 펭귄 아이콘 */}
      <path
        fill="currentColor"
        d="M12 2c-3.5 0-6.5 2.8-6.5 6.2 0 1.5.5 2.9 1.3 4.1-.8 1.2-1.3 2.6-1.3 4.1 0 1.8 1.5 3.3 3.3 3.3.5 0 1-.1 1.4-.3.7 1.2 2 2 3.5 2s2.8-.8 3.5-2c.4.2.9.3 1.4.3 1.8 0 3.3-1.5 3.3-3.3 0-1.5-.5-2.9-1.3-4.1.8-1.2 1.3-2.6 1.3-4.1C18.5 4.8 15.5 2 12 2z"
      />
      {/* 펭귄 눈 */}
      <ellipse cx="9.5" cy="8.5" rx="1.2" ry="1.5" fill="white" />
      <ellipse cx="14.5" cy="8.5" rx="1.2" ry="1.5" fill="white" />
      <circle cx="9.5" cy="8.8" r="0.6" fill="black" />
      <circle cx="14.5" cy="8.8" r="0.6" fill="black" />
      {/* 펭귄 부리 */}
      <path
        fill="#FFA500"
        d="M12 10.5c-.5 0-.8.3-.8.7 0 .2.1.4.3.5l.5.3.5-.3c.2-.1.3-.3.3-.5 0-.4-.3-.7-.8-.7z"
      />
      {/* 펭귄 배 */}
      <ellipse cx="12" cy="14" rx="2.5" ry="3" fill="white" />
      {/* 펭귄 발 */}
      <ellipse cx="10" cy="18.5" rx="1" ry="0.8" fill="#FFA500" />
      <ellipse cx="14" cy="18.5" rx="1" ry="0.8" fill="#FFA500" />
    </SvgIcon>
  );
};

export default QQIcon;
