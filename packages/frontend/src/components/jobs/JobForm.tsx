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
  Autocomplete
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Job, JobType, CreateJobData, UpdateJobData, JobSchemaField } from '../../types/job';
import { Tag, tagService } from '../../services/tagService';
import { jobService } from '../../services/jobService';
import DynamicJobDataForm from './DynamicJobDataForm';
import { getContrastColor } from '@/utils/colorUtils';

interface JobFormProps {
  job?: Job | null;
  jobTypes: JobType[];
  onSubmit: (data: CreateJobData | UpdateJobData) => void;
  onCancel: () => void;
  isDrawer?: boolean;
}

const JobForm: React.FC<JobFormProps> = ({ job, jobTypes, onSubmit, onCancel, isDrawer = false }) => {
  const { t } = useTranslation();

  console.log('JobForm - Component rendered with jobTypes:', jobTypes);
  console.log('JobForm - jobTypes length:', jobTypes?.length);
  console.log('JobForm - jobTypes type:', typeof jobTypes);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    jobTypeId: '',
    memo: '',
    isEnabled: true,
    tagIds: [] as number[],
    jobDataMap: {}
  });

  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // Initialize form data
  useEffect(() => {
    console.log('JobForm useEffect triggered - job:', job, 'jobTypes:', jobTypes);
    if (job) {
      console.log('Initializing form with job:', job);
      console.log('Job jobDataMap:', job.jobDataMap);
      console.log('Job jobDataMap type:', typeof job.jobDataMap);
      console.log('Job jobDataMap keys:', Object.keys(job.jobDataMap || {}));

      // Job 편집 모드에서 jobDataMap이 비어있으면 상세 정보를 다시 조회
      const hasJobDataMap = job.jobDataMap && Object.keys(job.jobDataMap).length > 0;
      console.log('Has jobDataMap:', hasJobDataMap);

      if (!hasJobDataMap && job.id) {
        console.log('JobDataMap is empty, fetching detailed job info...');
        // 상세 정보 조회
        fetchJobDetails(job.id);
        return;
      }

      const newFormData = {
        name: job.name,
        jobTypeId: job.jobTypeId.toString(),
        memo: job.memo || '',
        isEnabled: job.isEnabled ?? true,
        tagIds: job.tags?.map(tag => tag.id) || [],
        jobDataMap: job.jobDataMap || {}
      };

      console.log('Setting formData to:', newFormData);
      setFormData(newFormData);

      const jobType = jobTypes.find(jt => jt.id === job.jobTypeId);
      console.log('Found job type:', jobType);
      setSelectedJobType(jobType || null);
    } else {
      console.log('No job provided, skipping initialization');
    }
  }, [job, jobTypes]);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await tagService.list();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    };
    loadTags();
  }, []);

  // Handle job type change
  const handleJobTypeChange = (jobTypeId: string) => {
    const jobType = jobTypes.find(jt => jt.id === parseInt(jobTypeId));
    console.log('Selected job type:', jobType);
    console.log('Job schema:', jobType?.jobSchema);
    setSelectedJobType(jobType || null);
    setFormData(prev => ({
      ...prev,
      jobTypeId: jobTypeId,
      // Job 편집 모드에서는 기존 jobDataMap 유지, 새 생성 시에만 초기화
      jobDataMap: job ? prev.jobDataMap : {}
    }));
  };

  // Handle form field changes
  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle job data map changes
  const handleJobDataChange = (jobDataMap: any) => {
    console.log('JobForm handleJobDataChange called with:', jobDataMap);
    setFormData(prev => {
      console.log('JobForm previous formData.jobDataMap:', prev.jobDataMap);
      const updated = {
        ...prev,
        jobDataMap: jobDataMap
      };
      console.log('JobForm updated formData.jobDataMap:', updated.jobDataMap);
      return updated;
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
      Object.entries(schema).forEach(([key, field]: [string, JobSchemaField]) => {
        if (field.required && !formData.jobDataMap[key]) {
          newErrors[`jobDataMap.${key}`] = t('jobs.validation.fieldRequired', { field: field.description });
        }
      });
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
      jobTypeId: parseInt(formData.jobTypeId),
      memo: formData.memo || undefined,
      isEnabled: formData.isEnabled,
      tagIds: formData.tagIds,
      jobDataMap: formData.jobDataMap
    };

    onSubmit(submitData);
  };

  if (isDrawer) {
    return (
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
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
            <InputLabel required>{t('jobs.jobType')}</InputLabel>
            <Select
              value={formData.jobTypeId}
              onChange={(e) => handleJobTypeChange(e.target.value)}
              label={t('jobs.jobType')}
              disabled={!!job} // Disable job type change when editing
              MenuProps={{
                PaperProps: {
                  style: {
                    zIndex: 99999
                  }
                }
              }}
            >
              {console.log('JobForm - Rendering job types:', jobTypes) || jobTypes.filter(jt => jt.isEnabled).map((jobType) => (
                <MenuItem key={jobType.id} value={jobType.id.toString()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {jobType.displayName}
                    <Chip label={jobType.name} size="small" variant="outlined" />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.jobTypeId && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
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
                onChange={(e) => handleFieldChange('isEnabled', e.target.checked)}
                color="primary"
              />
            }
            label={t('common.usable')}
          />
        </Box>

        <Box>
          <Autocomplete
            multiple
            options={availableTags}
            getOptionLabel={(option) => option.name}
            value={availableTags.filter(tag => formData.tagIds.includes(tag.id))}
            onChange={(_, newValue) => {
              handleFieldChange('tagIds', newValue.map(tag => tag.id));
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => (
                <Chip
                  variant="outlined"
                  label={option.name}
                  style={{ backgroundColor: option.color, color: '#fff' }}
                  {...getTagProps({ index })}
                />
              ))
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('common.tags')}
                placeholder={t('common.selectTags')}
              />
            )}
          />
        </Box>





        {/* Job Data Configuration */}
        {selectedJobType && selectedJobType.jobSchema && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  {t('jobs.jobDataConfiguration')} - {selectedJobType.displayName}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {selectedJobType.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {selectedJobType.description}
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
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end'
        }}>
          <Button onClick={onCancel} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" startIcon={job ? <SaveIcon /> : <AddIcon />}>
            {job ? '작업 수정' : '작업 추가'}
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
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
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
                onChange={(e) => handleFieldChange('isEnabled', e.target.checked)}
                color="primary"
              />
            }
            label={t('common.usable')}
          />
        </Box>

        {/* Tags */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {t('common.tags')}
          </Typography>
          <Autocomplete
            multiple
            options={availableTags}
            getOptionLabel={(option) => option.name}
            value={availableTags.filter(tag => formData.tagIds.includes(tag.id))}
            onChange={(_, newValue) => {
              handleFieldChange('tagIds', newValue.map(tag => tag.id));
            }}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...chipProps } = getTagProps({ index });
                return (
                  <Chip
                    key={option.id}
                    variant="outlined"
                    label={option.name}
                    size="small"
                    sx={{ bgcolor: option.color, color: getContrastColor(option.color) }}
                    {...chipProps}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('common.selectTags')}
                variant="outlined"
              />
            )}
          />
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
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
          <Button onClick={onCancel} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" startIcon={job ? <SaveIcon /> : <AddIcon />}>
            {job ? '작업 수정' : '작업 추가'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default JobForm;
