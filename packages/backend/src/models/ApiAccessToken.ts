import { Model } from 'objection';
import { User } from './User';
import { Environment } from './Environment';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ulid } from 'ulid';

export type TokenType = 'client' | 'server' | 'edge' | 'all';

export interface ApiAccessTokenData {
  id?: string; // ULID (26 characters)
  tokenName: string;
  description?: string;
  tokenValue: string;
  tokenType: TokenType;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount?: number;
  allowAllEnvironments: boolean;
  createdBy: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ApiAccessToken extends Model implements ApiAccessTokenData {
  static tableName = 'g_api_access_tokens';

  id!: string; // ULID
  tokenName!: string;
  description?: string;
  tokenValue!: string;
  tokenType!: TokenType;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount?: number;
  allowAllEnvironments!: boolean;
  createdBy!: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  environments?: Environment[];
  creator?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tokenName', 'tokenValue', 'tokenType', 'createdBy'],
      properties: {
        id: { type: 'string', minLength: 26, maxLength: 26 },
        tokenName: { type: 'string', minLength: 1, maxLength: 200 },
        tokenValue: { type: 'string', minLength: 1, maxLength: 255 },
        tokenType: { type: 'string', enum: ['client', 'server', 'edge', 'all'] },
        expiresAt: { type: ['string', 'object', 'null'], format: 'date-time' },
        lastUsedAt: { type: ['string', 'object', 'null'], format: 'date-time' },
        usageCount: { type: ['integer', 'null'], minimum: 0 },
        allowAllEnvironments: { type: 'boolean', default: true },
        createdBy: { type: 'integer' },
        createdAt: { type: ['string', 'object'], format: 'date-time' },
        updatedAt: { type: ['string', 'object'], format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      environments: {
        relation: Model.ManyToManyRelation,
        modelClass: Environment,
        join: {
          from: 'g_api_access_tokens.id',
          through: {
            from: 'g_api_access_token_environments.tokenId',
            to: 'g_api_access_token_environments.environmentId'
          },
          to: 'g_environments.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_api_access_tokens.createdBy',
          to: 'g_users.id'
        }
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_api_access_tokens.updatedBy',
          to: 'g_users.id'
        }
      }
    };
  }

  $beforeInsert() {
    if (!this.id) {
      this.id = ulid();
    }
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }

  $formatDatabaseJson(json: any) {
    json = super.$formatDatabaseJson(json);

    // Convert Date objects to ISO strings for MySQL
    if (json.lastUsedAt instanceof Date) {
      json.lastUsedAt = json.lastUsedAt.toISOString();
    }
    if (json.updatedAt instanceof Date) {
      json.updatedAt = json.updatedAt.toISOString();
    }
    if (json.createdAt instanceof Date) {
      json.createdAt = json.createdAt.toISOString();
    }
    if (json.expiresAt instanceof Date) {
      json.expiresAt = json.expiresAt.toISOString();
    }

    return json;
  }

  /**
   * Generate a new API token
   */
  static generateToken(): string {
    // Generate a secure random token
    const prefix = 'gatrix_';
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `${prefix}${randomBytes}`;
  }

  /**
   * Hash a token for storage
   */
  static async hashToken(token: string): Promise<string> {
    const saltRounds = 12;
    return await bcrypt.hash(token, saltRounds);
  }

  /**
   * Verify a token against stored value (plain text comparison)
   */
  static async verifyToken(token: string, storedTokenValue: string): Promise<boolean> {
    return token === storedTokenValue;
  }

  /**
   * Create new API access token
   */
  static async createToken(data: {
    tokenName: string;
    tokenType: TokenType;
    expiresAt?: Date;
    createdBy: number;
    allowAllEnvironments?: boolean;
  }): Promise<{ token: ApiAccessToken; plainToken: string }> {
    // Generate token
    const plainToken = this.generateToken();

    // Create token record (store plain token instead of hash)
    const token = await this.query().insert({
      tokenName: data.tokenName,
      tokenValue: plainToken, // Store plain token
      tokenType: data.tokenType,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy,
      allowAllEnvironments: data.allowAllEnvironments ?? true
    } as any);

    return { token, plainToken };
  }



  /**
   * Find token by plain text comparison
   */
  static async findByToken(token: string): Promise<ApiAccessToken | undefined> {
    // Direct database query for plain text token
    const tokenRecord = await this.query()
      .where('tokenValue', token)
      .where(builder => {
        builder.whereNull('expiresAt').orWhere('expiresAt', '>', new Date());
      })
      .withGraphFetched('environments')
      .first();

    return tokenRecord;
  }

