import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  Tooltip,
  Paper,
  Stack,
  Divider,
  Autocomplete,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { Cancel as CancelIcon, Save as SaveIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  BulkCreateFormData,
  PlatformSpecificSettings,
  ClientStatus,
  ClientVersionMaintenanceLocale,
  CLIENT_VERSION_VALIDATION,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import FormDialogHeader from '../common/FormDialogHeader';
import { tagService } from '../../services/tagService';
import { PlatformDefaultsService } from '../../services/platformDefaultsService';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import MaintenanceSettingsInput from '../common/MaintenanceSettingsInput';
import { MessageTemplate, messageTemplateService } from '../../services/messageTemplateService';
import ResizableDrawer from '../common/ResizableDrawer';

// 클라이언트 상태 라벨 매핑
const ClientStatusLabels = {
  [ClientStatus.ONLINE]: 'clientVersions.status.online',
  [ClientStatus.OFFLINE]: 'clientVersions.status.offline',
  [ClientStatus.RECOMMENDED_UPDATE]: 'clientVersions.status.recommendedUpdate',
  [ClientStatus.FORCED_UPDATE]: 'clientVersions.status.forcedUpdate',
  [ClientStatus.UNDER_REVIEW]: 'clientVersions.status.underReview',
  [ClientStatus.BLOCKED_PATCH_ALLOWED]: 'clientVersions.status.blockedPatchAllowed',
  [ClientStatus.MAINTENANCE]: 'clientVersions.status.maintenance',
};

interface BulkClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}


// 폼 유효성 검사 스키마
const createValidationSchema = (t: any) => yup.object({
  clientVersion: yup
    .string()
    .required(t('clientVersions.form.versionRequired'))
    .matches(
      CLIENT_VERSION_VALIDATION.CLIENT_VERSION.PATTERN,
      t('clientVersions.form.versionInvalid')
    ),
  clientStatus: yup
    .string()
    .required(t('clientVersions.form.statusRequired'))
    .oneOf(Object.values(ClientStatus)),
  guestModeAllowed: yup.boolean().required(),
  externalClickLink: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.EXTERNAL_LINK.MAX_LENGTH)
    .optional(),
  memo: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.MEMO.MAX_LENGTH)
    .optional(),
  customPayload: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.CUSTOM_PAYLOAD.MAX_LENGTH)
    .optional(),
  platforms: yup
    .array()
    .of(
      yup.object({
        platform: yup.string().required(),
        gameServerAddress: yup
          .string()
          .required(t('clientVersions.form.gameServerRequired'))
          .min(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MIN_LENGTH)
          .max(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MAX_LENGTH),
        gameServerAddressForWhiteList: yup
          .string()
          .max(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MAX_LENGTH)
          .optional(),
        patchAddress: yup
          .string()
          .required(t('clientVersions.form.patchAddressRequired'))
          .min(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MIN_LENGTH)
          .max(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MAX_LENGTH),
        patchAddressForWhiteList: yup
          .string()
          .max(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MAX_LENGTH)
          .optional(),
      })
    )
    .min(1, t('clientVersions.form.selectAtLeastOnePlatform'))
    .required(),
  // 점검 관련 필드
  maintenanceStartDate: yup.string().optional(),
  maintenanceEndDate: yup.string().optional(),
  maintenanceMessage: yup
    .string()
    .when('clientStatus', {
      is: ClientStatus.MAINTENANCE,
      then: (schema) => schema.required(t('clientVersions.maintenance.messageRequired')),
      otherwise: (schema) => schema.optional(),
    }),
  supportsMultiLanguage: yup.boolean().optional(),
  maintenanceLocales: yup.array().optional(),
});

