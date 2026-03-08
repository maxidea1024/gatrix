import db from '../config/knex';
import { generateULID } from '../utils/ulid';

export interface TagAttributes {
  id: string;
  projectId?: string | null;
  name: string;
  color: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdByName?: string | null;
  updatedByName?: string | null;
  createdByEmail?: string | null;
  updatedByEmail?: string | null;
}

export interface CreateTagData {
  name: string;
  color?: string;
  description?: string | null;
  projectId?: string | null;
  createdBy?: string | null;
}

export interface UpdateTagData {
  name?: string;
  color?: string;
  description?: string | null;
  updatedBy?: string | null;
}

export default class TagModel {
  static async list(projectId?: string): Promise<TagAttributes[]> {
    const query = db('g_tags as t')
      .leftJoin('g_users as c', 'c.id', 't.createdBy')
      .leftJoin('g_users as u', 'u.id', 't.updatedBy')
      .select([
        't.*',
        'c.name as createdByName',
        'c.email as createdByEmail',
        'u.name as updatedByName',
        'u.email as updatedByEmail',
      ])
      .orderBy('t.createdAt', 'desc');

    if (projectId) {
      query.where('t.projectId', projectId);
    }

    return await query;
  }

  static async findById(id: string): Promise<TagAttributes | null> {
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
          updatedAt: db.fn.now(),
        });
      return (await this.findById(existing.id))!;
    }
    const newId = generateULID();
    await db('g_tags').insert({
      id: newId,
      name: data.name,
      color: data.color || '#607D8B',
      description: data.description || null,
      createdBy: data.createdBy ?? null,
    });
    return (await this.findById(newId))!;
  }

  static async create(data: CreateTagData): Promise<TagAttributes> {
    const insertData: any = {
      name: data.name,
      color: data.color || '#607D8B',
      description: data.description || null,
      createdBy: data.createdBy ?? null,
    };
    if (data.projectId) {
      insertData.projectId = data.projectId;
    }
    const newId = generateULID();
    await db('g_tags').insert({ id: newId, ...insertData });
    return (await this.findById(newId))!;
  }

  static async update(
    id: string,
    data: UpdateTagData
  ): Promise<TagAttributes | null> {
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

    await db('g_tags').where('id', id).update(updateData);

    return this.findById(id);
  }

  static async delete(id: string): Promise<void> {
    await db('g_tags').where('id', id).del();
  }
}
