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

// 모든 ?�우?�에 ?�증 �?관리자 권한 ?�요
router.use(authenticate as any);
router.use(requireAdmin as any);

// Job Types ?�우??router.get('/job-types', getJobTypes);
router.get('/job-types/:id', getJobType);

// Jobs ?�우??router.get('/jobs', getJobs);
router.get('/jobs/:id', getJob);
router.post('/jobs',
  auditLog({
    action: 'job_create',
    resourceType: 'job',
    // Job ?�성 ?�에??ID가 ?�직 ?�으므�?getResourceId ?�거
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

// ?�버�??�우???�거??
// Job ?�그 관???�우??router.get('/jobs/:id/tags', getJobTags);
router.put('/jobs/:id/tags',
  auditLog({
    action: 'job_set_tags',
    resourceType: 'job',
    getResourceId: (req: any) => req.params?.id,
    getNewValues: (req) => req.body,
  }) as any,
  setJobTags
);

// Job Executions ?�우??(구체?�인 ?�우?��? 먼�? ?�의)
router.get('/job-executions/statistics', getJobExecutionStatistics);
router.get('/job-executions', getAllJobExecutions);
router.get('/job-executions/:id', getJobExecution);

export default router;
