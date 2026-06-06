import React from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

// ─── Issue Trackers ──────────────────────────────────────────────────

export const JiraIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53ZM6.77 6.8a4.36 4.36 0 0 0 4.34 4.34h1.8v1.72a4.36 4.36 0 0 0 4.34 4.34V7.63a.84.84 0 0 0-.84-.84H6.77ZM2 11.6a4.35 4.35 0 0 0 4.35 4.34h1.78v1.72c0 2.4 1.95 4.34 4.35 4.34v-9.56a.84.84 0 0 0-.84-.84H2Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const LinearIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M2.328 14.134a10.06 10.06 0 0 0 7.538 7.538L2.328 14.134ZM2 12.492a10.082 10.082 0 0 0 1.96 6.42L12.913 9.96A10.082 10.082 0 0 0 6.492 8h-.07A10.04 10.04 0 0 0 2 12.492Zm3.293-6.15A10.036 10.036 0 0 0 2.046 11.5l10.454-10.454a10.036 10.036 0 0 0-5.158-1.246c-.77 0-1.422.54-2.05 1.642ZM7.98 2.33l13.692 13.692A10.063 10.063 0 0 0 22 12c0-5.523-4.477-10-10-10a10.063 10.063 0 0 0-4.02.33ZM21.672 9.866a10.06 10.06 0 0 0-7.538-7.538l7.538 7.538Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const ClickUpIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M3 17.28l3.18-2.46c1.92 2.48 4.1 3.64 6.82 3.64 2.68 0 4.82-1.12 6.78-3.56L23 17.2c-2.74 3.42-5.92 5.28-9.98 5.28-4.1 0-7.28-1.88-10.02-5.2Z"
      fill="currentColor"
    />
    <path
      d="M12.02 7.04L7.2 11.36 4 7.84l8.02-7.32L20 7.82l-3.22 3.54-4.76-4.32Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const AsanaIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M18.21 11.28a4.79 4.79 0 1 1 0 9.58 4.79 4.79 0 0 1 0-9.58Zm-12.42 0a4.79 4.79 0 1 1 0 9.58 4.79 4.79 0 0 1 0-9.58ZM12 3.14a4.79 4.79 0 1 1 0 9.58 4.79 4.79 0 0 1 0-9.58Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const NotionIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.513 3.593c.648.53.893.493 2.115.412l11.5-.693c.24 0 .04-.24-.04-.28l-1.913-1.382c-.358-.28-.836-.59-1.752-.53l-11.14.85c-.399.04-.479.24-.319.4l1.549 1.223ZM5.2 6.683v12.09c0 .65.319.9 1.038.85l12.636-.73c.72-.04.8-.48.8-1v-11.97c0-.53-.2-.8-.64-.76l-13.196.76c-.48.04-.639.28-.639.76ZM17.595 7.573c.08.36 0 .72-.36.76l-.6.12v8.93c-.52.28-.999.44-1.398.44-.639 0-.8-.2-1.278-.8l-3.914-6.14v5.94l1.239.28s0 .72-.999.72l-2.756.16c-.08-.16 0-.56.28-.64l.72-.2V9.153l-1-.08c-.08-.36.12-.88.68-.92l2.955-.2 4.073 6.22v-5.52l-1.038-.12c-.08-.44.24-.76.639-.8l2.757-.16Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const ShortcutIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm-1 14.5v-3.29L7.5 15.5l-1-1.73L10 12l-3.5-1.77 1-1.73L11 10.79V7.5h2v3.29l3.5-2.29 1 1.73L14 12l3.5 1.77-1 1.73L13 13.21V16.5h-2Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const AzureDevOpsIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M22 5.714V18l-5.143 4-7.429-2.714v2.571L4 16.429l13.714 1.143V6.286L22 5.714ZM17.714 6.286l-6-4.286v2.286L5.571 6.857 2 10.286v4l3.429-1.143V8.286l12.285-2Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const RedmineIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M12 2L3 7v10l9 5 9-5V7l-9-5Zm0 2.18L18.82 7.5 12 10.82 5.18 7.5 12 4.18ZM5 8.82l6 3.32v6.68l-6-3.32V8.82Zm14 0v6.68l-6 3.32v-6.68l6-3.32Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const YouTrackIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path d="M4.5 4.5h15v15h-15z" fill="currentColor" />
    <path
      d="M6.75 7.5h4.5v1.2h-4.5zm0 3.6h7.5v1.2h-7.5zm0 3.6h6v1.2h-6z"
      fill={
        props.sx &&
        typeof props.sx === 'object' &&
        'backgroundColor' in props.sx
          ? '#fff'
          : 'var(--bg, #fff)'
      }
    />
  </SvgIcon>
);

