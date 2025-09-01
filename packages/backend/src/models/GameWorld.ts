import db from '../config/knex';
import database from '../config/database';
import logger from '../config/logger';

export interface GameWorld {
  id: number;
  worldId: string;
  name: string;
  isVisible: boolean;
  isMaintenance: boolean;
  displayOrder: number;
  description?: string;
  tags?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameWorldData {
  worldId: string;
  name: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  tags?: string | null;
}

export interface UpdateGameWorldData {
  worldId?: string;
  name?: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  tags?: string | null;
}

export interface GameWorldListParams {
  search?: string;
  sortBy?: 'name' | 'worldId' | 'displayOrder' | 'createdAt' | 'updatedAt';
  sortOrder?: 'ASC' | 'DESC';
  isVisible?: boolean;
  isMaintenance?: boolean;
  tags?: string; // comma-separated; filtering uses LIKE per tag
}

export class GameWorldModel {
  static async findById(id: number): Promise<GameWorld | null> {
    try {
      const gameWorld = await db('g_game_worlds')
        .where('id', id)
        .first();

      return gameWorld || null;
    } catch (error) {
      logger.error('Error finding game world by ID:', error);
      throw error;
    }
  }

  static async findByWorldId(worldId: string): Promise<GameWorld | null> {
    try {
      const gameWorld = await db('g_game_worlds')
        .where('worldId', worldId)
        .first();

      return gameWorld || null;
    } catch (error) {
      logger.error('Error finding game world by world ID:', error);
      throw error;
    }
  }

