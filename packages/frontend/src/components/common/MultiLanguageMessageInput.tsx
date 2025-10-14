import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  Box,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  CircularProgress,
  Tooltip,
  Stack,
  Paper
} from '@mui/material';
import { Translate as TranslateIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import translationService from '@/services/translationService';

export interface MessageLocale {
  lang: 'ko' | 'en' | 'zh';
  message: string;
}

export interface MultiLanguageMessageInputProps {
  // 기본 메시지
  defaultMessage: string;
  onDefaultMessageChange: (message: string) => void;
  defaultMessageLabel: string;
  defaultMessageHelperText: string;
  defaultMessageRequired?: boolean;
  defaultMessageError?: boolean;

  // 다국어 지원 여부
  supportsMultiLanguage: boolean;
  onSupportsMultiLanguageChange: (supports: boolean) => void;
  supportsMultiLanguageLabel: string;
  supportsMultiLanguageHelperText: string;

  // 언어별 메시지
  locales: MessageLocale[];
  onLocalesChange: (locales: MessageLocale[]) => void;
  languageSpecificMessagesLabel: string;

  // 번역 기능
  enableTranslation?: boolean;
  translateButtonLabel: string;
  translateTooltip: string;
  
  // 스타일링
  sx?: any;
  paperSx?: any;
}

export interface MultiLanguageMessageInputRef {
  focus: () => void;
}

const availableLanguages = [
  { code: 'ko' as const, label: '한국어' },
  { code: 'en' as const, label: 'English' },
  { code: 'zh' as const, label: '中文' }
];

const MultiLanguageMessageInput = forwardRef<MultiLanguageMessageInputRef, MultiLanguageMessageInputProps>(({
  defaultMessage,
  onDefaultMessageChange,
  defaultMessageLabel,
  defaultMessageHelperText,
  defaultMessageRequired = false,
  defaultMessageError = false,

  supportsMultiLanguage,
  onSupportsMultiLanguageChange,
  supportsMultiLanguageLabel,
  supportsMultiLanguageHelperText,

  locales,
  onLocalesChange,
  languageSpecificMessagesLabel,

  enableTranslation = true,
  translateButtonLabel,
  translateTooltip,
  
  sx,
  paperSx
}, ref) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [isTranslating, setIsTranslating] = useState(false);
  const defaultMessageRef = useRef<HTMLInputElement>(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      defaultMessageRef.current?.focus();
    }
  }));

  const handleTranslate = async () => {
    if (!defaultMessage || defaultMessage.trim().length === 0) {
      enqueueSnackbar(t('multiLanguageMessage.noMessageToTranslate'), { variant: 'warning' });
      return;
    }

    setIsTranslating(true);
    try {
      const translations = await translationService.translateMaintenanceMessage(
        defaultMessage,
        ['ko', 'en', 'zh']
      );

      console.log('Translation results:', translations);

      // 번역 결과를 locales에 적용
      const newLocales = availableLanguages.map(lang => {
        const existingLocale = locales.find(l => l.lang === lang.code);
        const translationResult = translations[lang.code];
        const translatedMessage = translationResult?.translatedText || existingLocale?.message || '';

        console.log(`Language ${lang.code}: translatedMessage = "${translatedMessage}"`);

        return {
          lang: lang.code,
          message: translatedMessage
        };
      });

      console.log('New locales:', newLocales);

      // 번역 결과 적용 (부모 컴포넌트에서 자동으로 supportsMultiLanguage를 true로 설정함)
      onLocalesChange(newLocales);

      enqueueSnackbar(t('multiLanguageMessage.translationCompleted'), { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(error.message || t('multiLanguageMessage.translationFailed'), { variant: 'error' });
    } finally {
      setIsTranslating(false);
    }
  };

  const updateLocale = (langCode: 'ko' | 'en' | 'zh', message: string) => {
    const newLocales = availableLanguages.map(lang => {
      const existingLocale = locales.find(l => l.lang === lang.code);
      if (lang.code === langCode) {
        return { lang: lang.code, message };
      }
      return existingLocale || { lang: lang.code, message: '' };
    });
    onLocalesChange(newLocales);
  };

  return (
    <Box sx={sx}>
      <Stack spacing={2}>
        {/* 기본 메시지 */}
        <TextField
          fullWidth
          multiline
          rows={3}
          label={defaultMessageLabel}
          value={defaultMessage}
          onChange={(e) => onDefaultMessageChange(e.target.value)}
          helperText={defaultMessageHelperText}
          required={defaultMessageRequired}
          error={defaultMessageError}
          inputRef={defaultMessageRef}
        />

        {/* 언어별 메시지 사용 여부 및 번역 버튼 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={
              <Switch
                checked={supportsMultiLanguage}
                onChange={(e) => onSupportsMultiLanguageChange(e.target.checked)}
              />
            }
            label={supportsMultiLanguageLabel}
          />

          {/* 번역 버튼 */}
          {enableTranslation && (
            <Tooltip title={translateTooltip}>
              <span>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={isTranslating ? <CircularProgress size={16} /> : <TranslateIcon />}
                  onClick={handleTranslate}
                  disabled={isTranslating || !defaultMessage?.trim()}
                  sx={{ minWidth: 'auto' }}
                >
                  {translateButtonLabel}
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>

        {supportsMultiLanguage && (
          <Typography variant="caption" color="text.secondary">
            {supportsMultiLanguageHelperText}
          </Typography>
        )}

        {/* 언어별 메시지 */}
        {supportsMultiLanguage && (
          <Paper 
            elevation={0} 
            sx={{ 
              p: 2, 
              bgcolor: 'background.default', 
              border: '1px solid', 
              borderColor: 'divider',
              ...paperSx 
            }}
          >
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
              {languageSpecificMessagesLabel}
            </Typography>

            {/* 모든 언어별 메시지 입력 */}
            <Stack spacing={2}>
              {availableLanguages.map((lang) => {
                const locale = locales.find(l => l.lang === lang.code);
                return (
                  <Box key={lang.code} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {lang.label}
                    </Typography>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      value={locale?.message || ''}
                      onChange={(e) => updateLocale(lang.code, e.target.value)}
                      placeholder={t('multiLanguageMessage.languagePlaceholder', { language: lang.label })}
                      helperText={t('multiLanguageMessage.emptyUsesDefault')}
                    />
                  </Box>
                );
              })}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Box>
  );
});

MultiLanguageMessageInput.displayName = 'MultiLanguageMessageInput';

export default MultiLanguageMessageInput;
