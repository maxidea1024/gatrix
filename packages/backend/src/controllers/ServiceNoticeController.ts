import { Request, Response } from 'express';
import ServiceNoticeService from '../services/ServiceNoticeService';

class ServiceNoticeController {
  /**
   * Get service notices with pagination and filters
   */
  async getServiceNotices(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      // Parse platform - can be string or array
      let platform: string | string[] | undefined;
      if (req.query.platform) {
        platform = Array.isArray(req.query.platform)
          ? req.query.platform as string[]
          : (req.query.platform as string).split(',').filter(p => p.trim());
      }

      const filters = {
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
        currentlyVisible: req.query.currentlyVisible !== undefined ? req.query.currentlyVisible === 'true' : undefined,
        category: req.query.category as string,
        platform,
        platformOperator: req.query.platformOperator as 'any_of' | 'include_all' | undefined,
        search: req.query.search as string,
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
  async getServiceNoticeById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const notice = await ServiceNoticeService.getServiceNoticeById(id);

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
  async createServiceNotice(req: Request, res: Response) {
    try {
      const data = req.body;

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

      if (!data.endDate) {
        return res.status(400).json({
          success: false,
          message: 'End date is required',
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

      const notice = await ServiceNoticeService.createServiceNotice(data);

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
  async updateServiceNotice(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;

      const notice = await ServiceNoticeService.updateServiceNotice(id, data);

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
  async deleteServiceNotice(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      await ServiceNoticeService.deleteServiceNotice(id);

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
  async deleteMultipleServiceNotices(req: Request, res: Response) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'IDs array is required',
        });
      }

      await ServiceNoticeService.deleteMultipleServiceNotices(ids);

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
  async toggleActive(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      const notice = await ServiceNoticeService.toggleActive(id);

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

