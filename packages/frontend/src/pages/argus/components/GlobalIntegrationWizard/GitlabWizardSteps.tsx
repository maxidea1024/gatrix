import React from 'react';
import { Box, Typography, Button, alpha } from '@mui/material';
import { Cloud as GitLabIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { GitlabFormState } from './types';
import { CopyableUrl, PermissionItem, WizardInput } from './WizardFields';
import { ConnectionTestSection } from './ConnectionTestSection';

interface GitlabWizardStepsProps {
  step: number;
  form: GitlabFormState;
  onChange: (field: keyof GitlabFormState, value: string) => void;
  isDark: boolean;
  baseUrl: string;
  accentColor: string;
  testing: boolean;
  testResult: { ok: boolean; message?: string; error?: string } | null;
  onTest: () => void;
}

export const GitlabWizardSteps: React.FC<GitlabWizardStepsProps> = ({
  step,
  form,
  onChange,
  isDark,
  baseUrl,
  accentColor,
  testing,
  testResult,
  onTest,
}) => {
  const { t } = useTranslation();
  const instanceUrl = form.instanceUrl || 'https://gitlab.com';

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
              'argus.settings.gitlabWizard.step1Instruction',
              'Click below to open your GitLab instance settings. Register a new OAuth Application.'
            )}
          </Typography>
          <WizardInput
            label={t('argus.settings.gitlabWizard.instanceUrl', 'GitLab Instance URL')}
            value={form.instanceUrl}
            onChange={(v) => onChange('instanceUrl', v)}
            isDark={isDark}
            required
            hint={t(
              'argus.settings.gitlabWizard.instanceUrlHint',
              'e.g. https://gitlab.com or your self-hosted GitLab domain'
            )}
            placeholder="https://gitlab.com"
          />
          <Box
            sx={{
              p: 3,
              borderRadius: '12px',
              textAlign: 'center',
              mt: 1,
              border: `2px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.01)',
            }}
          >
            <GitLabIcon
              sx={{ fontSize: 48, color: '#fc6d26', mb: 2, opacity: 0.6 }}
            />
            <Typography
              sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}
            >
              {t(
                'argus.settings.gitlabWizard.step1Desc',
                'Create a new app on the GitLab Application registration page.'
              )}
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<OpenInNewIcon />}
              href={`${instanceUrl}/-/profile/applications`}
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
              {t('argus.settings.gitlabWizard.goToGitlab', 'Open GitLab Applications')}
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
              'argus.settings.gitlabWizard.step2Desc',
              'Enter the URLs below in the Redirect URI and Webhook URL of your GitLab Application settings.'
            )}
          </Typography>
          <CopyableUrl
            label={t('argus.settings.gitlabWizard.redirectUri', 'Redirect URI')}
            value={`${baseUrl}/api/argus/integrations/gitlab/callback`}
            isDark={isDark}
          />
          <CopyableUrl
            label={t('argus.settings.gitlabWizard.webhookUrl', 'Webhook URL')}
            value={`${baseUrl}/api/argus/webhooks/gitlab`}
            isDark={isDark}
          />
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
              'argus.settings.gitlabWizard.step3Desc',
              'Specify the following scopes in the Scopes menu of your GitLab Application settings.'
            )}
          </Typography>
          <PermissionItem
            title={t(
              'argus.settings.gitlabWizard.scopesTitle',
              'Required Scopes'
            )}
            items={['api', 'read_user', 'read_repository']}
            isDark={isDark}
            color={accentColor}
          />
          <Box
            sx={{
              mt: 2,
              p: 2,
              borderRadius: '8px',
              backgroundColor: alpha('#fc6d26', 0.06),
              border: `1px solid ${alpha('#fc6d26', 0.15)}`,
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
                'argus.settings.gitlabWizard.step3Hint',
                '💡 Check the Confidential option and uncheck Expire access tokens.'
              )}
            </Typography>
          </Box>
        </Box>
      );
    case 3:
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
              'argus.settings.gitlabWizard.step4Desc',
              'Enter the Application ID and Secret issued by GitLab.'
            )}
          </Typography>
          <WizardInput
            label={t('argus.settings.gitlabWizard.applicationId', 'Application ID')}
            value={form.applicationId}
            onChange={(v) => onChange('applicationId', v)}
            isDark={isDark}
            required
          />
          <WizardInput
            label={t(
              'argus.settings.gitlabWizard.applicationSecret',
              'Application Secret'
            )}
            value={form.applicationSecret}
            onChange={(v) => onChange('applicationSecret', v)}
            isDark={isDark}
            type="password"
            required
          />
          <WizardInput
            label={t('argus.settings.gitlabWizard.webhookSecret', 'Webhook Secret')}
            value={form.webhookSecret}
            onChange={(v) => onChange('webhookSecret', v)}
            isDark={isDark}
            type="password"
            hint={t('argus.settings.providerWizard.testDescOptional', 'Optional but recommended for security')}
          />

          <ConnectionTestSection
            testing={testing}
            onTest={onTest}
            testResult={testResult}
            disabled={!form.applicationId || !form.applicationSecret}
            successText={
              testResult?.ok
                ? `${t('argus.settings.providerWizard.testSuccessName', 'Connection successful! ({{name}})').replace('{{name}}', testResult.message || '')}`
                : ''
            }
            isDark={isDark}
          />
        </Box>
      );
    default:
      return null;
  }
};
