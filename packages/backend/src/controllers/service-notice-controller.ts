import { Response } from 'express';
import ServiceNoticeService from '../services/service-notice-service';
import { AuthenticatedRequest } from '../types/auth';
import {
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/api-response';
import { UnifiedChangeGateway } from '../services/unified-change-gateway';
import { TagService } from '../services/tag-service';

import { createLogger } from '../config/logger';
const logger = createLogger('ServiceNoticeController');

class ServiceNoticeController {
  /**
   * Get service notices with pagination and filters
   */
  getServiceNotices = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const environmentId = req.environmentId;

      if (!environmentId) {
        return sendBadRequest(res, 'Environment is required', {
          field: 'environmentId',
        });
      }

      // Parse platform - can be string or array
      let platform: string | string[] | undefined;
      if (req.query.platform) {
        platform = Array.isArray(req.query.platform)
          ? (req.query.platform as string[])
          : (req.query.platform as string).split(',').filter((p) => p.trim());
      }

      // Parse channel - can be string or array
      let channel: string | string[] | undefined;
      if (req.query.channel) {
        channel = Array.isArray(req.query.channel)
          ? (req.query.channel as string[])
          : (req.query.channel as string).split(',').filter((c) => c.trim());
      }

      // Parse subchannel - can be string or array
      let subchannel: string | string[] | undefined;
      if (req.query.subchannel) {
        subchannel = Array.isArray(req.query.subchannel)
          ? (req.query.subchannel as string[])
          : (req.query.subchannel as string).split(',').filter((s) => s.trim());
      }

      const filters = {
        isActive:
          req.query.isActive !== undefined
            ? req.query.isActive === 'true'
            : undefined,
        currentlyVisible:
          req.query.currentlyVisible !== undefined
            ? req.query.currentlyVisible === 'true'
            : undefined,
        category: req.query.category as string,
        platform,
        platformOperator: req.query.platformOperator as
          | 'any_of'
          | 'include_all'
          | undefined,
        channel,
        channelOperator: req.query.channelOperator as
          | 'any_of'
          | 'include_all'
          | undefined,
        subchannel,
        subchannelOperator: req.query.subchannelOperator as
          | 'any_of'
          | 'include_all'
          | undefined,
        search: req.query.search as string,
        sortBy: req.query.sortBy as string,
        sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
        environmentId,
      };

      const result = await ServiceNoticeService.getServiceNotices(
        page,
        limit,
        filters
      );

      return sendSuccessResponse(
        res,
        result,
        'Service notices retrieved successfully'
      );
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to get service notices',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  };

  /**
   * Get service notice by ID
   */
  getServiceNoticeById = async (
    req: AuthenticatedRequest,
    res: Response,
    _next: any
  ) => {
    try {
      const id = req.params.id;
      const environmentId = req.environmentId;

      if (!environmentId) {
        return sendBadRequest(res, 'Environment is required', {
          field: 'environmentId',
        });
      }

      const notice = await ServiceNoticeService.getServiceNoticeById(
        id,
        environmentId
      );

      if (!notice) {
        return sendNotFound(
          res,
          'Service notice not found',
          ErrorCodes.RESOURCE_NOT_FOUND
        );
      }

      return sendSuccessResponse(
        res,
        { notice },
        'Service notice retrieved successfully'
      );
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to get service notice',
        error,
        ErrorCodes.RESOURCE_FETCH_FAILED
      );
    }
  };

  /**
   * Create service notice
   */
  createServiceNotice = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = req.body;
      const environmentId = req.environmentId;
      const userId = req.user?.userId;

      if (!environmentId) {
        return sendBadRequest(res, 'Environment is required', {
          field: 'environmentId',
        });
      }

      // Debug logging
      logger.debug('Received service notice data:', { data });

      // Validation
      if (!data.category) {
        return sendBadRequest(res, 'Category is required', {
          field: 'category',
        });
      }

      // Platforms is optional - empty array means "all platforms"
      if (!Array.isArray(data.platforms)) {
        return sendBadRequest(res, 'Platforms must be an array', {
          field: 'platforms',
        });
      }

      if (!data.title) {
        return sendBadRequest(res, 'Title is required', { field: 'title' });
      }

      if (!data.content) {
        return sendBadRequest(res, 'Content is required', { field: 'content' });
      }

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.requestCreation(
        userId!,
        environmentId,
        'g_service_notices',
        { ...data, environmentId },
        async () => {
          const notice = await ServiceNoticeService.createServiceNotice(
            data,
            environmentId
          );
          return notice;
        }
      );

      if (gatewayResult.mode === 'DIRECT') {
        // Handle tags if provided
        const createdNotice = gatewayResult.data;
        if (data.tags && Array.isArray(data.tags) && createdNotice?.id) {
          const tagIds = data.tags
            .map((tag: any) => tag.id)
            .filter((id: any) => id);
          await TagService.setTagsForEntity(
            'service_notice',
            createdNotice.id.toString(),
            tagIds,
            userId
          );
        }

        return sendSuccessResponse(
          res,
          { notice: createdNotice },
          'Service notice created successfully',
          201
        );
      } else {
        return res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            'Change request created. The service notice will be created after approval.',
        });
      }
    } catch (error) {
      return sendInternalError(
        res,
        'Failed to create service notice',
        error,
        ErrorCodes.RESOURCE_CREATE_FAILED
      );
    }
  };

  /**
   * Update service notice
   */
  updateServiceNotice = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const data = req.body;
      const environmentId = req.environmentId;
      const userId = req.user?.userId;

      if (!environmentId) {
        return sendBadRequest(res, 'Environment is required', {
          field: 'environmentId',
        });
      }

      // Validation
      if (data.title !== undefined && !data.title.trim()) {
        return sendBadRequest(res, 'Title cannot be empty', { field: 'title' });
      }

      if (data.content !== undefined && !data.content.trim()) {
        return sendBadRequest(res, 'Content cannot be empty', {
          field: 'content',
        });
      }

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.processChange(
        userId!,
        environmentId,
        'g_service_notices',
        id,
        data,
        async (processedData: any) => {
          const notice = await ServiceNoticeService.updateServiceNotice(
            id,
            processedData,
            environmentId
          );
          return { notice };
        }
      );

      if (gatewayResult.mode === 'DIRECT') {
        // Handle tags if provided
        if (data.tags !== undefined) {
          const tagIds = Array.isArray(data.tags)
            ? data.tags.map((tag: any) => tag.id).filter((tid: any) => tid)
            : [];
          await TagService.setTagsForEntity(
            'service_notice',
            id,
            tagIds,
            userId
          );
        }

        return sendSuccessResponse(
          res,
          gatewayResult.data,
          'Service notice updated successfully'
        );
      } else {
        return res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            'Change request created. The update will be applied after approval.',
        });
      }
    } catch (error) {
      if ((error as any).code === ErrorCodes.RESOURCE_LOCKED) {
        return res.status(409).json({
          success: false,
          error: {
            code: ErrorCodes.RESOURCE_LOCKED,
            message: (error as any).message,
            payload: (error as any).payload,
          },
        });
      }
      return sendInternalError(
        res,
        'Failed to update service notice',
        error,
        ErrorCodes.RESOURCE_UPDATE_FAILED
      );
    }
  };

  /**
   * Delete service notice
   */
  deleteServiceNotice = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const environmentId = req.environmentId;
      const userId = req.user?.userId;

      if (!environmentId) {
        return sendBadRequest(res, 'Environment is required', {
          field: 'environmentId',
        });
      }

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.requestDeletion(
        userId!,
        environmentId,
        'g_service_notices',
        id,
        async () => {
          await ServiceNoticeService.deleteServiceNotice(id, environmentId);
        }
      );

      if (gatewayResult.mode === 'DIRECT') {
        return sendSuccessResponse(
          res,
          undefined,
          'Service notice deleted successfully'
        );
      } else {
        return res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            'Change request created. The deletion will be applied after approval.',
        });
      }
    } catch (error) {
      if ((error as any).code === ErrorCodes.RESOURCE_LOCKED) {
        return res.status(409).json({
          success: false,
          error: {
            code: ErrorCodes.RESOURCE_LOCKED,
            message: (error as any).message,
            payload: (error as any).payload,
          },
        });
      }
      return sendInternalError(
        res,
        'Failed to delete service notice',
        error,
        ErrorCodes.RESOURCE_DELETE_FAILED
      );
    }
  };

  /**
   * Delete multiple service notices
   */
  deleteMultipleServiceNotices = async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      const { ids } = req.body;
      const environmentId = req.environmentId;
      const userId = req.user?.userId;

      if (!environmentId) {
        return sendBadRequest(res, 'Environment is required', {
          field: 'environmentId',
        });
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        return sendBadRequest(res, 'IDs array is required', { field: 'ids' });
      }

      // For bulk delete, check if CR is required
      const requiresCR =
        await UnifiedChangeGateway.requiresApproval(environmentId);

      if (requiresCR) {
        // Create individual CRs for each item
        const results = [];
        for (const id of ids) {
          const gatewayResult = await UnifiedChangeGateway.requestDeletion(
            userId!,
            environmentId,
            'g_service_notices',
            id,
            async () => {
              await ServiceNoticeService.deleteServiceNotice(id, environmentId);
            }
          );
          results.push({ id, changeRequestId: gatewayResult.changeRequestId });
        }

        return res.status(202).json({
          success: true,
          data: { results },
          message: `Change requests created for ${ids.length} service notice(s). Deletions will be applied after approval.`,
        });
      } else {
        await ServiceNoticeService.deleteMultipleServiceNotices(
          ids,
          environmentId
        );
        return sendSuccessResponse(
          res,
          undefined,
          `${ids.length} service notice(s) deleted successfully`
        );
      }
    } catch (error) {
      if ((error as any).code === ErrorCodes.RESOURCE_LOCKED) {
        return res.status(409).json({
          success: false,
          error: {
            code: ErrorCodes.RESOURCE_LOCKED,
            message: (error as any).message,
            payload: (error as any).payload,
          },
        });
      }
      return sendInternalError(
        res,
        'Failed to delete service notices',
        error,
        ErrorCodes.RESOURCE_DELETE_FAILED
      );
    }
  };

  /**
   * Toggle active status
   */
  toggleActive = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = req.params.id;
      const environmentId = req.environmentId;
      const userId = req.user?.userId;

      if (!environmentId) {
        return sendBadRequest(res, 'Environment is required', {
          field: 'environmentId',
        });
      }

      // Get current state
      const currentNotice = await ServiceNoticeService.getServiceNoticeById(
        id,
        environmentId
      );
      if (!currentNotice) {
        return sendNotFound(
          res,
          'Service notice not found',
          ErrorCodes.RESOURCE_NOT_FOUND
        );
      }

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.processChange(
        userId!,
        environmentId,
        'g_service_notices',
        id,
        async (currentData: any) => {
          return { isActive: !currentData.isActive };
        },
        async (processedData: any) => {
          const notice = await ServiceNoticeService.updateServiceNotice(
            id,
            processedData,
            environmentId
          );
          return { notice };
        }
      );

      if (gatewayResult.mode === 'DIRECT') {
        return sendSuccessResponse(
          res,
          gatewayResult.data,
          'Service notice status toggled successfully'
        );
      } else {
        return res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            'Change request created. Status toggle will be applied after approval.',
        });
      }
    } catch (error) {
      if ((error as any).code === ErrorCodes.RESOURCE_LOCKED) {
        return res.status(409).json({
          success: false,
          error: {
            code: ErrorCodes.RESOURCE_LOCKED,
            message: (error as any).message,
            payload: (error as any).payload,
          },
        });
      }
      return sendInternalError(
        res,
        'Failed to toggle service notice status',
        error,
        ErrorCodes.RESOURCE_UPDATE_FAILED
      );
    }
  };
}

export default new ServiceNoticeController();
