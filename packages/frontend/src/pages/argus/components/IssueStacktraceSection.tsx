import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  useTheme,
  Menu,
  MenuItem,
  ListItemText,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusErrorEvent } from '@/services/argusService';
import { copyToClipboard } from '@/utils/clipboard';
import ExceptionChaining from '@/components/argus/ExceptionChaining';
import StacktraceView from '@/components/argus/StacktraceView';

export interface IssueStacktraceSectionProps {
  event: ArgusErrorEvent;
  isDark: boolean;
}

const IssueStacktraceSection: React.FC<IssueStacktraceSectionProps> = ({ event, isDark }) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'relevant' | 'full'>('relevant');
  const [order, setOrder] = useState<'recent' | 'oldest'>('recent');
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);

  const handleCopyRaw = () => {
    if (event.stacktrace_raw) {
      let raw = '';
      try {
        const parsed = typeof event.stacktrace_raw === 'string' ? JSON.parse(event.stacktrace_raw) : event.stacktrace_raw;
        raw = JSON.stringify(parsed, null, 2);
      } catch {
        raw = String(event.stacktrace_raw);
      }
      copyToClipboard(raw);
    }
    setMoreMenuAnchor(null);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: isDark ? '#fff' : '#000' }}>
          {t('argus.issues.stackTraceTitle', 'Stack Trace')}
        </Typography>
        {event.exception_value && (
          <Typography variant="body1" sx={{ color: isDark ? '#ddd' : '#333', mb: 2 }}>
            {event.exception_value}
          </Typography>
        )}

        {/* Exception Chaining */}
        <ExceptionChaining
          exceptionType={event.exception_type}
          exceptionValue={event.exception_value}
          isDark={isDark}
        />

        {/* Controls Row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0 }}>
          {/* Mode Toggle */}
          <Box sx={{
            display: 'inline-flex',
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            borderRadius: 2, overflow: 'hidden', p: 0.4, gap: 0.5,
          }}>
            {(['relevant', 'full'] as const).map((m) => (
              <Button
                key={m}
                size="small"
                onClick={() => setMode(m)}
                sx={{
                  fontSize: '0.75rem', py: 0.4, px: 2, borderRadius: 1.5, textTransform: 'none',
                  color: mode === m ? 'text.primary' : 'text.secondary',
                  backgroundColor: mode === m ? (isDark ? 'rgba(255,255,255,0.1)' : '#fff') : 'transparent',
                  boxShadow: mode === m ? (isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)') : 'none',
                  fontWeight: mode === m ? 600 : 500,
                  '&:hover': {
                    backgroundColor: mode === m
                      ? (isDark ? 'rgba(255,255,255,0.15)' : '#fff')
                      : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                  },
                }}
              >
                {m === 'relevant' ? t('argus.issues.mostRelevant', 'Most Relevant') : t('argus.issues.fullStackTrace', 'Full Stack Trace')}
              </Button>
            ))}
          </Box>

          {/* Order & More */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setOrder(prev => prev === 'recent' ? 'oldest' : 'recent')}
              endIcon={<ExpandMoreIcon sx={{ fontSize: 16, transform: order === 'oldest' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
              sx={{
                textTransform: 'none', color: 'text.primary',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                fontSize: '0.75rem', height: 32, borderRadius: 1.5,
              }}
            >
              <Typography component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 'inherit', fontWeight: 600 }}>
                <span style={{ fontSize: '10px' }}>⇅</span> {order === 'recent' ? t('argus.issues.mostRecent') : t('argus.issues.oldestFirst')}
              </Typography>
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
              sx={{
                minWidth: 0, px: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                color: 'text.primary', height: 32, borderRadius: 1.5,
              }}
            >
              <Typography component="span" sx={{ fontSize: '12px', lineHeight: 1 }}>•••</Typography>
            </Button>
            <Menu
              anchorEl={moreMenuAnchor}
              open={Boolean(moreMenuAnchor)}
              onClose={() => setMoreMenuAnchor(null)}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            >
              <MenuItem onClick={handleCopyRaw}>
                <ListItemText primaryTypographyProps={{ fontSize: '0.85rem' }}>
                  {t('argus.issues.copyRawStacktrace')}
                </ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </Box>

      {/* Stacktrace View */}
      <Paper elevation={0} sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 2, overflow: 'hidden',
      }}>
        <StacktraceView stacktrace={event.stacktrace_raw} mode={mode} order={order} isDark={isDark} />
      </Paper>
    </Box>
  );
};

export default IssueStacktraceSection;
