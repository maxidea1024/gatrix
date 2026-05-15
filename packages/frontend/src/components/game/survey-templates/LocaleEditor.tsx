import React from 'react';
import {
  Box,
  TextField,
  Typography,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { TemplateLocales, TemplateSettings } from '@/services/surveyTemplateService';

const SUPPORTED_LOCALES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

interface Props {
  locales: TemplateLocales;
  settings: TemplateSettings;
  onLocalesChange: (locales: TemplateLocales) => void;
  onSettingsChange: (settings: TemplateSettings) => void;
}

const LocaleEditor: React.FC<Props> = ({
  locales,
  settings,
  onLocalesChange,
  onSettingsChange,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState(0);

  const updateLocaleField = (locale: string, field: string, value: string) => {
    onLocalesChange({
      ...locales,
      [locale]: {
        ...(locales[locale] || {}),
        [field]: value,
      },
    });
  };

  const fields = [
    { key: 'submitButton', label: t('surveyTemplate.submitButton'), defaults: { ko: '제출', en: 'Submit', zh: '提交' } },
    { key: 'nextButton', label: t('surveyTemplate.nextButton'), defaults: { ko: '다음', en: 'Next', zh: '下一步' } },
    { key: 'prevButton', label: t('surveyTemplate.prevButton'), defaults: { ko: '이전', en: 'Previous', zh: '上一步' } },
    { key: 'thankYou', label: t('surveyTemplate.thankYouMessage'), defaults: { ko: '감사합니다!', en: 'Thank you!', zh: '谢谢！' } },
    { key: 'requiredError', label: t('surveyTemplate.required'), defaults: { ko: '필수 항목입니다', en: 'This field is required', zh: '此字段为必填项' } },
  ];

  return (
    <Box>
      {/* Form Settings */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('surveyTemplate.settings')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.showProgressBar}
              onChange={(e) =>
                onSettingsChange({ ...settings, showProgressBar: e.target.checked })
              }
            />
          }
          label={t('surveyTemplate.showProgressBar')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={!!settings.shuffleQuestions}
              onChange={(e) =>
                onSettingsChange({ ...settings, shuffleQuestions: e.target.checked })
              }
            />
          }
          label={t('surveyTemplate.shuffleQuestions')}
        />
      </Box>

      {/* Theme Color */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <Typography variant="body2">Primary Color:</Typography>
        <input
          type="color"
          value={settings.theme?.primaryColor || '#6366f1'}
          onChange={(e) =>
            onSettingsChange({
              ...settings,
              theme: { ...(settings.theme || {}), primaryColor: e.target.value },
            })
          }
          style={{ width: 40, height: 30, border: 'none', cursor: 'pointer' }}
        />
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Locale Strings */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('surveyTemplate.localization')}
      </Typography>
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ mb: 2 }}
      >
        {SUPPORTED_LOCALES.map((loc) => (
          <Tab key={loc.code} label={loc.label} />
        ))}
      </Tabs>

      {SUPPORTED_LOCALES.map((loc, idx) => (
        <Box
          key={loc.code}
          sx={{ display: activeTab === idx ? 'block' : 'none' }}
        >
          {fields.map((field) => (
            <TextField
              key={field.key}
              fullWidth
              size="small"
              label={field.label}
              placeholder={field.defaults[loc.code as keyof typeof field.defaults] || ''}
              value={(locales[loc.code] as any)?.[field.key] || ''}
              onChange={(e) =>
                updateLocaleField(loc.code, field.key, e.target.value)
              }
              sx={{ mb: 1.5 }}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default LocaleEditor;
