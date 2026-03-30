import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import Joi from 'joi';
import ClientVersionService, {
  ClientVersionFilters,
  ClientVersionPagination,
  BulkStatusUpdateRequest,
} from '../services/client-version-service';
import { ClientStatus } from '../models/client-version';
import { ClientVersionModel } from '../models/client-version';
import { GatrixError } from '../middleware/error-handler';
import { UnifiedChangeGateway } from '../services/unified-change-gateway';
import { TagService } from '../services/tag-service';

import { createLogger } from '../config/logger';
const logger = createLogger('ClientVersionController');

/**
 * Convert ISO 8601 datetime string to MySQL DATETIME format
 * MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
 * ISO 8601 format: YYYY-MM-DDTHH:MM:SS.sssZ
 *
 * @param isoDateString - ISO 8601 datetime string
 * @returns MySQL DATETIME format string or null if invalid
 */
function convertISOToMySQLDateTime(
  isoDateString: string | null | undefined
): string | null {
  if (!isoDateString) return null;

  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return null;

    // Convert to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    logger.warn(
      `Failed to convert ISO date to MySQL format: ${isoDateString}`,
      error
    );
    return null;
  }
}

// Validation schemas
const createClientVersionSchema = Joi.object({
  platform: Joi.string().min(1).max(50).required(),
  clientVersion: Joi.string()
    .pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/)
    .required(),
  clientStatus: Joi.string()
    .valid(...Object.values(ClientStatus))
    .required(),
  gameServerAddress: Joi.string().min(1).max(500).required(),
  gameServerAddressForWhiteList: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  patchAddress: Joi.string().min(1).max(500).required(),
  patchAddressForWhiteList: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  guestModeAllowed: Joi.boolean().required(),
  externalClickLink: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  memo: Joi.string().optional().allow('').empty('').default(null),
  customPayload: Joi.string().optional().allow('').empty('').default(null),
  // Maintenance-related fields
  maintenanceStartDate: Joi.string()
    .isoDate()
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceEndDate: Joi.string()
    .isoDate()
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceMessage: Joi.when('clientStatus', {
    is: 'MAINTENANCE',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().optional().allow('').empty('').default(null),
  }),
  supportsMultiLanguage: Joi.boolean().optional().default(false),
  minPatchVersion: Joi.string()
    .max(50)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceLocales: Joi.array()
    .items(
      Joi.object({
        lang: Joi.string().valid('ko', 'en', 'zh').required(),
        message: Joi.string().required(),
      })
    )
    .optional()
    .default([]),
  targetEnv: Joi.string().max(26).optional().allow('').empty('').default(null),
  tags: Joi.array()
    .items(
      Joi.object({
        id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      }).unknown(true)
    )
    .optional()
    .default([]),
});

const updateClientVersionSchema = Joi.object({
  platform: Joi.string().min(1).max(50).optional(),
  clientVersion: Joi.string()
    .pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/)
    .optional(),
  clientStatus: Joi.string()
    .valid(...Object.values(ClientStatus))
    .optional(),
  gameServerAddress: Joi.string().min(1).max(500).optional(),
  gameServerAddressForWhiteList: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  patchAddress: Joi.string().min(1).max(500).optional(),
  patchAddressForWhiteList: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  guestModeAllowed: Joi.boolean().optional(),
  externalClickLink: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  memo: Joi.string().optional().allow('').empty('').default(null),
  customPayload: Joi.string().optional().allow('').empty('').default(null),
  // Maintenance-related fields
  maintenanceStartDate: Joi.string()
    .isoDate()
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceEndDate: Joi.string()
    .isoDate()
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceMessage: Joi.when('clientStatus', {
    is: 'MAINTENANCE',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().optional().allow('').empty('').default(null),
  }),
  supportsMultiLanguage: Joi.boolean().optional().default(false),
  minPatchVersion: Joi.string()
    .max(50)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceLocales: Joi.array()
    .items(
      Joi.object({
        lang: Joi.string().valid('ko', 'en', 'zh').required(),
        message: Joi.string().required(),
      })
    )
    .optional()
    .default([]),
  tags: Joi.array()
    .items(
      Joi.object({
        id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
      }).unknown(true)
    )
    .optional(),
  targetEnv: Joi.string().max(26).optional().allow('').empty('').default(null),
});

const getClientVersionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      'id',
      'channel',
      'subChannel',
      'clientVersion',
      'clientStatus',
      'createdAt',
      'updatedAt'
    )
    .default('createdAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  version: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  platform: Joi.alternatives()
    .try(Joi.string(), Joi.array().items(Joi.string()))
    .optional(),
  clientStatus: Joi.alternatives()
    .try(
      Joi.string().valid(...Object.values(ClientStatus)),
      Joi.array().items(Joi.string().valid(...Object.values(ClientStatus)))
    )
    .optional(),
  gameServerAddress: Joi.string().optional(),
  patchAddress: Joi.string().optional(),
  guestModeAllowed: Joi.alternatives()
    .try(
      Joi.string()
        .valid('true', 'false')
        .custom((value, helpers) => {
          if (value === 'true') return true;
          if (value === 'false') return false;
          return helpers.error('any.invalid');
        }),
      Joi.array()
        .items(Joi.string().valid('true', 'false'))
        .custom((value, helpers) => {
          return value.map((v: string) => v === 'true');
        })
    )
    .optional(),
  externalClickLink: Joi.string().optional(),
  memo: Joi.string().optional(),
  customPayload: Joi.string().optional(),
  createdBy: Joi.string().optional(),
  updatedBy: Joi.string().optional(),
  createdAtFrom: Joi.date().iso().optional(),
  createdAtTo: Joi.date().iso().optional(),
  updatedAtFrom: Joi.date().iso().optional(),
  updatedAtTo: Joi.date().iso().optional(),
  search: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  tagsOperator: Joi.string()
    .valid('any_of', 'include_all')
    .optional()
    .default('any_of'),
  _t: Joi.string().optional(), // Cache-busting timestamp
});

// Export-only schema (no limit restriction)
const exportClientVersionsQuerySchema = Joi.object({
  version: Joi.string().optional(),
  platform: Joi.string().optional(),
  clientStatus: Joi.string()
    .valid(...Object.values(ClientStatus))
    .optional(),
  gameServerAddress: Joi.string().optional(),
  patchAddress: Joi.string().optional(),
  guestModeAllowed: Joi.string()
    .valid('true', 'false')
    .optional()
    .custom((value, helpers) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return helpers.error('any.invalid');
    }),
  externalClickLink: Joi.string().optional(),
  memo: Joi.string().optional(),
  customPayload: Joi.string().optional(),
  createdBy: Joi.string().optional(),
  updatedBy: Joi.string().optional(),
  createdAtFrom: Joi.date().iso().optional(),
  createdAtTo: Joi.date().iso().optional(),
  updatedAtFrom: Joi.date().iso().optional(),
  updatedAtTo: Joi.date().iso().optional(),
  search: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
});

const bulkUpdateStatusSchema = Joi.object({
  ids: Joi.array().items(Joi.string()).min(1).required(),
  clientStatus: Joi.string()
    .valid(...Object.values(ClientStatus))
    .required(),
  // Maintenance-related fields
  maintenanceStartDate: Joi.string().isoDate().optional(),
  maintenanceEndDate: Joi.string().isoDate().optional(),
  maintenanceMessage: Joi.string().max(1000).optional(),
  supportsMultiLanguage: Joi.boolean().optional(),
  maintenanceLocales: Joi.array()
    .items(
      Joi.object({
        lang: Joi.string().valid('ko', 'en', 'zh').required(),
        message: Joi.string().max(1000).required(),
      })
    )
    .optional(),
  messageTemplateId: Joi.string().optional(),
});

