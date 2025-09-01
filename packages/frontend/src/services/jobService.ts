import api from './api';
import { Job, JobType, JobExecution, CreateJobData, UpdateJobData, JobFilters, JobExecutionFilters, JobListResponse } from '../types/job';

export const jobService = {
  // Job Types
  async getJobTypes(): Promise<JobType[]> {
    const response = await api.get('/job-types');
    return response.data?.data || response.data || [];
  },

  async getJobType(id: number): Promise<JobType> {
    const response = await api.get(`/job-types/${id}`);
    return response.data?.data || response.data;
  },

  async getEnabledJobTypes(): Promise<JobType[]> {
    const response = await api.get('/job-types?enabled=true');
    return response.data?.data || response.data || [];
  },

  // Jobs
  async getJobs(filters?: JobFilters): Promise<Job[]> {
    const params = new URLSearchParams();
    if (filters?.job_type_id) params.append('job_type_id', filters.job_type_id.toString());
    if (filters?.is_enabled !== undefined) params.append('is_enabled', filters.is_enabled.toString());
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `/jobs?${queryString}` : '/jobs';
    const response = await api.get(url);
    return response.data?.data || response.data || [];
  },

  async getJobsWithPagination(filters?: JobFilters): Promise<JobListResponse> {
    const params = new URLSearchParams();
    if (filters?.jobTypeId) params.append('jobTypeId', filters.jobTypeId.toString());
    if (filters?.isEnabled !== undefined) params.append('isEnabled', filters.isEnabled.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());
    if (filters?.page) params.append('page', filters.page.toString());

    const queryString = params.toString();
    const url = queryString ? `/jobs?${queryString}` : '/jobs';
    const response = await api.get(url);

    // 백엔드 응답 구조에 맞게 처리
    if (response.data?.pagination) {
      return {
        jobs: response.data.data || [],
        pagination: response.data.pagination
      };
    } else {
      // 페이지네이션이 없는 경우 기본값 반환
      const jobs = response.data?.data || response.data || [];
      return {
        jobs,
        pagination: {
          total: jobs.length,
          limit: filters?.limit || 20,
          offset: filters?.offset || 0,
          page: filters?.page || 1,
          totalPages: 1
        }
      };
    }
  },

  async getJob(id: number): Promise<Job> {
    const response = await api.get(`/jobs/${id}`);
    return response.data?.data || response.data;
  },

  async createJob(data: CreateJobData): Promise<Job> {
    const response = await api.post('/jobs', data);
    return response.data?.data || response.data;
  },

  async updateJob(id: number, data: UpdateJobData): Promise<Job> {
    const response = await api.put(`/jobs/${id}`, data);
    return response.data?.data || response.data;
  },

  async deleteJob(id: number): Promise<boolean> {
    const response = await api.delete(`/jobs/${id}`);
    return response.data?.success ?? true;
  },

  async executeJob(id: number): Promise<{ executionId: number }> {
    const response = await api.post(`/jobs/${id}/execute`);
    return response.data?.data || response.data;
  },

  // Job Executions
  async getJobExecutions(jobId: number, filters?: JobExecutionFilters): Promise<JobExecution[]> {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    const url = queryString ? `/jobs/${jobId}/executions?${queryString}` : `/jobs/${jobId}/executions`;
    const response = await api.get(url);
    return response.data?.data || response.data || [];
  },

  async getAllJobExecutions(filters?: JobExecutionFilters): Promise<JobExecution[]> {
    const params = new URLSearchParams();
    if (filters?.jobId) params.append('jobId', filters.jobId.toString());
    if (filters?.scheduleId) params.append('scheduleId', filters.scheduleId.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.offset) params.append('offset', filters.offset.toString());

    const queryString = params.toString();
    const url = queryString ? `/job-executions?${queryString}` : '/job-executions';
    const response = await api.get(url);
    return response.data?.data || response.data || [];
  },

  async getJobExecution(id: number): Promise<JobExecution> {
    const response = await api.get(`/job-executions/${id}`);
    return response.data?.data || response.data;
  },

  async getJobExecutionStatistics(dateFrom?: string, dateTo?: string): Promise<any> {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);

    const queryString = params.toString();
    const url = queryString ? `/job-executions/statistics?${queryString}` : '/job-executions/statistics';
    const response = await api.get(url);
    return response.data?.data || response.data;
  }
};
