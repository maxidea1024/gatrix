import express from 'express';
import { authenticate } from '../../middleware/auth';
import { auditLog } from '../../middleware/audit-log';
import {
  getJobs,
  getJob,
  createJob,
  updateJob,
  deleteJob,
  executeJob,
  getJobExecutions,
} from '../../controllers/job-controller';
import { getJobTypes, getJobType } from '../../controllers/job-type-controller';
import {
  getJobExecutions as getAllJobExecutions,
  getJobExecution,
  getJobExecutionStatistics,
} from '../../controllers/job-execution-controller';

const router = express.Router();

// All routes require authentication and admin privileges
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
    // Job ID is not yet available during creation, so getResourceId is omitted
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

// Job Executions Route (define specific routes first)
router.get('/job-executions/statistics', getJobExecutionStatistics as any);
router.get('/job-executions', getAllJobExecutions as any);
router.get('/job-executions/:id', getJobExecution as any);

export default router;
