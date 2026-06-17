import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Popover,
  CircularProgress,
  alpha,
  useTheme,
  InputAdornment,
} from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import argusService from '@/services/argusService';
import {
  ICON_CATALOG,
  COLOR_PRESETS,
  renderLexiconIcon,
} from '@/utils/lexiconIcons';

// ─── Types ────────────────────────────────────────────────────────────────────
interface QuickLexiconEditorProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  eventName: string;
  projectId: string;
  onClose: () => void;
  onSaved: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const QuickLexiconEditor: React.FC<QuickLexiconEditorProps> = ({
  open,
  anchorEl,
  eventName,
  projectId,
  onClose,
  onSaved,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [iconColor, setIconColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  // Fetch current lexicon data when opened
  useEffect(() => {
    if (!open || !eventName) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const events = await argusService.getLexiconEvents(projectId);
        const ev = events.find((e) => e.event_name === eventName);
        if (!cancelled && ev) {
          setDisplayName(ev.display_name || '');
          setDescription(ev.description || '');
          setIcon(ev.icon || '');
          setIconColor(ev.icon_color || '');
        } else if (!cancelled) {
          setDisplayName('');
          setDescription('');
          setIcon('');
          setIconColor('');
        }
      } catch {
        // Ignore — fields stay empty
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventName, projectId]);

  // Reset search when closed
  useEffect(() => {
    if (!open) setIconSearch('');
  }, [open]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await argusService.updateLexiconEvent(projectId, eventName, {
        display_name: displayName || null,
        description: description || null,
        icon: icon || null,
        icon_color: iconColor || null,
      });
      enqueueSnackbar(
        t('argus.analytics.lexiconSaved', 'Event metadata saved'),
        { variant: 'success' }
      );
      onSaved();
      onClose();
    } catch {
      enqueueSnackbar(t('argus.analytics.lexiconSaveError', 'Failed to save'), {
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [
    projectId,
    eventName,
    displayName,
    description,
    icon,
    iconColor,
    enqueueSnackbar,
    t,
    onSaved,
    onClose,
  ]);

  const filteredIcons = useMemo(() => {
    if (!iconSearch) return ICON_CATALOG;
    const s = iconSearch.toLowerCase();
    return ICON_CATALOG.filter(
      (ic) =>
        ic.name.toLowerCase().includes(s) || ic.label.toLowerCase().includes(s)
    );
  }, [iconSearch]);

  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            mt: 0.5,
            borderRadius: 2.5,
            width: 340,
            boxShadow: isDark
              ? '0 12px 48px rgba(0,0,0,0.6)'
              : '0 12px 48px rgba(0,0,0,0.12)',
            border: `1px solid ${borderColor}`,
            overflow: 'hidden',
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: `1px solid ${borderColor}`,
          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ fontSize: '0.85rem' }}
          >
            {t('argus.analytics.quickEdit', 'Quick Edit')}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            fontFamily="monospace"
            sx={{ fontSize: '0.75rem' }}
          >
            {eventName}
          </Typography>
        </Box>
        <Box
          onClick={onClose}
          sx={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 1,
            color: 'text.secondary',
            '&:hover': {
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Display Name */}
          <TextField
            size="small"
            label={t('argus.analytics.displayName', 'Display Name')}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            fullWidth
            placeholder={eventName}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />

          {/* Description */}
          <TextField
            size="small"
            label={t('argus.analytics.description', 'Description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            maxRows={3}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
          />

          {/* Icon Selection */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ mb: 0.5, display: 'block' }}
            >
              {t('argus.analytics.icon', 'Icon')}
            </Typography>

            {/* Current icon preview + search */}
            <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: iconColor
                    ? alpha(iconColor, isDark ? 0.18 : 0.12)
                    : isDark
                      ? 'rgba(99, 102, 241, 0.15)'
                      : 'rgba(99, 102, 241, 0.08)',
                  color: iconColor || (isDark ? '#a5b4fc' : '#4f46e5'),
                  flexShrink: 0,
                  border: `1px solid ${borderColor}`,
                }}
              >
                {renderLexiconIcon(icon || null, 20, iconColor || undefined)}
              </Box>
              <TextField
                size="small"
                placeholder={t(
                  'argus.analytics.searchIcons',
                  'Search icons...'
                )}
                value={iconSearch}
                onChange={(e) => setIconSearch(e.target.value)}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 16 }} />
                    </InputAdornment>
                  ),
                  sx: { fontSize: '0.8rem' },
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 1.5 } }}
              />
            </Box>

            {/* Icon grid */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 0.5,
                maxHeight: 120,
                overflowY: 'auto',
                p: 0.5,
                border: `1px solid ${borderColor}`,
                borderRadius: 1.5,
              }}
            >
              {filteredIcons.map((ic) => (
                <Box
                  key={ic.name}
                  title={ic.label}
                  onClick={() => setIcon(ic.name)}
                  sx={{
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor:
                      icon === ic.name
                        ? alpha(iconColor || '#6366f1', 0.2)
                        : 'transparent',
                    border:
                      icon === ic.name
                        ? `1.5px solid ${iconColor || '#6366f1'}`
                        : '1.5px solid transparent',
                    color: iconColor || (isDark ? '#a5b4fc' : '#4f46e5'),
                    transition: 'all 0.1s',
                    '&:hover': {
                      bgcolor: isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                    },
                  }}
                >
                  {renderLexiconIcon(ic.name, 16, iconColor || undefined)}
                </Box>
              ))}
              {filteredIcons.length === 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 1 }}
                >
                  {t('common.noResultsFound', 'No results')}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Color Selection */}
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={600}
              sx={{ mb: 0.5, display: 'block' }}
            >
              {t('argus.analytics.iconColor', 'Icon Color')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {COLOR_PRESETS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setIconColor(c)}
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: c,
                    cursor: 'pointer',
                    border:
                      iconColor === c
                        ? `2.5px solid ${isDark ? '#fff' : '#1a1a2e'}`
                        : '2.5px solid transparent',
                    transition: 'all 0.1s',
                    '&:hover': {
                      transform: 'scale(1.15)',
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Actions */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              justifyContent: 'flex-end',
              pt: 0.5,
            }}
          >
            <Button
              size="small"
              variant="outlined"
              onClick={onClose}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                fontSize: '0.8rem',
              }}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={14} /> : undefined}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                fontSize: '0.8rem',
              }}
            >
              {t('common.save', 'Save')}
            </Button>
          </Box>
        </Box>
      )}
    </Popover>
  );
};

export default QuickLexiconEditor;