  static async list(params: GameWorldListParams = {}): Promise<GameWorld[]> {
    try {
      const {
        search = '',
        sortBy = 'displayOrder',
        sortOrder = 'ASC',
        isVisible,
        isMaintenance,
      } = params;

      // Build WHERE clause
      const whereConditions: string[] = [];
      const queryParams: any[] = [];

      if (search) {
        whereConditions.push('(name LIKE ? OR worldId LIKE ? OR description LIKE ? OR tags LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      if (isVisible !== undefined) {
        whereConditions.push('isVisible = ?');
        queryParams.push(isVisible);
      }

      if (params.isMaintenance !== undefined) {
        whereConditions.push('isMaintenance = ?');
        queryParams.push(params.isMaintenance);
      }

      if (params.tags) {
        const tags = params.tags.split(',').map(t => t.trim()).filter(Boolean);
        if (tags.length > 0) {
          tags.forEach(tag => {
            whereConditions.push('tags LIKE ?');
            queryParams.push(`%${tag}%`);
          });
        }
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      const dataQuery = `
        SELECT * FROM g_game_worlds
        ${whereClause}
        ORDER BY ${sortBy} ${sortOrder}
      `;

      const worlds = await database.query(dataQuery, queryParams);
      return worlds;
    } catch (error) {
      logger.error('Error listing game worlds:', error);
      throw error;
    }
  }

  static async create(worldData: CreateGameWorldData): Promise<GameWorld> {
    try {
      // Get the next display order if not provided
      let displayOrder = worldData.displayOrder;
      if (displayOrder === undefined) {
        // Get the minimum display order to place new world at the top
        const minOrderResult = await database.query(
          'SELECT COALESCE(MIN(displayOrder), 10) - 10 as nextOrder FROM g_game_worlds'
        );
        displayOrder = minOrderResult[0].nextOrder;
      }

      const result = await database.query(
        `INSERT INTO g_game_worlds (worldId, name, isVisible, isMaintenance, displayOrder, description, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          worldData.worldId,
          worldData.name,
          worldData.isVisible ?? true,
          worldData.isMaintenance ?? false,
          displayOrder,
          worldData.description || null,
          worldData.tags || null
        ]
      );

      const world = await this.findById(result.insertId);
      if (!world) {
        throw new Error('Failed to create game world');
      }

      return world;
    } catch (error) {
      logger.error('Error creating game world:', error);
      throw error;
    }
  }

  static async update(id: number, worldData: UpdateGameWorldData): Promise<GameWorld | null> {
    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];

      Object.entries(worldData).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          updateValues.push(value);
        }
      });

      if (updateFields.length === 0) {
        return this.findById(id);
      }

      updateValues.push(id);

      await database.query(
        `UPDATE g_game_worlds SET ${updateFields.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues
      );

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating game world:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await database.query(
        'DELETE FROM g_game_worlds WHERE id = ?',
        [id]
      );

      return result.affectedRows > 0;
    } catch (error) {
      logger.error('Error deleting game world:', error);
      throw error;
    }
  }

  static async exists(worldId: string, excludeId?: number): Promise<boolean> {
    try {
      let query = 'SELECT COUNT(*) as count FROM g_game_worlds WHERE worldId = ?';
      const params: any[] = [worldId];

      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }

      const result = await database.query(query, params);
      return result[0].count > 0;
    } catch (error) {
      logger.error('Error checking game world existence:', error);
      throw error;
    }
  }

  static async updateDisplayOrders(orderUpdates: { id: number; displayOrder: number }[]): Promise<void> {
    try {
      // logger.info('Updating display orders for game worlds:', orderUpdates);

      await database.transaction(async (connection) => {
        for (const update of orderUpdates) {
          const [result] = await connection.execute(
            'UPDATE g_game_worlds SET displayOrder = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
            [update.displayOrder, update.id]
          ) as any;

          // logger.info(`Updated world ${update.id} with displayOrder ${update.displayOrder}, affected rows: ${result.affectedRows}`);

          if (result.affectedRows === 0) {
            throw new Error(`No game world found with id ${update.id}`);
          }
        }
      });

      logger.info('Successfully updated all display orders');
    } catch (error) {
      logger.error('Error updating display orders:', error);
      throw error;
    }
  }

  static async moveUp(id: number): Promise<boolean> {
    try {
      // Get current world
      const currentWorld = await this.findById(id);
      if (!currentWorld) return false;

      // Find the world with the next lower displayOrder
      const prevWorlds = await database.query(
        'SELECT * FROM g_game_worlds WHERE displayOrder < ? ORDER BY displayOrder DESC LIMIT 1',
        [currentWorld.displayOrder]
      );

      if (prevWorlds.length === 0) return false; // Already at top

      const prevWorld = prevWorlds[0];

      // Swap display orders
      await database.query(
        'UPDATE g_game_worlds SET displayOrder = ? WHERE id = ?',
        [prevWorld.displayOrder, currentWorld.id]
      );

      await database.query(
        'UPDATE g_game_worlds SET displayOrder = ? WHERE id = ?',
        [currentWorld.displayOrder, prevWorld.id]
      );

      return true;
    } catch (error) {
      logger.error('Error moving world up:', error);
      throw error;
    }
  }

  static async moveDown(id: number): Promise<boolean> {
    try {
      // Get current world
      const currentWorld = await this.findById(id);
      if (!currentWorld) return false;

      // Find the world with the next higher displayOrder
      const nextWorlds = await database.query(
        'SELECT * FROM g_game_worlds WHERE displayOrder > ? ORDER BY displayOrder ASC LIMIT 1',
        [currentWorld.displayOrder]
      );

      if (nextWorlds.length === 0) return false; // Already at bottom

      const nextWorld = nextWorlds[0];

      // Swap display orders
      await database.query(
        'UPDATE g_game_worlds SET displayOrder = ? WHERE id = ?',
        [nextWorld.displayOrder, currentWorld.id]
      );

      await database.query(
        'UPDATE g_game_worlds SET displayOrder = ? WHERE id = ?',
        [currentWorld.displayOrder, nextWorld.id]
      );

      return true;
    } catch (error) {
      logger.error('Error moving world down:', error);
      throw error;
    }
  }
}
