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
      const { page = 1, limit = 10, tokenType, isActive, search } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      // Build query
      let query = knex('g_api_access_tokens').select('*');

      if (tokenType) {
        query = query.where('tokenType', tokenType);
      }

      if (isActive !== undefined) {
        query = query.where('isActive', isActive === 'true' ? 1 : 0);
      }

      if (search) {
        query = query.where('tokenName', 'like', `%${search}%`);
      }

      // Get total count (separate query)
      let countQuery = knex('g_api_access_tokens');

      if (tokenType) {
        countQuery = countQuery.where('tokenType', tokenType);
      }

      if (isActive !== undefined) {
        countQuery = countQuery.where('isActive', isActive === 'true' ? 1 : 0);
      }

      if (search) {
        countQuery = countQuery.where('tokenName', 'like', `%${search}%`);
      }

      const [{ count: total }] = await countQuery.count('* as count');

      // Get tokens with pagination (separate query)
      const tokens = await query
        .orderBy('createdAt', 'desc')
        .limit(Number(limit))
        .offset(Number(offset));

      // Format tokens (hide sensitive data)
      const formattedTokens = tokens.map((token: any) => {
        let permissions = [];

        // Handle different permission formats
        if (typeof token.permissions === 'string') {
          try {
            // Try to parse as JSON first
            permissions = JSON.parse(token.permissions);
          } catch (e) {
            // If JSON parse fails, treat as comma-separated string
            permissions = token.permissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
          }
        } else if (Array.isArray(token.permissions)) {
          permissions = token.permissions;
        } else {
          permissions = [];
        }

        return {
          ...token,
          tokenHash: token.tokenHash.substring(0, 8) + '••••••••••••••••', // Show only first 8 chars
          permissions,
          isActive: Boolean(token.isActive)
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

      const { tokenName, description, tokenType, permissions, expiresAt } = req.body;
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
        permissions: JSON.stringify(permissions || []),
        isActive: true,
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
          permissions,
          isActive: true,
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
          permissions: JSON.parse(existingToken.permissions || '[]'),
          isActive: existingToken.isActive,
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

      // Get active tokens
      const [{ count: activeTokens }] = await knex('g_api_access_tokens')
        .where('isActive', 1)
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
