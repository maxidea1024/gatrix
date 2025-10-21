import { RowDataPacket, ResultSetHeader } from 'mysql2';
import database from '../config/database';
import { convertFromMySQLDateTime, convertToMySQLDateTime } from '../utils/dateUtils';

export interface IngamePopupNotice {
  id: number;
  isActive: boolean;
  content: string;
  targetWorlds: string[] | null;
  targetMarkets: string[] | null;
  targetPlatforms: string[] | null;
  targetClientVersions: string[] | null;
  targetAccountIds: string[] | null;
  displayPriority: number;
  showOnce: boolean;
  startDate: string;
  endDate: string;
  messageTemplateId: bigint | null;
  useTemplate: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  updatedBy: number | null;
}

export interface CreateIngamePopupNoticeData {
  isActive: boolean;
  content: string;
  targetWorlds?: string[] | null;
  targetMarkets?: string[] | null;
  targetPlatforms?: string[] | null;
  targetClientVersions?: string[] | null;
  targetAccountIds?: string[] | null;
  displayPriority?: number;
  showOnce?: boolean;
  startDate: string;
  endDate: string;
  messageTemplateId?: bigint | null;
  useTemplate?: boolean;
  description?: string | null;
}

export interface UpdateIngamePopupNoticeData extends Partial<CreateIngamePopupNoticeData> {}

export interface IngamePopupNoticeFilters {
  isActive?: boolean;
  currentlyVisible?: boolean;
  world?: string;
  market?: string;
  platform?: string | string[];
  platformOperator?: 'any_of' | 'include_all';
  clientVersion?: string;
  accountId?: string;
  search?: string;
}

