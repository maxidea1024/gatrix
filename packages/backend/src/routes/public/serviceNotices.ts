import express from 'express';
import ServiceNoticeService from '../../services/ServiceNoticeService';

const router = express.Router();

/**
 * Public endpoint to get active service notices
 * No authentication required - for game clients
 */
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;

    // Parse platform - can be string or array
    let platform: string | string[] | undefined;
    if (req.query.platform) {
      platform = Array.isArray(req.query.platform)
        ? req.query.platform as string[]
        : (req.query.platform as string).split(',').filter(p => p.trim());
    }

    // Public endpoint only returns active notices
    const filters = {
      isActive: true, // Always filter for active notices only
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
});

/**
 * Public endpoint to get a specific service notice by ID
 * No authentication required - for game clients
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notice = await ServiceNoticeService.getServiceNoticeById(id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Service notice not found',
      });
    }

    // Only return if active
    if (!notice.isActive) {
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
});

export default router;

