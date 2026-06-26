import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  TextField,
  InputAdornment,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  FilterList as FilterListIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import argusService, {
  ArgusFeedbackItem,
  ArgusIssueTracker,
  ArgusIssue,
} from '@/services/argusService';
import {
  SpamKeywordRow,
  RegexChip,
  IssueResultRow,
  IssueStatusChip,
  TrackerChip,
} from './FeedbackDialogs.styles';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

// ─── Spam Filter Dialog ───

interface SpamFilterDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onSpamScanComplete: () => void;
}

export const SpamFilterDialog: React.FC<SpamFilterDialogProps> = ({
  open,
  onClose,
  projectId,
  onSpamScanComplete,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = useTheme().palette.mode === 'dark';

  const [keywords, setKeywords] = useState<
    { id: number; keyword: string; is_regex: boolean; created_at: string }[]
  >([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [newKeywordRegex, setNewKeywordRegex] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const fetchKeywords = useCallback(async () => {
    try {
      setKeywords(await argusService.getSpamKeywords(projectId));
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    if (open) fetchKeywords();
  }, [open, fetchKeywords]);

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await argusService.addSpamKeyword(
        projectId,
        newKeyword.trim(),
        newKeywordRegex
      );
      setNewKeyword('');
      setNewKeywordRegex(false);
      fetchKeywords();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleDeleteKeyword = async (id: number) => {
    try {
      await argusService.deleteSpamKeyword(projectId, id);
      fetchKeywords();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  const handleRunAutoSpam = async () => {
    setScanLoading(true);
    try {
      const result = await argusService.runAutoSpam(projectId);
      enqueueSnackbar(
        result.matched > 0
          ? t('argus.feedback.spamScanDone', { count: result.matched })
          : t('argus.feedback.spamScanNone'),
        { variant: result.matched > 0 ? 'success' : 'info' }
      );
      if (result.matched > 0) onSpamScanComplete();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    } finally {
      setScanLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle
        sx={{
          fontSize: '0.9rem',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterListIcon sx={{ fontSize: 20, color: ARGUS_SEMANTIC.warning }} />
          {t('argus.feedback.spamFilter')}
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            display: 'block',
            mb: 2,
            fontSize: '0.75rem',
          }}
        >
          {t('argus.feedback.spamFilterDesc')}
        </Typography>

        {/* Add keyword */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('argus.feedback.spamKeywordPlaceholder')}
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
          />
          <Tooltip title={t('argus.feedback.regexToggle')}>
            <Chip
              label=".*"
              size="small"
              onClick={() => setNewKeywordRegex(!newKeywordRegex)}
              sx={{
                height: 32,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: newKeywordRegex
                  ? alpha(ARGUS_SEMANTIC.warning, 0.15)
                  : 'transparent',
                color: newKeywordRegex ? ARGUS_SEMANTIC.warning : 'text.disabled',
                border: `1px solid ${newKeywordRegex ? ARGUS_SEMANTIC.warning : 'rgba(128,128,128,0.3)'}`,
              }}
            />
          </Tooltip>
          <Button
            variant="contained"
            size="small"
            onClick={handleAddKeyword}
            disabled={!newKeyword.trim()}
            sx={{ textTransform: 'none', minWidth: 60, fontWeight: 700 }}
          >
            {t('common.add')}
          </Button>
        </Box>

        {/* Keyword list */}
        {keywords.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <FilterListIcon
              sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }}
            />
            <Typography color="text.disabled" sx={{ fontSize: '0.82rem' }}>
              {t('argus.feedback.noSpamKeywords')}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ maxHeight: 240, overflow: 'auto' }}>
            {keywords.map((kw) => (
              <SpamKeywordRow key={kw.id} isDark={isDark}>
                <Typography sx={{ flex: 1, fontSize: '0.82rem' }}>
                  {kw.keyword}
                </Typography>
                {kw.is_regex && <RegexChip label="regex" size="small" />}
                <IconButton
                  size="small"
                  onClick={() => handleDeleteKeyword(kw.id)}
                  sx={{
                    color: 'text.disabled',
                    '&:hover': { color: ARGUS_SEMANTIC.negative },
                  }}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </SpamKeywordRow>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RunIcon />}
          onClick={handleRunAutoSpam}
          disabled={scanLoading || keywords.length === 0}
          sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 600 }}
        >
          {scanLoading ? t('common.loading') : t('argus.feedback.runSpamScan')}
        </Button>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Create Issue Dialog ───

interface CreateIssueDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  selectedItem: ArgusFeedbackItem | null;
  onIssueCreated: () => void;
}

export const CreateIssueDialog: React.FC<CreateIssueDialogProps> = ({
  open,
  onClose,
  projectId,
  selectedItem,
  onIssueCreated,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = useTheme().palette.mode === 'dark';

  const [title, setTitle] = useState('');
  const [trackers, setTrackers] = useState<ArgusIssueTracker[]>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<number | ''>('');

  useEffect(() => {
    if (open && selectedItem) {
      setTitle(`[Feedback] ${selectedItem.message.slice(0, 80)}`);
      setSelectedTrackerId('');
      argusService
        .listIssueTrackers(projectId)
        .then(setTrackers)
        .catch(() => {});
    }
  }, [open, selectedItem, projectId]);

  const handleCreate = async () => {
    if (!title.trim() || !selectedItem) return;
    try {
      const result = await argusService.createIssue(projectId, {
        title,
        level: 'info',
        message: selectedItem.message || '',
        culprit: selectedItem.url || 'user-feedback',
        tracker_id: selectedTrackerId ? Number(selectedTrackerId) : undefined,
      });
      if (result.external_url) {
        enqueueSnackbar(
          t('argus.feedback.issueCreatedExternal', {
            key: result.external_key || '',
          }),
          { variant: 'success' }
        );
      } else {
        enqueueSnackbar(t('argus.feedback.issueCreated'), {
          variant: 'success',
        });
      }
      onClose();
      onIssueCreated();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700 }}>
        {t('argus.feedback.createIssue')}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          size="small"
          label={t('argus.feedback.issueTitle')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mt: 1 }}
        />

        {/* Issue Tracker Selection */}
        <FormControl fullWidth size="small" sx={{ mt: 2 }}>
          <InputLabel sx={{ fontSize: '0.82rem' }}>
            {t('argus.feedback.issueTracker')}
          </InputLabel>
          <Select
            value={selectedTrackerId}
            onChange={(e) =>
              setSelectedTrackerId(e.target.value as number | '')
            }
            label={t('argus.feedback.issueTracker')}
            sx={{ fontSize: '0.82rem' }}
          >
            <MenuItem value="" sx={{ fontSize: '0.82rem' }}>
              <em>{t('argus.feedback.internalOnly')}</em>
            </MenuItem>
            {trackers
              .filter((tr) => tr.enabled)
              .map((tracker) => (
                <MenuItem
                  key={tracker.id}
                  value={tracker.id}
                  sx={{ fontSize: '0.82rem' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrackerChip
                      label={tracker.provider.toUpperCase()}
                      size="small"
                      providerColor={
                        tracker.provider === 'jira'
                          ? '#0052CC'
                          : tracker.provider === 'linear'
                            ? '#5E6AD2'
                            : '#333'
                      }
                    />
                    {tracker.name}
                  </Box>
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {selectedItem && (
          <Paper
            elevation={0}
            sx={{
              mt: 2,
              p: 1.5,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)',
              borderRadius: 1.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: 'text.secondary',
                fontSize: '0.68rem',
              }}
            >
              {t('argus.feedback.feedbackMessage')}:
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                maxHeight: 120,
                overflow: 'auto',
              }}
            >
              {selectedItem.message}
            </Typography>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!title.trim()}
          sx={{ textTransform: 'none' }}
        >
          {t('argus.feedback.createIssue')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Link Existing Issue Dialog ───

interface LinkIssueDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  feedbackId: string;
  onIssueLinked: () => void;
}

export const LinkIssueDialog: React.FC<LinkIssueDialogProps> = ({
  open,
  onClose,
  projectId,
  feedbackId,
  onIssueLinked,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const isDark = useTheme().palette.mode === 'dark';

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ArgusIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchIssues = useCallback(
    async (query: string) => {
      setLoading(true);
      try {
        const result = await argusService.listIssues(projectId, {
          search: query,
          limit: 15,
        });
        setResults(result.data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (open) {
      setSearch('');
      setResults([]);
      searchIssues('');
    }
  }, [open, searchIssues]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => searchIssues(value), 300);
    },
    [searchIssues]
  );

  const handleLink = async (issueId: number) => {
    try {
      await argusService.linkFeedbackToIssue(projectId, feedbackId, issueId);
      enqueueSnackbar(t('argus.feedback.issueLinked'), { variant: 'success' });
      onClose();
      onIssueLinked();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '0.9rem', fontWeight: 700 }}>
        {t('argus.feedback.linkExistingIssue', 'Link Existing Issue')}
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          size="small"
          placeholder={t('argus.feedback.searchIssue', 'Search issues...')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mt: 1, mb: 1 }}
        />
        <Box sx={{ height: 350, overflow: 'auto' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <Typography variant="caption" color="text.disabled">
                {t('common.loading')}...
              </Typography>
            </Box>
          ) : results.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant="caption" color="text.disabled">
                {t('argus.feedback.noIssuesFound', 'No issues found')}
              </Typography>
            </Box>
          ) : (
            results.map((issue) => {
              const issueColor =
                issue.status === 'resolved'
                  ? ARGUS_SEMANTIC.positive
                  : issue.status === 'ignored'
                    ? '#9e9e9e'
                    : ARGUS_SEMANTIC.warning;
              return (
                <IssueResultRow
                  key={issue.id}
                  isDark={isDark}
                  onClick={() => handleLink(issue.id)}
                >
                  <IssueStatusChip
                    label={issue.status}
                    size="small"
                    statusColor={issueColor}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {issue.title}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.65rem', color: 'text.disabled' }}
                    >
                      #{issue.id} · {t('argus.issues.events', 'Events')}:{' '}
                      {issue.event_count} · {issue.culprit}
                    </Typography>
                  </Box>
                </IssueResultRow>
              );
            })
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
