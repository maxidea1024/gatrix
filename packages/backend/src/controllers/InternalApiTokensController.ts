import { Response } from 'express';
import { SDKRequest } from '../middleware/apiTokenAuth';
import knex from '../config/knex';
import logger from '../config/logger';

/**
 * Internal API controller for Edge server to fetch API tokens
 * Only accessible with Edge bypass token
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
      // Only allow Edge bypass token to access this endpoint
      if (!req.isEdgeBypassToken) {
        return res.status(403).json({
          success: false,
          message: 'This endpoint is only accessible with Edge bypass token'
        });
      }

      // Get all valid tokens (not expired)
      const tokens = await knex('g_api_access_tokens')
        .select(
          'id',
          'tokenName',
          'tokenValue',
          'tokenType',
          'allowAllEnvironments',
          'expiresAt',
          'createdAt',
          'updatedAt'
        )
        .where(builder => {
          builder.whereNull('expiresAt').orWhere('expiresAt', '>', new Date());
        });

      // Get environment assignments for each token
      const tokenIds = tokens.map((t: any) => t.id);
      const environmentAssignments = tokenIds.length > 0
        ? await knex('g_api_access_token_environments')
            .whereIn('tokenId', tokenIds)
            .select('tokenId', 'environmentId')
        : [];

      // Get environment details
      const envIds = [...new Set(environmentAssignments.map((e: any) => e.environmentId))];
      const environments = envIds.length > 0
        ? await knex('g_environments')
            .whereIn('id', envIds)
            .select('id', 'environmentName')
        : [];

      const envMap = environments.reduce((acc: any, env: any) => {
        acc[env.id] = env.environmentName;
        return acc;
      }, {});

      // Group environment names by token
      const envByToken = environmentAssignments.reduce((acc: any, env: any) => {
        if (!acc[env.tokenId]) acc[env.tokenId] = [];
        const envName = envMap[env.environmentId];
        if (envName) acc[env.tokenId].push(envName);
        return acc;
      }, {});

      // Format tokens for Edge
      const formattedTokens = tokens.map((token: any) => ({
        id: token.id,
        tokenName: token.tokenName,
        tokenValue: token.tokenValue,
        tokenType: token.tokenType,
        allowAllEnvironments: Boolean(token.allowAllEnvironments),
        environments: token.allowAllEnvironments ? ['*'] : (envByToken[token.id] || []),
        expiresAt: token.expiresAt ? new Date(token.expiresAt).toISOString() : null,
        createdAt: new Date(token.createdAt).toISOString(),
        updatedAt: new Date(token.updatedAt).toISOString()
      }));

      logger.info(`[InternalApiTokens] Edge fetched ${formattedTokens.length} tokens`);

      res.json({
        success: true,
        data: {
          tokens: formattedTokens,
          fetchedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching tokens for Edge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch tokens'
      });
    }
  }
}

export default new InternalApiTokensController();

