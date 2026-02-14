import api from './api';

const BASE = '/admin/queue-monitor';

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

export interface QueueJob {
  id: string;
  name: string;
  data: any;
  opts: {
    delay?: number;
    attempts?: number;
    repeat?: any;
  };
  progress: number;
  attemptsMade: number;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
  stacktrace: string[] | null;
  returnvalue: any;
}

export interface RepeatableJob {
  key: string;
  name: string;
  id: string | null;
  endDate: number | null;
  tz: string | null;
  pattern: string;
  every: string | null;
  next: number;
}

export async function fetchAllQueueStats(): Promise<QueueStats[]> {
  const res = await api.get(`${BASE}/stats`);
  return res.data;
}

export async function fetchRepeatableJobs(queueName: string): Promise<RepeatableJob[]> {
  const res = await api.get(`${BASE}/${queueName}/repeatable`);
  return res.data;
}

export async function fetchQueueJobs(
  queueName: string,
  status: string,
  start = 0,
  end = 49
): Promise<QueueJob[]> {
  const res = await api.get(`${BASE}/${queueName}/jobs`, {
    params: { status, start, end },
  });
  return res.data;
}

export async function retryQueueJob(queueName: string, jobId: string): Promise<void> {
  await api.post(`${BASE}/${queueName}/jobs/${jobId}/retry`);
}

export async function removeQueueJob(queueName: string, jobId: string): Promise<void> {
  await api.delete(`${BASE}/${queueName}/jobs/${jobId}`);
}

export async function removeRepeatableJob(queueName: string, key: string): Promise<void> {
  await api.delete(`${BASE}/${queueName}/repeatable/${encodeURIComponent(key)}`);
}

export async function cleanQueue(
  queueName: string,
  status: string,
  grace = 0
): Promise<{ removed: number }> {
  const res = await api.post(`${BASE}/${queueName}/clean`, { status, grace });
  return res.data;
}
