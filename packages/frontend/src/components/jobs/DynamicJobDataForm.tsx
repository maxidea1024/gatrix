import React, { useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { JobSchemaDefinition, JobSchemaField } from '../../types/job';
import JsonEditor from '../common/JsonEditor';

interface DynamicJobDataFormProps {
  schema: JobSchemaDefinition;
  data: any;
  onChange: (data: any) => void;
  errors: Record<string, string>;
}

const DynamicJobDataForm: React.FC<DynamicJobDataFormProps> = ({
  schema,
  data,
  onChange,
  errors
}) => {
  const { t } = useTranslation();

  // 스키마가 변경될 때 기본값 설정
  useEffect(() => {
    if (!schema || Object.keys(schema).length === 0) return;

    const newData = { ...data };
    let hasChanges = false;

    Object.entries(schema).forEach(([fieldName, field]) => {
      // 필드에 값이 없고 기본값이 있는 경우 기본값 설정
      if (data[fieldName] === undefined && field.default !== undefined) {
        newData[fieldName] = field.default;
        hasChanges = true;
      }
    });

    if (hasChanges) {
      onChange(newData);
    }
  }, [schema, data, onChange]);

  const handleFieldChange = (fieldName: string, value: any) => {
    const newData = { ...data, [fieldName]: value };
    onChange(newData);
  };

  const handleArrayAdd = (fieldName: string) => {
    const currentArray = data[fieldName] || [];
    const newArray = [...currentArray, ''];
    handleFieldChange(fieldName, newArray);
  };

  const handleArrayRemove = (fieldName: string, index: number) => {
    const currentArray = data[fieldName] || [];
    const newArray = currentArray.filter((_: any, i: number) => i !== index);
    handleFieldChange(fieldName, newArray);
  };

  const handleArrayItemChange = (fieldName: string, index: number, value: any) => {
    const currentArray = data[fieldName] || [];
    const newArray = [...currentArray];
    newArray[index] = value;
    handleFieldChange(fieldName, newArray);
  };

  const renderField = (fieldName: string, field: JobSchemaField) => {
    const value = data[fieldName] || field.default || '';
    const errorKey = `job_data_map.${fieldName}`;
    const hasError = !!errors[errorKey];

    switch (field.type) {
      case 'string':
        return (
          <TextField
            fullWidth
            label={field.description}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            required={field.required}
            error={hasError}
            helperText={hasError ? errors[errorKey] : undefined}
          />
        );

      case 'password':
        return (
          <TextField
            fullWidth
            type="password"
            label={field.description}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            required={field.required}
            error={hasError}
            helperText={hasError ? errors[errorKey] : undefined}
          />
        );

      case 'text':
        return (
          <TextField
            fullWidth
            multiline
            rows={4}
            label={field.description}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            required={field.required}
            error={hasError}
            helperText={hasError ? errors[errorKey] : undefined}
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            label={field.description}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
            required={field.required}
            error={hasError}
            helperText={hasError ? errors[errorKey] : undefined}
            inputProps={{
              min: field.validation?.min,
              max: field.validation?.max
            }}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Switch
                checked={!!value}
                onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
              />
            }
            label={field.description}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth error={hasError}>
            <InputLabel required={field.required}>{field.description}</InputLabel>
            <Select
              value={value}
              onChange={(e) => handleFieldChange(fieldName, e.target.value)}
              label={field.description}
            >
              {field.options?.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
            {hasError && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {errors[errorKey]}
              </Typography>
            )}
          </FormControl>
        );

      case 'array':
        const arrayValue = data[fieldName] || [];
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="body2" fontWeight="medium">
                {field.description}
                {field.required && <span style={{ color: 'red' }}> *</span>}
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => handleArrayAdd(fieldName)}
              >
                {t('common.add')}
              </Button>
            </Box>
            {arrayValue.map((item: any, index: number) => (
              <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={item}
                  onChange={(e) => handleArrayItemChange(fieldName, index, e.target.value)}
                  placeholder={`${field.description} ${index + 1}`}
                />
                <IconButton
                  size="small"
                  onClick={() => handleArrayRemove(fieldName, index)}
                  color="error"
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            ))}
            {hasError && (
              <Typography variant="caption" color="error">
                {errors[errorKey]}
              </Typography>
            )}
          </Box>
        );

      case 'object':
        const jsonValue = typeof value === 'object' ? JSON.stringify(value || {}, null, 2) : value || '{}';
        return (
          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {field.label} {field.required && `(${t('common.required')})`}
            </Typography>
            <JsonEditor
              value={jsonValue}
              onChange={(newValue) => {
                try {
                  const parsed = JSON.parse(newValue);
                  handleFieldChange(fieldName, parsed);
                } catch (error) {
                  // 유효하지 않은 JSON인 경우 문자열로 저장
                  handleFieldChange(fieldName, newValue);
                }
              }}
              error={hasError ? errors[errorKey] : undefined}
              helperText={field.description}
              height="200px"
            />
          </Box>
        );

      default:
        return (
          <TextField
            fullWidth
            label={field.description}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            required={field.required}
            error={hasError}
            helperText={hasError ? errors[errorKey] : undefined}
          />
        );
    }
  };

  if (!schema || Object.keys(schema).length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t('jobs.noConfigurationRequired')}
      </Typography>
    );
  }

  // HTTP 요청 타입인지 확인
  const isHttpRequest = Object.keys(schema).includes('url') && Object.keys(schema).includes('method');
  const httpMethod = data.method || 'GET';
  const shouldHideBody = isHttpRequest && httpMethod === 'GET';

  // 필드 순서 정의 (HTTP 요청의 경우)
  const getFieldOrder = () => {
    if (isHttpRequest) {
      const orderedFields = ['method', 'url', 'headers', 'body'];
      const otherFields = Object.keys(schema).filter(key => !orderedFields.includes(key));
      return [...orderedFields, ...otherFields];
    }
    return Object.keys(schema);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* GET 요청일 때 body 필드가 숨겨졌다는 안내 메시지 */}
      {shouldHideBody && schema.body && (
        <Box sx={{
          p: 2,
          bgcolor: 'info.light',
          borderRadius: 1,
          border: 1,
          borderColor: 'info.main',
          color: 'info.contrastText'
        }}>
          <Typography variant="body2">
            💡 {t('jobs.getRequestNoBody')}
          </Typography>
        </Box>
      )}

      {getFieldOrder().map((fieldName) => {
        const field = schema[fieldName];
        if (!field) return null;

        // GET 요청일 때 body 필드 숨기기
        if (shouldHideBody && fieldName === 'body') {
          return null;
        }

        return (
          <Box key={fieldName}>
            <Box>
              {field.type !== 'boolean' && field.type !== 'array' && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {fieldName}
                  </Typography>
                  <Chip
                    label={field.type}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                  {field.required && (
                    <Chip
                      label={t('common.required')}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  )}
                </Box>
              )}
              {renderField(fieldName, field)}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default DynamicJobDataForm;
