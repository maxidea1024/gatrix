import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Stack, TextField, Switch, FormControlLabel, Button, Typography, MenuItem, Select, Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import moment, { Moment } from 'moment';
import { maintenanceService, MaintenanceType } from '@/services/maintenanceService';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { messageTemplateService, MessageTemplate } from '@/services/messageTemplateService';
import MultiLanguageMessageInput, { MessageLocale } from '@/components/common/MultiLanguageMessageInput';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';

const MaintenancePage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  // Status
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [type, setType] = useState<MaintenanceType>('regular');
  const [endsAt, setEndsAt] = useState<Moment | null>(null);
  const [applyEndsAt, setApplyEndsAt] = useState(false);

  // Input mode
  const [inputMode, setInputMode] = useState<'direct'|'template'|''>('');

  // Direct input state
  const [baseMsg, setBaseMsg] = useState('');
  const [locales, setLocales] = useState<Array<{ lang: 'ko'|'en'|'zh'; message: string }>>([]);
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

  // Templates
  const [tpls, setTpls] = useState<MessageTemplate[]>([]);
  const [selectedTplId, setSelectedTplId] = useState<number | ''>('');

  // Confirm dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'start'|'stop'|null>(null);
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    maintenanceService.getStatus().then(({ isUnderMaintenance, detail }) => {
      setIsMaintenance(isUnderMaintenance);
      if (detail) {
        setType(detail.type);
        setEndsAt(detail.endsAt ? moment(detail.endsAt) : null);
        setBaseMsg(detail.message || '');
        const d: any[] = [];
        if (detail.messages?.ko) d.push({ lang: 'ko', message: detail.messages.ko });
        if (detail.messages?.en) d.push({ lang: 'en', message: detail.messages.en });
        if (detail.messages?.zh) d.push({ lang: 'zh', message: detail.messages.zh });
        setLocales(d as any);
      }
    }).catch(() => {});

    messageTemplateService.list({ isEnabled: true }).then(response => {
      setTpls(response.templates || []);
    }).catch(() => {
      setTpls([]);
    });
  }, []);

  const startMaintenance = async () => {
    const payload = inputMode === 'template' ? (() => {
      const tpl = tpls.find(t => t.id === selectedTplId);
      return {
        isMaintenance: true,
        type,
        endsAt: applyEndsAt && endsAt ? endsAt.toISOString() : null,
        message: tpl?.default_message || undefined,
        messages: {
          ko: tpl?.locales?.find(l=>l.lang==='ko')?.message || undefined,
          en: tpl?.locales?.find(l=>l.lang==='en')?.message || undefined,
          zh: tpl?.locales?.find(l=>l.lang==='zh')?.message || undefined,
        }
      };
    })() : {
      isMaintenance: true,
      type,
      endsAt: applyEndsAt && endsAt ? endsAt.toISOString() : null,
      message: baseMsg || undefined,
      messages: Object.fromEntries(locales.map(l => [l.lang, l.message])) as any,
    };
    await maintenanceService.setStatus(payload as any);
    setIsMaintenance(true);
  };

  const stopMaintenance = async () => {
    await maintenanceService.setStatus({ isMaintenance: false, type });
    setIsMaintenance(false);
  };

  const addLocale = () => {
    const msg = newMsg.trim(); if (!msg) return;
    setLocales(prev => [...prev.filter(l=>l.lang!==newLang), { lang: newLang, message: msg }]);
    setNewMsg('');
  };
  const removeLocale = (lang: 'ko'|'en'|'zh') => setLocales(prev => prev.filter(l => l.lang !== lang));

  return (
    <Box sx={{ p: 3, transition:'background-color 0.2s ease', backgroundColor: (theme)=> isMaintenance ? alpha(theme.palette.error.light, 0.08) : alpha(theme.palette.success.light, 0.06) }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>{t('admin.maintenance.title')}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t('admin.maintenance.description')}
        </Typography>
      </Box>
      <Card sx={{ borderColor: (theme)=> isMaintenance ? theme.palette.error.main : theme.palette.success.main, borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {isMaintenance ? (
                <>
                  <Typography variant="subtitle1" color="error" sx={{ fontWeight: 600 }}>
                    {t('admin.maintenance.statusOn')}
                  </Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {t('admin.maintenance.type')}: {t(`admin.maintenance.types.${type}`)}
                    </Typography>
                    {endsAt && (
                      <Typography variant="body2" color="text.secondary">
                        {t('admin.maintenance.endsAt')}: {endsAt.format('YYYY-MM-DD HH:mm')}
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
                  {/* Type and endsAt */}
                  <TextField select label={t('admin.maintenance.type')} value={type} onChange={(e) => setType(e.target.value as MaintenanceType)} sx={{ width: 320 }}>
                    <MenuItem value="regular">{t('admin.maintenance.types.regular')}</MenuItem>
                    <MenuItem value="emergency">{t('admin.maintenance.types.emergency')}</MenuItem>
                  </TextField>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <DateTimePicker
                      label={t('admin.maintenance.endsAt')}
                      value={endsAt}
                      onChange={setEndsAt}
                      slotProps={{ textField: { sx: { width: 320 } } }}
                    />
                    <FormControlLabel control={<Switch checked={applyEndsAt} onChange={(e)=>setApplyEndsAt(e.target.checked)} />} label={t('admin.maintenance.applyEndsAt')} />
                  </Stack>

                  {/* Input mode */}
                  <TextField select label={t('admin.maintenance.messageSource')} value={inputMode} onChange={(e)=>setInputMode(e.target.value as any)} sx={{ width: 320 }}>
                    <MenuItem value="">{t('common.select')}</MenuItem>
                    <MenuItem value="direct">{t('admin.maintenance.directInput')}</MenuItem>
                    <MenuItem value="template">{t('admin.maintenance.useTemplate')}</MenuItem>
                  </TextField>

                  {inputMode === 'template' && (
                    <Stack spacing={2}>
                      <TextField select label={t('admin.maintenance.selectTemplate')} value={selectedTplId} onChange={(e)=>setSelectedTplId(Number(e.target.value))} sx={{ width: 320 }}>
                        <MenuItem value="">{t('common.select')}</MenuItem>
                        {tpls.map(tpl => (
                          <MenuItem key={tpl.id} value={tpl.id}>{tpl.name}</MenuItem>
                        ))}
                      </TextField>

                      {tpls.find(t=>t.id===selectedTplId) && (
                        <Card variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle2" gutterBottom>{t('clientVersions.maintenance.defaultMessage')}</Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{tpls.find(t=>t.id===selectedTplId)?.default_message || '-'}</Typography>
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

              {/* Actions: start/stop */}
              <Stack direction="row" spacing={2}>
                <Button variant="contained" color="error" startIcon={<PlayArrowIcon />} onClick={()=>{ setConfirmMode('start'); setConfirmInput(''); setConfirmOpen(true); }}>
                  {t('admin.maintenance.start')}
                </Button>
                <Button variant="outlined" color="success" startIcon={<StopIcon />} onClick={()=>{ setConfirmMode('stop'); setConfirmInput(''); setConfirmOpen(true); }}>
                  {t('admin.maintenance.stop')}
                </Button>
                <Typography variant="body2" sx={{ ml: 1, alignSelf:'center' }} color={isMaintenance ? 'error' : 'success'}>
                  {isMaintenance ? (t('admin.maintenance.statusOn')) : (t('admin.maintenance.statusOff'))}
                </Typography>
              </Stack>

              {/* Confirm dialog */}
              <Dialog open={confirmOpen} onClose={()=>setConfirmOpen(false)}>
                <DialogTitle>
                  {confirmMode === 'start' ? (t('admin.maintenance.confirmStartTitle')) : (t('admin.maintenance.confirmStopTitle'))}
                </DialogTitle>
                <DialogContent>
                  <Typography sx={{ mb: 1 }}>
                    {confirmMode === 'start'
                      ? t('admin.maintenance.confirmStartMessage')
                      : t('admin.maintenance.confirmStopMessage')}
                  </Typography>
                  <TextField autoFocus fullWidth size="small" value={confirmInput} onChange={(e)=>setConfirmInput(e.target.value)} placeholder={confirmMode === 'start' ? 'start maintenance' : 'stop maintenance'} />
                </DialogContent>
                <DialogActions>
                  <Button onClick={()=>setConfirmOpen(false)}>{t('common.cancel')}</Button>
                  <Button
                    color={confirmMode==='start' ? 'error' : 'success'}
                    variant="contained"
                    onClick={async()=>{
                      const expected = confirmMode==='start' ? 'start maintenance' : 'stop maintenance';
                      if (confirmInput.trim().toLowerCase() !== expected) return;
                      setConfirmOpen(false);
                      if (confirmMode==='start') await startMaintenance();
                      if (confirmMode==='stop') await stopMaintenance();
                    }}
                    disabled={confirmInput.trim().toLowerCase() !== (confirmMode==='start' ? 'start maintenance' : 'stop maintenance')}
                  >
                    {confirmMode==='start' ? (t('admin.maintenance.start')) : (t('admin.maintenance.stop'))}
                  </Button>
                </DialogActions>
              </Dialog>

            </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default MaintenancePage;

