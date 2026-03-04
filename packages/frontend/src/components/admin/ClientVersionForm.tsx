import React, { useState, useEffect, useRef } from 'react';
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
  Divider,
  Paper,
  Stack,
  Autocomplete,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Save as SaveIcon,
  FileCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
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
import { PlatformDefaultsService } from '../../services/platformDefaultsService';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import JsonEditor from '../common/JsonEditor';
import MaintenanceSettingsInput from '../common/MaintenanceSettingsInput';
import { MessageTemplate, messageTemplateService } from '../../services/messageTemplateService';
import { MessageLocale } from '../common/MultiLanguageMessageInput';
import { getContrastColor } from '@/utils/colorUtils';
import { parseApiErrorMessage } from '@/utils/errorUtils';
import { showChangeRequestCreatedToast } from '@/utils/changeRequestToast';
import { useNavigate } from 'react-router-dom';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { getActionLabel } from '@/utils/changeRequestToast';

interface ClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientVersion?: ClientVersion | null;
  isCopyMode?: boolean;
}

// 폼 유효성 검사 스키마
const createValidationSchema = (t: any) =>
  yup.object({
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
    memo: yup.string().max(CLIENT_VERSION_VALIDATION.MEMO.MAX_LENGTH).notRequired(),
    customPayload: yup
      .string()
      .max(CLIENT_VERSION_VALIDATION.CUSTOM_PAYLOAD.MAX_LENGTH)
      .notRequired(),
    // 점검 관련 필드
    maintenanceStartDate: yup.string().notRequired(),
    maintenanceEndDate: yup.string().notRequired(),
    maintenanceMessage: yup.string().when('clientStatus', {
      is: ClientStatus.MAINTENANCE,
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
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { currentEnvironment } = useEnvironment();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;
  const { platforms } = usePlatformConfig();
  const [loading, setLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const versionFieldRef = useRef<HTMLInputElement>(null);

  const isEdit = !!clientVersion && !isCopyMode;
  const [displayIsEdit, setDisplayIsEdit] = useState<boolean>(isEdit);
  const [displayIsCopy, setDisplayIsCopy] = useState<boolean>(!!isCopyMode);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<
    { id: number; name: string; color: string; description?: string }[]
  >([]);
  const [selectedTags, setSelectedTags] = useState<
    { id: number; name: string; color: string; description?: string }[]
  >([]);

  // 점검 관련 상태
  const [maintenanceLocales, setMaintenanceLocales] = useState<ClientVersionMaintenanceLocale[]>(
    []
  );
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

  // 메시지 소스 선택
  const [inputMode, setInputMode] = useState<'direct' | 'template'>('direct');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');

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
    formState: { errors, isSubmitting, isDirty },
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<ClientVersionFormData>({
    resolver: yupResolver(createValidationSchema(t)) as any,
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
          clientVersion,
        });

        (async () => {
          let source: any = clientVersion;
          try {
            // 목록에서 온 데이터에는 maintenanceLocales가 비어있을 수 있으므로 상세 재조회
            if (
              (!source.maintenanceLocales || source.maintenanceLocales.length === 0) &&
              source.id
            ) {
              const full = await ClientVersionService.getClientVersionById(
                projectApiPath,
                source.id
              );
              if (full) source = full as any;
            }
          } catch (e) {
            console.warn('Failed to load full client version details:', e);
          }

          reset({
            platform: source.platform,
            clientVersion: isCopyMode ? '' : source.clientVersion, // 복사 모드일 때만 버전 비움
            clientStatus: source.clientStatus,
            gameServerAddress: source.gameServerAddress,
            gameServerAddressForWhiteList: source.gameServerAddressForWhiteList || '',
            patchAddress: source.patchAddress,
            patchAddressForWhiteList: source.patchAddressForWhiteList || '',
            guestModeAllowed: source.guestModeAllowed,
            externalClickLink: source.externalClickLink || '',
            memo: source.memo || '',
            customPayload: source.customPayload || '',
            maintenanceStartDate: source.maintenanceStartDate || '',
            maintenanceEndDate: source.maintenanceEndDate || '',
            maintenanceMessage: source.maintenanceMessage || '',
            // supportsMultiLanguage가 false여도 로케일 데이터가 있으면 활성화
            supportsMultiLanguage:
              (source.supportsMultiLanguage ?? false) ||
              !!(source.maintenanceLocales && source.maintenanceLocales.length > 0),
            // 서버 언어코드 정규화
            maintenanceLocales: (source.maintenanceLocales || []).map((l: any) => ({
              lang: normalizeLangCode(l.lang),
              message: l.message || '',
            })),
            tags: source.tags || [],
          });
          setSelectedTags(source.tags || []);
          const normalizedLocales = (source.maintenanceLocales || []).map((l: any) => ({
            lang: normalizeLangCode(l.lang),
            message: l.message || '',
          }));
          setMaintenanceLocales(normalizedLocales);
          setSupportsMultiLanguage(
            (source.supportsMultiLanguage ?? false) || normalizedLocales.length > 0
          );
        })();
      } else {
        // 새로 생성할 때 기본값으로 초기화
        console.log('Initializing form with default values');
        reset(defaultValues);
        setSelectedTags([]);
        setMaintenanceLocales([]);
        setSupportsMultiLanguage(false);
        setInputMode('direct');
        setSelectedTemplateId('');

        // 초기 플랫폼(예: 'pc')에 대한 기본값을 즉시 적용 (필드가 비어있는 경우에만)
        (async () => {
          try {
            const initialPlatform = getValues('platform') || defaultValues.platform;
            if (initialPlatform) {
              const defaults = await PlatformDefaultsService.getPlatformDefaults(
                projectApiPath,
                initialPlatform
              );
              const currentGame = getValues('gameServerAddress');
              const currentPatch = getValues('patchAddress');
              if (!currentGame && defaults.gameServerAddress) {
                setValue('gameServerAddress', defaults.gameServerAddress);
              }
              if (!currentPatch && defaults.patchAddress) {
                setValue('patchAddress', defaults.patchAddress);
              }
            }
          } catch (e) {
            console.error('Failed to apply initial platform defaults:', e);
          }
        })();
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
          const tags = await tagService.list(projectApiPath);
          setAllTags(tags);
        } catch (error) {
          console.error('Failed to load tags:', error);
        }
      };
      loadTags();
    }
  }, [open]);

  // 메시지 템플릿 로드
  useEffect(() => {
    if (open) {
      const loadTemplates = async () => {
        try {
          const response = await messageTemplateService.list(projectApiPath, {
            isEnabled: true,
          });
          setTemplates(response.templates || []);
        } catch (error) {
          console.error('Failed to load message templates:', error);
          setTemplates([]);
        }
      };
      loadTemplates();
    }
  }, [open]);

  // 언어 코드 정규화 (서버가 ko-KR, en-US, zh-CN 등으로 줄 수 있음)
  const normalizeLangCode = (code: string): 'ko' | 'en' | 'zh' => {
    const lower = (code || '').toLowerCase();
    if (lower.startsWith('ko')) return 'ko';
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('zh')) return 'zh';
    return 'en';
  };

  // 점검 메시지 로케일 관리 함수들
  const addMaintenanceLocale = (lang: 'ko' | 'en' | 'zh') => {
    if (!maintenanceLocales.find((l) => l.lang === lang)) {
      const newLocales = [...maintenanceLocales, { lang, message: '' }];
      setMaintenanceLocales(newLocales);
      setValue('maintenanceLocales', newLocales, { shouldDirty: true });
    }
  };

  const updateMaintenanceLocale = (lang: 'ko' | 'en' | 'zh', message: string) => {
    const newLocales = maintenanceLocales.map((l) => (l.lang === lang ? { ...l, message } : l));
    setMaintenanceLocales(newLocales);
    setValue('maintenanceLocales', newLocales, { shouldDirty: true });
  };

  const removeMaintenanceLocale = (lang: 'ko' | 'en' | 'zh') => {
    const newLocales = maintenanceLocales.filter((l) => l.lang !== lang);
    setMaintenanceLocales(newLocales);
    setValue('maintenanceLocales', newLocales, { shouldDirty: true });
  };

  // 언어별 메시지 사용 여부 변경
  const handleSupportsMultiLanguageChange = (enabled: boolean) => {
    setSupportsMultiLanguage(enabled);
    setValue('supportsMultiLanguage', enabled, { shouldDirty: true });
    if (enabled) {
      // 활성화 시, 기존 값을 보존하면서 누락된 언어만 추가
      const merged = availableLanguages.map((lang) => {
        const existing = maintenanceLocales.find((l) => l.lang === lang.code);
        return { lang: lang.code, message: existing?.message || '' } as any;
      });
      setMaintenanceLocales(merged);
      setValue('maintenanceLocales', merged, { shouldDirty: true });
    } else {
      // 비활성화 시, 입력값은 유지하고 UI만 숨김 (state/폼 값은 건드리지 않음)
      // no-op
    }
  };

  // 사용 가능한 언어 목록
  const availableLanguages = [
    { code: 'ko' as const, label: t('clientVersions.maintenance.korean') },
    { code: 'en' as const, label: t('clientVersions.maintenance.english') },
    { code: 'zh' as const, label: t('clientVersions.maintenance.chinese') },
  ];

  const usedLanguages = new Set(maintenanceLocales.map((l) => l.lang));
  const availableToAdd = availableLanguages.filter((l) => !usedLanguages.has(l.code));

  // 날짜 로케일 설정
  const getDateLocale = () => {
    const currentLang = t('language');
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
            projectApiPath,
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

  // 플랫폼 변경 시 기본값 적용
  const watchedPlatform = watch('platform');
  useEffect(() => {
    if (watchedPlatform && !isEdit) {
      // 새로 추가하는 경우에만 기본값 적용
      const applyDefaults = async () => {
        try {
          const defaults = await PlatformDefaultsService.getPlatformDefaults(
            projectApiPath,
            watchedPlatform
          );

          // 플랫폼 기본값을 적용 (기존 값과 상관없이 덮어쓰기)
          if (defaults.gameServerAddress) {
            setValue('gameServerAddress', defaults.gameServerAddress);
          }
          if (defaults.patchAddress) {
            setValue('patchAddress', defaults.patchAddress);
          }
        } catch (error) {
          console.error('Failed to apply platform defaults:', error);
        }
      };

      applyDefaults();
    }
  }, [watchedPlatform, isEdit, setValue, getValues]);

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

      // 템플릿 모드일 때 메시지 처리
      let finalMaintenanceMessage = data.maintenanceMessage;
      let finalMaintenanceLocales = maintenanceLocales.filter((l) => l.message.trim() !== '');

      if (
        data.clientStatus === ClientStatus.MAINTENANCE &&
        inputMode === 'template' &&
        selectedTemplateId
      ) {
        const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
        if (selectedTemplate) {
          finalMaintenanceMessage = selectedTemplate.defaultMessage || '';
          finalMaintenanceLocales = (selectedTemplate.locales || [])
            .map((l) => ({
              lang: l.lang as 'ko' | 'en' | 'zh',
              message: l.message || '',
            }))
            .filter((l) => l.message.trim() !== '');
        }
      }

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
        maintenanceMessage: finalMaintenanceMessage || undefined,
        supportsMultiLanguage: data.supportsMultiLanguage || false,
        maintenanceLocales: finalMaintenanceLocales,
      };

      console.log('Cleaned data to send:', cleanedData);

      let clientVersionId: number;

      if (isEdit && clientVersion) {
        console.log('Updating existing client version:', {
          id: clientVersion.id,
          isEdit,
          isCopyMode,
          hasClientVersion: !!clientVersion,
        });

        if (!clientVersion.id) {
          throw new Error('Client version ID is missing');
        }

        console.log('About to call updateClientVersion API...');
        const updateResult = await ClientVersionService.updateClientVersion(
          projectApiPath,
          clientVersion.id,
          cleanedData
        );
        console.log('updateClientVersion API call completed');

        if (updateResult.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
          onSuccess();
          onClose();
          return;
        }

        clientVersionId = clientVersion.id;
        enqueueSnackbar(t('clientVersions.updateSuccess'), {
          variant: 'success',
        });
      } else {
        console.log('Creating new client version (copy mode or new):', {
          isEdit,
          isCopyMode,
          hasClientVersion: !!clientVersion,
        });
        console.log('About to call createClientVersion API...');
        const createResult = await ClientVersionService.createClientVersion(
          projectApiPath,
          cleanedData
        );
        console.log('createClientVersion API call completed');

        if (createResult.isChangeRequest) {
          showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
          onSuccess();
          onClose();
          return;
        }

        clientVersionId = createResult.clientVersion?.id;
        if (!clientVersionId) {
          throw new Error(t('common.cannotGetClientVersionId'));
        }
        enqueueSnackbar(
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            클라이언트 버전{' '}
            <Chip
              size="small"
              color="primary"
              label={`${data.clientVersion}:${String(data.platform || '').toUpperCase()}`}
              sx={{ fontWeight: 600 }}
            />{' '}
            을 등록했습니다.
          </Box>,
          { variant: 'success' }
        );
      }

      // 태그 설정
      if (selectedTags && selectedTags.length > 0) {
        const tagIds = selectedTags.map((tag) => tag.id);
        await ClientVersionService.setTags(projectApiPath, clientVersionId, tagIds);
      } else {
        // 태그가 없으면 기존 태그 모두 제거
        await ClientVersionService.setTags(projectApiPath, clientVersionId, []);
      }

      console.log('Form submission successful');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving client version:', error);
      const errorMessage = parseApiErrorMessage(error, 'clientVersions.saveError');
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

  const title = isCopyMode
    ? t('clientVersions.form.copyTitle')
    : isEdit
      ? t('clientVersions.form.editTitle')
      : t('clientVersions.form.title');

  const subtitle = isCopyMode
    ? t('clientVersions.form.copyDescription')
    : isEdit
      ? t('clientVersions.form.editDescription')
      : t('clientVersions.form.createDescription');

  return (
    <ResizableDrawer
      open={open}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      storageKey="clientVersionFormDrawerWidth"
      defaultWidth={700}
      minWidth={500}
      zIndex={1300}
    >
      <form
        onSubmit={handleSubmit(onSubmit as any, (errors) => {
          console.log('Form validation failed:', errors);
        })}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Content - Scrollable */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          {duplicateError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {duplicateError}
            </Alert>
          )}

          <Stack spacing={3} sx={{ mt: 1 }}>
            {/* 기본 정보 섹션 */}
            <Paper variant="outlined" elevation={0} sx={{ p: 2 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                📋 {t('clientVersions.form.basicInfo')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.basicInfoDescription')}
              </Typography>

              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2 }}>
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
                            {t('clientVersions.version')}{' '}
                            <Typography component="span" color="error">
                              *
                            </Typography>
                          </Box>
                        }
                        placeholder={CLIENT_VERSION_VALIDATION.CLIENT_VERSION.EXAMPLE}
                        error={!!errors.clientVersion}
                        helperText={
                          errors.clientVersion?.message || t('clientVersions.form.versionHelp')
                        }
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
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
                          {t('clientVersions.platform')}{' '}
                          <Typography component="span" color="error">
                            *
                          </Typography>
                        </InputLabel>
                        <Select
                          labelId="cvf-platform-label"
                          {...field}
                          label={`${t('clientVersions.platform')} *`}
                          MenuProps={{
                            anchorOrigin: {
                              vertical: 'bottom',
                              horizontal: 'left',
                            },
                            transformOrigin: {
                              vertical: 'top',
                              horizontal: 'left',
                            },
                          }}
                          onChange={async (e) => {
                            field.onChange(e);

                            // 새로 추가하는 경우에만 기본값 적용
                            if (!isEdit && e.target.value) {
                              try {
                                const defaults = await PlatformDefaultsService.getPlatformDefaults(
                                  projectApiPath,
                                  e.target.value as string
                                );

                                // 플랫폼 기본값을 적용 (기존 값과 상관없이 덮어쓰기)
                                if (defaults.gameServerAddress) {
                                  setValue('gameServerAddress', defaults.gameServerAddress);
                                }
                                if (defaults.patchAddress) {
                                  setValue('patchAddress', defaults.patchAddress);
                                }
                              } catch (error) {
                                console.error('Failed to apply platform defaults:', error);
                              }
                            }
                          }}
                        >
                          {platforms.map((p) => (
                            <MenuItem key={p.value} value={p.value}>
                              {p.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {(errors.platform?.message || t('clientVersions.form.platformHelp')) && (
                          <Typography
                            variant="caption"
                            color={errors.platform ? 'error' : 'text.secondary'}
                            sx={{ mt: 0.5, display: 'block' }}
                          >
                            {errors.platform?.message || t('clientVersions.form.platformHelp')}
                          </Typography>
                        )}
                      </FormControl>
                    )}
                  />
                </Box>

                {/* 상태 필드 */}
                <Controller
                  name="clientStatus"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth variant="outlined">
                      <InputLabel id="cvf-status-label" shrink={true}>
                        {t('clientVersions.statusLabel')}{' '}
                        <Typography component="span" color="error">
                          *
                        </Typography>
                      </InputLabel>
                      <Select
                        labelId="cvf-status-label"
                        {...field}
                        label={`${t('clientVersions.statusLabel')} *`}
                        MenuProps={{
                          anchorOrigin: {
                            vertical: 'bottom',
                            horizontal: 'left',
                          },
                          transformOrigin: {
                            vertical: 'top',
                            horizontal: 'left',
                          },
                        }}
                      >
                        {Object.values(ClientStatus).map((status) => (
                          <MenuItem key={status} value={status}>
                            {t(ClientStatusLabels[status])}
                          </MenuItem>
                        ))}
                      </Select>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: 'block' }}
                      >
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
                    onMaintenanceMessageChange={(message) =>
                      setValue('maintenanceMessage', message)
                    }
                    supportsMultiLanguage={supportsMultiLanguage}
                    onSupportsMultiLanguageChange={handleSupportsMultiLanguageChange}
                    maintenanceLocales={maintenanceLocales.map((l) => ({
                      lang: l.lang as 'ko' | 'en' | 'zh',
                      message: l.message,
                    }))}
                    onMaintenanceLocalesChange={(locales) => {
                      setMaintenanceLocales(locales);
                      setValue('maintenanceLocales', locales, {
                        shouldDirty: true,
                      });
                      // 번역 결과가 있으면 자동으로 언어별 메시지 사용 활성화
                      const hasNonEmptyLocales = locales.some(
                        (l) => l.message && l.message.trim() !== ''
                      );
                      if (hasNonEmptyLocales && !supportsMultiLanguage) {
                        setSupportsMultiLanguage(true);
                        setValue('supportsMultiLanguage', true, {
                          shouldDirty: true,
                        });
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

            {/* 서버 주소 섹션 */}
            <Paper variant="outlined" elevation={0} sx={{ p: 2 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                🌐 {t('clientVersions.form.serverAddresses')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('clientVersions.form.serverAddressesDescription')}
              </Typography>

              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2 }}>
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
                            {t('clientVersions.gameServerAddress')}{' '}
                            <Typography component="span" color="error">
                              *
                            </Typography>
                          </Box>
                        }
                        error={!!errors.gameServerAddress}
                        helperText={
                          errors.gameServerAddress?.message ||
                          t('clientVersions.form.gameServerAddressHelp')
                        }
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
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
                        helperText={
                          errors.gameServerAddressForWhiteList?.message ||
                          t('clientVersions.form.gameServerAddressForWhiteListHelp')
                        }
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
                        }}
                      />
                    )}
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
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
                            {t('clientVersions.patchAddress')}{' '}
                            <Typography component="span" color="error">
                              *
                            </Typography>
                          </Box>
                        }
                        error={!!errors.patchAddress}
                        helperText={
                          errors.patchAddress?.message || t('clientVersions.form.patchAddressHelp')
                        }
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
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
                        helperText={
                          errors.patchAddressForWhiteList?.message ||
                          t('clientVersions.form.patchAddressForWhiteListHelp')
                        }
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
                        }}
                      />
                    )}
                  />
                </Box>
              </Stack>
            </Paper>

            {/* 태그 섹션 (추가 설정 밖) */}
            <Paper variant="outlined" elevation={0} sx={{ p: 2 }}>
              <Typography
                variant="h6"
                gutterBottom
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
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
                  setValue('tags', value, { shouldDirty: true });
                }}
                slotProps={{
                  popper: {
                    placement: 'bottom-start',
                  },
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Tooltip
                        key={option.id}
                        title={option.description || t('tags.noDescription')}
                        arrow
                      >
                        <Chip
                          variant="outlined"
                          label={option.name}
                          size="small"
                          sx={{
                            bgcolor: option.color,
                            color: getContrastColor(option.color),
                          }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={t('common.tags')}
                    helperText={t('clientVersions.form.tagsHelp')}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Chip
                      label={option.name}
                      size="small"
                      sx={{
                        bgcolor: option.color,
                        color: getContrastColor(option.color),
                        mr: 1,
                      }}
                    />
                    {option.description || t('common.noDescription')}
                  </Box>
                )}
              />
            </Paper>

            {/* 추가 설정 섹션 */}
            <Accordion defaultExpanded={false} disableGutters variant="outlined" sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    color: 'primary.main',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  ⚙️ {t('clientVersions.form.additionalSettings')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
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
                          control={<Switch checked={field.value} onChange={field.onChange} />}
                          label={t('clientVersions.guestModeAllowed')}
                        />
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ mt: 0.5, display: 'block' }}
                        >
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
                        helperText={
                          errors.externalClickLink?.message ||
                          t('clientVersions.form.externalClickLinkHelp')
                        }
                        inputProps={{
                          autoComplete: 'off',
                          autoCorrect: 'off',
                          autoCapitalize: 'off',
                          spellCheck: false,
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

                  {/* 태그 선택: 섹션 외부로 이동됨 */}
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Button
            onClick={handleClose}
            disabled={isSubmitting || loading}
            startIcon={<CancelIcon />}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isSubmitting || loading || !!duplicateError || (displayIsEdit && !isDirty)}
            startIcon={displayIsCopy ? <CopyIcon /> : <SaveIcon />}
            onClick={() => {
              console.log('Submit button clicked!', {
                isSubmitting,
                loading,
                duplicateError,
                disabled: isSubmitting || loading || !!duplicateError,
                formErrors: errors,
                hasErrors: Object.keys(errors).length > 0,
              });
            }}
          >
            {displayIsCopy
              ? t('clientVersions.form.copyTitle')
              : getActionLabel(displayIsEdit ? 'update' : 'create', requiresApproval, t)}
          </Button>
        </Box>
      </form>
    </ResizableDrawer>
  );
};

export default ClientVersionForm;
