import express from 'express';
import { authenticate, requireAdmin } from '../../middleware/auth';
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
  getJobTags
} from '../../controllers/jobController';
import {
  getJobTypes,
  getJobType
} from '../../controllers/jobTypeController';
import {
  getJobExecutions as getAllJobExecutions,
  getJobExecution,
  getJobExecutionStatistics
} from '../../controllers/jobExecutionController';

const router = express.Router();

// 모든 라우트에 인증 및 관리자 권한 필요
router.use(authenticate as any);
router.use(requireAdmin as any);

// Job Types 라우트
router.get('/job-types', getJobTypes as any);
router.get('/job-types/:id', getJobType as any);

// Jobs 라우트
router.get('/', getJobs as any);
router.get('/:id', getJob as any);
router.post('/',
  auditLog({
    action: 'job_create',
    resourceType: 'job',
    // Job 생성 시에는 ID가 아직 없으므로 getResourceId 생략
    getNewValues: (req) => req.body,
    getResourceIdFromResponse: (res: any) => res?.data?.id,
  }) as any,
  createJob as any
);
router.put('/:id',
  auditLog({
    action: 'job_update',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  updateJob as any
);
router.delete('/:id',
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
router.post('/:id/execute',
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

// 서버별 라우트는 제거됨
// Job 태그 관리 라우트
router.get('/:id/tags', getJobTags as any);
router.put('/:id/tags',
  auditLog({
    action: 'job_set_tags',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  setJobTags as any
);

// Job Executions 라우트 (구체적인 라우트를 먼저 정의)
router.get('/job-executions/statistics', getJobExecutionStatistics as any);
router.get('/job-executions', getAllJobExecutions as any);
router.get('/job-executions/:id', getJobExecution as any);

export default router;
