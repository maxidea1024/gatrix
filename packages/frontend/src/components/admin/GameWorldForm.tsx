import React, { useRef } from 'react';
import {
  Box,
  TextField,
  Typography,
  Switch,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Autocomplete,
  Chip,
  Tooltip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Tag } from '@/services/tagService';
import { GameWorld, GameWorldMaintenanceLocale, CreateGameWorldData } from '@/types/gameWorld';
import MaintenanceSettingsInput from '@/components/common/MaintenanceSettingsInput';
import JsonEditor from '@/components/common/JsonEditor';
import { MessageTemplate } from '@/services/messageTemplateService';

export interface GameWorldFormProps {
  editingWorld: GameWorld | null;
  formData: CreateGameWorldData;
  onFormDataChange: (data: CreateGameWorldData) => void;
  formErrors: Record<string, string>;
  allRegistryTags: Tag[];
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
  messageTemplates: MessageTemplate[];
  inputMode: 'direct' | 'template';
  onInputModeChange: (mode: 'direct' | 'template') => void;
  selectedTemplateId: number | '';
  onSelectedTemplateIdChange: (id: number | '') => void;
  worldIdRef?: React.RefObject<HTMLInputElement>;
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
  messageTemplates,
  inputMode,
  onInputModeChange,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  worldIdRef,
}) => {
  const { t } = useTranslation();
  const defaultWorldIdRef = useRef<HTMLInputElement>(null);
  const refToUse = worldIdRef || defaultWorldIdRef;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
      {/* World ID */}
      <Box>
        <TextField
          fullWidth
          label={t('gameWorlds.worldId')}
          value={formData.worldId}
          onChange={(e) => {
            const newWorldId = e.target.value;
            const newFormData = { ...formData, worldId: newWorldId };

            if (!editingWorld && (formData.name === '' || formData.name === formData.worldId)) {
              newFormData.name = newWorldId;
            }

            onFormDataChange(newFormData);
          }}
          error={!!formErrors.worldId}
          helperText={formErrors.worldId}
          required
          inputRef={refToUse}
          autoFocus
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {t('gameWorlds.form.worldIdHelp')}
        </Typography>
      </Box>

      {/* Name */}
      <Box>
        <TextField
          fullWidth
          label={t('gameWorlds.name')}
          value={formData.name}
          onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
          error={!!formErrors.name}
          helperText={formErrors.name}
          required
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {t('gameWorlds.form.nameHelp')}
        </Typography>
      </Box>

      {/* Description */}
      <Box>
        <TextField
          fullWidth
          label={t('gameWorlds.description')}
          value={formData.description}
          onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
          multiline
          rows={3}
          placeholder={t('gameWorlds.description')}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {t('gameWorlds.form.descriptionHelp')}
        </Typography>
      </Box>

      {/* Tags */}
      <Box>
        <Autocomplete
          multiple
          options={allRegistryTags.filter(tag => typeof tag !== 'string')}
          getOptionLabel={(option) => option.name}
          filterSelectedOptions
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={formTags}
          onChange={(_, value) => onFormTagsChange(value)}
          slotProps={{ popper: {} }}
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
            <TextField {...params} label={t('gameWorlds.tags')} />
          )}
          renderOption={(props, option) => {
            const { key, ...otherProps } = props;
            return (
              <Box component="li" key={key} {...otherProps}>
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
      </Box>

      {/* Visibility and Maintenance Toggles */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <FormControl variant="standard">
          <FormControlLabel
            control={
              <Switch
                checked={formData.isVisible}
                onChange={(e) => onFormDataChange({ ...formData, isVisible: e.target.checked })}
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
                onChange={(e) => onFormDataChange({ ...formData, isMaintenance: e.target.checked })}
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
          onStartDateChange={(date) => onFormDataChange({ ...formData, maintenanceStartDate: date })}
          onEndDateChange={(date) => onFormDataChange({ ...formData, maintenanceEndDate: date })}
          inputMode={inputMode}
          onInputModeChange={onInputModeChange}
          maintenanceMessage={formData.maintenanceMessage || ''}
          onMaintenanceMessageChange={(message) => onFormDataChange({ ...formData, maintenanceMessage: message })}
          supportsMultiLanguage={supportsMultiLanguage}
          onSupportsMultiLanguageChange={onSupportsMultiLanguageChange}
          maintenanceLocales={maintenanceLocales.map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
          onMaintenanceLocalesChange={(locales) => {
            const newLocales = locales.map(l => ({ lang: l.lang, message: l.message }));
            onMaintenanceLocalesChange(newLocales);
            onFormDataChange(prev => ({ ...prev, maintenanceLocales: newLocales }));
            const hasNonEmptyLocales = locales.some(l => l.message && l.message.trim() !== '');
            if (hasNonEmptyLocales && !supportsMultiLanguage) {
              onSupportsMultiLanguageChange(true);
            }
          }}
          templates={messageTemplates}
          selectedTemplateId={selectedTemplateId}
          onSelectedTemplateIdChange={onSelectedTemplateIdChange}
          messageRequired={formData.isMaintenance}
          messageError={!!formErrors.maintenanceMessage}
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
        helperText={t('gameWorlds.form.customPayloadHelp') || '게임월드 관련 추가 데이터(JSON). 비워두면 {}로 저장됩니다.'}
      />
    </Box>
  );
};

export default GameWorldForm;

