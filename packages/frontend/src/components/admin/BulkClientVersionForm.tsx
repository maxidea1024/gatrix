import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
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
} from '@mui/material';
import { Cancel as CancelIcon, Save as SaveIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
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

// 사용 가능한 플랫폼 목록 (기존 개별 추가 폼과 동일)
const AVAILABLE_PLATFORMS = [
  'pc',
  'pc-wegame',
  'ios',
  'android',
  'harmonyos',
];

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
      is: 'MAINTENANCE',
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
  const [loading, setLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<{ id: number; name: string; color: string; description?: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<{ id: number; name: string; color: string }[]>([]);

  // 점검 관련 상태
  const [maintenanceLocales, setMaintenanceLocales] = useState<ClientVersionMaintenanceLocale[]>([]);
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

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

  // 태그 목록 로드
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
      loadTags();
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
      // 모든 언어를 자동으로 초기화
      const allLanguageLocales = availableLanguages.map(lang => ({
        lang: lang.code,
        message: ''
      }));
      setMaintenanceLocales(allLanguageLocales);
      setValue('maintenanceLocales', allLanguageLocales);
    } else {
      setMaintenanceLocales([]);
      setValue('maintenanceLocales', []);
    }
  };

  // 사용 가능한 언어 목록
  const availableLanguages = [
    { code: 'ko' as const, label: t('clientVersions.maintenance.korean') },
    { code: 'en' as const, label: t('clientVersions.maintenance.english') },
    { code: 'zh' as const, label: t('clientVersions.maintenance.chinese') },
  ];

  const usedLanguages = new Set(maintenanceLocales.map(l => l.lang));
  const availableToAdd = availableLanguages.filter(l => !usedLanguages.has(l.code));

  // 날짜 로케일 설정
  const getDateLocale = () => {
    const currentLang = t('language') || 'ko';
    switch (currentLang) {
      case 'en':
        dayjs.locale('en');
        return 'en';
      case 'zh':
        dayjs.locale('zh-cn');
        return 'zh-cn';
      default:
        dayjs.locale('ko');
        return 'ko';
    }
  };

  // 현재 상태 감시
  const currentStatus = watch('clientStatus');
  const isMaintenanceMode = currentStatus === ClientStatus.MAINTENANCE;

  // 선택된 플랫폼이 변경될 때 platforms 배열 업데이트
  useEffect(() => {
    const newPlatforms: PlatformSpecificSettings[] = selectedPlatforms.map(platform => ({
      platform,
      gameServerAddress: '',
      gameServerAddressForWhiteList: '',
      patchAddress: '',
      patchAddressForWhiteList: '',
    }));
    setValue('platforms', newPlatforms);
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

      // 빈 문자열을 undefined로 변환하고 태그 데이터 포함
      const cleanedData = {
        ...data,
        externalClickLink: data.externalClickLink || undefined,
        memo: data.memo || undefined,
        customPayload: data.customPayload || undefined,
        maintenanceStartDate: data.maintenanceStartDate || undefined,
        maintenanceEndDate: data.maintenanceEndDate || undefined,
        maintenanceMessage: data.maintenanceMessage || undefined,
        supportsMultiLanguage: data.supportsMultiLanguage || false,
        maintenanceLocales: maintenanceLocales.filter(l => l.message.trim() !== ''),
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
      enqueueSnackbar(
        error.message || t('clientVersions.bulkCreateFailed'),
        { variant: 'error' }
      );
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <FormDialogHeader
        title={t('clientVersions.bulkAdd')}
        description={t('clientVersions.form.bulkDescription')}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 기본 정보 섹션 */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                📋 {t('clientVersions.form.basicInfo')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.bulkBasicInfoDescription')}
              </Typography>

              <Stack spacing={2}>
                {/* 버전 필드 */}
                <Controller
                  name="clientVersion"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      value={field.value || ''}
                      fullWidth
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

                {/* 플랫폼 선택 (멀티셀렉트) */}
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
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip key={value} label={value.toUpperCase()} size="small" />
                        ))}
                      </Box>
                    )}
                  >
                    {AVAILABLE_PLATFORMS.map((platform) => (
                      <MenuItem key={platform} value={platform}>
                        {platform.toUpperCase()}
                      </MenuItem>
                    ))}
                  </Select>
                  {(errors.platforms?.message || t('clientVersions.form.bulkPlatformHelp')) && (
                    <Typography variant="caption" color={errors.platforms ? "error" : "text.secondary"} sx={{ mt: 0.5, display: 'block' }}>
                      {errors.platforms?.message || t('clientVersions.form.bulkPlatformHelp')}
                    </Typography>
                  )}
                </FormControl>

                {/* 상태 */}
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
              </Stack>
            </Paper>

            {/* 점검 설정 섹션 */}
            {isMaintenanceMode && (
              <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" gutterBottom sx={{ color: 'warning.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                  🔧 {t('clientVersions.maintenance.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('clientVersions.maintenance.description')}
                </Typography>

                <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={getDateLocale()}>
                  <Stack spacing={2}>
                    {/* 점검 시작일 */}
                    <Controller
                      name="maintenanceStartDate"
                      control={control}
                      render={({ field }) => (
                        <DateTimePicker
                          label={t('clientVersions.maintenance.startDate')}
                          value={field.value ? dayjs(field.value) : null}
                          onChange={(date) => field.onChange(date ? date.toISOString() : '')}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              helperText: t('clientVersions.maintenance.startDateHelp'),
                              error: !!errors.maintenanceStartDate,
                            },
                          }}
                        />
                      )}
                    />

                    {/* 점검 종료일 */}
                    <Controller
                      name="maintenanceEndDate"
                      control={control}
                      render={({ field }) => (
                        <DateTimePicker
                          label={t('clientVersions.maintenance.endDate')}
                          value={field.value ? dayjs(field.value) : null}
                          onChange={(date) => field.onChange(date ? date.toISOString() : '')}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              helperText: t('clientVersions.maintenance.endDateHelp'),
                              error: !!errors.maintenanceEndDate,
                            },
                          }}
                        />
                      )}
                    />

                    {/* 기본 점검 메시지 */}
                    <Controller
                      name="maintenanceMessage"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          multiline
                          rows={3}
                          label={t('clientVersions.maintenance.defaultMessage')}
                          helperText={t('clientVersions.maintenance.defaultMessageHelp')}
                          error={!!errors.maintenanceMessage}
                          required={watch('clientStatus') === 'maintenance'}
                        />
                      )}
                    />

                    {/* 언어별 메시지 사용 여부 */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={supportsMultiLanguage}
                          onChange={(e) => handleSupportsMultiLanguageChange(e.target.checked)}
                        />
                      }
                      label={t('clientVersions.maintenance.supportsMultiLanguage')}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {t('clientVersions.maintenance.supportsMultiLanguageHelp')}
                    </Typography>

                    {/* 언어별 메시지 */}
                    {supportsMultiLanguage && (
                      <Box>
                        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
                          {t('clientVersions.maintenance.languageSpecificMessages')}
                        </Typography>

                        {/* 모든 언어별 메시지 입력 */}
                        {availableLanguages.map((lang) => {
                          const locale = maintenanceLocales.find(l => l.lang === lang.code);
                          return (
                            <Box key={lang.code} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                {lang.label}
                              </Typography>
                              <TextField
                                fullWidth
                                multiline
                                rows={3}
                                value={locale?.message || ''}
                                onChange={(e) => updateMaintenanceLocale(lang.code, e.target.value)}
                                placeholder={t(`maintenanceMessage.${lang.code}Help`)}
                              />
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Stack>
                </LocalizationProvider>
              </Paper>
            )}

            {/* 추가 설정 섹션 */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                ⚙️ {t('clientVersions.form.additionalSettings')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.additionalSettingsDescription')}
              </Typography>

              <Stack spacing={2}>
                {/* 게스트 모드 허용 */}
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

                {/* 외부 클릭 링크 */}
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

                {/* 메모 */}
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
            </Paper>

            {/* 플랫폼별 서버 주소 설정 */}
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

            {/* 태그 선택 섹션 */}
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
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Chip
                      label={option.name}
                      size="small"
                      sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                    />
                    {option.description || t('common.noDescription')}
                  </Box>
                )}
              />
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions>
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
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default BulkClientVersionForm;
