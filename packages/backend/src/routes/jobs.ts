import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  executeJob,
  getJobExecutions,
  setJobTags,
  getJobTags
} from '../controllers/jobController';
import {
  getJobTypes,
  getJobType
} from '../controllers/jobTypeController';
import {
  getJobExecutions as getAllJobExecutions,
  getJobExecution,
  getJobExecutionStatistics
} from '../controllers/jobExecutionController';

const router = express.Router();

// 모든 라우트에 인증 및 관리자 권한 필요
router.use(authenticate as any);
router.use(requireAdmin as any);

// Job Types 라우트
router.get('/job-types', getJobTypes);
router.get('/job-types/:id', getJobType);

// Jobs 라우트
router.get('/jobs', getJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs',
  auditLog({
    action: 'job_create',
    resourceType: 'job',
    // Job 생성 시에는 ID가 아직 없으므로 getResourceId 제거
    getNewValues: (req) => req.body,
    getResourceIdFromResponse: (res: any) => res?.data?.id,
  }) as any,
  createJob
);
router.put('/jobs/:id',
  auditLog({
    action: 'job_update',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  updateJob
);
router.delete('/jobs/:id',
  auditLog({
    action: 'job_delete',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req: any) => ({
      id: req.params?.id,
    }),
  }) as any,
  deleteJob
);
router.post('/jobs/:id/execute',
  auditLog({
    action: 'job_execute',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req: any) => ({
      jobId: req.params?.id,
      executionType: 'manual',
    }),
  }) as any,
  executeJob
);
router.get('/jobs/:id/executions', getJobExecutions);

// 디버그 라우트 제거됨

// Job 태그 관련 라우트
router.get('/jobs/:id/tags', getJobTags);
router.put('/jobs/:id/tags',
  auditLog({
    action: 'job_set_tags',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  setJobTags
);

// Job Executions 라우트 (구체적인 라우트를 먼저 정의)
router.get('/job-executions/statistics', getJobExecutionStatistics);
router.get('/job-executions', getAllJobExecutions);
router.get('/job-executions/:id', getJobExecution);

export default router;
