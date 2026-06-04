import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';
import {
  Language as BrowserIcon,
  DesktopWindows as OsIcon,
  PhoneAndroid as DeviceIcon,
  Code as SdkIcon,
  Public as GeoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface HighlightItem {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}

interface EventHighlightsProps {
  event: {
    browser?: string;
    browser_version?: string;
    os?: string;
    os_version?: string;
    device?: string;
    environment?: string;
    release?: string;
    user_ip?: string;
    platform?: string;
    tags?: Record<string, string>;
    contexts?: string | Record<string, any>;
  } | null;
}

const ICON_SIZE = 28;

const EventHighlights: React.FC<EventHighlightsProps> = ({ event }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  if (!event) return null;

  // Extract runtime/SDK info from contexts
  let runtime = '';
  let sdkName = '';
  try {
    const ctx = typeof event.contexts === 'string'
      ? JSON.parse(event.contexts)
      : event.contexts;
    if (ctx?.runtime) {
      runtime = `${ctx.runtime.name || ''} ${ctx.runtime.version || ''}`.trim();
    }
    if (ctx?.client_sdk) {
      sdkName = `${ctx.client_sdk.name || ''} ${ctx.client_sdk.version || ''}`.trim();
    }
  } catch { /* ignore */ }

  const highlights: HighlightItem[] = [];

  if (event.browser) {
    highlights.push({
      icon: <BrowserIcon sx={{ fontSize: ICON_SIZE }} />,
      label: t('argus.highlights.browser'),
      value: `${event.browser}${event.browser_version ? ` ${event.browser_version}` : ''}`,
      color: '#2196f3',
    });
  }

  if (event.os) {
    highlights.push({
      icon: <OsIcon sx={{ fontSize: ICON_SIZE }} />,
      label: t('argus.highlights.os'),
      value: `${event.os}${event.os_version ? ` ${event.os_version}` : ''}`,
      color: '#7c4dff',
    });
  }

  if (event.device && event.device !== 'Other') {
    highlights.push({
      icon: <DeviceIcon sx={{ fontSize: ICON_SIZE }} />,
      label: t('argus.highlights.device'),
      value: event.device,
      color: '#ff9800',
    });
  }

  if (runtime) {
    highlights.push({
      icon: <SdkIcon sx={{ fontSize: ICON_SIZE }} />,
      label: t('argus.highlights.runtime'),
      value: runtime,
      color: '#4caf50',
    });
  }

  if (event.user_ip && event.user_ip !== '{{auto}}') {
    highlights.push({
      icon: <GeoIcon sx={{ fontSize: ICON_SIZE }} />,
      label: t('argus.highlights.ip'),
      value: event.user_ip,
      color: '#00bcd4',
    });
  }

  if (highlights.length === 0) return null;

  return (
    <Box sx={{ mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {highlights.map((h, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.2,
            px: 1.5,
            py: 1,
            borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
            transition: 'background-color 0.15s',
            '&:hover': {
              backgroundColor: alpha(h.color, isDark ? 0.08 : 0.04),
            },
          }}
        >
          <Box sx={{
            color: h.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.85,
          }}>
            {h.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{
              fontSize: '0.85rem',
              fontWeight: 700,
              lineHeight: 1.3,
              color: 'text.primary',
              whiteSpace: 'nowrap',
            }}>
              {h.value}
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default EventHighlights;
