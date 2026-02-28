import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const logger = createLogger('ServiceAccountModel');

// Types
export interface ServiceAccount {
  id: string;
  name: string;
  email: string;
  status: string;
  authType: 'service-account';
  createdBy: string | null;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
  tokens: ServiceAccountToken[];
  permissions: string[];
  role: string;
  allowAllEnvironments: boolean;
  environments: string[];
}

export interface ServiceAccountToken {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

export interface CreateServiceAccountData {
  name: string;
  role?: string;
  permissions?: string[];
  allowAllEnvironments?: boolean;
  environments?: string[];
  createdBy: string;
}

export interface UpdateServiceAccountData {
  name?: string;
  role?: string;
  permissions?: string[];
  allowAllEnvironments?: boolean;
  environments?: string[];
  updatedBy: string;
}

export class ServiceAccountModel {
  private static readonly TABLE = 'g_users';
  private static readonly TOKENS_TABLE = 'g_service_account_tokens';

  /**
   * Create a new service account (as a special user with authType='service-account')
   */
  static async create(data: CreateServiceAccountData): Promise<ServiceAccount> {
    try {
      // Generate a unique email for the service account
      const uniqueId = crypto.randomBytes(4).toString('hex');
      const email = `sa-${uniqueId}@service-account.local`;

      const id = generateULID();

      await db(this.TABLE).insert({
        id,
        name: data.name,
        email,
        role: data.role || 'user',
        status: 'active',
        authType: 'service-account',
        emailVerified: true,
        allowAllEnvironments: data.allowAllEnvironments ?? false,
        createdBy: data.createdBy,
      });

      const { UserModel } = await import('./User');

      // Set environment access if provided
      if (!data.allowAllEnvironments && data.environments && data.environments.length > 0) {
        await UserModel.setEnvironmentAccess(id, false, data.environments, data.createdBy);
      }

      // Set permissions if provided
      if (data.permissions && data.permissions.length > 0) {
        await UserModel.setPermissions(id, data.permissions);
      }

      const account = await this.findById(id);
      if (!account) {
        throw new Error('Failed to create service account');
      }

      return account;
    } catch (error) {
      logger.error('Error creating service account:', error);
      throw error;
    }
  }

  /**
   * Find service account by ID
   */
  static async findById(id: string): Promise<ServiceAccount | null> {
    try {
      const row = await db(this.TABLE)
        .select([
          `${this.TABLE}.id`,
          `${this.TABLE}.name`,
          `${this.TABLE}.email`,
          `${this.TABLE}.status`,
          `${this.TABLE}.authType`,
          `${this.TABLE}.role`,
          `${this.TABLE}.allowAllEnvironments`,
          `${this.TABLE}.createdBy`,
          `${this.TABLE}.createdAt`,
          `${this.TABLE}.updatedAt`,
          'creator.name as createdByName',
        ])
        .leftJoin(`${this.TABLE} as creator`, `${this.TABLE}.createdBy`, 'creator.id')
        .where(`${this.TABLE}.id`, id)
        .where(`${this.TABLE}.authType`, 'service-account')
        .first();

      if (!row) return null;

      return this.enrichAccount(row);
    } catch (error) {
      logger.error('Error finding service account by ID:', error);
      throw error;
    }
  }

  /**
   * Find all service accounts
   */
  static async findAll(): Promise<ServiceAccount[]> {
    try {
      const rows = await db(this.TABLE)
        .select([
          `${this.TABLE}.id`,
          `${this.TABLE}.name`,
          `${this.TABLE}.email`,
          `${this.TABLE}.status`,
          `${this.TABLE}.authType`,
          `${this.TABLE}.role`,
          `${this.TABLE}.allowAllEnvironments`,
          `${this.TABLE}.createdBy`,
          `${this.TABLE}.createdAt`,
          `${this.TABLE}.updatedAt`,
          'creator.name as createdByName',
        ])
        .leftJoin(`${this.TABLE} as creator`, `${this.TABLE}.createdBy`, 'creator.id')
        .where(`${this.TABLE}.authType`, 'service-account')
        .orderBy(`${this.TABLE}.name`, 'asc');

      return Promise.all(rows.map((row: any) => this.enrichAccount(row)));
    } catch (error) {
      logger.error('Error finding all service accounts:', error);
      throw error;
    }
  }