const bulkCreateClientVersionSchema = Joi.object({
  clientVersion: Joi.string()
    .pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/)
    .required(),
  clientStatus: Joi.string()
    .valid(...Object.values(ClientStatus))
    .required(),
  guestModeAllowed: Joi.boolean().required(),
  externalClickLink: Joi.string()
    .max(500)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  memo: Joi.string().max(1000).optional().allow('').empty('').default(null),
  customPayload: Joi.string()
    .max(5000)
    .optional()
    .allow('')
    .empty('')
    .default(null),

  // Maintenance-related fields
  maintenanceStartDate: Joi.string()
    .isoDate()
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceEndDate: Joi.string()
    .isoDate()
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceMessage: Joi.when('clientStatus', {
    is: 'MAINTENANCE',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().optional().allow('').empty('').default(null),
  }),
  supportsMultiLanguage: Joi.boolean().optional().default(false),
  minPatchVersion: Joi.string()
    .max(50)
    .optional()
    .allow('')
    .empty('')
    .default(null),
  maintenanceLocales: Joi.array()
    .items(
      Joi.object({
        lang: Joi.string().valid('ko', 'en', 'zh').required(),
        message: Joi.string().required(),
      })
    )
    .optional()
    .default([]),

  platforms: Joi.array()
    .items(
      Joi.object({
        platform: Joi.string().min(1).max(50).required(),
        gameServerAddress: Joi.string().min(1).max(500).required(),
        gameServerAddressForWhiteList: Joi.string()
          .max(500)
          .optional()
          .allow('')
          .empty('')
          .default(null),
        patchAddress: Joi.string().min(1).max(500).required(),
        patchAddressForWhiteList: Joi.string()
          .max(500)
          .optional()
          .allow('')
          .empty('')
          .default(null),
      })
    )
    .min(1)
    .required(),

  targetEnv: Joi.string().max(26).optional().allow('').empty('').default(null),

  // Tag fields - accept only required fields
  tags: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().required(),
        name: Joi.string().required(),
        color: Joi.string().required(),
      })
    )
    .optional()
    .default([]),
});

