import { Worker, Job } from 'bullmq';
import { clickhouse } from '../config/clickhouse';
import { redis } from '../config/redis';
import logger from '../utils/logger';

export class ProfileWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker(
      'event-lens-profiles',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: 5,
      }
    );

    this.worker.on('completed', (job) => {
      logger.debug('Profile job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, error) => {
      logger.error('Profile job failed', { 
        jobId: job?.id, 
        error: error.message 
      });
    });

    logger.info('✅ Profile Worker started');
  }

  private async processJob(job: Job): Promise<void> {
    const { name } = job;

    switch (name) {
      case 'identify-profile':
        await this.identifyProfile(job.data);
        break;
      case 'increment-property':
        await this.incrementProperty(job.data);
        break;
      case 'decrement-property':
        await this.decrementProperty(job.data);
        break;
      default:
        logger.warn('Unknown profile job type', { name });
    }
  }

  private async identifyProfile(data: any): Promise<void> {
    const { projectId, profileId, deviceId, traits } = data;

    try {
      // 기존 프로필 조회
      const existingProfile = await this.getProfile(projectId, profileId);

      if (existingProfile) {
        // 프로필 업데이트
        await clickhouse.insert({
          table: 'profiles',
          values: [{
            id: existingProfile.id,
            projectId,
            profileId,
            ...traits,
            lastSeenAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }],
          format: 'JSONEachRow',
        });
      } else {
        // 새 프로필 생성
        await clickhouse.insert({
          table: 'profiles',
          values: [{
            id: `${Date.now()}-${Math.random().toString(36).substring(2)}`,
            projectId,
            profileId,
            ...traits,
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          }],
          format: 'JSONEachRow',
        });
      }

      // 디바이스-프로필 매핑 저장
      await redis.set(
        `device:${projectId}:${deviceId}:profile`,
        profileId,
        'EX',
        86400 * 365 // 1년
      );

      logger.debug('Profile identified', { projectId, profileId });
    } catch (error: any) {
      logger.error('Failed to identify profile', { error: error.message, data });
      throw error;
    }
  }

  private async incrementProperty(data: any): Promise<void> {
    const { projectId, profileId, property, value } = data;

    try {
      // 현재 값 조회
      const currentValue = await this.getPropertyValue(projectId, profileId, property);
      const newValue = (currentValue || 0) + value;

      // 프로필 업데이트
      await clickhouse.insert({
        table: 'profiles',
        values: [{
          projectId,
          profileId,
          properties: JSON.stringify({ [property]: newValue }),
          createdAt: new Date().toISOString(),
        }],
        format: 'JSONEachRow',
      });

      logger.debug('Property incremented', { projectId, profileId, property, value: newValue });
    } catch (error: any) {
      logger.error('Failed to increment property', { error: error.message, data });
      throw error;
    }
  }

  private async decrementProperty(data: any): Promise<void> {
    // increment와 동일하지만 value가 음수
    await this.incrementProperty(data);
  }

  private async getProfile(projectId: string, profileId: string): Promise<any> {
    const query = `
      SELECT *
      FROM profiles
      WHERE projectId = {projectId:String}
        AND profileId = {profileId:String}
      ORDER BY createdAt DESC
      LIMIT 1
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, profileId },
    });

    const data: any = await result.json();
    return data.data?.[0] || null;
  }

  private async getPropertyValue(
    projectId: string,
    profileId: string,
    property: string
  ): Promise<number | null> {
    const query = `
      SELECT JSONExtractInt(properties, {property:String}) as value
      FROM profiles
      WHERE projectId = {projectId:String}
        AND profileId = {profileId:String}
      ORDER BY createdAt DESC
      LIMIT 1
    `;

    const result = await clickhouse.query({
      query,
      query_params: { projectId, profileId, property },
    });

    const data: any = await result.json();
    return data.data?.[0]?.value || null;
  }

  async close(): Promise<void> {
    logger.info('Closing Profile Worker...');
    await this.worker.close();
    logger.info('✅ Profile Worker closed');
  }
}

export default ProfileWorker;

