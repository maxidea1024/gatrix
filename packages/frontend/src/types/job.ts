import { Tag } from '../services/tagService';

export interface JobType {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  jobSchema?: JobSchemaDefinition;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  updatedBy?: number;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
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
  jobTypeId: number;
  jobDataMap?: any;
  memo?: string;
  isEnabled: boolean;
  tags?: Tag[];
  createdAt: string;
  updatedAt: string;
  createdBy?: number;
  updatedBy?: number;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
  jobTypeName?: string;
  jobTypeDisplayName?: string;
}

export interface CreateJobData {
  name: string;
  jobTypeId: number;
  jobDataMap?: any;
  memo?: string;
  isEnabled?: boolean;
  tagIds?: number[];
}

export interface UpdateJobData {
  name?: string;
  jobTypeId?: number;
  jobDataMap?: any;
  memo?: string;
  isEnabled?: boolean;
  tagIds?: number[];
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
  jobId: number;
  scheduleId?: number;
  status: JobExecutionStatus;
  startedAt?: string;
  completedAt?: string;
  result?: any;
  errorMessage?: string;
  retryAttempt: number;
  executionTimeMs?: number;
  createdAt: string;
  jobName?: string;
  jobTypeName?: string;
  scheduleName?: string;
}

export interface JobFilters {
  jobTypeId?: number;
  isEnabled?: boolean;
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
  jobId?: number;
  scheduleId?: number;
  status?: JobExecutionStatus;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}