  /**
   * Validate token and record usage (캐시 기반)
   */
  static async validateAndUse(token: string): Promise<ApiAccessToken | null> {
    const tokenRecord = await this.findByToken(token);

    if (!tokenRecord) {
      return null;
    }

    // 캐시 기반 ?�용??추적 (비동기로 처리?�여 API ?�답 ?�도???�향 ?�음)
    if (tokenRecord.id) {
      // ?�적 import�??�환 참조 방�?
      const { default: apiTokenUsageService } = await import('../services/ApiTokenUsageService');
      apiTokenUsageService.recordTokenUsage(tokenRecord.id).catch(error => {
        // ?�용??추적 ?�패가 API ?�청??방해?��? ?�도�?로그�??��?
        const logger = require('../config/logger').default;
        logger.error('Failed to record token usage:', error);
      });
    }

    return tokenRecord;
  }

  /**
   * Get tokens for environment
   */
  static async getForEnvironment(environmentId: string): Promise<ApiAccessToken[]> {
    const { default: knex } = await import('../config/knex');

    // Find tokens that have access to this environment
    const tokenIds = await knex('g_api_access_token_environments')
      .where('environmentId', environmentId)
      .select('tokenId');

    return await this.query()
      .whereIn('id', tokenIds.map(t => t.tokenId))
      .withGraphFetched('[creator(basicInfo), environments]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      })
      .orderBy('createdAt', 'desc');
  }

  /**
   * Get all admin tokens
   */
  static async getAdminTokens(): Promise<ApiAccessToken[]> {
    return await this.query()
      .where('tokenType', 'admin')
      .withGraphFetched('creator(basicInfo)')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      })
      .orderBy('createdAt', 'desc');
  }

  /**
   * Revoke token (delete it)
   */
  async revoke(): Promise<void> {
    await this.$query().delete();
  }

  /**
   * Extend token expiration
   */
  async extend(expiresAt: Date): Promise<ApiAccessToken> {
    return await this.$query().patchAndFetch({
      expiresAt,
      updatedAt: new Date()
    });
  }



  /**
   * Check if token is expired
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  /**
   * Check if token is valid
   */
  isValid(): boolean {
    return !this.isExpired();
  }

  /**
   * Get token usage statistics
   */
  async getUsageStats(): Promise<{
    totalRequests: number;
    lastUsed?: Date;
    daysActive: number;
  }> {
    // This would typically come from metrics/logs
    // For now, return basic info
    const daysActive = this.createdAt ? 
      Math.floor((new Date().getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

    return {
      totalRequests: 0, // Would be calculated from metrics
      lastUsed: this.lastUsedAt,
      daysActive
    };
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpired(): Promise<number> {
    const result = await this.query()
      .where('expiresAt', '<', new Date())
      .delete();

    return result;
  }

  /**
   * Get token summary (without sensitive data)
   */
  getSummary(): any {
    return {
      id: this.id,
      tokenName: this.tokenName,
      tokenType: this.tokenType,
      allowAllEnvironments: this.allowAllEnvironments,
      environments: this.environments,
      expiresAt: this.expiresAt,
      lastUsedAt: this.lastUsedAt,
      createdAt: this.createdAt,
      // Never include tokenHash in summary
    };
  }

  /**
   * Check if token has access to a specific environment
   */
  async hasEnvironmentAccess(environmentId: string): Promise<boolean> {
    // If allowAllEnvironments is true, token can access any environment
    if (this.allowAllEnvironments) {
      return true;
    }

    // If environments relation is already loaded, check it
    if (this.environments) {
      return this.environments.some(env => env.id === environmentId);
    }

    // Otherwise, query the database
    const db = Model.knex();
    const result = await db('g_api_access_token_environments')
      .where('tokenId', this.id)
      .where('environmentId', environmentId)
      .first();

    return !!result;
  }

  /**
   * Get all environment IDs that this token can access
   */
  async getAccessibleEnvironmentIds(): Promise<string[]> {
    if (this.allowAllEnvironments) {
      // Return all environment IDs
      const db = Model.knex();
      const environments = await db('g_environments').select('id');
      return environments.map((e: any) => e.id);
    }

    // Return only allowed environment IDs
    const db = Model.knex();
    const environments = await db('g_api_access_token_environments')
      .where('tokenId', this.id)
      .select('environmentId');
    return environments.map((e: any) => e.environmentId);
  }

  /**
   * Set allowed environments for this token
   */
  async setAllowedEnvironments(environmentIds: string[]): Promise<void> {
    const db = Model.knex();

    // Use transaction to ensure atomicity
    await db.transaction(async (trx) => {
      // Delete existing environment assignments
      await trx('g_api_access_token_environments')
        .where('tokenId', this.id)
        .delete();

      // Insert new environment assignments
      if (environmentIds.length > 0) {
        const insertData = environmentIds.map(envId => ({
          id: ulid(), // Generate ULID for each record
          tokenId: this.id,
          environmentId: envId,
        }));
        await trx('g_api_access_token_environments').insert(insertData);
      }

      // Update allowAllEnvironments flag
      await trx('g_api_access_tokens')
        .where('id', this.id)
        .update({ allowAllEnvironments: environmentIds.length === 0 });
    });
  }
}

export default ApiAccessToken;
