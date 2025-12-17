import knex from '../config/knex';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import { Request, Response } from 'express';
import { ulid } from 'ulid';
import { pubSubService } from '../services/PubSubService';
import logger from '../config/logger';

class ApiTokensController {
  /**
   * Get all API tokens with pagination and filters
   */
  async getTokens(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10, tokenType, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      // Build query with user join
      let query = knex('g_api_access_tokens')
        .select(
          'g_api_access_tokens.*',
          'creator.name as creatorName',
          'creator.email as creatorEmail'
        )
        .leftJoin('g_users as creator', 'g_api_access_tokens.createdBy', 'creator.id');

      if (tokenType) {
        query = query.where('tokenType', tokenType);
      }

      if (search) {
        query = query.where('tokenName', 'like', `%${search}%`);
      }

      // Get total count (separate query)
      let countQuery = knex('g_api_access_tokens');

      if (tokenType) {
        countQuery = countQuery.where('tokenType', tokenType);
      }

      if (search) {
        countQuery = countQuery.where('tokenName', 'like', `%${search}%`);
      }

      const [{ count: total }] = await countQuery.count('* as count');

      // Validate and apply sorting
      const validSortFields = ['tokenName', 'tokenType', 'createdAt', 'lastUsedAt', 'usageCount', 'expiresAt', 'creatorName'];
      const validSortOrders = ['asc', 'desc'];

      const finalSortBy = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
      const finalSortOrder = validSortOrders.includes((sortOrder as string)?.toLowerCase())
        ? (sortOrder as string).toLowerCase() : 'desc';

      // Get tokens with pagination and sorting
      const tokens = await query
        .orderBy(finalSortBy === 'creatorName' ? 'creator.name' : `g_api_access_tokens.${finalSortBy}`, finalSortOrder)
        .limit(Number(limit))
        .offset(Number(offset));

      // Get environment assignments for each token (only IDs - frontend has environment list)
      const tokenIds = tokens.map((t: any) => t.id);
      const environmentAssignments = tokenIds.length > 0
        ? await knex('g_api_access_token_environments')
          .whereIn('tokenId', tokenIds)
          .select('tokenId', 'environmentId')
        : [];

      // Group environment IDs by token
      const envByToken = environmentAssignments.reduce((acc: any, env: any) => {
        if (!acc[env.tokenId]) acc[env.tokenId] = [];
        acc[env.tokenId].push(env.environmentId);
        return acc;
      }, {});

      // Format tokens (mask token for display, keep original for copying)
      const formattedTokens = tokens.map((token: any) => {
        // Mask the token: show first 4 and last 4 characters
        const maskedToken = token.tokenValue && token.tokenValue.length > 8
          ? `${token.tokenValue.substring(0, 4)}${'•'.repeat(token.tokenValue.length - 8)}${token.tokenValue.substring(token.tokenValue.length - 4)}`
          : token.tokenValue;

        const formatted = {
          ...token,
          // Keep original tokenValue for copying
          // Add maskedTokenValue for display
          maskedTokenValue: maskedToken,
          allowAllEnvironments: Boolean(token.allowAllEnvironments),
          environmentIds: envByToken[token.id] || [],
          creator: {
            name: token.creatorName || 'Unknown',
            email: token.creatorEmail || ''
          }
        };

        return formatted;
      });

      const responseData = {
        success: true,
        data: {
          tokens: formattedTokens,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(Number(total) / Number(limit))
          }
        }
      };

