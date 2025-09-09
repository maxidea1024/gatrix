import React, { useState, useEffect, useRef } from 'react';
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
  Divider,
  Paper,
  Stack,
  Autocomplete,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Save as SaveIcon,
  FileCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import FormDialogHeader from '../common/FormDialogHeader';
import {
  ClientVersion,
  ClientVersionFormData,
  ClientVersionMaintenanceLocale,
  ClientStatus,
  ClientStatusLabels,
  CLIENT_VERSION_VALIDATION,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import { tagService } from '../../services/tagService';
import JsonEditor from '../common/JsonEditor';

interface ClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientVersion?: ClientVersion | null;
  isCopyMode?: boolean;

}

// 폼 유효성 검사 스키마
const createValidationSchema = (t: any) => yup.object({
  platform: yup
    .string()
    .required(t('clientVersions.form.platformRequired'))
    .min(CLIENT_VERSION_VALIDATION.PLATFORM.MIN_LENGTH)
    .max(CLIENT_VERSION_VALIDATION.PLATFORM.MAX_LENGTH),
  clientVersion: yup
    .string()
    .required(t('clientVersions.form.versionRequired'))
    .matches(
      CLIENT_VERSION_VALIDATION.CLIENT_VERSION.PATTERN,
      t('clientVersions.form.versionInvalid')
    ),
  clientStatus: yup
    .string()
    .oneOf(Object.values(ClientStatus))
    .required(t('clientVersions.form.statusRequired')),
  gameServerAddress: yup
    .string()
    .required(t('clientVersions.form.gameServerRequired'))
    .min(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MIN_LENGTH)
    .max(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MAX_LENGTH),
  gameServerAddressForWhiteList: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.SERVER_ADDRESS.MAX_LENGTH)
    .notRequired(),
  patchAddress: yup
    .string()
    .required(t('clientVersions.form.patchAddressRequired'))
    .min(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MIN_LENGTH)
    .max(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MAX_LENGTH),
  patchAddressForWhiteList: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.PATCH_ADDRESS.MAX_LENGTH)
    .notRequired(),
  guestModeAllowed: yup.boolean().required(),
  externalClickLink: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.EXTERNAL_LINK.MAX_LENGTH)
    .notRequired(),
  memo: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.MEMO.MAX_LENGTH)
    .notRequired(),
  customPayload: yup
    .string()
    .max(CLIENT_VERSION_VALIDATION.CUSTOM_PAYLOAD.MAX_LENGTH)
    .notRequired(),
  // 점검 관련 필드
  maintenanceStartDate: yup.string().notRequired(),
  maintenanceEndDate: yup.string().notRequired(),
  maintenanceMessage: yup
    .string()
    .when('clientStatus', {
      is: 'MAINTENANCE',
      then: (schema) => schema.required(t('clientVersions.maintenance.messageRequired')),
      otherwise: (schema) => schema.notRequired(),
    }),
  supportsMultiLanguage: yup.boolean().notRequired(),
  maintenanceLocales: yup.array().notRequired(),
  tags: yup.array().notRequired(),
});

