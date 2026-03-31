import { Response } from 'express';
import ClientVersionService from '../services/client-version-service';
import { ClientVersionModel } from '../models/client-version';
import { TagService } from '../services/tag-service';
import { DEFAULT_CONFIG, SERVER_SDK_ETAG } from '../constants/cache-keys';
import { respondWithEtagCache } from '../utils/server-sdk-etag-cache';
import { EnvironmentRequest } from '../middleware/environment-resolver';

import { createLogger } from '../config/logger';
const logger = createLogger('ServerClientVersionController');

/**
 * Server SDK Client Version Controller
 * Handles client version list retrieval for server-side SDK (Edge)
 */
export class ServerClientVersionController {
  /**
   * Get client versions for a specific project (project-scoped)
   * GET /api/v1/server/client-versions
   * Returns all active client versions with tags for the specified project
   */
  static async getClientVersions(req: EnvironmentRequest, res: Response) {
    try {
      const projectId = req.projectId;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PROJECT',
            message: 'Project is required',
          },
        });
      }

      await respondWithEtagCache(res, {
        cacheKey: `${SERVER_SDK_ETAG.CLIENT_VERSIONS}:${projectId}`,
        ttlMs: DEFAULT_CONFIG.CLIENT_VERSION_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          const result = await ClientVersionModel.findAll({
            projectId,
            limit: 1000,
            offset: 0,
            sortBy: 'clientVersion',
            sortOrder: 'DESC',
          });


          // Fetch tags for each client version
          const versionsWithTags = await Promise.all(
            result.clientVersions.map(async (version: any) => {
              const tags = await TagService.listTagsForEntity(
                'client_version',
                version.id
              );

              // Parse customPayload and merge with passiveData
              let customPayload = {};
              try {
                if (version.customPayload) {
                  let parsed =
                    typeof version.customPayload === 'string'
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

                  if (
                    parsed &&
                    typeof parsed === 'object' &&
                    !Array.isArray(parsed)
                  ) {
                    customPayload = parsed;
                  }
                }
              } catch (error) {
                logger.warn(
                  `Failed to parse customPayload for client version ${version.id}:`,
                  error
                );
              }

              const mergedMeta = { ...customPayload };

              // Remove internal fields from response
              const { environmentId: _env, ...versionWithoutEnv } = version;
              void _env;

              return {
                ...versionWithoutEnv,
                customPayload: mergedMeta, // Return as object
                tags: tags || [],
              };
            })
          );

          logger.info(
            `Server SDK: Retrieved ${versionsWithTags.length} client versions for projectId ${projectId}`
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
      logger.error(
        'Error in ServerClientVersionController.getClientVersions:',
        error
      );
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
  static async getClientVersionById(req: EnvironmentRequest, res: Response) {
    try {
      const { id } = req.params;
      const environmentId = req.environmentId;
      const versionId = id;

      if (!environmentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ENVIRONMENT',
            message: 'Environment is required',
          },
        });
      }

      if (!versionId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid client version ID',
            details: { reason: 'ID must be a valid number' },
          },
        });
      }

      const version = await ClientVersionService.getClientVersionById(
        versionId,
        environmentId
      );

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
      const tags = await TagService.listTagsForEntity(
        'client_version',
        version.id!
      );

      // Parse customPayload
      let customPayload = {};
      try {
        if (version.customPayload) {
          let parsed =
            typeof version.customPayload === 'string'
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
        logger.warn(
          `Failed to parse customPayload for client version ${version.id}:`,
          error
        );
      }

      // Build meta from customPayload only
      const mergedMeta = { ...customPayload };

      logger.info(
        `Server SDK: Retrieved client version ${versionId} for environmentId ${environmentId}`
      );

      res.json({
        success: true,
        data: {
          ...version,
          customPayload: mergedMeta,
          tags: tags || [],
        },
      });
    } catch (error) {
      logger.error(
        'Error in ServerClientVersionController.getClientVersionById:',
        error
      );
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
