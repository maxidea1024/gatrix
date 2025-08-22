import Database from '../config/database';

// 클라이언트 상태 enum
export enum ClientStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  RECOMMENDED_UPDATE = 'recommended_update',
  FORCED_UPDATE = 'forced_update',
  UNDER_REVIEW = 'under_review',
  BLOCKED_PATCH_ALLOWED = 'blocked_patch_allowed'
}

// 클라이언트 버전 속성 인터페이스
export interface ClientVersionAttributes {
  id: number;
  channel: string;
  subChannel: string;
  clientVersion: string;
  clientStatus: ClientStatus;
  gameServerAddress: string;
  gameServerAddressForWhiteList?: string;
  patchAddress: string;
  patchAddressForWhiteList?: string;
  guestModeAllowed: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: number;
  updatedBy: number;
  createdByName?: string;
  updatedByName?: string;
}

// 생성 시 필요한 속성
export interface ClientVersionCreationAttributes {
  channel: string;
  subChannel: string;
  clientVersion: string;
  clientStatus: ClientStatus;
  gameServerAddress: string;
  gameServerAddressForWhiteList?: string;
  patchAddress: string;
  patchAddressForWhiteList?: string;
  guestModeAllowed: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  createdBy: number;
  updatedBy: number;
}

// 클라이언트 버전 모델 클래스
export class ClientVersionModel {
  private db: typeof Database;

  constructor() {
    this.db = Database;
  }

