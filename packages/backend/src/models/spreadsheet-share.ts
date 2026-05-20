import db from '../config/knex';
import { nanoid } from 'nanoid';
import { createLogger } from '../config/logger';

const logger = createLogger('SpreadsheetShareModel');
const TABLE = 'g_spreadsheet_shares';

// ==================== Types ====================

export type ShareType = 'user' | 'org' | 'public';
export type SharePermission = 'viewer' | 'editor';

export interface SpreadsheetShare {
  id: string;
  spreadsheetId: string;
  shareType: ShareType;
  targetId: string | null;
  permission: SharePermission;
  shareToken: string | null;
  createdBy: string;
  createdAt: string;
  // Joined fields
  targetName?: string | null;
  targetEmail?: string | null;
  targetAvatarUrl?: string | null;
}

export interface AddShareData {
  spreadsheetId: string;
  shareType: ShareType;
  targetId?: string | null;
  permission: SharePermission;
  createdBy: string;
}

// ==================== Model ====================

export default class SpreadsheetShareModel {
  /**
   * Add a share entry
   */
  static async addShare(data: AddShareData): Promise<SpreadsheetShare> {
    const id = nanoid();
    const shareToken = data.shareType === 'public' ? nanoid(32) : null;

    try {
      await db(TABLE).insert({
        id,
        spreadsheetId: data.spreadsheetId,
        shareType: data.shareType,
        targetId: data.targetId || null,
        permission: data.permission,
        shareToken,
        createdBy: data.createdBy,
      });

      const share = await db(TABLE).where('id', id).first();
      return share;
    } catch (err: any) {
      // Duplicate entry — update permission instead
      if (err.code === 'ER_DUP_ENTRY' && !err.message.includes('uq_token')) {
        logger.info('Share already exists, updating permission', {
          spreadsheetId: data.spreadsheetId,
          shareType: data.shareType,
          targetId: data.targetId,
        });
        await db(TABLE)
          .where({
            spreadsheetId: data.spreadsheetId,
            shareType: data.shareType,
            targetId: data.targetId || null,
          })
          .update({ permission: data.permission });

        const existing = await db(TABLE)
          .where({
            spreadsheetId: data.spreadsheetId,
            shareType: data.shareType,
            targetId: data.targetId || null,
          })
          .first();
        return existing;
      }
      throw err;
    }
  }

  /**
   * Remove a share entry
   */
  static async removeShare(id: string): Promise<boolean> {
    const deleted = await db(TABLE).where('id', id).del();
    return deleted > 0;
  }

  /**
   * List all shares for a spreadsheet (with user/org names)
   */
  static async listShares(spreadsheetId: string): Promise<SpreadsheetShare[]> {
    const shares = await db(TABLE + ' as s')
      .leftJoin('g_users as u', function () {
        this.on('s.targetId', '=', 'u.id').andOn(
          's.shareType',
          '=',
          db.raw("'user'")
        );
      })
      .leftJoin('g_organisations as o', function () {
        this.on('s.targetId', '=', 'o.id').andOn(
          's.shareType',
          '=',
          db.raw("'org'")
        );
      })
      .where('s.spreadsheetId', spreadsheetId)
      .select(
        's.*',
        db.raw("COALESCE(u.name, o.displayName, 'Public') as targetName"),
        'u.email as targetEmail',
        'u.avatarUrl as targetAvatarUrl'
      )
      .orderBy('s.createdAt', 'asc');

    return shares;
  }

  /**
   * Update permission for a share
   */
  static async updatePermission(
    id: string,
    permission: SharePermission
  ): Promise<boolean> {
    const updated = await db(TABLE).where('id', id).update({ permission });
    return updated > 0;
  }

  /**
   * Find share by public token
   */
  static async findByToken(
    shareToken: string
  ): Promise<SpreadsheetShare | null> {
    const share = await db(TABLE)
      .where('shareToken', shareToken)
      .andWhere('shareType', 'public')
      .first();
    return share || null;
  }

  /**
   * Check access for a user to a spreadsheet
   * Returns the highest permission level or null if no access
   */
  static async checkAccess(
    spreadsheetId: string,
    userId: string,
    orgId: string
  ): Promise<SharePermission | null> {
    const shares = await db(TABLE)
      .where('spreadsheetId', spreadsheetId)
      .andWhere(function () {
        this.where(function () {
          this.where('shareType', 'user').andWhere('targetId', userId);
        })
          .orWhere(function () {
            this.where('shareType', 'org').andWhere('targetId', orgId);
          })
          .orWhere('shareType', 'public');
      })
      .select('permission');

    if (shares.length === 0) return null;

    // editor > viewer
    const hasEditor = shares.some((s: any) => s.permission === 'editor');
    return hasEditor ? 'editor' : 'viewer';
  }

  /**
   * List spreadsheets shared with a specific user (by userId or orgId)
   */
  static async findAccessibleByUser(
    userId: string,
    orgId: string
  ): Promise<any[]> {
    const rows = await db(TABLE + ' as s')
      .join('g_spreadsheets as sp', 'sp.id', 's.spreadsheetId')
      .leftJoin('g_users as c', 'c.id', 'sp.createdBy')
      .where(function () {
        this.where(function () {
          this.where('s.shareType', 'user').andWhere('s.targetId', userId);
        }).orWhere(function () {
          this.where('s.shareType', 'org').andWhere('s.targetId', orgId);
        });
      })
      // Exclude spreadsheets from the user's own org (they already have access)
      .andWhere('sp.orgId', '!=', orgId)
      .select(
        'sp.id',
        'sp.orgId',
        'sp.title',
        'sp.description',
        'sp.thumbnail',
        'sp.isPinned',
        'sp.version',
        'sp.createdBy',
        'sp.updatedBy',
        'sp.createdAt',
        'sp.updatedAt',
        'c.name as createdByName',
        db.raw('MAX(s.permission) as permission')
      )
      .groupBy('sp.id')
      .orderBy('sp.updatedAt', 'desc');

    return rows;
  }
}
