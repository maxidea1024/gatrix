import React from 'react';
import { Box, SvgIcon } from '@mui/material';

/* ─── Browser SVG Icons ─── */

const ChromeIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="22" fill="#fff" />
    <path
      d="M24 13.5a10.5 10.5 0 0 1 9.09 5.25H13.54A10.49 10.49 0 0 1 24 13.5z"
      fill="#DB4437"
    />
    <path
      d="M33.09 18.75l-5.25 9.09a10.5 10.5 0 0 1-9.08-5.25l5.25-9.09a10.49 10.49 0 0 1 9.08 5.25z"
      fill="none"
    />
    <path
      d="M24 2C12.95 2 4 10.95 4 22h13.54a10.49 10.49 0 0 1 15.55-3.25L24 2z"
      fill="#DB4437"
    />
    <path
      d="M4 22a22 22 0 0 0 8.45 17.33l9.31-16.13A10.49 10.49 0 0 1 13.54 22H4z"
      fill="#0F9D58"
    />
    <path
      d="M12.45 39.33A22 22 0 0 0 46 22H33.09a10.49 10.49 0 0 1-11.33 9.2l-9.31 16.13z"
      fill="#FFCD40"
    />
    <circle cx="24" cy="22" r="7" fill="#4285F4" />
    <circle cx="24" cy="22" r="6" fill="#fff" />
    <circle cx="24" cy="22" r="5.5" fill="#4285F4" />
  </svg>
);

const FirefoxIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 77.42 79.97">
    <defs>
      <linearGradient
        id="ff-a"
        x1="70.79"
        y1="12.39"
        x2="6.28"
        y2="74.47"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0.048" stopColor="#fff44f" />
        <stop offset="0.111" stopColor="#ffe847" />
        <stop offset="0.225" stopColor="#ffc830" />
        <stop offset="0.368" stopColor="#ff980e" />
        <stop offset="0.401" stopColor="#ff8b16" />
        <stop offset="0.462" stopColor="#ff672a" />
        <stop offset="0.534" stopColor="#ff3647" />
        <stop offset="0.705" stopColor="#e31587" />
      </linearGradient>
      <linearGradient
        id="ff-b"
        x1="70.79"
        y1="12.39"
        x2="6.28"
        y2="74.47"
        gradientUnits="userSpaceOnUse"
      >
        <stop offset="0.167" stopColor="#ffbd4f" />
        <stop offset="0.266" stopColor="#ffac31" />
        <stop offset="0.427" stopColor="#ff8e12" />
        <stop offset="0.526" stopColor="#ff980e" />
      </linearGradient>
    </defs>
    <path
      d="M74.62 26.83c-1.68-4.05-5.1-9.07-7.55-10.6a39.38 39.38 0 0 1 3.77 14.34v.1c-4.43-11.09-11.94-15.56-18.07-25.28-.31-.5-.62-1-.92-1.54a7.16 7.16 0 0 1-.31-.65 4.14 4.14 0 0 1-.32-1 .05.05 0 0 0-.05 0 .07.07 0 0 0-.05.05c-5.22 3.06-6.98 8.72-7.14 11.56a16.48 16.48 0 0 0-9.07 3.06 9.84 9.84 0 0 0-.85-.65 15.33 15.33 0 0 1-.08-8.07A23.43 23.43 0 0 0 25.88 16c-2.68 1.47-4.88 3.48-6.67 5.13h-.12c-1.12-1.42-1.04-6.1-.97-7.09a8.8 8.8 0 0 0-1.77 1.6 24.7 24.7 0 0 0-3.63 5.8A33.22 33.22 0 0 0 10 28.58l-.06.42A43.75 43.75 0 0 0 9.5 33a38.7 38.7 0 1 0 65.12-6.16z"
      fill="url(#ff-a)"
    />
    <path
      d="M74.62 26.83c-1.68-4.05-5.1-9.07-7.55-10.6a39.38 39.38 0 0 1 3.77 14.34v.1a36.36 36.36 0 0 1-1.3 27.53c-5.8 12.01-20.1 18.31-33.58 17.6A38.7 38.7 0 0 1 .9 40.7c-.68-6.13.85-14.53 4.38-20.2a15.33 15.33 0 0 1-.08-8.07A23.43 23.43 0 0 0 25.88 16c-2.68 1.47-4.88 3.48-6.67 5.13h-.12c-1.12-1.42-1.04-6.1-.97-7.09a8.8 8.8 0 0 0-1.77 1.6 24.7 24.7 0 0 0-3.63 5.8A33.22 33.22 0 0 0 10 28.58l-.06.42a46.91 46.91 0 0 0-.45 4.58 38.7 38.7 0 1 0 65.12-6.76z"
      fill="url(#ff-b)"
      opacity="0.64"
    />
  </svg>
);

const SafariIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="22" fill="#1BADF8" />
    <circle
      cx="24"
      cy="24"
      r="19"
      fill="none"
      stroke="#fff"
      strokeWidth="0.8"
    />
    <polygon points="24,8 28,28 24,40 20,28" fill="#fff" opacity="0.9" />
    <polygon points="24,8 28,28 24,24" fill="#D32F2F" />
    <circle cx="24" cy="24" r="2" fill="#fff" />
  </svg>
);

const EdgeIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 256 256">
    <defs>
      <linearGradient id="edge-a" x1="63%" y1="0%" x2="63%" y2="100%">
        <stop offset="0" stopColor="#0C59A4" />
        <stop offset="1" stopColor="#114A8B" />
      </linearGradient>
      <linearGradient id="edge-b" x1="30%" y1="0%" x2="70%" y2="100%">
        <stop offset="0" stopColor="#1B9DE2" />
        <stop offset="0.16" stopColor="#1595DF" />
        <stop offset="0.67" stopColor="#0680D7" />
        <stop offset="1" stopColor="#0078D4" />
      </linearGradient>
    </defs>
    <path
      d="M235 180c-4 16-15 30-30 39a87 87 0 0 1-47 14c-47 0-87-38-87-85 0-21 9-41 24-55a98 98 0 0 1 73-30c45 0 82 30 87 71H130c-1-12-11-22-24-22-15 0-27 13-27 29s12 29 27 29h129z"
      fill="url(#edge-b)"
    />
    <path
      d="M24 93c0-49 42-89 93-93a97 97 0 0 0-74 36C28 55 18 79 18 105c0 50 42 90 94 90a96 96 0 0 1-62-24C31 152 24 123 24 93z"
      fill="url(#edge-a)"
    />
  </svg>
);

const WhaleIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="22" fill="#04C38E" />
    <path
      d="M14 30c0-8 4.5-16 10-16s10 8 10 16"
      stroke="#fff"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M18 28c0-5 2.7-10 6-10s6 5 6 10"
      stroke="#fff"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    <circle cx="24" cy="30" r="3" fill="#fff" />
  </svg>
);

const OperaIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="22" fill="#FF1B2D" />
    <ellipse
      cx="24"
      cy="24"
      rx="10"
      ry="15"
      fill="none"
      stroke="#fff"
      strokeWidth="3"
    />
  </svg>
);

const SamsungIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle cx="24" cy="24" r="22" fill="#1428A0" />
    <text
      x="24"
      y="29"
      textAnchor="middle"
      fill="#fff"
      fontSize="14"
      fontWeight="bold"
      fontFamily="Arial"
    >
      S
    </text>
  </svg>
);

/* ─── OS SVG Icons ─── */

const WindowsIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path d="M6 23.5V12.4L22 10v13.5z" fill="#00ADEF" />
    <path d="M24 9.7L42 7v16.5H24z" fill="#00ADEF" />
    <path d="M24 25.5H42V42l-18-2.3z" fill="#00ADEF" />
    <path d="M6 25.5h16V36l-16 2z" fill="#00ADEF" />
  </svg>
);

const MacOsIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      d="M34.8 24.6c-.06-5.4 4.44-8.06 4.64-8.2a9.55 9.55 0 0 0-7.52-4.06c-3.14-.34-6.22 1.9-7.82 1.9-1.64 0-4.08-1.88-6.74-1.82a10 10 0 0 0-8.36 5.12c-3.62 6.26-.92 15.46 2.54 20.54 1.74 2.5 3.76 5.28 6.42 5.18 2.6-.1 3.56-1.66 6.7-1.66 3.1 0 4 1.66 6.68 1.6 2.78-.04 4.52-2.5 6.22-5.02a21.4 21.4 0 0 0 2.84-5.8 9.14 9.14 0 0 1-5.6-8.28z"
      fill="#555"
    />
    <path
      d="M30.06 9.52a9.15 9.15 0 0 0 2.12-6.62 9.38 9.38 0 0 0-6.08 3.14 8.72 8.72 0 0 0-2.18 6.36 7.74 7.74 0 0 0 6.14-2.88z"
      fill="#555"
    />
  </svg>
);

const LinuxIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      d="M24 4c-5.5 0-10 6-10 14 0 4 1 8 3 11l-4 8c-1 2 0 4 2 5h18c2-1 3-3 2-5l-4-8c2-3 3-7 3-11 0-8-4.5-14-10-14z"
      fill="#FFC107"
    />
    <circle cx="20" cy="16" r="2" fill="#333" />
    <circle cx="28" cy="16" r="2" fill="#333" />
    <path
      d="M20 22c0 2 1.8 4 4 4s4-2 4-4"
      fill="none"
      stroke="#333"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const AndroidIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      d="M6 18c-2 0-3 1-3 3v10c0 2 1 3 3 3s3-1 3-3V21c0-2-1-3-3-3zm36 0c-2 0-3 1-3 3v10c0 2 1 3 3 3s3-1 3-3V21c0-2-1-3-3-3z"
      fill="#3DDC84"
    />
    <rect x="12" y="16" width="24" height="20" rx="2" fill="#3DDC84" />
    <rect x="16" y="36" width="4" height="8" rx="2" fill="#3DDC84" />
    <rect x="28" y="36" width="4" height="8" rx="2" fill="#3DDC84" />
    <path d="M12 16v2a12 12 0 0 1 24 0v-2a12 12 0 0 0-24 0z" fill="#3DDC84" />
    <path
      d="M30 6l2-3M18 6l-2-3"
      stroke="#3DDC84"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="19" cy="11" r="1.5" fill="#fff" />
    <circle cx="29" cy="11" r="1.5" fill="#fff" />
  </svg>
);

const IosIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      d="M34.8 24.6c-.06-5.4 4.44-8.06 4.64-8.2a9.55 9.55 0 0 0-7.52-4.06c-3.14-.34-6.22 1.9-7.82 1.9-1.64 0-4.08-1.88-6.74-1.82a10 10 0 0 0-8.36 5.12c-3.62 6.26-.92 15.46 2.54 20.54 1.74 2.5 3.76 5.28 6.42 5.18 2.6-.1 3.56-1.66 6.7-1.66 3.1 0 4 1.66 6.68 1.6 2.78-.04 4.52-2.5 6.22-5.02a21.4 21.4 0 0 0 2.84-5.8 9.14 9.14 0 0 1-5.6-8.28z"
      fill="#555"
    />
    <path
      d="M30.06 9.52a9.15 9.15 0 0 0 2.12-6.62 9.38 9.38 0 0 0-6.08 3.14 8.72 8.72 0 0 0-2.18 6.36 7.74 7.74 0 0 0 6.14-2.88z"
      fill="#555"
    />
  </svg>
);

/* ─── Default fallback icons ─── */

const DefaultBrowserIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <circle
      cx="24"
      cy="24"
      r="20"
      fill="none"
      stroke="#9e9e9e"
      strokeWidth="2"
    />
    <circle
      cx="24"
      cy="24"
      r="8"
      fill="none"
      stroke="#9e9e9e"
      strokeWidth="2"
    />
    <line x1="4" y1="24" x2="44" y2="24" stroke="#9e9e9e" strokeWidth="2" />
    <line x1="24" y1="4" x2="24" y2="44" stroke="#9e9e9e" strokeWidth="2" />
  </svg>
);

const DefaultOsIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <rect
      x="6"
      y="8"
      width="36"
      height="24"
      rx="2"
      fill="none"
      stroke="#9e9e9e"
      strokeWidth="2"
    />
    <line x1="18" y1="36" x2="30" y2="36" stroke="#9e9e9e" strokeWidth="2" />
    <line x1="24" y1="32" x2="24" y2="36" stroke="#9e9e9e" strokeWidth="2" />
  </svg>
);

/* ─── Lookup Functions ─── */

/**
 * Get the branded browser icon by browser name.
 * Matches common browser names case-insensitively.
 */
export function getBrowserIcon(
  browserName: string,
  size: number = 24
): React.ReactNode {
  const name = (browserName || '').toLowerCase().trim();

  if (name.includes('chrome') && !name.includes('headless'))
    return <ChromeIcon size={size} />;
  if (name.includes('firefox') || name.includes('gecko'))
    return <FirefoxIcon size={size} />;
  if (name.includes('safari') && !name.includes('chrome'))
    return <SafariIcon size={size} />;
  if (name.includes('edge') || name.includes('edg/'))
    return <EdgeIcon size={size} />;
  if (name.includes('whale')) return <WhaleIcon size={size} />;
  if (name.includes('opera') || name.includes('opr/'))
    return <OperaIcon size={size} />;
  if (name.includes('samsung')) return <SamsungIcon size={size} />;

  return <DefaultBrowserIcon size={size} />;
}

/**
 * Get the branded OS icon by OS name.
 * Matches common OS names case-insensitively.
 */
export function getOsIcon(osName: string, size: number = 24): React.ReactNode {
  const name = (osName || '').toLowerCase().trim();

  if (name.includes('windows')) return <WindowsIcon size={size} />;
  if (name.includes('mac') || name.includes('osx') || name.includes('macos'))
    return <MacOsIcon size={size} />;
  if (name.includes('ios') || name.includes('iphone') || name.includes('ipad'))
    return <IosIcon size={size} />;
  if (name.includes('android')) return <AndroidIcon size={size} />;
  if (
    name.includes('linux') ||
    name.includes('ubuntu') ||
    name.includes('debian') ||
    name.includes('fedora') ||
    name.includes('centos')
  )
    return <LinuxIcon size={size} />;

  return <DefaultOsIcon size={size} />;
}

/**
 * Get an icon for a device name.
 */
export function getDeviceIcon(
  deviceName: string,
  size: number = 24
): React.ReactNode {
  const name = (deviceName || '').toLowerCase();

  // For now, leverage OS icons for common device patterns
  if (name.includes('iphone') || name.includes('ipad'))
    return <IosIcon size={size} />;
  if (
    name.includes('samsung') ||
    name.includes('galaxy') ||
    name.includes('pixel')
  )
    return <AndroidIcon size={size} />;
  if (name.includes('mac')) return <MacOsIcon size={size} />;

  return <DefaultOsIcon size={size} />;
}
