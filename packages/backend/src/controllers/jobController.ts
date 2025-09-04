import { Request, Response } from 'express';
import { JobModel, CreateJobData, UpdateJobData } from '../models/Job';
import { JobTypeModel } from '../models/JobType';
import logger from '../config/logger';

// Job 목록 조회
export const getJobs = async (req: Request, res: Response) => {
  try {
    const {
      jobTypeId,
      isEnabled,
      search,
      limit = 20,
      offset = 0,
      page
    } = req.query;

    const filters: any = {};
    if (jobTypeId) filters.jobTypeId = parseInt(jobTypeId as string);
    if (isEnabled !== undefined) filters.isEnabled = isEnabled === 'true';
    if (search) filters.search = search as string;

    // 페이지네이션 처리
    const limitNum = parseInt(limit as string) || 20;
    let offsetNum = parseInt(offset as string) || 0;

    // page 파라미터가 있으면 offset 계산
    if (page) {
      const pageNum = parseInt(page as string) || 1;
      offsetNum = (pageNum - 1) * limitNum;
    }

    filters.limit = limitNum;
    filters.offset = offsetNum;

    const result = await JobModel.findAllWithPagination(filters);

    res.json({
      success: true,
      data: result.jobs,
      pagination: {
        total: result.total,
        limit: limitNum,
        offset: offsetNum,
        page: Math.floor(offsetNum / limitNum) + 1,
        totalPages: Math.ceil(result.total / limitNum)
      }
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
      jobTypeId,
      jobDataMap,
      memo,
      isEnabled,
      tagIds
    } = req.body;

    // 필수 필드 검증
    if (!name || !jobTypeId) {
      return res.status(400).json({
        success: false,
        message: 'Name and jobTypeId are required'
      });
    }

    // Job 타입 존재 여부 확인
    const jobType = await JobTypeModel.findById(jobTypeId);
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
        message: 'Job name already exists',
        error: { message: 'A job with this name already exists' }
      });
    }

    // 사용자 ID 가져오기 (인증된 사용자)
    const userId = (req as any).user?.userId;

    const jobData: CreateJobData = {
      name,
      jobTypeId,
      jobDataMap,
      memo,
      isEnabled,
      tagIds,
      createdBy: userId,
      updatedBy: userId
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
      jobTypeId,
      jobDataMap,
      memo,
      isEnabled,
      tagIds
    } = req.body;

    // 사용자 ID 가져오기 (인증된 사용자)
    const userId = (req as any).user?.userId;

    // Job 이름 중복 검증 (이름이 변경되는 경우에만)
    const existingJobByName = await JobModel.findByName(name);
    if (existingJobByName && existingJobByName.id !== jobId) {
      return res.status(409).json({
        success: false,
        message: 'Job name already exists',
        error: { message: 'A job with this name already exists' }
      });
    }

    const updateData: UpdateJobData = {
      name,
      jobTypeId,
      jobDataMap,
      memo,
      isEnabled,
      tagIds,
      updatedBy: userId
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

    await JobModel.delete(jobId);

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

// Job 태그 설정
export const setJobTags = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tagIds } = req.body;

    if (!Array.isArray(tagIds)) {
      return res.status(400).json({
        success: false,
        message: 'tagIds must be an array',
      });
    }

    await JobModel.setTags(parseInt(id), tagIds);

    res.json({
      success: true,
      message: 'Tags updated successfully',
    });
  } catch (error) {
    logger.error('Error setting job tags:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update tags',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Job 태그 조회
export const getJobTags = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tags = await JobModel.getTags(parseInt(id));

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    logger.error('Error getting job tags:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get tags',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
