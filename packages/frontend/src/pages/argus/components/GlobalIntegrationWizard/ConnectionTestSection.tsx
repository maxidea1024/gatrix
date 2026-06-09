import React from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ConnectionTestSectionProps {
  testing: boolean;
  onTest: () => void;
  testResult: { ok: boolean; error?: string } | null;
  disabled: boolean;
  successText: string;
  isDark: boolean;
}

export const ConnectionTestSection: React.FC<ConnectionTestSectionProps> = ({
  testing,
  onTest,
  testResult,
  disabled,
  successText,
  isDark,
}) => {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        mt: 3,
        p: 2,
        borderRadius: '10px',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: testResult ? 2 : 0,
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
            {t('argus.settings.providerWizard.testTitle', 'Test Connection')}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            {t(
              'argus.settings.providerWizard.testDesc',
              'Verify the connection status before saving (optional)'
            )}
          </Typography>
        </Box>
        <Button
          onClick={onTest}
          disabled={disabled || testing}
          variant="outlined"
          size="small"
          startIcon={
            testing ? <CircularProgress size={16} /> : <PlayArrowIcon />
          }
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {t('argus.settings.providerWizard.testBtn', 'Test Connection')}
        </Button>
      </Box>
      {testResult && (
        <Alert
          severity={testResult.ok ? 'success' : 'error'}
          sx={{ borderRadius: '8px', fontSize: '0.82rem' }}
          icon={testResult.ok ? <CheckIcon sx={{ fontSize: 18 }} /> : undefined}
        >
          {testResult.ok
            ? successText
            : `${t('argus.settings.providerWizard.testFailed', 'Connection failed')}: ${testResult.error}`}
        </Alert>
      )}
    </Box>
  );
};
