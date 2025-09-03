import db from '../config/knex';

export interface TagAssignment {
  id: number;
  tagId: number;
  entityType: string;
  entityId: number;
  createdAt: string;
}

export default class TagAssignmentModel {
  static async setTagsForEntity(entityType: string, entityId: number, tagIds: number[]): Promise<void> {
    await db.transaction(async (trx) => {
      await trx('g_tag_assignments')
        .where('entityType', entityType)
        .where('entityId', entityId)
        .del();

      if (tagIds.length > 0) {
        const insertData = tagIds.map(tagId => ({
          tagId,
          entityType,
          entityId
        }));
        await trx('g_tag_assignments').insert(insertData);
      }
    });
  }

  static async listTagsForEntity(entityType: string, entityId: number): Promise<any[]> {
    const rows = await db('g_tag_assignments as a')
      .join('g_tags as t', 't.id', 'a.tagId')
      .select('t.*')
      .where('a.entityType', entityType)
      .where('a.entityId', entityId)
      .orderBy('t.name');
    return rows;
  }
}

