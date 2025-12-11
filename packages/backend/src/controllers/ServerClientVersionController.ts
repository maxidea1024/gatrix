import { Request, Response } from 'express';
import ClientVersionService from '../services/ClientVersionService';
import { ClientVersionModel } from '../models/ClientVersion';
import { Environment } from '../models/Environment';
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
      // '*' means all environments
      const environmentsParam = req.query.environments as string | undefined;
      const isAllEnvironments = environmentsParam === '*';
      const environments = environmentsParam && !isAllEnvironments
        ? environmentsParam.split(',').map(e => e.trim()).filter(Boolean)
        : [];

      await respondWithEtagCache(res, {
        cacheKey: SERVER_SDK_ETAG.CLIENT_VERSIONS,
        ttlMs: DEFAULT_CONFIG.CLIENT_VERSION_TTL,
        requestEtag: req.headers['if-none-match'],
        buildPayload: async () => {
          // All environments mode or specific environments mode
          if (isAllEnvironments || environments.length > 0) {
            const byEnvironment: Record<string, any[]> = {};
            let totalCount = 0;

            // Get target environments
            let targetEnvs: any[];
            if (isAllEnvironments) {
              // Fetch all environments
              targetEnvs = await Environment.query().where('isActive', true);
            } else {
              // Fetch specific environments
              targetEnvs = [];
              for (const envParam of environments) {
                let env = await Environment.query().findById(envParam);
                if (!env) {
                  env = await Environment.getByName(envParam);
                }
                if (env) {
                  targetEnvs.push(env);
                } else {
                  logger.warn(`Server SDK: Environment not found for param '${envParam}'`);
                }
              }
            }

            for (const env of targetEnvs) {
              const result = await ClientVersionModel.findAll({
                environmentId: env.id,
                limit: 1000,
                offset: 0,
                sortBy: 'clientVersion',
                sortOrder: 'DESC',
              });

              // Fetch tags for each client version
              const versionsWithTags = await Promise.all(
                result.clientVersions.map(async (version: any) => {
                  const tags = await TagService.listTagsForEntity('client_version', version.id);
                  return {
                    ...version,
                    tags: tags || [],
                  };
                }),
              );

              // Store by environmentName (the standard external identifier)
              byEnvironment[env.environmentName] = versionsWithTags;
              totalCount += versionsWithTags.length;
            }

            logger.info(
              `Server SDK: Retrieved ${totalCount} client versions across ${Object.keys(byEnvironment).length} environments`,
              { mode: isAllEnvironments ? 'all' : 'specific', environments: Object.keys(byEnvironment) }
            );

            return {
              success: true,
              data: {
                byEnvironment,
                total: totalCount,
              },
            };
          } else {
            // Single-environment mode: return flat array
            // Use X-Environment header to determine environment (required for Server SDK)
            const envHeader = req.headers['x-environment'] as string | undefined;
            if (!envHeader) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'MISSING_ENVIRONMENT',
                  message: 'X-Environment header is required for single-environment mode',
                },
              });
            }

            // Resolve environment by name or ID
            let targetEnv = await Environment.query().findById(envHeader);
            if (!targetEnv) {
              targetEnv = await Environment.getByName(envHeader);
            }
            if (!targetEnv) {
              return res.status(400).json({
                success: false,
                error: {
                  code: 'INVALID_ENVIRONMENT',
                  message: `Environment '${envHeader}' not found`,
                },
              });
            }

            const result = await ClientVersionModel.findAll({
              environmentId: targetEnv.id,
              limit: 1000,
              offset: 0,
              sortBy: 'clientVersion',
              sortOrder: 'DESC',
            });

            // Fetch tags for each client version
            const versionsWithTags = await Promise.all(
              result.clientVersions.map(async (version: any) => {
                const tags = await TagService.listTagsForEntity('client_version', version.id);
                // Remove environmentId from response
                const { environmentId: _envId, ...versionWithoutEnvId } = version;
                void _envId;
                return {
                  ...versionWithoutEnvId,
                  tags: tags || [],
                };
              }),
            );

            logger.info(`Server SDK: Retrieved ${versionsWithTags.length} client versions for environment ${targetEnv.environmentName}`);

            return {
              success: true,
              data: {
                clientVersions: versionsWithTags,
                total: versionsWithTags.length,
              },
            };
          }
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

