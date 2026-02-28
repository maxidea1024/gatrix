import { Model } from 'objection';
import { User } from './User';
import { Environment } from './Environment';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ulid } from 'ulid';

export type TokenType = 'client' | 'server' | 'edge' | 'all';

export interface ApiAccessTokenData {
  id?: string; // ULID (26 characters)
  projectId?: string;
  environmentId?: string;
  tokenName: string;
  description?: string;
  tokenValue: string;
  tokenType: TokenType;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount?: number;
  createdBy: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ApiAccessToken extends Model implements ApiAccessTokenData {
  static tableName = 'g_api_access_tokens';

  id!: string; // ULID
  projectId?: string;
  environmentId?: string;
  tokenName!: string;
  description?: string;
  tokenValue!: string;
  tokenType!: TokenType;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount?: number;
  createdBy!: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  environment?: Environment;
  creator?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tokenName', 'tokenValue', 'tokenType', 'createdBy'],
      properties: {
        id: { type: 'string', minLength: 26, maxLength: 26 },
        tokenName: { type: 'string', minLength: 1, maxLength: 200 },
        tokenValue: { type: 'string', minLength: 1, maxLength: 255 },
        tokenType: {
          type: 'string',
          enum: ['client', 'server', 'edge', 'all'],
        },
        expiresAt: { type: ['string', 'object', 'null'], format: 'date-time' },
        lastUsedAt: { type: ['string', 'object', 'null'], format: 'date-time' },
        usageCount: { type: ['integer', 'null'], minimum: 0 },
        environmentId: { type: ['string', 'null'], maxLength: 50 },
        createdBy: { type: 'integer' },
        createdAt: { type: ['string', 'object'], format: 'date-time' },
        updatedAt: { type: ['string', 'object'], format: 'date-time' },
      },
    };
  }

  static get relationMappings() {
    return {
      environment: {
        relation: Model.BelongsToOneRelation,
        modelClass: Environment,
        join: {
          from: 'g_api_access_tokens.environmentId',
          to: 'g_environments.environmentId',
        },
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_api_access_tokens.createdBy',
          to: 'g_users.id',
        },
      },
      updater: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'g_api_access_tokens.updatedBy',
          to: 'g_users.id',
        },
      },
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
    createdBy: string;
    environmentId?: string;
  }): Promise<{ token: ApiAccessToken; plainToken: string }> {
    // Generate token
    const plainToken = this.generateToken();

    // Create token record (store plain token instead of hash)
    const token = await this.query().insert({
      tokenName: data.tokenName,
      tokenValue: plainToken,
      tokenType: data.tokenType,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy,
      environmentId: data.environmentId,
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
      .where((builder) => {
        builder.whereNull('expiresAt').orWhere('expiresAt', '>', new Date());
      })
      .withGraphFetched('environment')
      .first();

    return tokenRecord;
  }

  /**
   * Validate token and record usage (cache-based)
   */
  static async validateAndUse(token: string): Promise<ApiAccessToken | null> {
    const tokenRecord = await this.findByToken(token);

    if (!tokenRecord) {
      return null;
    }

    // Cache-based usage tracking (async to avoid impacting API response speed)
    if (tokenRecord.id) {
      // Dynamic import to avoid circular references
      const { default: apiTokenUsageService } = await import('../services/ApiTokenUsageService');
      apiTokenUsageService.recordTokenUsage(tokenRecord.id).catch((error) => {
        // Usage tracking failure should not block API requests, just log it
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
    return await this.query()
      .where('environmentId', environmentId)
      .withGraphFetched('[creator(basicInfo), environment]')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email'),
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
        basicInfo: (builder) => builder.select('id', 'username', 'email'),
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
      updatedAt: new Date(),
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
    const daysActive = this.createdAt
      ? Math.floor((new Date().getTime() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalRequests: 0, // Would be calculated from metrics
      lastUsed: this.lastUsedAt,
      daysActive,
    };
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpired(): Promise<number> {
    const result = await this.query().where('expiresAt', '<', new Date()).delete();

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
      environmentId: this.environmentId,
      environment: this.environment,
      expiresAt: this.expiresAt,
      lastUsedAt: this.lastUsedAt,
      createdAt: this.createdAt,
    };
  }

  /**
   * Check if token has access to a specific environment
   */
  hasEnvironmentAccess(environmentId: string): boolean {
    return this.environmentId === environmentId;
  }
}

export default ApiAccessToken;
