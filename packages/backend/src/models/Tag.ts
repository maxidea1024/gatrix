import database from '../config/database';

export interface TagAttributes {
  id: number;
  name: string;
  color: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: number | null;
  updatedBy?: number | null;
  createdByName?: string | null;
  updatedByName?: string | null;
}

export interface CreateTagData {
  name: string;
  color?: string;
  description?: string | null;
  createdBy?: number | null;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
  description?: string | null;
  updatedBy?: number | null;
}

export default class TagModel {
  static async list(): Promise<TagAttributes[]> {
    return await database.query(`
      SELECT t.*, c.name as createdByName, u.name as updatedByName
      FROM g_tags t
      LEFT JOIN g_users c ON c.id = t.createdBy
      LEFT JOIN g_users u ON u.id = t.updatedBy
      ORDER BY t.name ASC
    `);
  }

  static async findById(id: number): Promise<TagAttributes | null> {
    const rows = await database.query(`SELECT * FROM g_tags WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  static async findByName(name: string): Promise<TagAttributes | null> {
    const rows = await database.query(`SELECT * FROM g_tags WHERE name = ?`, [name]);
    return rows[0] || null;
  }

  static async upsertByName(data: CreateTagData): Promise<TagAttributes> {
    const existing = await this.findByName(data.name);
    if (existing) {
      await database.query(`UPDATE g_tags SET color = ?, description = ?, updatedAt = CURRENT_TIMESTAMP, updatedBy = ? WHERE id = ?`, [data.color || existing.color, data.description ?? existing.description ?? null, data.createdBy ?? existing.updatedBy ?? null, existing.id]);
      return (await this.findById(existing.id))!;
    }
    const result = await database.query(
      `INSERT INTO g_tags (name, color, description, createdBy) VALUES (?, ?, ?, ?)`,
      [data.name, data.color || '#607D8B', data.description || null, data.createdBy ?? null]
    );
    const id = result.insertId || result[0]?.insertId;
    return (await this.findById(id))!;
  }

  static async create(data: CreateTagData): Promise<TagAttributes> {
    const result = await database.query(
      `INSERT INTO g_tags (name, color, description, createdBy) VALUES (?, ?, ?, ?)`,
      [data.name, data.color || '#607D8B', data.description || null, data.createdBy ?? null]
    );
    const id = result.insertId || result[0]?.insertId;
    return (await this.findById(id))!;
  }

  static async update(id: number, data: UpdateTagData): Promise<TagAttributes | null> {
    const fields: string[] = [];
    const values: any[] = [];
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) { fields.push(`${k} = ?`); values.push(v); }
    });
    if (fields.length === 0) return this.findById(id);
    fields.push('updatedAt = CURRENT_TIMESTAMP');
    if (!('updatedBy' in data)) { fields.push('updatedBy = updatedBy'); } // no-op if not provided
    values.push(id);
    await database.query(`UPDATE g_tags SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await database.query(`DELETE FROM g_tags WHERE id = ?`, [id]);
  }
}

