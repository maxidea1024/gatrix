import db from '../config/knex';

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
  createdByEmail?: string | null;
  updatedByEmail?: string | null;
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
    return await db('g_tags as t')
      .leftJoin('g_users as c', 'c.id', 't.createdBy')
      .leftJoin('g_users as u', 'u.id', 't.updatedBy')
      .select([
        't.*',
        'c.name as createdByName',
        'c.email as createdByEmail',
        'u.name as updatedByName',
        'u.email as updatedByEmail'
      ])
      .orderBy('t.name', 'asc');
  }

  static async findById(id: number): Promise<TagAttributes | null> {
    const row = await db('g_tags').where('id', id).first();
    return row || null;
  }

  static async findByName(name: string): Promise<TagAttributes | null> {
    const row = await db('g_tags').where('name', name).first();
    return row || null;
  }

  static async upsertByName(data: CreateTagData): Promise<TagAttributes> {
    const existing = await this.findByName(data.name);
    if (existing) {
      await db('g_tags')
        .where('id', existing.id)
        .update({
          color: data.color || existing.color,
          description: data.description ?? existing.description ?? null,
          updatedBy: data.createdBy ?? existing.updatedBy ?? null,
          updatedAt: db.fn.now()
        });
      return (await this.findById(existing.id))!;
    }
    const [id] = await db('g_tags').insert({
      name: data.name,
      color: data.color || '#607D8B',
      description: data.description || null,
      createdBy: data.createdBy ?? null
    });
    return (await this.findById(id))!;
  }

  static async create(data: CreateTagData): Promise<TagAttributes> {
    const insertData = {
      name: data.name,
      color: data.color || '#607D8B',
      description: data.description || null,
      createdBy: data.createdBy ?? null
    };
    const [id] = await db('g_tags').insert(insertData);
    return (await this.findById(id))!;
  }

  static async update(id: number, data: UpdateTagData): Promise<TagAttributes | null> {
    const updateData: any = {};
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) {
        updateData[k] = v;
      }
    });

    if (Object.keys(updateData).length === 0) {
      return this.findById(id);
    }

    updateData.updatedAt = db.fn.now();

    await db('g_tags')
      .where('id', id)
      .update(updateData);

    return this.findById(id);
  }

  static async delete(id: number): Promise<void> {
    await db('g_tags').where('id', id).del();
  }
}

