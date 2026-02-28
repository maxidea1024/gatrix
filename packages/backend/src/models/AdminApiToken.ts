import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import crypto from 'crypto';

const logger = createLogger('AdminApiToken');

// ==================== Types ====================

export interface AdminApiTokenRecord {
  id: string;
  orgId: string;
  tokenName: string;
  tokenValue: string;
  description: string | null;
  roleId: string | null;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAdminTokenData {
  orgId: string;
  tokenName: string;
  description?: string;
  roleId?: string;
  expiresAt?: Date;
  createdBy: string;
}

// ==================== Model ====================

export class AdminApiToken {
  private static readonly TABLE = 'g_admin_api_tokens';

  /**
   * Generate a prefixed admin token: gx_admin_xxx
   */
  static generateTokenValue(): string {
    const random = crypto.randomBytes(32).toString('base64url');
    return `gx_admin_${random}`;
  }

  /**
   * Create a new admin API token
   */
  static async create(
    data: CreateAdminTokenData
  ): Promise<{ token: AdminApiTokenRecord; plainToken: string }> {
    const id = generateULID();
    const tokenValue = this.generateTokenValue();

    await db(this.TABLE).insert({
      id,
      orgId: data.orgId,
      tokenName: data.tokenName,
      tokenValue,
      description: data.description || null,
      roleId: data.roleId || null,
      expiresAt: data.expiresAt || null,
      createdBy: data.createdBy,
    });

    const token = await this.findById(id);
    if (!token) throw new Error('Failed to create admin API token');

    return { token, plainToken: tokenValue };
  }

  static async findById(id: string): Promise<AdminApiTokenRecord | null> {
    const row = await db(this.TABLE).where('id', id).first();
    return row || null;
  }

  /**
   * Find active token by its value (for auth)
   */
  static async findByTokenValue(tokenValue: string): Promise<AdminApiTokenRecord | null> {
    const row = await db(this.TABLE).where('tokenValue', tokenValue).first();
    if (!row) return null;

    // Check expiration
    if (row.expiresAt && new Date() > new Date(row.expiresAt)) {
      return null;
    }

    return row;
  }

  static async findByOrgId(orgId: string): Promise<AdminApiTokenRecord[]> {
    return db(this.TABLE)
      .select([`${this.TABLE}.*`, 'r.roleName'])
      .leftJoin('g_roles as r', `${this.TABLE}.roleId`, 'r.id')
      .where(`${this.TABLE}.orgId`, orgId)
      .orderBy(`${this.TABLE}.createdAt`, 'desc');
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db(this.TABLE).where('id', id).del();
    return result > 0;
  }

  /**
   * Record usage (fire-and-forget)
   */
  static async recordUsage(id: string): Promise<void> {
    try {
      await db(this.TABLE)
        .where('id', id)
        .update({
          lastUsedAt: db.raw('UTC_TIMESTAMP()'),
        });
    } catch (error) {
      logger.error('Error recording admin token usage:', error);
    }
  }

  /**
   * Get token summary (mask token value for display)
   */
  static maskTokenValue(tokenValue: string): string {
    if (tokenValue.length <= 16) return '***';
    return `${tokenValue.substring(0, 12)}...${tokenValue.substring(tokenValue.length - 4)}`;
  }
}

export default AdminApiToken;
