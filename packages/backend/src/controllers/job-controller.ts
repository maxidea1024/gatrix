import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { JobModel, CreateJobData, UpdateJobData } from '../models/job';
import { JobTypeModel } from '../models/job-type';
import {
  sendBadRequest,
  sendNotFound,
  sendConflict,
  sendInternalError,
  sendSuccessResponse,
  sendErrorResponse,
  ErrorCodes,
} from '../utils/api-response';

// Job Get list
export const getJobs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jobTypeId, isEnabled, search, limit = 20, offset = 0, page } = req.query;

    const environmentId = req.environmentId!;
    const filters: any = { environmentId };
    if (jobTypeId) filters.jobTypeId = parseInt(jobTypeId as string);
    if (isEnabled !== undefined) filters.isEnabled = isEnabled === 'true';
    if (search) filters.search = search as string;

    // Pagination 처리
    const limitNum = parseInt(limit as string) || 20;
    let offsetNum = parseInt(offset as string) || 0;

    // page Parameters가 있으면 offset 계산
    if (page) {
      const pageNum = parseInt(page as string) || 1;
      offsetNum = (pageNum - 1) * limitNum;
    }

    filters.limit = limitNum;
    filters.offset = offsetNum;

    const result = await JobModel.findAllWithPagination(filters);

    return sendSuccessResponse(res, {
      data: result.jobs,
      pagination: {
        total: result.total,
        limit: limitNum,
        offset: offsetNum,
        page: Math.floor(offsetNum / limitNum) + 1,
        totalPages: Math.ceil(result.total / limitNum),
      },
    });
  } catch (error) {
    return sendInternalError(res, 'Failed to get jobs', error, ErrorCodes.RESOURCE_FETCH_FAILED);
  }
};

// Job Get details
export const getJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = id;

    if (!jobId) {
      return sendBadRequest(res, 'Invalid job ID', { field: 'id' });
    }

    const environmentId = req.environmentId!;
    const job = await JobModel.findById(jobId, environmentId);

    if (!job) {
      return sendNotFound(res, 'Job not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return sendSuccessResponse(res, job);
  } catch (error) {
    return sendInternalError(res, 'Failed to get job', error, ErrorCodes.RESOURCE_FETCH_FAILED);
  }
};

// Job Create
export const createJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, jobTypeId, jobDataMap, memo, isEnabled, tagIds } = req.body;

    // Validate required fields
    if (!name || !jobTypeId) {
      return sendBadRequest(res, 'Name and jobTypeId are required', {
        fields: ['name', 'jobTypeId'],
      });
    }

    // Job Type 존재 여부 Confirm
    const jobType = await JobTypeModel.findById(jobTypeId);
    if (!jobType) {
      return sendBadRequest(res, 'Invalid job type', { field: 'jobTypeId' });
    }

    const environmentId = req.environmentId!;

    // Job 이름 중복 Validation
    const existingJob = await JobModel.findByName(name, environmentId);
    if (existingJob) {
      return sendConflict(
        res,
        'A job with this name already exists',
        ErrorCodes.RESOURCE_ALREADY_EXISTS
      );
    }

    // Used자 ID 가져오기 (Authentication된 사용자)
    const userId = (req as any).user?.userId;

    const jobData: CreateJobData = {
      name,
      jobTypeId,
      jobDataMap,
      memo,
      isEnabled,
      tagIds,
      createdBy: userId,
      updatedBy: userId,
      environmentId,
    };

    const createdJob = await JobModel.create(jobData);

    return sendSuccessResponse(res, createdJob, 'Job created successfully', 201);
  } catch (error) {
    return sendInternalError(res, 'Failed to create job', error, ErrorCodes.RESOURCE_CREATE_FAILED);
  }
};

// Job Edit
export const updateJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = id;

    if (!jobId) {
      return sendBadRequest(res, 'Invalid job ID', { field: 'id' });
    }

    const environmentId = req.environmentId!;

    // Job 존재 여부 Confirm
    const existingJob = await JobModel.findById(jobId, environmentId);
    if (!existingJob) {
      return sendNotFound(res, 'Job not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { name, jobTypeId, jobDataMap, memo, isEnabled, tagIds } = req.body;

    // Used자 ID 가져오기 (Authentication된 사용자)
    const userId = (req as any).user?.userId;

    // Job 이름 중복 Validation (이름이 변경되는 경우에만)
    const existingJobByName = await JobModel.findByName(name, environmentId);
    if (existingJobByName && existingJobByName.id !== jobId) {
      return sendConflict(
        res,
        'A job with this name already exists',
        ErrorCodes.RESOURCE_ALREADY_EXISTS
      );
    }

    const updateData: UpdateJobData = {
      name,
      jobTypeId,
      jobDataMap,
      memo,
      isEnabled,
      tagIds,
      updatedBy: userId,
    };

    const updatedJob = await JobModel.update(jobId, updateData, environmentId);

    return sendSuccessResponse(res, updatedJob, 'Job updated successfully');
  } catch (error) {
    return sendInternalError(res, 'Failed to update job', error, ErrorCodes.RESOURCE_UPDATE_FAILED);
  }
};

// Job Delete
export const deleteJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = id;

    if (!jobId) {
      return sendBadRequest(res, 'Invalid job ID', { field: 'id' });
    }

    const environmentId = req.environmentId!;

    // Job 존재 여부 Confirm
    const existingJob = await JobModel.findById(jobId, environmentId);
    if (!existingJob) {
      return sendNotFound(res, 'Job not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await JobModel.delete(jobId, environmentId);

    return sendSuccessResponse(res, undefined, 'Job deleted successfully');
  } catch (error) {
    return sendInternalError(res, 'Failed to delete job', error, ErrorCodes.RESOURCE_DELETE_FAILED);
  }
};

// Job 수동 실행 (임시 구현)
export const executeJob = async (_req: AuthenticatedRequest, res: Response) => {
  return sendErrorResponse(res, 501, 'NOT_IMPLEMENTED', 'Job execution not implemented yet');
};

// Job 실행 이력 조회 (임시 구현)
export const getJobExecutions = async (_req: AuthenticatedRequest, res: Response) => {
  return sendSuccessResponse(res, []);
};

// Job 태그 Settings
export const setJobTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tagIds } = req.body;

    if (!Array.isArray(tagIds)) {
      return sendBadRequest(res, 'tagIds must be an array', {
        field: 'tagIds',
      });
    }

    await JobModel.setTags(id, tagIds);

    return sendSuccessResponse(res, undefined, 'Tags updated successfully');
  } catch (error) {
    return sendInternalError(
      res,
      'Failed to update tags',
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED
    );
  }
};

// Job 태그 조회
export const getJobTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tags = await JobModel.getTags(id);

    return sendSuccessResponse(res, tags);
  } catch (error) {
    return sendInternalError(res, 'Failed to get tags', error, ErrorCodes.RESOURCE_FETCH_FAILED);
  }
};