  // 클라이언트 버전 목록 조회
  async findAll(options: {
    where?: any;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
  } = {}): Promise<{ rows: ClientVersionAttributes[]; count: number }> {
    const { where = {}, limit, offset, orderBy = 'createdAt', orderDirection = 'DESC' } = options;

    let whereClause = '';
    const params: any[] = [];

    if (Object.keys(where).length > 0) {
      const conditions: string[] = [];

      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'search') {
            // 검색어는 여러 컬럼에서 검색 (Created By, Version 추가)
            const searchConditions = [
              'channel LIKE ?',
              'subChannel LIKE ?',
              'clientVersion LIKE ?',
              'gameServerAddress LIKE ?',
              'patchAddress LIKE ?',
              'creator.name LIKE ?',
              'updater.name LIKE ?'
            ];
            conditions.push(`(${searchConditions.join(' OR ')})`);
            // 각 검색 조건에 대해 동일한 검색어 추가
            for (let i = 0; i < searchConditions.length; i++) {
              params.push(`%${value}%`);
            }
          } else if (typeof value === 'object' && (value as any).like) {
            conditions.push(`${key} LIKE ?`);
            params.push(`%${(value as any).like}%`);
          } else if (Array.isArray(value)) {
            conditions.push(`${key} IN (${value.map(() => '?').join(', ')})`);
            params.push(...value);
          } else {
            conditions.push(`${key} = ?`);
            params.push(value);
          }
        }
      });

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }
    }

    // 총 개수 조회 (사용자 테이블과 JOIN 포함)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM g_client_versions cv
      LEFT JOIN g_users creator ON cv.createdBy = creator.id
      LEFT JOIN g_users updater ON cv.updatedBy = updater.id
      ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, params);
    const total = countResult[0]?.total || 0;

    // 데이터 조회 (사용자 테이블과 JOIN)
    let dataQuery = `
      SELECT
        cv.*,
        creator.name as createdByName,
        updater.name as updatedByName
      FROM g_client_versions cv
      LEFT JOIN g_users creator ON cv.createdBy = creator.id
      LEFT JOIN g_users updater ON cv.updatedBy = updater.id
      ${whereClause}
      ORDER BY cv.${orderBy} ${orderDirection}
    `;

    if (limit) {
      dataQuery += ` LIMIT ${limit}`;
      if (offset) {
        dataQuery += ` OFFSET ${offset}`;
      }
    }

    const rows = await this.db.query(dataQuery, params);

    return { rows, count: total };
  }

  // ID로 클라이언트 버전 조회
  async findById(id: number): Promise<ClientVersionAttributes | null> {
    const query = `
      SELECT
        cv.*,
        CONCAT('User ', cv.createdBy) as createdByName,
        CONCAT('User ', cv.updatedBy) as updatedByName
      FROM g_client_versions cv
      WHERE cv.id = ?
    `;

    const result = await this.db.query(query, [id]);
    return result[0] || null;
  }

  // MySQL DATETIME 형식으로 변환하는 헬퍼 함수
  private formatDateTimeForMySQL(date: Date): string {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }

  // 클라이언트 버전 생성
  async create(data: ClientVersionCreationAttributes): Promise<ClientVersionAttributes> {
    const now = this.formatDateTimeForMySQL(new Date());

    const query = `
      INSERT INTO g_client_versions (
        channel, subChannel, clientVersion, clientStatus,
        gameServerAddress, gameServerAddressForWhiteList,
        patchAddress, patchAddressForWhiteList,
        guestModeAllowed, externalClickLink, memo, customPayload,
        createdBy, updatedBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      data.channel,
      data.subChannel,
      data.clientVersion,
      data.clientStatus,
      data.gameServerAddress,
      data.gameServerAddressForWhiteList || null,
      data.patchAddress,
      data.patchAddressForWhiteList || null,
      data.guestModeAllowed,
      data.externalClickLink || null,
      data.memo || null,
      data.customPayload || null,
      data.createdBy,
      data.updatedBy,
      now,
      now
    ];

    const result = await this.db.query(query, params);
    const insertId = result.insertId;

    const created = await this.findById(insertId);
    if (!created) {
      throw new Error('Failed to create client version');
    }

    return created;
  }

  // 클라이언트 버전 수정
  async update(id: number, data: Partial<ClientVersionCreationAttributes>): Promise<number> {
    const fields: string[] = [];
    const params: any[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) {
      return 0;
    }

    fields.push('updatedAt = ?');
    params.push(this.formatDateTimeForMySQL(new Date()));
    params.push(id);

    const query = `UPDATE g_client_versions SET ${fields.join(', ')} WHERE id = ?`;
    const result = await this.db.query(query, params);

    return result.affectedRows || 0;
  }

  // 클라이언트 버전 삭제
  async delete(id: number): Promise<number> {
    const query = 'DELETE FROM g_client_versions WHERE id = ?';
    const result = await this.db.query(query, [id]);
    return result.affectedRows || 0;
  }

  // 일괄 상태 업데이트
  async bulkUpdateStatus(ids: number[], status: ClientStatus, updatedBy: number): Promise<number> {
    if (ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(', ');
    const query = `
      UPDATE g_client_versions
      SET clientStatus = ?, updatedBy = ?, updatedAt = ?
      WHERE id IN (${placeholders})
    `;

    const params = [status, updatedBy, this.formatDateTimeForMySQL(new Date()), ...ids];
    const result = await this.db.query(query, params);
    return result.affectedRows || 0;
  }

  // 채널 목록 조회
  async getChannels(): Promise<string[]> {
    const query = 'SELECT DISTINCT channel FROM g_client_versions ORDER BY channel';
    const result = await this.db.query(query);
    return result.map((row: any) => row.channel);
  }

  // 서브채널 목록 조회
  async getSubChannels(channel?: string): Promise<string[]> {
    let query = 'SELECT DISTINCT subChannel FROM g_client_versions';
    const params: any[] = [];

    if (channel) {
      query += ' WHERE channel = ?';
      params.push(channel);
    }

    query += ' ORDER BY subChannel';
    const result = await this.db.query(query, params);
    return result.map((row: any) => row.subChannel);
  }

  // 중복 검사
  async checkDuplicate(channel: string, subChannel: string, clientVersion: string, excludeId?: number): Promise<boolean> {
    let query = 'SELECT COUNT(*) as count FROM g_client_versions WHERE channel = ? AND subChannel = ? AND clientVersion = ?';
    const params = [channel, subChannel, clientVersion];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId.toString());
    }

    const result = await this.db.query(query, params);
    return (result[0]?.count || 0) > 0;
  }
}

export default new ClientVersionModel();
