import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Collapse,
  CircularProgress,
  Link,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Code as CodeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusCommit } from '@/services/argusService';

interface SuspectCommitsProps {
  projectId: string;
  issueId: string;
  isDark: boolean;
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    if (days < 30) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#f44336',
    '#e91e63',
    '#9c27b0',
    '#673ab7',
    '#3f51b5',
    '#2196f3',
    '#00bcd4',
    '#009688',
    '#4caf50',
    '#ff9800',
  ];
  return colors[Math.abs(hash) % colors.length];
}

const SuspectCommits: React.FC<SuspectCommitsProps> = ({
  projectId,
  issueId,
  isDark,
}) => {
  const { t } = useTranslation();
  const [commits, setCommits] = useState<ArgusCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const fetchCommits = useCallback(async () => {
    setLoading(true);
    try {
      const data = await argusService.getSuspectCommits(projectId, issueId);
      setCommits(data);
    } catch (error) {
      console.error('Failed to fetch suspect commits:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, issueId]);

  useEffect(() => {
    fetchCommits();
  }, [fetchCommits]);

  if (!loading && commits.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          cursor: 'pointer',
        }}
      >
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
          {t('argus.issues.suspectCommits')}
          {commits.length > 0 && (
            <Typography
              component="span"
              sx={{
                ml: 0.5,
                color: 'text.disabled',
                fontSize: '0.65rem',
                fontWeight: 500,
              }}
            >
              ({commits.length})
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
          <Box sx={{ py: 2, textAlign: 'center' }}>
            <CircularProgress size={18} />
          </Box>
        ) : (
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}
          >
            {commits.map((commit) => {
              const authorColor = stringToColor(
                commit.author_name || commit.author_email || 'unknown'
              );
              const initials = commit.author_name
                ? commit.author_name
                    .split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : '?';
              const filesChanged = commit.files_changed
                ? typeof commit.files_changed === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(commit.files_changed);
                      } catch {
                        return [];
                      }
                    })()
                  : commit.files_changed
                : [];
              const fileCount = Array.isArray(filesChanged)
                ? filesChanged.length
                : 0;

              return (
                <Box
                  key={commit.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(0,0,0,0.01)',
                  }}
                >
                  {/* Commit message */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      mb: 0.8,
                    }}
                  >
                    <CodeIcon
                      sx={{
                        fontSize: 14,
                        color: '#7c4dff',
                        mt: 0.2,
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      variant="caption"
                      fontWeight={600}
                      sx={{
                        fontSize: '0.72rem',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {commit.message || t('argus.issues.noCommitMessage')}
                    </Typography>
                  </Box>

                  {/* Author + Hash + Time */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <Avatar
                      sx={{
                        width: 18,
                        height: 18,
                        fontSize: '0.55rem',
                        fontWeight: 700,
                        backgroundColor: authorColor,
                      }}
                    >
                      {initials}
                    </Avatar>
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.65rem', color: 'text.secondary' }}
                    >
                      {commit.author_name || commit.author_email || 'Unknown'}
                    </Typography>
                    <Tooltip title={commit.commit_hash}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.62rem',
                          color: 'text.disabled',
                          cursor: 'default',
                        }}
                      >
                        {commit.commit_hash.slice(0, 7)}
                      </Typography>
                    </Tooltip>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.6rem',
                        color: 'text.disabled',
                        ml: 'auto',
                      }}
                    >
                      {formatRelativeTime(commit.timestamp)}
                    </Typography>
                  </Box>

                  {/* File changes summary */}
                  {(commit.additions > 0 ||
                    commit.deletions > 0 ||
                    fileCount > 0) && (
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.6 }}>
                      {fileCount > 0 && (
                        <Typography
                          variant="caption"
                          sx={{ fontSize: '0.6rem', color: 'text.disabled' }}
                        >
                          {t('argus.issues.filesChanged', { count: fileCount })}
                        </Typography>
                      )}
                      {commit.additions > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.6rem',
                            color: '#4caf50',
                            fontWeight: 600,
                          }}
                        >
                          +{commit.additions}
                        </Typography>
                      )}
                      {commit.deletions > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.6rem',
                            color: '#f44336',
                            fontWeight: 600,
                          }}
                        >
                          -{commit.deletions}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Collapse>
      <Divider sx={{ mt: 2, mb: 2 }} />
    </Box>
  );
};

export default SuspectCommits;
