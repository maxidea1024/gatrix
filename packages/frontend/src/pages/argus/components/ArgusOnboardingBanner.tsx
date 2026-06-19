import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  alpha,
  useTheme,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  Code as CodeIcon,
  BugReport as TrackerIcon,
  Notifications as NotifIcon,
  ArrowForward as ArrowIcon,
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface OnboardingStep {
  icon: React.ReactNode;
  titleKey: string;
  descKey: string;
  actionKey: string;
  to: string;
  done: boolean;
  accentColor: string;
}

interface ArgusOnboardingBannerProps {
  projectId: string;
  /** SDK DSN이 설정되어 있는지 여부 */
  hasSdk?: boolean;
  /** 이슈 트래커 연결 수 */
  trackerCount?: number;
  /** 알림 채널 연결 수 */
  notifCount?: number;
  /** 배너를 숨기는 콜백 (부모에서 localStorage 처리) */
  onDismiss?: () => void;
}

const ArgusOnboardingBanner: React.FC<ArgusOnboardingBannerProps> = ({
  projectId,
  hasSdk = false,
  trackerCount = 0,
  notifCount = 0,
  onDismiss,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const [visible, setVisible] = useState(true);

  const steps: OnboardingStep[] = [
    {
      icon: <CodeIcon />,
      titleKey: 'argus.onboarding.step1.title',
      descKey: 'argus.onboarding.step1.desc',
      actionKey: 'argus.onboarding.step1.action',
      to: `/argus/settings#sdk-setup`,
      done: hasSdk,
      accentColor: '#7c4dff',
    },
    {
      icon: <TrackerIcon />,
      titleKey: 'argus.onboarding.step2.title',
      descKey: 'argus.onboarding.step2.desc',
      actionKey: 'argus.onboarding.step2.action',
      to: `/argus/settings#issue-trackers`,
      done: trackerCount > 0,
      accentColor: '#0052CC',
    },
    {
      icon: <NotifIcon />,
      titleKey: 'argus.onboarding.step3.title',
      descKey: 'argus.onboarding.step3.desc',
      actionKey: 'argus.onboarding.step3.action',
      to: `/argus/settings#notifications`,
      done: notifCount > 0,
      accentColor: '#00897b',
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  const handleDismiss = () => {
    setVisible(false);
    onDismiss?.();
  };

  if (allDone) return null;

  return (
    <Collapse in={visible} unmountOnExit>
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 0,
          overflow: 'hidden',
          position: 'relative',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: theme.palette.background.paper,
          transition: 'all 0.3s ease',
        }}
      >
        {/* Content Body */}
        <Box sx={{ p: { xs: 2.5, sm: 3 }, position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              mb: 3,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  mb: 0.5,
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  sx={{
                    color: theme.palette.text.primary,
                    fontSize: '0.95rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {t(
                    'argus.onboarding.title',
                    'Complete your Argus setup to start monitoring'
                  )}
                </Typography>
                <Box
                  sx={{
                    px: 1.2,
                    py: 0.3,
                    borderRadius: '20px',
                    background: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                    fontWeight: 700,
                    fontSize: '0.68rem',
                    flexShrink: 0,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                  }}
                >
                  {t('argus.onboarding.stepOf', '{{current}} / {{total}}', {
                    current: completedCount,
                    total: steps.length,
                  })}
                </Box>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '0.8rem',
                  lineHeight: 1.5,
                  maxWidth: '800px',
                }}
              >
                {t(
                  'argus.onboarding.desc',
                  'No issue trackers are connected yet. Complete 3 steps to instantly create issues when errors occur.'
                )}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{
                ml: 2,
                mt: -0.5,
                opacity: 0.5,
                color: theme.palette.text.secondary,
                transition: 'all 0.2s',
                '&:hover': {
                  opacity: 1,
                  backgroundColor: theme.palette.action.hover,
                },
                flexShrink: 0,
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>

          {/* Stepper Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(3, 1fr)',
              },
              gap: 2,
            }}
          >
            {steps.map((step, idx) => (
              <Box
                key={idx}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${
                    step.done
                      ? alpha(theme.palette.success.main, 0.25)
                      : theme.palette.divider
                  }`,
                  background: step.done
                    ? alpha(theme.palette.success.main, isDark ? 0.05 : 0.03)
                    : isDark
                      ? alpha(theme.palette.background.default, 0.4)
                      : theme.palette.background.default,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  opacity: step.done ? 0.8 : 1,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: step.done ? 'none' : 'translateY(-2px)',
                    borderColor: step.done
                      ? undefined
                      : theme.palette.primary.main,
                  },
                }}
              >
                {/* Step Header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: step.done
                        ? alpha(theme.palette.success.main, 0.1)
                        : alpha(theme.palette.primary.main, 0.08),
                      color: step.done
                        ? theme.palette.success.main
                        : theme.palette.primary.main,
                      transition: 'all 0.2s ease',
                      flexShrink: 0,
                    }}
                  >
                    {React.cloneElement(step.icon as React.ReactElement, {
                      sx: { fontSize: 16 },
                    })}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      fontWeight={700}
                      noWrap
                      sx={{
                        color: step.done
                          ? theme.palette.success.main
                          : theme.palette.text.primary,
                        display: 'block',
                        fontSize: '0.78rem',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {t(step.titleKey)}
                    </Typography>
                  </Box>
                  {step.done ? (
                    <CheckIcon
                      sx={{
                        fontSize: 18,
                        color: theme.palette.success.main,
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <UncheckedIcon
                      sx={{
                        fontSize: 18,
                        color: theme.palette.text.disabled,
                        flexShrink: 0,
                      }}
                    />
                  )}
                </Box>

                {/* Step Description */}
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.text.secondary,
                    fontSize: '0.74rem',
                    lineHeight: 1.4,
                  }}
                >
                  {t(step.descKey)}
                </Typography>

                {/* Step Button */}
                {!step.done && (
                  <Button
                    size="small"
                    variant="contained"
                    endIcon={<ArrowIcon sx={{ fontSize: 13 }} />}
                    onClick={() => navigate(step.to)}
                    sx={{
                      mt: 'auto',
                      borderRadius: 1.5,
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      py: 0.5,
                      px: 1.5,
                      textTransform: 'none',
                      background: theme.palette.primary.main,
                      color: theme.palette.primary.contrastText,
                      transition: 'all 0.2s ease',
                      boxShadow: 'none',
                      '&:hover': {
                        background: theme.palette.primary.dark,
                        boxShadow: 'none',
                      },
                    }}
                  >
                    {t(step.actionKey)}
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Paper>
    </Collapse>
  );
};

export default ArgusOnboardingBanner;
