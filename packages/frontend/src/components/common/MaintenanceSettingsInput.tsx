import React, { useMemo } from 'react';
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
  FormControlLabel,
  Switch,
  Chip,
  Tooltip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import BuildIcon from '@mui/icons-material/Build';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MultiLanguageMessageInput, { MessageLocale } from './MultiLanguageMessageInput';
import LocalizedDateTimePicker from './LocalizedDateTimePicker';
import { MessageTemplate } from '@/services/messageTemplateService';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { computeMaintenanceStatus, getMaintenanceStatusDisplay } from '@/utils/maintenanceStatusUtils';

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

  // 강제 종료 옵션 (게임월드에서만 사용)
  showForceDisconnect?: boolean;
  forceDisconnect?: boolean;
  onForceDisconnectChange?: (value: boolean) => void;
  gracePeriodMinutes?: number;
  onGracePeriodMinutesChange?: (value: number) => void;

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
  showForceDisconnect = false,
  forceDisconnect = false,
  onForceDisconnectChange,
  gracePeriodMinutes = 5,
  onGracePeriodMinutesChange,
  messageError = false,
  messageRequired = true,
  sx,
}) => {
  const { t } = useTranslation();

  // Compute maintenance status based on start/end dates
  const maintenanceStatus = useMemo(() => {
    // Always treat as maintenance enabled (isMaintenance = true) since this component is only shown when maintenance is on
    return computeMaintenanceStatus(true, {
      startsAt: startDate || null,
      endsAt: endDate || null,
    });
  }, [startDate, endDate]);

  const statusDisplay = getMaintenanceStatusDisplay(maintenanceStatus);

  // Generate tooltip text for scheduled/active status
  const statusTooltip = useMemo(() => {
    if (maintenanceStatus === 'inactive') return '';
    const parts: string[] = [];
    // Start time: show "immediate start" if not set
    parts.push(`${t('maintenance.tooltipStartTime')}: ${startDate ? formatDateTimeDetailed(startDate) : t('maintenance.immediateStart')}`);
    // End time: show "manual stop" if not set
    parts.push(`${t('maintenance.tooltipEndTime')}: ${endDate ? formatDateTimeDetailed(endDate) : t('maintenance.manualStop')}`);
    // Force disconnect info
    if (forceDisconnect) {
      const delayText = gracePeriodMinutes === 0
        ? t('maintenance.kickDelayImmediate')
        : `${gracePeriodMinutes}${t('maintenance.minutesUnit')}`;
      parts.push(`${t('maintenance.kickExistingPlayers')}: ${t('common.yes')} (${delayText})`);
    } else {
      parts.push(`${t('maintenance.kickExistingPlayers')}: ${t('common.no')}`);
    }
    if (maintenanceMessage) {
      parts.push(`${t('maintenance.tooltipMessage')}: ${maintenanceMessage.length > 50 ? maintenanceMessage.substring(0, 50) + '...' : maintenanceMessage}`);
    }
    return parts.join('\n');
  }, [maintenanceStatus, startDate, endDate, forceDisconnect, gracePeriodMinutes, maintenanceMessage, t]);

  return (
    <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'warning.light', borderRadius: 1, bgcolor: 'background.default', ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ color: 'warning.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon fontSize="small" sx={{ mr: 0.5 }} /> {t('maintenance.title')}
        </Typography>
        {/* Maintenance status chip with tooltip for scheduled status */}
        <Tooltip
          title={statusTooltip}
          arrow
          placement="left"
          disableHoverListener={maintenanceStatus === 'inactive' || !statusTooltip}
          slotProps={{
            tooltip: { sx: { whiteSpace: 'pre-line' } }
          }}
        >
          <Chip
            icon={maintenanceStatus === 'scheduled' ? <ScheduleIcon /> : <BuildIcon />}
            label={t(statusDisplay.label)}
            size="small"
            sx={{
              backgroundColor: statusDisplay.bgColor,
              color: statusDisplay.color,
              fontWeight: 600,
              '& .MuiChip-icon': {
                color: statusDisplay.color,
              },
            }}
          />
        </Tooltip>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('maintenance.description')}
      </Typography>

      <Stack spacing={2}>
        {/* 점검 시작일과 종료일 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <LocalizedDateTimePicker
            label={t('maintenance.startDate')}
            value={startDate}
            onChange={onStartDateChange}
            helperText={t('maintenance.startDateHelp')}
          />

          <LocalizedDateTimePicker
            label={t('maintenance.endDate')}
            value={endDate}
            onChange={onEndDateChange}
            helperText={t('maintenance.endDateHelp')}
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

        {/* 강제 종료 옵션 (showForceDisconnect가 true일 때만 표시) */}
        {showForceDisconnect && (
          <>
            {/* 구분선 */}
            <Box sx={{ width: '100%', my: 1 }}>
              <Box sx={{
                height: '1px',
                backgroundColor: 'divider',
                width: '100%'
              }} />
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
              <Box sx={{ flex: '0 0 auto' }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={forceDisconnect}
                      onChange={(e) => onForceDisconnectChange?.(e.target.checked)}
                      color="warning"
                    />
                  }
                  label={t('maintenance.kickExistingPlayers')}
                />
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary', maxWidth: 300 }}>
                  {t('maintenance.kickExistingPlayersHelp')}
                </Typography>
              </Box>

              {forceDisconnect === true && (
                <Box sx={{ flex: '0 0 auto', minWidth: 200 }}>
                  <TextField
                    select
                    label={t('maintenance.kickDelayMinutes')}
                    value={gracePeriodMinutes}
                    onChange={(e) => onGracePeriodMinutesChange?.(Number(e.target.value))}
                    size="small"
                    sx={{ width: 180 }}
                  >
                    <MenuItem value={0}>{t('maintenance.kickDelayImmediate')}</MenuItem>
                    <MenuItem value={1}>{t('maintenance.kickDelay1Min')}</MenuItem>
                    <MenuItem value={5}>{t('maintenance.kickDelay5Min')}</MenuItem>
                    <MenuItem value={10}>{t('maintenance.kickDelay10Min')}</MenuItem>
                    <MenuItem value={30}>{t('maintenance.kickDelay30Min')}</MenuItem>
                  </TextField>
                  <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                    {t('maintenance.kickDelayHelp')}
                  </Typography>
                </Box>
              )}
            </Box>
          </>
        )}
      </Stack>
    </Box>
  );
};

export default MaintenanceSettingsInput;

