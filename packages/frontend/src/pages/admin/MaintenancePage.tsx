import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Box, Card, CardContent, Stack, TextField, Switch, FormControlLabel, Button, Typography, MenuItem, Select, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Build as BuildIcon } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import dayjs, { Dayjs } from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh';

dayjs.extend(utc);
dayjs.extend(timezone);
import { maintenanceService, MaintenanceType } from '@/services/maintenanceService';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { messageTemplateService, MessageTemplate } from '@/services/messageTemplateService';
import MultiLanguageMessageInput, { MessageLocale, MultiLanguageMessageInputRef } from '@/components/common/MultiLanguageMessageInput';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { useSSENotifications } from '@/hooks/useSSENotifications';
import { formatDateTimeDetailed, getStoredTimezone } from '@/utils/dateFormat';
import { computeMaintenanceStatus, getMaintenanceStatusDisplay, MaintenanceStatusType } from '@/utils/maintenanceStatusUtils';

const MaintenancePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.MAINTENANCE_MANAGE]);

  // Set dayjs locale based on current language
  React.useEffect(() => {
    const currentLang = i18n.language;
    if (currentLang === 'ko') {
      dayjs.locale('ko');
    } else if (currentLang === 'zh') {
      dayjs.locale('zh');
    } else {
      dayjs.locale('en');
    }
  }, [i18n.language]);
  const [tab, setTab] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // Status
  const [isLoading, setIsLoading] = useState(true); // Initial loading state to prevent flicker
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatusType>('inactive');
  const [currentMaintenanceDetail, setCurrentMaintenanceDetail] = useState<any>(null);
  const [type, setType] = useState<MaintenanceType>('regular');
  const [startsAt, setStartsAt] = useState<Dayjs | null>(null);
  const updatedBySSE = useRef(false);

  // DateTimePicker refs for focus
  const startsAtRef = useRef<HTMLInputElement>(null);
  const endsAtRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<MultiLanguageMessageInputRef>(null);

  const [endsAt, setEndsAt] = useState<Dayjs | null>(null);
  const [kickExistingPlayers, setKickExistingPlayers] = useState(false);
  const [kickDelayMinutes, setKickDelayMinutes] = useState<number>(5); // ?†Ïòà?úÍ∞Ñ (Î∂? - Í∏∞Î≥∏Í∞?5Î∂?
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
  const [confirmMode, setConfirmMode] = useState<'start'|'stop'|'update'|null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  // Periodically recompute maintenance status when scheduled
  // This ensures UI updates when scheduled maintenance starts/ends
  useEffect(() => {
    // Only run when maintenance is configured and status is scheduled
    if (!isMaintenance || maintenanceStatus !== 'scheduled') {
      return;
    }

    const checkStatusChange = () => {
      const newStatus = computeMaintenanceStatus(isMaintenance, currentMaintenanceDetail);
      if (newStatus !== maintenanceStatus) {
        setMaintenanceStatus(newStatus);
      }
    };

    // Check every 10 seconds for status changes
    const intervalId = setInterval(checkStatusChange, 10000);

    // Also check immediately in case we just loaded the page
    checkStatusChange();

    return () => clearInterval(intervalId);
  }, [isMaintenance, maintenanceStatus, currentMaintenanceDetail]);

  useEffect(() => {
    maintenanceService.getStatus().then(({ isUnderMaintenance, detail }) => {
      if (updatedBySSE.current) return; // keep SSE-updated status
      setIsMaintenance(isUnderMaintenance);
      const status = computeMaintenanceStatus(isUnderMaintenance, detail);
      setMaintenanceStatus(status);
      setCurrentMaintenanceDetail(detail);
      // Load existing settings if maintenance is configured (active, scheduled, or inactive with detail)
      // This includes: active maintenance, scheduled maintenance (future), and past maintenance with settings
      if (detail && isUnderMaintenance) {
        setType(detail.type);
        setStartsAt(detail.startsAt ? dayjs.utc(detail.startsAt).tz(getStoredTimezone()) : null);
        setEndsAt(detail.endsAt ? dayjs.utc(detail.endsAt).tz(getStoredTimezone()) : null);
        setBaseMsg(detail.message || '');
        setKickExistingPlayers(detail.kickExistingPlayers || false);
        setKickDelayMinutes(detail.kickDelayMinutes || 5);
        const d: any[] = [];
        if (detail.localeMessages?.ko) d.push({ lang: 'ko', message: detail.localeMessages.ko });
        if (detail.localeMessages?.en) d.push({ lang: 'en', message: detail.localeMessages.en });
        if (detail.localeMessages?.zh) d.push({ lang: 'zh', message: detail.localeMessages.zh });
        setLocales(d as any);
      } else {
        // No maintenance configured - start with clean state
        setType('regular');
        setStartsAt(null);
        setEndsAt(null);
        setBaseMsg('');
        setLocales([]);

        // Focus on message input field when no maintenance is configured
        setTimeout(() => {
          messageInputRef.current?.focus();
        }, 100);
      }
    }).catch(() => {
      // On error, still mark as loaded
    }).finally(() => {
      setIsLoading(false);
    });

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
        const status = computeMaintenanceStatus(!!isUnderMaintenance, detail);
        setMaintenanceStatus(status);
        setCurrentMaintenanceDetail(detail);
        // ?êÍ? Ï§ëÏùº ?åÎßå Í∏∞Ï°¥ ?§Ï†ï??Î∂àÎü¨??(SSE)
        if (detail && !!isUnderMaintenance) {
          setType(detail.type);
          setStartsAt(detail.startsAt ? dayjs.utc(detail.startsAt).tz(getStoredTimezone()) : null);
          setEndsAt(detail.endsAt ? dayjs.utc(detail.endsAt).tz(getStoredTimezone()) : null);
          setBaseMsg(detail.message || '');
          setKickExistingPlayers(detail.kickExistingPlayers || false);
          setKickDelayMinutes(detail.kickDelayMinutes || 5);
          const d: any[] = [];
          if (detail.localeMessages?.ko) d.push({ lang: 'ko', message: detail.localeMessages.ko });
          if (detail.localeMessages?.en) d.push({ lang: 'en', message: detail.localeMessages.en });
          if (detail.localeMessages?.zh) d.push({ lang: 'zh', message: detail.localeMessages.zh });
          setLocales(d as any);
        } else {
          // ?êÍ? Ï§ëÏù¥ ?ÑÎãàÎ©?Íπ®ÎÅó???ÅÌÉúÎ°?Ï¥àÍ∏∞??          setType('regular');
          setStartsAt(null);
          setEndsAt(null);
          setBaseMsg('');
          setLocales([]);
        }
      }
    }
  });

  // ?úÍ∞Ñ Í≤ÄÏ¶??®Ïàò
  const validateMaintenanceTime = () => {
    const now = dayjs();

    // Ï¢ÖÎ£å ?úÍ∞Ñ??Í≥ºÍ±∞??Í≤ΩÏö∞: ?êÎü¨
    if (endsAt && endsAt.isBefore(now)) {
      enqueueSnackbar(t('maintenance.validationEndTimeInPast'), { variant: 'error' });
      endsAtRef.current?.focus();
      return { valid: false };
    }

    // ?úÏûë ?úÍ∞Ñ???§Ï†ï?òÏ? ?äÏïòÍ≥?Ï¢ÖÎ£å ?úÍ∞ÑÎß??§Ï†ï??Í≤ΩÏö∞ (Ï¶âÏãú ?úÏûë)
    if (!startsAt && endsAt) {
      // Ï¶âÏãú ?úÏûë?¥Î?Î°??ÑÏû¨ ?úÍ∞ÑÎ∂Ä??Ï¢ÖÎ£å ?úÍ∞ÑÍπåÏ???Í∏∞Í∞Ñ Í≥ÑÏÇ∞
      const duration = endsAt.diff(now, 'minute');

      // ÏµúÏÜå 5Î∂?Í≤ÄÏ¶?      if (duration < 5) {
        enqueueSnackbar(t('maintenance.validationMinDuration', { duration: Math.max(0, duration) }), { variant: 'error' });
        endsAtRef.current?.focus();
        return { valid: false };
      }

      // ?†Ïòà?úÍ∞Ñ Í≤ÄÏ¶?(kickExistingPlayersÍ∞Ä ?úÏÑ±?îÎêú Í≤ΩÏö∞)
      if (kickExistingPlayers && kickDelayMinutes >= duration) {
        enqueueSnackbar(t('maintenance.validationGracePeriodExceedsDuration', {
          duration,
          gracePeriod: kickDelayMinutes
        }), { variant: 'error' });
        return { valid: false };
      }

      return { valid: true };
    }

    // ?úÏûë ?úÍ∞Ñ???§Ï†ï??Í≤ΩÏö∞
    if (startsAt) {
      // Ï¢ÖÎ£å ?úÍ∞Ñ???úÏûë ?úÍ∞ÑÎ≥¥Îã§ ?¥Î•∏ÏßÄ ?ïÏù∏
      if (endsAt && endsAt.isBefore(startsAt)) {
        enqueueSnackbar(t('maintenance.validationEndBeforeStart'), { variant: 'error' });
        endsAtRef.current?.focus();
        return { valid: false };
      }

      // Ï¢ÖÎ£å ?úÍ∞Ñ???§Ï†ï??Í≤ΩÏö∞ Í∏∞Í∞Ñ Í≤ÄÏ¶?      if (endsAt) {
        const duration = endsAt.diff(startsAt, 'minute');

        // ÏµúÏÜå 5Î∂?Í≤ÄÏ¶?        if (duration < 5) {
          enqueueSnackbar(t('maintenance.validationMinDuration', { duration }), { variant: 'error' });
          endsAtRef.current?.focus();
          return { valid: false };
        }

        // ?†Ïòà?úÍ∞Ñ Í≤ÄÏ¶?(kickExistingPlayersÍ∞Ä ?úÏÑ±?îÎêú Í≤ΩÏö∞)
        if (kickExistingPlayers && kickDelayMinutes >= duration) {
          enqueueSnackbar(t('maintenance.validationGracePeriodExceedsDuration', {
            duration,
            gracePeriod: kickDelayMinutes
          }), { variant: 'error' });
          return { valid: false };
        }
      }
    }

    return { valid: true };
  };

  // ?úÏûë ?úÍ∞Ñ??Í≥ºÍ±∞?∏Ï? ?ïÏù∏?òÎäî ?¨Ìçº ?®Ïàò
  const isStartTimeInPast = (): boolean => {
    if (!startsAt) return false;
    return startsAt.isBefore(dayjs());
  };

  const startMaintenance = async () => {
    // ?úÍ∞Ñ Í≤ÄÏ¶?    const validation = validateMaintenanceTime();
    if (!validation.valid) {
      return;
    }
    const payload = inputMode === 'template' ? (() => {
      const tpl = tpls.find(t => t.id === selectedTplId);
      const result: any = {
        isMaintenance: true,
        type,
        startsAt: startsAt ? startsAt.format() : null,
        endsAt: endsAt ? endsAt.format() : null,
        kickExistingPlayers,
        kickDelayMinutes: kickExistingPlayers ? kickDelayMinutes : undefined,
        message: tpl?.defaultMessage || undefined,
      };
      // Only include localeMessages if multi-language is supported
      if (tpl?.supportsMultiLanguage) {
        result.localeMessages = {
          ko: tpl?.locales?.find(l=>l.lang==='ko')?.message || undefined,
          en: tpl?.locales?.find(l=>l.lang==='en')?.message || undefined,
          zh: tpl?.locales?.find(l=>l.lang==='zh')?.message || undefined,
        };
      }
      return result;
    })() : {
      isMaintenance: true,
      type,
      startsAt: startsAt ? startsAt.format() : null,
      endsAt: endsAt ? endsAt.format() : null,
      kickExistingPlayers,
      kickDelayMinutes: kickExistingPlayers ? kickDelayMinutes : undefined,
      message: baseMsg || undefined,
      ...(supportsMultiLanguage && locales.length > 0 ? { localeMessages: Object.fromEntries(locales.map(l => [l.lang, l.message])) } : {}),
    };

    const response = await maintenanceService.setStatus(payload as any);
    const { isUnderMaintenance } = response.data;

    if (!isUnderMaintenance) {
      // ?êÍ????úÏûë?òÏ? ?äÏ? Í≤ΩÏö∞ Í≤ΩÍ≥†
      enqueueSnackbar(t('maintenance.startFailedWarning'), { variant: 'warning' });
      return;
    }

    setIsMaintenance(true);
  };

  const stopMaintenance = async () => {
    await maintenanceService.setStatus({ isMaintenance: false, type });
    setIsMaintenance(false);
  };

  const updateMaintenance = async () => {
    // ?úÍ∞Ñ Í≤ÄÏ¶?    const validation = validateMaintenanceTime();
    if (!validation.valid) {
      return;
    }

    const payload = inputMode === 'template' ? (() => {
      const tpl = tpls.find(t => t.id === selectedTplId);
      const result: any = {
        isMaintenance: true,
        type,
        startsAt: startsAt ? startsAt.toISOString() : null,
        endsAt: endsAt ? endsAt.toISOString() : null,
        kickExistingPlayers,
        kickDelayMinutes: kickExistingPlayers ? kickDelayMinutes : undefined,
        message: tpl?.defaultMessage || undefined,
      };
      // Only include localeMessages if multi-language is supported
      if (tpl?.supportsMultiLanguage) {
        result.localeMessages = {
          ko: tpl?.locales?.find(l=>l.lang==='ko')?.message || undefined,
          en: tpl?.locales?.find(l=>l.lang==='en')?.message || undefined,
          zh: tpl?.locales?.find(l=>l.lang==='zh')?.message || undefined,
        };
      }
      return result;
    })() : {
      isMaintenance: true,
      type,
      startsAt: startsAt ? startsAt.format() : null,
      endsAt: endsAt ? endsAt.format() : null,
      kickExistingPlayers,
      kickDelayMinutes: kickExistingPlayers ? kickDelayMinutes : undefined,
      message: baseMsg || undefined,
      ...(supportsMultiLanguage && locales.length > 0 ? { localeMessages: Object.fromEntries(locales.map(l => [l.lang, l.message])) } : {}),
    };

    const result = await maintenanceService.setStatus(payload);

    if (!result.data?.isUnderMaintenance) {
      // ?êÍ????ÖÎç∞?¥Ìä∏?òÏ? ?äÏ? Í≤ΩÏö∞ Í≤ΩÍ≥†
      enqueueSnackbar(t('maintenance.updateFailedWarning'), { variant: 'warning' });
      return;
    }

    setEditMode(false);
    enqueueSnackbar(t('maintenance.updateSuccess'), { variant: 'success' });
  };

  // Don't render content until initial status is loaded to prevent flicker
  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <BuildIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {t('maintenance.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('maintenance.description')}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <BuildIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {t('maintenance.title')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('maintenance.description')}
            </Typography>
          </Box>
        </Box>

      </Box>
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        {/* Ï¢åÏ∏° ?§Ï†ï ?ÅÏó≠ */}
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
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: getMaintenanceStatusDisplay(maintenanceStatus).color }}>
                      {getMaintenanceStatusDisplay(maintenanceStatus).icon} {t(getMaintenanceStatusDisplay(maintenanceStatus).label)}
                    </Typography>
                  </Box>

                  {/* Current Maintenance Summary */}
                  <Box sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.08)' : 'rgba(244, 67, 54, 0.04)',
                    border: '1px solid',
                    borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.3)' : 'rgba(244, 67, 54, 0.2)',
                    mb: 2
                  }}>
                    <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 600, color: 'error.main' }}>
                      {t('maintenance.currentSettingsTitle')}
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
                            {t('maintenance.type')}:
                          </Box>
                          <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                            {type === 'regular' ? t('maintenance.types.regular') : t('maintenance.types.emergency')}
                          </Box>
                        </Box>

                        {/* ?êÍ? Í∏∞Í∞Ñ */}
                        <Box component="tr">
                          <Box component="td" sx={{
                            fontWeight: 500,
                            fontSize: '0.875rem',
                            width: '140px',
                            verticalAlign: 'top',
                            pr: 2
                          }}>
                            {t('maintenance.maintenancePeriodLabel')}:
                          </Box>
                          <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                            {(() => {
                              if (startsAt && endsAt) {
                                const duration = endsAt.diff(startsAt, 'minute');
                                const hours = Math.floor(duration / 60);
                                const minutes = duration % 60;
                                const durationParts = [];
                                if (hours > 0) durationParts.push(`${hours}${t('maintenance.hoursUnit')}`);
                                if (minutes > 0) durationParts.push(`${minutes}${t('maintenance.minutesUnit')}`);
                                const durationText = durationParts.join(' ');
                                return (
                                  <Box component="span">
                                    {startsAt.format('YYYY-MM-DD A h:mm')} ~ {endsAt.format('YYYY-MM-DD A h:mm')}
                                    <Box component="span" sx={{ color: 'primary.main', fontWeight: 600, ml: 0.5 }}>
                                      ({durationText})
                                    </Box>
                                  </Box>
                                );
                              } else if (startsAt && !endsAt) {
                                return `${startsAt.format('YYYY-MM-DD A h:mm')} ~ ${t('maintenance.manualStopLabel')}`;
                              } else if (!startsAt && endsAt) {
                                return `${t('maintenance.immediateStartLabel')} ~ ${endsAt.format('YYYY-MM-DD A h:mm')}`;
                              } else {
                                return `${t('maintenance.immediateStartLabel')} ~ ${t('maintenance.manualStopLabel')}`;
                              }
                            })()}
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
                              {t('maintenance.startsAt')}:
                            </Box>
                            <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                              {startsAt.format('YYYY-MM-DD A h:mm')}
                              <Box component="span" sx={{ color: 'text.secondary', ml: 0.5 }}>
                                ({startsAt.toISOString()})
                              </Box>
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
                              {t('maintenance.endsAt')}:
                            </Box>
                            <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                              {endsAt.format('YYYY-MM-DD A h:mm')} ({endsAt.toISOString()})
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
                              maxWidth: 300,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {inputMode === 'template' ? selectedTpl?.defaultMessage : baseMsg}
                            </Box>
                          </Box>
                        )}

                        {/* Í∞ïÏ†úÏ¢ÖÎ£å ?µÏÖò */}
                        <Box component="tr">
                          <Box component="td" sx={{
                            fontWeight: 500,
                            fontSize: '0.875rem',
                            width: '140px',
                            verticalAlign: 'top',
                            pr: 2
                          }}>
                            {t('maintenance.kickExistingPlayers')}:
                          </Box>
                          <Box component="td" sx={{
                            fontSize: '0.875rem',
                            verticalAlign: 'top',
                            color: kickExistingPlayers ? 'warning.main' : 'success.main'
                          }}>
                            {kickExistingPlayers ? `${t('common.yes')} (${kickDelayMinutes}${t('maintenance.minutesUnit')})` : t('common.no')}
                          </Box>
                        </Box>

                        {/* ?§Ï†ï???ïÎ≥¥ */}
                        {currentMaintenanceDetail?.updatedBy && (
                          <Box component="tr">
                            <Box component="td" sx={{
                              fontWeight: 500,
                              fontSize: '0.875rem',
                              width: '140px',
                              verticalAlign: 'top',
                              pr: 2
                            }}>
                              {t('maintenance.updatedBy')}:
                            </Box>
                            <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                              {currentMaintenanceDetail.updatedBy.name} ({currentMaintenanceDetail.updatedBy.email})
                            </Box>
                          </Box>
                        )}

                        {/* ?§Ï†ï ?úÍ∞Ñ */}
                        {currentMaintenanceDetail?.updatedAt && (
                          <Box component="tr">
                            <Box component="td" sx={{
                              fontWeight: 500,
                              fontSize: '0.875rem',
                              width: '140px',
                              verticalAlign: 'top',
                              pr: 2
                            }}>
                              {t('maintenance.updatedAt')}:
                            </Box>
                            <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                              {dayjs(currentMaintenanceDetail.updatedAt).format('YYYY-MM-DD A h:mm')} ({currentMaintenanceDetail.updatedAt})
                            </Box>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  </Box>
                </>
              ) : (
                <>
                  {/* Type and schedule */}
                  <Box sx={{ width: 320 }}>
                    <TextField select label={t('maintenance.type')} value={type} onChange={(e) => setType(e.target.value as MaintenanceType)} fullWidth>
                      <MenuItem value="regular">{t('maintenance.types.regular')}</MenuItem>
                      <MenuItem value="emergency">{t('maintenance.types.emergency')}</MenuItem>
                    </TextField>
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                      {t('maintenance.typeHelp')}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flexWrap: 'wrap' }}>
                    <Box sx={{ width: 320 }}>
                      <DateTimePicker
                        label={t('maintenance.startsAt')}
                        value={startsAt}
                        onChange={(newValue) => {
                          setStartsAt(newValue);
                        }}
                        ampm={true}
                        format="YYYY-MM-DD A hh:mm"
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        timeSteps={{ minutes: 1 }}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            placeholder: t('maintenance.selectDateTime'),
                            inputRef: startsAtRef,
                            slotProps: { input: { readOnly: true } },
                          },
                          actionBar: {
                            actions: ['clear', 'cancel', 'accept']
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                        {t('maintenance.startsAtHelp')}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 320 }}>
                      <DateTimePicker
                        label={t('maintenance.endsAt')}
                        value={endsAt}
                        onChange={(newValue) => {
                          setEndsAt(newValue);
                        }}
                        ampm={true}
                        format="YYYY-MM-DD A hh:mm"
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        timeSteps={{ minutes: 1 }}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            placeholder: t('maintenance.selectDateTime'),
                            inputRef: endsAtRef,
                            slotProps: { input: { readOnly: true } },
                          },
                          actionBar: {
                            actions: ['clear', 'cancel', 'accept']
                          }
                        }}
                      />
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                        {t('maintenance.endsAtHelp')}
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Kick existing players option */}
                  <Box sx={{ alignSelf: 'flex-start', width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap' }}>
                      {/* Ï≤¥ÌÅ¨Î∞ïÏä§ ?ÅÏó≠ */}
                      <Box sx={{ flex: '0 0 auto' }}>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={kickExistingPlayers}
                              onChange={(e) => setKickExistingPlayers(e.target.checked)}
                              color="warning"
                            />
                          }
                          label={t('maintenance.kickExistingPlayers')}
                        />
                        <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary', maxWidth: 300 }}>
                          {t('maintenance.kickExistingPlayersHelp')}
                        </Typography>
                      </Box>

                      {/* ?†Ïòà?úÍ∞Ñ ?§Ï†ï ?ÅÏó≠ */}
                      {kickExistingPlayers && (
                        <Box sx={{ flex: '0 0 auto', minWidth: 250 }}>
                          <TextField
                            select
                            label={t('maintenance.kickDelayMinutes')}
                            value={kickDelayMinutes}
                            onChange={(e) => setKickDelayMinutes(Number(e.target.value))}
                            fullWidth
                            size="small"
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
                  </Box>

                  {/* Íµ¨Î∂Ñ??*/}
                  <Box sx={{ width: '100%', my: 5 }}>
                    <Box sx={{
                      height: '1px',
                      backgroundColor: 'divider',
                      width: '100%'
                    }} />
                  </Box>

                  {/* Input mode */}
                  <Box sx={{ width: 320 }}>
                    <TextField select label={t('maintenance.messageSource')} value={inputMode} onChange={(e)=>setInputMode(e.target.value as any)} fullWidth>
                      <MenuItem value="direct">{t('maintenance.directInput')}</MenuItem>
                      <MenuItem value="template">{t('maintenance.useTemplate')}</MenuItem>
                    </TextField>
                    <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                      {t('maintenance.messageSourceHelp')}
                    </Typography>
                  </Box>

                  {inputMode === 'template' && (
                    <Stack spacing={2}>
                      <Box sx={{ width: 320 }}>
                        <TextField select label={t('maintenance.selectTemplate')} value={selectedTplId} onChange={(e)=>setSelectedTplId(Number(e.target.value))} fullWidth>
                          <MenuItem value="">{t('common.select')}</MenuItem>
                          {tpls.map(tpl => (
                            <MenuItem key={tpl.id} value={tpl.id}>{tpl.name}</MenuItem>
                          ))}
                        </TextField>
                        <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                          {t('maintenance.selectTemplateHelp')}
                        </Typography>
                      </Box>
                      {tpls.find(t=>t.id===selectedTplId) && (
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" gutterBottom>{t('clientVersions.maintenance.defaultMessage')}</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{tpls.find(t=>t.id===selectedTplId)?.defaultMessage || '-'}</Typography>
                            <Stack spacing={1} sx={{ mt: 2 }}>
                              {(tpls.find(t=>t.id===selectedTplId)?.locales || []).map(l => {
                                const langLabels = { ko: '?úÍµ≠??, en: '?ÅÏñ¥', zh: 'Ï§ëÍµ≠?? };
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
                          // Î™®Îì† ?∏Ïñ¥ ?êÎèô Ï∂îÍ?
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
                      supportsMultiLanguageLabel={t('maintenance.useLanguageSpecificMessages')}
                      supportsMultiLanguageHelperText={t('maintenance.supportsMultiLanguageHelp')}

                      locales={locales.map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
                      onLocalesChange={(newLocales) => {
                        setLocales(newLocales.map(l => ({ lang: l.lang, message: l.message })));
                        // Î≤àÏó≠ Í≤∞Í≥ºÍ∞Ä ?àÏúºÎ©??êÎèô?ºÎ°ú ?§Íµ≠??ÏßÄ???úÏÑ±??                        const hasNonEmptyLocales = newLocales.some(l => l.message && l.message.trim() !== '');
                        if (hasNonEmptyLocales && !supportsMultiLanguage) {
                          setSupportsMultiLanguage(true);
                        }
                      }}
                      languageSpecificMessagesLabel={t('maintenance.languageSpecificMessages')}

                      enableTranslation={true}
                      translateButtonLabel={t('common.autoTranslate')}
                      translateTooltip={t('maintenance.translateTooltip')}
                      ref={messageInputRef}
                    />
                  )}
                </>
              )}

              {/* Actions???∞Ï∏° ?ÅÏó≠?ºÎ°ú ?¥Îèô */}

            </Stack>
          </CardContent>
        </Card>

        {/* ?∞Ï∏° ?°ÏÖò Î≤ÑÌäº ?ÅÏó≠ */}
        {canManage && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 200 }}>
            {!isMaintenance ? (
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<PlayArrowIcon />}
                onClick={() => {
                  // ?úÍ∞Ñ Í≤ÄÏ¶?Î®ºÏ? ?§Ìñâ
                  const validation = validateMaintenanceTime();
                  if (!validation.valid) {
                    return;
                  }
                  setConfirmMode('start');
                  setConfirmInput('');
                  setConfirmOpen(true);
                }}
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
                {t('maintenance.start')}
              </Button>
            ) : (
              <>
                {editMode ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<SaveIcon />}
                    onClick={() => {
                      // ?úÍ∞Ñ Í≤ÄÏ¶?Î®ºÏ? ?§Ìñâ
                      const validation = validateMaintenanceTime();
                      if (!validation.valid) {
                        return;
                      }
                      setConfirmMode('update');
                      setConfirmInput('');
                      setConfirmOpen(true);
                    }}
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
                    <SaveIcon sx={{ fontSize: '2.5rem' }} />
                    {t('maintenance.update')}
                  </Button>
                ) : (
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
                    {t('maintenance.stop')}
                  </Button>
                )}
                <Button
                  variant="outlined"
                  onClick={() => setEditMode(v => !v)}
                  sx={{ width: 140 }}
                >
                  {editMode ? t('common.cancel') : t('maintenance.edit')}
                </Button>
              </>
            )}
          </Box>
        )}

        {/* Confirm dialog */}
        <Dialog
          open={confirmOpen}
          onClose={()=>setConfirmOpen(false)}
          maxWidth="md"
          fullWidth
          sx={{
            '& .MuiBackdrop-root': {
              backgroundColor: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(0, 0, 0, 0.2)'
                : 'rgba(0, 0, 0, 0.3)',
            }
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
            <Typography variant="h6" component="div">
              {confirmMode === 'start' ? t('maintenance.confirmStartTitle') :
               confirmMode === 'update' ? t('maintenance.confirmUpdateTitle') :
               t('maintenance.confirmStopTitle')}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {confirmMode === 'start' ? t('maintenance.confirmStartSubtitle') :
               confirmMode === 'update' ? t('maintenance.confirmUpdateSubtitle') :
               t('maintenance.confirmStopSubtitle')}
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
                {confirmMode === 'start' ? t('maintenance.settingsSummaryTitle') : t('maintenance.currentSettingsTitle')}
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
                      {t('maintenance.type')}:
                    </Box>
                    <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                      {type === 'regular' ? t('maintenance.types.regular') : t('maintenance.types.emergency')}
                    </Box>
                  </Box>

                  {/* ?êÍ? Í∏∞Í∞Ñ */}
                  <Box component="tr">
                    <Box component="td" sx={{
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      width: '140px',
                      verticalAlign: 'top',
                      pr: 2
                    }}>
                      {t('maintenance.maintenancePeriodLabel')}:
                    </Box>
                    <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                      {(() => {
                        if (startsAt && endsAt) {
                          const duration = endsAt.diff(startsAt, 'minute');
                          const hours = Math.floor(duration / 60);
                          const minutes = duration % 60;
                          const durationParts = [];
                          if (hours > 0) durationParts.push(`${hours}${t('maintenance.hoursUnit')}`);
                          if (minutes > 0) durationParts.push(`${minutes}${t('maintenance.minutesUnit')}`);
                          const durationText = durationParts.join(' ');
                          return (
                            <Box component="span">
                              {startsAt.format('YYYY-MM-DD A h:mm')} ~ {endsAt.format('YYYY-MM-DD A h:mm')}
                              <Box component="span" sx={{ color: 'primary.main', fontWeight: 600, ml: 0.5 }}>
                                ({durationText})
                              </Box>
                            </Box>
                          );
                        } else if (startsAt && !endsAt) {
                          return `${startsAt.format('YYYY-MM-DD A h:mm')} ~ ${t('maintenance.manualStopLabel')}`;
                        } else if (!startsAt && endsAt) {
                          return `${t('maintenance.immediateStartLabel')} ~ ${endsAt.format('YYYY-MM-DD A h:mm')}`;
                        } else {
                          return `${t('maintenance.immediateStartLabel')} ~ ${t('maintenance.manualStopLabel')}`;
                        }
                      })()}
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
                        {t('maintenance.startsAt')}:
                      </Box>
                      <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                        {startsAt.format('YYYY-MM-DD A h:mm')} ({startsAt.isValid() ? startsAt.toISOString() : '-'})
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
                        {t('maintenance.endsAt')}:
                      </Box>
                      <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                        {endsAt.format('YYYY-MM-DD A h:mm')} ({endsAt.isValid() ? endsAt.toISOString() : '-'})
                      </Box>
                    </Box>
                  )}

                  {/* Í∞ïÏ†úÏ¢ÖÎ£å ?µÏÖò */}
                  <Box component="tr">
                    <Box component="td" sx={{
                      fontWeight: 500,
                      fontSize: '0.875rem',
                      width: '140px',
                      verticalAlign: 'top',
                      pr: 2
                    }}>
                      {t('maintenance.kickExistingPlayers')}:
                    </Box>
                    <Box component="td" sx={{
                      fontSize: '0.875rem',
                      verticalAlign: 'top',
                      color: kickExistingPlayers ? 'warning.main' : 'success.main'
                    }}>
                      {kickExistingPlayers ? `${t('common.yes')} (${kickDelayMinutes}${t('maintenance.minutesUnit')})` : t('common.no')}
                    </Box>
                  </Box>

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

                  {/* ?§Ï†ï???ïÎ≥¥ (Dialog?êÏÑú???ÑÏû¨ ?¨Ïö©?? */}
                  {user && (
                    <Box component="tr">
                      <Box component="td" sx={{
                        fontWeight: 500,
                        fontSize: '0.875rem',
                        width: '140px',
                        verticalAlign: 'top',
                        pr: 2
                      }}>
                        {confirmMode === 'update' ? t('maintenance.updatedBy') : t('maintenance.setBy')}:
                      </Box>
                      <Box component="td" sx={{ fontSize: '0.875rem', verticalAlign: 'top' }}>
                        {user.name} ({user.email})
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
                  ? t('maintenance.impactWarningTitle')
                  : t('maintenance.impactRestoreTitle')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {confirmMode === 'start'
                  ? t('maintenance.impactWarningDescription')
                  : t('maintenance.impactRestoreDescription')}
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 0 }}>
                {confirmMode === 'start' ? (
                  <>
                    {kickExistingPlayers ? (
                      <>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('maintenance.impactItemKick1')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('maintenance.impactItemKick2')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('maintenance.impactItemKick3')}
                        </Typography>
                        <Typography component="li" variant="body2">
                          {t('maintenance.impactItemKick4')}
                        </Typography>
                      </>
                    ) : (
                      <>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('maintenance.impactItemNoKick1')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('maintenance.impactItemNoKick2')}
                        </Typography>
                        <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                          {t('maintenance.impactItemNoKick3')}
                        </Typography>
                        <Typography component="li" variant="body2">
                          {t('maintenance.impactItemNoKick4')}
                        </Typography>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                      {t('maintenance.restoreItem1')}
                    </Typography>
                    <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
                      {t('maintenance.restoreItem2')}
                    </Typography>
                    <Typography component="li" variant="body2">
                      {t('maintenance.restoreItem3')}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>

            {/* Confirmation Input */}
            <Typography sx={{ mb: 2, fontWeight: 500 }}>
              {confirmMode === 'start'
                ? t('maintenance.confirmStartMessage', { keyword: t('maintenance.confirmStartKeyword') })
                : confirmMode === 'update'
                ? t('maintenance.confirmUpdateMessage', { keyword: t('maintenance.confirmUpdateKeyword') })
                : t('maintenance.confirmStopMessage', { keyword: t('maintenance.confirmStopKeyword') })}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="medium"
              value={confirmInput}
              onChange={(e)=>setConfirmInput(e.target.value)}
              placeholder={confirmMode === 'start' ? t('maintenance.confirmStartKeyword') :
                         confirmMode === 'update' ? t('maintenance.confirmUpdateKeyword') :
                         t('maintenance.confirmStopKeyword')}
              sx={{ mb: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={()=>setConfirmOpen(false)}>{t('common.cancel')}</Button>
            <Button
              color={confirmMode==='start' ? 'error' : confirmMode==='update' ? 'primary' : 'success'}
              variant="contained"
              onClick={async()=>{
                const expected = confirmMode==='start' ? t('maintenance.confirmStartKeyword') :
                                confirmMode==='update' ? t('maintenance.confirmUpdateKeyword') :
                                t('maintenance.confirmStopKeyword');
                if (confirmInput.trim().toLowerCase() !== expected.toLowerCase()) return;
                setConfirmOpen(false);
                if (confirmMode==='start') await startMaintenance();
                if (confirmMode==='update') await updateMaintenance();
                if (confirmMode==='stop') await stopMaintenance();
              }}
              disabled={confirmInput.trim().toLowerCase() !== (confirmMode==='start' ? t('maintenance.confirmStartKeyword') :
                                                              confirmMode==='update' ? t('maintenance.confirmUpdateKeyword') :
                                                              t('maintenance.confirmStopKeyword')).toLowerCase()}
            >
              {confirmMode==='start' ? t('maintenance.start') :
               confirmMode==='update' ? t('maintenance.update') :
               t('maintenance.stop')}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default MaintenancePage;

