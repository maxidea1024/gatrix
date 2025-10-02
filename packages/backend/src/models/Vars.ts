import db from '../config/knex';

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
}
