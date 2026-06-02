import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Chip, Skeleton, alpha, useTheme,
  List, ListItemButton, ListItemText, Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  MergeType as MergeIcon,
  ContentCopy as SimilarIcon,
  OpenInNew as OpenIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import argusService, { ArgusIssue } from '@/services/argusService';

interface SimilarMergedIssuesProps {
  projectId: string | number;
  issueId: string | number;
  fingerprint: string;
  isDark: boolean;
}

const SimilarMergedIssues: React.FC<SimilarMergedIssuesProps> = ({
  projectId,
  issueId,
  fingerprint,
  isDark,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [similarIssues, setSimilarIssues] = useState<ArgusIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!projectId || !issueId) return;
    let cancelled = false;

    const fetchSimilar = async () => {
      setLoading(true);
      try {
        // Fetch issues with same fingerprint prefix (similar grouping)
        const result = await argusService.listIssues(projectId, {
          query: `fingerprint:${fingerprint.slice(0, 8)}`,
          limit: 10,
        });
        if (!cancelled) {
          // Filter out current issue
          setSimilarIssues(
            (result.data || []).filter((i: ArgusIssue) => String(i.id) !== String(issueId))
          );
        }
      } catch (e) {
        console.error('Failed to fetch similar issues:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSimilar();
    return () => { cancelled = true; };
  }, [projectId, issueId, fingerprint]);

  if (loading) {
    return (
      <Box sx={{ mb: 2 }}>
        <Skeleton variant="text" width={120} height={20} />
        <Skeleton variant="rectangular" height={40} sx={{ borderRadius: 1, mt: 0.5 }} />
      </Box>
    );
  }

  if (similarIssues.length === 0) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          cursor: 'pointer', mb: 0.5,
          '&:hover': { opacity: 0.8 },
        }}
      >
        <SimilarIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        <Typography variant="caption" sx={{
          fontSize: '0.7rem', fontWeight: 700, color: 'text.secondary',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {t('argus.similar.title')}
        </Typography>
        <Chip
          label={similarIssues.length}
          size="small"
          sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, ml: 0.5 }}
        />
        <Box sx={{ ml: 'auto' }}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </Box>
      </Box>

      {expanded && (
        <List dense disablePadding sx={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: '8px',
          overflow: 'hidden',
        }}>
          {similarIssues.map((issue, idx) => (
            <React.Fragment key={issue.id}>
              {idx > 0 && <Divider />}
              <ListItemButton
                onClick={() => navigate(`/argus/issues/${issue.id}`, { state: { allowBack: true } })}
                sx={{ py: 0.5, px: 1.5 }}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {issue.status === 'resolved' ? (
                        <MergeIcon sx={{ fontSize: 12, color: 'success.main' }} />
                      ) : (
                        <SimilarIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                      )}
                      <Typography sx={{
                        fontSize: '0.75rem', fontWeight: 600,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: 250,
                      }}>
                        {issue.title}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                      <Chip
                        label={issue.status}
                        size="small"
                        sx={{
                          height: 14, fontSize: '0.55rem', fontWeight: 700,
                          backgroundColor: alpha(
                            issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336',
                            0.1
                          ),
                          color: issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336',
                          border: 'none',
                        }}
                      />
                      <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                        {issue.event_count} {t('argus.issues.events')}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                        {issue.last_seen ? new Date(issue.last_seen).toLocaleDateString() : ''}
                      </Typography>
                    </Box>
                  }
                />
                <Tooltip title={t('argus.similar.openInNewTab')}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/argus/issues/${issue.id}`, '_blank');
                    }}
                    sx={{ width: 20, height: 20, ml: 0.5 }}
                  >
                    <OpenIcon sx={{ fontSize: 12 }} />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );
};

export default SimilarMergedIssues;
