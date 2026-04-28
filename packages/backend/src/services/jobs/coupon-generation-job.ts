import { Job } from 'bullmq';
import { ulid } from 'ulid';
import database from '../../config/database';
import { createLogger } from '../../config/logger';

const logger = createLogger('CouponGenerationJob');
import { RowDataPacket } from 'mysql2/promise';
import {
  generateCouponCode,
  CodePattern,
} from '../../utils/coupon-code-generator';

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
  private static readonly BATCH_SIZE = 2000;
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
        throw new Error(
          'Invalid job data: settingId and quantity are required'
        );
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
        'SELECT codePattern, environmentId FROM g_coupon_settings WHERE id = ?',
        [settingId]
      );
      const codePattern = (settings[0]?.codePattern ||
        'ALPHANUMERIC_8') as CodePattern;
      const environmentId = settings[0]?.environmentId;

      if (!environmentId) {
        throw new Error('Setting not found or missing environment');
      }

      // Generate and insert codes in streaming batches with full dedup
      const localSet = new Set<string>();
      let totalGenerated = 0;
      let lastProgressUpdate = 0;
      const MAX_GLOBAL_RETRIES = 5;

      logger.info('Starting streaming batch generation', {
        settingId,
        quantity,
        codePattern,
        environmentId,
      });

      for (let retry = 0; retry < MAX_GLOBAL_RETRIES; retry++) {
        const remaining = quantity - totalGenerated;
        if (remaining <= 0) break;

        // Process in batches of BATCH_SIZE
        for (let i = 0; i < remaining; i += this.BATCH_SIZE) {
          const batchSize = Math.min(this.BATCH_SIZE, remaining - i);

          // Step 1: Generate candidate codes with local dedup
          const candidates: string[] = [];
          let genAttempts = 0;
          const maxGenAttempts = batchSize * 20;

          while (
            candidates.length < batchSize &&
            genAttempts < maxGenAttempts
          ) {
            genAttempts++;
            const code = generateCouponCode(codePattern);
            if (!localSet.has(code)) {
              localSet.add(code);
              candidates.push(code);
            }
          }

          if (candidates.length === 0) {
            logger.error('Failed to generate any unique codes for batch', {
              jobId,
              settingId,
              localSetSize: localSet.size,
            });
            break;
          }

          // Step 2: Batch-check DB for existing codes and filter them out
          const freshCodes: string[] = [];
          const DB_CHECK_CHUNK = 500;
          for (let c = 0; c < candidates.length; c += DB_CHECK_CHUNK) {
            const chunk = candidates.slice(c, c + DB_CHECK_CHUNK);
            const placeholdersCheck = chunk.map(() => '?').join(',');
            const [existing] = await pool.execute<RowDataPacket[]>(
              `SELECT code FROM g_coupons WHERE code IN (${placeholdersCheck})`,
              chunk
            );
            const existingSet = new Set(
              existing.map((r: RowDataPacket) => r.code)
            );
            for (const code of chunk) {
              if (!existingSet.has(code)) {
                freshCodes.push(code);
              }
            }
          }

          // Step 3: Insert using INSERT IGNORE for race condition safety
          if (freshCodes.length > 0) {
            // Insert in sub-batches to keep placeholder count reasonable
            const INSERT_SUB_BATCH = 500;
            for (let s = 0; s < freshCodes.length; s += INSERT_SUB_BATCH) {
              const subBatch = freshCodes.slice(s, s + INSERT_SUB_BATCH);
              const rows = subBatch.map((code) => [
                ulid(),
                settingId,
                code,
                environmentId,
              ]);
              const placeholders = rows.map(() => '(?, ?, ?, ?)').join(',');

              const [result] = await pool.execute(
                `INSERT IGNORE INTO g_coupons (id, settingId, code, environmentId) VALUES ${placeholders}`,
                rows.flat() as string[]
              );

              const inserted = (result as any)?.affectedRows ?? subBatch.length;
              totalGenerated += inserted;
            }
          }

          // Update progress periodically
          if (
            totalGenerated - lastProgressUpdate >=
            this.PROGRESS_UPDATE_INTERVAL
          ) {
            const progress = Math.min(
              99,
              Math.round((totalGenerated / quantity) * 100)
            );
            await pool.execute(
              'UPDATE g_coupon_settings SET generatedCount = ? WHERE id = ?',
              [totalGenerated, settingId]
            );
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

          if (totalGenerated >= quantity) break;
        }

        if (totalGenerated >= quantity) break;

        logger.info('Retrying coupon generation for shortfall', {
          jobId,
          settingId,
          retry: retry + 1,
          totalGenerated,
          target: quantity,
        });
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
          ['FAILED', settingId ?? null]
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
