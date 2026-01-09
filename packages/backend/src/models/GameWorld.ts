import db from '../config/knex';
import logger from '../config/logger';
import { convertDateFieldsForMySQL, convertDateFieldsFromMySQL } from '../utils/dateUtils';

export interface GameWorldMaintenanceLocale {
  id?: number;
  gameWorldId: number;
  lang: 'ko' | 'en' | 'zh';
  message: string;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GameWorld {
  id: number;
  environment: string;
  worldId: string;
  name: string;
  isVisible: boolean;
  isMaintenance: boolean;
  displayOrder: number;
  description?: string;
  tags?: string | null;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  maintenanceMessageTemplateId?: number | null;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: GameWorldMaintenanceLocale[];
  forceDisconnect?: boolean; // Force disconnect existing players when maintenance starts
  gracePeriodMinutes?: number; // Grace period in minutes before disconnecting players
  customPayload?: Record<string, any> | null;
  infraSettings?: Record<string, any> | null; // Infrastructure settings for game server configuration (passed to SDK)
  infraSettingsRaw?: string | null; // Original JSON5 source for editing (preserves comments)
  worldServerAddress: string; // Required: URL or host:port format (e.g., https://world.example.com or world.example.com:8080)
  createdBy: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
}

export interface CreateGameWorldData {
  worldId: string;
  name: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  tags?: string | null;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  maintenanceMessageTemplateId?: number | null;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: GameWorldMaintenanceLocale[];
  forceDisconnect?: boolean;
  gracePeriodMinutes?: number;
  customPayload?: Record<string, any> | null;
  infraSettings?: Record<string, any> | null;
  infraSettingsRaw?: string | null; // Original JSON5 source for editing
  worldServerAddress: string; // Required: ip:port format (e.g., 192.168.1.100:8080)
  createdBy: number;
}

export interface UpdateGameWorldData {
  worldId?: string;
  name?: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  tags?: string | null;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  maintenanceMessageTemplateId?: number | null;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: GameWorldMaintenanceLocale[];
  forceDisconnect?: boolean;
  gracePeriodMinutes?: number;
  customPayload?: Record<string, any> | null;
  infraSettings?: Record<string, any> | null;
  infraSettingsRaw?: string | null; // Original JSON5 source for editing
  worldServerAddress?: string | null;
  updatedBy?: number;
}

export interface GameWorldListParams {
  environment: string;
  search?: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  tags?: string; // comma-separated; filtering uses LIKE per tag
}

export class GameWorldModel {
  static async findById(id: number, environment: string): Promise<GameWorld | null> {
    try {
      return await this.findByIdWith(db, id, environment);
    } catch (error) {
      logger.error('Error finding game world by ID:', error);
      throw error;
    }
  }

  // Use provided connection/transaction to ensure visibility inside transactions
  static async findByIdWith(conn: any, id: number, environment: string): Promise<GameWorld | null> {
    const gameWorld = await conn('g_game_worlds as gw')
      .leftJoin('g_users as c', 'gw.createdBy', 'c.id')
      .leftJoin('g_users as u', 'gw.updatedBy', 'u.id')
      .select([
        'gw.*',
        'c.name as createdByName',
        'u.name as updatedByName'
      ])
      .where('gw.id', id)
      .where('gw.environment', environment)
      .first();

    if (!gameWorld) {
      return null;
    }

    // 점검 메시지 로케일 정보 로드
    const maintenanceLocales = await conn('g_game_world_maintenance_locales')
      .where('gameWorldId', id)
      .select('lang', 'message');

    return convertDateFieldsFromMySQL({
      ...gameWorld,
      maintenanceLocales: maintenanceLocales || []
    }, ['createdAt', 'updatedAt', 'maintenanceStartDate', 'maintenanceEndDate']) as GameWorld;
  }

  static async findByWorldId(worldId: string, environment: string): Promise<GameWorld | null> {
    try {
      const gameWorld = await db('g_game_worlds')
        .where('worldId', worldId)
        .where('environment', environment)
        .first();

      if (!gameWorld) return null;
      return convertDateFieldsFromMySQL(gameWorld, ['createdAt', 'updatedAt', 'maintenanceStartDate', 'maintenanceEndDate']) as GameWorld;
    } catch (error) {
      logger.error('Error finding game world by world ID:', error);
      throw error;
    }
  }

