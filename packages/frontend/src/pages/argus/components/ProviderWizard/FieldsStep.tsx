import React from 'react';
import {
  Box,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  alpha,
} from '@mui/material';
import {
  Check as CheckIcon,
  PlayArrow as TestIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { WizardFieldDef } from './types';
import { WizardInput } from './WizardFields';

interface FieldsStepProps {
  fieldsToRender: WizardFieldDef[];
  formData: Record<string, string>;
  onChange: (key: string, value: string) => void;
  isDark: boolean;
  accent: string;
  showTest?: boolean;
  onTestConnection?: (data: Record<string, string>) => Promise<{ ok: boolean; message: string }>;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
  onTest: () => void;
  canProceed: boolean;
}

export const FieldsStep: React.FC<FieldsStepProps> = ({
  fieldsToRender,
  formData,
  onChange,
  isDark,
  accent,
  showTest = false,
  onTestConnection,
  testing,
  testResult,
  onTest,
  canProceed,
}) => {
  const { t } = useTranslation();

  return (
    <Box>
      <Typography
        sx={{
          fontSize: '0.88rem',
          lineHeight: 1.7,
          color: 'text.secondary',
          mb: 3,
        }}
      >
        {t(
          'argus.settings.providerWizard.fillFields',
          'Fill out the fields below to complete integration.'
        )}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {fieldsToRender.map((f) => {
          if (f.type === 'select' && f.options) {
            return (
              <Box key={f.key} sx={{ mb: 2 }}>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    mb: 0.5,
                  }}
                >
                  {t(f.labelKey, f.labelFallback)}
                  {f.required && (
                    <Box component="span" sx={{ color: '#ef4444' }}>
                      {' '}
                      *
                    </Box>
                  )}
                </Typography>
                <FormControl size="small" fullWidth>
                  <Select
                    value={formData[f.key] || ''}
                    onChange={(e) => onChange(f.key, e.target.value)}
                    displayEmpty
                    sx={{
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      backgroundColor: isDark
                        ? 'rgba(255,255,255,0.04)'
                        : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <MenuItem value="" disabled>
                      <Typography
                        sx={{ color: 'text.disabled', fontSize: '0.85rem' }}
                      >
                        {f.placeholder}
                      </Typography>
                    </MenuItem>
                    {f.options.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {f.hint && (
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      color: 'text.disabled',
                      mt: 0.4,
                      fontStyle: 'italic',
                    }}
                  >
                    {f.hint}
                  </Typography>
                )}
              </Box>
            );
          }
          return (
            <WizardInput
              key={f.key}
              label={t(f.labelKey, f.labelFallback)}
              value={formData[f.key] || ''}
              onChange={(v) => onChange(f.key, v)}
              isDark={isDark}
              type={f.type}
              placeholder={f.placeholder}
              hint={f.hint}
              required={
                f.required !== false && (f.key === 'name' || !!f.required)
              }
            />
          );
        })}
      </Box>

      {/* ─── Connection Test Section ─── */}
      {showTest && onTestConnection && (
        <Box
          sx={{
            mt: 3,
            p: 2.5,
            borderRadius: '12px',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(0,0,0,0.01)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: testResult ? 1.5 : 0,
            }}
          >
            <Box>
              <Typography
                sx={{ fontSize: '0.82rem', fontWeight: 700, mb: 0.3 }}
              >
                {t(
                  'argus.settings.providerWizard.testConnection',
                  'Test Connection'
                )}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>
                {t(
                  'argus.settings.providerWizard.testHint',
                  'Verify connection status before saving (optional)'
                )}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={onTest}
              disabled={testing || !canProceed}
              startIcon={
                testing ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <TestIcon sx={{ fontSize: 16 }} />
                )
              }
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                px: 2,
                py: 0.6,
                borderColor: testResult?.ok
                  ? '#4caf50'
                  : isDark
                    ? 'rgba(255,255,255,0.15)'
                    : 'rgba(0,0,0,0.12)',
                color: testResult?.ok ? '#4caf50' : 'text.secondary',
                '&:hover': {
                  borderColor: testResult?.ok ? '#4caf50' : accent,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(0,0,0,0.03)',
                },
              }}
            >
              {testing
                ? t('argus.settings.providerWizard.testing', 'Testing...')
                : testResult?.ok
                  ? t('argus.settings.providerWizard.testAgain', 'Test Again')
                  : t(
                      'argus.settings.providerWizard.testConnection',
                      'Test Connection'
                    )}
            </Button>
          </Box>
          {testResult && (
            <Alert
              severity={testResult.ok ? 'success' : 'error'}
              sx={{ borderRadius: '8px', fontSize: '0.82rem' }}
              icon={
                testResult.ok ? <CheckIcon sx={{ fontSize: 18 }} /> : undefined
              }
            >
              {testResult.ok
                ? t(
                    'argus.settings.providerWizard.testSuccess',
                    'Test message sent successfully'
                  )
                : (() => {
                    const msg = testResult.message;
                    if (msg === 'Invalid Slack Webhook URL format')
                      return t(
                        'argus.settings.providerWizard.invalidSlackUrl',
                        msg
                      );
                    if (msg === 'Invalid Discord Webhook URL format')
                      return t(
                        'argus.settings.providerWizard.invalidDiscordUrl',
                        msg
                      );
                    if (msg === 'Invalid MSTeams Webhook URL format')
                      return t(
                        'argus.settings.providerWizard.invalidMSTeamsUrl',
                        msg
                      );
                    if (msg === 'Webhook URL is required')
                      return t(
                        'argus.settings.providerWizard.webhookUrlRequired',
                        msg
                      );
                    return t(msg, msg);
                  })()}
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};
