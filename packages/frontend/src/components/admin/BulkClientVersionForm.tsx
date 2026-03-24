import React, { useState, useEffect, useCallback } from 'react';
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
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
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
import { PlatformDefaultsService } from '../../services/platformDefaultsService';
import { usePlatformConfig } from '../../contexts/PlatformConfigContext';
import MaintenanceSettingsInput from '../common/MaintenanceSettingsInput';
import {
  MessageTemplate,
  messageTemplateService,
} from '../../services/messageTemplateService';
import ResizableDrawer from '../common/ResizableDrawer';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { getActionLabel } from '../../utils/changeRequestToast';
import TagSelector from '../common/TagSelector';
import { Tag } from '@/services/tagService';

// Client status label mapping
const ClientStatusLabels = {
  [ClientStatus.ONLINE]: 'clientVersions.status.online',
  [ClientStatus.OFFLINE]: 'clientVersions.status.offline',
  [ClientStatus.RECOMMENDED_UPDATE]: 'clientVersions.status.recommendedUpdate',
  [ClientStatus.FORCED_UPDATE]: 'clientVersions.status.forcedUpdate',
  [ClientStatus.UNDER_REVIEW]: 'clientVersions.status.underReview',
  [ClientStatus.BLOCKED_PATCH_ALLOWED]:
    'clientVersions.status.blockedPatchAllowed',
  [ClientStatus.MAINTENANCE]: 'clientVersions.status.maintenance',
};

