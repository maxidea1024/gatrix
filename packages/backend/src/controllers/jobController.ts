import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { JobModel, CreateJobData, UpdateJobData } from "../models/Job";
import { JobTypeModel } from "../models/JobType";
import {
  sendBadRequest,
  sendNotFound,
  sendConflict,
  sendInternalError,
  sendSuccessResponse,
  sendErrorResponse,
  ErrorCodes,
} from "../utils/apiResponse";

// Job 목록 조회
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

    const environment = req.environment || "development";
    const filters: any = { environment };
    if (jobTypeId) filters.jobTypeId = parseInt(jobTypeId as string);
    if (isEnabled !== undefined) filters.isEnabled = isEnabled === "true";
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
      "Failed to get jobs",
      error,
      ErrorCodes.RESOURCE_FETCH_FAILED,
    );
  }
};

// Job 상세 조회
export const getJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return sendBadRequest(res, "Invalid job ID", { field: "id" });
    }

    const environment = req.environment || "development";
    const job = await JobModel.findById(jobId, environment);

    if (!job) {
      return sendNotFound(res, "Job not found", ErrorCodes.RESOURCE_NOT_FOUND);
    }

    return sendSuccessResponse(res, job);
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to get job",
      error,
      ErrorCodes.RESOURCE_FETCH_FAILED,
    );
  }
};

// Job 생성
export const createJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, jobTypeId, jobDataMap, memo, isEnabled, tagIds } = req.body;

    // 필수 필드 검증
    if (!name || !jobTypeId) {
      return sendBadRequest(res, "Name and jobTypeId are required", {
        fields: ["name", "jobTypeId"],
      });
    }

    // Job 타입 존재 여부 확인
    const jobType = await JobTypeModel.findById(jobTypeId);
    if (!jobType) {
      return sendBadRequest(res, "Invalid job type", { field: "jobTypeId" });
    }

    const environment = req.environment || "development";

    // Job 이름 중복 검증
    const existingJob = await JobModel.findByName(name, environment);
    if (existingJob) {
      return sendConflict(
        res,
        "A job with this name already exists",
        ErrorCodes.RESOURCE_ALREADY_EXISTS,
      );
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
      updatedBy: userId,
      environment,
    };

    const createdJob = await JobModel.create(jobData);

    return sendSuccessResponse(
      res,
      createdJob,
      "Job created successfully",
      201,
    );
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to create job",
      error,
      ErrorCodes.RESOURCE_CREATE_FAILED,
    );
  }
};

// Job 수정
export const updateJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return sendBadRequest(res, "Invalid job ID", { field: "id" });
    }

    const environment = req.environment || "development";

    // Job 존재 여부 확인
    const existingJob = await JobModel.findById(jobId, environment);
    if (!existingJob) {
      return sendNotFound(res, "Job not found", ErrorCodes.RESOURCE_NOT_FOUND);
    }

    const { name, jobTypeId, jobDataMap, memo, isEnabled, tagIds } = req.body;

    // 사용자 ID 가져오기 (인증된 사용자)
    const userId = (req as any).user?.userId;

    // Job 이름 중복 검증 (이름이 변경되는 경우에만)
    const existingJobByName = await JobModel.findByName(name, environment);
    if (existingJobByName && existingJobByName.id !== jobId) {
      return sendConflict(
        res,
        "A job with this name already exists",
        ErrorCodes.RESOURCE_ALREADY_EXISTS,
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

    const updatedJob = await JobModel.update(jobId, updateData, environment);

    return sendSuccessResponse(res, updatedJob, "Job updated successfully");
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to update job",
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED,
    );
  }
};

// Job 삭제
export const deleteJob = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const jobId = parseInt(id);

    if (isNaN(jobId)) {
      return sendBadRequest(res, "Invalid job ID", { field: "id" });
    }

    const environment = req.environment || "development";

    // Job 존재 여부 확인
    const existingJob = await JobModel.findById(jobId, environment);
    if (!existingJob) {
      return sendNotFound(res, "Job not found", ErrorCodes.RESOURCE_NOT_FOUND);
    }

    await JobModel.delete(jobId, environment);

    return sendSuccessResponse(res, undefined, "Job deleted successfully");
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to delete job",
      error,
      ErrorCodes.RESOURCE_DELETE_FAILED,
    );
  }
};

// Job 수동 실행 (임시 구현)
export const executeJob = async (_req: AuthenticatedRequest, res: Response) => {
  return sendErrorResponse(
    res,
    501,
    "NOT_IMPLEMENTED",
    "Job execution not implemented yet",
  );
};

// Job 실행 이력 조회 (임시 구현)
export const getJobExecutions = async (
  _req: AuthenticatedRequest,
  res: Response,
) => {
  return sendSuccessResponse(res, []);
};

// Job 태그 설정
export const setJobTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { tagIds } = req.body;

    if (!Array.isArray(tagIds)) {
      return sendBadRequest(res, "tagIds must be an array", {
        field: "tagIds",
      });
    }

    await JobModel.setTags(parseInt(id), tagIds);

    return sendSuccessResponse(res, undefined, "Tags updated successfully");
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to update tags",
      error,
      ErrorCodes.RESOURCE_UPDATE_FAILED,
    );
  }
};

// Job 태그 조회
export const getJobTags = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const tags = await JobModel.getTags(parseInt(id));

    return sendSuccessResponse(res, tags);
  } catch (error) {
    return sendInternalError(
      res,
      "Failed to get tags",
      error,
      ErrorCodes.RESOURCE_FETCH_FAILED,
    );
  }
};
