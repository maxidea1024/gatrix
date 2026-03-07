import express from 'express';
import { authenticate } from '../../middleware/auth';
import { auditLog } from '../../middleware/auditLog';
import {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  executeJob,
  getJobExecutions,
  setJobTags,
  getJobTags,
} from '../../controllers/jobController';
import { getJobTypes, getJobType } from '../../controllers/jobTypeController';
import {
  getJobExecutions as getAllJobExecutions,
  getJobExecution,
  getJobExecutionStatistics,
} from '../../controllers/jobExecutionController';

const router = express.Router();

// 모든 Route에 Authentication 및 Admin permission required
router.use(authenticate as any);
// Job Types Route
router.get('/job-types', getJobTypes as any);
router.get('/job-types/:id', getJobType as any);

// Jobs Route
router.get('/', getJobs as any);
router.get('/:id', getJob as any);
router.post(
  '/',
  auditLog({
    action: 'job_create',
    resourceType: 'job',
    // Job Create 시에는 ID가 아직 없으므로 getResourceId 생략
    getNewValues: (req) => req.body,
    getResourceIdFromResponse: (res: any) => res?.data?.id,
  }) as any,
  createJob as any
);
router.put(
  '/:id',
  auditLog({
    action: 'job_update',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  updateJob as any
);
router.delete(
  '/:id',
  auditLog({
    action: 'job_delete',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req: any) => ({
      id: req.params?.id,
    }),
  }) as any,
  deleteJob as any
);
router.post(
  '/:id/execute',
  auditLog({
    action: 'job_execute',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req: any) => ({
      jobId: req.params?.id,
      executionType: 'manual',
    }),
  }) as any,
  executeJob as any
);
router.get('/:id/executions', getJobExecutions as any);

// 서버별 Route는 제거됨
// Job 태그 관리 Route
router.get('/:id/tags', getJobTags as any);
router.put(
  '/:id/tags',
  auditLog({
    action: 'job_set_tags',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  setJobTags as any
);

// Job Executions Route (구체적인 라우트를 먼저 정의)
router.get('/job-executions/statistics', getJobExecutionStatistics as any);
router.get('/job-executions', getAllJobExecutions as any);
router.get('/job-executions/:id', getJobExecution as any);

export default router;