interface BulkClientVersionFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Form validation schema
const createValidationSchema = (t: any) =>
  yup.object({
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
    // Maintenance-related fields
    maintenanceStartDate: yup.string().optional(),
    maintenanceEndDate: yup.string().optional(),
    maintenanceMessage: yup.string().when('clientStatus', {
      is: ClientStatus.MAINTENANCE,
      then: (schema) =>
        schema.required(t('clientVersions.maintenance.messageRequired')),
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
  const { currentEnvironment } = useEnvironment();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;
  const [loading, setLoading] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);

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
          [fieldName]: { status: 'unhealthy', error: 'Request failed' },
        }));
      }
    },
    [projectApiPath]
  );

  const renderHealthIcon = (
    fieldName: string,
    address: string,
    enabled: boolean
  ) => {
    const result = healthResults[fieldName];
    const isChecking = result?.status === 'checking';
    const hasAddress = !!address?.trim();

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
    resolver: yupResolver(createValidationSchema(t)) as any,
    defaultValues,
  });

  // Form initialization
  useEffect(() => {
    if (open) {
      reset(defaultValues);
      setSelectedPlatforms([]);
      setSelectedTags([]);
      setMaintenanceLocales([]);
      setSupportsMultiLanguage(false);
    }
  }, [open, reset]);

  // Load message templates
  useEffect(() => {
    if (open) {
      const loadTemplates = async () => {
        try {
          const result = await messageTemplateService.list(projectApiPath, {
            type: 'maintenance',
            isEnabled: true,
          });
          setTemplates(result.templates);
        } catch (error) {
          console.error('Failed to load message templates:', error);
        }
      };

      loadTemplates();
    }
  }, [open]);

  // Toggle multi-language message support
  const handleSupportsMultiLanguageChange = (enabled: boolean) => {
    setSupportsMultiLanguage(enabled);
    setValue('supportsMultiLanguage', enabled);
    if (enabled) {
      // On enable, preserve existing values and add missing languages
      const availableLanguages = [
        { code: 'ko' as const, label: t('clientVersions.maintenance.korean') },
        { code: 'en' as const, label: t('clientVersions.maintenance.english') },
        { code: 'zh' as const, label: t('clientVersions.maintenance.chinese') },
      ];
      const merged = availableLanguages.map((lang) => {
        const existing = maintenanceLocales.find((l) => l.lang === lang.code);
        return { lang: lang.code, message: existing?.message || '' } as any;
      });
      setMaintenanceLocales(merged);
      setValue('maintenanceLocales', merged);
    } else {
      // On disable, keep input values and only hide UI (do not modify state/form values)
      // no-op
    }
  };

  // Watch current status
  const currentStatus = watch('clientStatus');
  const isMaintenanceMode = currentStatus === ClientStatus.MAINTENANCE;

  // Update platforms array and apply defaults when selected platforms change
  useEffect(() => {
    const applyPlatformDefaults = async () => {
      const newPlatforms: PlatformSpecificSettings[] = await Promise.all(
        selectedPlatforms.map(async (platform) => {
          try {
            const defaults = await PlatformDefaultsService.getPlatformDefaults(
              projectApiPath,
              platform
            );
            return {
              platform,
              gameServerAddress: defaults.gameServerAddress || '',
              gameServerAddressForWhiteList: '',
              patchAddress: defaults.patchAddress || '',
              patchAddressForWhiteList: '',
            };
          } catch (error) {
            console.error(
              `Failed to get defaults for platform ${platform}:`,
              error
            );
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

  // Platform selection handler
  const handlePlatformChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedPlatforms(typeof value === 'string' ? value.split(',') : value);
  };

  // Form submission handler
  const onSubmit = async (data: BulkCreateFormData) => {
    // Platform selection validation
    if (selectedPlatforms.length === 0) {
      setError('platforms', {
        type: 'manual',
        message: t('clientVersions.form.selectAtLeastOnePlatform'),
      });
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

      // Convert empty strings to undefined and include tag data
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
        platforms: data.platforms.map((platform) => ({
          ...platform,
          gameServerAddressForWhiteList:
            platform.gameServerAddressForWhiteList || undefined,
          patchAddressForWhiteList:
            platform.patchAddressForWhiteList || undefined,
        })),
        // Include selected tags (send only required fields)
        tags:
          selectedTags && selectedTags.length > 0
            ? selectedTags.map((tag) => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
              }))
            : [],
      };

      const result = await ClientVersionService.bulkCreateClientVersions(
        projectApiPath,
        cleanedData
      );

      enqueueSnackbar(
        t('clientVersions.bulkCreateSuccess', { count: result?.length || 0 }),
        {
          variant: 'success',
        }
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
          latestVersion,
        });
      } else if (error.message?.startsWith('VERSION_TOO_OLD_BULK:')) {
        const platforms = error.message.split(':')[1];
        errorMessage = t('clientVersions.versionTooOldBulk', { platforms });
      } else if (error.message?.startsWith('DUPLICATE_CLIENT_VERSIONS:')) {
        const duplicates = error.message.split(':')[1];
        errorMessage = t('clientVersions.duplicateClientVersions', {
          duplicates,
        });
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
        onSubmit={handleSubmit(onSubmit as any)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={3} sx={{ mt: 1 }}>
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
                {t('clientVersions.form.basicInfo')}
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

                <FormControl fullWidth error={!!errors.platforms}>
                  <InputLabel id="bulk-platform-label">
                    {t('clientVersions.selectPlatforms')}{' '}
                    <Typography component="span" color="error">
                      *
                    </Typography>
                  </InputLabel>
                  <Select<string[]>
                    labelId="bulk-platform-label"
                    multiple
                    value={selectedPlatforms}
                    onChange={handlePlatformChange}
                    input={
                      <OutlinedInput
                        label={`${t('clientVersions.selectPlatforms')} *`}
                      />
                    }
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
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((value) => (
                          <Chip
                            key={value}
                            label={value.toUpperCase()}
                            size="small"
                          />
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
                  {(errors.platforms?.message ||
                    t('clientVersions.form.bulkPlatformHelp')) && (
                    <Typography
                      variant="caption"
                      color={errors.platforms ? 'error' : 'text.secondary'}
                      sx={{ mt: 0.5, display: 'block' }}
                    >
                      {errors.platforms?.message ||
                        t('clientVersions.form.bulkPlatformHelp')}
                    </Typography>
                  )}
                </FormControl>

                <Controller
                  name="clientStatus"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth variant="outlined">
                      <InputLabel id="bulk-status-label" shrink={true}>
                        {t('clientVersions.statusLabel')}{' '}
                        <Typography component="span" color="error">
                          *
                        </Typography>
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
                    setValue('tags', value);
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
                      setValue('maintenanceLocales', locales);
                      // Auto-enable multi-language messages when translation results exist
                      const hasNonEmptyLocales = locales.some(
                        (l) => l.message && l.message.trim() !== ''
                      );
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

            <Accordion
              defaultExpanded={false}
              disableGutters
              variant="outlined"
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
                  <Controller
                    name="guestModeAllowed"
                    control={control}
                    render={({ field }) => (
                      <Box>
                        <FormControlLabel
                          control={
                            <Switch {...field} checked={field.value || false} />
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
                        helperText={
                          errors.memo?.message ||
                          t('clientVersions.form.memoHelp')
                        }
                      />
                    )}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            {selectedPlatforms.length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
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
                  {t('clientVersions.form.serverAddresses')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  {t('clientVersions.form.platformSpecificDescription')}
                </Typography>

                <Stack spacing={3}>
                  {selectedPlatforms.map((platform, index) => (
                    <Paper
                      key={platform}
                      elevation={1}
                      sx={{ p: 2, bgcolor: 'background.paper' }}
                    >
                      <Typography
                        variant="subtitle1"
                        gutterBottom
                        sx={{
                          fontWeight: 600,
                          color: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        {platform.toUpperCase()}
                      </Typography>

                      <Stack spacing={2}>
                        <Box sx={{ display: 'flex' }}>
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
                                    {t('clientVersions.gameServerAddress')}{' '}
                                    <Typography component="span" color="error">
                                      *
                                    </Typography>
                                  </Box>
                                }
                                error={
                                  !!errors.platforms?.[index]?.gameServerAddress
                                }
                                helperText={
                                  errors.platforms?.[index]?.gameServerAddress
                                    ?.message ||
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
                            `platforms.${index}.gameServerAddress`,
                            watch(`platforms.${index}.gameServerAddress`) || '',
                            true
                          )}
                        </Box>

                        <Box sx={{ display: 'flex' }}>
                          <Controller
                            name={`platforms.${index}.gameServerAddressForWhiteList`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                value={field.value || ''}
                                fullWidth
                                label={t(
                                  'clientVersions.gameServerAddressForWhiteList'
                                )}
                                error={
                                  !!errors.platforms?.[index]
                                    ?.gameServerAddressForWhiteList
                                }
                                helperText={
                                  errors.platforms?.[index]
                                    ?.gameServerAddressForWhiteList?.message ||
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
                              />
                            )}
                          />
                          {renderHealthIcon(
                            `platforms.${index}.gameServerAddressForWhiteList`,
                            watch(
                              `platforms.${index}.gameServerAddressForWhiteList`
                            ) || '',
                            true
                          )}
                        </Box>

                        <Box sx={{ display: 'flex' }}>
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
                                    {t('clientVersions.patchAddress')}{' '}
                                    <Typography component="span" color="error">
                                      *
                                    </Typography>
                                  </Box>
                                }
                                error={
                                  !!errors.platforms?.[index]?.patchAddress
                                }
                                helperText={
                                  errors.platforms?.[index]?.patchAddress
                                    ?.message ||
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
                            `platforms.${index}.patchAddress`,
                            watch(`platforms.${index}.patchAddress`) || '',
                            false
                          )}
                        </Box>

                        <Box sx={{ display: 'flex' }}>
                          <Controller
                            name={`platforms.${index}.patchAddressForWhiteList`}
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                value={field.value || ''}
                                fullWidth
                                label={t(
                                  'clientVersions.patchAddressForWhiteList'
                                )}
                                error={
                                  !!errors.platforms?.[index]
                                    ?.patchAddressForWhiteList
                                }
                                helperText={
                                  errors.platforms?.[index]
                                    ?.patchAddressForWhiteList?.message ||
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
                              />
                            )}
                          />
                          {renderHealthIcon(
                            `platforms.${index}.patchAddressForWhiteList`,
                            watch(
                              `platforms.${index}.patchAddressForWhiteList`
                            ) || '',
                            false
                          )}
                        </Box>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Paper>
            )}
          </Stack>
        </Box>

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
          <Button onClick={handleClose} disabled={loading}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || isSubmitting}
          >
            {loading
              ? t('clientVersions.creating')
              : getActionLabel('create', requiresApproval, t)}
          </Button>
        </Box>
      </form>
    </ResizableDrawer>
  );
};

export default BulkClientVersionForm;
