import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Typography,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Job,
  JobType,
  CreateJobData,
  UpdateJobData,
  JobSchemaField,
} from '../../types/job';
import { Tag } from '../../services/tagService';
import { jobService } from '../../services/jobService';
import DynamicJobDataForm from './DynamicJobDataForm';
import { getContrastColor } from '@/utils/colorUtils';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import TagSelector from '@/components/common/TagSelector';
import LocalizedDateTimePicker from '@/components/common/LocalizedDateTimePicker';

interface JobFormProps {
  job?: Job | null;
  jobTypes: JobType[];
  onSubmit: (data: CreateJobData | UpdateJobData) => void;
  onCancel: () => void;
  isDrawer?: boolean;
}

const JobForm: React.FC<JobFormProps> = ({
  job,
  jobTypes,
  onSubmit,
  onCancel,
  isDrawer = false,
}) => {
  const { t } = useTranslation();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    jobTypeId: '',
    memo: '',
    isEnabled: true,
    tagIds: [] as number[],
    jobDataMap: {},
    executionType: 'manual', // 'manual' | 'cron' | 'onetime'
    cronExpression: '',
    triggerAt: null as string | null,
    timezone: 'Asia/Seoul',
    retryPolicyEnabled: false,
    maxRetries: 3,
    backoffMs: 1000,
  });

  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [initialFormData, setInitialFormData] = useState<string>('');

  // Initialize form data
  useEffect(() => {
    if (job) {
      const hasJobDataMap =
        job.jobDataMap && Object.keys(job.jobDataMap).length > 0;

      let executionType = 'manual';
      let retryPolicyEnabled = false;
      let maxRetries = 3;
      let backoffMs = 1000;

      if (job.cronExpression) executionType = 'cron';
      else if (job.triggerAt) executionType = 'onetime';

      if (job.retryPolicy) {
        retryPolicyEnabled = true;
        maxRetries = job.retryPolicy.maxRetries;
        backoffMs = job.retryPolicy.backoffMs;
      }

      const newFormData = {
        name: job.name,
        jobTypeId: job.jobTypeId.toString(),
        memo: job.memo || '',
        isEnabled: job.isEnabled ?? true,
        tagIds: job.tags?.map((tag) => tag.id) || [],
        jobDataMap: job.jobDataMap || {},
        executionType,
        cronExpression: job.cronExpression || '',
        triggerAt: job.triggerAt || null,
        timezone: job.timezone || 'Asia/Seoul',
        retryPolicyEnabled,
        maxRetries,
        backoffMs,
      };

      setFormData(newFormData);
      setInitialFormData(JSON.stringify(newFormData));
      setSelectedTags(job.tags || []);

      const jobType = jobTypes.find((jt) => jt.id === job.jobTypeId);
      setSelectedJobType(jobType || null);
    } else {
      setInitialFormData(JSON.stringify(formData));
    }
  }, [job, jobTypes]);

  // Handle job type change
  const handleJobTypeChange = (jobTypeId: string) => {
    const jobType = jobTypes.find((jt) => jt.id.toString() === jobTypeId);
    setSelectedJobType(jobType || null);
    setFormData((prev) => ({
      ...prev,
      jobTypeId: jobTypeId,
      // Job 편집 모드에서는 Existing jobDataMap 유지, 새 Create 시에만 Initialization
      jobDataMap: job ? prev.jobDataMap : {},
    }));
  };

  // Handle form field changes
  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle job data map changes
  const handleJobDataChange = (jobDataMap: any) => {
    setFormData((prev) => {
      return {
        ...prev,
        jobDataMap: jobDataMap,
      };
    });
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('jobs.validation.nameRequired');
    }

    if (!formData.jobTypeId) {
      newErrors.jobTypeId = t('jobs.validation.jobTypeRequired');
    }

    // Validate job data map based on schema
    if (selectedJobType?.jobSchema) {
      const schema = selectedJobType.jobSchema;
      Object.entries(schema).forEach(
        ([key, field]: [string, JobSchemaField]) => {
          if (field.required && !formData.jobDataMap[key]) {
            newErrors[`jobDataMap.${key}`] = t(
              'jobs.validation.fieldRequired',
              {
                field: field.description,
              }
            );
          }
        }
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const submitData = {
      name: formData.name,
      jobTypeId: formData.jobTypeId,
      memo: formData.memo || undefined,
      isEnabled: formData.isEnabled,
      tagIds: formData.tagIds,
      jobDataMap: formData.jobDataMap,
      cronExpression: formData.executionType === 'cron' ? formData.cronExpression : null,
      triggerAt: formData.executionType === 'onetime' ? formData.triggerAt : null,
      timezone: formData.timezone,
      retryPolicy: formData.retryPolicyEnabled 
        ? { maxRetries: formData.maxRetries, backoffMs: formData.backoffMs } 
        : null,
    };

    onSubmit(submitData);
  };

  if (isDrawer) {
    return (
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      >
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isEnabled}
                    onChange={(e) =>
                      handleFieldChange('isEnabled', e.target.checked)
                    }
                    color="primary"
                  />
                }
                label={t('common.usable')}
              />
            </Box>

            <Box>
              <TextField
                fullWidth
                autoFocus={!job}
                label={t('common.name')}
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                error={!!errors.name}
                helperText={
                  errors.name ||
                  (job
                    ? t('jobs.helperText.nameReadonly')
                    : t('jobs.helperText.name'))
                }
                required
                disabled={!!job}
              />
            </Box>

            <Box>
              <FormControl fullWidth error={!!errors.jobTypeId}>
                <InputLabel required>{t('jobs.jobType')}</InputLabel>
                <Select
                  value={formData.jobTypeId}
                  onChange={(e) => handleJobTypeChange(e.target.value)}
                  label={t('jobs.jobType')}
                  disabled={!!job} // Disable job type change when editing
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 99999,
                      },
                    },
                  }}
                >
                  {jobTypes
                    .filter((jt) => jt.isEnabled)
                    .map((jobType) => (
                      <MenuItem key={jobType.id} value={jobType.id.toString()}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          {t(jobType.displayName)}
                          <Chip
                            label={jobType.name}
                            size="small"
                            variant="outlined"
                          />
                        </Box>
                      </MenuItem>
                    ))}
                </Select>
                <Typography
                  variant="caption"
                  color={errors.jobTypeId ? 'error' : 'text.secondary'}
                  sx={{ mt: 0.5, ml: 1.5 }}
                >
                  {errors.jobTypeId || t('jobs.helperText.jobType')}
                </Typography>
              </FormControl>
            </Box>

            <Box>
              <TextField
                fullWidth
                label={t('common.memo')}
                value={formData.memo}
                onChange={(e) => handleFieldChange('memo', e.target.value)}
                helperText={t('jobs.helperText.memo')}
                multiline
                rows={2}
              />
            </Box>

            <Box>
              <TagSelector
                value={selectedTags}
                onChange={(tags) => {
                  setSelectedTags(tags);
                  handleFieldChange(
                    'tagIds',
                    tags.map((tag) => tag.id)
                  );
                }}
                label={t('common.tags')}
              />
            </Box>

            {/* Scheduling & Retry Settings */}
            <Box>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                {t('jobs.scheduling')}
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>{t('jobs.executionType')}</InputLabel>
                    <Select
                      value={formData.executionType}
                      label={t('jobs.executionType')}
                      onChange={(e) => handleFieldChange('executionType', e.target.value)}
                    >
                      <MenuItem value="manual">{t('jobs.executionTypeManual')}</MenuItem>
                      <MenuItem value="cron">{t('jobs.executionTypeCron')}</MenuItem>
                      <MenuItem value="onetime">{t('jobs.executionTypeOnetime')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {formData.executionType === 'cron' && (
                  <>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label={t('jobs.cronExpression')}
                        value={formData.cronExpression}
                        onChange={(e) => handleFieldChange('cronExpression', e.target.value)}
                        helperText={t('jobs.cronHelperText')}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label={t('jobs.timezone')}
                        value={formData.timezone}
                        onChange={(e) => handleFieldChange('timezone', e.target.value)}
                      />
                    </Grid>
                  </>
                )}

                {formData.executionType === 'onetime' && (
                  <Grid size={{ xs: 12 }}>
                    <LocalizedDateTimePicker
                      label={t('jobs.triggerAt')}
                      value={formData.triggerAt}
                      onChange={(val) => handleFieldChange('triggerAt', val)}
                      helperText={t('jobs.triggerAtHelperText')}
                      size="small"
                      fullWidth
                    />
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.retryPolicyEnabled}
                        onChange={(e) => handleFieldChange('retryPolicyEnabled', e.target.checked)}
                        color="primary"
                        size="small"
                      />
                    }
                    label={t('jobs.retryPolicy')}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
                    {t('jobs.retryHelperText')}
                  </Typography>
                </Grid>

                {formData.retryPolicyEnabled && (
                  <>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={t('jobs.maxRetries')}
                        value={formData.maxRetries}
                        onChange={(e) => handleFieldChange('maxRetries', parseInt(e.target.value) || 0)}
                        inputProps={{ min: 1, max: 10 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        size="small"
                        type="number"
                        label={t('jobs.backoffMs')}
                        value={formData.backoffMs}
                        onChange={(e) => handleFieldChange('backoffMs', parseInt(e.target.value) || 0)}
                        inputProps={{ min: 100 }}
                      />
                    </Grid>
                  </>
                )}
              </Grid>
            </Box>

            {/* Job Data Configuration */}
            {selectedJobType && selectedJobType.jobSchema && (
              <Box>
                <Divider sx={{ my: 2 }} />
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="h6">
                      {t('jobs.jobDataConfiguration')} -{' '}
                      {selectedJobType.displayName
                        ? t(selectedJobType.displayName)
                        : ''}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {selectedJobType.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {t(selectedJobType.description)}
                      </Typography>
                    )}
                    <DynamicJobDataForm
                      jobSchema={selectedJobType.jobSchema}
                      data={formData.jobDataMap}
                      onChange={handleJobDataChange}
                      errors={errors}
                    />
                  </AccordionDetails>
                </Accordion>
              </Box>
            )}
          </Box>
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
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              !formData.name.trim() ||
              !formData.jobTypeId ||
              (!!job && JSON.stringify(formData) === initialFormData)
            }
          >
            {job ? t('common.update') : t('jobs.addJob')}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Basic Information */}
        <Typography variant="h6" gutterBottom>
          {t('jobs.basicInformation')}
        </Typography>

        <Box>
          <TextField
            fullWidth
            label={t('common.name')}
            value={formData.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            error={!!errors.name}
            helperText={errors.name}
            required
          />
        </Box>

        <Box>
          <FormControl fullWidth error={!!errors.jobTypeId}>
            <InputLabel>{t('jobs.jobType')}</InputLabel>
            <Select
              value={formData.jobTypeId}
              label={t('jobs.jobType')}
              onChange={(e) => handleJobTypeChange(e.target.value)}
            >
              {jobTypes.map((jobType) => (
                <MenuItem key={jobType.id} value={jobType.id.toString()}>
                  {jobType.name}
                </MenuItem>
              ))}
            </Select>
            {errors.jobTypeId && (
              <Typography
                variant="caption"
                color="error"
                sx={{ mt: 0.5, ml: 1.5 }}
              >
                {errors.jobTypeId}
              </Typography>
            )}
          </FormControl>
        </Box>

        <Box>
          <TextField
            fullWidth
            label={t('common.memo')}
            value={formData.memo}
            onChange={(e) => handleFieldChange('memo', e.target.value)}
            multiline
            rows={2}
          />
        </Box>

        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={formData.isEnabled}
                onChange={(e) =>
                  handleFieldChange('isEnabled', e.target.checked)
                }
                color="primary"
              />
            }
            label={t('common.usable')}
          />
        </Box>

        {/* Tags */}
        <Box>
          <TagSelector
            value={selectedTags}
            onChange={(tags) => {
              setSelectedTags(tags);
              handleFieldChange(
                'tagIds',
                tags.map((tag) => tag.id)
              );
            }}
            label={t('common.tags')}
          />
        </Box>

        {/* Scheduling & Retry Settings */}
        <Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            {t('jobs.scheduling')}
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>{t('jobs.executionType')}</InputLabel>
                <Select
                  value={formData.executionType}
                  label={t('jobs.executionType')}
                  onChange={(e) => handleFieldChange('executionType', e.target.value)}
                >
                  <MenuItem value="manual">{t('jobs.executionTypeManual')}</MenuItem>
                  <MenuItem value="cron">{t('jobs.executionTypeCron')}</MenuItem>
                  <MenuItem value="onetime">{t('jobs.executionTypeOnetime')}</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {formData.executionType === 'cron' && (
              <>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField
                    fullWidth
                    label={t('jobs.cronExpression')}
                    value={formData.cronExpression}
                    onChange={(e) => handleFieldChange('cronExpression', e.target.value)}
                    helperText={t('jobs.cronHelperText')}
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    fullWidth
                    label={t('jobs.timezone')}
                    value={formData.timezone}
                    onChange={(e) => handleFieldChange('timezone', e.target.value)}
                  />
                </Grid>
              </>
            )}

            {formData.executionType === 'onetime' && (
              <Grid size={{ xs: 12 }}>
                <LocalizedDateTimePicker
                  label={t('jobs.triggerAt')}
                  value={formData.triggerAt}
                  onChange={(val) => handleFieldChange('triggerAt', val)}
                  helperText={t('jobs.triggerAtHelperText')}
                  fullWidth
                />
              </Grid>
            )}

            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.retryPolicyEnabled}
                    onChange={(e) => handleFieldChange('retryPolicyEnabled', e.target.checked)}
                    color="primary"
                  />
                }
                label={t('jobs.retryPolicy')}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -1 }}>
                {t('jobs.retryHelperText')}
              </Typography>
            </Grid>

            {formData.retryPolicyEnabled && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('jobs.maxRetries')}
                    value={formData.maxRetries}
                    onChange={(e) => handleFieldChange('maxRetries', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 1, max: 10 }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="number"
                    label={t('jobs.backoffMs')}
                    value={formData.backoffMs}
                    onChange={(e) => handleFieldChange('backoffMs', parseInt(e.target.value) || 0)}
                    inputProps={{ min: 100 }}
                  />
                </Grid>
              </>
            )}
          </Grid>
        </Box>

        {/* Job Data */}
        {selectedJobType && selectedJobType.schema && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" gutterBottom>
              {t('jobs.jobData')}
            </Typography>
            <DynamicJobDataForm
              jobSchema={selectedJobType.schema}
              data={formData.jobDataMap}
              onChange={(data) => handleFieldChange('jobDataMap', data)}
              errors={errors}
            />
          </Box>
        )}

        {/* Actions */}
        <Box
          sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}
        >
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={
              !formData.name.trim() ||
              !formData.jobTypeId ||
              (!!job && JSON.stringify(formData) === initialFormData)
            }
          >
            {job ? t('common.update') : t('jobs.addJob')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default JobForm;
