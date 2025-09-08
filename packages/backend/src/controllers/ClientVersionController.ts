import { Request, Response } from 'express';
import Joi from 'joi';
import ClientVersionService, { ClientVersionFilters, ClientVersionPagination, BulkStatusUpdateRequest } from '../services/ClientVersionService';
import { ClientStatus } from '../models/ClientVersion';
import { ClientVersionModel } from '../models/ClientVersion';
import { CustomError } from '../middleware/errorHandler';
import logger from '../config/logger';

// Validation schemas
const createClientVersionSchema = Joi.object({
  platform: Joi.string().min(1).max(50).required(),
  clientVersion: Joi.string().pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/).required(),
  clientStatus: Joi.string().valid(...Object.values(ClientStatus)).required(),
  gameServerAddress: Joi.string().min(1).max(500).required(),
  gameServerAddressForWhiteList: Joi.string().max(500).optional().allow('').empty('').default(null),
  patchAddress: Joi.string().min(1).max(500).required(),
  patchAddressForWhiteList: Joi.string().max(500).optional().allow('').empty('').default(null),
  guestModeAllowed: Joi.boolean().required(),
  externalClickLink: Joi.string().max(500).optional().allow('').empty('').default(null),
  memo: Joi.string().optional().allow('').empty('').default(null),
  customPayload: Joi.string().optional().allow('').empty('').default(null),
  tags: Joi.array().items(Joi.object({
    id: Joi.number().integer().positive().required(),
    name: Joi.string().optional(),
    color: Joi.string().optional(),
    description: Joi.string().optional().allow(null),
    createdBy: Joi.number().integer().optional(),
    updatedBy: Joi.number().integer().optional(),
    createdAt: Joi.date().optional(),
    updatedAt: Joi.date().optional()
  }).unknown(true)).optional().default([]),
});

const updateClientVersionSchema = Joi.object({
  platform: Joi.string().min(1).max(50).optional(),
  clientVersion: Joi.string().pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/).optional(),
  clientStatus: Joi.string().valid(...Object.values(ClientStatus)).optional(),
  gameServerAddress: Joi.string().min(1).max(500).optional(),
  gameServerAddressForWhiteList: Joi.string().max(500).optional().allow('').empty('').default(null),
  patchAddress: Joi.string().min(1).max(500).optional(),
  patchAddressForWhiteList: Joi.string().max(500).optional().allow('').empty('').default(null),
  guestModeAllowed: Joi.boolean().optional(),
  externalClickLink: Joi.string().max(500).optional().allow('').empty('').default(null),
  memo: Joi.string().optional().allow('').empty('').default(null),
  customPayload: Joi.string().optional().allow('').empty('').default(null),

});

const getClientVersionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('id', 'channel', 'subChannel', 'clientVersion', 'clientStatus', 'createdAt', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
  version: Joi.string().optional(),
  platform: Joi.string().optional(),
  clientStatus: Joi.string().valid(...Object.values(ClientStatus)).optional(),
  gameServerAddress: Joi.string().optional(),
  patchAddress: Joi.string().optional(),
  guestModeAllowed: Joi.string().valid('true', 'false').optional().custom((value, helpers) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return helpers.error('any.invalid');
  }),
  externalClickLink: Joi.string().optional(),
  memo: Joi.string().optional(),
  customPayload: Joi.string().optional(),
  createdBy: Joi.number().integer().optional(),
  updatedBy: Joi.number().integer().optional(),
  createdAtFrom: Joi.date().iso().optional(),
  createdAtTo: Joi.date().iso().optional(),
  updatedAtFrom: Joi.date().iso().optional(),
  updatedAtTo: Joi.date().iso().optional(),
  search: Joi.string().optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  _t: Joi.string().optional(), // 캐시 방지용 타임스탬프
});

const bulkUpdateStatusSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  clientStatus: Joi.string().valid(...Object.values(ClientStatus)).required(),
});

const bulkCreateClientVersionSchema = Joi.object({
  clientVersion: Joi.string().pattern(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/).required(),
  clientStatus: Joi.string().valid(...Object.values(ClientStatus)).required(),
  guestModeAllowed: Joi.boolean().required(),
  externalClickLink: Joi.string().max(500).optional().allow('').empty('').default(null),
  memo: Joi.string().max(1000).optional().allow('').empty('').default(null),
  customPayload: Joi.string().max(5000).optional().allow('').empty('').default(null),

  platforms: Joi.array().items(
    Joi.object({
      platform: Joi.string().min(1).max(50).required(),
      gameServerAddress: Joi.string().min(1).max(500).required(),
      gameServerAddressForWhiteList: Joi.string().max(500).optional().allow('').empty('').default(null),
      patchAddress: Joi.string().min(1).max(500).required(),
      patchAddressForWhiteList: Joi.string().max(500).optional().allow('').empty('').default(null),
    })
  ).min(1).required(),

  // 태그 필드 추가 - 필요한 필드만 받음
  tags: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().positive().required(),
      name: Joi.string().required(),
      color: Joi.string().required(),
    })
  ).optional().default([]),
});

