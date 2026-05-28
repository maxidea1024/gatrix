import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Checkbox,
  FormGroup,
  MenuItem,
  Rating,
  Select,
  Slider,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  NavigateBefore,
  NavigateNext,
  Send,
  Phone,
  Tablet,
  DesktopWindows,
  ViewList,
  ViewCarousel,
} from '@mui/icons-material';
import { Divider, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  Question,
  TemplateSettings,
  TemplateLocales,
  SurveyPage,
  questionsToPages,
} from '@/services/surveyTemplateService';

interface Props {
  title: string;
  description: string;
  questions: Question[];
  settings: TemplateSettings;
  locales: TemplateLocales;
  locale: string;
}

type ViewMode = 'mobile' | 'tablet' | 'desktop';
type DisplayMode = 'slide' | 'scroll';

const VIEW_WIDTHS: Record<ViewMode, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 600,
};

const SurveyPreview: React.FC<Props> = ({
  title,
  description,
  questions,
  settings,
  locales,
  locale,
}) => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('mobile');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('scroll');
  const [scrollPageIdx, setScrollPageIdx] = useState(0);

  const visibleQuestions = questions.filter(
    (q) => q.type !== 'welcome' && q.type !== 'ending'
  );
  const welcomeQ = questions.find((q) => q.type === 'welcome');
  const endingQ = questions.find((q) => q.type === 'ending');

  // Group visible questions into pages
  const questionPages: SurveyPage[] = React.useMemo(
    () => questionsToPages(questions),
    [questions]
  );

  // Slides: welcome + pages + ending
  type SlideItem = 'welcome' | SurveyPage | 'ending';
  const slides: SlideItem[] = React.useMemo(() => {
    const s: SlideItem[] = [];
    if (welcomeQ) s.push('welcome');
    questionPages.forEach((p) => s.push(p));
    if (endingQ) s.push('ending');
    if (s.length === 0) s.push('welcome');
    return s;
  }, [welcomeQ, endingQ, questionPages]);

  const getLocText = (obj?: Record<string, string>): string => {
    if (!obj) return '';
    return obj[locale] || obj.ko || obj.en || Object.values(obj)[0] || '';
  };

  const current = slides[currentSlide];
  const totalSlides = slides.length;
  const progress =
    totalSlides > 1 ? ((currentSlide + 1) / totalSlides) * 100 : 0;

  const btnText = {
    submit: locales?.[locale]?.submitButton || t('common.submit') || 'Submit',
    next: locales?.[locale]?.nextButton || t('common.next') || 'Next',
    prev: locales?.[locale]?.prevButton || t('common.previous') || 'Back',
    thankYou:
      locales?.[locale]?.thankYou ||
      t('surveyTemplate.thankYouMessage') ||
      'Thank you!',
  };

  const renderWelcome = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      {welcomeQ && getLocText(welcomeQ.title) ? (
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {getLocText(welcomeQ.title)}
        </Typography>
      ) : (
        <Typography variant="h6" color="text.secondary" gutterBottom>
          {t('surveyTemplate.preview')}
        </Typography>
      )}
      {welcomeQ?.description && getLocText(welcomeQ.description) && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {getLocText(welcomeQ.description)}
        </Typography>
      )}
      <Button
        variant="contained"
        size="large"
        onClick={() => setCurrentSlide((p) => p + 1)}
        sx={{ borderRadius: 3, px: 6 }}
      >
        {t('common.next') || 'Start'}
      </Button>
    </Box>
  );

  const renderEnding = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {btnText.thankYou}
      </Typography>
      {endingQ && getLocText(endingQ.title) && (
        <Typography variant="body1" color="text.secondary">
          {getLocText(endingQ.title)}
        </Typography>
      )}
    </Box>
  );

  const renderQuestion = (q: Question) => {
    const qTitle = getLocText(q.title);
    const qDesc = q.description ? getLocText(q.description) : '';

    return (
      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            {qTitle || 'Untitled question'}
          </Typography>
          {qDesc && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {qDesc}
            </Typography>
          )}
          {q.required && (
            <Chip
              label={t('surveyTemplate.required')}
              size="small"
              color="error"
              variant="outlined"
              sx={{ mt: 0.5 }}
            />
          )}
        </Box>

        {/* Single Choice */}
        {q.type === 'single_choice' && (
          <RadioGroup
            value={answers[q.id] || ''}
            onChange={(e) =>
              setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
            }
          >
            {q.options?.map((opt) => (
              <FormControlLabel
                key={opt.id}
                value={opt.id}
                control={<Radio />}
                label={getLocText(opt.label) || '—'}
                sx={{ mb: 0.5 }}
              />
            ))}
          </RadioGroup>
        )}

        {/* Multiple Choice */}
        {q.type === 'multiple_choice' && (
          <FormGroup>
            {q.options?.map((opt) => {
              const selected: string[] = answers[q.id] || [];
              return (
                <FormControlLabel
                  key={opt.id}
                  control={
                    <Checkbox
                      checked={selected.includes(opt.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selected, opt.id]
                          : selected.filter((id: string) => id !== opt.id);
                        setAnswers((p) => ({ ...p, [q.id]: next }));
                      }}
                    />
                  }
                  label={getLocText(opt.label) || '—'}
                  sx={{ mb: 0.5 }}
                />
              );
            })}
          </FormGroup>
        )}

        {/* Dropdown */}
        {q.type === 'dropdown' && (
          <Select
            value={answers[q.id] || ''}
            onChange={(e) =>
              setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
            }
            fullWidth
            displayEmpty
            size="small"
          >
            <MenuItem value="" disabled>
              {t('surveyTemplate.selectOption') ||
                t('common.select') ||
                '선택하세요'}
            </MenuItem>
            {q.options?.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {getLocText(opt.label) || '—'}
              </MenuItem>
            ))}
          </Select>
        )}

        {/* Short Text */}
        {q.type === 'short_text' && (
          <TextField
            fullWidth
            size="small"
            placeholder={t('surveyTemplate.placeholder')}
            value={answers[q.id] || ''}
            onChange={(e) =>
              setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
            }
            inputProps={{ maxLength: q.settings?.maxLength || 200 }}
            helperText={`${(answers[q.id] || '').length} / ${q.settings?.maxLength || 200}`}
          />
        )}

        {/* Long Text */}
        {q.type === 'long_text' && (
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder={t('surveyTemplate.placeholder')}
            value={answers[q.id] || ''}
            onChange={(e) =>
              setAnswers((p) => ({ ...p, [q.id]: e.target.value }))
            }
            inputProps={{ maxLength: q.settings?.maxLength || 2000 }}
            helperText={`${(answers[q.id] || '').length} / ${q.settings?.maxLength || 2000}`}
          />
        )}

        {/* Rating */}
        {q.type === 'rating' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <Rating
              value={answers[q.id] || 0}
              max={q.settings?.max || 5}
              onChange={(_, v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
              size="large"
            />
          </Box>
        )}

        {/* Linear Scale */}
        {q.type === 'linear_scale' && (
          <Box sx={{ px: 2, py: 2 }}>
            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="caption" color="text.secondary">
                {typeof q.settings?.minLabel === 'object'
                  ? getLocText(q.settings.minLabel)
                  : q.settings?.minLabel || q.settings?.min || 1}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {typeof q.settings?.maxLabel === 'object'
                  ? getLocText(q.settings.maxLabel)
                  : q.settings?.maxLabel || q.settings?.max || 10}
              </Typography>
            </Box>
            <Slider
              value={answers[q.id] || q.settings?.min || 1}
              min={q.settings?.min || 1}
              max={q.settings?.max || 10}
              step={1}
              marks
              valueLabelDisplay="auto"
              onChange={(_, v) => setAnswers((p) => ({ ...p, [q.id]: v }))}
            />
          </Box>
        )}
      </Box>
    );
  };

  const renderScrollMode = () => {
    // Clamp scrollPageIdx to valid range
    const pageIdx = Math.min(scrollPageIdx, questionPages.length - 1);
    const activePage = questionPages[pageIdx >= 0 ? pageIdx : 0];

    return (
      <Card elevation={0}>
        <CardContent sx={{ p: 3 }}>
          {/* Welcome */}
          {welcomeQ && getLocText(welcomeQ.title) && (
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight={700} gutterBottom>
                {getLocText(welcomeQ.title)}
              </Typography>
              {welcomeQ.description && getLocText(welcomeQ.description) && (
                <Typography variant="body1" color="text.secondary">
                  {getLocText(welcomeQ.description)}
                </Typography>
              )}
            </Box>
          )}

          {/* Page tabs (show when multiple pages exist) */}
          {questionPages.length > 1 && (
            <Tabs
              value={pageIdx}
              onChange={(_, v) => setScrollPageIdx(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
              {questionPages.map((p, i) => (
                <Tab
                  key={p.id}
                  label={
                    t('surveyTemplate.pageNumber', { number: i + 1 }) ||
                    `Page ${i + 1}`
                  }
                />
              ))}
            </Tabs>
          )}

          {/* Selected page's questions */}
          {activePage &&
            activePage.questions.map((q, idx) => (
              <Box key={q.id} sx={{ mb: 3 }}>
                {idx > 0 && <Divider sx={{ mb: 3 }} />}
                {renderQuestion(q)}
              </Box>
            ))}

          {/* Submit */}
          {visibleQuestions.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                mt: 3,
                pt: 2,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Button
                variant="contained"
                endIcon={<Send />}
                size="large"
                color="success"
                sx={{ px: 6, borderRadius: 3 }}
              >
                {btnText.submit}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSlideMode = () => {
    const current = slides[currentSlide];
    const totalSlides = slides.length;

    const renderSlideContent = () => {
      if (current === 'welcome') return renderWelcome();
      if (current === 'ending') return renderEnding();
      // current is a SurveyPage — render all its questions
      const page = current as SurveyPage;
      return (
        <Box>
          {questionPages.length > 1 && (
            <Typography
              variant="caption"
              fontWeight={600}
              color="text.secondary"
              sx={{ mb: 2, display: 'block' }}
            >
              {t('surveyTemplate.pageNumber', {
                number: questionPages.indexOf(page) + 1,
              }) || `Page ${questionPages.indexOf(page) + 1}`}
            </Typography>
          )}
          {page.questions.map((q, idx) => (
            <Box key={q.id} sx={{ mb: 3 }}>
              {idx > 0 && <Divider sx={{ mb: 3 }} />}
              {renderQuestion(q)}
            </Box>
          ))}
        </Box>
      );
    };

    return (
      <>
        {/* Progress bar */}
        {settings?.showProgressBar !== false && (
          <LinearProgress
            variant="determinate"
            value={
              totalSlides > 1
                ? ((currentSlide + 1) / totalSlides) * 100
                : 0
            }
            sx={{ height: 3 }}
          />
        )}

        {/* Content */}
        <Card elevation={0}>
          <CardContent sx={{ p: 3, minHeight: 300 }}>
            {renderSlideContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        {current !== 'welcome' && current !== 'ending' && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Button
              startIcon={<NavigateBefore />}
              onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
              disabled={currentSlide === 0}
              size="small"
            >
              {btnText.prev}
            </Button>
            {currentSlide < totalSlides - 1 ? (
              <Button
                variant="contained"
                endIcon={<NavigateNext />}
                onClick={() =>
                  setCurrentSlide((p) => Math.min(totalSlides - 1, p + 1))
                }
                size="small"
              >
                {btnText.next}
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<Send />}
                onClick={() => {
                  if (endingQ) setCurrentSlide(totalSlides - 1);
                }}
                size="small"
                color="success"
              >
                {btnText.submit}
              </Button>
            )}
          </Box>
        )}
      </>
    );
  };

  return (
    <Box>
      {/* Controls row */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        }}
      >
        {/* Display mode toggle */}
        <ToggleButtonGroup
          value={displayMode}
          exclusive
          onChange={(_, v) => v && setDisplayMode(v)}
          size="small"
        >
          <ToggleButton
            value="scroll"
            title={t('surveyTemplate.questionTypes.welcome') || 'Scroll'}
          >
            <ViewList fontSize="small" />
          </ToggleButton>
          <ToggleButton
            value="slide"
            title={t('surveyTemplate.questionTypes.ending') || 'Slide'}
          >
            <ViewCarousel fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Device mode */}
        {[
          { mode: 'mobile' as ViewMode, icon: <Phone fontSize="small" /> },
          { mode: 'tablet' as ViewMode, icon: <Tablet fontSize="small" /> },
          {
            mode: 'desktop' as ViewMode,
            icon: <DesktopWindows fontSize="small" />,
          },
        ].map(({ mode, icon }) => (
          <Chip
            key={mode}
            icon={icon}
            label={mode}
            variant={viewMode === mode ? 'filled' : 'outlined'}
            color={viewMode === mode ? 'primary' : 'default'}
            onClick={() => setViewMode(mode)}
            size="small"
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </Box>

      {/* Preview frame */}
      <Box
        sx={{
          mx: 'auto',
          width: VIEW_WIDTHS[viewMode],
          maxWidth: '100%',
          border: '2px solid',
          borderColor: 'divider',
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          transition: 'width 0.3s ease',
        }}
      >
        {displayMode === 'scroll' ? renderScrollMode() : renderSlideMode()}
      </Box>
    </Box>
  );
};

export default SurveyPreview;
