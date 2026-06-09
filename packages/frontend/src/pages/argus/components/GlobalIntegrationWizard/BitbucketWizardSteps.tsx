import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Storage as BitbucketIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { BitbucketFormState } from './types';
import { PermissionItem, WizardInput } from './WizardFields';
import { ConnectionTestSection } from './ConnectionTestSection';

interface BitbucketWizardStepsProps {
  step: number;
  form: BitbucketFormState;
  onChange: (field: keyof BitbucketFormState, value: string) => void;
  isDark: boolean;
  accentColor: string;
  testing: boolean;
  testResult: { ok: boolean; display_name?: string; error?: string } | null;
  onTest: () => void;
}

export const BitbucketWizardSteps: React.FC<BitbucketWizardStepsProps> = ({
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
              'argus.settings.bitbucketWizard.step1Instruction',
              'Create a new App Password in Bitbucket\'s App Passwords page.'
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
            <BitbucketIcon
              sx={{ fontSize: 48, color: '#0052CC', mb: 2, opacity: 0.6 }}
            />
            <Typography
              sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2 }}
            >
              {t(
                'argus.settings.bitbucketWizard.step1Desc',
                'Go to Personal Settings > App passwords to create a new password.'
              )}
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<OpenInNewIcon />}
              href="https://bitbucket.org/account/settings/app-passwords/"
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
                'argus.settings.bitbucketWizard.goToBitbucket',
                'Open Bitbucket App Passwords'
              )}
            </Button>
          </Box>
          <Box sx={{ mt: 2.5 }}>
            <PermissionItem
              title={t(
                'argus.settings.bitbucketWizard.permissionsTitle',
                'Required Permissions'
              )}
              items={[
                'Repositories: Read',
                'Pull requests: Read',
                'Issues: Read',
              ]}
              isDark={isDark}
              color={accentColor}
            />
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
              'argus.settings.bitbucketWizard.step2Desc',
              'Enter the Bitbucket workspace, username, and the created App Password.'
            )}
          </Typography>
          <WizardInput
            label={t('argus.settings.bitbucketWizard.workspace', 'Workspace')}
            value={form.workspace}
            onChange={(v) => onChange('workspace', v)}
            isDark={isDark}
            required
            placeholder=""
            hint={t(
              'argus.settings.bitbucketWizard.workspaceHint',
              'Workspace slug from the Bitbucket URL (e.g. bitbucket.org/my-workspace)'
            )}
          />
          <WizardInput
            label={t('argus.settings.bitbucketWizard.username', 'Username')}
            value={form.username}
            onChange={(v) => onChange('username', v)}
            isDark={isDark}
            required
            placeholder=""
          />
          <WizardInput
            label={t('argus.settings.bitbucketWizard.appPassword', 'App Password')}
            value={form.appPassword}
            onChange={(v) => onChange('appPassword', v)}
            isDark={isDark}
            type="password"
            required
            hint={t(
              'argus.settings.bitbucketWizard.appPasswordHint',
              'Paste the App Password you just created'
            )}
          />

          <ConnectionTestSection
            testing={testing}
            onTest={onTest}
            testResult={testResult}
            disabled={!form.username || !form.appPassword}
            successText={
              testResult?.ok
                ? `${t('argus.settings.providerWizard.testSuccessName', 'Connection successful! ({{name}})').replace('{{name}}', testResult.display_name || '')}`
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
