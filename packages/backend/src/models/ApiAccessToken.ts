import { Model } from 'objection';
import { User } from './User';
import { RemoteConfigEnvironment } from './RemoteConfigEnvironment';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

export type TokenType = 'client' | 'server' | 'admin';

export interface ApiAccessTokenData {
  id?: number;
  tokenName: string;
  description?: string;
  tokenHash: string;
  tokenType: TokenType;
  environmentId?: number;
  permissions: string[];
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdBy: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ApiAccessToken extends Model implements ApiAccessTokenData {
  static tableName = 'g_api_access_tokens';

  id!: number;
  tokenName!: string;
  description?: string;
  tokenHash!: string;
  tokenType!: TokenType;
  environmentId?: number;
  permissions!: string[];
  isActive!: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdBy!: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;

  // Relations
  environment?: RemoteConfigEnvironment;
  creator?: User;

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['tokenName', 'tokenHash', 'tokenType', 'permissions', 'createdBy'],
      properties: {
        id: { type: 'integer' },
        tokenName: { type: 'string', minLength: 1, maxLength: 200 },
        tokenHash: { type: 'string', minLength: 1, maxLength: 255 },
        tokenType: { type: 'string', enum: ['client', 'server', 'admin'] },
        environmentId: { type: ['integer', 'null'] },
        permissions: { type: 'array', items: { type: 'string' } },
        isActive: { type: 'boolean' },
        expiresAt: { type: ['string', 'null'], format: 'date-time' },
        lastUsedAt: { type: ['string', 'null'], format: 'date-time' },
        createdBy: { type: 'integer' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    };
  }

  static get relationMappings() {
    return {
      environment: {
        relation: Model.BelongsToOneRelation,
        modelClass: RemoteConfigEnvironment,
        join: {
          from: 'g_api_access_tokens.environmentId',
          to: 'g_remote_config_environments.id'
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
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
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
   * Verify a token against its hash
   */
  static async verifyToken(token: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(token, hash);
  }

  /**
   * Create new API access token
   */
  static async createToken(data: {
    tokenName: string;
    tokenType: TokenType;
    environmentId?: number;
    permissions: string[];
    expiresAt?: Date;
    createdBy: number;
  }): Promise<{ token: ApiAccessToken; plainToken: string }> {
    // Validate token type and environment
    if (data.tokenType !== 'admin' && !data.environmentId) {
      throw new Error('Client and server tokens must be associated with an environment');
    }

    if (data.tokenType === 'admin' && data.environmentId) {
      throw new Error('Admin tokens cannot be associated with a specific environment');
    }

    // Generate token
    const plainToken = this.generateToken();
    const tokenHash = await this.hashToken(plainToken);

    // Set default permissions based on token type
    const permissions = data.permissions.length > 0 ? data.permissions : this.getDefaultPermissions(data.tokenType);

    // Create token record
    const token = await this.query().insert({
      tokenName: data.tokenName,
      tokenHash,
      tokenType: data.tokenType,
      environmentId: data.environmentId,
      permissions,
      isActive: true,
      expiresAt: data.expiresAt,
      createdBy: data.createdBy
    });

    return { token, plainToken };
  }

  /**
   * Get default permissions for token type
   */
  static getDefaultPermissions(tokenType: TokenType): string[] {
    switch (tokenType) {
      case 'client':
        return ['remote_config:read', 'metrics:write'];
      case 'server':
        return ['remote_config:read', 'remote_config:evaluate', 'metrics:write'];
      case 'admin':
        return ['remote_config:*', 'environments:*', 'tokens:*', 'metrics:*'];
      default:
        return [];
    }
  }

  /**
   * Find token by hash
   */
  static async findByToken(token: string): Promise<ApiAccessToken | undefined> {
    // Get all active tokens and verify against each hash
    const tokens = await this.query()
      .where('isActive', true)
      .where(builder => {
        builder.whereNull('expiresAt').orWhere('expiresAt', '>', new Date());
      })
      .withGraphFetched('environment');

    for (const tokenRecord of tokens) {
      if (await this.verifyToken(token, tokenRecord.tokenHash)) {
        return tokenRecord;
      }
    }

    return undefined;
  }

  /**
   * Validate token and update last used
   */
  static async validateAndUse(token: string): Promise<ApiAccessToken | null> {
    const tokenRecord = await this.findByToken(token);
    
    if (!tokenRecord) {
      return null;
    }

    // Update last used timestamp
    await tokenRecord.$query().patch({
      lastUsedAt: new Date(),
      updatedAt: new Date()
    });

    return tokenRecord;
  }

  /**
   * Get tokens for environment
   */
  static async getForEnvironment(environmentId: number): Promise<ApiAccessToken[]> {
    return await this.query()
      .where('environmentId', environmentId)
      .where('isActive', true)
      .withGraphFetched('creator(basicInfo)')
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
      .where('isActive', true)
      .withGraphFetched('creator(basicInfo)')
      .modifiers({
        basicInfo: (builder) => builder.select('id', 'username', 'email')
      })
      .orderBy('createdAt', 'desc');
  }

  /**
   * Revoke token
   */
  async revoke(): Promise<ApiAccessToken> {
    return await this.$query().patchAndFetch({
      isActive: false,
      updatedAt: new Date()
    });
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
   * Check if token has permission
   */
  hasPermission(permission: string): boolean {
    // Admin tokens have all permissions
    if (this.tokenType === 'admin') {
      return true;
    }

    // Check for wildcard permissions
    for (const perm of this.permissions) {
      if (perm.endsWith(':*')) {
        const prefix = perm.slice(0, -1); // Remove the *
        if (permission.startsWith(prefix)) {
          return true;
        }
      } else if (perm === permission) {
        return true;
      }
    }

    return false;
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
    return this.isActive && !this.isExpired();
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
      .where('isActive', true)
      .where('expiresAt', '<', new Date())
      .patch({ isActive: false });

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
      permissions: this.permissions,
      isActive: this.isActive,
      expiresAt: this.expiresAt,
      lastUsedAt: this.lastUsedAt,
      createdAt: this.createdAt,
      // Never include tokenHash in summary
    };
  }
}

export default ApiAccessToken;
