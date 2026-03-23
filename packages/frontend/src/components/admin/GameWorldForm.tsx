import React, { useRef, useState } from 'react';
import {
  Box,
  TextField,
  Typography,
  Switch,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Tooltip,
  Tabs,
  Tab,
  Button,
  Stack,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Upload as UploadIcon,
  ContentCopy as CopyIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { Tag } from '@/services/tagService';
import {
  GameWorld,
  GameWorldMaintenanceLocale,
  CreateGameWorldData,
} from '@/types/gameWorld';
import MaintenanceSettingsInput from '@/components/common/MaintenanceSettingsInput';
import JsonEditor, { parseJson5 } from '@/components/common/JsonEditor';
import Json5Editor from '@/components/common/Json5Editor';
import { MessageTemplate } from '@/services/messageTemplateService';
import { copyToClipboardWithNotification } from '@/utils/clipboard';
import { getContrastColor } from '@/utils/colorUtils';
import { gameWorldService } from '@/services/gameWorldService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import TagSelector from '@/components/common/TagSelector';

export interface GameWorldFormProps {
  editingWorld: GameWorld | null;
  formData: CreateGameWorldData;
  onFormDataChange: (data: CreateGameWorldData) => void;
  formErrors: Record<string, string>;
  allRegistryTags?: Tag[]; // deprecated, kept for backward compat
  formTags: Tag[];
  onFormTagsChange: (tags: Tag[]) => void;
  maintenanceLocales: GameWorldMaintenanceLocale[];
  onMaintenanceLocalesChange: (locales: GameWorldMaintenanceLocale[]) => void;
  supportsMultiLanguage: boolean;
  onSupportsMultiLanguageChange: (supports: boolean) => void;
  customPayloadText: string;
  onCustomPayloadTextChange: (text: string) => void;
  customPayloadError: string;
  onCustomPayloadErrorChange: (error: string) => void;
  infraSettingsText: string;
  onInfraSettingsTextChange: (text: string) => void;
  infraSettingsError: string;
  onInfraSettingsErrorChange: (error: string) => void;
  messageTemplates: MessageTemplate[];
  inputMode: 'direct' | 'template';
  onInputModeChange: (mode: 'direct' | 'template') => void;
  selectedTemplateId: number | '';
  onSelectedTemplateIdChange: (id: number | '') => void;
  worldIdRef?: React.RefObject<HTMLInputElement>;
  activeTab?: number;
  onActiveTabChange?: (tab: number) => void;
}

const GameWorldForm: React.FC<GameWorldFormProps> = ({
  editingWorld,
  formData,
  onFormDataChange,
  formErrors,
  allRegistryTags,
  formTags,
  onFormTagsChange,
  maintenanceLocales,
  onMaintenanceLocalesChange,
  supportsMultiLanguage,
  onSupportsMultiLanguageChange,
  customPayloadText,
  onCustomPayloadTextChange,
  customPayloadError,
  onCustomPayloadErrorChange,
  infraSettingsText,
  onInfraSettingsTextChange,
  infraSettingsError,
  onInfraSettingsErrorChange,
  messageTemplates,
  inputMode,
  onInputModeChange,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  worldIdRef,
  activeTab: controlledActiveTab,
  onActiveTabChange,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [internalActiveTab, setInternalActiveTab] = useState(0);

  // Use controlled or internal state
  const activeTab =
    controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab: number) => {
    if (onActiveTabChange) {
      onActiveTabChange(tab);
    } else {
      setInternalActiveTab(tab);
    }
  };
  const defaultWorldIdRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refToUse = worldIdRef || defaultWorldIdRef;

  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  // Address check state
  type AddressCheckStatus = 'idle' | 'checking' | 'success' | 'error';
  const [addressCheckStatus, setAddressCheckStatus] =
    useState<AddressCheckStatus>('idle');
  const [addressCheckResult, setAddressCheckResult] = useState<{
    worldId?: string;
    matched?: boolean;
    error?: string;
  }>({});

  const handleAddressCheck = async () => {
    const address = formData.worldServerAddress;
    if (!address?.trim()) return;

    setAddressCheckStatus('checking');
    try {
      const result = await gameWorldService.checkWorldServerAddress(
        projectApiPath,
        address,
        formData.worldId || undefined
      );
      if (result.reachable) {
        setAddressCheckStatus('success');
        setAddressCheckResult({
          worldId: result.worldId,
          matched: result.matched,
        });
      } else {
        setAddressCheckStatus('error');
        setAddressCheckResult({ error: result.error });
      }
    } catch {
      setAddressCheckStatus('error');
      setAddressCheckResult({ error: 'Request failed' });
    }
  };

  const renderAddressCheckIcon = () => {
    const isChecking = addressCheckStatus === 'checking';
    const hasAddress = !!formData.worldServerAddress?.trim();

    let color = 'action.disabled';
    let tooltip = '';
    if (isChecking) {
      tooltip = t('gameWorlds.addressCheck.checking');
    } else if (addressCheckStatus === 'success') {
      if (addressCheckResult.matched === true) {
        color = 'success.main';
        tooltip = t('gameWorlds.addressCheck.matched', {
          worldId: addressCheckResult.worldId ?? '',
        });
      } else if (addressCheckResult.matched === false) {
        color = 'warning.main';
        tooltip = t('gameWorlds.addressCheck.mismatch', {
          expected: formData.worldId,
          actual: addressCheckResult.worldId ?? '',
        });
      } else {
        color = 'success.main';
        tooltip = t('gameWorlds.addressCheck.reachable', {
          worldId: addressCheckResult.worldId ?? '',
        });
      }
    } else if (addressCheckStatus === 'error') {
      color = 'error.main';
      tooltip = t('gameWorlds.addressCheck.unreachable', {
        error: addressCheckResult.error ?? '',
      });
    } else {
      tooltip = t('gameWorlds.addressCheck.tooltip');
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
            disabled={!hasAddress || isChecking}
            onClick={handleAddressCheck}
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

  // Export settings to file (JSON5 format)
  const handleExportSettings = () => {
    try {
      const settings = infraSettingsText.trim() || '{}';
      const blob = new Blob([settings], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formData.worldId || 'world'}-infra-settings.json5`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      enqueueSnackbar(t('gameWorlds.form.settingsExported'), {
        variant: 'success',
      });
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  };

  // Import settings from file
  const handleImportSettings = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Support JSON5 format for import
        const result = parseJson5(content);
        if (result.success) {
          // Keep original content to preserve comments/formatting
          onInfraSettingsTextChange(content);
          onInfraSettingsErrorChange('');
          enqueueSnackbar(t('gameWorlds.form.settingsImported'), {
            variant: 'success',
          });
        } else {
          enqueueSnackbar(t('gameWorlds.form.invalidJsonFile'), {
            variant: 'error',
          });
        }
      } catch {
        enqueueSnackbar(t('gameWorlds.form.invalidJsonFile'), {
          variant: 'error',
        });
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Copy settings to clipboard
  const handleCopySettings = () => {
    const settings = infraSettingsText.trim() || '{}';
    copyToClipboardWithNotification(
      settings,
      () =>
        enqueueSnackbar(t('gameWorlds.form.settingsCopied'), {
          variant: 'success',
        }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab label={t('gameWorlds.form.basicInfoTab')} />
        <Tab label={t('gameWorlds.form.infraSettingsTab')} />
      </Tabs>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Basic Info Tab */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            {/* World ID + Name */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label={t('gameWorlds.worldId')}
                  value={formData.worldId}
                  onChange={(e) => {
                    const newWorldId = e.target.value;
                    const newFormData = { ...formData, worldId: newWorldId };

                    if (
                      !editingWorld &&
                      (formData.name === '' ||
                        formData.name === formData.worldId)
                    ) {
                      newFormData.name = newWorldId;
                    }

                    onFormDataChange(newFormData);
                  }}
                  error={!!formErrors.worldId}
                  helperText={
                    formErrors.worldId || t('gameWorlds.form.worldIdHelp')
                  }
                  required
                  inputRef={refToUse}
                  autoFocus
                />
              </Box>

              <Box sx={{ flex: 1 }}>
                <TextField
                  fullWidth
                  label={t('gameWorlds.name')}
                  value={formData.name}
                  onChange={(e) =>
                    onFormDataChange({ ...formData, name: e.target.value })
                  }
                  error={!!formErrors.name}
                  helperText={formErrors.name || t('gameWorlds.form.nameHelp')}
                  required
                />
              </Box>
            </Box>

            {/* Description */}
            <Box>
              <TextField
                fullWidth
                label={t('gameWorlds.description')}
                value={formData.description}
                onChange={(e) =>
                  onFormDataChange({ ...formData, description: e.target.value })
                }
                multiline
                rows={3}
                placeholder={t('gameWorlds.description')}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.5, display: 'block' }}
              >
                {t('gameWorlds.form.descriptionHelp')}
              </Typography>
            </Box>

            {/* World Server Address */}
            <Box sx={{ display: 'flex' }}>
              <TextField
                fullWidth
                label={t('gameWorlds.worldServerAddress')}
                value={formData.worldServerAddress || ''}
                onChange={(e) =>
                  onFormDataChange({
                    ...formData,
                    worldServerAddress: e.target.value,
                  })
                }
                required
                error={!!formErrors.worldServerAddress}
                helperText={
                  formErrors.worldServerAddress ||
                  t('gameWorlds.form.worldServerAddressHelp')
                }
              />
              {renderAddressCheckIcon()}
            </Box>

            {/* Tags */}
            <Box>
              <TagSelector
                value={formTags}
                onChange={onFormTagsChange}
                label={t('gameWorlds.tags')}
              />
            </Box>

            {/* Visibility and Maintenance Toggles */}
            <Box
              sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 1 }}
            >
              <FormControl variant="standard">
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isVisible}
                      onChange={(e) =>
                        onFormDataChange({
                          ...formData,
                          isVisible: e.target.checked,
                        })
                      }
                    />
                  }
                  label={t('gameWorlds.visibleToUsers')}
                />
                <FormHelperText sx={{ ml: 6, mt: -0.5, mb: 1 }}>
                  {t('gameWorlds.form.visibleHelp')}
                </FormHelperText>
              </FormControl>

              <FormControl variant="standard">
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isMaintenance}
                      onChange={(e) =>
                        onFormDataChange({
                          ...formData,
                          isMaintenance: e.target.checked,
                        })
                      }
                    />
                  }
                  label={t('gameWorlds.underMaintenance')}
                />
                <FormHelperText sx={{ ml: 6, mt: -0.5 }}>
                  {t('gameWorlds.form.maintenanceHelp')}
                </FormHelperText>
              </FormControl>
            </Box>

            {/* Maintenance Settings */}
            {!!formData.isMaintenance && (
              <MaintenanceSettingsInput
                startDate={formData.maintenanceStartDate || ''}
                endDate={formData.maintenanceEndDate || ''}
                onStartDateChange={(date) =>
                  onFormDataChange({ ...formData, maintenanceStartDate: date })
                }
                onEndDateChange={(date) =>
                  onFormDataChange({ ...formData, maintenanceEndDate: date })
                }
                inputMode={inputMode}
                onInputModeChange={onInputModeChange}
                maintenanceMessage={formData.maintenanceMessage || ''}
                onMaintenanceMessageChange={(message) =>
                  onFormDataChange({ ...formData, maintenanceMessage: message })
                }
                supportsMultiLanguage={supportsMultiLanguage}
                onSupportsMultiLanguageChange={onSupportsMultiLanguageChange}
                maintenanceLocales={maintenanceLocales.map((l) => ({
                  lang: l.lang as 'ko' | 'en' | 'zh',
                  message: l.message,
                }))}
                onMaintenanceLocalesChange={(locales) => {
                  const newLocales = locales.map((l) => ({
                    lang: l.lang,
                    message: l.message,
                  }));
                  onMaintenanceLocalesChange(newLocales);
                  onFormDataChange({
                    ...formData,
                    maintenanceLocales: newLocales,
                  });
                  const hasNonEmptyLocales = locales.some(
                    (l) => l.message && l.message.trim() !== ''
                  );
                  if (hasNonEmptyLocales && !supportsMultiLanguage) {
                    onSupportsMultiLanguageChange(true);
                  }
                }}
                templates={messageTemplates}
                selectedTemplateId={selectedTemplateId}
                onSelectedTemplateIdChange={onSelectedTemplateIdChange}
                messageRequired={formData.isMaintenance}
                messageError={!!formErrors.maintenanceMessage}
                showForceDisconnect={true}
                forceDisconnect={formData.forceDisconnect ?? false}
                onForceDisconnectChange={(value) =>
                  onFormDataChange({ ...formData, forceDisconnect: value })
                }
                gracePeriodMinutes={formData.gracePeriodMinutes ?? 5}
                onGracePeriodMinutesChange={(value) =>
                  onFormDataChange({ ...formData, gracePeriodMinutes: value })
                }
              />
            )}

            {/* Custom Payload */}
            <JsonEditor
              value={customPayloadText}
              onChange={(val) => onCustomPayloadTextChange(val)}
              height="200px"
              label={t('gameWorlds.customPayload') || 'Custom Payload'}
              placeholder='{\n  "key": "value"\n}'
              error={customPayloadError}
              helperText={
                t('gameWorlds.form.customPayloadHelp') ||
                'Game world related additional data(JSON). If left empty, it will be saved as {}.'
              }
            />
          </Box>
        )}

        {/* Infra Settings Tab */}
        {activeTab === 1 && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              mt: 1,
              height: '100%',
            }}
          >
            {/* Action Buttons */}
            <Stack
              direction="row"
              spacing={1}
              justifyContent="flex-end"
              flexShrink={0}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportSettings}
              >
                {t('gameWorlds.form.exportSettings')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('gameWorlds.form.importSettings')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={handleCopySettings}
              >
                {t('gameWorlds.form.copyToClipboard')}
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json5"
                style={{ display: 'none' }}
                onChange={handleImportSettings}
              />
            </Stack>

            {/* Infra Settings JSON5 Editor (supports comments, unquoted keys, trailing commas) */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <Json5Editor
                value={infraSettingsText}
                onChange={(val) => onInfraSettingsTextChange(val)}
                height="100%"
                error={infraSettingsError}
                onValidationError={(err) =>
                  onInfraSettingsErrorChange(err || '')
                }
              />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default GameWorldForm;
