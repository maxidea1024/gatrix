import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Paper,
  Stack,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  FileCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import ClearableTextField from '../common/ClearableTextField';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import {
  ClientVersion,
  ClientVersionFormData,
  ClientVersionMaintenanceLocale,
  ClientStatus,
  ClientStatusLabels,
  CLIENT_VERSION_VALIDATION,
} from '../../types/clientVersion';
import { ClientVersionService } from '../../services/clientVersionService';
import { PlatformDefaultsService } from '../../services/platformDefaultsService';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import JsonEditor from '../common/JsonEditor';
import MaintenanceSettingsInput from '../common/MaintenanceSettingsInput';
import {
  MessageTemplate,
  messageTemplateService,
} from '../../services/messageTemplateService';
import { parseApiErrorMessage } from '@/utils/errorUtils';
import { showChangeRequestCreatedToast } from '@/utils/changeRequestToast';
import { useNavigate } from 'react-router-dom';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { getActionLabel } from '@/utils/changeRequestToast';
import TagSelector from '../common/TagSelector';
import { Tag } from '@/services/tagService';
import { ChangeRequestSubmitButtons } from '../common/ChangeRequestSubmitButtons';

interface ClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientVersion?: ClientVersion | null;
  isCopyMode?: boolean;
  requiresApproval?: boolean;
}

// Form validation schema
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
    memo: yup
      .string()
      .max(CLIENT_VERSION_VALIDATION.MEMO.MAX_LENGTH)
      .notRequired(),
    customPayload: yup
      .string()
      .max(CLIENT_VERSION_VALIDATION.CUSTOM_PAYLOAD.MAX_LENGTH)
      .notRequired(),
    // Maintenance-related fields
    maintenanceStartDate: yup.string().notRequired(),
    maintenanceEndDate: yup.string().notRequired(),
    maintenanceMessage: yup.string().when('clientStatus', {
      is: ClientStatus.MAINTENANCE,
      then: (schema) =>
        schema.required(t('clientVersions.maintenance.messageRequired')),
      otherwise: (schema) => schema.notRequired(),
    }),
    supportsMultiLanguage: yup.boolean().notRequired(),
    maintenanceLocales: yup.array().notRequired(),
    tags: yup.array().notRequired(),
    minPatchVersion: yup.string().max(50).notRequired(),
  });

