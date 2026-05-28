import React, { useState, useCallback, useRef, useMemo } from 'react';
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
  Collapse,
  Paper,
  Tooltip,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Close,
  PostAdd,
  Delete,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  SurveyTemplate,
  Question,
  QuestionType,
  TemplateSettings,
  TemplateLocales,
  SurveyPage,
  questionsToPages,
  pagesToQuestions,
} from '@/services/surveyTemplateService';
import QuestionBlockEditor from './QuestionBlockEditor';
import QuestionTypeMenu from './QuestionTypeMenu';
import LocaleEditor from './LocaleEditor';
import SurveyPreview from './SurveyPreview';

const genId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

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
  // Welcome/ending are 1-per-survey, managed as nullable single items
  const [welcomeBlock, setWelcomeBlock] = useState<Question | null>(null);
  const [endingBlock, setEndingBlock] = useState<Question | null>(null);
  const [pages, setPages] = useState<SurveyPage[]>([]);
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
  const [menuTargetPageId, setMenuTargetPageId] = useState<string | null>(null);
  const [collapsedPages, setCollapsedPages] = useState<Set<string>>(new Set());

  const togglePageCollapse = (pageId: string) => {
    setCollapsedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  // Dirty-tracking: snapshot initial state to detect changes
  const initialSnapshot = useRef<string>('');

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
      const t0 = template?.title || '';
      const d0 = template?.description || '';
      const q0 = template?.questions || [];
      const s0 = template?.settings || {};
      const l0 = template?.locales || {};
      setTitle(t0);
      setDescription(d0);

      // Split questions into welcome/ending + pages
      const wBlock = q0.find((q) => q.type === 'welcome') || null;
      const eBlock = q0.find((q) => q.type === 'ending') || null;
      const p0 = questionsToPages(q0);
      setWelcomeBlock(wBlock);
      setEndingBlock(eBlock);
      setPages(p0);

      setSettings(s0);
      setLocales(l0);
      setActiveTab(0);
      setEditLocale(i18n.language || 'ko');
      // Snapshot uses the same round-trip as allQuestions so dirty-check
      // won't false-positive from pageId being stamped by pagesToQuestions.
      const cBlocks = [wBlock, eBlock].filter(Boolean) as Question[];
      const roundTripped = pagesToQuestions(p0, cBlocks);
      initialSnapshot.current = JSON.stringify({
        description: d0,
        questions: roundTripped,
        settings: s0,
        locales: l0,
      });
    }
  }, [open, template, i18n.language]);

  // Compute flat questions for dirty-check and preview
  const contentBlocks = useMemo(
    () => [welcomeBlock, endingBlock].filter(Boolean) as Question[],
    [welcomeBlock, endingBlock]
  );

  const allQuestions = useMemo(
    () => pagesToQuestions(pages, contentBlocks),
    [pages, contentBlocks]
  );

  const isDirty = useMemo(() => {
    if (!initialSnapshot.current) return false;
    return (
      JSON.stringify({
        description,
        questions: allQuestions,
        settings,
        locales,
      }) !== initialSnapshot.current
    );
  }, [description, allQuestions, settings, locales]);

  // ==================== Question Handlers ====================

  const addQuestion = (type: QuestionType) => {
    const newQ: Question = {
      id: genId(),
      type,
      title: { [editLocale]: '' },
      required: true,
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

    // Add to specific page or last page
    const targetPageId = menuTargetPageId || pages[pages.length - 1]?.id;
    if (!targetPageId) return;

    setPages((prev) =>
      prev.map((page) =>
        page.id === targetPageId
          ? { ...page, questions: [...page.questions, newQ] }
          : page
      )
    );
  };

  const updateQuestionInPage = (
    pageId: string,
    qIdx: number,
    updated: Question
  ) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? {
              ...page,
              questions: page.questions.map((q, i) =>
                i === qIdx ? updated : q
              ),
            }
          : page
      )
    );
  };

  const deleteQuestionInPage = (pageId: string, qIdx: number) => {
    setPages((prev) =>
      prev.map((page) =>
        page.id === pageId
          ? {
              ...page,
              questions: page.questions.filter((_, i) => i !== qIdx),
            }
          : page
      )
    );
  };

  const duplicateQuestionInPage = (pageId: string, qIdx: number) => {
    setPages((prev) =>
      prev.map((page) => {
        if (page.id !== pageId) return page;
        const source = page.questions[qIdx];
        const dup: Question = {
          ...JSON.parse(JSON.stringify(source)),
          id: genId(),
        };
        if (dup.options) {
          dup.options = dup.options.map((o: any) => ({ ...o, id: genId() }));
        }
        const next = [...page.questions];
        next.splice(qIdx + 1, 0, dup);
        return { ...page, questions: next };
      })
    );
  };

  // ==================== Welcome/Ending Handlers ====================

  const toggleWelcome = () => {
    if (welcomeBlock) {
      setWelcomeBlock(null);
    } else {
      setWelcomeBlock({
        id: genId(),
        type: 'welcome',
        title: { [editLocale]: '' },
        required: false,
      });
    }
  };

  const toggleEnding = () => {
    if (endingBlock) {
      setEndingBlock(null);
    } else {
      setEndingBlock({
        id: genId(),
        type: 'ending',
        title: { [editLocale]: '' },
        required: false,
      });
    }
  };

  // ==================== Page Handlers ====================

  const addPage = () => {
    setPages((prev) => [...prev, { id: genId(), questions: [] }]);
  };

  const deletePage = (pageId: string) => {
    setPages((prev) => {
      const filtered = prev.filter((p) => p.id !== pageId);
      // Always keep at least one page
      if (filtered.length === 0) {
        return [{ id: genId(), questions: [] }];
      }
      return filtered;
    });
  };

  // ==================== Save ====================

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        title,
        description,
        questions: allQuestions,
        settings,
        locales,
      });
    } finally {
      setSaving(false);
    }
  };

  const isEditMode = Boolean(template);
  const hasQuestions = pages.some((p) => p.questions.length > 0);
  const allQuestionsHaveTitle = pages.every((p) =>
    p.questions.every((q) => {
      const vals = Object.values(q.title || {});
      return vals.some((v) => v.trim().length > 0);
    })
  );
  const isValid =
    title.trim().length > 0 && hasQuestions && allQuestionsHaveTitle;

  // Compute question numbering across pages
  const getQuestionNumber = (pageIdx: number, qIdx: number): number => {
    let num = 0;
    for (let i = 0; i < pageIdx; i++) {
      num += pages[i].questions.length;
    }
    return num + qIdx;
  };

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
                  autoFocus={!isEditMode}
                  disabled={isEditMode}
                  label={t('surveyTemplate.templateName')}
                  placeholder={t('surveyTemplate.templateNamePlaceholder')}
                  helperText={
                    isEditMode
                      ? t('surveyTemplate.templateNameReadonly')
                      : t('surveyTemplate.templateNameHelp')
                  }
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

                {/* Welcome/Ending toggles */}
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, mb: 2, borderRadius: 2 }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(welcomeBlock)}
                          onChange={toggleWelcome}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {t('surveyTemplate.questionTypes.welcome')}
                        </Typography>
                      }
                    />
                    {welcomeBlock && (
                      <TextField
                        size="small"
                        placeholder={t(
                          'surveyTemplate.questionTitlePlaceholder'
                        )}
                        value={welcomeBlock.title?.[editLocale] || ''}
                        onChange={(e) =>
                          setWelcomeBlock({
                            ...welcomeBlock,
                            title: {
                              ...welcomeBlock.title,
                              [editLocale]: e.target.value,
                            },
                          })
                        }
                        sx={{ flex: 1, minWidth: 200 }}
                      />
                    )}
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      mt: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(endingBlock)}
                          onChange={toggleEnding}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2">
                          {t('surveyTemplate.questionTypes.ending')}
                        </Typography>
                      }
                    />
                    {endingBlock && (
                      <TextField
                        size="small"
                        placeholder={t(
                          'surveyTemplate.questionTitlePlaceholder'
                        )}
                        value={endingBlock.title?.[editLocale] || ''}
                        onChange={(e) =>
                          setEndingBlock({
                            ...endingBlock,
                            title: {
                              ...endingBlock.title,
                              [editLocale]: e.target.value,
                            },
                          })
                        }
                        sx={{ flex: 1, minWidth: 200 }}
                      />
                    )}
                  </Box>
                </Paper>

                {/* Pages with questions */}
                {pages.map((page, pageIdx) => (
                  <Box key={page.id} sx={{ mb: 2 }}>
                    <Paper
                      variant="outlined"
                      sx={{
                        borderRadius: 2,
                        borderColor: 'primary.light',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Page Header */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 1,
                          py: 0.75,
                          bgcolor: (theme) =>
                            theme.palette.mode === 'dark'
                              ? 'rgba(144,202,249,0.08)'
                              : 'primary.50',
                          borderBottom: collapsedPages.has(page.id) ? 0 : 1,
                          borderColor: 'primary.light',
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                        onClick={() => togglePageCollapse(page.id)}
                      >
                        <IconButton size="small" sx={{ p: 0.25 }}>
                          {collapsedPages.has(page.id) ? (
                            <ExpandMore fontSize="small" color="primary" />
                          ) : (
                            <ExpandLess fontSize="small" color="primary" />
                          )}
                        </IconButton>
                        <Typography
                          variant="subtitle2"
                          fontWeight={700}
                          color="primary.main"
                          sx={{ flexShrink: 0 }}
                        >
                          {t('surveyTemplate.pageNumber', {
                            number: pageIdx + 1,
                          }) || `Page ${pageIdx + 1}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ({page.questions.length})
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Tooltip
                          title={
                            t('surveyTemplate.addQuestion') || 'Add Question'
                          }
                        >
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuTargetPageId(page.id);
                              setMenuAnchor(e.currentTarget);
                              // Auto-expand if collapsed
                              setCollapsedPages((prev) => {
                                const next = new Set(prev);
                                next.delete(page.id);
                                return next;
                              });
                            }}
                          >
                            <Add fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {pages.length > 1 && (
                          <Tooltip
                            title={
                              t('surveyTemplate.deletePage') || 'Delete Page'
                            }
                          >
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePage(page.id);
                              }}
                            >
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>

                      {/* Questions in this page — collapsible */}
                      <Collapse in={!collapsedPages.has(page.id)}>
                        <Box sx={{ p: 1.5 }}>
                          {page.questions.length === 0 ? (
                            <Box
                              sx={{
                                py: 3,
                                textAlign: 'center',
                                border: '2px dashed',
                                borderColor: 'divider',
                                borderRadius: 2,
                              }}
                            >
                              <Typography variant="body2" color="text.disabled">
                                {t('surveyTemplate.emptyPage') ||
                                  '이 페이지에 질문을 추가하세요'}
                              </Typography>
                            </Box>
                          ) : (
                            page.questions.map((q, qIdx) => (
                              <QuestionBlockEditor
                                key={q.id}
                                question={q}
                                locale={editLocale}
                                index={getQuestionNumber(pageIdx, qIdx)}
                                onChange={(updated) =>
                                  updateQuestionInPage(page.id, qIdx, updated)
                                }
                                onDelete={() =>
                                  deleteQuestionInPage(page.id, qIdx)
                                }
                                onDuplicate={() =>
                                  duplicateQuestionInPage(page.id, qIdx)
                                }
                              />
                            ))
                          )}
                        </Box>
                        {/* Bottom add-question button for accessibility */}
                        {page.questions.length > 0 && (
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'center',
                              pb: 1,
                            }}
                          >
                            <Button
                              size="small"
                              startIcon={<Add />}
                              onClick={(e) => {
                                setMenuTargetPageId(page.id);
                                setMenuAnchor(e.currentTarget);
                              }}
                              sx={{
                                borderRadius: 2,
                                textTransform: 'none',
                              }}
                            >
                              {t('surveyTemplate.addQuestion')}
                            </Button>
                          </Box>
                        )}
                      </Collapse>
                    </Paper>
                  </Box>
                ))}

                <QuestionTypeMenu
                  anchorEl={menuAnchor}
                  open={Boolean(menuAnchor)}
                  onClose={() => {
                    setMenuAnchor(null);
                    setMenuTargetPageId(null);
                  }}
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

          {/* Sticky footer — outside scroll area */}
          {activeTab === 0 && (
            <Box
              sx={{
                flexShrink: 0,
                display: 'flex',
                justifyContent: 'center',
                py: 1.5,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Button
                variant="contained"
                startIcon={<PostAdd />}
                onClick={addPage}
                sx={{ borderRadius: 2, px: 3, py: 1 }}
              >
                {t('surveyTemplate.addPage') || '페이지 추가'}
              </Button>
            </Box>
          )}
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
              questions={allQuestions}
              settings={settings}
              locales={locales}
              locale={editLocale}
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} variant="contained">
          {t('Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isValid || saving || (isEditMode && !isDirty)}
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
