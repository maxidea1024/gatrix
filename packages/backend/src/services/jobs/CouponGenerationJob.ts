import { Job } from 'bullmq';
import { ulid } from 'ulid';
import database from '../../config/database';
import logger from '../../config/logger';
import { RowDataPacket } from 'mysql2/promise';
import { generateCouponCode, CodePattern } from '../../utils/couponCodeGenerator';

export interface CouponGenerationJobData {
  type: string;
  payload: {
    settingId: string;
    quantity: number;
  };
  timestamp: number;
}

/**
 * Job for generating coupon codes asynchronously
 * Handles large batch coupon code generation for NORMAL type coupons
 *
 * Performance optimizations:
 * - Generate and insert codes in streaming batches (no memory accumulation)
 * - Reduce DB duplicate checks to once per batch
 * - Update progress less frequently (every 5% or 50,000 codes)
 * - Use batch INSERT with 2000 codes per batch for better throughput
 */
export class CouponGenerationJob {
  private static readonly BATCH_SIZE = 2000; // Insert 2000 codes per batch (6000 placeholders)
  private static readonly DUPLICATE_CHECK_BATCH = 500; // Check duplicates once per 500 codes
  private static readonly PROGRESS_UPDATE_INTERVAL = 10000; // Update progress every 10,000 codes

  static async process(job: Job<any>): Promise<void> {
    const jobId = job.id || 'unknown';
    const pool = database.getPool();
    let settingId: string | undefined;
    let quantity: number | undefined;

    try {
      // Debug: log raw job data
      logger.info('Job data received', {
        jobId,
        jobData: JSON.stringify(job.data),
      });

      // Extract payload - handle both direct and wrapped formats
      if (job.data && typeof job.data === 'object') {
        if ((job.data as any).payload) {
          // Wrapped format: { type, payload, timestamp }
          settingId = (job.data as any).payload?.settingId;
          quantity = (job.data as any).payload?.quantity;
        } else {
          // Direct format: { settingId, quantity }
          settingId = (job.data as any).settingId;
          quantity = (job.data as any).quantity;
        }
      }

      // Validate input parameters
      if (!settingId || !quantity) {
        logger.error('Invalid job data', {
          jobId,
          jobData: job.data,
          settingId,
          quantity,
        });
        throw new Error('Invalid job data: settingId and quantity are required');
      }

      logger.info('Starting coupon generation job', {
        jobId,
        settingId,
        quantity,
      });

      // Update status to IN_PROGRESS
      const jobIdForDb = jobId === 'unknown' ? null : jobId;
      await pool.execute(
        'UPDATE g_coupon_settings SET generationStatus = ?, generatedCount = 0, generationJobId = ? WHERE id = ?',
        ['IN_PROGRESS', jobIdForDb, settingId]
      );

      // Get codePattern and environment from settings
      const [settings] = await pool.execute<RowDataPacket[]>(
        'SELECT codePattern, environment FROM g_coupon_settings WHERE id = ?',
        [settingId]
      );
      const codePattern = (settings[0]?.codePattern || 'ALPHANUMERIC_8') as CodePattern;
      const environment = settings[0]?.environment;

      if (!environment) {
        throw new Error('Setting not found or missing environment');
      }

      // Generate and insert codes in streaming batches
      const localSet = new Set<string>();
      let totalGenerated = 0;
      let lastProgressUpdate = 0;

      logger.info('Starting streaming batch generation', {
        settingId,
        quantity,
        codePattern,
        environment,
      });

      for (let i = 0; i < quantity; i += this.BATCH_SIZE) {
        const batchCodes: Array<[string, string, string, string]> = [];
        const batchSize = Math.min(this.BATCH_SIZE, quantity - i);

        // Generate codes for this batch
        for (let j = 0; j < batchSize; j++) {
          let code: string;
          let found = false;

          // Try to find a unique code
          for (let attempt = 0; attempt < 10; attempt++) {
            code = generateCouponCode(codePattern);
            if (localSet.has(code)) continue;

            // Check database for duplicates less frequently
            if ((i + j) % this.DUPLICATE_CHECK_BATCH === 0) {
              const [dup] = await pool.execute<RowDataPacket[]>(
                'SELECT 1 as ok FROM g_coupons WHERE code = ? LIMIT 1',
                [code]
              );
              if (dup.length === 0) {
                found = true;
                break;
              }
            } else {
              found = true;
              break;
            }
          }

          if (!found) {
            logger.warn('Failed to generate unique code after 10 attempts', {
              jobId,
              settingId,
              codeIndex: i + j,
            });
            continue;
          }

          localSet.add(code!);
          batchCodes.push([ulid(), settingId, code!, environment]);
        }

        // Insert batch immediately (streaming approach)
        if (batchCodes.length > 0) {
          const placeholders = batchCodes.map(() => '(?, ?, ?, ?)').join(',');
          await pool.execute(
            `INSERT INTO g_coupons (id, settingId, code, environment) VALUES ${placeholders}`,
            batchCodes.flat()
          );

          totalGenerated += batchCodes.length;

          // Update progress less frequently
          if (totalGenerated - lastProgressUpdate >= this.PROGRESS_UPDATE_INTERVAL) {
            const progress = Math.round((totalGenerated / quantity) * 100);
            await pool.execute('UPDATE g_coupon_settings SET generatedCount = ? WHERE id = ?', [
              totalGenerated,
              settingId,
            ]);
            await job.updateProgress(progress);
            logger.info('Coupon generation progress', {
              jobId,
              settingId,
              progress,
              generated: totalGenerated,
              total: quantity,
            });
            lastProgressUpdate = totalGenerated;
          }
        }
      }

      // Final progress update - set both generatedCount and totalCount to actual generated count
      // Also update issuedCount cache
      await pool.execute(
        'UPDATE g_coupon_settings SET generationStatus = ?, generatedCount = ?, totalCount = ?, issuedCount = ?, generationJobId = NULL WHERE id = ?',
        ['COMPLETED', totalGenerated, totalGenerated, totalGenerated, settingId]
      );
      await job.updateProgress(100);

      logger.info('Coupon generation job completed successfully', {
        jobId,
        settingId,
        totalGenerated,
      });
    } catch (error) {
      logger.error('Coupon generation job failed', { jobId, settingId, error });

      // Update status to FAILED
      try {
        await pool.execute(
          'UPDATE g_coupon_settings SET generationStatus = ?, generationJobId = NULL WHERE id = ?',
          ['FAILED', settingId]
        );
      } catch (updateError) {
        logger.error('Failed to update coupon status to FAILED', {
          jobId,
          settingId,
          error: updateError,
        });
      }

      throw error;
    }
  }
}
