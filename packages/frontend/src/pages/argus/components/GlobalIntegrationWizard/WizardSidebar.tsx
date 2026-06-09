import React from 'react';
import { Box, Typography, alpha } from '@mui/material';
import { Check as CheckIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { StepDef } from './providerConfig';

interface WizardSidebarProps {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'slack';
  activeStep: number;
  cfg: {
    name: string;
    gradient: string;
    accentColor: string;
    icon: React.ReactNode;
    titleKey: string;
    subtitleKey: string;
    steps: StepDef[];
  };
  isDark: boolean;
}

export const WizardSidebar: React.FC<WizardSidebarProps> = ({
  provider,
  activeStep,
  cfg,
  isDark,
}) => {
  const { t } = useTranslation();
  const totalSteps = cfg.steps.length;

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        flexShrink: 0,
        background: cfg.gradient,
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative elements */}
      <Box
        sx={{
          position: 'absolute',
          top: -50,
          right: -50,
          width: 160,
          height: 160,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(cfg.accentColor, 0.12)} 0%, transparent 70%)`,
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -70,
          left: -40,
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(cfg.accentColor, 0.08)} 0%, transparent 70%)`,
        }}
      />

      {/* Provider Header */}
      <Box sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.12)',
              '& .MuiSvgIcon-root': { fontSize: 22, color: '#fff' },
            }}
          >
            {cfg.icon}
          </Box>
          <Box>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '1rem',
                letterSpacing: '-0.02em',
              }}
            >
              {t(cfg.titleKey, cfg.name)}
            </Typography>
          </Box>
        </Box>
        <Typography
          sx={{ fontSize: '0.72rem', opacity: 0.55, lineHeight: 1.5, mt: 1 }}
        >
          {t(cfg.subtitleKey)}
        </Typography>
      </Box>

      {/* Vertical Steps */}
      <Box sx={{ flex: 1, px: 3, py: 1 }}>
        {cfg.steps.map((step, idx) => {
          const isActive = idx === activeStep;
          const isCompleted = idx < activeStep;
          return (
            <Box
              key={idx}
              sx={{ display: 'flex', gap: 1.5, position: 'relative' }}
            >
              {/* Vertical connector line */}
              {idx < totalSteps - 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 15,
                    top: 32,
                    width: 2,
                    height: 'calc(100% - 16px)',
                    zIndex: 0,
                    backgroundColor: isCompleted
                      ? alpha(cfg.accentColor, 0.5)
                      : 'rgba(255,255,255,0.08)',
                    transition: 'background-color 0.3s',
                  }}
                />
              )}
              {/* Step circle */}
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  zIndex: 1,
                  transition: 'all 0.3s ease',
                  ...(isCompleted
                    ? {
                        backgroundColor: cfg.accentColor,
                        color: '#fff',
                      }
                    : isActive
                      ? {
                          backgroundColor: '#1e3a5f',
                          border: `2px solid ${cfg.accentColor}`,
                          color: '#fff',
                          boxShadow: `0 0 0 4px ${alpha(cfg.accentColor, 0.15)}`,
                        }
                      : {
                          backgroundColor: '#1a2030',
                          border: '2px solid #2a3444',
                          color: 'rgba(255,255,255,0.3)',
                        }),
                }}
              >
                {isCompleted ? <CheckIcon sx={{ fontSize: 16 }} /> : idx + 1}
              </Box>
              {/* Step text */}
              <Box sx={{ py: 0.5, pb: 3 }}>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.3s',
                    lineHeight: 1.3,
                  }}
                >
                  {t(step.titleKey)}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.65rem',
                    mt: 0.3,
                    color: isActive
                      ? 'rgba(255,255,255,0.5)'
                      : 'rgba(255,255,255,0.2)',
                    transition: 'all 0.3s',
                  }}
                >
                  {t(step.subtitleKey)}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Bottom progress */}
      <Box sx={{ px: 3, pb: 3 }}>
        <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
          {cfg.steps.map((_, idx) => (
            <Box
              key={idx}
              sx={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                backgroundColor:
                  idx <= activeStep
                    ? cfg.accentColor
                    : 'rgba(255,255,255,0.08)',
                transition: 'background-color 0.3s',
              }}
            />
          ))}
        </Box>
        <Typography
          sx={{ fontSize: '0.65rem', opacity: 0.4, textAlign: 'center' }}
        >
          {activeStep + 1} / {totalSteps}
        </Typography>
      </Box>
    </Box>
  );
};
