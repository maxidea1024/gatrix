import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  Alert,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { WhitelistService } from '../../services/whitelistService';

interface WhitelistTestResult {
  isAllowed: boolean;
  matchedRules: Array<{
    type: 'account' | 'ip';
    rule: string;
    reason: string;
  }>;
}

const WhitelistOverview: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Test state
  const [testAccountId, setTestAccountId] = useState('');
  const [testIpAddress, setTestIpAddress] = useState('');
  const [testResult, setTestResult] = useState<WhitelistTestResult | null>(
    null
  );
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!testAccountId && !testIpAddress) {
      enqueueSnackbar(t('whitelist.overview.testWarning'), {
        variant: 'warning',
      });
      return;
    }

    try {
      setTesting(true);
      const result = await WhitelistService.testWhitelist({
        accountId: testAccountId || undefined,
        ipAddress: testIpAddress || undefined,
      });
      setTestResult(result);
    } catch (error) {
      console.error('Failed to test whitelist:', error);
      enqueueSnackbar(t('whitelist.overview.testFailed'), { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  // Reset function
  const handleReset = () => {
    setTestAccountId('');
    setTestIpAddress('');
    setTestResult(null);
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      {/* Header */}
      <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
        {t('whitelist.overview.testTitle')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        {t('whitelist.overview.testDescription')}
      </Typography>

      {/* Form Card */}
      <Card
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'hidden', mb: 2.5 }}
      >
        {/* Form Fields */}
        <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            fullWidth
            label={t('whitelist.overview.testAccountId')}
            value={testAccountId}
            onChange={(e) => setTestAccountId(e.target.value)}
            placeholder="예: 28004430"
            size="small"
            helperText={t('whitelist.overview.testAccountIdHelp')}
          />
          <TextField
            fullWidth
            label={t('whitelist.overview.testIpAddress')}
            value={testIpAddress}
            onChange={(e) => setTestIpAddress(e.target.value)}
            placeholder="예: 127.0.0.1"
            size="small"
            helperText={t('whitelist.overview.testIpAddressHelp')}
          />
        </Box>

        {/* Action Footer */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.02)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button
            variant="text"
            onClick={handleReset}
            disabled={testing}
            size="small"
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            {t('common.reset')}
          </Button>
          <Button
            variant="contained"
            onClick={handleTest}
            disabled={testing || (!testAccountId && !testIpAddress)}
            startIcon={
              testing ? <CircularProgress size={16} /> : <SearchIcon />
            }
            size="small"
            sx={{ textTransform: 'none', fontWeight: 600, minWidth: 100 }}
          >
            {testing
              ? t('common.testing')
              : t('whitelist.overview.testButton')}
          </Button>
        </Box>
      </Card>

      {/* Results */}
      {testResult && (
        <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 2.5 }}>
            <Alert
              severity={testResult.isAllowed ? 'success' : 'error'}
              icon={
                testResult.isAllowed ? (
                  <CheckCircleIcon />
                ) : (
                  <CancelIcon />
                )
              }
              sx={{
                borderRadius: 1.5,
                '& .MuiAlert-message': { width: '100%' },
              }}
            >
              <Typography variant="subtitle2" fontWeight={600}>
                {testResult.isAllowed
                  ? t('whitelist.overview.testAllowed')
                  : t('whitelist.overview.testDenied')}
              </Typography>
            </Alert>

            {testResult.matchedRules.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  fontWeight={700}
                  sx={{
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    mb: 1,
                    display: 'block',
                  }}
                >
                  {t('whitelist.overview.matchedRules')}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {testResult.matchedRules.map((rule, index) => (
                    <Chip
                      key={index}
                      label={`${rule.type === 'account' ? t('whitelist.overview.accountRule') : t('whitelist.overview.ipRule')}: ${rule.rule}`}
                      color={
                        rule.type === 'account' ? 'primary' : 'secondary'
                      }
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Card>
      )}
    </Box>
  );
};

export default WhitelistOverview;
