/**
 * IssueDetailTour — G43: Onboarding guided tour for Issue Detail page.
 *
 * Highlights key areas of the issue detail page for first-time visitors:
 * stacktrace, breadcrumbs, sidebar, event navigation, etc.
 * Uses a simple step-based overlay approach.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Paper, Button, IconButton,
  Stepper, Step, StepLabel, alpha, useTheme,
  Backdrop,
} from '@mui/material';
import {
  Close as CloseIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Tour as TourIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface TourStep {
  target: string;       // CSS selector for the target element
  title: string;        // i18n key for step title
  description: string;  // i18n key for step description
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface IssueDetailTourProps {
  onComplete?: () => void;
}

const STORAGE_KEY = 'argus.tour.issueDetail.completed';

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="stacktrace"]',
    title: 'argus.tour.stacktrace.title',
    description: 'argus.tour.stacktrace.description',
    placement: 'top',
  },
  {
    target: '[data-tour="breadcrumbs"]',
    title: 'argus.tour.breadcrumbs.title',
    description: 'argus.tour.breadcrumbs.description',
    placement: 'top',
  },
  {
    target: '[data-tour="event-nav"]',
    title: 'argus.tour.eventNav.title',
    description: 'argus.tour.eventNav.description',
    placement: 'bottom',
  },
  {
    target: '[data-tour="sidebar"]',
    title: 'argus.tour.sidebar.title',
    description: 'argus.tour.sidebar.description',
    placement: 'left',
  },
  {
    target: '[data-tour="actions"]',
    title: 'argus.tour.actions.title',
    description: 'argus.tour.actions.description',
    placement: 'bottom',
  },
];

const IssueDetailTour: React.FC<IssueDetailTourProps> = ({ onComplete }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Auto-start after 1s delay on first visit
      const timer = setTimeout(() => setActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = useCallback(() => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete?.();
  }, [onComplete]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  // Start tour manually
  const startTour = useCallback(() => {
    setCurrentStep(0);
    setActive(true);
  }, []);

  if (!active) {
    // Show a small "Take Tour" button
    return (
      <Button
        size="small"
        startIcon={<TourIcon sx={{ fontSize: 14 }} />}
        onClick={startTour}
        sx={{
          position: 'fixed',
          bottom: 16, right: 16,
          zIndex: 1000,
          textTransform: 'none',
          fontSize: '0.72rem',
          fontWeight: 600,
          borderRadius: '20px',
          px: 2,
          backgroundColor: alpha(theme.palette.primary.main, 0.1),
          color: theme.palette.primary.main,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, 0.15),
          },
          display: localStorage.getItem(STORAGE_KEY) ? 'none' : 'inline-flex',
        }}
      >
        {t('argus.tour.startTour')}
      </Button>
    );
  }

  const step = TOUR_STEPS[currentStep];

  return (
    <>
      <Backdrop
        open={active}
        sx={{ zIndex: 1300, backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={handleSkip}
      />

      {/* Tour tooltip */}
      <Paper
        elevation={8}
        sx={{
          position: 'fixed',
          bottom: '50%', left: '50%',
          transform: 'translate(-50%, 50%)',
          zIndex: 1400,
          width: 380, maxWidth: '90vw',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2.5, py: 1.5,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.primary.main, 0.05)})`,
        }}>
          <TourIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, flex: 1 }}>
            {t(step.title)}
          </Typography>
          <IconButton size="small" onClick={handleSkip} sx={{ width: 24, height: 24 }}>
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.5 }}>
            {t(step.description)}
          </Typography>
        </Box>

        {/* Stepper */}
        <Box sx={{ px: 2.5, pb: 1 }}>
          <Stepper activeStep={currentStep} alternativeLabel>
            {TOUR_STEPS.map((_, idx) => (
              <Step key={idx}>
                <StepLabel
                  StepIconProps={{
                    sx: { fontSize: 16, '&.Mui-active': { color: theme.palette.primary.main } },
                  }}
                />
              </Step>
            ))}
          </Stepper>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, pb: 2 }}>
          <Button
            size="small"
            onClick={handleSkip}
            sx={{ textTransform: 'none', fontSize: '0.72rem', color: 'text.secondary' }}
          >
            {t('argus.tour.skip')}
          </Button>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={handlePrev} disabled={currentStep === 0}>
            <PrevIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <Button
            size="small"
            variant="contained"
            onClick={handleNext}
            endIcon={currentStep < TOUR_STEPS.length - 1 ? <NextIcon sx={{ fontSize: 14 }} /> : undefined}
            sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: '8px', px: 2 }}
          >
            {currentStep < TOUR_STEPS.length - 1 ? t('argus.tour.next') : t('argus.tour.finish')}
          </Button>
        </Box>
      </Paper>
    </>
  );
};

export default IssueDetailTour;
