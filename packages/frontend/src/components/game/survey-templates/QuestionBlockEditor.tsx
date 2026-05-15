import React from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Switch,
  FormControlLabel,
  Chip,
  Tooltip,
  Paper,
} from '@mui/material';
import {
  DragIndicator,
  Delete,
  ContentCopy,
  Add,
  Close,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Question,
  QuestionOption,
  QuestionType,
} from '@/services/surveyTemplateService';
import { getQuestionIcon } from './QuestionTypeMenu';

const genId = () => crypto.randomUUID();

interface Props {
  question: Question;
  locale: string;
  index: number;
  onChange: (updated: Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

const hasOptions = (type: QuestionType) =>
  ['single_choice', 'multiple_choice', 'dropdown'].includes(type);

const hasScaleSettings = (type: QuestionType) =>
  ['rating', 'linear_scale'].includes(type);

const hasTextSettings = (type: QuestionType) =>
  ['short_text', 'long_text'].includes(type);

const QuestionBlockEditor: React.FC<Props> = ({
  question,
  locale,
  index,
  onChange,
  onDelete,
  onDuplicate,
}) => {
  const { t } = useTranslation();

  const updateTitle = (value: string) => {
    onChange({
      ...question,
      title: { ...question.title, [locale]: value },
    });
  };

  const updateDescription = (value: string) => {
    const desc = { ...(question.description || {}), [locale]: value };
    onChange({ ...question, description: desc });
  };

  const updateRequired = (checked: boolean) => {
    onChange({ ...question, required: checked });
  };

  const addOption = () => {
    const newOpt: QuestionOption = {
      id: genId(),
      label: { [locale]: '' },
    };
    onChange({
      ...question,
      options: [...(question.options || []), newOpt],
    });
  };

  const updateOptionLabel = (optIdx: number, value: string) => {
    const opts = [...(question.options || [])];
    opts[optIdx] = {
      ...opts[optIdx],
      label: { ...opts[optIdx].label, [locale]: value },
    };
    onChange({ ...question, options: opts });
  };

  const removeOption = (optIdx: number) => {
    const opts = (question.options || []).filter((_, i) => i !== optIdx);
    onChange({ ...question, options: opts });
  };

  const updateSettings = (key: string, value: any) => {
    onChange({
      ...question,
      settings: { ...(question.settings || {}), [key]: value },
    });
  };

  const isContentBlock =
    question.type === 'welcome' || question.type === 'ending';

  const typeKey =
    question.type === 'single_choice'
      ? 'singleChoice'
      : question.type === 'multiple_choice'
        ? 'multipleChoice'
        : question.type === 'short_text'
          ? 'shortText'
          : question.type === 'long_text'
            ? 'longText'
            : question.type === 'linear_scale'
              ? 'linearScale'
              : question.type;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        borderColor: 'divider',
        '&:hover': { borderColor: 'primary.main', boxShadow: 1 },
        transition: 'all 0.2s',
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
        <DragIndicator
          fontSize="small"
          sx={{ color: 'text.disabled', cursor: 'grab' }}
        />
        <Chip
          icon={getQuestionIcon(question.type)}
          label={t(`surveyTemplate.questionTypes.${typeKey}`)}
          size="small"
          variant="outlined"
          color="primary"
        />
        {!isContentBlock && (
          <Typography variant="caption" color="text.secondary">
            Q{index + 1}
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {!isContentBlock && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={!!question.required}
                onChange={(e) => updateRequired(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                {t(
                  question.required
                    ? 'surveyTemplate.required'
                    : 'surveyTemplate.optional'
                )}
              </Typography>
            }
          />
        )}
        <Tooltip title={t('surveyTemplate.duplicateTemplate')}>
          <IconButton size="small" onClick={onDuplicate}>
            <ContentCopy fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('common.delete') || 'Delete'}>
          <IconButton size="small" onClick={onDelete} color="error">
            <Delete fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Title */}
      <TextField
        fullWidth
        variant="standard"
        placeholder={t('surveyTemplate.questionTitlePlaceholder')}
        value={question.title[locale] || ''}
        onChange={(e) => updateTitle(e.target.value)}
        sx={{
          mb: 1,
          '& .MuiInput-input': { fontSize: '1.1rem', fontWeight: 500 },
        }}
      />

      {/* Description */}
      <TextField
        fullWidth
        variant="standard"
        placeholder={t('surveyTemplate.questionDescription')}
        value={question.description?.[locale] || ''}
        onChange={(e) => updateDescription(e.target.value)}
        multiline
        maxRows={3}
        sx={{
          mb: 1.5,
          '& .MuiInput-input': {
            fontSize: '0.875rem',
            color: 'text.secondary',
          },
        }}
      />

      {/* Options (for choice types) */}
      {hasOptions(question.type) && (
        <Box sx={{ ml: 2 }}>
          {(question.options || []).map((opt, optIdx) => (
            <Box
              key={opt.id}
              sx={{ display: 'flex', alignItems: 'center', mb: 0.5, gap: 1 }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ minWidth: 20 }}
              >
                {optIdx + 1}.
              </Typography>
              <TextField
                fullWidth
                variant="standard"
                size="small"
                placeholder={t('surveyTemplate.optionPlaceholder', {
                  index: optIdx + 1,
                })}
                value={opt.label[locale] || ''}
                onChange={(e) => updateOptionLabel(optIdx, e.target.value)}
              />
              <IconButton size="small" onClick={() => removeOption(optIdx)}>
                <Close fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
            <IconButton size="small" onClick={addOption} color="primary">
              <Add fontSize="small" />
            </IconButton>
            <Typography variant="caption" color="primary">
              {t('surveyTemplate.addOption')}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Scale settings */}
      {hasScaleSettings(question.type) && (
        <Box sx={{ display: 'flex', gap: 2, ml: 2, mt: 1 }}>
          <TextField
            label={t('surveyTemplate.ratingMin')}
            type="number"
            size="small"
            value={question.settings?.min ?? 1}
            onChange={(e) =>
              updateSettings('min', parseInt(e.target.value) || 1)
            }
            sx={{ width: 100 }}
          />
          <TextField
            label={t('surveyTemplate.ratingMax')}
            type="number"
            size="small"
            value={question.settings?.max ?? 5}
            onChange={(e) =>
              updateSettings('max', parseInt(e.target.value) || 5)
            }
            sx={{ width: 100 }}
          />
        </Box>
      )}

      {/* Text settings */}
      {hasTextSettings(question.type) && (
        <Box sx={{ ml: 2, mt: 1 }}>
          <TextField
            label={t('surveyTemplate.maxLength')}
            type="number"
            size="small"
            value={question.settings?.maxLength ?? ''}
            onChange={(e) =>
              updateSettings(
                'maxLength',
                e.target.value ? parseInt(e.target.value) : undefined
              )
            }
            sx={{ width: 150 }}
          />
        </Box>
      )}
    </Paper>
  );
};

export default QuestionBlockEditor;
