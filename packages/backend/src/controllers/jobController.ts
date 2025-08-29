import { Request, Response } from 'express';
import { JobModel, CreateJobData, UpdateJobData } from '../models/Job';
import { JobTypeModel } from '../models/JobType';
import { JobExecutionModel } from '../models/JobExecution';
import { JobFactory, JobExecutor } from '../services/jobs';
import logger from '../config/logger';

// Job 목록 조회
export const getJobs = async (req: Request, res: Response) => {
  try {
    const { job_type_id, is_enabled, search } = req.query;

    const filters: any = {};
    if (job_type_id) filters.job_type_id = parseInt(job_type_id as string);
    if (is_enabled !== undefined) filters.is_enabled = is_enabled === 'true';
    if (search) filters.search = search as string;

    const jobs = await JobModel.findAll(filters);

    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    logger.error('Error getting jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get jobs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 상세 조회
export const getJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }

    const job = await JobModel.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    logger.error('Error getting job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 생성
export const createJob = async (req: Request, res: Response) => {
  try {
    const {
      name,
      job_type_id,
      job_data_map,
      description,
      memo,
      is_enabled,
      retry_count,
      max_retry_count,
      timeout_seconds
    } = req.body;

    // 필수 필드 검증
    if (!name || !job_type_id) {
      return res.status(400).json({
        success: false,
        message: 'Name and job_type_id are required'
      });
    }

    // Job 타입 존재 여부 확인
    const jobType = await JobTypeModel.findById(job_type_id);
    if (!jobType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job type'
      });
    }

    // Job 이름 중복 검증
    const existingJob = await JobModel.findByName(name);
    if (existingJob) {
      return res.status(409).json({
        success: false,
        message: 'Job name already exists'
      });
    }

    // 사용자 ID 가져오기 (인증된 사용자)
    const userId = (req as any).user?.id;

    const jobData: CreateJobData = {
      name,
      job_type_id,
      job_data_map,
      description,
      memo,
      is_enabled,
      retry_count,
      max_retry_count,
      timeout_seconds,
      created_by: userId
    };

    const createdJob = await JobModel.create(jobData);

    res.status(201).json({
      success: true,
      data: createdJob,
      message: 'Job created successfully'
    });
  } catch (error) {
    logger.error('Error creating job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 수정
export const updateJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }

    // Job 존재 여부 확인
    const existingJob = await JobModel.findById(jobId);
    if (!existingJob) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const {
      name,
      job_data_map,
      description,
      memo,
      is_enabled,
      retry_count,
      max_retry_count,
      timeout_seconds
    } = req.body;

    // 사용자 ID 가져오기 (인증된 사용자)
    const userId = (req as any).user?.id;

    // Job 이름 중복 검증 (이름이 변경되는 경우에만)
    if (name && name !== existingJob.name) {
      const duplicateJob = await JobModel.findByName(name, jobId);
      if (duplicateJob) {
        return res.status(409).json({
          success: false,
          message: 'Job name already exists'
        });
      }
    }

    const updateData: UpdateJobData = {
      name,
      job_data_map,
      description,
      memo,
      is_enabled,
      retry_count,
      max_retry_count,
      timeout_seconds,
      updated_by: userId
    };

    const updatedJob = await JobModel.update(jobId, updateData);

    res.json({
      success: true,
      data: updatedJob,
      message: 'Job updated successfully'
    });
  } catch (error) {
    logger.error('Error updating job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 삭제
export const deleteJob = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid job ID'
      });
    }

    // Job 존재 여부 확인
    const existingJob = await JobModel.findById(jobId);
    if (!existingJob) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    const deleted = await JobModel.delete(jobId);

    if (!deleted) {
      return res.status(500).json({
        success: false,
        message: 'Failed to delete job'
      });
    }

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 수동 실행 (임시 구현)
export const executeJob = async (req: Request, res: Response) => {
  try {
    res.status(501).json({
      success: false,
      message: 'Job execution not implemented yet'
    });
  } catch (error) {
    logger.error('Error executing job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute job',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Job 실행 이력 조회 (임시 구현)
export const getJobExecutions = async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    logger.error('Error getting job executions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job executions',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
