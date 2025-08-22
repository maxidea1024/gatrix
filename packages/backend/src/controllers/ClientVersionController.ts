import { Request, Response } from 'express';
import Joi from 'joi';
import ClientVersionService, { ClientVersionFilters, ClientVersionPagination, BulkStatusUpdateRequest } from '../services/ClientVersionService';
import { ClientStatus } from '../models/ClientVersion';

// Validation schemas
const createClientVersionSchema = Joi.object({
  channel: Joi.string().min(1).max(100).required(),
  subChannel: Joi.string().min(1).max(100).required(),
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
});

const updateClientVersionSchema = Joi.object({
  channel: Joi.string().min(1).max(100).optional(),
  subChannel: Joi.string().min(1).max(100).optional(),
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
  channel: Joi.string().optional(),
  subChannel: Joi.string().optional(),
  clientStatus: Joi.string().valid(...Object.values(ClientStatus)).optional(),
  gameServerAddress: Joi.string().optional(),
  patchAddress: Joi.string().optional(),
  guestModeAllowed: Joi.boolean().optional(),
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
  _t: Joi.string().optional(), // 캐시 방지용 타임스탬프
});

const bulkUpdateStatusSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  clientStatus: Joi.string().valid(...Object.values(ClientStatus)).required(),
});

export class ClientVersionController {
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
      if (filterParams[key] !== undefined && filterParams[key] !== '') {
        filters[key as keyof ClientVersionFilters] = filterParams[key];
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
  static async getChannels(req: Request, res: Response) {
    const channels = await ClientVersionService.getChannels();

    res.json({
      success: true,
      data: channels,
    });
  }

  // 서브채널 목록 조회
  static async getSubChannels(req: Request, res: Response) {
    const { channel } = req.query;

    const subChannels = await ClientVersionService.getSubChannels(channel as string);

    res.json({
      success: true,
      data: subChannels,
    });
  }
}

export default ClientVersionController;