      res.json(responseData);
    } catch (error) {
      console.error('Error fetching API tokens:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch API tokens' }
      });
    }
  }

  /**
   * Create new API token
   */
  async createToken(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: { message: 'Validation failed', details: errors.array() }
        });
      }

      const { tokenName, description, tokenType, expiresAt, allowAllEnvironments = true, environmentIds = [] } = req.body;
      const userId = (req as any).user.id;

      // Generate secure token (store as plain text)
      const tokenValue = crypto.randomBytes(32).toString('hex');

      // Generate ULID for the token
      const tokenId = ulid();

      // Use transaction for atomicity
      const result = await knex.transaction(async (trx) => {
        // Insert token (store plain text)
        await trx('g_api_access_tokens').insert({
          id: tokenId,
          tokenName,
          description: description || null,
          tokenValue: tokenValue, // Store plain token value
          tokenType,
          allowAllEnvironments: allowAllEnvironments,
          expiresAt: expiresAt || null,
          createdBy: userId,
          updatedBy: userId,
          createdAt: trx.fn.now(),
          updatedAt: trx.fn.now()
        });

        // If not allowing all environments, insert environment assignments
        if (!allowAllEnvironments && environmentIds.length > 0) {
          const envInserts = environmentIds.map((envId: string) => ({
            id: ulid(), // Generate ULID for each record
            tokenId: tokenId,
            environmentId: envId,
          }));
          await trx('g_api_access_token_environments').insert(envInserts);
        }

        return { id: tokenId };
      });

      // Publish token created event for Edge mirroring
      try {
        await pubSubService.publishSDKEvent({
          type: 'api_token.created',
          data: {
            id: result.id,
            tokenType,
            allowAllEnvironments,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish api_token.created event', { eventError });
      }

      // Return the new token with the actual token value (only shown once)
      res.status(201).json({
        success: true,
        data: {
          id: result.id,
          tokenName,
          tokenType,
          tokenValue, // Only shown once!
          allowAllEnvironments,
          environmentIds: allowAllEnvironments ? [] : environmentIds,
          expiresAt,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error creating API token:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to create API token' }
      });
    }
  }

  /**
   * Update API token
   */
  async updateToken(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tokenName, description, expiresAt, allowAllEnvironments, environmentIds } = req.body;
      const userId = (req as any).user.id;

      // Check if token exists
      const existingToken = await knex('g_api_access_tokens').where('id', id).first();
      if (!existingToken) {
        return res.status(404).json({
          success: false,
          error: { message: 'Token not found' }
        });
      }

      // Use transaction for atomicity
      await knex.transaction(async (trx) => {
        // Prepare update data
        const updateData: any = {
          updatedBy: userId,
          updatedAt: trx.fn.now()
        };

        if (tokenName !== undefined) updateData.tokenName = tokenName;
        if (description !== undefined) updateData.description = description;
        if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
        if (allowAllEnvironments !== undefined) updateData.allowAllEnvironments = allowAllEnvironments;

        // Update token
        await trx('g_api_access_tokens')
          .where('id', id)
          .update(updateData);

        // Update environment assignments if provided
        if (environmentIds !== undefined) {
          // Delete existing assignments
          await trx('g_api_access_token_environments')
            .where('tokenId', id)
            .delete();

          // Insert new assignments
          if (!allowAllEnvironments && environmentIds.length > 0) {
            const envInserts = environmentIds.map((envId: string) => ({
              id: ulid(), // Generate ULID for each record
              tokenId: id,
              environmentId: envId,
            }));
            await trx('g_api_access_token_environments').insert(envInserts);
          }
        }
      });

      // Get updated token with user info
      const updatedToken = await knex('g_api_access_tokens')
        .select(
          'g_api_access_tokens.*',
          'creator.name as creatorName',
          'creator.email as creatorEmail'
        )
        .leftJoin('g_users as creator', 'g_api_access_tokens.createdBy', 'creator.id')
        .where('g_api_access_tokens.id', id)
        .first();

      // Get environment IDs only (frontend has environment list)
      const envAssignments = await knex('g_api_access_token_environments')
        .where('tokenId', id)
        .select('environmentId');

      // Format response
      const formattedToken = {
        ...updatedToken,
        maskedTokenValue: updatedToken.tokenValue?.substring(0, 4) + '••••••••' + updatedToken.tokenValue?.substring(updatedToken.tokenValue.length - 4),
        allowAllEnvironments: Boolean(updatedToken.allowAllEnvironments),
        environmentIds: envAssignments.map((e: any) => e.environmentId),
        creator: {
          name: updatedToken.creatorName || 'Unknown',
          email: updatedToken.creatorEmail || ''
        }
      };

      // Invalidate token cache (use token value prefix for cache key)
      // Cache key format: api_token:{first 16 chars}... or server_api_token:{first 16 chars}...
      if (existingToken.tokenValue) {
        const tokenPrefix = existingToken.tokenValue.substring(0, 16);
        await pubSubService.invalidateByPattern(`api_token:${tokenPrefix}.*`);
        await pubSubService.invalidateByPattern(`server_api_token:${tokenPrefix}.*`);
      }

      // Publish token updated event for Edge mirroring
      try {
        await pubSubService.publishSDKEvent({
          type: 'api_token.updated',
          data: {
            id,
            tokenType: updatedToken.tokenType,
            allowAllEnvironments: Boolean(updatedToken.allowAllEnvironments),
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish api_token.updated event', { eventError });
      }

      res.json({
        success: true,
        data: {
          token: formattedToken
        }
      });
    } catch (error) {
      console.error('Error updating API token:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to update API token' }
      });
    }
  }

  /**
   * Regenerate API token (creates new token value)
   */
  async regenerateToken(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;

      // Check if token exists
      const existingToken = await knex('g_api_access_tokens').where('id', id).first();
      if (!existingToken) {
        return res.status(404).json({
          success: false,
          error: { message: 'Token not found' }
        });
      }

      // Generate new token value (store as plain text)
      const tokenValue = crypto.randomBytes(32).toString('hex');

      // Update token with new plain token value
      await knex('g_api_access_tokens')
        .where('id', id)
        .update({
          tokenValue: tokenValue, // Store plain token value
          updatedBy: userId,
          updatedAt: knex.fn.now()
        });

      // Invalidate OLD token cache (the old tokenValue is no longer valid)
      if (existingToken.tokenValue) {
        const oldTokenPrefix = existingToken.tokenValue.substring(0, 16);
        await pubSubService.invalidateByPattern(`api_token:${oldTokenPrefix}.*`);
        await pubSubService.invalidateByPattern(`server_api_token:${oldTokenPrefix}.*`);
      }

      // Publish token updated event for Edge mirroring (regenerate = token value changed)
      try {
        await pubSubService.publishSDKEvent({
          type: 'api_token.updated',
          data: {
            id,
            tokenType: existingToken.tokenType,
            regenerated: true,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish api_token.updated event for regenerate', { eventError });
      }

      // Return the new token with the actual token value (only shown once)
      res.json({
        success: true,
        data: {
          id: Number(id),
          tokenName: existingToken.tokenName,
          tokenType: existingToken.tokenType,
          tokenValue, // Only shown once!
          expiresAt: existingToken.expiresAt,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error regenerating API token:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to regenerate API token' }
      });
    }
  }

  /**
   * Delete API token
   */
  async deleteToken(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // Check if token exists
      const existingToken = await knex('g_api_access_tokens')
        .where('id', id)
        .first();

      if (!existingToken) {
        return res.status(404).json({
          success: false,
          error: { message: 'API token not found' }
        });
      }

      // Invalidate token cache BEFORE deletion
      if (existingToken.tokenValue) {
        const tokenPrefix = existingToken.tokenValue.substring(0, 16);
        await pubSubService.invalidateByPattern(`api_token:${tokenPrefix}.*`);
        await pubSubService.invalidateByPattern(`server_api_token:${tokenPrefix}.*`);
      }

      // Use transaction to delete token and its environment assignments
      await knex.transaction(async (trx) => {
        // Delete environment assignments first
        await trx('g_api_access_token_environments').where('tokenId', id).delete();
        // Delete token
        await trx('g_api_access_tokens').where('id', id).delete();
      });

      // Publish token deleted event for Edge mirroring
      try {
        await pubSubService.publishSDKEvent({
          type: 'api_token.deleted',
          data: {
            id,
            tokenType: existingToken.tokenType,
            timestamp: Date.now()
          }
        });
      } catch (eventError) {
        logger.warn('Failed to publish api_token.deleted event', { eventError });
      }

      res.json({
        success: true,
        message: 'API token deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting API token:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to delete API token' }
      });
    }
  }

  /**
   * Get token statistics
   */
  async getTokenStats(req: Request, res: Response) {
    try {
      // Get total tokens
      const [{ count: totalTokens }] = await knex('g_api_access_tokens').count('* as count');

      // Get all tokens (no isActive filter needed)
      const [{ count: activeTokens }] = await knex('g_api_access_tokens')
        .count('* as count');

      // Get expired tokens
      const [{ count: expiredTokens }] = await knex('g_api_access_tokens')
        .whereNotNull('expiresAt')
        .where('expiresAt', '<', knex.fn.now())
        .count('* as count');

      // Get recently used tokens (last 7 days)
      const [{ count: recentlyUsed }] = await knex('g_api_access_tokens')
        .where('lastUsedAt', '>=', knex.raw('DATE_SUB(NOW(), INTERVAL 7 DAY)'))
        .count('* as count');

      res.json({
        success: true,
        data: {
          totalTokens,
          activeTokens,
          expiredTokens,
          recentlyUsed
        }
      });
    } catch (error) {
      console.error('Error fetching token stats:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch token statistics' }
      });
    }
  }
}

export default new ApiTokensController();
