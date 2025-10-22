import db from '../config/knex';

export type VarValueType = 'string' | 'number' | 'boolean' | 'color' | 'object' | 'array';

export interface VarItem {
  id: number;
  varKey: string;
  varValue: string | null;
  valueType: VarValueType;
  description: string | null;
  isSystemDefined: boolean;
  createdBy: number;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdByName?: string;
  updatedByName?: string;
}

export interface CreateVarData {
  varKey: string;
  varValue: string | null;
  valueType: VarValueType;
  description?: string | null;
}

export interface UpdateVarData {
  varValue: string | null;
  valueType?: VarValueType;
  description?: string | null;
}

export default class VarsModel {
  static async get(key: string): Promise<string | null> {
    const result = await db('g_vars')
      .select('varValue')
      .where('varKey', key)
      .first();

    return result?.varValue ?? null;
  }

  static async set(key: string, value: string | null, userId: number): Promise<void> {
    await db('g_vars')
      .insert({ varKey: key, varValue: value, createdBy: userId })
      .onConflict('varKey')
      .merge({ varValue: value, updatedBy: userId });
  }

  /**
   * Get all KV items (keys starting with 'kv:')
   */
  static async getAllKV(): Promise<VarItem[]> {
    const results = await db('g_vars as v')
      .leftJoin('g_users as creator', 'v.createdBy', 'creator.id')
      .leftJoin('g_users as updater', 'v.updatedBy', 'updater.id')
      .select(
        'v.*',
        'creator.name as createdByName',
        'updater.name as updatedByName'
      )
      .where('v.varKey', 'like', 'kv:%')
      .orderBy('v.varKey', 'asc');

    // Convert MySQL boolean (0/1) to JavaScript boolean
    return results.map(item => ({
      ...item,
      isSystemDefined: Boolean(item.isSystemDefined),
    }));
  }

  /**
   * Get a single KV item by key
   */
  static async getKV(key: string): Promise<VarItem | null> {
    const result = await db('g_vars as v')
      .leftJoin('g_users as creator', 'v.createdBy', 'creator.id')
      .leftJoin('g_users as updater', 'v.updatedBy', 'updater.id')
      .select(
        'v.*',
        'creator.name as createdByName',
        'updater.name as updatedByName'
      )
      .where('v.varKey', key)
      .first();

    if (!result) {
      return null;
    }

    // Convert MySQL boolean (0/1) to JavaScript boolean
    return {
      ...result,
      isSystemDefined: Boolean(result.isSystemDefined),
    };
  }

  /**
   * Create a new KV item
   */
  static async createKV(data: CreateVarData, userId: number): Promise<VarItem> {
    // Ensure key starts with 'kv:'
    const key = data.varKey.startsWith('kv:') ? data.varKey : `kv:${data.varKey}`;

    await db('g_vars').insert({
      varKey: key,
      varValue: data.varValue,
      valueType: data.valueType,
      description: data.description || null,
      isSystemDefined: false,
      createdBy: userId,
    });

    const created = await this.getKV(key);
    if (!created) {
      throw new Error('Failed to create KV item');
    }
    return created;
  }

  /**
   * Update an existing KV item
   */
  static async updateKV(key: string, data: UpdateVarData, userId: number): Promise<VarItem> {
    // Check if item exists and is not system-defined for type changes
    const existing = await this.getKV(key);
    if (!existing) {
      throw new Error('KV item not found');
    }

    if (existing.isSystemDefined && data.valueType && data.valueType !== existing.valueType) {
      throw new Error('Cannot change type of system-defined KV item');
    }

    const updateData: any = {
      varValue: data.varValue,
      updatedBy: userId,
    };

    // Only update valueType if not system-defined
    if (!existing.isSystemDefined && data.valueType) {
      updateData.valueType = data.valueType;
    }

    if (data.description !== undefined) {
      updateData.description = data.description;
    }

    await db('g_vars')
      .where('varKey', key)
      .update(updateData);

    const updated = await this.getKV(key);
    if (!updated) {
      throw new Error('Failed to update KV item');
    }
    return updated;
  }

  /**
   * Delete a KV item (only if not system-defined)
   */
  static async deleteKV(key: string): Promise<void> {
    const existing = await this.getKV(key);
    if (!existing) {
      throw new Error('KV item not found');
    }

    if (existing.isSystemDefined) {
      throw new Error('Cannot delete system-defined KV item');
    }

    await db('g_vars')
      .where('varKey', key)
      .delete();
  }

  /**
   * Programmatically define a system KV item
   */
  static async defineSystemKV(
    key: string,
    value: string | null,
    valueType: VarValueType,
    description?: string
  ): Promise<void> {
    const fullKey = key.startsWith('kv:') ? key : `kv:${key}`;

    await db('g_vars')
      .insert({
        varKey: fullKey,
        varValue: value,
        valueType,
        description: description || null,
        isSystemDefined: true,
        createdBy: 1, // System user
      })
      .onConflict('varKey')
      .merge({
        varValue: value,
        valueType,
        description: description || null,
        isSystemDefined: true,
      });
  }
}
