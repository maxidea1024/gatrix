import db from '../config/knex';
import { generateULID } from '../utils/ulid';

export interface TagAssignment {
  id: string;
  tagId: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}

export default class TagAssignmentModel {
  static async setTagsForEntity(
    entityType: string,
    entityId: string,
    tagIds: string[],
    createdBy?: string
  ): Promise<void> {
    await db.transaction(async (trx) => {
      await trx('g_tag_assignments')
        .where('entityType', entityType)
        .where('entityId', entityId)
        .del();

      if (tagIds.length > 0) {
        const insertData = tagIds.map((tagId) => ({
          id: generateULID(),
          tagId,
          entityType,
          entityId,
          createdBy: createdBy || '',
        }));
        await trx('g_tag_assignments').insert(insertData);
      }
    });
  }

  static async listTagsForEntity(
    entityType: string,
    entityId: string
  ): Promise<any[]> {
    const rows = await db('g_tag_assignments as a')
      .join('g_tags as t', 't.id', 'a.tagId')
      .select('t.*')
      .where('a.entityType', entityType)
      .where('a.entityId', entityId)
      .orderBy('t.name');
    return rows;
  }
}
