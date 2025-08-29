import database from '../config/database';

export interface MessageTemplateLocale {
  id?: number;
  lang: 'ko' | 'en' | 'zh';
  message: string;
}

export interface MessageTemplate {
  id?: number;
  name: string;
  type: 'maintenance' | 'general' | 'notification';
  is_enabled: boolean;
  default_message?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  locales?: MessageTemplateLocale[];
}

export class MessageTemplateModel {
  static async list(filters: { type?: string; is_enabled?: string; q?: string; limit?: number; offset?: number } = {}) {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.type) { where.push('t.type = ?'); params.push(filters.type); }
    if (filters.is_enabled !== undefined) { where.push('t.is_enabled = ?'); params.push(filters.is_enabled === '1' || filters.is_enabled === 'true'); }
    if (filters.q) { where.push('(t.name LIKE ? OR t.default_message LIKE ?)'); params.push(`%${filters.q}%`, `%${filters.q}%`); }
    const limitNum = Math.min(Math.max(Number(filters.limit ?? 50) || 50, 1), 200);
    const offsetNum = Math.max(Number(filters.offset ?? 0) || 0, 0);

    // Get total count
    const countSql = `SELECT COUNT(*) as total
                      FROM g_message_templates t
                      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
    const countResult = await database.query(countSql, params);
    const total = countResult[0]?.total || 0;

    const sql = `SELECT t.*, c.name AS created_by_name, u.name AS updated_by_name
                 FROM g_message_templates t
                 LEFT JOIN g_users c ON c.id = t.created_by
                 LEFT JOIN g_users u ON u.id = t.updated_by
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY t.updated_at DESC
                 LIMIT ${limitNum} OFFSET ${offsetNum}`;

    const templates = await database.query(sql, params);

    if (!templates?.length) return { templates: [], total };

    const ids = templates.map((t: any) => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const localesRows = await database.query(
      `SELECT template_id, lang, message FROM g_message_template_locales WHERE template_id IN (${placeholders}) ORDER BY lang`,
      ids
    );
    const map: Record<number, any[]> = {};
    for (const row of localesRows) {
      (map[row.template_id] = map[row.template_id] || []).push({ lang: row.lang, message: row.message });
    }
    const templatesWithLocales = templates.map((t: any) => ({ ...t, locales: map[t.id] || [] }));
    return { templates: templatesWithLocales, total };
  }

  static async findById(id: number) {
    const rows = await database.query('SELECT * FROM g_message_templates WHERE id = ?', [id]);
    const tpl = rows[0];
    if (!tpl) return null;
    const locales = await database.query('SELECT * FROM g_message_template_locales WHERE template_id = ? ORDER BY lang', [id]);
    return { ...tpl, locales };
  }

  static async findByName(name: string, excludeId?: number) {
    let query = 'SELECT * FROM g_message_templates WHERE name = ?';
    const params: any[] = [name];

    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }

    const rows = await database.query(query, params);
    return rows[0] || null;
  }

  static async create(data: MessageTemplate) {
    const type = (data as any).type || 'general';
    const result = await database.query(
      `INSERT INTO g_message_templates (name, type, is_enabled, default_message, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.name, type, data.is_enabled ? 1 : 0, data.default_message ?? null, data.created_by ?? null, data.updated_by ?? null]
    );
    const id = result.insertId;
    if (data.locales?.length) {
      for (const loc of data.locales) {
        await database.query(
          `INSERT INTO g_message_template_locales (template_id, lang, message) VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE message = VALUES(message)`,
          [id, loc.lang, loc.message]
        );
      }
    }
    return this.findById(id);
  }

  static async update(id: number, data: MessageTemplate) {
    await database.query(
      `UPDATE g_message_templates SET name=?, type=?, is_enabled=?, default_message=?, updated_by=? WHERE id=?`,
      [data.name, data.type, data.is_enabled ? 1 : 0, data.default_message ?? null, data.updated_by ?? null, id]
    );
    if (data.locales) {
      await database.query('DELETE FROM g_message_template_locales WHERE template_id = ?', [id]);
      for (const loc of data.locales) {
        await database.query(
          `INSERT INTO g_message_template_locales (template_id, lang, message) VALUES (?, ?, ?)`,
          [id, loc.lang, loc.message]
        );
      }
    }
    return this.findById(id);
  }

  static async delete(id: number) {
    await database.query('DELETE FROM g_message_templates WHERE id = ?', [id]);
  }
}

