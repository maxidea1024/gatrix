import React from 'react';
import { Box, Typography, Chip, alpha, useTheme } from '@mui/material';
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
      icon: <BrowserIcon sx={{ fontSize: 14 }} />,
      label: t('argus.highlights.browser'),
      value: `${event.browser}${event.browser_version ? ` ${event.browser_version}` : ''}`,
    });
  }

  if (event.os) {
    highlights.push({
      icon: <OsIcon sx={{ fontSize: 14 }} />,
      label: t('argus.highlights.os'),
      value: `${event.os}${event.os_version ? ` ${event.os_version}` : ''}`,
    });
  }

  if (event.device && event.device !== 'Other') {
    highlights.push({
      icon: <DeviceIcon sx={{ fontSize: 14 }} />,
      label: t('argus.highlights.device'),
      value: event.device,
    });
  }

  if (runtime) {
    highlights.push({
      icon: <SdkIcon sx={{ fontSize: 14 }} />,
      label: t('argus.highlights.runtime'),
      value: runtime,
    });
  }

  if (event.user_ip && event.user_ip !== '{{auto}}') {
    highlights.push({
      icon: <GeoIcon sx={{ fontSize: 14 }} />,
      label: t('argus.highlights.ip'),
      value: event.user_ip,
    });
  }

  if (highlights.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{
        fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary',
        textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5, display: 'block',
      }}>
        {t('argus.highlights.title')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {highlights.map((h, i) => (
          <Chip
            key={i}
            icon={<Box sx={{ display: 'flex', color: 'text.secondary' }}>{h.icon}</Box>}
            label={
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Typography component="span" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                  {h.label}
                </Typography>
                <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 600 }}>
                  {h.value}
                </Typography>
              </Box>
            }
            size="small"
            sx={{
              height: 26,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              borderRadius: '6px',
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default EventHighlights;
