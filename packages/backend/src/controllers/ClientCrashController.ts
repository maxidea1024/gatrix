import { Request, Response } from 'express';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { ClientCrash } from '../models/ClientCrash';
import { CrashEvent } from '../models/CrashEvent';
import { CrashUploadRequest, CrashState, CRASH_CONSTANTS } from '../types/crash';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger';
import { cacheService } from '../services/CacheService';
import { isGreaterThan } from '../utils/semver';
import { generateULID } from '../utils/ulid';

export class ClientCrashController {
  /**
   * Upload crash data from client
   * POST /client/crashes/upload
   */
  static uploadCrash = asyncHandler(async (req: Request, res: Response) => {
    const body: CrashUploadRequest = req.body;

    // Validate required fields
    if (!body.platform || !body.branch || !body.environment || !body.stack) {
      throw new CustomError('Bad request body: Missing required fields (platform, branch, environment, stack)', 400);
    }

    try {
      // Generate crash hash from stack trace
      const chash = crypto.createHash('md5').update(body.stack).digest('hex');

      // Check if crash already exists (Redis cache + branch)
      const cacheKey = `crash:${chash}:${body.branch}`;
      let crashId = await cacheService.get<string>(cacheKey);
      let isNewCrash = false;
      let crash: ClientCrash;

      if (!crashId) {
        // Check database for existing crash
        const existingCrash = await ClientCrash.findByHashAndBranch(chash, body.branch);

        if (existingCrash) {
          crashId = existingCrash.id;
          crash = existingCrash;
          // Cache the crash ID for future lookups
          await cacheService.set(cacheKey, crashId, 86400); // Cache for 24 hours
        } else {
          isNewCrash = true;
        }
      }

      // Get client IP address and remove IPv6 prefix if present
      let clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
                     req.socket.remoteAddress ||
                     '';

      // Remove "::ffff:" prefix from IPv4-mapped IPv6 addresses
      if (clientIp.startsWith('::ffff:')) {
        clientIp = clientIp.substring(7);
      }

      // Get user agent
      const userAgent = req.headers['user-agent'] || '';

      if (isNewCrash) {
        // Extract first line from stack trace (max 200 chars)
        const firstLine = body.stack.split('\n')[0]?.substring(0, CRASH_CONSTANTS.MaxFirstLineLen) || '';

        const newCrashId = generateULID();

        // Create new crash record using raw query to use CURRENT_TIMESTAMP
        await ClientCrash.query().insert({
          id: newCrashId,
          chash,
          branch: body.branch,
          environment: body.environment,
          platform: body.platform,
          marketType: body.marketType,
          isEditor: body.isEditor || false,
          firstLine,
          crashesCount: 1,
          firstCrashAt: ClientCrash.knex().fn.now(),
          lastCrashAt: ClientCrash.knex().fn.now(),
          crashesState: CrashState.OPEN,
          maxAppVersion: body.appVersion,
          maxResVersion: body.resVersion
        });

        // Fetch the inserted crash
        const insertedCrash = await ClientCrash.query().findById(newCrashId);

        if (!insertedCrash) {
          throw new CustomError('Failed to create crash record', 500);
        }

        crash = insertedCrash;
        crashId = crash.id;

        // Cache the new crash ID
        await cacheService.set(cacheKey, crashId, 86400); // Cache for 24 hours

        // Save stack trace to file for new crashes
        const stackFilePath = await this.saveStackTraceFile(chash, body.stack);

        // Update crash with stack file path
        await crash.$query().patch({ stackFilePath });
      } else {
        // Existing crash - load if not already loaded
        if (!crash!) {
          const foundCrash = await ClientCrash.query().findById(crashId!);
          if (!foundCrash) {
            throw new CustomError('Crash not found', 404);
          }
          crash = foundCrash;
        }
      }

      // Create crash event
      const event = await CrashEvent.create({
        crashId: crash.id,
        platform: body.platform,
        marketType: body.marketType,
        branch: body.branch,
        environment: body.environment,
        isEditor: body.isEditor,
        appVersion: body.appVersion,
        resVersion: body.resVersion,
        accountId: body.accountId,
        characterId: body.characterId,
        gameUserId: body.gameUserId,
        userName: body.userName,
        gameServerId: body.gameServerId,
        userMessage: body.userMessage,
        crashEventIp: clientIp,
        crashEventUserAgent: userAgent
      });

      // Update crash record for existing crashes
      if (!isNewCrash) {
        // Update first crash event ID if not set
        if (!crash.firstCrashEventId) {
          await crash.$query().patch({ firstCrashEventId: event.id });
        }

        // Increment count and update last crash event
        await crash.incrementCount(event.id);

        // Update max versions if needed
        await crash.updateMaxVersions(body.appVersion, body.resVersion);

        // Check for reopen logic
        await this.checkReopenLogic(crash, body);
      } else {
        // For new crashes, set first crash event ID
        await crash.$query().patch({
          firstCrashEventId: event.id,
          lastCrashEventId: event.id
        });
      }

      // Save log file if provided
      if (body.log) {
        const logFilePath = await this.saveLogFile(event.id, body.log);
        await event.$query().patch({ logFilePath });
      }

      logger.info('Crash uploaded successfully', {
        crashId: crash.id,
        eventId: event.id,
        isNewCrash,
        platform: body.platform,
        branch: body.branch
      });

      res.json({
        success: true,
        data: {
          crashId: crash.id,
          eventId: event.id,
          isNewCrash
        }
      });

    } catch (error) {
      logger.error('Error uploading crash:', error);
      if (error instanceof CustomError) {
        throw error;
      }
      throw new CustomError('Failed to upload crash', 500);
    }
  });

