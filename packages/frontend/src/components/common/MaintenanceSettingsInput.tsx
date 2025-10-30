import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  MenuItem,
  Typography,
  Stack,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
} from '@mui/material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import BuildIcon from '@mui/icons-material/Build';
import MultiLanguageMessageInput, { MessageLocale } from './MultiLanguageMessageInput';
import { MessageTemplate } from '@/services/messageTemplateService';
import { getDateLocale, parseUTCForPicker } from '@/utils/dateFormat';

export interface MaintenanceSettingsInputProps {
  // 점검 시작/종료 날짜
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;

  // 메시지 소스 선택
  inputMode: 'direct' | 'template';
  onInputModeChange: (mode: 'direct' | 'template') => void;

  // 직접 입력 모드
  maintenanceMessage: string;
  onMaintenanceMessageChange: (message: string) => void;
  supportsMultiLanguage: boolean;
  onSupportsMultiLanguageChange: (supports: boolean) => void;
  maintenanceLocales: MessageLocale[];
  onMaintenanceLocalesChange: (locales: MessageLocale[]) => void;

  // 템플릿 모드
  templates: MessageTemplate[];
  selectedTemplateId: number | '';
  onSelectedTemplateIdChange: (id: number | '') => void;

  // 에러 상태
  messageError?: boolean;

  // 필수 여부
  messageRequired?: boolean;

  // 스타일링
  sx?: any;
}

const MaintenanceSettingsInput: React.FC<MaintenanceSettingsInputProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  inputMode,
  onInputModeChange,
  maintenanceMessage,
  onMaintenanceMessageChange,
  supportsMultiLanguage,
  onSupportsMultiLanguageChange,
  maintenanceLocales,
  onMaintenanceLocalesChange,
  templates,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  messageError = false,
  messageRequired = true,
  sx,
}) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'warning.light', borderRadius: 1, bgcolor: 'background.default', ...sx }}>
      <Typography variant="subtitle1" gutterBottom sx={{ color: 'warning.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BuildIcon fontSize="small" sx={{ mr: 0.5 }} /> {t('maintenance.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('maintenance.description')}
      </Typography>

      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={getDateLocale()}>
        <Stack spacing={2}>
          {/* 점검 시작일과 종료일 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <DateTimePicker
              label={t('maintenance.startDate')}
              value={parseUTCForPicker(startDate)}
              onChange={(date) => onStartDateChange(date ? date.toISOString() : '')}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: t('maintenance.startDateHelp'),
                },
                actionBar: {
                  actions: ['clear', 'cancel', 'accept'],
                },
              }}
            />

            <DateTimePicker
              label={t('maintenance.endDate')}
              value={parseUTCForPicker(endDate)}
              onChange={(date) => onEndDateChange(date ? date.toISOString() : '')}
              slotProps={{
                textField: {
                  fullWidth: true,
                  helperText: t('maintenance.endDateHelp'),
                },
                actionBar: {
                  actions: ['clear', 'cancel', 'accept'],
                },
              }}
            />
          </Box>

          {/* 구분선 */}
          <Box sx={{ width: '100%', my: 2 }}>
            <Box sx={{
              height: '1px',
              backgroundColor: 'divider',
              width: '100%'
            }} />
          </Box>

          {/* 메시지 소스 선택 */}
          <TextField
            select
            label={t('maintenance.messageSource')}
            value={inputMode}
            onChange={(e) => onInputModeChange(e.target.value as 'direct' | 'template')}
            fullWidth
          >
            <MenuItem value="direct">{t('maintenance.directInput')}</MenuItem>
            <MenuItem value="template">{t('maintenance.useTemplate')}</MenuItem>
          </TextField>
          <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
            {t('maintenance.messageSourceHelp')}
          </Typography>

          {/* 직접 입력 모드 */}
          {inputMode === 'direct' && (
            <MultiLanguageMessageInput
              defaultMessage={maintenanceMessage}
              onDefaultMessageChange={onMaintenanceMessageChange}
              defaultMessageLabel={t('maintenance.defaultMessage')}
              defaultMessageHelperText={t('maintenance.defaultMessageHelp')}
              defaultMessageRequired={messageRequired}
              defaultMessageError={messageError}
              supportsMultiLanguage={supportsMultiLanguage}
              onSupportsMultiLanguageChange={onSupportsMultiLanguageChange}
              supportsMultiLanguageLabel={t('maintenance.supportsMultiLanguage')}
              supportsMultiLanguageHelperText={t('maintenance.supportsMultiLanguageHelp')}
              locales={maintenanceLocales}
              onLocalesChange={onMaintenanceLocalesChange}
              languageSpecificMessagesLabel={t('maintenance.languageSpecificMessages')}
              enableTranslation={true}
              translateButtonLabel={t('common.autoTranslate')}
              translateTooltip={t('maintenance.translateTooltip')}
            />
          )}

          {/* 템플릿 모드 */}
          {inputMode === 'template' && (
            <Box>
              <FormControl fullWidth>
                <InputLabel>{t('maintenance.selectTemplate')}</InputLabel>
                <Select
                  value={selectedTemplateId}
                  onChange={(e: SelectChangeEvent<number | ''>) => onSelectedTemplateIdChange(e.target.value as number | '')}
                  label={t('maintenance.selectTemplate')}
                >
                  <MenuItem value="">
                    <em>{t('maintenance.noTemplateSelected')}</em>
                  </MenuItem>
                  {templates.map((tpl) => (
                    <MenuItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                {t('maintenance.selectTemplateHelp')}
              </Typography>

              {/* 선택된 템플릿 미리보기 */}
              {selectedTemplateId && (() => {
                const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
                if (!selectedTemplate) return null;

                return (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('maintenance.templatePreview')}
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 1 }}>
                      <strong>{t('clientVersions.maintenance.defaultMessage')}:</strong> {selectedTemplate.defaultMessage || '-'}
                    </Typography>
                    {selectedTemplate.locales && selectedTemplate.locales.length > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('clientVersions.maintenance.languageSpecificMessages')}:
                        </Typography>
                        {selectedTemplate.locales.map((locale) => (
                          <Typography key={locale.lang} variant="body2" sx={{ ml: 2, whiteSpace: 'pre-wrap' }}>
                            <strong>{locale.lang.toUpperCase()}:</strong> {locale.message || '-'}
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Box>
          )}
        </Stack>
      </LocalizationProvider>
    </Box>
  );
};

export default MaintenanceSettingsInput;

