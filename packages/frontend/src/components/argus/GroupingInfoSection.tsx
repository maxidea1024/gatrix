/**
 * GroupingInfoSection — G27: Event grouping debug info.
 *
 * Shows how the event was grouped into this issue:
 * fingerprint, contributing frames, grouping strategy.
 */
import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, IconButton, Collapse,
  Tooltip, alpha, useTheme,
} from '@mui/material';
import {
  Fingerprint as FingerprintIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as ContributingIcon,
  RemoveCircle as NonContributingIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface GroupingFrame {
  filename: string;
  function: string;
  module?: string;
  contributing: boolean;
}

interface GroupingInfoData {
  fingerprint: string[];
  strategy: string;
  type: string;
  frames?: GroupingFrame[];
}

interface GroupingInfoSectionProps {
  groupingInfo: GroupingInfoData;
}

const GroupingInfoSection: React.FC<GroupingInfoSectionProps> = ({ groupingInfo }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(false); // collapsed by default (debug section)

  if (!groupingInfo) return null;

  const handleCopyFingerprint = () => {
    navigator.clipboard.writeText(groupingInfo.fingerprint.join(', '));
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2, overflow: 'hidden', mb: 1.5,
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1, cursor: 'pointer',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        }}
      >
        <FingerprintIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, flex: 1 }}>
          {t('argus.grouping.title')}
        </Typography>
        <Chip
          label={groupingInfo.strategy}
          size="small"
          sx={{ height: 18, fontSize: '0.55rem', fontWeight: 600 }}
        />
        <IconButton size="small" sx={{ width: 20, height: 20 }}>
          {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {/* Fingerprint */}
          <Box sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', mb: 0.5 }}>
              {t('argus.grouping.fingerprint')}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                flex: 1, p: 0.75, borderRadius: '4px',
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                fontFamily: 'monospace', fontSize: '0.7rem',
                wordBreak: 'break-all',
              }}>
                {groupingInfo.fingerprint.join(', ')}
              </Box>
              <Tooltip title={t('argus.grouping.copyFingerprint')}>
                <IconButton size="small" onClick={handleCopyFingerprint} sx={{ width: 24, height: 24 }}>
                  <CopyIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Strategy + Type */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase' }}>
                {t('argus.grouping.strategy')}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>
                {groupingInfo.strategy}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase' }}>
                {t('argus.grouping.type')}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>
                {groupingInfo.type}
              </Typography>
            </Box>
          </Box>

          {/* Contributing Frames */}
          {groupingInfo.frames && groupingInfo.frames.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', mb: 0.5 }}>
                {t('argus.grouping.contributingFrames')}
              </Typography>
              {groupingInfo.frames.map((frame, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    py: 0.25, px: 0.5, borderRadius: '4px',
                    opacity: frame.contributing ? 1 : 0.5,
                    '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
                  }}
                >
                  {frame.contributing ? (
                    <ContributingIcon sx={{ fontSize: 12, color: '#4caf50' }} />
                  ) : (
                    <NonContributingIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  )}
                  <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', color: frame.contributing ? 'text.primary' : 'text.disabled' }}>
                    {frame.module || frame.filename}
                  </Typography>
                  <Typography sx={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: frame.contributing ? 700 : 400 }}>
                    {frame.function}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default GroupingInfoSection;
