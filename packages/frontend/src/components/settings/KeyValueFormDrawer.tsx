import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Typography,
  FormControlLabel,
  Switch,
  Stack,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { varsService, VarItem, VarValueType, CreateVarData, UpdateVarData } from '@/services/varsService';
import { MuiColorInput } from 'mui-color-input';
import JsonEditor from '@/components/common/JsonEditor';
import ArrayEditor from '@/components/common/ArrayEditor';
import ResizableDrawer from '@/components/common/ResizableDrawer';

interface KeyValueFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: VarItem | null;
}

interface FormData {
  varKey: string;
  varValue: string;
  valueType: VarValueType;
  description: string;
  arrayElementType?: VarValueType;
}

const KeyValueFormDrawer: React.FC<KeyValueFormDrawerProps> = ({
  open,
  onClose,
  onSuccess,
  item,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    varKey: '',
    varValue: '',
    valueType: 'string',
    description: '',
    arrayElementType: undefined,
  });

  const [formErrors, setFormErrors] = useState<{
    varKey?: string;
    varValue?: string;
  }>({});

  // Initialize form with item data
  useEffect(() => {
    if (item) {
      // Parse arrayElementType from description if exists
      let arrayElementType: VarValueType | undefined = undefined;
      if (item.valueType === 'array' && item.description) {
        const match = item.description.match(/\[elementType:(\w+)\]/);
        if (match) {
          arrayElementType = match[1] as VarValueType;
        }
      }

      setFormData({
        varKey: item.varKey.replace('kv:', ''),
        varValue: item.varValue || '',
        valueType: item.valueType,
        description: item.description?.replace(/\[elementType:\w+\]\s*/, '') || '',
        arrayElementType,
      });
    } else {
      // Reset form
      setFormData({
        varKey: '',
        varValue: '',
        valueType: 'string',
        description: '',
        arrayElementType: undefined,
      });
    }
    setFormErrors({});
  }, [item, open]);

  // Validate C identifier for key name
  const isValidCIdentifier = (key: string): boolean => {
    // C identifier: starts with letter or underscore, followed by letters, digits, or underscores
    const cIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    return cIdentifierRegex.test(key);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: { varKey?: string; varValue?: string } = {};

    // Validate key
    if (!formData.varKey.trim()) {
      errors.varKey = t('settings.kv.keyRequired');
    } else if (!isValidCIdentifier(formData.varKey.trim())) {
      errors.varKey = t('settings.kv.keyInvalidFormat');
    }

    // Validate value - must not be empty, null, or undefined
    if (!formData.varValue || formData.varValue.trim() === '') {
      errors.varValue = t('settings.kv.valueRequired');
    } else {
      // Validate JSON for object/array types
      if (formData.valueType === 'object' || formData.valueType === 'array') {
        try {
          const parsed = JSON.parse(formData.varValue);
          if (parsed === null || parsed === undefined) {
            errors.varValue = t('settings.kv.valueRequired');
          }
        } catch (e) {
          errors.varValue = t('settings.kv.invalidJson');
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      // Prepare description with element type metadata for arrays
      let description = formData.description || '';
      if (formData.valueType === 'array' && formData.arrayElementType) {
        description = `[elementType:${formData.arrayElementType}] ${description}`.trim();
      }

      const data: CreateVarData | UpdateVarData = {
        varKey: formData.varKey.trim(),
        varValue: formData.varValue.trim(),
        valueType: formData.valueType,
        description,
      };

      if (item) {
        await varsService.updateKV(item.varKey.replace('kv:', ''), data as UpdateVarData);
        enqueueSnackbar(t('settings.kv.updateSuccess'), { variant: 'success' });
      } else {
        await varsService.createKV(data as CreateVarData);
        enqueueSnackbar(t('settings.kv.createSuccess'), { variant: 'success' });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      // Handle error with localization based on errorCode
      let errorMessage = t('settings.kv.saveFailed');

      if (error.errorCode === 'DUPLICATE_KEY') {
        errorMessage = t('settings.kv.errors.duplicateKey');
      } else if (error.errorCode === 'KV_NOT_FOUND') {
        errorMessage = t('settings.kv.errors.notFound');
      } else if (error.errorCode === 'SYSTEM_DEFINED_TYPE_CHANGE') {
        errorMessage = t('settings.kv.errors.systemDefinedTypeChange');
      } else if (error.errorCode === 'REQUIRED_FIELDS_MISSING') {
        errorMessage = t('settings.kv.errors.requiredFieldsMissing');
      } else if (error.message) {
        errorMessage = error.message;
      }

      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Render value editor based on type
  const renderValueEditor = () => {
    switch (formData.valueType) {
      case 'number':
        return (
          <TextField
            fullWidth
            label={`${t('settings.kv.value')} *`}
            type="number"
            value={formData.varValue}
            onChange={(e) => setFormData({ ...formData, varValue: e.target.value })}
            error={!!formErrors.varValue}
            helperText={formErrors.varValue || t('settings.kv.numberHelp')}
          />
        );
      case 'boolean':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('settings.kv.value')} <span style={{ color: 'red' }}>*</span>
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.varValue === 'true'}
                  onChange={(e) => setFormData({ ...formData, varValue: e.target.checked ? 'true' : 'false' })}
                />
              }
              label={formData.varValue === 'true' ? 'true' : 'false'}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {t('settings.kv.booleanHelp')}
            </Typography>
          </Box>
        );
      case 'color':
        return (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              {t('settings.kv.value')} *
            </Typography>
            <MuiColorInput
              fullWidth
              value={formData.varValue || '#000000'}
              onChange={(color) => setFormData({ ...formData, varValue: color })}
              format="hex"
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {formErrors.varValue || t('settings.kv.colorHelp')}
            </Typography>
          </Box>
        );
      case 'object':
        return (
          <Box>
            <JsonEditor
              value={formData.varValue || '{}'}
              onChange={(value) => setFormData({ ...formData, varValue: value })}
              height="200px"
              label={`${t('settings.kv.value')} *`}
              placeholder='{\n  "key": "value"\n}'
              error={formErrors.varValue}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {t('settings.kv.objectHelp')}
            </Typography>
          </Box>
        );
      case 'array':
        return (
          <ArrayEditor
            value={formData.varValue || '[]'}
            onChange={(value) => setFormData({ ...formData, varValue: value })}
            elementType={formData.arrayElementType || 'string'}
            label={`${t('settings.kv.value')} *`}
            helperText={t('settings.kv.arrayEditorHelp')}
            error={formErrors.varValue}
          />
        );
      default: // string
        return (
          <TextField
            fullWidth
            label={`${t('settings.kv.value')} *`}
            value={formData.varValue}
            onChange={(e) => setFormData({ ...formData, varValue: e.target.value })}
            error={!!formErrors.varValue}
            helperText={formErrors.varValue || t('settings.kv.stringHelp')}
          />
        );
    }
  };

  const isSystemDefined = item?.isSystemDefined || false;

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={item ? t('settings.kv.edit') : t('settings.kv.create')}
      subtitle={item ? t('settings.kv.editSubtitle') : t('settings.kv.createSubtitle')}
      storageKey="kvFormDrawerWidth"
      defaultWidth={700}
      minWidth={500}
      zIndex={1300}
    >
      {/* Content */}
      <Box
        sx={{
          p: 3,
          flexGrow: 1,
          overflow: 'auto',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
          },
        }}
      >
        <Stack spacing={3}>
          {/* Key */}
          <TextField
            fullWidth
            label={`${t('settings.kv.key')} *`}
            value={formData.varKey}
            onChange={(e) => setFormData({ ...formData, varKey: e.target.value })}
            disabled={isSystemDefined}
            error={!!formErrors.varKey}
            helperText={
              formErrors.varKey ||
              (isSystemDefined ? t('settings.kv.systemDefinedKeyHelp') : t('settings.kv.keyHelp'))
            }
            autoFocus={!item}
          />

          {/* Type */}
          <TextField
            fullWidth
            select
            label={`${t('settings.kv.type')} *`}
            value={formData.valueType}
            onChange={(e) => {
              const newType = e.target.value as VarValueType;
              setFormData({
                ...formData,
                valueType: newType,
                varValue: newType === 'boolean' ? 'false' :
                         newType === 'number' ? '0' :
                         newType === 'color' ? '#000000' :
                         newType === 'object' ? '{}' :
                         newType === 'array' ? '[]' : '',
                arrayElementType: newType === 'array' ? 'string' : undefined,
              });
            }}
            disabled={isSystemDefined}
            helperText={isSystemDefined ? t('settings.kv.systemDefinedTypeHelp') : t('settings.kv.typeHelp')}
          >
            <MenuItem value="string">String</MenuItem>
            <MenuItem value="number">Number</MenuItem>
            <MenuItem value="boolean">Boolean</MenuItem>
            <MenuItem value="color">Color</MenuItem>
            <MenuItem value="array">Array</MenuItem>
            <MenuItem value="object">Object</MenuItem>
          </TextField>

          {/* Array Element Type */}
          {formData.valueType === 'array' && (
            <TextField
              fullWidth
              select
              label={`${t('settings.kv.arrayElementType')} *`}
              value={formData.arrayElementType || 'string'}
              onChange={(e) => setFormData({ ...formData, arrayElementType: e.target.value as VarValueType })}
              helperText={t('settings.kv.arrayElementTypeHelp')}
            >
              <MenuItem value="string">String</MenuItem>
              <MenuItem value="number">Number</MenuItem>
              <MenuItem value="boolean">Boolean</MenuItem>
              <MenuItem value="color">Color</MenuItem>
              <MenuItem value="object">Object</MenuItem>
            </TextField>
          )}

          {/* Value */}
          {renderValueEditor()}

          {/* Description */}
          <TextField
            fullWidth
            multiline
            rows={2}
            label={t('settings.kv.description')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            helperText={t('settings.kv.descriptionHelp')}
          />
        </Stack>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Button onClick={onClose} disabled={submitting}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting}
        >
          {item ? t('common.update') : t('common.create')}
        </Button>
      </Box>
    </ResizableDrawer>
  );
};

export default KeyValueFormDrawer;