class IngamePopupNoticeService {
  /**
   * Get ingame popup notices with pagination and filters
   */
  async getIngamePopupNotices(
    page: number = 1,
    limit: number = 10,
    filters: IngamePopupNoticeFilters = {}
  ): Promise<{ notices: IngamePopupNotice[]; total: number }> {
    try {
      const pool = database.getPool();
      const offset = (page - 1) * limit;
      const whereClauses: string[] = [];
      const queryParams: any[] = [];

      // Apply filters
      if (filters.isActive !== undefined) {
        whereClauses.push('isActive = ?');
        queryParams.push(filters.isActive);
      }

      if (filters.currentlyVisible !== undefined) {
        // Filter by currently visible (isActive + within date range)
        if (filters.currentlyVisible) {
          whereClauses.push('isActive = 1 AND startDate <= NOW() AND endDate >= NOW()');
        } else {
          whereClauses.push('(isActive = 0 OR startDate > NOW() OR endDate < NOW())');
        }
      }

      // Target filters - check if JSON array contains the value
      if (filters.world) {
        whereClauses.push('(targetWorlds IS NULL OR JSON_CONTAINS(targetWorlds, ?))');
        queryParams.push(JSON.stringify(filters.world));
      }

      if (filters.market) {
        whereClauses.push('(targetMarkets IS NULL OR JSON_CONTAINS(targetMarkets, ?))');
        queryParams.push(JSON.stringify(filters.market));
      }

      if (filters.platform) {
        const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
        const operator = filters.platformOperator || 'any_of';

        if (operator === 'include_all') {
          // All specified platforms must be included
          const platformChecks = platforms.map(() => 'JSON_CONTAINS(targetPlatforms, ?)').join(' AND ');
          whereClauses.push(`(targetPlatforms IS NULL OR (${platformChecks}))`);
          platforms.forEach(platform => queryParams.push(JSON.stringify(platform)));
        } else {
          // Any of the specified platforms (default)
          const platformChecks = platforms.map(() => 'JSON_CONTAINS(targetPlatforms, ?)').join(' OR ');
          whereClauses.push(`(targetPlatforms IS NULL OR (${platformChecks}))`);
          platforms.forEach(platform => queryParams.push(JSON.stringify(platform)));
        }
      }

      if (filters.clientVersion) {
        whereClauses.push('(targetClientVersions IS NULL OR JSON_CONTAINS(targetClientVersions, ?))');
        queryParams.push(JSON.stringify(filters.clientVersion));
      }

      if (filters.accountId) {
        whereClauses.push('(targetAccountIds IS NULL OR JSON_CONTAINS(targetAccountIds, ?))');
        queryParams.push(JSON.stringify(filters.accountId));
      }

      if (filters.search) {
        whereClauses.push('(content LIKE ? OR description LIKE ?)');
        const searchPattern = `%${filters.search}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count
      const [countRows] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM g_ingame_popup_notices ${whereClause}`,
        queryParams
      );
      const total = countRows[0].total;

      // Get paginated results
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM g_ingame_popup_notices ${whereClause} ORDER BY displayPriority ASC, createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
        queryParams
      );

      const notices = rows.map(row => this.formatNotice(row));

      return { notices, total };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get ingame popup notice by ID
   */
  async getIngamePopupNoticeById(id: number): Promise<IngamePopupNotice | null> {
    try {
      const pool = database.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM g_ingame_popup_notices WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return null;
      }

      return this.formatNotice(rows[0]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create ingame popup notice
   */
  async createIngamePopupNotice(data: CreateIngamePopupNoticeData, createdBy: number): Promise<IngamePopupNotice> {
    try {
      const pool = database.getPool();

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO g_ingame_popup_notices (
          isActive, content, targetWorlds, targetMarkets, targetPlatforms,
          targetClientVersions, targetAccountIds,
          displayPriority, showOnce, startDate, endDate,
          messageTemplateId, useTemplate, description, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.isActive,
          data.content,
          data.targetWorlds ? JSON.stringify(data.targetWorlds) : null,
          data.targetMarkets ? JSON.stringify(data.targetMarkets) : null,
          data.targetPlatforms ? JSON.stringify(data.targetPlatforms) : null,
          data.targetClientVersions ? JSON.stringify(data.targetClientVersions) : null,
          data.targetAccountIds ? JSON.stringify(data.targetAccountIds) : null,
          data.displayPriority ?? 100,
          data.showOnce ?? false,
          convertToMySQLDateTime(data.startDate),
          convertToMySQLDateTime(data.endDate),
          data.messageTemplateId ?? null,
          data.useTemplate ?? false,
          data.description ?? null,
          createdBy
        ]
      );

      const notice = await this.getIngamePopupNoticeById(result.insertId);
      if (!notice) {
        throw new Error('Failed to create ingame popup notice');
      }

      return notice;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update ingame popup notice
   */
  async updateIngamePopupNotice(id: number, data: UpdateIngamePopupNoticeData, updatedBy: number): Promise<IngamePopupNotice> {
    try {
      const pool = database.getPool();
      const updates: string[] = [];
      const values: any[] = [];

      if (data.isActive !== undefined) {
        updates.push('isActive = ?');
        values.push(data.isActive);
      }

      if (data.content !== undefined) {
        updates.push('content = ?');
        values.push(data.content);
      }

      if (data.targetWorlds !== undefined) {
        updates.push('targetWorlds = ?');
        values.push(data.targetWorlds ? JSON.stringify(data.targetWorlds) : null);
      }

      if (data.targetMarkets !== undefined) {
        updates.push('targetMarkets = ?');
        values.push(data.targetMarkets ? JSON.stringify(data.targetMarkets) : null);
      }

      if (data.targetPlatforms !== undefined) {
        updates.push('targetPlatforms = ?');
        values.push(data.targetPlatforms ? JSON.stringify(data.targetPlatforms) : null);
      }

      if (data.targetClientVersions !== undefined) {
        updates.push('targetClientVersions = ?');
        values.push(data.targetClientVersions ? JSON.stringify(data.targetClientVersions) : null);
      }

      if (data.targetAccountIds !== undefined) {
        updates.push('targetAccountIds = ?');
        values.push(data.targetAccountIds ? JSON.stringify(data.targetAccountIds) : null);
      }

      if (data.displayPriority !== undefined) {
        updates.push('displayPriority = ?');
        values.push(data.displayPriority);
      }

      if (data.showOnce !== undefined) {
        updates.push('showOnce = ?');
        values.push(data.showOnce);
      }

      if (data.startDate) {
        updates.push('startDate = ?');
        values.push(convertToMySQLDateTime(data.startDate));
      }

      if (data.endDate) {
        updates.push('endDate = ?');
        values.push(convertToMySQLDateTime(data.endDate));
      }

      if (data.messageTemplateId !== undefined) {
        updates.push('messageTemplateId = ?');
        values.push(data.messageTemplateId ?? null);
      }

      if (data.useTemplate !== undefined) {
        updates.push('useTemplate = ?');
        values.push(data.useTemplate);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description ?? null);
      }

      updates.push('updatedBy = ?');
      values.push(updatedBy);

      updates.push('updatedAt = NOW()');
      values.push(id);

      await pool.execute(
        `UPDATE g_ingame_popup_notices SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const notice = await this.getIngamePopupNoticeById(id);
      if (!notice) {
        throw new Error('Ingame popup notice not found');
      }

      return notice;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete ingame popup notice
   */
  async deleteIngamePopupNotice(id: number): Promise<void> {
    try {
      const pool = database.getPool();
      await pool.execute('DELETE FROM g_ingame_popup_notices WHERE id = ?', [id]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete multiple ingame popup notices
   */
  async deleteMultipleIngamePopupNotices(ids: number[]): Promise<void> {
    try {
      const pool = database.getPool();
      const placeholders = ids.map(() => '?').join(',');
      await pool.execute(
        `DELETE FROM g_ingame_popup_notices WHERE id IN (${placeholders})`,
        ids
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number): Promise<IngamePopupNotice> {
    try {
      const pool = database.getPool();
      await pool.execute(
        'UPDATE g_ingame_popup_notices SET isActive = NOT isActive, updatedAt = NOW() WHERE id = ?',
        [id]
      );

      const notice = await this.getIngamePopupNoticeById(id);
      if (!notice) {
        throw new Error('Ingame popup notice not found');
      }

      return notice;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Format notice from database row
   */
  private formatNotice(row: any): IngamePopupNotice {
    return {
      id: row.id,
      isActive: Boolean(row.isActive),
      content: row.content,
      targetWorlds: typeof row.targetWorlds === 'string' ? JSON.parse(row.targetWorlds) : row.targetWorlds,
      targetMarkets: typeof row.targetMarkets === 'string' ? JSON.parse(row.targetMarkets) : row.targetMarkets,
      targetPlatforms: typeof row.targetPlatforms === 'string' ? JSON.parse(row.targetPlatforms) : row.targetPlatforms,
      targetClientVersions: typeof row.targetClientVersions === 'string' ? JSON.parse(row.targetClientVersions) : row.targetClientVersions,
      targetAccountIds: typeof row.targetAccountIds === 'string' ? JSON.parse(row.targetAccountIds) : row.targetAccountIds,
      displayPriority: row.displayPriority,
      showOnce: Boolean(row.showOnce),
      startDate: convertFromMySQLDateTime(row.startDate)!,
      endDate: convertFromMySQLDateTime(row.endDate)!,
      messageTemplateId: row.messageTemplateId,
      useTemplate: Boolean(row.useTemplate),
      description: row.description,
      createdAt: convertFromMySQLDateTime(row.createdAt)!,
      updatedAt: convertFromMySQLDateTime(row.updatedAt)!,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy
    };
  }
}

export default new IngamePopupNoticeService();

