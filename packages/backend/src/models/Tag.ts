import db from '../config/knex';
import { getCurrentEnvironmentId } from '../utils/environmentContext';

export interface TagAttributes {
  id: number;
  environmentId: string; // ULID
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
  environmentId?: string; // ULID
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
  static async list(environmentId?: string): Promise<TagAttributes[]> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    return await db('g_tags as t')
      .leftJoin('g_users as c', 'c.id', 't.createdBy')
      .leftJoin('g_users as u', 'u.id', 't.updatedBy')
      .where('t.environmentId', envId)
      .select([
        't.*',
        'c.name as createdByName',
        'c.email as createdByEmail',
        'u.name as updatedByName',
        'u.email as updatedByEmail'
      ])
      .orderBy('t.createdAt', 'desc'); // Sort by most recent first
  }

  static async findById(id: number): Promise<TagAttributes | null> {
    const row = await db('g_tags').where('id', id).first();
    return row || null;
  }

  static async findByName(name: string, environmentId?: string): Promise<TagAttributes | null> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const row = await db('g_tags')
      .where('name', name)
      .where('environmentId', envId)
      .first();
    return row || null;
  }

  static async upsertByName(data: CreateTagData): Promise<TagAttributes> {
    const envId = data.environmentId ?? getCurrentEnvironmentId();
    const existing = await this.findByName(data.name, envId);
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
      environmentId: envId,
      name: data.name,
      color: data.color || '#607D8B',
      description: data.description || null,
      createdBy: data.createdBy ?? null
    });
    return (await this.findById(id))!;
  }

  static async create(data: CreateTagData): Promise<TagAttributes> {
    const envId = data.environmentId ?? getCurrentEnvironmentId();
    const insertData = {
      environmentId: envId,
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

