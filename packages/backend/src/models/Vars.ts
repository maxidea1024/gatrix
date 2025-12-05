import db from '../config/knex';
import { getCurrentEnvironmentId } from '../utils/environmentContext';

export type VarValueType = 'string' | 'number' | 'boolean' | 'color' | 'object' | 'array';

export interface VarItem {
  id: number;
  environmentId: string;
  varKey: string;
  varValue: string | null;
  valueType: VarValueType;
  description: string | null;
  isSystemDefined: boolean;
  isCopyable: boolean;
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
  static async get(key: string, environmentId?: string): Promise<string | null> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const result = await db('g_vars')
      .select('varValue')
      .where('varKey', key)
      .where('environmentId', envId)
      .first();

    return result?.varValue ?? null;
  }

  static async set(key: string, value: string | null, userId: number, environmentId?: string): Promise<void> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    await db('g_vars')
      .insert({ varKey: key, varValue: value, createdBy: userId, environmentId: envId })
      .onConflict(['varKey', 'environmentId'])
      .merge({ varValue: value, updatedBy: userId });
  }

  /**
   * Get all KV items (keys starting with 'kv:' or '$')
   */
  static async getAllKV(environmentId?: string): Promise<VarItem[]> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const results = await db('g_vars as v')
      .leftJoin('g_users as creator', 'v.createdBy', 'creator.id')
      .leftJoin('g_users as updater', 'v.updatedBy', 'updater.id')
      .select(
        'v.*',
        'creator.name as createdByName',
        'updater.name as updatedByName'
      )
      .where('v.environmentId', envId)
      .where((builder) => {
        builder.where('v.varKey', 'like', 'kv:%').orWhere('v.varKey', 'like', '$%');
      })
      .orderBy('v.varKey', 'asc');

    // Convert MySQL boolean (0/1) to JavaScript boolean
    return results.map(item => ({
      ...item,
      isSystemDefined: Boolean(item.isSystemDefined),
      isCopyable: Boolean(item.isCopyable),
    }));
  }

  /**
   * Get a single KV item by key
   */
  static async getKV(key: string, environmentId?: string): Promise<VarItem | null> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const result = await db('g_vars as v')
      .leftJoin('g_users as creator', 'v.createdBy', 'creator.id')
      .leftJoin('g_users as updater', 'v.updatedBy', 'updater.id')
      .select(
        'v.*',
        'creator.name as createdByName',
        'updater.name as updatedByName'
      )
      .where('v.varKey', key)
      .where('v.environmentId', envId)
      .first();

    if (!result) {
      return null;
    }

    // Convert MySQL boolean (0/1) to JavaScript boolean
    return {
      ...result,
      isSystemDefined: Boolean(result.isSystemDefined),
      isCopyable: Boolean(result.isCopyable),
    };
  }

  /**
   * Create a new KV item
   */
  static async createKV(data: CreateVarData, userId: number, environmentId?: string): Promise<VarItem> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    // Ensure key starts with 'kv:'
    const key = data.varKey.startsWith('kv:') ? data.varKey : `kv:${data.varKey}`;

    await db('g_vars').insert({
      varKey: key,
      varValue: data.varValue,
      valueType: data.valueType,
      description: data.description || null,
      isSystemDefined: false,
      createdBy: userId,
      environmentId: envId,
    });

    const created = await this.getKV(key, envId);
    if (!created) {
      throw new Error('Failed to create KV item');
    }
    return created;
  }

  /**
   * Update an existing KV item
   */
  static async updateKV(key: string, data: UpdateVarData, userId: number, environmentId?: string): Promise<VarItem> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    // Check if item exists and is not system-defined for type changes
    const existing = await this.getKV(key, envId);
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
      .where('environmentId', envId)
      .update(updateData);

    const updated = await this.getKV(key, envId);
    if (!updated) {
      throw new Error('Failed to update KV item');
    }
    return updated;
  }

  /**
   * Delete a KV item (only if not system-defined)
   */
  static async deleteKV(key: string, environmentId?: string): Promise<void> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const existing = await this.getKV(key, envId);
    if (!existing) {
      throw new Error('KV item not found');
    }

    if (existing.isSystemDefined) {
      throw new Error('Cannot delete system-defined KV item');
    }

    await db('g_vars')
      .where('varKey', key)
      .where('environmentId', envId)
      .delete();
  }

  /**
   * Programmatically define a system KV item
   * If the item already exists, only update description and isSystemDefined flag
   * Do NOT overwrite existing values
   */
  static async defineSystemKV(
    key: string,
    value: string | null,
    valueType: VarValueType,
    description?: string,
    isCopyable: boolean = true,
    environmentId?: string
  ): Promise<void> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const fullKey = key.startsWith('kv:') || key.startsWith('$') ? key : `kv:${key}`;

    // Check if item already exists
    const existing = await this.getKV(fullKey, envId);

    if (existing) {
      // Item exists: only update description and ensure isSystemDefined is true
      await db('g_vars')
        .where('varKey', fullKey)
        .where('environmentId', envId)
        .update({
          description: description || existing.description || null,
          isSystemDefined: true,
          isCopyable,
        });
    } else {
      // Item doesn't exist: create it with initial value
      await db('g_vars').insert({
        varKey: fullKey,
        varValue: value,
        valueType,
        description: description || null,
        isSystemDefined: true,
        isCopyable,
        createdBy: 1, // System user
        environmentId: envId,
      });
    }
  }
}
