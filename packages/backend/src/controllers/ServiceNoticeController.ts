import { Response } from 'express';
import ServiceNoticeService from '../services/ServiceNoticeService';
import { AuthenticatedRequest } from '../types/auth';

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
        return res.status(400).json({
          success: false,
          message: 'Environment is required',
        });
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

      res.json({
        success: true,
        data: result,
        message: 'Service notices retrieved successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get service notices',
      });
    }
  }

  /**
   * Get service notice by ID
   */
  getServiceNoticeById = async (req: AuthenticatedRequest, res: Response, next: any) => {
    try {
      const id = parseInt(req.params.id);
      const environment = req.environment;

      if (!environment) {
        return res.status(400).json({
          success: false,
          message: 'Environment is required',
        });
      }

      const notice = await ServiceNoticeService.getServiceNoticeById(id, environment);

      if (!notice) {
        return res.status(404).json({
          success: false,
          message: 'Service notice not found',
        });
      }

      res.json({
        success: true,
        data: { notice },
        message: 'Service notice retrieved successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get service notice',
      });
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
        return res.status(400).json({
          success: false,
          message: 'Environment is required',
        });
      }

      // Debug logging
      console.log('Received service notice data:', JSON.stringify(data, null, 2));

      // Validation
      if (!data.category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required',
        });
      }

      // Platforms is optional - empty array means "all platforms"
      if (!Array.isArray(data.platforms)) {
        return res.status(400).json({
          success: false,
          message: 'Platforms must be an array',
        });
      }

      if (!data.title) {
        return res.status(400).json({
          success: false,
          message: 'Title is required',
        });
      }

      if (!data.content) {
        return res.status(400).json({
          success: false,
          message: 'Content is required',
        });
      }

      const notice = await ServiceNoticeService.createServiceNotice(data, environment);

      res.status(201).json({
        success: true,
        data: { notice },
        message: 'Service notice created successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create service notice',
      });
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
        return res.status(400).json({
          success: false,
          message: 'Environment is required',
        });
      }

      const notice = await ServiceNoticeService.updateServiceNotice(id, data, environment);

      res.json({
        success: true,
        data: { notice },
        message: 'Service notice updated successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update service notice',
      });
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
        return res.status(400).json({
          success: false,
          message: 'Environment is required',
        });
      }

      await ServiceNoticeService.deleteServiceNotice(id, environment);

      res.json({
        success: true,
        message: 'Service notice deleted successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete service notice',
      });
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
        return res.status(400).json({
          success: false,
          message: 'Environment is required',
        });
      }

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs array is required',
        });
      }

      await ServiceNoticeService.deleteMultipleServiceNotices(ids, environment);

      res.json({
        success: true,
        message: `${ids.length} service notice(s) deleted successfully`,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete service notices',
      });
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
        return res.status(400).json({
          success: false,
          message: 'Environment is required',
        });
      }

      const notice = await ServiceNoticeService.toggleActive(id, environment);

      res.json({
        success: true,
        data: { notice },
        message: 'Service notice status toggled successfully',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to toggle service notice status',
      });
    }
  }
}

export default new ServiceNoticeController();
