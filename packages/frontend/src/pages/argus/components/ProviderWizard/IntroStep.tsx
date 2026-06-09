import React from 'react';
import { Box, Typography, Button, alpha } from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { WizardProviderConfig } from './types';

interface IntroStepProps {
  cfg: WizardProviderConfig;
  hasGuide: boolean;
  isDark: boolean;
  accent: string;
}

export const IntroStep: React.FC<IntroStepProps> = ({
  cfg,
  hasGuide,
  isDark,
  accent,
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
        {t(cfg.descKey)}
      </Typography>

      {hasGuide && (
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
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '14px',
              mx: 'auto',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(accent, 0.1),
              '& .MuiSvgIcon-root': { fontSize: 30, color: accent },
            }}
          >
            {cfg.icon}
          </Box>
          {cfg.guideDescKey && (
            <Typography
              sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 2.5 }}
            >
              {t(cfg.guideDescKey)}
            </Typography>
          )}
          <Button
            variant="contained"
            size="large"
            endIcon={<OpenInNewIcon />}
            href={cfg.guideUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              borderRadius: '10px',
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              py: 1.2,
              backgroundColor: accent,
              color: '#fff',
              '&:hover': { backgroundColor: alpha(accent, 0.85) },
            }}
          >
            {t(
              cfg.guideButtonKey || 'argus.settings.providerWizard.openGuide',
              'Open Guide'
            )}
          </Button>
        </Box>
      )}

      {!hasGuide && (
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
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '14px',
              mx: 'auto',
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(accent, 0.1),
              '& .MuiSvgIcon-root': { fontSize: 30, color: accent },
            }}
          >
            {cfg.icon}
          </Box>
          <Typography sx={{ fontSize: '0.88rem', fontWeight: 600, mb: 1 }}>
            {cfg.name}
          </Typography>
          <Typography
            sx={{
              fontSize: '0.78rem',
              color: 'text.secondary',
              lineHeight: 1.6,
            }}
          >
            {t(
              'argus.settings.providerWizard.readyToSetup',
              'Enter connection information in the next step.'
            )}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
