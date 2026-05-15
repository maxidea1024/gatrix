import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Tabs,
  Tab,
  IconButton,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from '@mui/material';
import { Add, Close } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  SurveyTemplate,
  Question,
  QuestionType,
  TemplateSettings,
  TemplateLocales,
} from '@/services/surveyTemplateService';
import QuestionBlockEditor from './QuestionBlockEditor';
import QuestionTypeMenu from './QuestionTypeMenu';
import LocaleEditor from './LocaleEditor';
import SurveyPreview from './SurveyPreview';

const genId = () => crypto.randomUUID();

const SPLIT_STORAGE_KEY = 'surveyBuilder.splitRatio';
const DEFAULT_SPLIT = 50;
const MIN_SPLIT = 30;
const MAX_SPLIT = 70;

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    questions: Question[];
    settings: TemplateSettings;
    locales: TemplateLocales;
  }) => Promise<void>;
  template?: SurveyTemplate | null;
}

const LOCALES = ['ko', 'en', 'zh'];

const SurveyBuilderDialog: React.FC<Props> = ({
  open,
  onClose,
  onSave,
  template,
}) => {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState(template?.title || '');
  const [description, setDescription] = useState(template?.description || '');
  const [questions, setQuestions] = useState<Question[]>(
    template?.questions || []
  );
  const [settings, setSettings] = useState<TemplateSettings>(
    template?.settings || {}
  );
  const [locales, setLocales] = useState<TemplateLocales>(
    template?.locales || {}
  );
  const [activeTab, setActiveTab] = useState(0);
  const [editLocale, setEditLocale] = useState(i18n.language || 'ko');
  const [saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Splitter
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(() => {
    try {
      const saved = localStorage.getItem(SPLIT_STORAGE_KEY);
      if (saved) {
        const val = parseFloat(saved);
        if (val >= MIN_SPLIT && val <= MAX_SPLIT) return val;
      }
    } catch {
      /* ignore */
    }
    return DEFAULT_SPLIT;
  });

  const handleSplitterMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const startX = e.clientX;
      const startRatio = splitRatio;
      const containerWidth = container.getBoundingClientRect().width;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const deltaPercent = (delta / containerWidth) * 100;
        const newRatio = Math.min(
          MAX_SPLIT,
          Math.max(MIN_SPLIT, startRatio + deltaPercent)
        );
        setSplitRatio(newRatio);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setSplitRatio((cur) => {
          try {
            localStorage.setItem(SPLIT_STORAGE_KEY, String(cur));
          } catch {
            /* ignore */
          }
          return cur;
        });
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [splitRatio]
  );

  // Reset state when template changes
  React.useEffect(() => {
    if (open) {
      setTitle(template?.title || '');
      setDescription(template?.description || '');
      setQuestions(template?.questions || []);
      setSettings(template?.settings || {});
      setLocales(template?.locales || {});
      setActiveTab(0);
      setEditLocale(i18n.language || 'ko');
    }
  }, [open, template, i18n.language]);

  const addQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: genId(),
      type,
      title: { [editLocale]: '' },
      required: type !== 'welcome' && type !== 'ending',
      options: ['single_choice', 'multiple_choice', 'dropdown'].includes(type)
        ? [
            { id: genId(), label: { [editLocale]: '' } },
            { id: genId(), label: { [editLocale]: '' } },
          ]
        : undefined,
      settings:
        type === 'rating'
          ? { min: 1, max: 5, icon: 'star' }
          : type === 'linear_scale'
            ? { min: 1, max: 10 }
            : type === 'short_text'
              ? { maxLength: 200 }
              : type === 'long_text'
                ? { maxLength: 2000 }
                : undefined,
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const updateQuestion = (idx: number, updated: Question) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? updated : q)));
  };

  const deleteQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const duplicateQuestion = (idx: number) => {
    const source = questions[idx];
    const dup: Question = {
      ...JSON.parse(JSON.stringify(source)),
      id: genId(),
    };
    if (dup.options) {
      dup.options = dup.options.map((o: any) => ({ ...o, id: genId() }));
    }
    setQuestions((prev) => {
      const next = [...prev];
      next.splice(idx + 1, 0, dup);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ title, description, questions, settings, locales });
    } finally {
      setSaving(false);
    }
  };

  const hasQuestions = questions.some(
    (q) => q.type !== 'welcome' && q.type !== 'ending'
  );
  const isValid = title.trim().length > 0 && hasQuestions;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{ sx: { minHeight: '70vh', maxHeight: '90vh' } }}
    >
      <DialogTitle
        sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}
      >
        {template
          ? t('surveyTemplate.editTemplate')
          : t('surveyTemplate.createTemplate')}
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{ p: 0, display: 'flex', overflow: 'hidden' }}
        ref={containerRef}
      >
        {/* Left: Builder + Settings */}
        <Box
          sx={{
            width: `${splitRatio}%`,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Tab Navigation */}
          <Box
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              px: 2,
              flexShrink: 0,
            }}
          >
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab label={t('surveyTemplate.builder')} />
              <Tab label={t('surveyTemplate.settings')} />
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {/* Builder Tab */}
            {activeTab === 0 && (
              <Box sx={{ p: 2 }}>
                <TextField
                  fullWidth
                  autoFocus
                  label={t('surveyTemplate.templateName')}
                  placeholder={t('surveyTemplate.templateNamePlaceholder')}
                  helperText={t('surveyTemplate.templateNameHelp')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  sx={{ mb: 1.5 }}
                />
                <TextField
                  fullWidth
                  label={t('surveyTemplate.description')}
                  placeholder={t('surveyTemplate.descriptionPlaceholder')}
                  helperText={t('surveyTemplate.descriptionHelp')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                  sx={{ mb: 2 }}
                />

                {/* Locale selector */}
                <Box
                  sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('surveyTemplate.locale')}:
                  </Typography>
                  <ToggleButtonGroup
                    value={editLocale}
                    exclusive
                    onChange={(_, v) => v && setEditLocale(v)}
                    size="small"
                  >
                    {LOCALES.map((l) => (
                      <ToggleButton key={l} value={l}>
                        {l.toUpperCase()}
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ ml: 1 }}
                  >
                    {t('surveyTemplate.localeHelp')}
                  </Typography>
                </Box>

                {/* Question Blocks */}
                {questions.map((q, idx) => (
                  <QuestionBlockEditor
                    key={q.id}
                    question={q}
                    locale={editLocale}
                    index={idx}
                    onChange={(updated) => updateQuestion(idx, updated)}
                    onDelete={() => deleteQuestion(idx)}
                    onDuplicate={() => duplicateQuestion(idx)}
                  />
                ))}

                {/* Add Question Button */}
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={(e) => setMenuAnchor(e.currentTarget)}
                    sx={{ borderRadius: 2, px: 4, py: 1.5 }}
                  >
                    {t('surveyTemplate.addQuestion')}
                  </Button>
                </Box>

                <QuestionTypeMenu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={() => setMenuAnchor(null)}
                  onSelect={addQuestion}
                />
              </Box>
            )}

            {/* Settings Tab */}
            {activeTab === 1 && (
              <Box sx={{ p: 2 }}>
                <LocaleEditor
                  locales={locales}
                  settings={settings}
                  onLocalesChange={setLocales}
                  onSettingsChange={setSettings}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* Splitter */}
        <Box
          onMouseDown={handleSplitterMouseDown}
          sx={{
            width: 6,
            flexShrink: 0,
            cursor: 'col-resize',
            bgcolor: 'divider',
            transition: 'background-color 0.15s',
            '&:hover, &:active': {
              bgcolor: 'primary.main',
            },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box
            sx={{
              width: 2,
              height: 32,
              borderRadius: 1,
              bgcolor: 'text.disabled',
              opacity: 0.5,
            }}
          />
        </Box>

        {/* Right: Live Preview */}
        <Box
          sx={{
            width: `${100 - splitRatio}%`,
            minWidth: 0,
            bgcolor: 'action.hover',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="text.secondary"
            >
              {t('surveyTemplate.preview')}
            </Typography>
          </Box>
          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            <SurveyPreview
              title={title}
              description={description}
              questions={questions}
              settings={settings}
              locales={locales}
              locale={editLocale}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isValid || saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
        >
          {saving
            ? t('common.saving') || 'Saving...'
            : template
              ? t('common.save') || 'Save'
              : t('common.create') || 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SurveyBuilderDialog;
