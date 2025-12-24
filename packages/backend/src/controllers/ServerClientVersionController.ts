import { Response } from 'express';
import ClientVersionService from '../services/ClientVersionService';
import { ClientVersionModel } from '../models/ClientVersion';
import VarsModel from '../models/Vars';
import { TagService } from '../services/TagService';
import logger from '../config/logger';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cacheKeys';
import { respondWithEtagCache } from '../utils/serverSdkEtagCache';
import { EnvironmentRequest } from '../middleware/environmentResolver';

/**
 * Server SDK Client Version Controller
 * Handles client version list retrieval for server-side SDK (Edge)
 */
export class ServerClientVersionController {
  /**
   * Get client versions for a specific environment
   * GET /api/v1/server/:env/client-versions
   * Returns all active client versions with tags for the specified environment
   */
  static async getClientVersions(req: EnvironmentRequest, res: Response) {
    try {
      const environment = req.environment!;

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${environment.id}`,
        ttlMs: DEFAULT_CONFIG.CLIENT_VERSION_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const result = await ClientVersionModel.findAll({
            environmentId: environment.id,
            limit: 1000,
            offset: 0,
            sortBy: 'clientVersion',
            sortOrder: 'DESC',
          });

          // Get clientVersionPassiveData from KV settings
          let passiveData = {};
          try {
            const passiveDataStr = await VarsModel.get('$clientVersionPassiveData', environment.id);
            if (passiveDataStr) {
              let parsed = JSON.parse(passiveDataStr);
              // Handle double-encoded JSON string
              if (typeof parsed === 'string') {
                try {
                  parsed = JSON.parse(parsed);
                } catch (e) {
                  // ignore
                }
              }
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                passiveData = parsed;
              }
            }
          } catch (error) {
            logger.warn('Failed to parse clientVersionPassiveData for Server SDK:', error);
          }

          // Fetch tags for each client version
          const versionsWithTags = await Promise.all(
            result.clientVersions.map(async (version: any) => {
              const tags = await TagService.listTagsForEntity('client_version', version.id);

              // Parse customPayload and merge with passiveData
              let customPayload = {};
              try {
                if (version.customPayload) {
                  let parsed = typeof version.customPayload === 'string'
                    ? JSON.parse(version.customPayload)
                    : version.customPayload;

                  // Handle double-encoded JSON string
                  if (typeof parsed === 'string') {
                    try {
                      parsed = JSON.parse(parsed);
                    } catch (e) {
                      // ignore
                    }
                  }

                  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    customPayload = parsed;
                  }
                }
              } catch (error) {
                logger.warn(`Failed to parse customPayload for client version ${version.id}:`, error);
              }

              // Merge: passiveData first, then customPayload (customPayload overwrites)
              const mergedMeta = { ...passiveData, ...customPayload };

              // Remove internal fields from response
              const { environmentId: _envId, ...versionWithoutEnvId } = version;
              void _envId;

              return {
                ...versionWithoutEnvId,
                customPayload: mergedMeta, // Return as object
                tags: tags || [],
              };
            }),
          );

          logger.info(`Server SDK: Retrieved ${versionsWithTags.length} client versions for environment ${environment.environmentName}`);

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
   * GET /api/v1/server/:env/client-versions/:id
   */
  static async getClientVersionById(req: EnvironmentRequest, res: Response) {
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

      // Get clientVersionPassiveData from KV settings
      let passiveData = {};
      try {
        const passiveDataStr = await VarsModel.get('$clientVersionPassiveData', req.environment!.id);
        if (passiveDataStr) {
          let parsed = JSON.parse(passiveDataStr);
          // Handle double-encoded JSON string
          if (typeof parsed === 'string') {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {
              // ignore
            }
          }
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            passiveData = parsed;
          }
        }
      } catch (error) {
        logger.warn('Failed to parse clientVersionPassiveData for Server SDK (Single):', error);
      }

      // Parse customPayload and merge with passiveData
      let customPayload = {};
      try {
        if (version.customPayload) {
          let parsed = typeof version.customPayload === 'string'
            ? JSON.parse(version.customPayload)
            : version.customPayload;

          // Handle double-encoded JSON string
          if (typeof parsed === 'string') {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {
              // ignore
            }
          }

          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            customPayload = parsed;
          }
        }
      } catch (error) {
        logger.warn(`Failed to parse customPayload for client version ${version.id}:`, error);
      }

      // Merge: passiveData first, then customPayload (customPayload overwrites)
      const mergedMeta = { ...passiveData, ...customPayload };

      logger.info(`Server SDK: Retrieved client version ${versionId}`);

      res.json({
        success: true,
        data: {
          ...version,
          customPayload: mergedMeta,
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

