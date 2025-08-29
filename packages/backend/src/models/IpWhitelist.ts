import database from '../config/database';
import { CustomError } from '../middleware/errorHandler';

export interface IpWhitelist {
  id: number;
  ipAddress: string;
  purpose: string;
  isEnabled: boolean;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  createdBy: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
  createdByName?: string;
  updatedByName?: string;
}

export interface CreateIpWhitelistData {
  ipAddress: string;
  purpose: string;
  isEnabled?: boolean;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  createdBy: number;
}

export interface UpdateIpWhitelistData {
  ipAddress?: string;
  purpose?: string;
  isEnabled?: boolean;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  updatedBy: number;
}

export interface IpWhitelistFilters {
  ipAddress?: string;
  purpose?: string;
  isEnabled?: boolean;
  createdBy?: number;
  search?: string;
  includeExpired?: boolean;
  tags?: string[];
}

export interface IpWhitelistListResponse {
  ipWhitelists: IpWhitelist[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class IpWhitelistModel {
  static async findAll(
    page: number = 1,
    limit: number = 10,
    filters: IpWhitelistFilters = {}
  ): Promise<IpWhitelistListResponse> {
    try {
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters.ipAddress) {
        whereClause += ' AND iw.ip_address LIKE ?';
        params.push(`%${filters.ipAddress}%`);
      }

      if (filters.purpose) {
        whereClause += ' AND iw.purpose LIKE ?';
        params.push(`%${filters.purpose}%`);
      }

      if (filters.isEnabled !== undefined) {
        whereClause += ' AND iw.is_enabled = ?';
        params.push(filters.isEnabled);
      }

      if (filters.createdBy) {
        whereClause += ' AND iw.created_by = ?';
        params.push(filters.createdBy);
      }

      if (filters.tags && filters.tags.length > 0) {
        const tagConditions = filters.tags.map(() => 'JSON_CONTAINS(iw.tags, ?)').join(' OR ');
        whereClause += ` AND (${tagConditions})`;
        filters.tags.forEach(tag => {
          params.push(JSON.stringify(tag));
        });
      }

      if (filters.search) {
        whereClause += ' AND (iw.ip_address LIKE ? OR iw.purpose LIKE ?)';
        const searchParam = `%${filters.search}%`;
        params.push(searchParam, searchParam);
      }

      // Filter out expired entries by default
      if (!filters.includeExpired) {
        whereClause += ' AND (iw.end_date IS NULL OR iw.end_date > NOW())';
      }

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM g_ip_whitelist iw
        ${whereClause}
      `;

      const countResult = await database.query(countQuery, params);
      const total = countResult[0]?.total || 0;

      // Data query with joins
      const dataQuery = `
        SELECT 
          iw.*,
          creator.name as createdByName,
          updater.name as updatedByName
        FROM g_ip_whitelist iw
        LEFT JOIN g_users creator ON iw.created_by = creator.id
        LEFT JOIN g_users updater ON iw.updated_by = updater.id
        ${whereClause}
        ORDER BY iw.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const dataParams = [...params, limit, offset];
      const ipWhitelists = await database.query(dataQuery, dataParams);

      const totalPages = Math.ceil(total / limit);

      return {
        ipWhitelists: ipWhitelists.map(this.mapRowToIpWhitelist),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      console.error('Error in IpWhitelistModel.findAll:', error);
      throw new CustomError('Failed to fetch IP whitelists', 500);
    }
  }

  static async findById(id: number): Promise<IpWhitelist | null> {
    try {
      const query = `
        SELECT 
          iw.*,
          creator.name as createdByName,
          updater.name as updatedByName
        FROM g_ip_whitelist iw
        LEFT JOIN g_users creator ON iw.created_by = creator.id
        LEFT JOIN g_users updater ON iw.updated_by = updater.id
        WHERE iw.id = ?
      `;

      const result = await database.query(query, [id]);
      
      if (result.length === 0) {
        return null;
      }

      return this.mapRowToIpWhitelist(result[0]);
    } catch (error) {
      console.error('Error in IpWhitelistModel.findById:', error);
      throw new CustomError('Failed to fetch IP whitelist entry', 500);
    }
  }

  static async findByIpAddress(ipAddress: string): Promise<IpWhitelist | null> {
    try {
      const query = `
        SELECT 
          iw.*,
          creator.name as createdByName,
          updater.name as updatedByName
        FROM g_ip_whitelist iw
        LEFT JOIN g_users creator ON iw.created_by = creator.id
        LEFT JOIN g_users updater ON iw.updated_by = updater.id
        WHERE iw.ip_address = ?
      `;

      const result = await database.query(query, [ipAddress]);
      
      if (result.length === 0) {
        return null;
      }

      return this.mapRowToIpWhitelist(result[0]);
    } catch (error) {
      console.error('Error in IpWhitelistModel.findByIpAddress:', error);
      throw new CustomError('Failed to fetch IP whitelist entry', 500);
    }
  }

  static async create(data: CreateIpWhitelistData): Promise<IpWhitelist> {
    try {
      const query = `
        INSERT INTO g_ip_whitelist (ip_address, purpose, is_enabled, start_date, end_date, tags, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      // Ensure no undefined values are passed to the database
      const params = [
        data.ipAddress,
        data.purpose,
        data.isEnabled ?? true,
        data.startDate || null,
        data.endDate || null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.createdBy,
      ];

      console.log('Database query params:', params);
      const result = await database.query(query, params);

      const created = await this.findById(result.insertId);
      if (!created) {
        throw new CustomError('Failed to create IP whitelist entry', 500);
      }

      return created;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new CustomError('IP address already exists in whitelist', 409);
      }
      console.error('Error in IpWhitelistModel.create:', error);
      throw new CustomError('Failed to create IP whitelist entry', 500);
    }
  }

  static async update(id: number, data: UpdateIpWhitelistData): Promise<IpWhitelist> {
    try {
      const setParts: string[] = [];
      const params: any[] = [];

      if (data.ipAddress !== undefined) {
        setParts.push('ip_address = ?');
        params.push(data.ipAddress);
      }

      if (data.purpose !== undefined) {
        setParts.push('purpose = ?');
        params.push(data.purpose);
      }

      if (data.isEnabled !== undefined) {
        setParts.push('is_enabled = ?');
        params.push(data.isEnabled);
      }

      if (data.startDate !== undefined) {
        setParts.push('start_date = ?');
        params.push(data.startDate ?? null);
      }

      if (data.endDate !== undefined) {
        setParts.push('end_date = ?');
        params.push(data.endDate ?? null);
      }

      if (data.tags !== undefined) {
        setParts.push('tags = ?');
        params.push(data.tags ? JSON.stringify(data.tags) : null);
      }

      setParts.push('updated_by = ?');
      params.push(data.updatedBy);

      params.push(id);

      const query = `
        UPDATE g_ip_whitelist 
        SET ${setParts.join(', ')}
        WHERE id = ?
      `;

      const result = await database.query(query, params);

      if (result.affectedRows === 0) {
        throw new CustomError('IP whitelist entry not found', 404);
      }

      const updated = await this.findById(id);
      if (!updated) {
        throw new CustomError('Failed to fetch updated IP whitelist entry', 500);
      }

      return updated;
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new CustomError('IP address already exists in whitelist', 409);
      }
      if (error instanceof CustomError) {
        throw error;
      }
      console.error('Error in IpWhitelistModel.update:', error);
      throw new CustomError('Failed to update IP whitelist entry', 500);
    }
  }

  static async delete(id: number): Promise<void> {
    try {
      const query = 'DELETE FROM g_ip_whitelist WHERE id = ?';
      const result = await database.query(query, [id]);

      if (result.affectedRows === 0) {
        throw new CustomError('IP whitelist entry not found', 404);
      }
    } catch (error) {
      if (error instanceof CustomError) {
        throw error;
      }
      console.error('Error in IpWhitelistModel.delete:', error);
      throw new CustomError('Failed to delete IP whitelist entry', 500);
    }
  }

  private static mapRowToIpWhitelist(row: any): IpWhitelist {
    return {
      id: row.id,
      ipAddress: row.ip_address,
      purpose: row.purpose,
      isEnabled: Boolean(row.is_enabled),
      startDate: row.start_date ? new Date(row.start_date) : undefined,
      endDate: row.end_date ? new Date(row.end_date) : undefined,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdByName: row.createdByName,
      updatedByName: row.updatedByName,
    };
  }
}
