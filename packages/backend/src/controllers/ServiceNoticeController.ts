import { Response } from 'express';
import ServiceNoticeService from '../services/ServiceNoticeService';
import { AuthenticatedRequest } from '../types/auth';
import {
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendSuccessResponse,
  ErrorCodes,
} from '../utils/apiResponse';
import logger from '../config/logger';

class ServiceNoticeController {
  /**
   * Get service notices with pagination and filters
   */
  getServiceNotices = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const environment = req.environment;

      if (!environment) {
        return sendBadRequest(res, 'Environment is required', { field: 'environment' });
      }

      // Parse platform - can be string or array
      let platform: string | string[] | undefined;
      if (req.query.platform) {
        platform = Array.isArray(req.query.platform)
          ? req.query.platform as string[]
          : (req.query.platform as string).split(',').filter(p => p.trim());
      }

      // Parse channel - can be string or array
      let channel: string | string[] | undefined;
      if (req.query.channel) {
        channel = Array.isArray(req.query.channel)
          ? req.query.channel as string[]
          : (req.query.channel as string).split(',').filter(c => c.trim());
      }

      // Parse subchannel - can be string or array
      let subchannel: string | string[] | undefined;
      if (req.query.subchannel) {
        subchannel = Array.isArray(req.query.subchannel)
          ? req.query.subchannel as string[]
          : (req.query.subchannel as string).split(',').filter(s => s.trim());
      }

      const filters = {
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        currentlyVisible: req.query.currentlyVisible !== undefined ? req.query.currentlyVisible === 'true' : undefined,
        category: req.query.category as string,
        platform,
        platformOperator: req.query.platformOperator as 'any_of' | 'include_all' | undefined,
        channel,
        channelOperator: req.query.channelOperator as 'any_of' | 'include_all' | undefined,
        subchannel,
        subchannelOperator: req.query.subchannelOperator as 'any_of' | 'include_all' | undefined,
        search: req.query.search as string,
        environment,
      };

      const result = await ServiceNoticeService.getServiceNotices(page, limit, filters);

      return sendSuccessResponse(res, result, 'Service notices retrieved successfully');
    } catch (error) {
      return sendInternalError(res, 'Failed to get service notices', error, ErrorCodes.RESOURCE_FETCH_FAILED);
    }
  }

  /**
   * Get service notice by ID
   */
  getServiceNoticeById = async (req: AuthenticatedRequest, res: Response, _next: any) => {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        return sendBadRequest(res, 'Environment is required', { field: 'environment' });
      }

      const notice = await ServiceNoticeService.getServiceNoticeById(id, environment);

      if (!notice) {
        return sendNotFound(res, 'Service notice not found', ErrorCodes.RESOURCE_NOT_FOUND);
      }

      return sendSuccessResponse(res, { notice }, 'Service notice retrieved successfully');
    } catch (error) {
      return sendInternalError(res, 'Failed to get service notice', error, ErrorCodes.RESOURCE_FETCH_FAILED);
    }
  }

  /**
   * Create service notice
   */
  createServiceNotice = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = req.body;
      const environment = req.environment;

      if (!environment) {
        return sendBadRequest(res, 'Environment is required', { field: 'environment' });
      }

      // Debug logging
      logger.debug('Received service notice data:', { data });

      // Validation
      if (!data.category) {
        return sendBadRequest(res, 'Category is required', { field: 'category' });
      }

      // Platforms is optional - empty array means "all platforms"
      if (!Array.isArray(data.platforms)) {
        return sendBadRequest(res, 'Platforms must be an array', { field: 'platforms' });
      }

      if (!data.title) {
        return sendBadRequest(res, 'Title is required', { field: 'title' });
      }

      if (!data.content) {
        return sendBadRequest(res, 'Content is required', { field: 'content' });
      }

      const notice = await ServiceNoticeService.createServiceNotice(data, environment);

      return sendSuccessResponse(res, { notice }, 'Service notice created successfully', 201);
    } catch (error) {
      return sendInternalError(res, 'Failed to create service notice', error, ErrorCodes.RESOURCE_CREATE_FAILED);
    }
  }

  /**
   * Update service notice
   */
  updateServiceNotice = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;
      const environment = req.environment;

      if (!environment) {
        return sendBadRequest(res, 'Environment is required', { field: 'environment' });
      }

      const notice = await ServiceNoticeService.updateServiceNotice(id, data, environment);

      return sendSuccessResponse(res, { notice }, 'Service notice updated successfully');
    } catch (error) {
      return sendInternalError(res, 'Failed to update service notice', error, ErrorCodes.RESOURCE_UPDATE_FAILED);
    }
  }

  /**
   * Delete service notice
   */
  deleteServiceNotice = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        return sendBadRequest(res, 'Environment is required', { field: 'environment' });
      }

      await ServiceNoticeService.deleteServiceNotice(id, environment);

      return sendSuccessResponse(res, undefined, 'Service notice deleted successfully');
    } catch (error) {
      return sendInternalError(res, 'Failed to delete service notice', error, ErrorCodes.RESOURCE_DELETE_FAILED);
    }
  }

  /**
   * Delete multiple service notices
   */
  deleteMultipleServiceNotices = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ids } = req.body;
      const environment = req.environment;

      if (!environment) {
        return sendBadRequest(res, 'Environment is required', { field: 'environment' });
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        return sendBadRequest(res, 'IDs array is required', { field: 'ids' });
      }

      await ServiceNoticeService.deleteMultipleServiceNotices(ids, environment);

      return sendSuccessResponse(res, undefined, `${ids.length} service notice(s) deleted successfully`);
    } catch (error) {
      return sendInternalError(res, 'Failed to delete service notices', error, ErrorCodes.RESOURCE_DELETE_FAILED);
    }
  }

  /**
   * Toggle active status
   */
  toggleActive = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        return sendBadRequest(res, 'Environment is required', { field: 'environment' });
      }

      const notice = await ServiceNoticeService.toggleActive(id, environment);

      return sendSuccessResponse(res, { notice }, 'Service notice status toggled successfully');
    } catch (error) {
      return sendInternalError(res, 'Failed to toggle service notice status', error, ErrorCodes.RESOURCE_UPDATE_FAILED);
    }
  }
}

export default new ServiceNoticeController();
