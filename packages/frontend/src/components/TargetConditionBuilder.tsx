import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Autocomplete,
  Alert,
  Collapse,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PlayArrow as TestIcon,
  Visibility as PreviewIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import contextFieldService, {
  ContextFieldDefinition,
  ContextOperator,
  TargetCondition,
  SampleContext
} from '../services/contextFieldService';

interface TargetConditionBuilderProps {
  conditions: TargetCondition[];
  onChange: (conditions: TargetCondition[]) => void;
  disabled?: boolean;
}

const TargetConditionBuilder: React.FC<TargetConditionBuilderProps> = ({
  conditions,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [fields, setFields] = useState<ContextFieldDefinition[]>([]);
  const [operators, setOperators] = useState<ContextOperator[]>([]);
  const [loading, setLoading] = useState(true);
  const [testExpanded, setTestExpanded] = useState(false);
  const [sampleContexts, setSampleContexts] = useState<SampleContext[]>([]);
  const [selectedSample, setSelectedSample] = useState<SampleContext | null>(null);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    loadContextFields();
    loadSampleContexts();
  }, []);

  useEffect(() => {
    validateConditions();
  }, [conditions, fields, operators]);

  const loadContextFields = async () => {
    try {
      const data = await contextFieldService.getContextFields();
      setFields(data.fields);
      setOperators(data.operators);
    } catch (error) {
      console.error('Failed to load context fields:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSampleContexts = async () => {
    try {
      const samples = await contextFieldService.getSampleContexts();
      setSampleContexts(samples);
    } catch (error) {
      console.error('Failed to load sample contexts:', error);
    }
  };

  const validateConditions = async () => {
    if (conditions.length === 0) {
      setValidationErrors([]);
      return;
    }

    try {
      const result = await contextFieldService.validateConditions(conditions);
      setValidationErrors(result.errors);
    } catch (error) {
      console.error('Failed to validate conditions:', error);
    }
  };

  const addCondition = () => {
    const newCondition = contextFieldService.createEmptyCondition(fields);
    onChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, updates: Partial<TargetCondition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    onChange(newConditions);
  };

  const removeCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index);
    onChange(newConditions);
  };

  const getOperatorsForField = (fieldKey: string): ContextOperator[] => {
    const field = fields.find(f => f.key === fieldKey);
    if (!field) return [];
    return contextFieldService.getOperatorsForField(field, operators);
  };

  const getFieldOptions = (fieldKey: string) => {
    const field = fields.find(f => f.key === fieldKey);
    return field?.options || [];
  };

  const renderValueInput = (condition: TargetCondition, index: number) => {
    const field = fields.find(f => f.key === condition.field);
    const operator = operators.find(op => op.key === condition.operator);
    
    if (!field || !operator || operator.valueType === 'none') {
      return null;
    }

    const fieldOptions = getFieldOptions(condition.field);
    const isMultiple = operator.valueType === 'multiple';

    if (field.type === 'boolean') {
      return (
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Value</InputLabel>
          <Select
            value={condition.value || false}
            onChange={(e) => updateCondition(index, { value: e.target.value })}
            disabled={disabled}
          >
            <MenuItem value={true}>True</MenuItem>
            <MenuItem value={false}>False</MenuItem>
          </Select>
        </FormControl>
      );
    }

    if (fieldOptions.length > 0) {
      if (isMultiple) {
        return (
          <Autocomplete
            multiple
            size="small"
            options={fieldOptions}
            getOptionLabel={(option) => option.label}
            value={fieldOptions.filter(opt => 
              Array.isArray(condition.value) && condition.value.includes(opt.value)
            )}
            onChange={(_, newValue) => {
              updateCondition(index, { value: newValue.map(opt => opt.value) });
            }}
            disabled={disabled}
            renderInput={(params) => (
              <TextField {...params} label="Values" sx={{ minWidth: 200 }} />
            )}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option.label}
                  size="small"
                  {...getTagProps({ index })}
                />
              ))
            }
          />
        );
      } else {
        return (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Value</InputLabel>
            <Select
              value={condition.value || ''}
              onChange={(e) => updateCondition(index, { value: e.target.value })}
              disabled={disabled}
            >
              {fieldOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      }
    }

    if (isMultiple) {
      return (
        <Autocomplete
          multiple
          freeSolo
          size="small"
          options={[]}
          value={Array.isArray(condition.value) ? condition.value : []}
          onChange={(_, newValue) => {
            updateCondition(index, { value: newValue });
          }}
          disabled={disabled}
          renderInput={(params) => (
            <TextField {...params} label="Values" sx={{ minWidth: 200 }} />
          )}
          renderTags={(value, getTagProps) =>
            value.map((option, index) => (
              <Chip
                variant="outlined"
                label={option}
                size="small"
                {...getTagProps({ index })}
              />
            ))
          }
        />
      );
    }

    return (
      <TextField
        size="small"
        label="Value"
        type={field.type === 'number' ? 'number' : 'text'}
        value={condition.value || ''}
        onChange={(e) => updateCondition(index, { value: e.target.value })}
        disabled={disabled}
        sx={{ minWidth: 150 }}
      />
    );
  };

  const testConditions = async () => {
    if (!selectedSample || conditions.length === 0) return;

    try {
      const result = await contextFieldService.testConditions(
        conditions,
        selectedSample.context
      );
      setTestResult(result.result);
    } catch (error) {
      console.error('Failed to test conditions:', error);
      setTestResult(null);
    }
  };

  if (loading) {
    return <Typography>Loading context fields...</Typography>;
  }

  return (
    <Card>
      <CardHeader
        title={t('admin.remoteConfig.campaigns.targetConditions')}
        subheader={t('admin.remoteConfig.campaigns.targetConditionsHelp')}
        action={
          <Button
            startIcon={<AddIcon />}
            onClick={addCondition}
            disabled={disabled}
            size="small"
          >
            Add Condition
          </Button>
        }
      />
      <CardContent>
        {conditions.length === 0 ? (
          <Alert severity="info">
            No conditions set. Campaign will apply to all users.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {conditions.map((condition, index) => (
              <Card key={index} variant="outlined">
                <CardContent sx={{ pb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    {index > 0 && (
                      <FormControl size="small" sx={{ minWidth: 80 }}>
                        <InputLabel>Logic</InputLabel>
                        <Select
                          value={condition.logicalOperator || 'AND'}
                          onChange={(e) => updateCondition(index, { 
                            logicalOperator: e.target.value as 'AND' | 'OR' 
                          })}
                          disabled={disabled}
                        >
                          <MenuItem value="AND">AND</MenuItem>
                          <MenuItem value="OR">OR</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                    
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel>Field</InputLabel>
                      <Select
                        value={condition.field}
                        onChange={(e) => {
                          const field = fields.find(f => f.key === e.target.value);
                          const availableOperators = field ? contextFieldService.getOperatorsForField(field, operators) : [];
                          updateCondition(index, { 
                            field: e.target.value,
                            operator: availableOperators[0]?.key || '',
                            value: field?.defaultValue || ''
                          });
                        }}
                        disabled={disabled}
                      >
                        {fields.map((field) => (
                          <MenuItem key={field.key} value={field.key}>
                            {field.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, { operator: e.target.value })}
                        disabled={disabled}
                      >
                        {getOperatorsForField(condition.field).map((operator) => (
                          <MenuItem key={operator.key} value={operator.key}>
                            {operator.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {renderValueInput(condition, index)}

                    <IconButton
                      onClick={() => removeCondition(index)}
                      disabled={disabled}
                      color="error"
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2">Validation Errors:</Typography>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </Alert>
        )}

        <Divider sx={{ my: 2 }} />

        <Box>
          <Button
            startIcon={testExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setTestExpanded(!testExpanded)}
            size="small"
          >
            Test Conditions
          </Button>
          
          <Collapse in={testExpanded}>
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <Autocomplete
                  size="small"
                  options={sampleContexts}
                  getOptionLabel={(option) => option.name}
                  value={selectedSample}
                  onChange={(_, newValue) => setSelectedSample(newValue)}
                  renderInput={(params) => (
                    <TextField {...params} label="Sample User" sx={{ minWidth: 200 }} />
                  )}
                />
                
                <Button
                  startIcon={<TestIcon />}
                  onClick={testConditions}
                  disabled={!selectedSample || conditions.length === 0}
                  variant="contained"
                  size="small"
                >
                  Test
                </Button>
              </Box>

              {testResult !== null && (
                <Alert severity={testResult ? 'success' : 'warning'}>
                  <Typography variant="subtitle2">
                    Test Result: {testResult ? 'MATCH' : 'NO MATCH'}
                  </Typography>
                  <Typography variant="body2">
                    {testResult 
                      ? 'This user would be included in the campaign.'
                      : 'This user would NOT be included in the campaign.'
                    }
                  </Typography>
                </Alert>
              )}

              {selectedSample && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Sample User Context:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(selectedSample.context).map(([key, value]) => (
                      <Chip
                        key={key}
                        label={`${key}: ${JSON.stringify(value)}`}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TargetConditionBuilder;