const ClientVersionForm: React.FC<ClientVersionFormProps> = ({
  open,
  onClose,
  onSuccess,
  clientVersion,
  isCopyMode = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const versionFieldRef = useRef<HTMLInputElement>(null);

  const isEdit = !!clientVersion && !isCopyMode;
  const [displayIsEdit, setDisplayIsEdit] = useState<boolean>(isEdit);
  const [displayIsCopy, setDisplayIsCopy] = useState<boolean>(!!isCopyMode);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<{ id: number; name: string; color: string; description?: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<{ id: number; name: string; color: string }[]>([]);

  // 점검 관련 상태
  const [maintenanceLocales, setMaintenanceLocales] = useState<ClientVersionMaintenanceLocale[]>([]);
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

  // 기본값 설정
  const defaultValues: ClientVersionFormData = {
    platform: 'pc', // 첫 번째 플랫폼을 기본값으로 설정
    clientVersion: '',
    clientStatus: ClientStatus.OFFLINE, // 첫 번째 상태를 기본값으로 설정
    gameServerAddress: '',
    gameServerAddressForWhiteList: '',
    patchAddress: '',
    patchAddressForWhiteList: '',
    guestModeAllowed: false,
    externalClickLink: '',
    memo: '',
    customPayload: '',
    maintenanceStartDate: '',
    maintenanceEndDate: '',
    maintenanceMessage: '',
    supportsMultiLanguage: false,
    maintenanceLocales: [],
    tags: [],
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<ClientVersionFormData>({
    resolver: yupResolver(createValidationSchema(t)),
    defaultValues,
  });

  // 현재 상태 감시
  const currentStatus = watch('clientStatus');
  const isMaintenanceMode = currentStatus === ClientStatus.MAINTENANCE;

  // 폼 초기화
  useEffect(() => {
    if (open) {
      // 렌더링 상태에서 표시용 모드는 오픈 시점 값으로 고정하여 버튼 라벨 깜빡임 방지
      setDisplayIsEdit(!!clientVersion && !isCopyMode);
      setDisplayIsCopy(!!isCopyMode);

      if (clientVersion) {
        // 편집 모드 또는 복사 모드일 때 기존 데이터로 초기화
        console.log('Initializing form with clientVersion data:', {
          isEdit,
          isCopyMode,
          clientVersion
        });

        reset({
          platform: clientVersion.platform,
          clientVersion: isCopyMode ? '' : clientVersion.clientVersion, // 복사 모드일 때만 버전 비움
          clientStatus: clientVersion.clientStatus,
          gameServerAddress: clientVersion.gameServerAddress,
          gameServerAddressForWhiteList: clientVersion.gameServerAddressForWhiteList || '',
          patchAddress: clientVersion.patchAddress,
          patchAddressForWhiteList: clientVersion.patchAddressForWhiteList || '',
          guestModeAllowed: clientVersion.guestModeAllowed,
          externalClickLink: clientVersion.externalClickLink || '',
          memo: clientVersion.memo || '',
          customPayload: clientVersion.customPayload || '',
          maintenanceStartDate: clientVersion.maintenanceStartDate || '',
          maintenanceEndDate: clientVersion.maintenanceEndDate || '',
          maintenanceMessage: clientVersion.maintenanceMessage || '',
          supportsMultiLanguage: clientVersion.supportsMultiLanguage || false,
          maintenanceLocales: clientVersion.maintenanceLocales || [],
          tags: clientVersion.tags || [],
        });
        setSelectedTags(clientVersion.tags || []);
        setMaintenanceLocales(clientVersion.maintenanceLocales || []);
        setSupportsMultiLanguage(clientVersion.supportsMultiLanguage || false);
      } else {
        // 새로 생성할 때 기본값으로 초기화
        console.log('Initializing form with default values');
        reset(defaultValues);
        setSelectedTags([]);
        setMaintenanceLocales([]);
        setSupportsMultiLanguage(false);
      }
      setDuplicateError(null);

      // 복사 모드이거나 새로 추가할 때 버전 필드에 포커스
      if (isCopyMode || !clientVersion) {
        setTimeout(() => {
          versionFieldRef.current?.focus();
        }, 100);
      }
    }
  }, [open, isEdit, isCopyMode, clientVersion, reset]);

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

  // 중복 검사
  const watchedValues = watch(['platform', 'clientVersion']);
  useEffect(() => {
    const [platform, version] = watchedValues;
    if (platform && version) {
      const checkDuplicate = async () => {
        try {
          const isDuplicate = await ClientVersionService.checkDuplicate(
            platform,
            version,
            isEdit ? clientVersion?.id : undefined
          );
          setDuplicateError(isDuplicate ? t('clientVersions.form.duplicateVersion') : null);
        } catch (error) {
          console.error('Error checking duplicate:', error);
        }
      };

      const timeoutId = setTimeout(checkDuplicate, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setDuplicateError(null);
    }
  }, [watchedValues, isEdit, clientVersion?.id, t]);

  // 폼 제출
  const onSubmit: SubmitHandler<ClientVersionFormData> = async (data) => {
    console.log('=== FORM SUBMIT START ===');
    console.log('Form data:', data);
    console.log('isEdit:', isEdit);
    console.log('isCopyMode:', isCopyMode);
    console.log('clientVersion:', clientVersion);

    if (duplicateError) {
      console.log('Form submission blocked due to duplicate error:', duplicateError);
      return;
    }

    try {
      setLoading(true);
      console.log('Starting form submission...');

      // 빈 문자열을 undefined로 변환하고 tags, maintenanceLocales 필드 제거 (별도 처리)
      const { tags, maintenanceLocales: formMaintenanceLocales, ...dataWithoutTags } = data;
      const cleanedData = {
        ...dataWithoutTags,
        gameServerAddressForWhiteList: data.gameServerAddressForWhiteList || undefined,
        patchAddressForWhiteList: data.patchAddressForWhiteList || undefined,
        externalClickLink: data.externalClickLink || undefined,
        memo: data.memo || undefined,
        customPayload: data.customPayload || undefined,
        maintenanceStartDate: data.maintenanceStartDate || undefined,
        maintenanceEndDate: data.maintenanceEndDate || undefined,
        maintenanceMessage: data.maintenanceMessage || undefined,
        supportsMultiLanguage: data.supportsMultiLanguage || false,
        maintenanceLocales: maintenanceLocales.filter(l => l.message.trim() !== ''),
      };

      console.log('Cleaned data to send:', cleanedData);

      let clientVersionId: number;

      if (isEdit && clientVersion) {
        console.log('Updating existing client version:', {
          id: clientVersion.id,
          isEdit,
          isCopyMode,
          hasClientVersion: !!clientVersion
        });

        if (!clientVersion.id) {
          throw new Error('Client version ID is missing');
        }

        console.log('About to call updateClientVersion API...');
        await ClientVersionService.updateClientVersion(clientVersion.id, cleanedData);
        console.log('updateClientVersion API call completed');
        clientVersionId = clientVersion.id;
        enqueueSnackbar(t('clientVersions.updateSuccess'), { variant: 'success' });
      } else {
        console.log('Creating new client version (copy mode or new):', {
          isEdit,
          isCopyMode,
          hasClientVersion: !!clientVersion
        });
        console.log('About to call createClientVersion API...');
        const created = await ClientVersionService.createClientVersion(cleanedData);
        console.log('createClientVersion API call completed');
        clientVersionId = created?.id;
        if (!clientVersionId) {
          throw new Error(t('common.cannotGetClientVersionId'));
        }
        enqueueSnackbar(t('clientVersions.createSuccess'), { variant: 'success' });
      }

      // 태그 설정
      if (selectedTags && selectedTags.length > 0) {
        const tagIds = selectedTags.map(tag => tag.id);
        await ClientVersionService.setTags(clientVersionId, tagIds);
      } else {
        // 태그가 없으면 기존 태그 모두 제거
        await ClientVersionService.setTags(clientVersionId, []);
      }

      console.log('Form submission successful');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving client version:', error);
      enqueueSnackbar(error.message || t('clientVersions.saveError', 'Failed to save client version'), { variant: 'error' });
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
        title={isCopyMode
          ? t('clientVersions.form.copyTitle')
          : isEdit
            ? t('clientVersions.form.editTitle')
            : t('clientVersions.form.title')
        }
        description={isCopyMode
          ? t('clientVersions.form.copyDescription')
          : isEdit
            ? t('clientVersions.form.editDescription')
            : t('clientVersions.form.createDescription')
        }
      />

      <form onSubmit={handleSubmit(onSubmit as SubmitHandler<ClientVersionFormData>, (errors) => {
        console.log('Form validation failed:', errors);
      })}>
        <DialogContent dividers>
          {duplicateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {duplicateError}
            </Alert>
          )}

          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 기본 정보 섹션 */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                📋 {t('clientVersions.form.basicInfo')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.basicInfoDescription')}
              </Typography>

              <Stack spacing={2}>
                {/* 버전 필드 */}
                <Controller
                  name="clientVersion"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      inputRef={versionFieldRef}
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

                {/* 플랫폼 필드 */}
                <Controller
                  name="platform"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.platform}>
                      <InputLabel id="cvf-platform-label">
                        {t('clientVersions.platform')} <Typography component="span" color="error">*</Typography>
                      </InputLabel>
                      <Select
                        labelId="cvf-platform-label"
                        {...field}
                        label={`${t('clientVersions.platform')} *`}
                      >
                        {['pc','pc-wegame','ios','android','harmonyos'].map((p) => (
                          <MenuItem key={p} value={p}>
                            {p}
                          </MenuItem>
                        ))}
                      </Select>
                      {(errors.platform?.message || t('clientVersions.form.platformHelp')) && (
                        <Typography variant="caption" color={errors.platform ? "error" : "text.secondary"} sx={{ mt: 0.5, display: 'block' }}>
                          {errors.platform?.message || t('clientVersions.form.platformHelp')}
                        </Typography>
                      )}
                    </FormControl>
                  )}
                />

                {/* 상태 필드 */}
                <Controller
                  name="clientStatus"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth variant="outlined">
                      <InputLabel id="cvf-status-label" shrink={true}>
                        {t('clientVersions.statusLabel')} <Typography component="span" color="error">*</Typography>
                      </InputLabel>
                      <Select
                        labelId="cvf-status-label"
                        {...field}
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

            {/* 서버 주소 섹션 */}
            <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                🌐 {t('clientVersions.form.serverAddresses')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.serverAddressesDescription')}
              </Typography>

              <Stack spacing={2}>

                {/* 게임 서버 주소 */}
                <Controller
                  name="gameServerAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={
                        <Box component="span">
                          {t('clientVersions.gameServerAddress')} <Typography component="span" color="error">*</Typography>
                        </Box>
                      }
                      error={!!errors.gameServerAddress}
                      helperText={errors.gameServerAddress?.message || t('clientVersions.form.gameServerAddressHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 게임 서버 주소 (화이트리스트용) */}
                <Controller
                  name="gameServerAddressForWhiteList"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('clientVersions.gameServerAddressForWhiteList')}
                      error={!!errors.gameServerAddressForWhiteList}
                      helperText={errors.gameServerAddressForWhiteList?.message || t('clientVersions.form.gameServerAddressForWhiteListHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 패치 주소 */}
                <Controller
                  name="patchAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={
                        <Box component="span">
                          {t('clientVersions.patchAddress')} <Typography component="span" color="error">*</Typography>
                        </Box>
                      }
                      error={!!errors.patchAddress}
                      helperText={errors.patchAddress?.message || t('clientVersions.form.patchAddressHelp')}
                      inputProps={{
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false
                      }}
                    />
                  )}
                />

                {/* 패치 주소 (화이트리스트용) */}
                <Controller
                  name="patchAddressForWhiteList"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('clientVersions.patchAddressForWhiteList')}
                      error={!!errors.patchAddressForWhiteList}
                      helperText={errors.patchAddressForWhiteList?.message || t('clientVersions.form.patchAddressForWhiteListHelp')}
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
                        control={
                          <Switch
                            checked={field.value}
                            onChange={field.onChange}
                          />
                        }
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
                      fullWidth
                      multiline
                      rows={3}
                      label={t('clientVersions.memo')}
                      error={!!errors.memo}
                      helperText={errors.memo?.message || t('clientVersions.form.memoHelp')}
                    />
                  )}
                />

                {/* 커스텀 페이로드 */}
                <Controller
                  name="customPayload"
                  control={control}
                  render={({ field }) => (
                    <JsonEditor
                      value={field.value || '{}'}
                      onChange={(newValue) => {
                        field.onChange(newValue);
                      }}
                      height="200px"
                      label={t('clientVersions.customPayload')}
                      placeholder='{\n  "key": "value"\n}'
                      error={errors.customPayload?.message}
                      helperText={t('clientVersions.form.customPayloadHelp')}
                    />
                  )}
                />

                {/* 태그 선택 */}
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
                    <TextField {...params} label={t('common.tags')} helperText={t('clientVersions.form.tagsHelp')} />
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
              </Stack>
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={isSubmitting || loading} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || loading || !!duplicateError}
            startIcon={displayIsCopy ? <CopyIcon /> : <SaveIcon />}
            onClick={() => {
              console.log('Submit button clicked!', {
                isSubmitting,
                loading,
                duplicateError,
                disabled: isSubmitting || loading || !!duplicateError,
                formErrors: errors,
                hasErrors: Object.keys(errors).length > 0
              });
            }}
          >
            {displayIsCopy
              ? t('clientVersions.form.copyTitle')
              : displayIsEdit
                ? t('clientVersions.form.updateTitle')
                : t('clientVersions.form.createTitle')
            }
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ClientVersionForm;