  static async list(params: GameWorldListParams): Promise<GameWorld[]> {
    try {
      const {
        environment,
        search = '',
        isVisible,
        isMaintenance,
        tags,
      } = params;

      // Convert raw SQL to knex query builder
      let query = db('g_game_worlds as gw')
        .leftJoin('g_users as c', 'gw.createdBy', 'c.id')
        .leftJoin('g_users as u', 'gw.updatedBy', 'u.id')
        .select([
          'gw.*',
          'c.name as createdByName',
          'c.email as createdByEmail',
          'u.name as updatedByName',
          'u.email as updatedByEmail'
        ])
        .where('gw.environment', environment); // Filter by environment

      // Apply search filter
      if (search) {
        query = query.where(function () {
          this.where('gw.name', 'like', `%${search}%`)
            .orWhere('gw.worldId', 'like', `%${search}%`)
            .orWhere('gw.description', 'like', `%${search}%`)
            .orWhere('gw.tags', 'like', `%${search}%`);
        });
      }

      // Apply visibility filter
      if (isVisible !== undefined) {
        query = query.where('gw.isVisible', isVisible);
      }

      // Apply maintenance filter
      if (isMaintenance !== undefined) {
        query = query.where('gw.isMaintenance', isMaintenance);
      }

      // Apply tags filter
      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        if (tagArray.length > 0) {
          query = query.where(function () {
            tagArray.forEach((tag, index) => {
              if (index === 0) {
                this.where('gw.tags', 'like', `%${tag}%`);
              } else {
                this.andWhere('gw.tags', 'like', `%${tag}%`);
              }
            });
          });
        }
      }

      const worlds = await query.orderBy('gw.displayOrder', 'ASC');

      // 각 게임월드에 대해 maintenanceLocales 추가
      const worldsWithLocales = await Promise.all(
        worlds.map(async (world: any) => {
          const maintenanceLocales = await db('g_game_world_maintenance_locales')
            .where('gameWorldId', world.id)
            .select('lang', 'message');

          return convertDateFieldsFromMySQL({
            ...world,
            maintenanceLocales: maintenanceLocales || []
          }, ['createdAt', 'updatedAt', 'maintenanceStartDate', 'maintenanceEndDate']) as GameWorld;
        })
      );

      return worldsWithLocales;
    } catch (error) {
      logger.error('Error listing game worlds:', error);
      throw error;
    }
  }

  static async create(worldData: CreateGameWorldData, environment: string): Promise<GameWorld> {
    try {
      // Get the next display order if not provided (within the same environment)
      let displayOrder = worldData.displayOrder;
      if (displayOrder === undefined) {
        // Get the maximum display order to place new world at the top (when sorted DESC)
        const maxOrderResult = await db('g_game_worlds')
          .where('environment', environment)
          .max('displayOrder as maxOrder')
          .first();
        displayOrder = (maxOrderResult?.maxOrder || 0) + 10;
      }

      // Validate createdBy
      if (!worldData.createdBy || typeof worldData.createdBy !== 'number') {
        throw new Error(`Invalid createdBy value: ${worldData.createdBy}`);
      }

      return await db.transaction(async (trx) => {
        // maintenanceLocales 필드는 별도 테이블에서 관리하므로 제거
        const { maintenanceLocales, ...gameWorldData } = worldData;

        const insertData = {
          environment: environment,
          worldId: gameWorldData.worldId,
          name: gameWorldData.name,
          isVisible: gameWorldData.isVisible ?? true,
          isMaintenance: gameWorldData.isMaintenance ?? false,
          displayOrder,
          description: gameWorldData.description || null,
          tags: gameWorldData.tags || null,
          maintenanceStartDate: gameWorldData.maintenanceStartDate || null,
          maintenanceEndDate: gameWorldData.maintenanceEndDate || null,
          maintenanceMessage: gameWorldData.maintenanceMessage || null,
          supportsMultiLanguage: gameWorldData.supportsMultiLanguage ?? false,
          customPayload: gameWorldData.customPayload ?? {},
          infraSettings: gameWorldData.infraSettings ?? null,
          infraSettingsRaw: gameWorldData.infraSettingsRaw ?? null,
          worldServerAddress: gameWorldData.worldServerAddress, // Required field
          createdBy: gameWorldData.createdBy
        };

        // 날짜 필드들을 MySQL DATETIME 형식으로 변환
        const convertedData = convertDateFieldsForMySQL(insertData, ['createdAt', 'updatedAt', 'maintenanceStartDate', 'maintenanceEndDate']);

        const [insertId] = await trx('g_game_worlds').insert(convertedData);

        // 점검 메시지 로케일 처리
        if (maintenanceLocales && maintenanceLocales.length > 0) {
          const localeInserts = maintenanceLocales.map((locale: any) => ({
            gameWorldId: insertId,
            lang: locale.lang,
            message: locale.message,
            createdBy: worldData.createdBy,
            updatedBy: worldData.createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
          }));

          await trx('g_game_world_maintenance_locales').insert(localeInserts);
        }

        // Use the same transaction connection to ensure visibility before commit
        const world = await this.findByIdWith(trx, insertId, environment);
        if (!world) {
          throw new Error('Failed to create game world');
        }

        return world;
      });
    } catch (error) {
      logger.error('Error creating game world:', error);
      throw error;
    }
  }