  /**
   * Save stack trace to file
   * Returns the relative file path
   */
  private static async saveStackTraceFile(chash: string, stack: string): Promise<string> {
    try {
      // Create directory structure: public/crashes/hash[0:2]/hash[2:4]/
      const hashDir1 = chash.substring(0, 2);
      const hashDir2 = chash.substring(2, 4);
      const dirPath = path.join(process.cwd(), 'public', 'crashes', hashDir1, hashDir2);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Save stack trace file
      const filePath = path.join(dirPath, chash);
      await fs.writeFile(filePath, stack, 'utf8');

      const relativePath = `/crashes/${hashDir1}/${hashDir2}/${chash}`;
      logger.debug('Stack trace saved', { chash, relativePath });

      return relativePath;
    } catch (error) {
      logger.error('Failed to save stack trace file:', error);
      // Don't throw error - file saving failure shouldn't block crash upload
      return '';
    }
  }

  /**
   * Save log file
   * Returns the relative file path
   */
  private static async saveLogFile(eventId: string, log: string): Promise<string> {
    try {
      // Check log size limit (1MB)
      if (log.length > CRASH_CONSTANTS.MaxLogTextLen) {
        logger.warn('Log text exceeds maximum length', {
          eventId,
          logLength: log.length,
          maxLength: CRASH_CONSTANTS.MaxLogTextLen
        });
        log = log.substring(0, CRASH_CONSTANTS.MaxLogTextLen);
      }

      // Create directory structure: public/crashes/logs/YYYY/MM/DD/
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const dirPath = path.join(process.cwd(), 'public', 'crashes', 'logs', year, month, day);

      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });

      // Save log file
      const filePath = path.join(dirPath, `${eventId}.txt`);
      await fs.writeFile(filePath, log, 'utf8');

      const relativePath = `/crashes/logs/${year}/${month}/${day}/${eventId}.txt`;
      logger.debug('Log file saved', { eventId, relativePath });

      return relativePath;
    } catch (error) {
      logger.error('Failed to save log file:', error);
      // Don't throw error - file saving failure shouldn't block crash upload
      return '';
    }
  }

  /**
   * Check reopen logic for closed/resolved crashes
   */
  private static async checkReopenLogic(crash: ClientCrash, body: CrashUploadRequest) {
    // Only check reopen for CLOSED or RESOLVED crashes
    if (crash.crashesState !== CrashState.CLOSED && crash.crashesState !== CrashState.RESOLVED) {
      return;
    }

    let shouldReopen = false;

    // Editor mode always reopens
    if (body.isEditor) {
      shouldReopen = true;
    } else if (body.appVersion && crash.maxAppVersion) {
      // For other environments, check if current version is higher than max version
      try {
        shouldReopen = isGreaterThan(body.appVersion, crash.maxAppVersion);
      } catch (error) {
        logger.warn('Failed to compare versions for reopen logic', {
          crashId: crash.id,
          currentVersion: body.appVersion,
          maxVersion: crash.maxAppVersion,
          error
        });
      }
    }

    if (shouldReopen) {
      await crash.reopen();
      logger.info('Crash reopened', {
        crashId: crash.id,
        branch: body.branch,
        currentVersion: body.appVersion,
        previousMaxVersion: crash.maxAppVersion
      });
    }
  }
}
