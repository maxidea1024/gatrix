import { Request, Response } from 'express';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { ClientCrash } from '../models/ClientCrash';
import { CrashInstance } from '../models/CrashInstance';
import { CrashUploadRequest, CrashState, CRASH_CONSTANTS, Branch } from '../types/crash';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from '../config/logger';
import { cacheService } from '../services/CacheService';

export class ClientCrashController {
  /**
   * Upload crash data from client
   * POST /client/crashes/upload
   */
  static uploadCrash = asyncHandler(async (req: Request, res: Response) => {
    const body: CrashUploadRequest = req.body;

    // Validate required fields
    if (!body.pubId || body.userId === undefined || !body.stack || 
        body.platform === undefined || body.branch === undefined ||
        body.majorVer === undefined || body.minorVer === undefined ||
        body.buildNum === undefined || body.patchNum === undefined) {
      throw new CustomError('Bad request body: Missing required fields', 400);
    }

    // Validate numeric fields
    if (isNaN(body.userId) || isNaN(body.platform) || isNaN(body.branch) ||
        isNaN(body.majorVer) || isNaN(body.minorVer) || 
        isNaN(body.buildNum) || isNaN(body.patchNum)) {
      throw new CustomError('Bad request body: Invalid numeric fields', 400);
    }

    // Special handling for empty pubId
    if (body.pubId === '') {
      body.pubId = '0';
    }

    try {
      // Generate crash hash from stack trace
      const chash = crypto.createHash('md5').update(body.stack).digest('hex');

      // Check if crash already exists (Redis cache + branch)
      const cacheKey = `crash:${chash}:${body.branch}`;
      let crashId = await cacheService.get<number>(cacheKey);
      let isNewCrash = false;

      if (!crashId) {
        // Check database for existing crash
        const existingCrash = await ClientCrash.findByHashAndBranch(chash, body.branch);
        
        if (existingCrash) {
          crashId = existingCrash.id;
          // Cache the crash ID for future lookups
          await cacheService.set(cacheKey, crashId, 3600); // Cache for 1 hour
        } else {
          isNewCrash = true;
        }
      }

      let crash: ClientCrash;

      if (isNewCrash) {
        // Create new crash record
        const firstLine = body.stack.split('\n')[0]?.substring(0, CRASH_CONSTANTS.MaxFirstLineLen) || '';
        
        crash = await ClientCrash.query().insert({
          branch: body.branch,
          chash,
          firstLine,
          count: 1,
          state: CrashState.OPEN,
          lastCrash: new Date()
        });

        crashId = crash.id;
        
        // Cache the new crash ID
        await cacheService.set(cacheKey, crashId, 3600);

        // Save stack trace to file for new crashes
        await this.saveStackTraceFile(chash, body.stack);
      } else {
        // Update existing crash
        if (!crashId) {
          throw new CustomError('Crash ID not found', 404);
        }
        const foundCrash = await ClientCrash.query().findById(crashId);
        if (!foundCrash) {
          throw new CustomError('Crash not found', 404);
        }
        crash = foundCrash;

        // Increment count and update last crash time
        await crash.incrementCount();

        // Check for reopen logic
        await this.checkReopenLogic(crash, body);
      }

      // Create crash instance
      const instance = await CrashInstance.createInstance({
        cid: crashId!,
        pubId: body.pubId,
        userId: body.userId,
        platform: body.platform,
        majorVer: body.majorVer,
        minorVer: body.minorVer,
        buildNum: body.buildNum,
        patchNum: body.patchNum,
        userMsg: body.userMsg
      });

      // Save log file if provided
      if (body.log) {
        await this.saveLogFile(instance.id, body.log);
      }

      logger.info('Crash uploaded successfully', {
        crashId: crashId,
        instanceId: instance.id,
        isNewCrash,
        userId: body.userId,
        platform: body.platform,
        branch: body.branch
      });

      res.json({
        success: true,
        data: {
          crashId: crashId,
          instanceId: instance.id,
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
   */
  private static async saveStackTraceFile(chash: string, stack: string) {
    try {
      // Create directory structure: public/lcrashes/hash[0:2]/hash[2:4]/
      const hashDir1 = chash.substring(0, 2);
      const hashDir2 = chash.substring(2, 4);
      const dirPath = path.join(process.cwd(), 'public', 'lcrashes', hashDir1, hashDir2);
      
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });
      
      // Save stack trace file
      const filePath = path.join(dirPath, chash);
      await fs.writeFile(filePath, stack, 'utf8');
      
      logger.debug('Stack trace saved', { chash, filePath });
    } catch (error) {
      logger.error('Failed to save stack trace file:', error);
      // Don't throw error - file saving failure shouldn't block crash upload
    }
  }

  /**
   * Save log file
   */
  private static async saveLogFile(instanceId: number, log: string) {
    try {
      // Check log size limit
      if (log.length > CRASH_CONSTANTS.MaxLogTextLen) {
        logger.warn('Log text exceeds maximum length', {
          instanceId,
          logLength: log.length,
          maxLength: CRASH_CONSTANTS.MaxLogTextLen
        });
        log = log.substring(0, CRASH_CONSTANTS.MaxLogTextLen);
      }

      // Create directory structure: public/logs/YYYY/MM/DD/
      const now = new Date();
      const year = now.getFullYear().toString();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const day = now.getDate().toString().padStart(2, '0');
      const dirPath = path.join(process.cwd(), 'public', 'logs', year, month, day);
      
      // Ensure directory exists
      await fs.mkdir(dirPath, { recursive: true });
      
      // Save log file
      const filePath = path.join(dirPath, `${instanceId}.txt`);
      await fs.writeFile(filePath, log, 'utf8');
      
      logger.debug('Log file saved', { instanceId, filePath });
    } catch (error) {
      logger.error('Failed to save log file:', error);
      // Don't throw error - file saving failure shouldn't block crash upload
    }
  }

  /**
   * Check reopen logic for closed crashes
   */
  private static async checkReopenLogic(crash: ClientCrash, body: CrashUploadRequest) {
    if (crash.state !== CrashState.CLOSED) {
      return; // Only check reopen for closed crashes
    }

    let shouldReopen = false;

    // Editor branch (branch 9) always reopens
    if (body.branch === Branch.EDITOR) {
      shouldReopen = true;
    } else {
      // For other branches, check if current version is higher than max version
      const maxVersions = await CrashInstance.query()
        .where('cid', crash.id)
        .select(
          CrashInstance.raw('MAX(majorVer) as maxMajorVer'),
          CrashInstance.raw('MAX(minorVer) as maxMinorVer'),
          CrashInstance.raw('MAX(buildNum) as maxBuildNum'),
          CrashInstance.raw('MAX(patchNum) as maxPatchNum')
        )
        .first();

      if (maxVersions) {
        shouldReopen = CrashInstance.isLatestVersion(
          (maxVersions as any).maxMajorVer || 0,
          (maxVersions as any).maxMinorVer || 0,
          (maxVersions as any).maxBuildNum || 0,
          (maxVersions as any).maxPatchNum || 0,
          body.majorVer,
          body.minorVer,
          body.buildNum,
          body.patchNum
        );
      }
    }

    if (shouldReopen) {
      await crash.updateState(CrashState.OPEN);
      logger.info('Crash reopened', {
        crashId: crash.id,
        branch: body.branch,
        version: `${body.majorVer}.${body.minorVer}.${body.buildNum}.${body.patchNum}`
      });
    }
  }
}
