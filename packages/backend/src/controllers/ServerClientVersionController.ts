import { Request, Response } from 'express';
import ClientVersionService from '../services/ClientVersionService';
import { ClientVersionModel } from '../models/ClientVersion';
import { TagService } from '../services/TagService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';

export interface SDKRequest extends Request {
  apiToken?: any;
}

/**
 * Server SDK Client Version Controller
 * Handles client version list retrieval for server-side SDK (Edge)
 */
export class ServerClientVersionController {
  /**
   * Get client versions list
   * GET /api/v1/server/client-versions
   * GET /api/v1/server/client-versions?environments=env1,env2,env3
   * Returns all active client versions with tags
   */
  static async getClientVersions(req: SDKRequest, res: Response) {
    try {
      // Parse environments query parameter
      const environmentsParam = req.query.environments as string | undefined;
      const environments = environmentsParam
        ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      await respondWithEtagCache(res, {
        cacheKey: SERVER_SDK_ETAG.CLIENT_VERSIONS,
        ttlMs: DEFAULT_CONFIG.CLIENT_VERSION_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          let clientVersions: any[] = [];

          if (environments.length > 0) {
            // Multi-environment mode: fetch from all specified environments
            for (const envId of environments) {
              const result = await ClientVersionModel.findAll({
                environmentId: envId,
                limit: 1000,
                offset: 0,
                sortBy: 'clientVersion',
                sortOrder: 'DESC',
              });

              // Add environmentId to each version for client grouping
              const versionsWithEnv = result.clientVersions.map((v: any) => ({
                ...v,
                environmentId: envId,
              }));
              clientVersions.push(...versionsWithEnv);
            }
          } else {
            // Single-environment mode: use current environment (via context)
            const result = await ClientVersionModel.findAll({
              limit: 1000,
              offset: 0,
              sortBy: 'clientVersion',
              sortOrder: 'DESC',
            });
            clientVersions = result.clientVersions;
          }

          // Fetch tags for each client version
          const versionsWithTags = await Promise.all(
            clientVersions.map(async (version: any) => {
              const tags = await TagService.listTagsForEntity('client_version', version.id);
              return {
                ...version,
                tags: tags || [],
              };
            }),
          );

          logger.info(
            `Server SDK: Retrieved ${versionsWithTags.length} client versions`,
            { environments: environments.length > 0 ? environments : 'current' }
          );

          return {
            success: true,
            data: {
              clientVersions: versionsWithTags,
              total: versionsWithTags.length,
            },
          };
        },
      });
    } catch (error) {
      logger.error('Error in ServerClientVersionController.getClientVersions:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve client versions',
        },
      });
    }
  }

  /**
   * Get specific client version by ID
   * GET /api/v1/server/client-versions/:id
   */
  static async getClientVersionById(req: SDKRequest, res: Response) {
    try {
      const { id } = req.params;
      const versionId = parseInt(id);

      if (isNaN(versionId)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid client version ID',
            details: { reason: 'ID must be a valid number' },
          },
        });
      }

      const version = await ClientVersionService.getClientVersionById(versionId);

      if (!version) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Client version not found',
          },
        });
      }

      // Fetch tags
      const tags = await TagService.listTagsForEntity('client_version', version.id!);

      logger.info(`Server SDK: Retrieved client version ${versionId}`);

      res.json({
        success: true,
        data: {
          ...version,
          tags: tags || [],
        },
      });
    } catch (error) {
      logger.error('Error in ServerClientVersionController.getClientVersionById:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve client version',
        },
      });
    }
  }
}

export default ServerClientVersionController;