  static async update(id: number, worldData: UpdateGameWorldData, environment: string): Promise<GameWorld | null> {
    try {
      return await db.transaction(async (trx) => {
        // maintenanceLocales 필드는 별도 테이블에서 관리하므로 제거
        const { maintenanceLocales, ...gameWorldUpdateData } = worldData;

        const updateData: any = {};

        Object.entries(gameWorldUpdateData).forEach(([key, value]) => {
          if (value !== undefined) {
            // customPayload, infraSettings는 JSON 문자열로 변환
            if (key === 'customPayload' || key === 'infraSettings') {
              updateData[key] = value === null ? null : JSON.stringify(value);
            } else {
              updateData[key] = value;
            }
          }
        });

        // 날짜 필드들을 MySQL DATETIME 형식으로 변환
        const convertedUpdateData = convertDateFieldsForMySQL(updateData, ['createdAt', 'updatedAt', 'maintenanceStartDate', 'maintenanceEndDate']);

        if (Object.keys(convertedUpdateData).length > 0) {
          convertedUpdateData.updatedAt = db.fn.now();

          await trx('g_game_worlds')
            .where('id', id)
            .where('environment', environment)
            .update(convertedUpdateData);
        }

        // 점검 메시지 로케일 처리
        if (maintenanceLocales !== undefined) {
          // 기존 로케일 삭제
          await trx('g_game_world_maintenance_locales')
            .where('gameWorldId', id)
            .del();

          // 새 로케일 추가
          if (maintenanceLocales.length > 0) {
            const localeInserts = maintenanceLocales.map((locale: any) => ({
              gameWorldId: id,
              lang: locale.lang,
              message: locale.message,
              createdBy: worldData.updatedBy,
              updatedBy: worldData.updatedBy,
              createdAt: new Date(),
              updatedAt: new Date()
            }));

            await trx('g_game_world_maintenance_locales').insert(localeInserts);
          }
        }

        // Use findByIdWith to read updated data within the same transaction
        return this.findByIdWith(trx, id, environment);
      });
    } catch (error) {
      logger.error('Error updating game world:', error);
      throw error;
    }
  }

  static async delete(id: number, environment: string): Promise<boolean> {
    try {
      const result = await db('g_game_worlds')
        .where('id', id)
        .where('environment', environment)
        .del();

      return result > 0;
    } catch (error) {
      logger.error('Error deleting game world:', error);
      throw error;
    }
  }

  static async exists(worldId: string, id: number, environment: string): Promise<boolean> {
    try {
      const result = await db('g_game_worlds')
        .where('worldId', worldId)
        .where('environment', environment)
        .whereNot('id', id)
        .count('* as count')
        .first();

      return Number(result?.count || 0) > 0;
    } catch (error) {
      logger.error('Error checking game world existence:', error);
      throw error;
    }
  }

  static async updateDisplayOrders(orderUpdates: { id: number; displayOrder: number }[], environment: string): Promise<void> {
    try {
      await db.transaction(async (trx) => {
        for (const update of orderUpdates) {
          const result = await trx('g_game_worlds')
            .where('id', update.id)
            .where('environment', environment)
            .update({
              displayOrder: update.displayOrder,
              updatedAt: db.fn.now()
            });

          if (result === 0) {
            throw new Error(`No game world found with id ${update.id} in environment ${environment}`);
          }
        }
      });

      logger.info('Successfully updated all display orders');
    } catch (error) {
      logger.error('Error updating display orders:', error);
      throw error;
    }
  }

  static async moveUp(id: number, environment: string): Promise<boolean> {
    try {
      // Get current world
      const currentWorld = await this.findById(id, environment);
      if (!currentWorld) return false;

      // Find the world with the next lower displayOrder
      const prevWorld = await db('g_game_worlds')
        .where('environment', environment)
        .where('displayOrder', '<', currentWorld.displayOrder)
        .orderBy('displayOrder', 'desc')
        .first();

      if (!prevWorld) return false; // Already at top

      // Swap display orders
      await db('g_game_worlds')
        .where('id', currentWorld.id)
        .where('environment', environment)
        .update({ displayOrder: prevWorld.displayOrder });

      await db('g_game_worlds')
        .where('id', prevWorld.id)
        .where('environment', environment)
        .update({ displayOrder: currentWorld.displayOrder });

      return true;
    } catch (error) {
      logger.error('Error moving world up:', error);
      throw error;
    }
  }

  static async moveDown(id: number, environment: string): Promise<boolean> {
    try {
      // Get current world
      const currentWorld = await this.findById(id, environment);
      if (!currentWorld) return false;

      // Find the world with the next higher displayOrder
      const nextWorld = await db('g_game_worlds')
        .where('environment', environment)
        .where('displayOrder', '>', currentWorld.displayOrder)
        .orderBy('displayOrder', 'asc')
        .first();

      if (!nextWorld) return false; // Already at bottom

      // Swap display orders
      await db('g_game_worlds')
        .where('id', currentWorld.id)
        .where('environment', environment)
        .update({ displayOrder: nextWorld.displayOrder });

      await db('g_game_worlds')
        .where('id', nextWorld.id)
        .where('environment', environment)
        .update({ displayOrder: currentWorld.displayOrder });

      return true;
    } catch (error) {
      logger.error('Error moving world down:', error);
      throw error;
    }
  }
}
