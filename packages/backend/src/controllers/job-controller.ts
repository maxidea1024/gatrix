import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { JobModel, CreateJobData, UpdateJobData } from '../models/job';
import { JobTypeModel } from '../models/job-type';
import { JobExecutionModel, JobExecutionStatus } from '../models/job-execution';
import { createLogger } from '../config/logger';
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
    const {
      jobTypeId,
      isEnabled,
      search,
      limit = 20,
      offset = 0,
      page,
    } = req.query;

    const environmentId = req.environmentId!;
    const filters: any = { environmentId };
    if (jobTypeId) filters.jobTypeId = jobTypeId as string;
    if (isEnabled !== undefined) filters.isEnabled = isEnabled === 'true';
    if (search) filters.search = search as string;

    // Pagination handling
    const limitNum = parseInt(limit as string) || 20;
    let offsetNum = parseInt(offset as string) || 0;

    // Calculate offset if page parameter exists
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
    return sendInternalError(
      res,
      'Failed to get jobs',
      error,
      ErrorCodes.RESOURCE_FETCH_FAILED
    );
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
    return sendInternalError(
      res,
      'Failed to get job',
      error,
      ErrorCodes.RESOURCE_FETCH_FAILED
    );
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

    const environmentId = req.environmentId!;

    // Check if job type exists
    const jobType = await JobTypeModel.findById(jobTypeId, environmentId);
    if (!jobType) {
      return sendBadRequest(res, 'Invalid job type', { field: 'jobTypeId' });
    }

    // Validate job name uniqueness
    const existingJob = await JobModel.findByName(name, environmentId);
    if (existingJob) {
      return sendConflict(
        res,
        'A job with this name already exists',
        ErrorCodes.RESOURCE_ALREADY_EXISTS
      );
    }

    // Get user ID (authenticated user)
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

    return sendSuccessResponse(
      res,
      createdJob,
      'Job created successfully',
      201
    );
  } catch (error) {
    return sendInternalError(
      res,
      'Failed to create job',
      error,
      ErrorCodes.RESOURCE_CREATE_FAILED
    );
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

    // Check if job exists
    const existingJob = await JobModel.findById(jobId, environmentId);
    if (!existingJob) {
      return sendNotFound(res, 'Job not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { name, jobTypeId, jobDataMap, memo, isEnabled, tagIds } = req.body;

    // Get user ID (authenticated user)
    const userId = (req as any).user?.userId;

    // Validate job name uniqueness (only if name is being changed)
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
    return sendInternalError(
      res,
      'Failed to update job',
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED
    );
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

    // Check if job exists
    const existingJob = await JobModel.findById(jobId, environmentId);
    if (!existingJob) {
      return sendNotFound(res, 'Job not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await JobModel.delete(jobId, environmentId);

    return sendSuccessResponse(res, undefined, 'Job deleted successfully');
  } catch (error) {
    return sendInternalError(
      res,
      'Failed to delete job',
      error,
      ErrorCodes.RESOURCE_DELETE_FAILED
    );
  }
};

// Execute job manually
export const executeJob = async (req: AuthenticatedRequest, res: Response) => {
  const jobLogger = createLogger('JobExecution');
  try {
    const { id } = req.params;
    const environmentId = req.environmentId!;

    // Validate job exists and is enabled
    const job = await JobModel.findById(id, environmentId);
    if (!job) {
      return sendNotFound(res, 'Job not found', ErrorCodes.RESOURCE_NOT_FOUND);
    }
    if (!job.isEnabled) {
      return sendBadRequest(res, 'Job is disabled and cannot be executed');
    }

    // Create execution record
    const execution = await JobExecutionModel.create({
      jobId: id,
      status: JobExecutionStatus.PENDING,
    });

    // Mark as running
    const startTime = Date.now();
    await JobExecutionModel.update(execution.id, {
      status: JobExecutionStatus.RUNNING,
      startedAt: new Date(),
    });

    // Execute based on job type
    try {
      const jobType = await JobTypeModel.findById(job.jobTypeId, environmentId);
      const jobData = job.jobDataMap || {};

      let result: any = {};

      switch (jobType?.name) {
        case 'log_message':
          jobLogger.info(
            `[Job:${job.name}] ${jobData.message || '(no message)'}`,
            {
              level: jobData.level || 'info',
              category: jobData.category || 'job',
            }
          );
          result = { logged: true, message: jobData.message };
          break;

        case 'http_request':
          // TODO: Implement HTTP request execution
          result = { message: 'HTTP request execution not yet implemented' };
          break;

        case 'mailsend':
          // TODO: Implement mail sending
          result = { message: 'Mail sending not yet implemented' };
          break;

        case 'ssh_command':
          // TODO: Implement SSH command execution
          result = { message: 'SSH command execution not yet implemented' };
          break;

        default:
          result = { message: `Unknown job type: ${jobType?.name}` };
          break;
      }

      const executionTimeMs = Date.now() - startTime;
      const updated = await JobExecutionModel.update(execution.id, {
        status: JobExecutionStatus.COMPLETED,
        completedAt: new Date(),
        executionTimeMs,
        result,
      });

      return sendSuccessResponse(res, updated, 'Job executed successfully');
    } catch (execError: any) {
      const executionTimeMs = Date.now() - startTime;
      await JobExecutionModel.update(execution.id, {
        status: JobExecutionStatus.FAILED,
        completedAt: new Date(),
        executionTimeMs,
        errorMessage: execError.message || 'Unknown execution error',
      });

      return sendInternalError(
        res,
        'Job execution failed',
        execError,
        ErrorCodes.RESOURCE_UPDATE_FAILED
      );
    }
  } catch (error) {
    return sendInternalError(
      res,
      'Failed to execute job',
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED
    );
  }
};

// Get job execution history (temporary implementation)
export const getJobExecutions = async (
  _req: AuthenticatedRequest,
  res: Response
) => {
  return sendSuccessResponse(res, []);
};
