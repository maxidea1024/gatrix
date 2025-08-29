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
  Chip
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Job, JobType, CreateJobData, UpdateJobData, JobSchemaField } from '../../types/job';
import DynamicJobDataForm from './DynamicJobDataForm';

interface JobFormProps {
  job?: Job | null;
  jobTypes: JobType[];
  onSubmit: (data: CreateJobData | UpdateJobData) => void;
  onCancel: () => void;
}

const JobForm: React.FC<JobFormProps> = ({ job, jobTypes, onSubmit, onCancel }) => {
  const { t } = useTranslation();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    job_type_id: '',
    description: '',
    job_data_map: {}
  });

  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data
  useEffect(() => {
    if (job) {
      setFormData({
        name: job.name,
        job_type_id: job.job_type_id.toString(),
        description: job.description || '',
        job_data_map: job.job_data_map || {}
      });

      const jobType = jobTypes.find(jt => jt.id === job.job_type_id);
      setSelectedJobType(jobType || null);
    }
  }, [job, jobTypes]);

  // Handle job type change
  const handleJobTypeChange = (jobTypeId: string) => {
    const jobType = jobTypes.find(jt => jt.id === parseInt(jobTypeId));
    setSelectedJobType(jobType || null);
    setFormData(prev => ({
      ...prev,
      job_type_id: jobTypeId,
      job_data_map: {} // Reset job data when type changes
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
    setFormData(prev => ({
      ...prev,
      job_data_map: jobDataMap
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('jobs.validation.nameRequired');
    }

    if (!formData.job_type_id) {
      newErrors.job_type_id = t('jobs.validation.jobTypeRequired');
    }

    // Validate job data map based on schema
    if (selectedJobType?.schema_definition) {
      const schema = selectedJobType.schema_definition;
      Object.entries(schema).forEach(([key, field]: [string, JobSchemaField]) => {
        if (field.required && !formData.job_data_map[key]) {
          newErrors[`job_data_map.${key}`] = t('jobs.validation.fieldRequired', { field: field.description });
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
      job_type_id: parseInt(formData.job_type_id),
      description: formData.description || undefined,
      memo: undefined,
      is_enabled: true,
      retry_count: 0,
      max_retry_count: 3,
      timeout_seconds: 300,
      job_data_map: formData.job_data_map
    };

    onSubmit(submitData);
  };

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
          <FormControl fullWidth error={!!errors.job_type_id}>
            <InputLabel required>{t('jobs.jobType')}</InputLabel>
            <Select
              value={formData.job_type_id}
              onChange={(e) => handleJobTypeChange(e.target.value)}
              label={t('jobs.jobType')}
              disabled={!!job} // Disable job type change when editing
            >
              {jobTypes.filter(jt => jt.is_enabled).map((jobType) => (
                <MenuItem key={jobType.id} value={jobType.id.toString()}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {jobType.display_name}
                    <Chip label={jobType.name} size="small" variant="outlined" />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {errors.job_type_id && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {errors.job_type_id}
              </Typography>
            )}
          </FormControl>
        </Box>

        <Box>
          <TextField
            fullWidth
            label={t('common.description')}
            value={formData.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            multiline
            rows={2}
          />
        </Box>





        {/* Job Data Configuration */}
        {selectedJobType && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  {t('jobs.jobDataConfiguration')} - {selectedJobType.display_name}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {selectedJobType.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {selectedJobType.description}
                  </Typography>
                )}
                <DynamicJobDataForm
                  schema={selectedJobType.schema_definition || {}}
                  data={formData.job_data_map}
                  onChange={handleJobDataChange}
                  errors={errors}
                />
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
          <Button onClick={onCancel} startIcon={<CancelIcon />}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" startIcon={job ? <SaveIcon /> : <AddIcon />}>
            {job ? t('common.update') : t('common.create')}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default JobForm;
