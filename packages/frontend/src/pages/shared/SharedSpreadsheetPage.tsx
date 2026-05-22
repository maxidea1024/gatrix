import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Chip, Button, alpha } from '@mui/material';
import LottieLoader from '@/components/common/LottieLoader';
import {
  GridOn as GridOnIcon,
  OpenInNew as OpenInNewIcon,
  Visibility as ViewerIcon,
  Edit as EditorIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import spreadsheetService from '@/services/spreadsheetService';
import type { SharePermission } from '@/services/spreadsheetService';
import SpreadsheetEditorWrapper from '@/components/spreadsheet/SpreadsheetEditorWrapper';
import { useAutoSave } from '@/hooks/useAutoSave';

const SharedSpreadsheetPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [permission, setPermission] = useState<SharePermission>('viewer');
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);

  const getSnapshotRef = useRef<(() => string | null) | null>(null);

  // Auto-save for editor mode
  const { markDirty } = useAutoSave({
    delay: 2000,
    onSave: async () => {
      if (!spreadsheetId || !getSnapshotRef.current || permission !== 'editor')
        return;
      const snapshot = getSnapshotRef.current();
      if (!snapshot) return;
      await spreadsheetService.update(spreadsheetId, { sheetData: snapshot });
    },
  });

  // Load spreadsheet by share token
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const data = await spreadsheetService.getByShareToken(token);
        if (cancelled) return;
        setTitle(data.title);
        setInitialData(data.sheetData);
        setPermission(data.permission);
        setSpreadsheetId(data.id);
      } catch {
        if (!cancelled) {
          setError(
            'This shared spreadsheet is not available or the link has expired.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleContentChange = useCallback(() => {
    if (permission === 'editor') {
      markDirty();
    }
  }, [permission, markDirty]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <LottieLoader size={80} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          gap: 2,
          bgcolor: 'background.default',
        }}
      >
        <GridOnIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography variant="h6" color="text.secondary">
          {error}
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/login')}>
          {t('common.login')}
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      {/* Minimal top bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 0.75,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 48,
          gap: 1.5,
        }}
      >
        <GridOnIcon sx={{ fontSize: 22, color: 'primary.main' }} />
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 600, flex: 1 }}
          noWrap
        >
          {title}
        </Typography>

        <Chip
          size="small"
          icon={
            permission === 'editor' ? (
              <EditorIcon sx={{ fontSize: '14px !important' }} />
            ) : (
              <ViewerIcon sx={{ fontSize: '14px !important' }} />
            )
          }
          label={
            permission === 'editor'
              ? t('spreadsheets.editor')
              : t('spreadsheets.viewer')
          }
          variant="outlined"
          color={permission === 'editor' ? 'primary' : 'default'}
          sx={{
            fontSize: '0.75rem',
            height: 26,
            fontWeight: 500,
            bgcolor: (theme) =>
              permission === 'editor'
                ? alpha(theme.palette.primary.main, 0.06)
                : 'transparent',
          }}
        />

        <Button
          size="small"
          variant="text"
          startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/login')}
          sx={{ textTransform: 'none', fontSize: '0.8rem' }}
        >
          Gatrix
        </Button>
      </Box>

      {/* Spreadsheet */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <SpreadsheetEditorWrapper
          spreadsheetId={spreadsheetId || undefined}
          initialData={initialData}
          onContentChange={handleContentChange}
          getSnapshotRef={getSnapshotRef}
          readOnly={permission === 'viewer'}
        />
      </Box>
    </Box>
  );
};

export default SharedSpreadsheetPage;
