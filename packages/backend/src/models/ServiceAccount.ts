import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import crypto from 'crypto';

const logger = createLogger('ServiceAccountModel');

/**
 * g_service_account_tokens schema (after migration 013):
 *   id CHAR(26) PK
 *   serviceAccountId CHAR(26) NOT NULL -> FK g_users(id)
 *   name VARCHAR(255)
 *   description TEXT
 *   tokenValue VARCHAR(255) UNIQUE
 *   isActive BOOLEAN
 *   expiresAt TIMESTAMP
 *   lastUsedAt TIMESTAMP
 *   createdBy CHAR(26)
 *   createdAt TIMESTAMP
 *   updatedAt TIMESTAMP
 */

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
}

export interface ServiceAccountToken {
  id: string;
  serviceAccountId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

export interface CreateServiceAccountData {
  name: string;
  createdBy: string;
}

export interface UpdateServiceAccountData {
  name?: string;
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
        status: 'active',
        authType: 'service-account',
        emailVerified: true,
        createdBy: data.createdBy,
      });

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
      updateData.updatedBy = data.updatedBy;
      updateData.updatedAt = db.fn.now();

      if (Object.keys(updateData).length > 1) {
        await db(this.TABLE)
          .where('id', id)
          .where('authType', 'service-account')
          .update(updateData);
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
   * Create a new token for a service account.
   * Tokens are stored as plain values in the tokenValue column.
   */
  static async createToken(
    serviceAccountId: string,
    name: string,
    createdBy: string,
    description?: string,
    expiresAt?: Date
  ): Promise<{ token: ServiceAccountToken; plainToken: string }> {
    try {
      const plainToken = `gsa_${crypto.randomBytes(32).toString('hex')}`;
      const id = generateULID();

      await db(this.TOKENS_TABLE).insert({
        id,
        serviceAccountId,
        name,
        tokenValue: plainToken,
        description: description || null,
        isActive: true,
        expiresAt: expiresAt || null,
        createdBy,
      });

      const token = await db(this.TOKENS_TABLE)
        .select(
          'id',
          'serviceAccountId',
          'name',
          'description',
          'isActive',
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
  static async findTokens(serviceAccountId: string): Promise<ServiceAccountToken[]> {
    try {
      return db(this.TOKENS_TABLE)
        .select(
          'id',
          'serviceAccountId',
          'name',
          'description',
          'isActive',
          'expiresAt',
          'lastUsedAt',
          'createdBy',
          'createdAt'
        )
        .where('serviceAccountId', serviceAccountId)
        .where('isActive', true)
        .orderBy('createdAt', 'desc');
    } catch (error) {
      logger.error('Error finding service account tokens:', error);
      throw error;
    }
  }

  /**
   * Delete a token (soft-delete by setting isActive = false)
   */
  static async deleteToken(tokenId: string, serviceAccountId: string): Promise<boolean> {
    try {
      const result = await db(this.TOKENS_TABLE)
        .where('id', tokenId)
        .where('serviceAccountId', serviceAccountId)
        .update({ isActive: false });
      return result > 0;
    } catch (error) {
      logger.error('Error deleting service account token:', error);
      throw error;
    }
  }

  /**
   * Verify a token and return the associated service account.
   * Token lookup is a direct value comparison (not hashed).
   * The service account's permissions come from RBAC roles.
   */
  static async verifyToken(plainToken: string): Promise<ServiceAccount | null> {
    try {
      const token = await db(this.TOKENS_TABLE)
        .where('tokenValue', plainToken)
        .where('isActive', true)
        .first();

      if (!token) return null;

      // Check expiration
      if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
        return null;
      }

      // Update lastUsedAt
      await db(this.TOKENS_TABLE).where('id', token.id).update({ lastUsedAt: db.fn.now() });

      return this.findById(token.serviceAccountId);
    } catch (error) {
      logger.error('Error verifying service account token:', error);
      throw error;
    }
  }

  /**
   * Enrich a service account row with tokens
   */
  private static async enrichAccount(row: any): Promise<ServiceAccount> {
    const tokens = await this.findTokens(row.id);

    return {
      ...row,
      authType: 'service-account' as const,
      tokens,
    };
  }
}

export default ServiceAccountModel;
