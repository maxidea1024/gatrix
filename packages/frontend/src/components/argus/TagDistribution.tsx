import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  useTheme,
  alpha,
  Collapse,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  LocalOffer as TagIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusIssueTagGroup } from '@/services/argusService';

interface TagDistributionProps {
  projectId: string;
  issueId: string;
  isDark: boolean;
}

const TAG_LABELS: Record<string, string> = {
  browser: 'Browser',
  os: 'OS',
  device: 'Device',
  level: 'Level',
  environment: 'Environment',
  release: 'Release',
  url: 'URL',
};

const TAG_COLORS: Record<string, string> = {
  browser: '#2196f3',
  os: '#4caf50',
  device: '#ff9800',
  level: '#f44336',
  environment: '#7c4dff',
  release: '#00bcd4',
  url: '#e91e63',
};

const TagDistribution: React.FC<TagDistributionProps> = ({ projectId, issueId, isDark }) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<ArgusIssueTagGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getIssueTags(projectId, issueId);
      setTags(data);
    } catch (error) {
      console.error('Failed to fetch tags:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  if (!loading && tags.length === 0) return null;

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        mb: 2,
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1.5, cursor: 'pointer',
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          borderBottom: expanded ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}` : 'none',
        }}
      >
        <TagIcon sx={{ fontSize: 18, color: '#2196f3' }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, fontSize: '0.82rem' }}>
          {t('argus.tags.title', 'Tags')}
          {tags.length > 0 && (
            <Typography component="span" sx={{ ml: 0.5, color: 'text.disabled', fontSize: '0.72rem', fontWeight: 500 }}>
              ({tags.length})
            </Typography>
          )}
        </Typography>
        {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
      </Box>

      <Collapse in={expanded}>
        {loading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 0 }}>
            {tags.map((tagGroup) => {
              const color = TAG_COLORS[tagGroup.key] || '#9e9e9e';
              const total = tagGroup.topValues.reduce((sum, v) => sum + v.count, 0);

              return (
                <Box
                  key={tagGroup.key}
                  sx={{
                    p: 1.5,
                    borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{
                    display: 'block', mb: 1, fontSize: '0.68rem',
                    color, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {TAG_LABELS[tagGroup.key] || tagGroup.key}
                  </Typography>

                  {tagGroup.topValues.slice(0, 5).map((val, idx) => {
                    const pct = total > 0 ? (val.count / total) * 100 : 0;
                    return (
                      <Box key={idx} sx={{ mb: 0.8 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.2 }}>
                          <Typography variant="caption" noWrap sx={{
                            fontSize: '0.68rem', maxWidth: '60%',
                            fontFamily: 'monospace',
                          }}>
                            {val.value || '(empty)'}
                          </Typography>
                          <Typography variant="caption" sx={{
                            fontSize: '0.62rem', color: 'text.disabled', fontFamily: 'monospace',
                          }}>
                            {val.count.toLocaleString()} ({pct.toFixed(0)}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 4, borderRadius: 2,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 2,
                              backgroundColor: alpha(color, 0.6),
                            },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default TagDistribution;
