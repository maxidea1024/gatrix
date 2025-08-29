import database from '../config/database';

export interface TagAssignment {
  id: number;
  tagId: number;
  entityType: string;
  entityId: number;
  createdAt: string;
}

export default class TagAssignmentModel {
  static async setTagsForEntity(entityType: string, entityId: number, tagIds: number[]): Promise<void> {
    await database.transaction(async (conn) => {
      await conn.execute(`DELETE FROM g_tag_assignments WHERE entityType = ? AND entityId = ?`, [entityType, entityId]);
      for (const tagId of tagIds) {
        await conn.execute(`INSERT INTO g_tag_assignments (tagId, entityType, entityId) VALUES (?, ?, ?)`, [tagId, entityType, entityId]);
      }
    });
  }

  static async listTagsForEntity(entityType: string, entityId: number): Promise<any[]> {
    const rows = await database.query(
      `SELECT t.* FROM g_tag_assignments a JOIN g_tags t ON t.id = a.tagId WHERE a.entityType = ? AND a.entityId = ? ORDER BY t.name`,
      [entityType, entityId]
    );
    return rows;
  }
}

