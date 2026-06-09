import React from 'react';
import { Box, Typography, Button, alpha, CircularProgress, Alert } from '@mui/material';
import { Chat as SlackIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { SlackFormState } from './types';
import { PermissionItem, WizardInput } from './WizardFields';

interface SlackWizardStepsProps {
  step: number;
  form: SlackFormState;
  onChange: (field: keyof SlackFormState, value: string) => void;
  isDark: boolean;
  accentColor: string;
  testing: boolean;
  testResult: { ok: boolean; team?: string; error?: string } | null;
  onTest: () => void;
}

export const SlackWizardSteps: React.FC<SlackWizardStepsProps> = ({
  step,
  form,
  onChange,
  isDark,
  accentColor,
  testing,
  testResult,
  onTest,
}) => {
  const { t } = useTranslation();

  switch (step) {
    case 0:
      return (
        <Box>
          <Typography
            sx={{
              fontSize: '0.88rem',
              lineHeight: 1.7,
              color: 'text.secondary',
              mb: 2,
            }}
          >
            {t(
              'argus.settings.slackWizard.step1Instruction',
              'Go to Slack API Dashboard to create a new Slack App for your workspace.'
            )}
          </Typography>
          <Box
            sx={{
              p: 3,
              borderRadius: '12px',
              textAlign: 'center',
              border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.01)',
            }}
          >
            <SlackIcon
              sx={{ fontSize: 48, color: '#36C5F0', mb: 2, opacity: 0.7 }}
            />
            <Typography
              sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}
            >
              {t(
                'argus.settings.slackWizard.step1Desc',
                'Create a new Slack App from the "From scratch" option.'
              )}
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<OpenInNewIcon />}
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 700,
                px: 4,
                py: 1.2,
                backgroundColor: '#58a6ff',
                color: '#fff',
                '&:hover': { backgroundColor: '#4090e0' },
              }}
            >
              {t(
                'argus.settings.slackWizard.goToSlack',
                'Open Slack API Dashboard'
              )}
            </Button>
          </Box>
        </Box>
      );
    case 1:
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
              'argus.settings.slackWizard.step2Desc',
              'Navigate to OAuth & Permissions and add the following Bot Token Scopes:'
            )}
          </Typography>
          <PermissionItem
            title={t('argus.settings.slackWizard.botScopes', 'Bot Token Scopes')}
            items={[
              'chat:write',
              'channels:read',
              'groups:read',
              'chat:write.customize',
            ]}
            isDark={isDark}
            color={accentColor}
          />
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: '8px',
              backgroundColor: alpha(accentColor, 0.06),
              border: `1px solid ${alpha(accentColor, 0.15)}`,
            }}
          >
            <Typography
              sx={{
                fontSize: '0.78rem',
                color: 'text.secondary',
                lineHeight: 1.6,
              }}
            >
              {t(
                'argus.settings.slackWizard.step2Hint',
                'After adding scopes, click "Install to Workspace" and authorize. Then copy the Bot User OAuth Token (starts with xoxb-).'
              )}
            </Typography>
          </Box>
        </Box>
      );
    case 2:
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
              'argus.settings.slackWizard.step3Desc',
              'Paste the Bot User OAuth Token and optionally the Signing Secret.'
            )}
          </Typography>
          <WizardInput
            label={t('argus.settings.slackWizard.botToken', 'Bot User OAuth Token')}
            value={form.botToken}
            onChange={(v) => onChange('botToken', v)}
            isDark={isDark}
            type="password"
            required
            placeholder="xoxb-..."
            hint={t(
              'argus.settings.slackWizard.botTokenHint',
              'Found in OAuth & Permissions after installing the app to your workspace'
            )}
          />
          <WizardInput
            label={t('argus.settings.slackWizard.signingSecret', 'Signing Secret')}
            value={form.signingSecret}
            onChange={(v) => onChange('signingSecret', v)}
            isDark={isDark}
            type="password"
            hint={t(
              'argus.settings.slackWizard.signingSecretHint',
              'Optional. Found in Basic Information > App Credentials'
            )}
          />
          <Button
            variant="contained"
            size="small"
            disabled={!form.botToken || testing}
            onClick={onTest}
            startIcon={
              testing ? (
                <CircularProgress size={14} color="inherit" />
              ) : undefined
            }
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              backgroundColor: '#58a6ff',
              color: '#fff',
              '&:hover': { backgroundColor: '#4090e0' },
            }}
          >
            {t('argus.settings.slackWizard.testConnection', 'Test Connection')}
          </Button>
          {testResult && (
            <Alert
              severity={testResult.ok ? 'success' : 'error'}
              sx={{ mt: 2, borderRadius: '8px' }}
            >
              {testResult.ok
                ? t('argus.settings.slackWizard.testSuccess', 'Connected to {{team}}').replace('{{team}}', testResult.team || 'Slack')
                : `${t('argus.settings.slackWizard.testFailed', 'Connection failed')}: ${testResult.error}`}
            </Alert>
          )}
        </Box>
      );
    default:
      return null;
  }
};
