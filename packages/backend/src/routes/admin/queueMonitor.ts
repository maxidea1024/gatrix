import express from 'express';
import { queueService } from '../../services/QueueService';
import { sendSuccessResponse, sendNotFound, sendInternalError } from '../../utils/apiResponse';

const router = express.Router();

// Get all queue statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await queueService.getAllQueueStats();
    return sendSuccessResponse(res, stats);
  } catch (error: any) {
    return sendInternalError(res, error.message, error);
  }
});

// Get repeatable jobs for a queue
router.get('/:queueName/repeatable', async (req, res) => {
  try {
    const { queueName } = req.params;
    const repeatables = await queueService.listRepeatable(queueName);
    return sendSuccessResponse(res, repeatables);
  } catch (error: any) {
    return sendInternalError(res, error.message, error);
  }
});

// Get job history for a queue
router.get('/:queueName/jobs', async (req, res) => {
  try {
    const { queueName } = req.params;
    const status = (req.query.status as any) || 'completed';
    const start = parseInt(req.query.start as string) || 0;
    const end = parseInt(req.query.end as string) || 49;
    const jobs = await queueService.listHistory(queueName, status, start, end);

    // Serialize job data for transport
    const serialized = (jobs || []).map((job: any) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      opts: {
        delay: job.opts?.delay,
        attempts: job.opts?.attempts,
        repeat: job.opts?.repeat,
      },
      progress: job.progress,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
      returnvalue: job.returnvalue,
    }));
    return sendSuccessResponse(res, serialized);
  } catch (error: any) {
    return sendInternalError(res, error.message, error);
  }
});

// Retry a failed job
router.post('/:queueName/jobs/:jobId/retry', async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const result = await queueService.retryJob(queueName, jobId);
    if (!result) {
      return sendNotFound(res, 'Job not found or cannot be retried');
    }
    return sendSuccessResponse(res, { retried: true });
  } catch (error: any) {
    return sendInternalError(res, error.message, error);
  }
});

// Remove a job
router.delete('/:queueName/jobs/:jobId', async (req, res) => {
  try {
    const { queueName, jobId } = req.params;
    const result = await queueService.removeJob(queueName, jobId);
    if (!result) {
      return sendNotFound(res, 'Job not found');
    }
    return sendSuccessResponse(res, { removed: true });
  } catch (error: any) {
    return sendInternalError(res, error.message, error);
  }
});

// Remove a repeatable job
router.delete('/:queueName/repeatable/:key', async (req, res) => {
  try {
    const { queueName, key } = req.params;
    const result = await queueService.removeRepeatable(queueName, decodeURIComponent(key));
    if (!result) {
      return sendNotFound(res, 'Repeatable job not found');
    }
    return sendSuccessResponse(res, { removed: true });
  } catch (error: any) {
    return sendInternalError(res, error.message, error);
  }
});

// Clean queue (remove jobs by status)
router.post('/:queueName/clean', async (req, res) => {
  try {
    const { queueName } = req.params;
    const { status, grace = 0 } = req.body;
    const queue = queueService.getQueue(queueName);
    if (!queue) {
      return sendNotFound(res, 'Queue not found');
    }
    const removed = await queue.clean(grace, 1000, status);
    return sendSuccessResponse(res, { removed: removed.length });
  } catch (error: any) {
    return sendInternalError(res, error.message, error);
  }
});

export default router;