export class ClientVersionController {
  // 사용 가능한 버전 목록 조회 (distinct)
  static async getAvailableVersions(req: Request, res: Response) {
    try {
      const versions = await ClientVersionService.getAvailableVersions();
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

  // 클라이언트 버전 목록 조회
  static async getClientVersions(req: Request, res: Response) {
    const { error, value } = getClientVersionsQuerySchema.validate(req.query);
    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message,
      });
    }

    const { page, limit, sortBy, sortOrder, _t, ...filterParams } = value;

    const filters: ClientVersionFilters = {};
    const pagination: ClientVersionPagination = { page, limit, sortBy, sortOrder };

    // 필터 조건 설정
    Object.keys(filterParams).forEach(key => {
      const value = filterParams[key];
      // guestModeAllowed는 boolean이므로 false도 유효한 값
      if (value !== undefined && (value !== '' || key === 'guestModeAllowed' || key === 'tags')) {
        let processedValue: any = value;

        // guestModeAllowed는 문자열을 boolean으로 변환
        if (key === 'guestModeAllowed') {
          processedValue = value === 'true';
        }

        // 타입 안전하게 할당
        if (key === 'guestModeAllowed') {
          (filters as any).guestModeAllowed = processedValue;
        } else if (key === 'tags') {
          (filters as any).tags = processedValue;
        } else {
          filters[key as keyof ClientVersionFilters] = processedValue;
        }
      }
    });

    const result = await ClientVersionService.getAllClientVersions(filters, pagination);

    res.json({
      success: true,
      data: result,
    });
  }

  // 클라이언트 버전 상세 조회
  static async getClientVersionById(req: Request, res: Response) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client version ID',
      });
    }

    const clientVersion = await ClientVersionService.getClientVersionById(id);
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

  // 클라이언트 버전 생성
  static async createClientVersion(req: Request, res: Response) {
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
      createdBy: userId,
      updatedBy: userId,
    };

    const clientVersion = await ClientVersionService.createClientVersion(clientVersionData);

    res.status(201).json({
      success: true,
      data: clientVersion,
    });
  }

  // 클라이언트 버전 간편 생성
  static async bulkCreateClientVersions(req: Request, res: Response) {
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

    const bulkCreateData = {
      ...value,
      createdBy: userId,
      updatedBy: userId,
    };

    let clientVersions;
    try {
      clientVersions = await ClientVersionService.bulkCreateClientVersions(bulkCreateData);
    } catch (error: any) {
      if (error.message && error.message.includes('Duplicate client versions found')) {
        throw new CustomError(error.message, 409);
      }
      throw error;
    }

    res.status(201).json({
      success: true,
      data: clientVersions,
      message: `Successfully created ${clientVersions.length} client versions`,
    });
  }

  // 클라이언트 버전 수정
  static async updateClientVersion(req: Request, res: Response) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
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

    const updateData = {
      ...value,
      updatedBy: userId,
    };

    const clientVersion = await ClientVersionService.updateClientVersion(id, updateData);
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

  // 클라이언트 버전 삭제
  static async deleteClientVersion(req: Request, res: Response) {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid client version ID',
      });
    }

    const deleted = await ClientVersionService.deleteClientVersion(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Client version not found',
      });
    }

    res.json({
      success: true,
      message: 'Client version deleted successfully',
    });
  }

  // 일괄 상태 변경
  static async bulkUpdateStatus(req: Request, res: Response) {
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
      updatedBy: userId,
    };

    const updatedCount = await ClientVersionService.bulkUpdateStatus(bulkUpdateData);

    res.json({
      success: true,
      data: {
        updatedCount,
        message: `${updatedCount} client versions updated successfully`,
      },
    });
  }

  // 채널 목록 조회
  static async getPlatforms(req: Request, res: Response) {
    const platforms = await ClientVersionService.getPlatforms();

    res.json({
      success: true,
      data: platforms,
    });
  }

  // 클라이언트 버전 태그 설정
  static async setTags(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tagIds } = req.body;

      if (!Array.isArray(tagIds)) {
        return res.status(400).json({
          success: false,
          message: 'tagIds must be an array',
        });
      }

      await ClientVersionModel.setTags(parseInt(id), tagIds);

      res.json({
        success: true,
        message: 'Tags updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to update tags',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // 클라이언트 버전 태그 조회
  static async getTags(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const tags = await ClientVersionModel.getTags(parseInt(id));

      res.json({
        success: true,
        data: tags,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get tags',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export default ClientVersionController;