const ClientVersionForm: React.FC<ClientVersionFormProps> = ({
  open,
  onClose,
  onSuccess,
  clientVersion,
  isCopyMode = false,
  requiresApproval = false,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const getProjectApiPath = useOrgProject().getProjectApiPath;
  const projectApiPath = getProjectApiPath();
  const { platforms } = usePlatformConfig();
  const [loading, setLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const versionFieldRef = useRef<HTMLInputElement>(null);

  const isEdit = !!clientVersion && !isCopyMode;
  const [displayIsEdit, setDisplayIsEdit] = useState<boolean>(isEdit);
  const [displayIsCopy, setDisplayIsCopy] = useState<boolean>(!!isCopyMode);

  // Tag-related state
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);

  // Health check state per address field
  type HealthStatus = 'idle' | 'checking' | 'healthy' | 'unhealthy';
  interface HealthResult {
    status: HealthStatus;
    latency?: number;
    error?: string;
  }
  const [healthResults, setHealthResults] = useState<
    Record<string, HealthResult>
  >({});

  const handleHealthCheck = useCallback(
    async (fieldName: string, address: string) => {
      if (!address?.trim()) return;
      setHealthResults((prev) => ({
        ...prev,
        [fieldName]: { status: 'checking' },
      }));
      try {
        const result = await ClientVersionService.checkAddressHealth(
          projectApiPath,
          address
        );
        setHealthResults((prev) => ({
          ...prev,
          [fieldName]: {
            status: result.healthy ? 'healthy' : 'unhealthy',
            latency: result.latency,
            error: result.error,
          },
        }));
      } catch {
        setHealthResults((prev) => ({
          ...prev,
          [fieldName]: {
            status: 'unhealthy',
            error: 'Request failed',
          },
        }));
      }
    },
    [projectApiPath]
  );

  // Helper to render single health check icon (click to check, color = status)
  const renderHealthIcon = (
    fieldName: string,
    address: string,
    enabled: boolean
  ) => {
    const result = healthResults[fieldName];
    const isChecking = result?.status === 'checking';
    const hasAddress = !!address?.trim();

    // Determine color and tooltip based on status
    let color = 'action.disabled';
    let tooltip = '';
    if (!enabled) {
      tooltip = t('clientVersions.addressCheck.notAvailable');
    } else if (isChecking) {
      tooltip = t('clientVersions.addressCheck.checking');
    } else if (result?.status === 'healthy') {
      color = 'success.main';
      tooltip = t('clientVersions.addressCheck.healthy', {
        latency: result.latency ?? 0,
      });
    } else if (result?.status === 'unhealthy') {
      color = 'error.main';
      tooltip = t('clientVersions.addressCheck.unhealthy', {
        error: result.error ?? '',
      });
    } else {
      tooltip = t('clientVersions.addressCheck.tooltip');
    }

    return (
      <Tooltip title={tooltip}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'flex-start',
            marginTop: '16px',
            marginLeft: '4px',
          }}
        >
          <IconButton
            size="small"
            disabled={!hasAddress || !enabled || isChecking}
            onClick={() => handleHealthCheck(fieldName, address)}
            sx={{
              p: 0.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              width: 28,
              height: 28,
            }}
          >
            {isChecking ? (
              <CircularProgress size={12} />
            ) : (
              <CircleIcon sx={{ fontSize: 12, color }} />
            )}
          </IconButton>
        </span>
      </Tooltip>
    );
  };

  // Maintenance-related state
  const [maintenanceLocales, setMaintenanceLocales] = useState<
    ClientVersionMaintenanceLocale[]
  >([]);
  const [supportsMultiLanguage, setSupportsMultiLanguage] = useState(false);

  // Message source selection
  const [inputMode, setInputMode] = useState<'direct' | 'template'>('direct');
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | ''>('');

  // Default values
  const defaultValues: ClientVersionFormData = {
    platform: 'pc', // Default to first platform
    clientVersion: '',
    clientStatus: ClientStatus.OFFLINE, // Default to first status
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
    minPatchVersion: '',
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

  // Watch current status
  const currentStatus = watch('clientStatus');
  const isMaintenanceMode = currentStatus === ClientStatus.MAINTENANCE;

  // Form initialization
  useEffect(() => {
    if (open) {
      // Fix display mode at open time to prevent button label flickering
      setDisplayIsEdit(!!clientVersion && !isCopyMode);
      setDisplayIsCopy(!!isCopyMode);

      if (clientVersion) {
        (async () => {
          let source: any = clientVersion;
          try {
            // Re-fetch details since maintenanceLocales may be empty from list data
            if (
              (!source.maintenanceLocales ||
                source.maintenanceLocales.length === 0) &&
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
            clientVersion: isCopyMode ? '' : source.clientVersion, // Clear version only in copy mode
            clientStatus: source.clientStatus,
            gameServerAddress: source.gameServerAddress,
            gameServerAddressForWhiteList:
              source.gameServerAddressForWhiteList || '',
            patchAddress: source.patchAddress,
            patchAddressForWhiteList: source.patchAddressForWhiteList || '',
            guestModeAllowed: source.guestModeAllowed,
            externalClickLink: source.externalClickLink || '',
            memo: source.memo || '',
            customPayload: source.customPayload || '',
            maintenanceStartDate: source.maintenanceStartDate || '',
            maintenanceEndDate: source.maintenanceEndDate || '',
            maintenanceMessage: source.maintenanceMessage || '',
            // Enable if locale data exists even when supportsMultiLanguage is false
            supportsMultiLanguage:
              (source.supportsMultiLanguage ?? false) ||
              !!(
                source.maintenanceLocales &&
                source.maintenanceLocales.length > 0
              ),
            // Normalize server language codes
            maintenanceLocales: (source.maintenanceLocales || []).map(
              (l: any) => ({
                lang: normalizeLangCode(l.lang),
                message: l.message || '',
              })
            ),
            tags: source.tags || [],
            minPatchVersion: source.minPatchVersion || '',
          });
          setSelectedTags(source.tags || []);
          const normalizedLocales = (source.maintenanceLocales || []).map(
            (l: any) => ({
              lang: normalizeLangCode(l.lang),
              message: l.message || '',
            })
          );
          setMaintenanceLocales(normalizedLocales);
          setSupportsMultiLanguage(
            (source.supportsMultiLanguage ?? false) ||
              normalizedLocales.length > 0
          );
        })();
      } else {
        // Initialize with default values for new creation
        reset(defaultValues);
        setSelectedTags([]);
        setMaintenanceLocales([]);
        setSupportsMultiLanguage(false);
        setInputMode('direct');
        setSelectedTemplateId('');

        // Apply defaults for initial platform (e.g. 'pc') immediately (only if fields are empty)
        (async () => {
          try {
            const initialPlatform =
              getValues('platform') || defaultValues.platform;
            if (initialPlatform) {
              const defaults =
                await PlatformDefaultsService.getPlatformDefaults(
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

      // Focus version field when in copy mode or adding new
      if (isCopyMode || !clientVersion) {
        setTimeout(() => {
          versionFieldRef.current?.focus();
        }, 100);
      }
    }
  }, [open, isEdit, isCopyMode, clientVersion, reset]);

  // Load message templates
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

  // Normalize language code (server may return ko-KR, en-US, zh-CN, etc.)
  const normalizeLangCode = (code: string): 'ko' | 'en' | 'zh' => {
    const lower = (code || '').toLowerCase();
    if (lower.startsWith('ko')) return 'ko';
    if (lower.startsWith('en')) return 'en';
    if (lower.startsWith('zh')) return 'zh';
    return 'en';
  };

  // Toggle multi-language message support
  const handleSupportsMultiLanguageChange = (enabled: boolean) => {
    setSupportsMultiLanguage(enabled);
    setValue('supportsMultiLanguage', enabled, { shouldDirty: true });
    if (enabled) {
      // On enable, preserve existing values and add missing languages
      const merged = availableLanguages.map((lang) => {
        const existing = maintenanceLocales.find((l) => l.lang === lang.code);
        return { lang: lang.code, message: existing?.message || '' } as any;
      });
      setMaintenanceLocales(merged);
      setValue('maintenanceLocales', merged, { shouldDirty: true });
    } else {
      // On disable, keep input values and only hide UI (do not modify state/form values)
      // no-op
    }
  };

  // Available language list
  const availableLanguages = [
    { code: 'ko' as const, label: t('clientVersions.maintenance.korean') },
    { code: 'en' as const, label: t('clientVersions.maintenance.english') },
    { code: 'zh' as const, label: t('clientVersions.maintenance.chinese') },
  ];

  const usedLanguages = new Set(maintenanceLocales.map((l) => l.lang));

  // Date locale configuration

  // Duplicate check
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
          setDuplicateError(
            isDuplicate ? t('clientVersions.form.duplicateVersion') : null
          );
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

  // Apply defaults when platform changes
  const watchedPlatform = watch('platform');
  useEffect(() => {
    if (watchedPlatform && !isEdit) {
      // Apply defaults only when creating new
      const applyDefaults = async () => {
        try {
          const defaults = await PlatformDefaultsService.getPlatformDefaults(
            projectApiPath,
            watchedPlatform
          );

          // Apply platform defaults (overwrite regardless of existing values)
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

  // Form submission
  const handleValidSubmit = async (
    data: ClientVersionFormData,
    skipCr: boolean
  ) => {
    if (duplicateError) {
      return;
    }

    try {
      setLoading(true);
      // Handle message for template mode
      let finalMaintenanceMessage = data.maintenanceMessage;
      let finalMaintenanceLocales = maintenanceLocales.filter(
        (l) => l.message.trim() !== ''
      );

      if (
        data.clientStatus === ClientStatus.MAINTENANCE &&
        inputMode === 'template' &&
        selectedTemplateId
      ) {
        const selectedTemplate = templates.find(
          (t) => t.id === selectedTemplateId
        );
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

      // Convert empty strings to undefined and separate tags, maintenanceLocales fields
      const {
        tags,
        maintenanceLocales: formMaintenanceLocales,
        ...dataWithoutTags
      } = data;
      const cleanedData = {
        ...dataWithoutTags,
        gameServerAddressForWhiteList:
          data.gameServerAddressForWhiteList || undefined,
        patchAddressForWhiteList: data.patchAddressForWhiteList || undefined,
        externalClickLink: data.externalClickLink || undefined,
        memo: data.memo || undefined,
        customPayload: data.customPayload || undefined,
        maintenanceStartDate: data.maintenanceStartDate || undefined,
        maintenanceEndDate: data.maintenanceEndDate || undefined,
        maintenanceMessage: finalMaintenanceMessage || undefined,
        supportsMultiLanguage: data.supportsMultiLanguage || false,
        maintenanceLocales: finalMaintenanceLocales,
        minPatchVersion: data.minPatchVersion || undefined,
        tags: selectedTags || [],
      };
      let clientVersionId: number;

      if (isEdit && clientVersion) {
        if (!clientVersion.id) {
          throw new Error('Client version ID is missing');
        }
        const updateResult = await ClientVersionService.updateClientVersion(
          projectApiPath,
          clientVersion.id,
          cleanedData,
          skipCr
        );
        if (updateResult.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate
          );
          onSuccess();
          onClose();
          return;
        }

        clientVersionId = clientVersion.id;
        enqueueSnackbar(t('clientVersions.updateSuccess'), {
          variant: 'success',
        });
      } else {
        const createResult = await ClientVersionService.createClientVersion(
          projectApiPath,
          cleanedData,
          skipCr
        );
        if (createResult.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate
          );
          onSuccess();
          onClose();
          return;
        }

        clientVersionId = createResult.clientVersion?.id;
        if (!clientVersionId) {
          throw new Error(t('common.cannotGetClientVersionId'));
        }
        enqueueSnackbar(
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}
          >
            Client version{' '}
            <Chip
              size="small"
              color="primary"
              label={`${data.clientVersion}:${String(data.platform || '').toUpperCase()}`}
              sx={{ fontWeight: 600 }}
            />{' '}
            has been registered.
          </Box>,
          { variant: 'success' }
        );
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving client version:', error);
      const errorMessage = parseApiErrorMessage(
        error,
        'clientVersions.saveError'
      );
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

  const handleSave = (skipCr: boolean) => {
    handleSubmit((data) => handleValidSubmit(data, skipCr))();
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
        onSubmit={handleSubmit((data) => handleValidSubmit(data, false))}
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
            {/* Basic information section */}
            <Accordion defaultExpanded disableGutters variant="outlined">
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
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
                    {t('clientVersions.form.basicInfo')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('clientVersions.form.basicInfoDescription')}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    {/* Version field */}
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
                          placeholder={
                            CLIENT_VERSION_VALIDATION.CLIENT_VERSION.EXAMPLE
                          }
                          error={!!errors.clientVersion}
                          helperText={
                            errors.clientVersion?.message ||
                            t('clientVersions.form.versionHelp')
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

                    {/* Platform field */}
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

                              // Apply defaults only when creating new
                              if (!isEdit && e.target.value) {
                                try {
                                  const defaults =
                                    await PlatformDefaultsService.getPlatformDefaults(
                                      projectApiPath,
                                      e.target.value as string
                                    );

                                  // Apply platform defaults (overwrite regardless of existing values)
                                  if (defaults.gameServerAddress) {
                                    setValue(
                                      'gameServerAddress',
                                      defaults.gameServerAddress
                                    );
                                  }
                                  if (defaults.patchAddress) {
                                    setValue(
                                      'patchAddress',
                                      defaults.patchAddress
                                    );
                                  }
                                } catch (error) {
                                  console.error(
                                    'Failed to apply platform defaults:',
                                    error
                                  );
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
                          {(errors.platform?.message ||
                            t('clientVersions.form.platformHelp')) && (
                            <Typography
                              variant="caption"
                              color={
                                errors.platform ? 'error' : 'text.secondary'
                              }
                              sx={{ mt: 0.5, display: 'block' }}
                            >
                              {errors.platform?.message ||
                                t('clientVersions.form.platformHelp')}
                            </Typography>
                          )}
                        </FormControl>
                      )}
                    />
                  </Box>

                  {/* Status field */}
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

                  {/* Tags - right after status */}
                  <TagSelector
                    value={selectedTags}
                    onChange={(value) => {
                      setSelectedTags(value);
                      setValue('tags', value, { shouldDirty: true });
                    }}
                  />

                  {isMaintenanceMode && (
                    <MaintenanceSettingsInput
                      startDate={watch('maintenanceStartDate') || ''}
                      endDate={watch('maintenanceEndDate') || ''}
                      onStartDateChange={(date) =>
                        setValue('maintenanceStartDate', date)
                      }
                      onEndDateChange={(date) =>
                        setValue('maintenanceEndDate', date)
                      }
                      inputMode={inputMode}
                      onInputModeChange={setInputMode}
                      maintenanceMessage={watch('maintenanceMessage') || ''}
                      onMaintenanceMessageChange={(message) =>
                        setValue('maintenanceMessage', message)
                      }
                      supportsMultiLanguage={supportsMultiLanguage}
                      onSupportsMultiLanguageChange={
                        handleSupportsMultiLanguageChange
                      }
                      maintenanceLocales={maintenanceLocales.map((l) => ({
                        lang: l.lang as 'ko' | 'en' | 'zh',
                        message: l.message,
                      }))}
                      onMaintenanceLocalesChange={(locales) => {
                        setMaintenanceLocales(locales);
                        setValue('maintenanceLocales', locales, {
                          shouldDirty: true,
                        });
                        // Auto-enable multi-language messages when translation results exist
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
              </AccordionDetails>
            </Accordion>

            {/* Server address section */}
            <Accordion defaultExpanded disableGutters variant="outlined">
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
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
                    {t('clientVersions.form.serverAddresses')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('clientVersions.form.serverAddressesDescription')}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  {/* Game server address group */}
                  <Box
                    component="fieldset"
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                      m: 0,
                    }}
                  >
                    <Box
                      component="legend"
                      sx={{
                        px: 1,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'text.secondary',
                      }}
                    >
                      {t('clientVersions.form.gameServerGroup')}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      {/* Game server address */}
                      <Box sx={{ display: 'flex', flex: 1 }}>
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
                        {renderHealthIcon(
                          'gameServerAddress',
                          watch('gameServerAddress'),
                          true
                        )}
                      </Box>

                      {/* Game server address (for whitelist) */}
                      <Box sx={{ display: 'flex', flex: 1 }}>
                        <Controller
                          name="gameServerAddressForWhiteList"
                          control={control}
                          render={({ field }) => (
                            <ClearableTextField
                              {...field}
                              fullWidth
                              label={t(
                                'clientVersions.gameServerAddressForWhiteList'
                              )}
                              error={!!errors.gameServerAddressForWhiteList}
                              helperText={
                                errors.gameServerAddressForWhiteList?.message ||
                                t(
                                  'clientVersions.form.gameServerAddressForWhiteListHelp'
                                )
                              }
                              inputProps={{
                                autoComplete: 'off',
                                autoCorrect: 'off',
                                autoCapitalize: 'off',
                                spellCheck: false,
                              }}
                              onClear={() => field.onChange('')}
                            />
                          )}
                        />
                        {renderHealthIcon(
                          'gameServerAddressForWhiteList',
                          watch('gameServerAddressForWhiteList') || '',
                          true
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* Patch address group */}
                  <Box
                    component="fieldset"
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      p: 2,
                      m: 0,
                    }}
                  >
                    <Box
                      component="legend"
                      sx={{
                        px: 1,
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        color: 'text.secondary',
                      }}
                    >
                      {t('clientVersions.form.patchServerGroup')}
                    </Box>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        {/* Patch address */}
                        <Box sx={{ display: 'flex', flex: 1 }}>
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
                                  errors.patchAddress?.message ||
                                  t('clientVersions.form.patchAddressHelp')
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
                          {renderHealthIcon(
                            'patchAddress',
                            watch('patchAddress'),
                            false
                          )}
                        </Box>

                        {/* Patch address (for whitelist) */}
                        <Box sx={{ display: 'flex', flex: 1 }}>
                          <Controller
                            name="patchAddressForWhiteList"
                            control={control}
                            render={({ field }) => (
                              <ClearableTextField
                                {...field}
                                fullWidth
                                label={t(
                                  'clientVersions.patchAddressForWhiteList'
                                )}
                                error={!!errors.patchAddressForWhiteList}
                                helperText={
                                  errors.patchAddressForWhiteList?.message ||
                                  t(
                                    'clientVersions.form.patchAddressForWhiteListHelp'
                                  )
                                }
                                inputProps={{
                                  autoComplete: 'off',
                                  autoCorrect: 'off',
                                  autoCapitalize: 'off',
                                  spellCheck: false,
                                }}
                                onClear={() => field.onChange('')}
                              />
                            )}
                          />
                          {renderHealthIcon(
                            'patchAddressForWhiteList',
                            watch('patchAddressForWhiteList') || '',
                            false
                          )}
                        </Box>
                      </Box>

                      {/* Minimum patch version */}
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box sx={{ flex: 1, maxWidth: '50%' }}>
                          <Controller
                            name="minPatchVersion"
                            control={control}
                            render={({ field }) => (
                              <ClearableTextField
                                {...field}
                                fullWidth
                                label={t('clientVersions.minPatchVersion')}
                                placeholder="e.g., 1.0041"
                                error={!!errors.minPatchVersion}
                                helperText={
                                  errors.minPatchVersion?.message ||
                                  t('clientVersions.form.minPatchVersionHelp')
                                }
                                inputProps={{
                                  autoComplete: 'off',
                                  autoCorrect: 'off',
                                  autoCapitalize: 'off',
                                  spellCheck: false,
                                }}
                                onClear={() => field.onChange('')}
                              />
                            )}
                          />
                        </Box>
                      </Box>
                    </Stack>
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Tag section (outside additional settings) */}
            {/* Additional settings section */}
            <Accordion
              defaultExpanded={false}
              disableGutters
              variant="outlined"
              sx={{ mb: 2 }}
            >
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
                  {t('clientVersions.form.additionalSettings')}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {t('clientVersions.form.additionalSettingsDescription')}
                </Typography>

                <Stack spacing={2}>
                  {/* Guest mode allowed */}
                  <Controller
                    name="guestModeAllowed"
                    control={control}
                    render={({ field }) => (
                      <Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={Boolean(field.value)}
                              onChange={field.onChange}
                            />
                          }
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

                  {/* External click link */}
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

                  {/* Memo */}
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
                        helperText={
                          errors.memo?.message ||
                          t('clientVersions.form.memoHelp')
                        }
                      />
                    )}
                  />

                  {/* Custom payload */}
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

                  {/* Tag selection: moved outside section */}
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
          <Button onClick={handleClose} disabled={isSubmitting || loading}>
            {t('common.cancel')}
          </Button>
          <ChangeRequestSubmitButtons
            action={
              displayIsCopy ? 'create' : displayIsEdit ? 'update' : 'create'
            }
            requiresApproval={requiresApproval}
            saving={isSubmitting || loading}
            onSave={handleSave}
            disabled={
              isSubmitting ||
              loading ||
              !!duplicateError ||
              (displayIsEdit && !isDirty)
            }
            title={
              displayIsCopy ? t('clientVersions.form.copyTitle') : undefined
            }
          />
        </Box>
      </form>
    </ResizableDrawer>
  );
};

export default ClientVersionForm;
