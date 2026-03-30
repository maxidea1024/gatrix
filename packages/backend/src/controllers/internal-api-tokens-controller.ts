import { Response } from 'express';
import { SDKRequest } from '../middleware/api-token-auth';
import knex from '../config/knex';
import apiTokenUsageService from '../services/api-token-usage-service';
import {
  sendForbidden,
  sendBadRequest,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/api-response';

import { createLogger } from '../config/logger';
const logger = createLogger('InternalApiTokens');

// Internal org name used by infrastructure services (Edge)
const INTERNAL_ORG_NAME = '__internal__';

/**
 * Check if the request uses an internal infrastructure token
 * (belongs to the __internal__ organisation)
 */
async function isInternalInfraToken(req: SDKRequest): Promise<boolean> {
  const apiToken = req.apiToken;
  if (!apiToken?.environmentId) return false;

  try {
    const result = await knex('g_environments as e')
      .join('g_projects as p', 'e.projectId', 'p.id')
      .join('g_organisations as o', 'p.orgId', 'o.id')
      .where('e.id', apiToken.environmentId)
      .where('o.orgName', INTERNAL_ORG_NAME)
      .select('o.id')
      .first();

    return !!result;
  } catch (error) {
    logger.error('Failed to check internal infra token:', error);
    return false;
  }
}

/**
 * Check if Edge bypass token or internal infrastructure token
 */
async function requireEdgeAccess(
  req: SDKRequest,
  res: Response
): Promise<boolean> {
  if (req.isEdgeBypassToken) return true;

  // Infra/unsecured tokens with __internal__ org are always allowed
  if (req.isUnsecuredToken && req.unsecuredOrgId === INTERNAL_ORG_NAME)
    return true;

  const isInternal = await isInternalInfraToken(req);
  if (!isInternal) {
    sendForbidden(
      res,
      'This endpoint is only accessible with Edge infrastructure token',
      ErrorCodes.AUTH_PERMISSION_DENIED
    );
    return false;
  }
  return true;
}

/**
 * Internal API controller for Edge server to fetch API tokens
 * Only accessible with Edge bypass token or internal infrastructure token
 */
class InternalApiTokensController {
  /**
   * Get all valid API tokens for Edge mirroring
   * Returns tokens with their full details for Edge to cache and validate locally
   *
   * GET /api/v1/server/internal/tokens
   */
  async getAllTokens(req: SDKRequest, res: Response) {
    try {
      if (!(await requireEdgeAccess(req, res))) return;

      // Get all valid tokens with org/project info
      // Project tokens have no environmentId, so we also join via token.projectId
      const tokens = await knex('g_api_access_tokens as t')
        .leftJoin('g_environments as e', 't.environmentId', 'e.id')
        .leftJoin('g_projects as p', 'e.projectId', 'p.id')
        .leftJoin('g_organisations as o', 'p.orgId', 'o.id')
        // Fallback join for project tokens (no environmentId, but have projectId)
        .leftJoin('g_projects as tp', 't.projectId', 'tp.id')
        .leftJoin('g_organisations as tok_org', 'tp.orgId', 'tok_org.id')
        .select(
          't.id',
          't.tokenName',
          't.tokenValue',
          't.tokenType',
          't.environmentId',
          knex.raw('COALESCE(p.id, tp.id) as projectId'),
          knex.raw('COALESCE(o.id, tok_org.id) as orgId'),
          't.expiresAt',
          't.createdAt',
          't.updatedAt'
        )
        .where((builder) => {
          builder
            .whereNull('t.expiresAt')
            .orWhere('t.expiresAt', '>', new Date());
        });

      // Format tokens for Edge (token:environment is 1:1)
      const formattedTokens = tokens.map((token: any) => ({
        id: token.id,
        tokenName: token.tokenName,
        tokenValue: token.tokenValue,
        tokenType: token.tokenType,
        orgId: token.orgId || null,
        projectId: token.projectId || null,
        environmentId: token.environmentId || null,
        expiresAt: token.expiresAt
          ? new Date(token.expiresAt).toISOString()
          : null,
        createdAt: new Date(token.createdAt).toISOString(),
        updatedAt: new Date(token.updatedAt).toISOString(),
      }));

      logger.info(`Edge fetched ${formattedTokens.length} tokens`);

      return sendSuccessResponse(res, {
        tokens: formattedTokens,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to fetch tokens',
        error,
        ErrorCodes.API_TOKEN_NOT_FOUND
      );
    }
  }

  /**
   * Receive token usage report from Edge servers
   * Aggregates usage data and updates database
   *
   * POST /api/v1/server/internal/token-usage-report
   */
  async receiveUsageReport(req: SDKRequest, res: Response) {
    try {
      if (!(await requireEdgeAccess(req, res))) return;

      const { edgeInstanceId, usageData, reportedAt } = req.body;

      if (!edgeInstanceId || !Array.isArray(usageData)) {
        return sendBadRequest(
          res,
          'Invalid request body: edgeInstanceId and usageData are required',
          {
            fields: ['edgeInstanceId', 'usageData'],
          }
        );
      }

      logger.info(`Received usage report from Edge`, {
        edgeInstanceId,
        tokenCount: usageData.length,
        reportedAt,
      });

      // Process each token's usage
      let processedCount = 0;
      for (const usage of usageData) {
        const { tokenId, usageCount } = usage;

        if (!tokenId || typeof usageCount !== 'number') {
          logger.warn('Invalid usage entry:', usage);
          continue;
        }

        try {
          // Record usage for each count (batch recording)
          for (let i = 0; i < usageCount; i++) {
            await apiTokenUsageService.recordTokenUsage(tokenId);
          }
          processedCount++;
        } catch (error) {
          logger.error(`Failed to record usage for token ${tokenId}:`, error);
        }
      }

      logger.info(`Processed usage report`, {
        edgeInstanceId,
        processedCount,
        totalTokens: usageData.length,
      });

      return sendSuccessResponse(res, {
        processedCount,
        receivedAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to process usage report',
        error,
        ErrorCodes.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get full organisation/project/environment tree for Edge
   * Returns all non-internal orgs with their projects and environments
   *
   * GET /api/v1/server/internal/environment-tree
   */
  async getEnvironmentTree(req: SDKRequest, res: Response) {
    try {
      if (!(await requireEdgeAccess(req, res))) return;

      // Get all non-internal organisations
      const orgs = await knex('g_organisations')
        .select('id', 'orgName', 'displayName')
        .where('isInternal', false)
        .where('isActive', true);

      // Get all projects for these orgs
      const orgIds = orgs.map((o: any) => o.id);
      const projects =
        orgIds.length > 0
          ? await knex('g_projects')
              .select('id', 'orgId', 'projectName', 'displayName')
              .whereIn('orgId', orgIds)
              .where('isActive', true)
          : [];

      // Get all environments for these projects
      const projectIds = projects.map((p: any) => p.id);
      const environments =
        projectIds.length > 0
          ? await knex('g_environments')
              .select(
                'id',
                'projectId',
                'name',
                'displayName',
                'environmentType'
              )
              .whereIn('projectId', projectIds)
          : [];

      // Build tree structure
      const envByProject = environments.reduce((acc: any, env: any) => {
        if (!acc[env.projectId]) acc[env.projectId] = [];
        acc[env.projectId].push({
          id: env.id,
          name: env.name,
          displayName: env.displayName,
          environmentType: env.environmentType,
        });
        return acc;
      }, {});

      const projectsByOrg = projects.reduce((acc: any, proj: any) => {
        if (!acc[proj.orgId]) acc[proj.orgId] = [];
        acc[proj.orgId].push({
          id: proj.id,
          projectName: proj.projectName,
          displayName: proj.displayName,
          environments: envByProject[proj.id] || [],
        });
        return acc;
      }, {});

      const tree = orgs.map((org: any) => ({
        id: org.id,
        orgName: org.orgName,
        displayName: org.displayName,
        projects: projectsByOrg[org.id] || [],
      }));

      logger.info(
        `Edge fetched environment tree: ${orgs.length} orgs, ${projects.length} projects, ${environments.length} environments`
      );

      return sendSuccessResponse(res, {
        organisations: tree,
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to fetch environment tree',
        error,
        ErrorCodes.INTERNAL_SERVER_ERROR
      );
    }
  }
}

export default new InternalApiTokensController();
