import React from 'react';
import { Box } from '@mui/material';
import { ClientStatus } from '../../types/clientVersion';

// Vibrant color palette
const statusColors: Record<ClientStatus, { main: string; bg: string }> = {
  [ClientStatus.ONLINE]: { main: '#16a34a', bg: '#dcfce7' },
  [ClientStatus.OFFLINE]: { main: '#dc2626', bg: '#fee2e2' },
  [ClientStatus.RECOMMENDED_UPDATE]: { main: '#d97706', bg: '#fef3c7' },
  [ClientStatus.FORCED_UPDATE]: { main: '#dc2626', bg: '#fee2e2' },
  [ClientStatus.UNDER_REVIEW]: { main: '#7c3aed', bg: '#ede9fe' },
  [ClientStatus.MAINTENANCE]: { main: '#ea580c', bg: '#ffedd5' },
  [ClientStatus.PATCH_UPDATE_REQUIRED]: { main: '#0284c7', bg: '#e0f2fe' },
};

const OnlineIcon = ({
  main,
  bg,
  size,
}: {
  main: string;
  bg: string;
  size: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill={bg} />
    <circle cx="10" cy="10" r="7" fill={main} />
    <path
      d="M7 10.5L9 12.5L13.5 7.5"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const OfflineIcon = ({
  main,
  bg,
  size,
}: {
  main: string;
  bg: string;
  size: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill={bg} />
    <circle cx="10" cy="10" r="7" fill={main} />
    <path
      d="M7.5 7.5L12.5 12.5M12.5 7.5L7.5 12.5"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const RecommendedUpdateIcon = ({
  main,
  bg,
  size,
}: {
  main: string;
  bg: string;
  size: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect width="20" height="20" rx="6" fill={bg} />
    <rect x="3" y="3" width="14" height="14" rx="3.5" fill={main} />
    <path
      d="M10 6.5V11.5M10 11.5L7.5 9.5M10 11.5L12.5 9.5"
      stroke="white"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 13.5H13"
      stroke="white"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const ForcedUpdateIcon = ({
  main,
  bg,
  size,
}: {
  main: string;
  bg: string;
  size: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M10 0L20 17.5H0L10 0Z" fill={bg} />
    <path d="M10 3.5L17 16H3L10 3.5Z" fill={main} />
    <path d="M10 8V12" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="10" cy="14" r="1" fill="white" />
  </svg>
);

const UnderReviewIcon = ({
  main,
  bg,
  size,
}: {
  main: string;
  bg: string;
  size: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <circle cx="10" cy="10" r="10" fill={bg} />
    <circle cx="10" cy="10" r="7" fill={main} />
    <circle
      cx="10"
      cy="9.5"
      r="3"
      stroke="white"
      strokeWidth="1.5"
      fill="none"
    />
    <circle cx="10" cy="9.5" r="1.2" fill="white" />
    <path
      d="M12.2 12L14.5 14.5"
      stroke="white"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const MaintenanceIcon = ({
  main,
  bg,
  size,
}: {
  main: string;
  bg: string;
  size: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect width="20" height="20" rx="6" fill={bg} />
    <rect x="3" y="3" width="14" height="14" rx="3.5" fill={main} />
    <path
      d="M10 6V10L12.5 12.5"
      stroke="white"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="10"
      cy="10"
      r="4.5"
      stroke="white"
      strokeWidth="1.2"
      fill="none"
      opacity="0.5"
    />
  </svg>
);

const PatchUpdateIcon = ({
  main,
  bg,
  size,
}: {
  main: string;
  bg: string;
  size: number;
}) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <rect width="20" height="20" rx="6" fill={bg} />
    <rect x="3" y="3" width="14" height="14" rx="3.5" fill={main} />
    <path
      d="M10 6V11M10 11L7.5 9M10 11L12.5 9"
      stroke="white"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M7 13H13" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    <circle
      cx="14.5"
      cy="5.5"
      r="3.5"
      fill={main}
      stroke={bg}
      strokeWidth="1"
    />
    <path
      d="M13.5 5.5H15.5M14.5 4.5V6.5"
      stroke="white"
      strokeWidth="1"
      strokeLinecap="round"
    />
  </svg>
);

type IconProps = { main: string; bg: string; size: number };

const iconComponents: Record<ClientStatus, React.FC<IconProps>> = {
  [ClientStatus.ONLINE]: OnlineIcon,
  [ClientStatus.OFFLINE]: OfflineIcon,
  [ClientStatus.RECOMMENDED_UPDATE]: RecommendedUpdateIcon,
  [ClientStatus.FORCED_UPDATE]: ForcedUpdateIcon,
  [ClientStatus.UNDER_REVIEW]: UnderReviewIcon,
  [ClientStatus.MAINTENANCE]: MaintenanceIcon,
  [ClientStatus.PATCH_UPDATE_REQUIRED]: PatchUpdateIcon,
};

interface ClientStatusIconProps {
  status: ClientStatus;
  size?: number;
}

const ClientStatusIcon: React.FC<ClientStatusIconProps> = ({
  status,
  size = 20,
}) => {
  const IconComponent = iconComponents[status];
  const colors = statusColors[status] || { main: '#9e9e9e', bg: '#f5f5f5' };

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 0,
        verticalAlign: 'middle',
      }}
    >
      <IconComponent main={colors.main} bg={colors.bg} size={size} />
    </Box>
  );
};

export default ClientStatusIcon;
