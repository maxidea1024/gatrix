import express from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  executeJob,
  getJobExecutions
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
router.post('/jobs', createJob);
router.put('/jobs/:id', updateJob);
router.delete('/jobs/:id', deleteJob);
router.post('/jobs/:id/execute', executeJob);
router.get('/jobs/:id/executions', getJobExecutions);

// Job Executions 라우트 (구체적인 라우트를 먼저 정의)
router.get('/job-executions/statistics', getJobExecutionStatistics);
router.get('/job-executions', getAllJobExecutions);
router.get('/job-executions/:id', getJobExecution);

export default router;