  /**
   * Update a service account
   */
  static async update(id: string, data: UpdateServiceAccountData): Promise<ServiceAccount | null> {
    try {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.allowAllEnvironments !== undefined)
        updateData.allowAllEnvironments = data.allowAllEnvironments;
      updateData.updatedBy = data.updatedBy;
      updateData.updatedAt = db.fn.now();

      if (Object.keys(updateData).length > 1) {
        await db(this.TABLE)
          .where('id', id)
          .where('authType', 'service-account')
          .update(updateData);
      }

      const { UserModel } = await import('./User');

      // Update environment access if provided
      if (data.allowAllEnvironments !== undefined || data.environments !== undefined) {
        const allowAll =
          data.allowAllEnvironments ?? (await this.findById(id))?.allowAllEnvironments ?? false;
        const envs = data.environments ?? (await UserModel.getEnvironmentAccess(id)).environments;
        await UserModel.setEnvironmentAccess(id, allowAll, envs, data.updatedBy);
      }

      // Update permissions if provided
      if (data.permissions !== undefined) {
        await UserModel.setPermissions(id, data.permissions);
      }

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating service account:', error);
      throw error;
    }
  }

  /**
   * Delete a service account
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await db(this.TABLE)
        .where('id', id)
        .where('authType', 'service-account')
        .del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting service account:', error);
      throw error;
    }
  }

  /**
   * Create a new token for a service account
   * Returns the plain token (only shown once)
   */
  static async createToken(
    userId: string,
    name: string,
    createdBy: string,
    description?: string,
    expiresAt?: Date
  ): Promise<{ token: ServiceAccountToken; plainToken: string }> {
    try {
      // Generate a random token
      const plainToken = `gsa_${crypto.randomBytes(32).toString('hex')}`;
      const tokenHash = await bcrypt.hash(plainToken, 10);

      const id = generateULID();

      await db(this.TOKENS_TABLE).insert({
        id,
        userId,
        name,
        tokenHash,
        description: description || null,
        expiresAt: expiresAt || null,
        createdBy,
      });

      const token = await db(this.TOKENS_TABLE)
        .select(
          'id',
          'userId',
          'name',
          'description',
          'expiresAt',
          'lastUsedAt',
          'createdBy',
          'createdAt'
        )
        .where('id', id)
        .first();

      return { token, plainToken };
    } catch (error) {
      logger.error('Error creating service account token:', error);
      throw error;
    }
  }

  /**
   * Find tokens for a service account
   */
  static async findTokens(userId: string): Promise<ServiceAccountToken[]> {
    try {
      return db(this.TOKENS_TABLE)
        .select(
          'id',
          'userId',
          'name',
          'description',
          'expiresAt',
          'lastUsedAt',
          'createdBy',
          'createdAt'
        )
        .where('userId', userId)
        .orderBy('createdAt', 'desc');
    } catch (error) {
      logger.error('Error finding service account tokens:', error);
      throw error;
    }
  }

  /**
   * Delete a token
   */
  static async deleteToken(tokenId: string, userId: string): Promise<boolean> {
    try {
      const result = await db(this.TOKENS_TABLE).where('id', tokenId).where('userId', userId).del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting service account token:', error);
      throw error;
    }
  }

  /**
   * Verify a token and return the associated service account
   */
  static async verifyToken(plainToken: string): Promise<ServiceAccount | null> {
    try {
      const tokens = await db(this.TOKENS_TABLE).select('*');

      for (const token of tokens) {
        const isMatch = await bcrypt.compare(plainToken, token.tokenHash);
        if (isMatch) {
          // Check expiration
          if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
            return null;
          }

          // Update lastUsedAt
          await db(this.TOKENS_TABLE).where('id', token.id).update({ lastUsedAt: db.fn.now() });

          return this.findById(token.userId);
        }
      }

      return null;
    } catch (error) {
      logger.error('Error verifying service account token:', error);
      throw error;
    }
  }

  /**
   * Enrich a service account row with tokens and permissions
   */
  private static async enrichAccount(row: any): Promise<ServiceAccount> {
    const { UserModel } = await import('./User');
    const [tokens, permissions, envAccess] = await Promise.all([
      this.findTokens(row.id),
      db('g_user_permissions').select('permission').where('userId', row.id),
      UserModel.getEnvironmentAccess(row.id),
    ]);

    return {
      ...row,
      authType: 'service-account' as const,
      tokens,
      permissions: permissions.map((p: any) => p.permission),
      allowAllEnvironments: !!row.allowAllEnvironments,
      environments: envAccess.environments,
    };
  }
}

export default ServiceAccountModel;
