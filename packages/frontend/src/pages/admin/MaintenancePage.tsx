import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Card, CardContent, Stack, TextField, Switch, FormControlLabel, Button, Typography, MenuItem, Select, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
import { maintenanceService, MaintenanceType } from '@/services/maintenanceService';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { messageTemplateService, MessageTemplate } from '@/services/messageTemplateService';
import MultiLanguageMessageInput, { MessageLocale } from '@/components/common/MultiLanguageMessageInput';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import { useSSENotifications } from '@/hooks/useSSENotifications';
import { formatDateTimeDetailed, getStoredTimezone } from '@/utils/dateFormat';


const MaintenancePage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // Status
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [type, setType] = useState<MaintenanceType>('regular');
  const [startsAt, setStartsAt] = useState<Dayjs | null>(null);
  const updatedBySSE = useRef(false);

  const [endsAt, setEndsAt] = useState<Dayjs | null>(null);
  const [kickExistingPlayers, setKickExistingPlayers] = useState(false);

  // Input mode
  const [inputMode, setInputMode] = useState<'direct'|'template'|''>('direct');

  // Direct input state
  const [baseMsg, setBaseMsg] = useState('');
  const [locales, setLocales] = useState<Array<{ lang: 'ko'|'en'|'zh'; message: string }>>([]);
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

  // Templates
  const [tpls, setTpls] = useState<MessageTemplate[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<number | ''>('');

  // Derived
  const selectedTpl = tpls.find(t => t.id === selectedTplId);
  const hasMessageForStart = inputMode === 'template'
    ? !!(selectedTpl && (
        (selectedTpl.defaultMessage && selectedTpl.defaultMessage.trim()) ||
        (selectedTpl.locales && selectedTpl.locales.some(l => l.message && l.message.trim()))
      ))
    : !!((baseMsg && baseMsg.trim()) || locales.some(l => l.message && l.message.trim()));



  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'start'|'stop'|null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    maintenanceService.getStatus().then(({ isUnderMaintenance, detail }) => {
      if (updatedBySSE.current) return; // keep SSE-updated status
      setIsMaintenance(isUnderMaintenance);
      // 점검 중일 때만 기존 설정을 불러옴
      if (detail && isUnderMaintenance) {
        setType(detail.type);
        setStartsAt(detail.startsAt ? dayjs.utc(detail.startsAt).tz(getStoredTimezone()) : null);
        setEndsAt(detail.endsAt ? dayjs.utc(detail.endsAt).tz(getStoredTimezone()) : null);
        setBaseMsg(detail.message || '');
        const d: any[] = [];
        if (detail.messages?.ko) d.push({ lang: 'ko', message: detail.messages.ko });
        if (detail.messages?.en) d.push({ lang: 'en', message: detail.messages.en });
        if (detail.messages?.zh) d.push({ lang: 'zh', message: detail.messages.zh });
        setLocales(d as any);
      } else {
        // 점검 중이 아니면 깨끗한 상태로 시작
        setType('regular');
        setStartsAt(null);
        setEndsAt(null);
        setBaseMsg('');
        setLocales([]);
      }
    }).catch(() => {});

    messageTemplateService.list({ isEnabled: true }).then(response => {

      setTpls(response.templates || []);
    }).catch(() => {
      setTpls([]);
    });
  }, []);

  // Sync status with SSE
  useSSENotifications({
    autoConnect: true,
    onEvent: (event) => {
      if (event.type === 'maintenance_status_change') {
        const { isUnderMaintenance, detail } = event.data || {};
        updatedBySSE.current = true;
        setIsMaintenance(!!isUnderMaintenance);
        // 점검 중일 때만 기존 설정을 불러옴 (SSE)
        if (detail && !!isUnderMaintenance) {
          setType(detail.type);
          setStartsAt(detail.startsAt ? dayjs.utc(detail.startsAt).tz(getStoredTimezone()) : null);
          setEndsAt(detail.endsAt ? dayjs.utc(detail.endsAt).tz(getStoredTimezone()) : null);
          setBaseMsg(detail.message || '');
          const d: any[] = [];
          if (detail.messages?.ko) d.push({ lang: 'ko', message: detail.messages.ko });
          if (detail.messages?.en) d.push({ lang: 'en', message: detail.messages.en });
          if (detail.messages?.zh) d.push({ lang: 'zh', message: detail.messages.zh });
          setLocales(d as any);
        } else {
          // 점검 중이 아니면 깨끗한 상태로 초기화
          setType('regular');
          setStartsAt(null);
          setEndsAt(null);
          setBaseMsg('');
          setLocales([]);
        }
      }
    }
  });

  // 시간 검증 함수
  const validateMaintenanceTime = () => {
    const now = dayjs();

    // 시작 시간이 과거인지 확인
    if (startsAt && startsAt.isBefore(now)) {
      return { valid: false, message: '시작 시간이 과거입니다. 현재 시간 이후로 설정해주세요.' };
    }

    // 종료 시간이 시작 시간보다 이른지 확인
    if (startsAt && endsAt && endsAt.isBefore(startsAt)) {
      return { valid: false, message: '종료 시간이 시작 시간보다 이릅니다.' };
    }

    // 점검 시간이 너무 짧은지 확인 (5분 미만)
    if (startsAt && endsAt) {
      const duration = endsAt.diff(startsAt, 'minute');
      if (duration < 5) {
        return { valid: false, message: '점검 시간이 너무 짧습니다. 최소 5분 이상 설정해주세요.' };
      }
    }

    return { valid: true, message: '' };
  };

  const startMaintenance = async () => {
    // 시간 검증
    const validation = validateMaintenanceTime();
    if (!validation.valid) {
      alert(validation.message);
      return;
    }
    const payload = inputMode === 'template' ? (() => {
      const tpl = tpls.find(t => t.id === selectedTplId);
      return {
        isMaintenance: true,
        type,
        startsAt: startsAt ? startsAt.toISOString() : null,
        endsAt: endsAt ? endsAt.toISOString() : null,
        message: tpl?.defaultMessage || undefined,
        messages: {
          ko: tpl?.locales?.find(l=>l.lang==='ko')?.message || undefined,
          en: tpl?.locales?.find(l=>l.lang==='en')?.message || undefined,
          zh: tpl?.locales?.find(l=>l.lang==='zh')?.message || undefined,
        }
      };
    })() : {
      isMaintenance: true,
      type,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      message: baseMsg || undefined,
      messages: Object.fromEntries(locales.map(l => [l.lang, l.message])) as any,
    };



    const response = await maintenanceService.setStatus(payload as any);
    const { isUnderMaintenance } = response.data;

    if (!isUnderMaintenance) {
      // 점검이 시작되지 않은 경우 경고
      alert(t('admin.maintenance.startFailedWarning'));
      return;
    }

    setIsMaintenance(true);
  };

  const stopMaintenance = async () => {
    await maintenanceService.setStatus({ isMaintenance: false, type });
    setIsMaintenance(false);
  };

  return (
    <Box sx={{ p: 3, transition:'background-color 0.2s ease', backgroundColor: (theme)=> isMaintenance ? alpha(theme.palette.error.light, 0.08) : alpha(theme.palette.success.light, 0.06) }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>{t('admin.maintenance.title')}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t('admin.maintenance.description')}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* 좌측 설정 영역 */}
        <Card sx={{
          borderColor: (theme)=> isMaintenance ? theme.palette.error.main : theme.palette.success.main,
          borderWidth: 1,
          borderStyle: 'solid',
          flex: 1,
          maxWidth: 800
        }}>
          <CardContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
              {isMaintenance && !editMode ? (
                <>
                  <Typography variant="subtitle1" color="error" sx={{ fontWeight: 600 }}>
                    {t('admin.maintenance.statusOn')}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.maintenance.type')}: {t(`admin.maintenance.types.${type}`)}
                    </Typography>
                    {startsAt && (
                      <Typography variant="body2" color="text.secondary">
                        {t('admin.maintenance.startsAt')}: {startsAt.format('YYYY년 M월 D일 A h:mm')} ({startsAt.toISOString()})
                      </Typography>
                    )}
                    {endsAt && (
                      <Typography variant="body2" color="text.secondary">
                        {t('admin.maintenance.endsAt')}: {endsAt.format('YYYY년 M월 D일 A h:mm')} ({endsAt.toISOString()})
                      </Typography>
                    )}
                  </Stack>

                  {/* Quick preview of current messages */}
                  {baseMsg && (
                    <Card variant="outlined" sx={{ mt: 1 }}>
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>{t('clientVersions.maintenance.defaultMessage')}</Typography>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{baseMsg}</Typography>
                        {locales.length > 0 && (
                          <Stack spacing={1} sx={{ mt: 2 }}>
                            {locales.map(l => {
                              const langLabels = { ko: '한국어', en: '영어', zh: '중국어' };
                              return (
                                <Box key={l.lang} sx={{ display:'flex', gap:1, alignItems:'flex-start' }}>
                                  <Chip label={langLabels[l.lang] || l.lang} size="small" sx={{ width: 96, justifyContent:'flex-start' }} />
                                  <Typography variant="body2" sx={{ whiteSpace:'pre-wrap' }}>{l.message}</Typography>
                                </Box>
                              );
                            })}
                          </Stack>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <>
                  {/* Type and schedule */}
                  <Box sx={{ width: 320 }}>
                    <TextField select label={t('admin.maintenance.type')} value={type} onChange={(e) => setType(e.target.value as MaintenanceType)} fullWidth>
                      <MenuItem value="regular">{t('admin.maintenance.types.regular')}</MenuItem>
                      <MenuItem value="emergency">{t('admin.maintenance.types.emergency')}</MenuItem>
                    </TextField>
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                      {t('admin.maintenance.typeHelp')}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flexWrap: 'wrap' }}>
                    <Box sx={{ width: 320 }}>
                      <DateTimePicker
                        label={t('admin.maintenance.startsAt')}
                        value={startsAt}
                        onChange={(newValue) => {
                          console.log('DateTimePicker startsAt changed:', newValue?.format(), newValue?.toISOString());
                          setStartsAt(newValue);
                        }}
                        ampm={true}
                        format="YYYY-MM-DD A h:mm"
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            placeholder: t('admin.maintenance.selectDateTime')
                          },
                          actionBar: {
                            actions: ['clear', 'cancel', 'accept']
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                        {t('admin.maintenance.startsAtHelp')}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 320 }}>
                      <DateTimePicker
                        label={t('admin.maintenance.endsAt')}
                        value={endsAt}
                        onChange={(newValue) => {
                          console.log('DateTimePicker endsAt changed:', newValue?.format(), newValue?.toISOString());
                          setEndsAt(newValue);
                        }}
                        ampm={true}
                        format="YYYY-MM-DD A h:mm"
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            placeholder: t('admin.maintenance.selectDateTime')
                          },
                          actionBar: {
                            actions: ['clear', 'cancel', 'accept']
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                        {t('admin.maintenance.endsAtHelp')}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Kick existing players option */}
                  <Box sx={{ alignSelf: 'flex-start' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={kickExistingPlayers}
                          onChange={(e) => setKickExistingPlayers(e.target.checked)}
                          color="warning"
                        />
                      }
                      label={t('admin.maintenance.kickExistingPlayers')}
                    />
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary', maxWidth: 500 }}>
                      {t('admin.maintenance.kickExistingPlayersHelp')}
                    </Typography>
                  </Box>

                  {/* Input mode */}
                  <Box sx={{ width: 320 }}>
                    <TextField select label={t('admin.maintenance.messageSource')} value={inputMode} onChange={(e)=>setInputMode(e.target.value as any)} fullWidth>
                      <MenuItem value="direct">{t('admin.maintenance.directInput')}</MenuItem>
                      <MenuItem value="template">{t('admin.maintenance.useTemplate')}</MenuItem>
                    </TextField>
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                      {t('admin.maintenance.messageSourceHelp')}
                    </Typography>
                  </Box>

                  {inputMode === 'template' && (
                    <Stack spacing={2}>
                      <Box sx={{ width: 320 }}>
                        <TextField select label={t('admin.maintenance.selectTemplate')} value={selectedTplId} onChange={(e)=>setSelectedTplId(Number(e.target.value))} fullWidth>
                          <MenuItem value="">{t('common.select')}</MenuItem>
                          {tpls.map(tpl => (
                            <MenuItem key={tpl.id} value={tpl.id}>{tpl.name}</MenuItem>
                          ))}
                        </TextField>
                        <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                          {t('admin.maintenance.selectTemplateHelp')}
                        </Typography>
                      </Box>



                      {tpls.find(t=>t.id===selectedTplId) && (
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" gutterBottom>{t('clientVersions.maintenance.defaultMessage')}</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{tpls.find(t=>t.id===selectedTplId)?.defaultMessage || '-'}</Typography>
                            <Stack spacing={1} sx={{ mt: 2 }}>
                              {(tpls.find(t=>t.id===selectedTplId)?.locales || []).map(l => {
                                const langLabels = { ko: '한국어', en: '영어', zh: '중국어' };
                                return (
                                  <Box key={l.lang} sx={{ display:'flex', gap:1, alignItems:'flex-start' }}>
                                    <Chip label={langLabels[l.lang as keyof typeof langLabels] || l.lang} size="small" sx={{ width: 96, justifyContent:'flex-start' }} />
                                    <Typography variant="body2" sx={{ whiteSpace:'pre-wrap' }}>{l.message}</Typography>
                                  </Box>
                                );
                              })}
                            </Stack>
                          </CardContent>
                        </Card>
                      )}
                    </Stack>
                  )}

                  {inputMode === 'direct' && (
                    <MultiLanguageMessageInput
                      defaultMessage={baseMsg}
                      onDefaultMessageChange={setBaseMsg}
                      defaultMessageLabel={t('clientVersions.maintenance.defaultMessage')}
                      defaultMessageHelperText={t('clientVersions.maintenance.defaultMessageHelp')}
                      defaultMessageRequired={true}
                      defaultMessageError={false}

                      supportsMultiLanguage={supportsMultiLanguage}
                      onSupportsMultiLanguageChange={(supports) => {
                        setSupportsMultiLanguage(supports);
                        if (supports) {
                          // 모든 언어 자동 추가
                          const allLangs = [
                            { code: 'ko' as const, message: '' },
                            { code: 'en' as const, message: '' },
                            { code: 'zh' as const, message: '' }
                          ];
                          setLocales(allLangs);
                        } else {
                          setLocales([]);
                        }
                      }}
                      supportsMultiLanguageLabel={t('admin.maintenance.useLanguageSpecificMessages')}
                      supportsMultiLanguageHelperText={t('admin.maintenance.supportsMultiLanguageHelp')}

                      locales={locales.map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
                      onLocalesChange={(newLocales) => {
                        setLocales(newLocales.map(l => ({ lang: l.lang, message: l.message })));
                      }}
                      languageSpecificMessagesLabel={t('admin.maintenance.languageSpecificMessages')}

                      enableTranslation={true}
                      translateButtonLabel={t('admin.maintenance.translate')}
                      translateTooltip={t('admin.maintenance.translateTooltip')}
                    />
                  )}
                </>
              )}

              {/* Actions는 우측 영역으로 이동 */}

              {/* Confirm dialog */}
              <Dialog
                open={confirmOpen}
                onClose={()=>setConfirmOpen(false)}
                maxWidth="md"
                fullWidth
              >
                <DialogTitle sx={{ pb: 1 }}>
                  {confirmMode === 'start' ? (t('admin.maintenance.confirmStartTitle')) : (t('admin.maintenance.confirmStopTitle'))}
                </DialogTitle>
                <DialogContent sx={{ pt: 2 }}>
                  {/* Settings Summary */}
                  <Box sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.08)' : 'rgba(25, 118, 210, 0.04)',
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.3)' : 'rgba(25, 118, 210, 0.2)'
                  }}>
                    <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'primary.main' }}>
                      {confirmMode === 'start' ? t('admin.maintenance.settingsSummaryTitle') : t('admin.maintenance.currentSettingsTitle')}
                    </Typography>

                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>
                          {t('admin.maintenance.type')}:
                        </Typography>
                        <Typography variant="body2">
                          {type === 'regular' ? t('admin.maintenance.types.regular') : t('admin.maintenance.types.emergency')}
                        </Typography>
                      </Box>

                      {/* 점검 기간 또는 즉시/수동 표시 */}
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>
                          점검 기간:
                        </Typography>
                        <Typography variant="body2">
                          {(() => {
                            if (startsAt && endsAt) {
                              const duration = endsAt.diff(startsAt, 'minute');
                              const hours = Math.floor(duration / 60);
                              const minutes = duration % 60;
                              return `${startsAt.format('YYYY년 M월 D일 A h:mm')} ~ ${endsAt.format('YYYY년 M월 D일 A h:mm')} (${hours > 0 ? `${hours}시간 ` : ''}${minutes}분)`;
                            } else if (startsAt && !endsAt) {
                              return `${startsAt.format('YYYY년 M월 D일 A h:mm')} ~ 수동 종료`;
                            } else if (!startsAt && endsAt) {
                              return `즉시 시작 ~ ${endsAt.format('YYYY년 M월 D일 A h:mm')}`;
                            } else {
                              return '즉시 시작 ~ 수동 종료';
                            }
                          })()}
                        </Typography>
                      </Box>

                      {/* 개별 시간 표시 (ISO8601 포함) */}
                      {startsAt && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>
                            {t('admin.maintenance.startsAt')}:
                          </Typography>
                          <Typography variant="body2">
                            {startsAt.format('YYYY년 M월 D일 A h:mm')} ({startsAt.toISOString()})
                          </Typography>
                        </Box>
                      )}

                      {endsAt && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>
                            {t('admin.maintenance.endsAt')}:
                          </Typography>
                          <Typography variant="body2">
                            {endsAt.format('YYYY년 M월 D일 A h:mm')} ({endsAt.toISOString()})
                          </Typography>
                        </Box>
                      )}

                      {confirmMode === 'start' && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>
                            {t('admin.maintenance.kickExistingPlayers')}:
                          </Typography>
                          <Typography variant="body2" sx={{ color: kickExistingPlayers ? 'warning.main' : 'success.main' }}>
                            {kickExistingPlayers ? t('common.yes') : t('common.no')}
                          </Typography>
                        </Box>
                      )}

                      {(baseMsg || (inputMode === 'template' && selectedTpl?.defaultMessage)) && (
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                          <Typography variant="body2" sx={{ fontWeight: 500, minWidth: 80 }}>
                            {t('clientVersions.maintenance.defaultMessage')}:
                          </Typography>
                          <Typography variant="body2" sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {inputMode === 'template' ? selectedTpl?.defaultMessage : baseMsg}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </Box>

                  {/* Impact Warning */}
                  <Box sx={{
                    mb: 3,
                    p: 2.5,
                    borderRadius: 2,
                    backgroundColor: confirmMode === 'start'
                      ? (theme) => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.08)' : 'rgba(244, 67, 54, 0.04)'
                      : (theme) => theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.08)' : 'rgba(76, 175, 80, 0.04)',
                    border: '1px solid',
                    borderColor: confirmMode === 'start'
                      ? (theme) => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.2)'
                      : (theme) => theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.2)'
                  }}>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                      {confirmMode === 'start'
                        ? t('admin.maintenance.impactWarningTitle')
                        : t('admin.maintenance.impactRestoreTitle')}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {confirmMode === 'start'
                        ? t('admin.maintenance.impactWarningDescription')
                        : t('admin.maintenance.impactRestoreDescription')}
                    </Typography>
                    <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                      {confirmMode === 'start' ? (
                        <>
                          {kickExistingPlayers ? (
                            <>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('admin.maintenance.impactItemKick1')}
                              </Typography>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('admin.maintenance.impactItemKick2')}
                              </Typography>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('admin.maintenance.impactItemKick3')}
                              </Typography>
                              <Typography component="li" variant="body2">
                                {t('admin.maintenance.impactItemKick4')}
                              </Typography>
                            </>
                          ) : (
                            <>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('admin.maintenance.impactItemNoKick1')}
                              </Typography>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('admin.maintenance.impactItemNoKick2')}
                              </Typography>
                              <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                                {t('admin.maintenance.impactItemNoKick3')}
                              </Typography>
                              <Typography component="li" variant="body2">
                                {t('admin.maintenance.impactItemNoKick4')}
                              </Typography>
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                            {t('admin.maintenance.restoreItem1')}
                          </Typography>
                          <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                            {t('admin.maintenance.restoreItem2')}
                          </Typography>
                          <Typography component="li" variant="body2">
                            {t('admin.maintenance.restoreItem3')}
                          </Typography>
                        </>
                      )}
                    </Box>
                  </Box>

                  {/* Confirmation Input */}
                  <Typography sx={{ mb: 2, fontWeight: 500 }}>
                    {confirmMode === 'start'
                      ? t('admin.maintenance.confirmStartMessage', { keyword: t('admin.maintenance.confirmStartKeyword') })
                      : t('admin.maintenance.confirmStopMessage', { keyword: t('admin.maintenance.confirmStopKeyword') })}
                  </Typography>
                  <TextField
                    autoFocus
                    fullWidth
                    size="medium"
                    value={confirmInput}
                    onChange={(e)=>setConfirmInput(e.target.value)}
                    placeholder={confirmMode === 'start' ? t('admin.maintenance.confirmStartKeyword') : t('admin.maintenance.confirmStopKeyword')}
                    sx={{ mb: 1 }}
                  />
                </DialogContent>
                <DialogActions>
                  <Button onClick={()=>setConfirmOpen(false)}>{t('common.cancel')}</Button>
                  <Button
                    color={confirmMode==='start' ? 'error' : 'success'}
                    variant="contained"
                    onClick={async()=>{
                      const expected = confirmMode==='start' ? t('admin.maintenance.confirmStartKeyword') : t('admin.maintenance.confirmStopKeyword');
                      if (confirmInput.trim().toLowerCase() !== expected.toLowerCase()) return;
                      setConfirmOpen(false);
                      if (confirmMode==='start') await startMaintenance();
                      if (confirmMode==='stop') await stopMaintenance();
                    }}
                    disabled={confirmInput.trim().toLowerCase() !== (confirmMode==='start' ? t('admin.maintenance.confirmStartKeyword') : t('admin.maintenance.confirmStopKeyword')).toLowerCase()}
                  >
                    {confirmMode==='start' ? (t('admin.maintenance.start')) : (t('admin.maintenance.stop'))}
                  </Button>
                </DialogActions>
              </Dialog>

            </Stack>
          </CardContent>
        </Card>

        {/* 우측 액션 버튼 영역 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 200 }}>
          {!isMaintenance ? (
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => { setConfirmMode('start'); setConfirmInput(''); setConfirmOpen(true); }}
              disabled={!hasMessageForStart}
              sx={{
                width: 160,
                height: 160,
                borderRadius: '50%',
                fontSize: '1.1rem',
                fontWeight: 600,
                flexDirection: 'column',
                gap: 1,
                '& .MuiButton-startIcon': {
                  margin: 0,
                  fontSize: '2rem'
                }
              }}
            >
              <PlayArrowIcon sx={{ fontSize: '2.5rem' }} />
              {t('admin.maintenance.start')}
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                color="success"
                size="large"
                startIcon={<StopIcon />}
                onClick={() => { setConfirmMode('stop'); setConfirmInput(''); setConfirmOpen(true); }}
                sx={{
                  width: 160,
                  height: 160,
                  borderRadius: '50%',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  flexDirection: 'column',
                  gap: 1,
                  '& .MuiButton-startIcon': {
                    margin: 0,
                    fontSize: '2rem'
                  }
                }}
              >
                <StopIcon sx={{ fontSize: '2.5rem' }} />
                {t('admin.maintenance.stop')}
              </Button>
              <Button
                variant="outlined"
                onClick={() => setEditMode(v => !v)}
                sx={{ width: 140 }}
              >
                {editMode ? t('common.cancel') : t('admin.maintenance.edit')}
              </Button>
            </>
          )}
        </Box>

        {/* Confirm dialog */}
        <Dialog
          open={confirmOpen}
          onClose={()=>setConfirmOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Typography variant="h6" component="div">
              {confirmMode === 'start' ? t('admin.maintenance.confirmStartTitle') : t('admin.maintenance.confirmStopTitle')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {confirmMode === 'start' ? t('admin.maintenance.confirmStartSubtitle') : t('admin.maintenance.confirmStopSubtitle')}
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {/* Settings Summary */}
            <Box sx={{
              mb: 3,
              p: 2,
              borderRadius: 2,
              backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.08)' : 'rgba(25, 118, 210, 0.04)',
              border: '1px solid',
              borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.3)' : 'rgba(25, 118, 210, 0.2)'
            }}>
              <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'primary.main' }}>
                {confirmMode === 'start' ? t('admin.maintenance.settingsSummaryTitle') : t('admin.maintenance.currentSettingsTitle')}
              </Typography>

              <Box component="table" sx={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
                <Box component="tbody">
                  <Box component="tr">
                    <Box component="td" sx={{
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      width: '140px',
                      verticalAlign: 'top',
                      pr: 2
                    }}>
                      {t('admin.maintenance.type')}:
                    </Box>
                    <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                      {type === 'regular' ? t('admin.maintenance.types.regular') : t('admin.maintenance.types.emergency')}
                    </Box>
                  </Box>

                  {startsAt && (
                    <Box component="tr">
                      <Box component="td" sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        width: '140px',
                        verticalAlign: 'top',
                        pr: 2
                      }}>
                        {t('admin.maintenance.startsAt')}:
                      </Box>
                      <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                        {startsAt.format('YYYY년 M월 D일 A h:mm')} ({startsAt.toISOString()})
                      </Box>
                    </Box>
                  )}

                  {endsAt && (
                    <Box component="tr">
                      <Box component="td" sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        width: '140px',
                        verticalAlign: 'top',
                        pr: 2
                      }}>
                        {t('admin.maintenance.endsAt')}:
                      </Box>
                      <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                        {endsAt.format('YYYY년 M월 D일 A h:mm')} ({endsAt.toISOString()})
                      </Box>
                    </Box>
                  )}

                  {confirmMode === 'start' && (
                    <Box component="tr">
                      <Box component="td" sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        width: '140px',
                        verticalAlign: 'top',
                        pr: 2
                      }}>
                        {t('admin.maintenance.kickExistingPlayers')}:
                      </Box>
                      <Box component="td" sx={{
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                        color: kickExistingPlayers ? 'warning.main' : 'success.main'
                      }}>
                        {kickExistingPlayers ? t('common.yes') : t('common.no')}
                      </Box>
                    </Box>
                  )}

                  {(baseMsg || (inputMode === 'template' && selectedTpl?.defaultMessage)) && (
                    <Box component="tr">
                      <Box component="td" sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        width: '140px',
                        verticalAlign: 'top',
                        pr: 2
                      }}>
                        {t('clientVersions.maintenance.defaultMessage')}:
                      </Box>
                      <Box component="td" sx={{
                        fontSize: '0.875rem',
                        verticalAlign: 'top',
                        maxWidth: '400px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {inputMode === 'template' ? selectedTpl?.defaultMessage : baseMsg}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Impact Warning */}
            <Box sx={{
              mb: 3,
              p: 2.5,
              borderRadius: 2,
              backgroundColor: confirmMode === 'start'
                ? (theme) => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.08)' : 'rgba(244, 67, 54, 0.04)'
                : (theme) => theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.08)' : 'rgba(76, 175, 80, 0.04)',
              border: '1px solid',
              borderColor: confirmMode === 'start'
                ? (theme) => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.2)'
                : (theme) => theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.3)' : 'rgba(76, 175, 80, 0.2)'
            }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                {confirmMode === 'start'
                  ? t('admin.maintenance.impactWarningTitle')
                  : t('admin.maintenance.impactRestoreTitle')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {confirmMode === 'start'
                  ? t('admin.maintenance.impactWarningDescription')
                  : t('admin.maintenance.impactRestoreDescription')}
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                {confirmMode === 'start' ? (
                  <>
                    {kickExistingPlayers ? (
                      <>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('admin.maintenance.impactItemKick1')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('admin.maintenance.impactItemKick2')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('admin.maintenance.impactItemKick3')}
                        </Typography>
                        <Typography component="li" variant="body2">
                          {t('admin.maintenance.impactItemKick4')}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('admin.maintenance.impactItemNoKick1')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('admin.maintenance.impactItemNoKick2')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('admin.maintenance.impactItemNoKick3')}
                        </Typography>
                        <Typography component="li" variant="body2">
                          {t('admin.maintenance.impactItemNoKick4')}
                        </Typography>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                      {t('admin.maintenance.restoreItem1')}
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                      {t('admin.maintenance.restoreItem2')}
                    </Typography>
                    <Typography component="li" variant="body2">
                      {t('admin.maintenance.restoreItem3')}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {/* Confirmation Input */}
            <Typography sx={{ mb: 2, fontWeight: 500 }}>
              {confirmMode === 'start'
                ? t('admin.maintenance.confirmStartMessage', { keyword: t('admin.maintenance.confirmStartKeyword') })
                : t('admin.maintenance.confirmStopMessage', { keyword: t('admin.maintenance.confirmStopKeyword') })}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="medium"
              value={confirmInput}
              onChange={(e)=>setConfirmInput(e.target.value)}
              placeholder={confirmMode === 'start' ? t('admin.maintenance.confirmStartKeyword') : t('admin.maintenance.confirmStopKeyword')}
              sx={{ mb: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={()=>setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button
              color={confirmMode==='start' ? 'error' : 'success'}
              variant="contained"
              onClick={async()=>{
                const expected = confirmMode==='start' ? t('admin.maintenance.confirmStartKeyword') : t('admin.maintenance.confirmStopKeyword');
                if (confirmInput.trim().toLowerCase() !== expected.toLowerCase()) return;
                setConfirmOpen(false);
                if (confirmMode==='start') await startMaintenance();
                if (confirmMode==='stop') await stopMaintenance();
              }}
              disabled={confirmInput.trim().toLowerCase() !== (confirmMode==='start' ? t('admin.maintenance.confirmStartKeyword') : t('admin.maintenance.confirmStopKeyword')).toLowerCase()}
            >
              {confirmMode==='start' ? (t('admin.maintenance.start')) : (t('admin.maintenance.stop'))}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default MaintenancePage;

