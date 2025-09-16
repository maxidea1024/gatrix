import knex from '../config/knex';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import { Request, Response } from 'express';

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
      const validSortFields = ['tokenName', 'tokenType', 'createdAt', 'lastUsedAt', 'expiresAt', 'creatorName'];
      const validSortOrders = ['asc', 'desc'];

      const finalSortBy = validSortFields.includes(sortBy as string) ? sortBy as string : 'createdAt';
      const finalSortOrder = validSortOrders.includes((sortOrder as string)?.toLowerCase())
        ? (sortOrder as string).toLowerCase() : 'desc';

      // Get tokens with pagination and sorting
      const tokens = await query
        .orderBy(finalSortBy === 'creatorName' ? 'creator.name' : `g_api_access_tokens.${finalSortBy}`, finalSortOrder)
        .limit(Number(limit))
        .offset(Number(offset));

      // Format tokens (include full token hash for copying)
      const formattedTokens = tokens.map((token: any) => {
        return {
          ...token,
          // Keep the full tokenHash for copying purposes
          tokenHash: token.tokenHash,
          creator: {
            name: token.creatorName || 'Unknown',
            email: token.creatorEmail || ''
          }
        };
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

      const { tokenName, description, tokenType, expiresAt } = req.body;
      const userId = (req as any).user.id;

      // Generate secure token
      const tokenValue = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

      // Insert token
      const [id] = await knex('g_api_access_tokens').insert({
        tokenName,
        description: description || null,
        tokenHash,
        tokenType,
        environmentId: null,
        expiresAt: expiresAt || null,
        createdBy: userId,
        updatedBy: userId,
        createdAt: knex.fn.now(),
        updatedAt: knex.fn.now()
      });

      // Return the new token with the actual token value (only shown once)
      res.status(201).json({
        success: true,
        data: {
          id,
          tokenName,
          tokenType,
          tokenValue, // Only shown once!
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
      const { tokenName, description, expiresAt } = req.body;
      const userId = (req as any).user.id;

      // Check if token exists
      const existingToken = await knex('g_api_access_tokens').where('id', id).first();
      if (!existingToken) {
        return res.status(404).json({
          success: false,
          error: { message: 'Token not found' }
        });
      }

      // Prepare update data
      const updateData: any = {
        updatedBy: userId,
        updatedAt: knex.fn.now()
      };

      if (tokenName !== undefined) updateData.tokenName = tokenName;
      if (description !== undefined) updateData.description = description;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;

      // Update token
      await knex('g_api_access_tokens')
        .where('id', id)
        .update(updateData);

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

      // Format response
      const formattedToken = {
        ...updatedToken,
        tokenHash: updatedToken.tokenHash.substring(0, 8) + '••••••••••••••••',
        creator: {
          name: updatedToken.creatorName || 'Unknown',
          email: updatedToken.creatorEmail || ''
        }
      };

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

      // Generate new token value
      const tokenValue = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

      // Update token with new hash
      await knex('g_api_access_tokens')
        .where('id', id)
        .update({
          tokenHash,
          updatedBy: userId,
          updatedAt: knex.fn.now()
        });

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

      // Delete token
      await knex('g_api_access_tokens').where('id', id).del();

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
