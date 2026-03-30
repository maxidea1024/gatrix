import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';
import TagAssignmentModel from './tag-assignment';

const logger = createLogger('ClientVersion');

export interface ClientVersionFilters {
  projectId?: string;
  targetEnv?: string; // Filter by target environment
  clientVersion?: string | string[];
  platform?: string | string[];
  clientStatus?: string | string[];
  guestModeAllowed?: boolean | boolean[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  tags?: string[];
  tagsOperator?: 'any_of' | 'include_all'; // For tags filtering logic
}

export interface ClientVersionListResult {
  clientVersions: any[];
  total: number;
}

export enum ClientStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  RECOMMENDED_UPDATE = 'RECOMMENDED_UPDATE',
  FORCED_UPDATE = 'FORCED_UPDATE',
  UNDER_REVIEW = 'UNDER_REVIEW',
  BLOCKED_PATCH_ALLOWED = 'BLOCKED_PATCH_ALLOWED',
  MAINTENANCE = 'MAINTENANCE',
}

export interface ClientVersionAttributes {
  id?: string;
  projectId: string;
  targetEnv?: string; // Target environment ID for dynamic env routing
  clientVersion: string;
  platform: string;
  clientStatus: ClientStatus;
  gameServerAddress?: string;
  gameServerAddressForWhiteList?: string;
  patchAddress?: string;
  patchAddressForWhiteList?: string;
  guestModeAllowed?: boolean;
  externalClickLink?: string;
  memo?: string;
  customPayload?: string;
  maintenanceStartDate?: Date;
  maintenanceEndDate?: Date;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  minPatchVersion?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClientVersionMaintenanceLocale {
  id?: string;
  clientVersionId: string;
  lang: 'ko' | 'en' | 'zh';
  message: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ClientVersionCreationAttributes extends Omit<
  ClientVersionAttributes,
  'id' | 'createdAt' | 'updatedAt'
> {
  maintenanceLocales?: Omit<
    ClientVersionMaintenanceLocale,
    'id' | 'clientVersionId' | 'createdAt' | 'updatedAt'
  >[];
}

export interface BulkCreateClientVersionRequest {
  clientVersions: ClientVersionCreationAttributes[];
}

export class ClientVersionModel {
  // Get available version list (distinct)
  static async getDistinctVersions(projectId: string): Promise<string[]> {
    try {
      const result = await db('g_client_versions')
        .distinct('clientVersion')
        .where('projectId', projectId)
        .orderBy('clientVersion', 'desc');

      return result.map((row) => row.clientVersion);
    } catch (error) {
      logger.error('Error getting distinct versions:', error);
      throw error;
    }
  }

  static async findAll(
    filters: ClientVersionFilters
  ): Promise<ClientVersionListResult> {
    try {
      // Set default values
      const limit = filters?.limit
        ? parseInt(filters.limit.toString(), 10)
        : 10;
      const offset = filters?.offset
        ? parseInt(filters.offset.toString(), 10)
        : 0;
      const sortBy = filters?.sortBy || 'clientVersion';
      const sortOrder = filters?.sortOrder || 'DESC';
      const projectId = filters.projectId;

      // Base query builder with optional project filter
      const baseQuery = () => {
        const q = db('g_client_versions as cv')
          .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
          .leftJoin('g_users as updater', 'cv.updatedBy', 'updater.id')
          .leftJoin('g_environments as env', 'cv.targetEnv', 'env.id');
        if (projectId) {
          q.where('cv.projectId', projectId);
        }
        return q;
      };

      // Apply filters
      const applyFilters = (query: any) => {
        // targetEnv filter
        if (filters?.targetEnv) {
          query.where('cv.targetEnv', filters.targetEnv);
        }

        // clientVersion filter - support both single value and array (any_of)
        if (filters?.clientVersion) {
          if (Array.isArray(filters.clientVersion)) {
            query.whereIn('cv.clientVersion', filters.clientVersion);
          } else {
            query.where('cv.clientVersion', filters.clientVersion);
          }
        }

        // platform filter - support both single value and array (any_of)
        if (filters?.platform) {
          if (Array.isArray(filters.platform)) {
            query.whereIn('cv.platform', filters.platform);
          } else {
            query.where('cv.platform', filters.platform);
          }
        }

        // clientStatus filter - support both single value and array (any_of)
        if (filters?.clientStatus) {
          if (Array.isArray(filters.clientStatus)) {
            query.whereIn('cv.clientStatus', filters.clientStatus);
          } else {
            query.where('cv.clientStatus', filters.clientStatus);
          }
        }

        // guestModeAllowed filter - support both single value and array (any_of)
        if (filters?.guestModeAllowed !== undefined) {
          if (Array.isArray(filters.guestModeAllowed)) {
            // Convert boolean array to number array (true -> 1, false -> 0)
            const guestModeValues = filters.guestModeAllowed.map((val) =>
              val ? 1 : 0
            );
            query.whereIn('cv.guestModeAllowed', guestModeValues);
          } else {
            // TINYINT type, convert boolean to number (true -> 1, false -> 0)
            const guestModeValue = filters.guestModeAllowed ? 1 : 0;
            query.where('cv.guestModeAllowed', guestModeValue);
          }
        }

        // Tag filtering - support both any_of and include_all
        if (filters?.tags && filters.tags.length > 0) {
          const tagsOperator = filters.tagsOperator || 'any_of';

          if (tagsOperator === 'include_all') {
            // AND condition: must include all tags
            filters.tags.forEach((tagId) => {
              query.whereExists((subquery: any) => {
                subquery
                  .select('*')
                  .from('g_tag_assignments as ta')
                  .whereRaw('ta.entityId = cv.id')
                  .where('ta.entityType', 'client_version')
                  .where('ta.tagId', tagId);
              });
            });
          } else {
            // OR condition: include any of the tags
            query.whereExists((subquery: any) => {
              subquery
                .select('*')
                .from('g_tag_assignments as ta')
                .whereRaw('ta.entityId = cv.id')
                .where('ta.entityType', 'client_version')
                .whereIn('ta.tagId', filters.tags);
            });
          }
        }

        // Search filter - search across multiple fields
        if (filters?.search) {
          const searchTerm = `%${filters.search}%`;
          query.where(function (this: any) {
            this.where('cv.clientVersion', 'like', searchTerm)
              .orWhere('cv.platform', 'like', searchTerm)
              .orWhere('cv.gameServerAddress', 'like', searchTerm)
              .orWhere('cv.patchAddress', 'like', searchTerm)
              .orWhere('cv.memo', 'like', searchTerm);
          });
        }

        return query;
      };

      // Count Query
      const countQuery = applyFilters(baseQuery())
        .count('cv.id as total')
        .first();

      // Data Query
      const dataQuery = applyFilters(baseQuery())
        .select([
          'cv.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail',
          'env.name as targetEnvName',
          'env.color as targetEnvColor',
        ])
        .orderBy(`cv.${sortBy}`, sortOrder)
        .limit(limit)
        .offset(offset);

      // Execute in parallel
      const [countResult, dataResults] = await Promise.all([
        countQuery,
        dataQuery,
      ]);

      const total = countResult?.total || 0;

      // Load tag info for each client version
      const clientVersionsWithTags = await Promise.all(
        dataResults.map(async (cv: any) => {
          const tags = await TagAssignmentModel.listTagsForEntity(
            'client_version',
            cv.id
          );
          return {
            ...cv,
            tags,
          };
        })
      );

      return {
        clientVersions: clientVersionsWithTags,
        total,
      };
    } catch (error) {
      logger.error('Error finding client versions:', error);
      throw error;
    }
  }

  static async findById(
    id: string,
    projectId: string,
    trx?: any
  ): Promise<any | null> {
    try {
      const query = trx
        ? trx('g_client_versions as cv')
        : db('g_client_versions as cv');
      const clientVersion = await query
        .leftJoin('g_users as creator', 'cv.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'cv.updatedBy', 'updater.id')
        .leftJoin('g_environments as env', 'cv.targetEnv', 'env.id')
        .select([
          'cv.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail',
          'env.name as targetEnvName',
          'env.color as targetEnvColor',
        ])
        .where('cv.id', id)
        .where('cv.projectId', projectId)
        .first();

      if (!clientVersion) {
        return null;
      }

      // Load tag info
      const tags = await TagAssignmentModel.listTagsForEntity(
        'client_version',
        id,
        trx
      );

      // Load maintenance message locale info
      const localesQuery = trx
        ? trx('g_client_version_maintenance_locales')
        : db('g_client_version_maintenance_locales');
      const maintenanceLocales = await localesQuery
        .where('clientVersionId', id)
        .select('lang', 'message');

      return {
        ...clientVersion,
        tags,
        maintenanceLocales: maintenanceLocales || [],
      };
    } catch (error) {
      logger.error('Error finding client version by ID:', error);
      throw error;
    }
  }

  static async create(data: any, projectId: string): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        // Remove tags and maintenanceLocales fields as they are managed in separate tables
        const { tags, maintenanceLocales, ...clientVersionData } = data;

        const id = generateULID();

        await trx('g_client_versions').insert({
          id,
          ...clientVersionData,
          projectId: projectId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Process maintenance message locales
        if (maintenanceLocales && maintenanceLocales.length > 0) {
          const localeInserts = maintenanceLocales.map((locale: any) => ({
            clientVersionId: id,
            lang: locale.lang,
            message: locale.message,
            createdBy: data.createdBy,
            updatedBy: data.updatedBy,
            createdAt: new Date(),
            updatedAt: new Date(),
          }));

          await trx('g_client_version_maintenance_locales').insert(
            localeInserts
          );
        }

        return await this.findById(id, projectId, trx);
      });
    } catch (error) {
      logger.error('Error creating client version:', error);
      throw error;
    }
  }

  static async update(
    id: string,
    data: any,
    projectId: string
  ): Promise<any> {
    try {
      return await db.transaction(async (trx) => {
        // Remove tags and maintenanceLocales fields as they are managed in separate tables
        const { tags, maintenanceLocales, ...clientVersionData } = data;

        await trx('g_client_versions')
          .where('id', id)
          .where('projectId', projectId)
          .update({
            ...clientVersionData,
            updatedAt: new Date(),
          });

        // Process maintenance message locales
        if (maintenanceLocales !== undefined) {
          // Existing Locale Delete
          await trx('g_client_version_maintenance_locales')
            .where('clientVersionId', id)
            .del();

          // Add new locales
          if (maintenanceLocales.length > 0) {
            const localeInserts = maintenanceLocales.map((locale: any) => ({
              clientVersionId: id,
              lang: locale.lang,
              message: locale.message,
              createdBy: data.createdBy,
              updatedBy: data.updatedBy,
              createdAt: new Date(),
              updatedAt: new Date(),
            }));

            await trx('g_client_version_maintenance_locales').insert(
              localeInserts
            );
          }
        }

        return await this.findById(id, projectId, trx);
      });
    } catch (error) {
      logger.error('Error updating client version:', error);
      throw error;
    }
  }

  static async delete(id: string, projectId: string): Promise<void> {
    try {
      await db('g_client_versions')
        .where('id', id)
        .where('projectId', projectId)
        .del();
    } catch (error) {
      logger.error('Error deleting client version:', error);
      throw error;
    }
  }

  // Additional methods
  static async bulkCreate(
    data: ClientVersionCreationAttributes[],
    projectId: string
  ): Promise<any> {
    try {
      const insertedIds: string[] = [];

      // First insert all data
      await db.transaction(async (trx) => {
        for (const item of data) {
          // Remove tags field as it is managed in a separate table
          const { maintenanceLocales, ...clientVersionData } = item as any;

          const id = generateULID();

          await trx('g_client_versions').insert({
            id,
            ...clientVersionData,
            projectId: projectId,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          insertedIds.push(id);
        }
      });

      // Query created data after transaction completes
      const results = [];
      for (const cvId of insertedIds) {
        const clientVersion = await this.findById(cvId, projectId);
        if (clientVersion) {
          results.push(clientVersion);
        } else {
          logger.warn(`Failed to find created client version with id: ${cvId}`);
          // Return a basic object to prevent null
          results.push({
            id: cvId,
            platform: 'unknown',
            clientVersion: 'unknown',
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Error bulk creating client versions:', error);
      throw error;
    }
  }

  static async bulkUpdateStatus(
    data: any,
    projectId: string
  ): Promise<any> {
    try {
      const updateData: any = {
        clientStatus: data.clientStatus,
        updatedBy: data.updatedBy,
        updatedAt: new Date(),
      };

      // Add maintenance-related fields
      if (data.maintenanceStartDate) {
        updateData.maintenanceStartDate = data.maintenanceStartDate;
      }
      if (data.maintenanceEndDate) {
        updateData.maintenanceEndDate = data.maintenanceEndDate;
      }
      if (data.maintenanceMessage) {
        updateData.maintenanceMessage = data.maintenanceMessage;
      }
      if (data.supportsMultiLanguage !== undefined) {
        updateData.supportsMultiLanguage = data.supportsMultiLanguage;
      }
      if (data.messageTemplateId) {
        updateData.messageTemplateId = data.messageTemplateId;
      }

      await db('g_client_versions')
        .whereIn('id', data.ids)
        .where('projectId', projectId)
        .update(updateData);

      // Process language-specific messages
      if (data.maintenanceLocales && Array.isArray(data.maintenanceLocales)) {
        // Delete existing language-specific messages
        await db('g_client_version_maintenance_locales')
          .whereIn('clientVersionId', data.ids)
          .del();

        // Add new language-specific messages
        if (data.maintenanceLocales.length > 0) {
          const localeInserts = [];
          for (const id of data.ids) {
            for (const locale of data.maintenanceLocales) {
              localeInserts.push({
                clientVersionId: id,
                lang: locale.lang,
                message: locale.message,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
          if (localeInserts.length > 0) {
            await db('g_client_version_maintenance_locales').insert(
              localeInserts
            );
          }
        }
      }

      return data.ids.length;
    } catch (error) {
      logger.error('Error bulk updating client version status:', error);
      throw error;
    }
  }

  static async getPlatforms(projectId: string): Promise<string[]> {
    try {
      const result = await db('g_client_versions')
        .distinct('platform')
        .select('platform')
        .where('projectId', projectId)
        .whereNotNull('platform')
        .orderBy('platform');
      return result.map((row) => row.platform);
    } catch (error) {
      logger.error('Error getting platforms:', error);
      throw error;
    }
  }

  static async checkDuplicate(
    platform: string,
    clientVersion: string,
    excludeId?: string,
    projectId?: string
  ): Promise<boolean> {
    try {
      if (!projectId) {
        throw new Error(
          'Project is required for checking duplicate client versions'
        );
      }

      let query = db('g_client_versions')
        .where('platform', platform)
        .where('clientVersion', clientVersion)
        .where('projectId', projectId);

      if (excludeId) {
        query = query.where('id', '!=', excludeId);
      }

      const result = await query.first();
      return !!result;
    } catch (error) {
      logger.error('Error checking duplicate:', error);
      throw error;
    }
  }

  static async getMaintenanceLocales(
    clientVersionId: string
  ): Promise<ClientVersionMaintenanceLocale[]> {
    try {
      const locales = await db('g_client_version_maintenance_locales')
        .select(['lang', 'message'])
        .where('clientVersionId', clientVersionId)
        .orderBy('lang');

      return locales;
    } catch (error) {
      logger.error('Error getting maintenance locales:', error);
      throw error;
    }
  }

  /**
   * Delete all client versions (for testing/reset)
   */
  static async deleteAll(): Promise<number> {
    try {
      // First delete all maintenance locales
      await db('g_client_version_maintenance_locales').del();

      // Then delete all tag assignments
      await db('g_tag_assignments').where('entityType', 'client_version').del();

      // Finally delete all client versions
      const deletedCount = await db('g_client_versions').del();

      logger.info(`Deleted all client versions: ${deletedCount} records`);
      return deletedCount;
    } catch (error) {
      logger.error('Error deleting all client versions:', error);
      throw error;
    }
  }
  /**
   * Find a client version by ID without requiring projectId.
   * Used when only projectId lookup is needed (e.g. tag change SDK event publishing).
   */
  static async findByIdWithoutProject(
    id: string
  ): Promise<{ id: string; projectId: string; targetEnv?: string } | null> {
    try {
      const row = await db('g_client_versions')
        .select('id', 'projectId', 'targetEnv')
        .where('id', id)
        .first();
      return row || null;
    } catch (error) {
      logger.error('Error finding client version by ID (no project):', error);
      throw error;
    }
  }

  /**
   * Find a client version by projectId + platform + version string.
   * Used for dynamic env resolution from project tokens.
   */
  static async findByProjectAndVersion(
    projectId: string,
    clientVersion: string,
    platform?: string
  ): Promise<{ id: string; projectId: string; targetEnv: string | null; platform: string; clientVersion: string } | null> {
    try {
      let query = db('g_client_versions')
        .select('id', 'projectId', 'targetEnv', 'platform', 'clientVersion')
        .where('projectId', projectId)
        .where('clientVersion', clientVersion);

      if (platform) {
        query = query.where('platform', platform);
      }

      const row = await query.first();
      return row || null;
    } catch (error) {
      logger.error('Error finding client version by project and version:', error);
      throw error;
    }
  }

  /**
   * Get all version-to-environment mappings for a project.
   * Used by Edge server's versionMap service.
   */
  static async getVersionMap(
    projectId?: string
  ): Promise<Array<{ projectId: string; platform: string; clientVersion: string; targetEnv: string | null }>> {
    try {
      let query = db('g_client_versions')
        .select('projectId', 'platform', 'clientVersion', 'targetEnv');

      if (projectId) {
        query = query.where('projectId', projectId);
      }

      return await query;
    } catch (error) {
      logger.error('Error getting version map:', error);
      throw error;
    }
  }
}
