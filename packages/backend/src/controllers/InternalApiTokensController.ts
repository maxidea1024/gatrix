import { Response } from 'express';
import { SDKRequest } from '../middleware/apiTokenAuth';
import knex from '../config/knex';
import logger from '../config/logger';
import apiTokenUsageService from '../services/ApiTokenUsageService';

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
          .select('tokenId', 'environment')
        : [];

      // Group environment names by token
      const envByToken = environmentAssignments.reduce((acc: any, env: any) => {
        if (!acc[env.tokenId]) acc[env.tokenId] = [];
        acc[env.tokenId].push(env.environment);
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

  /**
   * Receive token usage report from Edge servers
   * Aggregates usage data and updates database
   *
   * POST /api/v1/server/internal/token-usage-report
   */
  async receiveUsageReport(req: SDKRequest, res: Response) {
    try {
      // Only allow Edge bypass token to access this endpoint
      if (!req.isEdgeBypassToken) {
        return res.status(403).json({
          success: false,
          message: 'This endpoint is only accessible with Edge bypass token'
        });
      }

      const { edgeInstanceId, usageData, reportedAt } = req.body;

      if (!edgeInstanceId || !Array.isArray(usageData)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request body: edgeInstanceId and usageData are required'
        });
      }

      logger.info(`[InternalApiTokens] Received usage report from Edge`, {
        edgeInstanceId,
        tokenCount: usageData.length,
        reportedAt
      });

      // Process each token's usage
      let processedCount = 0;
      for (const usage of usageData) {
        const { tokenId, usageCount } = usage;

        if (!tokenId || typeof usageCount !== 'number') {
          logger.warn('[InternalApiTokens] Invalid usage entry:', usage);
          continue;
        }

        try {
          // Record usage for each count (batch recording)
          for (let i = 0; i < usageCount; i++) {
            await apiTokenUsageService.recordTokenUsage(tokenId);
          }
          processedCount++;
        } catch (error) {
          logger.error(`[InternalApiTokens] Failed to record usage for token ${tokenId}:`, error);
        }
      }

      logger.info(`[InternalApiTokens] Processed usage report`, {
        edgeInstanceId,
        processedCount,
        totalTokens: usageData.length
      });

      res.json({
        success: true,
        data: {
          processedCount,
          receivedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error receiving usage report from Edge:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process usage report'
      });
    }
  }
}

export default new InternalApiTokensController();

