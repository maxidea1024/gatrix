import { RowDataPacket, ResultSetHeader } from 'mysql2';
import database from '../config/database';
import { convertDateFieldsFromMySQL, convertToMySQLDateTime } from '../utils/dateUtils';

export interface ServiceNotice {
  id: number;
  isActive: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  startDate: string;
  endDate: string;
  tabTitle?: string;
  title: string;
  content: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceNoticeData {
  isActive: boolean;
  category: 'maintenance' | 'event' | 'notice' | 'promotion' | 'other';
  platforms: string[];
  startDate: string;
  endDate: string;
  tabTitle?: string;
  title: string;
  content: string;
  description?: string;
}

export interface UpdateServiceNoticeData extends Partial<CreateServiceNoticeData> {}

export interface ServiceNoticeFilters {
  isActive?: boolean;
  currentlyVisible?: boolean;
  category?: string;
  platform?: string | string[];
  platformOperator?: 'any_of' | 'include_all';
  search?: string;
}

class ServiceNoticeService {
  /**
   * Get service notices with pagination and filters
   */
  async getServiceNotices(
    page: number = 1,
    limit: number = 10,
    filters: ServiceNoticeFilters = {}
  ): Promise<{ notices: ServiceNotice[]; total: number }> {
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

      if (filters.category) {
        whereClauses.push('category = ?');
        queryParams.push(filters.category);
      }

      if (filters.platform) {
        const platforms = Array.isArray(filters.platform) ? filters.platform : [filters.platform];
        const operator = filters.platformOperator || 'any_of';

        if (operator === 'include_all') {
          // AND condition: notice must include ALL selected platforms
          platforms.forEach(platform => {
            whereClauses.push('JSON_CONTAINS(platforms, ?)');
            queryParams.push(JSON.stringify(platform));
          });
        } else {
          // OR condition: notice must include ANY of the selected platforms
          const platformConditions = platforms.map(() => 'JSON_CONTAINS(platforms, ?)').join(' OR ');
          whereClauses.push(`(${platformConditions})`);
          platforms.forEach(platform => {
            queryParams.push(JSON.stringify(platform));
          });
        }
      }

      if (filters.search) {
        whereClauses.push('(title LIKE ? OR content LIKE ? OR description LIKE ?)');
        const searchPattern = `%${filters.search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count
      const [countResult] = await pool.execute<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM g_service_notices ${whereClause}`,
        queryParams
      );
      const total = countResult[0].total;

      // Get paginated results
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT * FROM g_service_notices ${whereClause} ORDER BY createdAt DESC LIMIT ${limit} OFFSET ${offset}`,
        queryParams
      );

      const notices = rows.map(row => {
        const notice = {
          id: row.id,
          isActive: Boolean(row.isActive),
          category: row.category,
          platforms: typeof row.platforms === 'string' ? JSON.parse(row.platforms) : row.platforms,
          startDate: row.startDate,
          endDate: row.endDate,
          tabTitle: row.tabTitle,
          title: row.title,
          content: row.content,
          description: row.description,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
        // Convert MySQL DATETIME to ISO 8601
        return convertDateFieldsFromMySQL(notice, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
      });

      return { notices, total };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get service notice by ID
   */
  async getServiceNoticeById(id: number): Promise<ServiceNotice | null> {
    try {
      const pool = database.getPool();
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM g_service_notices WHERE id = ?',
        [id]
      );

      if (rows.length === 0) {
        return null;
      }

      const row = rows[0];
      const notice = {
        id: row.id,
        isActive: Boolean(row.isActive),
        category: row.category,
        platforms: typeof row.platforms === 'string' ? JSON.parse(row.platforms) : row.platforms,
        startDate: row.startDate,
        endDate: row.endDate,
        tabTitle: row.tabTitle,
        title: row.title,
        content: row.content,
        description: row.description,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      // Convert MySQL DATETIME to ISO 8601
      return convertDateFieldsFromMySQL(notice, ['startDate', 'endDate', 'createdAt', 'updatedAt']);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create service notice
   */
  async createServiceNotice(data: CreateServiceNoticeData): Promise<ServiceNotice> {
    try {
      const pool = database.getPool();

      // Debug logging
      console.log('Creating service notice with data:', {
        startDate: data.startDate,
        endDate: data.endDate,
        convertedStartDate: convertToMySQLDateTime(data.startDate),
        convertedEndDate: convertToMySQLDateTime(data.endDate),
      });

      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO g_service_notices
        (isActive, category, platforms, startDate, endDate, tabTitle, title, content, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.isActive,
          data.category,
          JSON.stringify(data.platforms),
          convertToMySQLDateTime(data.startDate),
          convertToMySQLDateTime(data.endDate),
          data.tabTitle || null,
          data.title,
          data.content,
          data.description || null,
        ]
      );

      const notice = await this.getServiceNoticeById(result.insertId);
      if (!notice) {
        throw new Error('Failed to retrieve created service notice');
      }

      return notice;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update service notice
   */
  async updateServiceNotice(id: number, data: UpdateServiceNoticeData): Promise<ServiceNotice> {
    try {
      const pool = database.getPool();
      const updates: string[] = [];
      const values: any[] = [];

      if (data.isActive !== undefined) {
        updates.push('isActive = ?');
        values.push(data.isActive);
      }

      if (data.category) {
        updates.push('category = ?');
        values.push(data.category);
      }

      if (data.platforms) {
        updates.push('platforms = ?');
        values.push(JSON.stringify(data.platforms));
      }

      if (data.startDate) {
        updates.push('startDate = ?');
        values.push(convertToMySQLDateTime(data.startDate));
      }

      if (data.endDate) {
        updates.push('endDate = ?');
        values.push(convertToMySQLDateTime(data.endDate));
      }

      if (data.tabTitle !== undefined) {
        updates.push('tabTitle = ?');
        values.push(data.tabTitle || null);
      }

      if (data.title) {
        updates.push('title = ?');
        values.push(data.title);
      }

      if (data.content) {
        updates.push('content = ?');
        values.push(data.content);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description || null);
      }

      updates.push('updatedAt = NOW()');
      values.push(id);

      await pool.execute(
        `UPDATE g_service_notices SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const notice = await this.getServiceNoticeById(id);
      if (!notice) {
        throw new Error('Service notice not found');
      }

      return notice;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete service notice
   */
  async deleteServiceNotice(id: number): Promise<void> {
    try {
      const pool = database.getPool();
      await pool.execute('DELETE FROM g_service_notices WHERE id = ?', [id]);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete multiple service notices
   */
  async deleteMultipleServiceNotices(ids: number[]): Promise<void> {
    try {
      if (ids.length === 0) return;

      const pool = database.getPool();
      const placeholders = ids.map(() => '?').join(',');
      await pool.execute(
        `DELETE FROM g_service_notices WHERE id IN (${placeholders})`,
        ids
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: number): Promise<ServiceNotice> {
    try {
      const pool = database.getPool();
      await pool.execute(
        'UPDATE g_service_notices SET isActive = NOT isActive, updatedAt = NOW() WHERE id = ?',
        [id]
      );

      const notice = await this.getServiceNoticeById(id);
      if (!notice) {
        throw new Error('Service notice not found');
      }

      return notice;
    } catch (error) {
      throw error;
    }
  }
}

export default new ServiceNoticeService();

