import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Menu,
  MenuItem,
  ListItemText,
} from '@mui/material';
import { MoreHoriz as MoreHorizIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusErrorEvent } from '@/services/argusService';
import { copyToClipboard } from '@/utils/clipboard';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import { ActionChip } from '@/components/common/ActionChip';
import ExceptionChaining from '@/components/argus/ExceptionChaining';
import StacktraceView from '@/components/argus/StacktraceView';

export interface IssueStacktraceSectionProps {
  event: ArgusErrorEvent;
  isDark: boolean;
}

const IssueStacktraceSection: React.FC<IssueStacktraceSectionProps> = ({
  event,
  isDark,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useLocalStorage<'relevant' | 'full'>(
    'argus_stacktrace_mode',
    'relevant'
  );
  const [order, setOrder] = useLocalStorage<'recent' | 'oldest'>(
    'argus_stacktrace_order',
    'recent'
  );
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [sortAnchor, setSortAnchor] = useState<null | HTMLElement>(null);

  // Stable callback handlers (for React.memo)
  const handleSortOpen = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget),
    []
  );
  const handleSortClose = useCallback(() => setSortAnchor(null), []);
  const handleSortSelect = useCallback(
    (v: string) => setOrder(v as 'recent' | 'oldest'),
    [setOrder]
  );

  const handleCopyRaw = () => {
    if (event.stacktrace_raw) {
      let raw = '';
      try {
        const parsed =
          typeof event.stacktrace_raw === 'string'
            ? JSON.parse(event.stacktrace_raw)
            : event.stacktrace_raw;
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
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ mb: 1, color: isDark ? '#fff' : '#000' }}
        >
          {t('argus.issues.stackTraceTitle', 'Stack Trace')}
        </Typography>
        {event.exception_value && (
          <Typography
            variant="body1"
            sx={{ color: isDark ? '#ddd' : '#333', mb: 2 }}
          >
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
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 0,
          }}
        >
          {/* Mode Toggle */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <ActionChip
              label={t('argus.issues.mostRelevant', 'Most Relevant')}
              variant={mode === 'relevant' ? 'filled' : 'outlined'}
              onClick={() => setMode('relevant')}
              sx={{ fontWeight: mode === 'relevant' ? 700 : 500 }}
            />
            <ActionChip
              label={t('argus.issues.fullStackTrace', 'Full Stack Trace')}
              variant={mode === 'full' ? 'filled' : 'outlined'}
              onClick={() => setMode('full')}
              sx={{ fontWeight: mode === 'full' ? 700 : 500 }}
            />
          </Box>

          {/* Order & More */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <FilterChipSelect
              label={t('argus.issues.sort', 'Sort')}
              value={order}
              options={[
                { value: 'recent', label: t('argus.issues.mostRecent') },
                { value: 'oldest', label: t('argus.issues.oldestFirst') },
              ]}
              anchorEl={sortAnchor}
              onOpen={handleSortOpen}
              onClose={handleSortClose}
              onSelect={handleSortSelect}
            />
            <ActionChip
              label={<MoreHorizIcon sx={{ fontSize: 16 }} />}
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
              sx={{
                minWidth: 28,
                '& .MuiChip-label': { px: 0.5, display: 'flex' },
              }}
            />
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
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <StacktraceView
          stacktrace={event.stacktrace_raw}
          mode={mode}
          order={order}
          isDark={isDark}
        />
      </Paper>
    </Box>
  );
};

export default React.memo(IssueStacktraceSection);