export class ClientVersionController {
  // Get available versions list (distinct)
  static async getAvailableVersions(req: AuthenticatedRequest, res: Response) {
    try {
      const projectId = req.projectId!;
      const versions =
        await ClientVersionService.getAvailableVersions(projectId);
      res.json({
        success: true,
        data: versions,
      });
    } catch (error: any) {
      logger.error('Error getting available versions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get available versions',
      });
    }
  }

  // Get client version list
  static async getClientVersions(req: AuthenticatedRequest, res: Response) {
    const { error, value } = getClientVersionsQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { page, limit, sortBy, sortOrder, _t, ...filterParams } = value;

    const filters: ClientVersionFilters = {};
    const pagination: ClientVersionPagination = {
      page,
      limit,
      sortBy,
      sortOrder,
    };

    // Set filter conditions
    Object.keys(filterParams).forEach((key) => {
      const value = filterParams[key];
      // guestModeAllowed is boolean, so false is also a valid value
      if (
        value !== undefined &&
        (value !== '' ||
          key === 'guestModeAllowed' ||
          key === 'tags' ||
          key === 'tagsOperator')
      ) {
        const processedValue: any = value;

        // guestModeAllowed is already converted to boolean or boolean[] by Joi
        // Other fields are used as-is

        // Type-safe assignment
        if (key === 'guestModeAllowed') {
          (filters as any).guestModeAllowed = processedValue;
        } else if (key === 'tags') {
          (filters as any).tags = processedValue;
        } else if (key === 'tagsOperator') {
          (filters as any).tagsOperator = processedValue;
        } else {
          filters[key as keyof ClientVersionFilters] = processedValue;
        }
      }
    });

    const projectId = req.projectId!;
    const result = await ClientVersionService.getAllClientVersions(
      projectId,
      filters,
      pagination
    );

    res.json({
      success: true,
      data: result,
    });
  }

  // Get client version details
  static async getClientVersionById(req: AuthenticatedRequest, res: Response) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client version ID',
      });
    }

    const projectId = req.projectId!;
    const clientVersion = await ClientVersionService.getClientVersionById(
      id,
      projectId
    );
    if (!clientVersion) {
      return res.status(404).json({
        success: false,
        message: 'Client version not found',
      });
    }

    res.json({
      success: true,
      data: clientVersion,
    });
  }

  // Create client version
  static async createClientVersion(req: AuthenticatedRequest, res: Response) {
    const { error, value } = createClientVersionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const clientVersionData = {
      ...value,
      // Convert ISO 8601 datetime to MySQL DATETIME format
      maintenanceStartDate: convertISOToMySQLDateTime(
        value.maintenanceStartDate
      ),
      maintenanceEndDate: convertISOToMySQLDateTime(value.maintenanceEndDate),
      createdBy: userId,
      updatedBy: userId,
    };

    const projectId = req.projectId!;

    // Use UnifiedChangeGateway for CR support
    const gatewayResult = await UnifiedChangeGateway.requestCreation(
      userId,
      projectId,
      'g_client_versions',
      clientVersionData,
      async () => {
        return await ClientVersionService.createClientVersion(
          clientVersionData,
          projectId
        );
      }
    );

    if (gatewayResult.mode === 'DIRECT') {
      res.status(201).json({
        success: true,
        data: gatewayResult.data,
        message: 'Client version created successfully',
      });
    } else {
      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message:
          'Change request created. The client version will be created after approval.',
      });
    }
  }

  // Bulk create client versions
  static async bulkCreateClientVersions(
    req: AuthenticatedRequest,
    res: Response
  ) {
    const { error, value } = bulkCreateClientVersionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const projectId = req.projectId!;
    const bulkCreateData = {
      ...value,
      // Convert ISO 8601 datetime to MySQL DATETIME format
      maintenanceStartDate: convertISOToMySQLDateTime(
        value.maintenanceStartDate
      ),
      maintenanceEndDate: convertISOToMySQLDateTime(value.maintenanceEndDate),
      createdBy: userId,
      updatedBy: userId,
      projectId,
    };

    // Check if CR is required
    const requiresApproval =
      await UnifiedChangeGateway.requiresApproval(projectId);

    if (requiresApproval) {
      let lastResult;
      for (const platform of value.platforms) {
        const itemData = {
          projectId,
          platform: platform.platform,
          clientVersion: value.clientVersion,
          clientStatus: value.clientStatus,
          gameServerAddress: platform.gameServerAddress,
          gameServerAddressForWhiteList:
            platform.gameServerAddressForWhiteList || null,
          patchAddress: platform.patchAddress,
          patchAddressForWhiteList: platform.patchAddressForWhiteList || null,
          guestModeAllowed: value.guestModeAllowed,
          externalClickLink: value.externalClickLink || null,
          memo: value.memo || null,
          customPayload: value.customPayload || null,
          maintenanceStartDate: bulkCreateData.maintenanceStartDate,
          maintenanceEndDate: bulkCreateData.maintenanceEndDate,
          maintenanceLocales: value.maintenanceLocales || [],
          createdBy: userId,
          updatedBy: userId,
        };

        lastResult = await UnifiedChangeGateway.requestCreation(
          userId,
          projectId,
          'g_client_versions',
          itemData,
          async () => {
            /* won't be called if requiresApproval is true */
          }
        );
      }

      res.status(202).json({
        success: true,
        data: {
          changeRequestId: lastResult?.changeRequestId,
          status: lastResult?.status,
        },
        message:
          'Change request created. The client versions will be created after approval.',
      });
    } else {
      let clientVersions;
      try {
        clientVersions = await ClientVersionService.bulkCreateClientVersions(
          bulkCreateData,
          projectId
        );
      } catch (error: any) {
        if (
          error.message &&
          error.message.includes('Duplicate client versions found')
        ) {
          throw new GatrixError(error.message, 409);
        }
        throw error;
      }

      res.status(201).json({
        success: true,
        data: clientVersions,
        message: `Successfully created ${clientVersions.length} client versions`,
      });
    }
  }

  // Update client version
  static async updateClientVersion(req: AuthenticatedRequest, res: Response) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client version ID',
      });
    }

    const { error, value } = updateClientVersionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Extract tags from validated data for separate processing
    const { tags, ...restValue } = value;

    const updateData: Record<string, any> = {
      ...restValue,
      // Convert ISO 8601 datetime to MySQL DATETIME format
      maintenanceStartDate: convertISOToMySQLDateTime(
        restValue.maintenanceStartDate
      ),
      maintenanceEndDate: convertISOToMySQLDateTime(
        restValue.maintenanceEndDate
      ),
      createdBy: userId, // Required for creating new maintenanceLocales
      updatedBy: userId,
    };

    // Include tagIds in updateData so CR system can track tag changes
    if (tags !== undefined) {
      updateData.tagIds = tags
        .map((tag: any) => tag.id)
        .filter((tid: any) => tid);
    }

    const projectId = req.projectId!;

    // Use UnifiedChangeGateway for CR support
    // Use function form to inject current tags into beforeData for accurate diff
    const gatewayResult = await UnifiedChangeGateway.processChange(
      userId,
      projectId,
      'g_client_versions',
      id,
      async (currentData: any) => {
        // Inject current tags into the comparison base
        if (tags !== undefined) {
          const currentTags = await TagService.listTagsForEntity(
            'client_version',
            id
          );
          currentData.tagIds = currentTags.map((t: any) => t.id).sort();
          // Also sort the new tagIds for consistent comparison
          updateData.tagIds = [...updateData.tagIds].sort();
        }
        return updateData;
      },
      async (processedData: any) => {
        // Strip tagIds before updating main table (it's not a column)
        const { tagIds, ...tableData } = processedData;
        const result = await ClientVersionService.updateClientVersion(
          id,
          tableData,
          projectId
        );
        // Apply tags directly in DIRECT mode
        if (tagIds && Array.isArray(tagIds)) {
          await TagService.setTagsForEntity(
            'client_version',
            id,
            tagIds,
            userId
          );
        }
        return result;
      }
    );

    if (gatewayResult.mode === 'DIRECT') {
      // Re-fetch to include updated tags
      const updatedClientVersion =
        await ClientVersionService.getClientVersionById(id, projectId);

      if (!updatedClientVersion) {
        return res.status(404).json({
          success: false,
          message: 'Client version not found',
        });
      }

      res.json({
        success: true,
        data: updatedClientVersion,
        message: 'Client version updated successfully',
      });
    } else {
      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message:
          'Change request created. The update will be applied after approval.',
      });
    }
  }

  // Delete client version
  static async deleteClientVersion(req: AuthenticatedRequest, res: Response) {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client version ID',
      });
    }

    const projectId = req.projectId!;
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Use UnifiedChangeGateway for CR support
    const gatewayResult = await UnifiedChangeGateway.requestDeletion(
      userId,
      projectId,
      'g_client_versions',
      id,
      async () => {
        await ClientVersionService.deleteClientVersion(id, projectId);
      }
    );

    if (gatewayResult.mode === 'DIRECT') {
      res.json({
        success: true,
        message: 'Client version deleted successfully',
      });
    } else {
      res.status(202).json({
        success: true,
        data: {
          changeRequestId: gatewayResult.changeRequestId,
          status: gatewayResult.status,
        },
        message:
          'Change request created. The deletion will be applied after approval.',
      });
    }
  }

  // Bulk status update
  static async bulkUpdateStatus(req: AuthenticatedRequest, res: Response) {
    const { error, value } = bulkUpdateStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    const bulkUpdateData: BulkStatusUpdateRequest = {
      ...value,
      // Convert ISO 8601 datetime to MySQL DATETIME format
      maintenanceStartDate: convertISOToMySQLDateTime(
        value.maintenanceStartDate
      ),
      maintenanceEndDate: convertISOToMySQLDateTime(value.maintenanceEndDate),
      updatedBy: userId,
    };

    const projectId = req.projectId!;

    // Check if CR is required
    const requiresApproval =
      await UnifiedChangeGateway.requiresApproval(projectId);

    if (requiresApproval) {
      let lastResult;
      for (const id of value.ids) {
        // Only include fields that are actually being changed
        const updateDataAttrs: Record<string, any> = {
          clientStatus: value.clientStatus,
          updatedBy: userId,
        };

        // Only include maintenance-related fields when status is MAINTENANCE
        if (value.clientStatus === ClientStatus.MAINTENANCE) {
          if (bulkUpdateData.maintenanceStartDate !== undefined) {
            updateDataAttrs.maintenanceStartDate =
              bulkUpdateData.maintenanceStartDate;
          }
          if (bulkUpdateData.maintenanceEndDate !== undefined) {
            updateDataAttrs.maintenanceEndDate =
              bulkUpdateData.maintenanceEndDate;
          }
          if (value.maintenanceMessage !== undefined) {
            updateDataAttrs.maintenanceMessage = value.maintenanceMessage;
          }
          if (value.supportsMultiLanguage !== undefined) {
            updateDataAttrs.supportsMultiLanguage = value.supportsMultiLanguage;
          }
          if (value.maintenanceLocales !== undefined) {
            updateDataAttrs.maintenanceLocales = value.maintenanceLocales;
          }
          if (value.messageTemplateId !== undefined) {
            updateDataAttrs.messageTemplateId = value.messageTemplateId;
          }
        }

        lastResult = await UnifiedChangeGateway.requestModification(
          userId,
          projectId,
          'g_client_versions',
          id,
          updateDataAttrs
        );
      }

      res.status(202).json({
        success: true,
        data: {
          changeRequestId: lastResult?.changeRequestId,
          status: lastResult?.status,
        },
        message:
          'Change request created. The bulk status update will be applied after approval.',
      });
    } else {
      const updatedCount = await ClientVersionService.bulkUpdateStatus(
        bulkUpdateData,
        projectId
      );
      res.json({
        success: true,
        data: {
          updatedCount,
        },
      });
    }
  }

  // Get channel list
  static async getPlatforms(req: AuthenticatedRequest, res: Response) {
    const projectId = req.projectId!;
    const platforms = await ClientVersionService.getPlatforms(projectId);

    res.json({
      success: true,
      data: platforms,
    });
  }

  // Export client versions (CSV)
  static async exportClientVersions(req: AuthenticatedRequest, res: Response) {
    const { error, value } = exportClientVersionsQuerySchema.validate(
      req.query
    );
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    try {
      const projectId = req.projectId!;
      // Use a very large limit to fetch all data
      const result = await ClientVersionService.getAllClientVersions(
        projectId,
        value,
        {
          page: 1,
          limit: 50000, // Large enough value
          sortBy: 'createdAt',
          sortOrder: 'DESC',
        }
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error exporting client versions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to export client versions',
      });
    }
  }

  /**
   * Reset all client versions and clear cache (for testing)
   * DELETE /api/v1/admin/client-versions/reset/all
   */
  static async resetAllClientVersions(
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      // Delete all client versions
      const deletedCount = await ClientVersionModel.deleteAll();

      // Clear all client version related cache
      const { pubSubService } = require('../services/pub-sub-service');
      await pubSubService.invalidateByPattern('*client_version:*');

      logger.info(
        `Reset all client versions: ${deletedCount} records deleted, cache cleared`
      );

      res.json({
        success: true,
        message: `All client versions have been reset. ${deletedCount} records deleted and cache cleared.`,
        data: {
          deletedCount,
          cacheCleared: true,
        },
      });
    } catch (error: any) {
      logger.error('Error resetting client versions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to reset client versions',
      });
    }
  }
}

export default ClientVersionController;
