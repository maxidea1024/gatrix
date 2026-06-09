import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import {
  GitHub as GitHubIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { GithubFormState } from './types';
import { CopyableUrl, PermissionItem, WizardInput } from './WizardFields';
import { ConnectionTestSection } from './ConnectionTestSection';

interface GithubWizardStepsProps {
  step: number;
  form: GithubFormState;
  onChange: (field: keyof GithubFormState, value: string) => void;
  isDark: boolean;
  baseUrl: string;
  accentColor: string;
  testing: boolean;
  testResult: { ok: boolean; name?: string; error?: string } | null;
  onTest: () => void;
}

export const GithubWizardSteps: React.FC<GithubWizardStepsProps> = ({
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

  switch (step) {
    case 0:
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
              'argus.settings.githubWizard.step1Instruction',
              'Click the button below to open GitHub Developer Settings in a new tab. Create a new GitHub App.'
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
            <GitHubIcon
              sx={{
                fontSize: 48,
                color: 'text.secondary',
                mb: 2,
                opacity: 0.5,
              }}
            />
            <Typography
              sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}
            >
              {t(
                'argus.settings.githubWizard.step1Desc',
                'Fill in the information on the GitHub App registration page to create the app.'
              )}
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<OpenInNewIcon />}
              href="https://github.com/settings/apps/new"
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
                'argus.settings.githubWizard.goToGithub',
                'Go to GitHub Settings'
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
              'argus.settings.githubWizard.step2Desc',
              'Enter the URLs below in the Homepage URL, User authorization callback URL, and Webhook URL of your GitHub App settings.'
            )}
          </Typography>
          <CopyableUrl
            label={t('argus.settings.githubWizard.homepageUrl', 'Homepage URL')}
            value={baseUrl}
            isDark={isDark}
          />
          <CopyableUrl
            label={t('argus.settings.githubWizard.callbackUrl', 'Callback URL')}
            value={`${baseUrl}/api/argus/integrations/github/callback`}
            isDark={isDark}
          />
          <CopyableUrl
            label={t('argus.settings.githubWizard.webhookUrl', 'Webhook URL')}
            value={`${baseUrl}/api/argus/webhooks/github`}
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
              'argus.settings.githubWizard.step3Desc',
              'Specify the following permissions in the Permissions & events menu of your GitHub App settings.'
            )}
          </Typography>
          <PermissionItem
            title={t(
              'argus.settings.githubWizard.permissionsTitle',
              'Repository Permissions'
            )}
            items={[
              'Contents: Read',
              'Issues: Read & Write',
              'Pull requests: Read',
            ]}
            isDark={isDark}
            color={accentColor}
          />
          <PermissionItem
            title={t(
              'argus.settings.githubWizard.eventsTitle',
              'Subscribe to Events'
            )}
            items={['Push', 'Pull Request', 'Release', 'Issues']}
            isDark={isDark}
            color={accentColor}
          />
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
              'argus.settings.githubWizard.step4Desc',
              'Enter the App ID, Client ID, Client Secret, Webhook Secret, and Private Key issued by your GitHub App.'
            )}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <WizardInput
              label={t('argus.settings.githubWizard.appId', 'App ID')}
              value={form.appId}
              onChange={(v) => onChange('appId', v)}
              isDark={isDark}
              required
            />
            <WizardInput
              label={t('argus.settings.githubWizard.clientId', 'Client ID')}
              value={form.clientId}
              onChange={(v) => onChange('clientId', v)}
              isDark={isDark}
              required
            />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <WizardInput
              label={t(
                'argus.settings.githubWizard.clientSecret',
                'Client Secret'
              )}
              value={form.clientSecret}
              onChange={(v) => onChange('clientSecret', v)}
              isDark={isDark}
              type="password"
              required
            />
            <WizardInput
              label={t(
                'argus.settings.githubWizard.webhookSecret',
                'Webhook Secret'
              )}
              value={form.webhookSecret}
              onChange={(v) => onChange('webhookSecret', v)}
              isDark={isDark}
              type="password"
            />
          </Box>
          <WizardInput
            label={t('argus.settings.githubWizard.privateKey', 'Private Key')}
            value={form.privateKey}
            onChange={(v) => onChange('privateKey', v)}
            isDark={isDark}
            multiline
            rows={5}
            required
            hint={t(
              'argus.settings.githubWizard.privateKeyHint',
              'Paste the full contents of the .pem file'
            )}
            placeholder="-----BEGIN RSA PRIVATE KEY-----"
          />

          <ConnectionTestSection
            testing={testing}
            onTest={onTest}
            testResult={testResult}
            disabled={!form.appId || !form.privateKey}
            successText={
              testResult?.ok
                ? `${t('argus.settings.providerWizard.testSuccessName', 'Connection successful! ({{name}})').replace('{{name}}', testResult.name || '')}`
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
