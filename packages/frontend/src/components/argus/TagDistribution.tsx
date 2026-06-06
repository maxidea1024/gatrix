import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Collapse,
  CircularProgress,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  LocalOffer as TagIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusIssueTagGroup } from '@/services/argusService';
import { getBrowserIcon, getOsIcon } from '@/utils/brandIcons';
import { useLocalStorage } from '@/hooks/useLocalStorage';

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

const TagDistribution: React.FC<TagDistributionProps> = ({
  projectId,
  issueId,
  isDark,
}) => {
  const { t } = useTranslation();
  const [tags, setTags] = useState<ArgusIssueTagGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useLocalStorage('argus_tags_expanded', true);

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
    <Box id="argus-tag-distribution" sx={{ mb: 2 }}>
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          cursor: 'pointer',
          borderBottom: expanded
            ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
            : 'none',
        }}
      >
        <TagIcon sx={{ fontSize: 16, color: '#2196f3' }} />
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{
            flex: 1,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'text.secondary',
          }}
        >
          {t('argus.tags.title', 'Tags')}
          {tags.length > 0 && (
            <Typography
              component="span"
              sx={{
                ml: 0.5,
                color: 'text.disabled',
                fontSize: '0.65rem',
                fontWeight: 500,
              }}
            >
              ({tags.length})
            </Typography>
          )}
        </Typography>
        {expanded ? (
          <ExpandLessIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        )}
      </Box>

      <Collapse in={expanded}>
        {loading ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {tags.map((tagGroup) => {
              const color = TAG_COLORS[tagGroup.key] || '#9e9e9e';
              const total = tagGroup.topValues.reduce(
                (sum, v) => sum + (Number(v.count) || 0),
                0
              );

              return (
                <Box key={tagGroup.key}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    sx={{
                      display: 'block',
                      mb: 1,
                      fontSize: '0.75rem',
                      color,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    {TAG_LABELS[tagGroup.key] || tagGroup.key}
                  </Typography>

                  {tagGroup.topValues.slice(0, 5).map((val, idx) => {
                    const count = Number(val.count) || 0;
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    return (
                      <Box key={idx} sx={{ mb: 0.8 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 0.2,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.6,
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                            }}
                          >
                            {tagGroup.key === 'browser' && (
                              <Box
                                sx={{
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                {getBrowserIcon(val.value, 16)}
                              </Box>
                            )}
                            {tagGroup.key === 'os' && (
                              <Box
                                sx={{
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                              >
                                {getOsIcon(val.value, 16)}
                              </Box>
                            )}
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.75rem',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {val.value || '(empty)'}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.75rem',
                              color: 'text.secondary',
                              flexShrink: 0,
                              ml: 1,
                              textAlign: 'right',
                            }}
                          >
                            {count.toLocaleString()} ({pct.toFixed(0)}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 4,
                            borderRadius: 2,
                            backgroundColor: isDark
                              ? 'rgba(255,255,255,0.04)'
                              : 'rgba(0,0,0,0.04)',
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
      <Divider sx={{ mt: 1 }} />
    </Box>
  );
};

export default TagDistribution;
