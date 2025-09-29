import React, { useEffect, useRef, useState } from 'react';
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
import { useSSENotifications } from '@/hooks/useSSENotifications';


const MaintenancePage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // Status
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [type, setType] = useState<MaintenanceType>('regular');
  const [startsAt, setStartsAt] = useState<Moment | null>(null);
  const updatedBySSE = useRef(false);

  const [endsAt, setEndsAt] = useState<Moment | null>(null);
  const [kickExistingPlayers, setKickExistingPlayers] = useState(false);

  // Input mode
  const [inputMode, setInputMode] = useState<'direct'|'template'|''>('');

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
      if (detail) {
        setType(detail.type);
        setStartsAt(detail.startsAt ? moment(detail.startsAt) : null);
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

  // Sync status with SSE
  useSSENotifications({
    autoConnect: true,
    onEvent: (event) => {
      if (event.type === 'maintenance_status_change') {
        const { isUnderMaintenance, detail } = event.data || {};
        updatedBySSE.current = true;
        setIsMaintenance(!!isUnderMaintenance);
        if (detail) {
          setType(detail.type);
          setStartsAt(detail.startsAt ? moment(detail.startsAt) : null);
          setEndsAt(detail.endsAt ? moment(detail.endsAt) : null);
          setBaseMsg(detail.message || '');
          const d: any[] = [];
          if (detail.messages?.ko) d.push({ lang: 'ko', message: detail.messages.ko });
          if (detail.messages?.en) d.push({ lang: 'en', message: detail.messages.en });
          if (detail.messages?.zh) d.push({ lang: 'zh', message: detail.messages.zh });
          setLocales(d as any);
        } else {
          setStartsAt(null);
          setEndsAt(null);
          setBaseMsg('');
          setLocales([]);
        }
      }
    }
  });

  const startMaintenance = async () => {
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
    await maintenanceService.setStatus(payload as any);
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
                        {t('admin.maintenance.startsAt')}: {startsAt.format('YYYY-MM-DD HH:mm')}
                      </Typography>
                    )}
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
                        onChange={setStartsAt}
                        slotProps={{ textField: { fullWidth: true } }}
                      />
                      <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary' }}>
                        {t('admin.maintenance.startsAtHelp')}
                      </Typography>
                    </Box>
                    <Box sx={{ width: 320 }}>
                      <DateTimePicker
                        label={t('admin.maintenance.endsAt')}
                        value={endsAt}
                        onChange={setEndsAt}
                        slotProps={{ textField: { fullWidth: true } }}
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
                      <MenuItem value="">{t('common.select')}</MenuItem>
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
            {confirmMode === 'start' ? (t('admin.maintenance.confirmStartTitle')) : (t('admin.maintenance.confirmStopTitle'))}
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
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

