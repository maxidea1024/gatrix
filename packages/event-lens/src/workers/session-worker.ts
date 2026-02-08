import { Worker, Job } from 'bullmq';
import { clickhouse } from '../config/clickhouse';
import { redis } from '../config/redis';
import logger from '../utils/logger';

export class SessionWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker('event-lens-sessions', this.processJob.bind(this), {
      connection: redis,
      concurrency: 5,
    });

    this.worker.on('completed', (job) => {
      logger.debug('Session job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Session job failed', {
        jobId: job?.id,
        error: error.message,
      });
    });

    logger.info('✅ Session Worker started');
  }

  private async processJob(job: Job): Promise<void> {
    const { sessionId, projectId } = job.data;
    await this.aggregateSession(sessionId, projectId);
  }

  private async aggregateSession(sessionId: string, projectId: string): Promise<void> {
    try {
      const query = `
        SELECT
          min(createdAt) as startTime,
          max(createdAt) as endTime,
          dateDiff('second', startTime, endTime) as duration,
          countIf(name = 'screen_view') as screenViews,
          groupArray(path) as paths,
          any(deviceId) as deviceId,
          any(profileId) as profileId,
          any(country) as country,
          any(city) as city,
          any(browser) as browser,
          any(os) as os,
          any(referrer) as referrer
        FROM events
        WHERE projectId = {projectId:String}
          AND sessionId = {sessionId:String}
        GROUP BY sessionId
      `;

      const result = await clickhouse.query({
        query,
        query_params: { projectId, sessionId },
      });

      const data: any = await result.json();
      const session = data.data?.[0];

      if (!session) {
        logger.warn('Session not found', { sessionId, projectId });
        return;
      }

      // 이탈률 계산 (1페이지만 본 경우)
      const isBounce = session.screenViews === 1;

      // 세션 테이블에 저장
      await clickhouse.insert({
        table: 'sessions',
        values: [
          {
            sessionId,
            projectId,
            deviceId: session.deviceId,
            profileId: session.profileId,
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration,
            screenViews: session.screenViews,
            isBounce,
            country: session.country,
            city: session.city,
            browser: session.browser,
            os: session.os,
            referrer: session.referrer,
            createdAt: new Date().toISOString(),
          },
        ],
        format: 'JSONEachRow',
      });

      logger.debug('Session aggregated', { sessionId, projectId });
    } catch (error: any) {
      logger.error('Failed to aggregate session', {
        error: error.message,
        sessionId,
        projectId,
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    logger.info('Closing Session Worker...');
    await this.worker.close();
    logger.info('✅ Session Worker closed');
  }
}

export default SessionWorker;