export const TrelloIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M19.5 2h-15A2.5 2.5 0 0 0 2 4.5v15A2.5 2.5 0 0 0 4.5 22h15a2.5 2.5 0 0 0 2.5-2.5v-15A2.5 2.5 0 0 0 19.5 2ZM10.75 17a1.25 1.25 0 0 1-1.25 1.25h-3A1.25 1.25 0 0 1 5.25 17V5.75A1.25 1.25 0 0 1 6.5 4.5h3a1.25 1.25 0 0 1 1.25 1.25V17Zm8 -5a1.25 1.25 0 0 1-1.25 1.25h-3A1.25 1.25 0 0 1 13.25 12V5.75A1.25 1.25 0 0 1 14.5 4.5h3a1.25 1.25 0 0 1 1.25 1.25V12Z"
      fill="currentColor"
    />
  </SvgIcon>
);

// ─── Source Code Integrations ────────────────────────────────────────

export const GitLabIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51a.42.42 0 0 1 .82 0l2.44 7.51h8.06l2.44-7.51a.42.42 0 0 1 .82 0l2.44 7.51 1.22 3.78a.84.84 0 0 1-.3.94Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const BitbucketIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M3.27 3.56a.65.65 0 0 0-.65.76l2.7 16.37a.89.89 0 0 0 .86.75h12.09a.65.65 0 0 0 .65-.55l2.7-16.57a.65.65 0 0 0-.65-.76H3.27Zm11.14 11.58h-4.6l-1.24-6.52h7.04l-1.2 6.52Z"
      fill="currentColor"
    />
  </SvgIcon>
);

// ─── Notification Channels ───────────────────────────────────────────

export const SlackIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M5.04 15.16a2.12 2.12 0 1 1-2.12-2.12h2.12v2.12Zm1.07 0a2.12 2.12 0 1 1 4.24 0v5.3a2.12 2.12 0 1 1-4.24 0v-5.3ZM8.23 5.04a2.12 2.12 0 1 1 2.12-2.12v2.12H8.23Zm0 1.07a2.12 2.12 0 1 1 0 4.24H2.92a2.12 2.12 0 1 1 0-4.24h5.31ZM18.36 8.23a2.12 2.12 0 1 1 2.12 2.12h-2.12V8.23Zm-1.07 0a2.12 2.12 0 1 1-4.24 0V2.92a2.12 2.12 0 1 1 4.24 0v5.31ZM15.17 18.36a2.12 2.12 0 1 1-2.12 2.12v-2.12h2.12Zm0-1.07a2.12 2.12 0 1 1 0-4.24h5.31a2.12 2.12 0 1 1 0 4.24h-5.31Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const DiscordIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.07.07 0 0 0-.079.036 13.91 13.91 0 0 0-.614 1.262 18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.624-1.262.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.664 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.227-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const MSTeamsIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M19.19 8.77a2.07 2.07 0 1 0 0-4.14 2.07 2.07 0 0 0 0 4.14ZM16.01 8.15a2.77 2.77 0 1 0 0-5.53 2.77 2.77 0 0 0 0 5.53Z"
      fill="currentColor"
    />
    <path
      d="M22.4 10.04h-4.4a.93.93 0 0 0-.93.93v4.2a3.52 3.52 0 0 0 2.58 3.38c2.47-.42 3.68-1.89 3.68-3.92v-3.66a.93.93 0 0 0-.93-.93Z"
      fill="currentColor"
    />
    <path
      d="M14.7 9.42H7.3a1.04 1.04 0 0 0-1.04 1.04v5.88A4.66 4.66 0 0 0 11 21a4.66 4.66 0 0 0 4.74-4.66v-5.88a1.04 1.04 0 0 0-1.04-1.04Z"
      fill="currentColor"
    />
    <path
      d="M11 8.77a3.08 3.08 0 1 0 0-6.16 3.08 3.08 0 0 0 0 6.16Z"
      fill="currentColor"
    />
  </SvgIcon>
);

export const PagerDutyIcon: React.FC<SvgIconProps> = (props) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      d="M7.5 21.75h3V17.4h3.42c3.36 0 5.58-2.28 5.58-5.46 0-3.36-2.34-5.4-5.76-5.4H7.5v14.71Zm3-8.25V9.54h3.12c1.68 0 2.76.96 2.76 2.04 0 .96-.84 1.92-2.64 1.92H10.5Z"
      fill="currentColor"
    />
  </SvgIcon>
);