const BulkClientVersionForm: React.FC<BulkClientVersionFormProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { platforms } = usePlatformConfig();
  const [loading, setLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<{ id: number; name: string; color: string; description?: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<{ id: number; name: string; color: string }[]>([]);

  // 점검 관련 상태
  const [maintenanceLocales, setMaintenanceLocales] = useState<ClientVersionMaintenanceLocale[]>([]);
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

  // 메시지 소스 선택
  const [inputMode, setInputMode] = useState<'direct' | 'template'>('direct');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');

  // 기본값 설정
  const defaultValues: BulkCreateFormData = {
    clientVersion: '',
    clientStatus: ClientStatus.OFFLINE,
    guestModeAllowed: false,
    externalClickLink: '',
    memo: '',
    customPayload: '',
    maintenanceStartDate: '',
    maintenanceEndDate: '',
    maintenanceMessage: '',
    supportsMultiLanguage: false,
    maintenanceLocales: [],
    platforms: [],
    tags: [],
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
    setError,
  } = useForm<BulkCreateFormData>({
    resolver: yupResolver(createValidationSchema(t)),
    defaultValues,
  });

  // 폼 초기화
  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setSelectedPlatforms([]);
      setSelectedTags([]);
      setMaintenanceLocales([]);
      setSupportsMultiLanguage(false);
    }
  }, [open, reset]);

  // 태그 목록 및 메시지 템플릿 로드
  useEffect(() => {
    if (open) {
      const loadTags = async () => {
        try {
          const tags = await tagService.list();
          setAllTags(tags);
        } catch (error) {
          console.error('Failed to load tags:', error);
        }
      };

      const loadTemplates = async () => {
        try {
          const result = await messageTemplateService.list({ type: 'maintenance', isEnabled: true });
          setTemplates(result.templates);
        } catch (error) {
          console.error('Failed to load message templates:', error);
        }
      };

      loadTags();
      loadTemplates();
    }
  }, [open]);

  // 점검 메시지 로케일 관리 함수들
  const addMaintenanceLocale = (lang: 'ko' | 'en' | 'zh') => {
    if (!maintenanceLocales.find(l => l.lang === lang)) {
      const newLocales = [...maintenanceLocales, { lang, message: '' }];
      setMaintenanceLocales(newLocales);
      setValue('maintenanceLocales', newLocales);
    }
  };

  const updateMaintenanceLocale = (lang: 'ko' | 'en' | 'zh', message: string) => {
    const newLocales = maintenanceLocales.map(l =>
      l.lang === lang ? { ...l, message } : l
    );
    setMaintenanceLocales(newLocales);
    setValue('maintenanceLocales', newLocales);
  };

  const removeMaintenanceLocale = (lang: 'ko' | 'en' | 'zh') => {
    const newLocales = maintenanceLocales.filter(l => l.lang !== lang);
    setMaintenanceLocales(newLocales);
    setValue('maintenanceLocales', newLocales);
  };

  // 언어별 메시지 사용 여부 변경
  const handleSupportsMultiLanguageChange = (enabled: boolean) => {
    setSupportsMultiLanguage(enabled);
    setValue('supportsMultiLanguage', enabled);
    if (enabled) {
      // 활성화 시, 기존 값을 보존하면서 누락된 언어만 추가
      const availableLanguages = [
        { code: 'ko' as const, label: t('clientVersions.maintenance.korean') },
        { code: 'en' as const, label: t('clientVersions.maintenance.english') },
        { code: 'zh' as const, label: t('clientVersions.maintenance.chinese') },
      ];
      const merged = availableLanguages.map((lang) => {
        const existing = maintenanceLocales.find(l => l.lang === lang.code);
        return { lang: lang.code, message: existing?.message || '' } as any;
      });
      setMaintenanceLocales(merged);
      setValue('maintenanceLocales', merged);
    } else {
      // 비활성화 시, 입력값은 유지하고 UI만 숨김 (state/form 값은 건드리지 않음)
      // no-op
    }
  };

  // 현재 상태 감시
  const currentStatus = watch('clientStatus');
  const isMaintenanceMode = currentStatus === ClientStatus.MAINTENANCE;

  // 선택된 플랫폼이 변경될 때 platforms 배열 업데이트 및 기본값 적용
  useEffect(() => {
    const applyPlatformDefaults = async () => {
      const newPlatforms: PlatformSpecificSettings[] = await Promise.all(
        selectedPlatforms.map(async (platform) => {
          try {
            const defaults = await PlatformDefaultsService.getPlatformDefaults(platform);
            return {
              platform,
              gameServerAddress: defaults.gameServerAddress || '',
              gameServerAddressForWhiteList: '',
              patchAddress: defaults.patchAddress || '',
              patchAddressForWhiteList: '',
            };
          } catch (error) {
            console.error(`Failed to get defaults for platform ${platform}:`, error);
            return {
              platform,
              gameServerAddress: '',
              gameServerAddressForWhiteList: '',
              patchAddress: '',
              patchAddressForWhiteList: '',
            };
          }
        })
      );
      setValue('platforms', newPlatforms);
    };

    applyPlatformDefaults();
  }, [selectedPlatforms, setValue]);

  // 플랫폼 선택 핸들러
  const handlePlatformChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedPlatforms(typeof value === 'string' ? value.split(',') : value);
  };

  // 폼 제출 핸들러
  const onSubmit = async (data: BulkCreateFormData) => {
    // 플랫폼 선택 검증
    if (selectedPlatforms.length === 0) {
      setError('platforms', {
        type: 'manual',
        message: t('clientVersions.form.selectAtLeastOnePlatform')
      });
      return;
    }

    try {
      setLoading(true);

      // 템플릿 모드일 때 메시지 처리
      let finalMaintenanceMessage = data.maintenanceMessage;
      let finalMaintenanceLocales = maintenanceLocales.filter(l => l.message.trim() !== '');

      if (data.clientStatus === ClientStatus.MAINTENANCE && inputMode === 'template' && selectedTemplateId) {
        const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
        if (selectedTemplate) {
          finalMaintenanceMessage = selectedTemplate.defaultMessage || '';
          finalMaintenanceLocales = (selectedTemplate.locales || []).map(l => ({
            lang: l.lang as 'ko' | 'en' | 'zh',
            message: l.message || ''
          })).filter(l => l.message.trim() !== '');
        }
      }

      // 빈 문자열을 undefined로 변환하고 태그 데이터 포함
      const cleanedData = {
        ...data,
        externalClickLink: data.externalClickLink || undefined,
        memo: data.memo || undefined,
        customPayload: data.customPayload || undefined,
        maintenanceStartDate: data.maintenanceStartDate || undefined,
        maintenanceEndDate: data.maintenanceEndDate || undefined,
        maintenanceMessage: finalMaintenanceMessage || undefined,
        supportsMultiLanguage: data.supportsMultiLanguage || false,
        maintenanceLocales: finalMaintenanceLocales,
        platforms: data.platforms.map(platform => ({
          ...platform,
          gameServerAddressForWhiteList: platform.gameServerAddressForWhiteList || undefined,
          patchAddressForWhiteList: platform.patchAddressForWhiteList || undefined,
        })),
        // 선택된 태그를 포함 (필요한 필드만 전송)
        tags: selectedTags && selectedTags.length > 0
          ? selectedTags.map(tag => ({
            id: tag.id,
            name: tag.name,
            color: tag.color
          }))
          : []
      };

      const result = await ClientVersionService.bulkCreateClientVersions(cleanedData);

      enqueueSnackbar(
        t('clientVersions.bulkCreateSuccess', { count: result?.length || 0 }),
        { variant: 'success' }
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating client versions:', error);

      // Handle version validation error
      let errorMessage = error.message || t('clientVersions.bulkCreateFailed');
      if (error.message?.startsWith('VERSION_TOO_OLD:')) {
        const latestVersion = error.message.split(':')[1];
        errorMessage = t('clientVersions.versionTooOld', {
          newVersion: data.clientVersion,
          latestVersion
        });
      } else if (error.message?.startsWith('VERSION_TOO_OLD_BULK:')) {
        const platforms = error.message.split(':')[1];
        errorMessage = t('clientVersions.versionTooOldBulk', { platforms });
      } else if (error.message?.startsWith('DUPLICATE_CLIENT_VERSIONS:')) {
        const duplicates = error.message.split(':')[1];
        errorMessage = t('clientVersions.duplicateClientVersions', { duplicates });
      }

      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !loading) {
      onClose();
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={handleClose}
      title={t('clientVersions.bulkAdd')}
      subtitle={t('clientVersions.form.bulkDescription')}
      storageKey="bulkClientVersionFormDrawerWidth"
      defaultWidth={700}
      minWidth={500}
      zIndex={1300}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }}
      >
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                📋 {t('clientVersions.form.basicInfo')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.bulkBasicInfoDescription')}
              </Typography>

              <Stack spacing={2}>
                <Controller
                  name="clientVersion"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value || ''}
                      fullWidth
                      autoFocus
                      label={
                        <Box component="span">
                          {t('clientVersions.version')} <Typography component="span" color="error">*</Typography>
                        </Box>
                      }
                      placeholder={CLIENT_VERSION_VALIDATION.CLIENT_VERSION.EXAMPLE}
                      error={!!errors.clientVersion}
                      helperText={errors.clientVersion?.message || t('clientVersions.form.versionHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                <FormControl fullWidth error={!!errors.platforms}>
                  <InputLabel id="bulk-platform-label">
                    {t('clientVersions.selectPlatforms')} <Typography component="span" color="error">*</Typography>
                  </InputLabel>
                  <Select
                    labelId="bulk-platform-label"
                    multiple
                    value={selectedPlatforms}
                    onChange={handlePlatformChange}
                    input={<OutlinedInput label={`${t('clientVersions.selectPlatforms')} *`} />}
                    MenuProps={{
                      anchorOrigin: {
                        vertical: 'bottom',
                        horizontal: 'left',
                      },
                      transformOrigin: {
                        vertical: 'top',
                        horizontal: 'left',
                      }
                    }}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value.toUpperCase()} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {platforms.map((platform) => (
                      <MenuItem key={platform.value} value={platform.value}>
                        {platform.label}
                      </MenuItem>
                    ))}
                  </Select>
                  {(errors.platforms?.message || t('clientVersions.form.bulkPlatformHelp')) && (
                    <Typography variant="caption" color={errors.platforms ? "error" : "text.secondary"} sx={{ mt: 0.5, display: 'block' }}>
                      {errors.platforms?.message || t('clientVersions.form.bulkPlatformHelp')}
                    </Typography>
                  )}
                </FormControl>

                <Controller
                  name="clientStatus"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth variant="outlined">
                      <InputLabel id="bulk-status-label" shrink={true}>
                        {t('clientVersions.statusLabel')} <Typography component="span" color="error">*</Typography>
                      </InputLabel>
                      <Select
                        labelId="bulk-status-label"
                        {...field}
                        value={field.value || ClientStatus.OFFLINE}
                        label={`${t('clientVersions.statusLabel')} *`}
                        MenuProps={{
                          anchorOrigin: {
                            vertical: 'bottom',
                            horizontal: 'left',
                          },
                          transformOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                          }
                        }}
                      >
                        {Object.values(ClientStatus).map((status) => (
                          <MenuItem key={status} value={status}>
                            {t(ClientStatusLabels[status])}
                          </MenuItem>
                        ))}
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {t('clientVersions.form.statusHelp')}
                      </Typography>
                    </FormControl>
                  )}
                />

                {isMaintenanceMode && (
                  <MaintenanceSettingsInput
                    startDate={watch('maintenanceStartDate') || ''}
                    endDate={watch('maintenanceEndDate') || ''}
                    onStartDateChange={(date) => setValue('maintenanceStartDate', date)}
                    onEndDateChange={(date) => setValue('maintenanceEndDate', date)}
                    inputMode={inputMode}
                    onInputModeChange={setInputMode}
                    maintenanceMessage={watch('maintenanceMessage') || ''}
                    onMaintenanceMessageChange={(message) => setValue('maintenanceMessage', message)}
                    supportsMultiLanguage={supportsMultiLanguage}
                    onSupportsMultiLanguageChange={handleSupportsMultiLanguageChange}
                    maintenanceLocales={maintenanceLocales.map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
                    onMaintenanceLocalesChange={(locales) => {
                      setMaintenanceLocales(locales);
                      setValue('maintenanceLocales', locales);
                      // 번역 결과가 있으면 자동으로 언어별 메시지 사용 활성화
                      const hasNonEmptyLocales = locales.some(l => l.message && l.message.trim() !== '');
                      if (hasNonEmptyLocales && !supportsMultiLanguage) {
                        setSupportsMultiLanguage(true);
                        setValue('supportsMultiLanguage', true);
                      }
                    }}
                    templates={templates}
                    selectedTemplateId={selectedTemplateId}
                    onSelectedTemplateIdChange={setSelectedTemplateId}
                    messageError={!!errors.maintenanceMessage}
                    messageRequired={true}
                  />
                )}

              </Stack>
            </Paper>


            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                🏷️ {t('common.tags')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.tagsHelp')}
              </Typography>

              <Autocomplete
                multiple
                options={allTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                isOptionEqualToValue={(option, value) => option.id === value.id}
                value={selectedTags}
                onChange={(_, value) => {
                  setSelectedTags(value);
                  setValue('tags', value);
                }}
                slotProps={{
                  popper: {
                    style: {
                      zIndex: 99999
                    },
                    placement: 'bottom-start'
                  }
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                        <Chip
                          variant="outlined"
                          label={option.name}
                          size="small"
                          sx={{ bgcolor: option.color, color: '#fff' }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('common.tags')} helperText={t('clientVersions.form.bulkTagsHelp')} />
                )}
                renderOption={(props, option) => {
                  const { key, ...restProps } = props;
                  return (
                    <Box key={option.id} component="li" {...restProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Paper>

            <Accordion defaultExpanded={false} disableGutters sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.default' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1" sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  ⚙️ {t('clientVersions.form.additionalSettings')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('clientVersions.form.additionalSettingsDescription')}
                </Typography>

                <Stack spacing={2}>
                  <Controller
                    name="guestModeAllowed"
                    control={control}
                    render={({ field }) => (
                      <Box>
                        <FormControlLabel
                          control={<Switch {...field} checked={field.value || false} />}
                          label={t('clientVersions.guestModeAllowed')}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          {t('clientVersions.form.guestModeAllowedHelp')}
                        </Typography>
                      </Box>
                    )}
                  />

                  <Controller
                    name="externalClickLink"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value || ''}
                        fullWidth
                        label={t('clientVersions.externalClickLink')}
                        error={!!errors.externalClickLink}
                        helperText={errors.externalClickLink?.message || t('clientVersions.form.externalClickLinkHelp')}
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false
                        }}
                      />
                    )}
                  />

                  <Controller
                    name="memo"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        value={field.value || ''}
                        fullWidth
                        label={t('clientVersions.memo')}
                        multiline
                        rows={3}
                        error={!!errors.memo}
                        helperText={errors.memo?.message || t('clientVersions.form.memoHelp')}
                      />
                    )}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            {selectedPlatforms.length > 0 && (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  🌐 {t('clientVersions.form.serverAddresses')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('clientVersions.form.platformSpecificDescription')}
                </Typography>

                <Stack spacing={3}>
                  {selectedPlatforms.map((platform, index) => (
                    <Paper key={platform} elevation={1} sx={{ p: 2, bgcolor: 'background.paper' }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                        📱 {platform.toUpperCase()}
                      </Typography>

                      <Stack spacing={2}>
                        <Controller
                          name={`platforms.${index}.gameServerAddress`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              value={field.value || ''}
                              fullWidth
                              label={
                                <Box component="span">
                                  {t('clientVersions.gameServerAddress')} <Typography component="span" color="error">*</Typography>
                                </Box>
                              }
                              error={!!errors.platforms?.[index]?.gameServerAddress}
                              helperText={errors.platforms?.[index]?.gameServerAddress?.message || t('clientVersions.form.gameServerAddressHelp')}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                          )}
                        />

                        <Controller
                          name={`platforms.${index}.gameServerAddressForWhiteList`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              value={field.value || ''}
                              fullWidth
                              label={t('clientVersions.gameServerAddressForWhiteList')}
                              error={!!errors.platforms?.[index]?.gameServerAddressForWhiteList}
                              helperText={errors.platforms?.[index]?.gameServerAddressForWhiteList?.message || t('clientVersions.form.gameServerAddressForWhiteListHelp')}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                          )}
                        />

                        <Controller
                          name={`platforms.${index}.patchAddress`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              value={field.value || ''}
                              fullWidth
                              label={
                                <Box component="span">
                                  {t('clientVersions.patchAddress')} <Typography component="span" color="error">*</Typography>
                                </Box>
                              }
                              error={!!errors.platforms?.[index]?.patchAddress}
                              helperText={errors.platforms?.[index]?.patchAddress?.message || t('clientVersions.form.patchAddressHelp')}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                          )}
                        />

                        <Controller
                          name={`platforms.${index}.patchAddressForWhiteList`}
                          control={control}
                          render={({ field }) => (
                            <TextField
                              {...field}
                              value={field.value || ''}
                              fullWidth
                              label={t('clientVersions.patchAddressForWhiteList')}
                              error={!!errors.platforms?.[index]?.patchAddressForWhiteList}
                              helperText={errors.platforms?.[index]?.patchAddressForWhiteList?.message || t('clientVersions.form.patchAddressForWhiteListHelp')}
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false
                              }}
                            />
                          )}
                        />
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            )}

          </Stack>
        </Box>

        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}>
          <Button onClick={handleClose} disabled={loading} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || isSubmitting}
            startIcon={<SaveIcon />}
          >
            {loading ? t('clientVersions.creating') : t('clientVersions.bulkCreate')}
          </Button>
        </Box>
      </form>
    </ResizableDrawer>
  );
};

export default BulkClientVersionForm;
