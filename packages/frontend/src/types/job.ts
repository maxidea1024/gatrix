export interface JobType {
  id: number;
  name: string;
  display_name: string;
  description?: string;
  schema_definition?: JobSchemaDefinition;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
}

export interface JobSchemaDefinition {
  [key: string]: JobSchemaField;
}

export interface JobSchemaField {
  type: 'string' | 'number' | 'boolean' | 'text' | 'password' | 'select' | 'array' | 'object';
  required: boolean;
  description: string;
  default?: any;
  options?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface Job {
  id: number;
  name: string;
  job_type_id: number;
  job_data_map?: any;
  description?: string;
  memo?: string;
  is_enabled: boolean;
  retry_count: number;
  max_retry_count: number;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
  created_by?: number;
  updated_by?: number;
  created_by_name?: string;
  updated_by_name?: string;
  job_type_name?: string;
  job_type_display_name?: string;
}

export interface CreateJobData {
  name: string;
  job_type_id: number;
  job_data_map?: any;
  description?: string;
  memo?: string;
  is_enabled?: boolean;
  retry_count?: number;
  max_retry_count?: number;
  timeout_seconds?: number;
}

export interface UpdateJobData {
  name?: string;
  job_data_map?: any;
  description?: string;
  memo?: string;
  is_enabled?: boolean;
  retry_count?: number;
  max_retry_count?: number;
  timeout_seconds?: number;
}

export enum JobExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled'
}

export interface JobExecution {
  id: number;
  job_id: number;
  schedule_id?: number;
  status: JobExecutionStatus;
  started_at?: string;
  completed_at?: string;
  result?: any;
  error_message?: string;
  retry_attempt: number;
  execution_time_ms?: number;
  created_at: string;
  job_name?: string;
  job_type_name?: string;
  schedule_name?: string;
}

export interface JobFilters {
  job_type_id?: number;
  is_enabled?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface JobListResponse {
  jobs: Job[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    page: number;
    totalPages: number;
  };
}

export interface JobExecutionFilters {
  job_id?: number;
  schedule_id?: number;
  status?: JobExecutionStatus;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}
