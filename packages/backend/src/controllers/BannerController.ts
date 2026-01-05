import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import BannerService from '../services/BannerService';

export class BannerController {
  /**
   * Get all banners
   * GET /api/v1/admin/banners
   */
  static getBanners = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, status, sortBy, sortOrder } = req.query;

    const environment = req.environment || 'development';
    const result = await BannerService.getBanners({
      environment,
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      search: search as string,
      status: status as any,
      sortBy: sortBy as string,
      sortOrder: (sortOrder as string)?.toLowerCase() as 'asc' | 'desc',
    });

    res.json({
      success: true,
      data: result,
      message: 'Banners retrieved successfully',
    });
  });

  /**
   * Get banner by ID
   * GET /api/v1/admin/banners/:bannerId
   */
  static getBannerById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bannerId } = req.params;
    const environment = req.environment || 'development';

    const banner = await BannerService.getBannerById(bannerId, environment);

    res.json({
      success: true,
      data: { banner },
      message: 'Banner retrieved successfully',
    });
  });

  /**
   * Create a new banner
   * POST /api/v1/admin/banners
   */
  static createBanner = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { name, description, width, height, metadata, playbackSpeed, sequences } = req.body;
    const environment = req.environment || 'development';

    const banner = await BannerService.createBanner({
      environment,
      name,
      description,
      width,
      height,
      metadata,
      playbackSpeed,
      sequences,
      createdBy: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      data: { banner },
      message: 'Banner created successfully',
    });
  });

  /**
   * Update a banner
   * PUT /api/v1/admin/banners/:bannerId
   */
  static updateBanner = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bannerId } = req.params;
    const { name, description, width, height, metadata, playbackSpeed, sequences } = req.body;
    const environment = req.environment || 'development';

    const banner = await BannerService.updateBanner(bannerId, environment, {
      name,
      description,
      width,
      height,
      metadata,
      playbackSpeed,
      sequences,
      updatedBy: req.user?.userId,
    });

    res.json({
      success: true,
      data: { banner },
      message: 'Banner updated successfully',
    });
  });

  /**
   * Delete a banner
   * DELETE /api/v1/admin/banners/:bannerId
   */
  static deleteBanner = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bannerId } = req.params;
    const environment = req.environment || 'development';

    await BannerService.deleteBanner(bannerId, environment);

    res.json({
      success: true,
      message: 'Banner deleted successfully',
    });
  });

  /**
   * Publish a banner
   * POST /api/v1/admin/banners/:bannerId/publish
   */
  static publishBanner = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bannerId } = req.params;
    const environment = req.environment || 'development';

    const banner = await BannerService.publishBanner(bannerId, environment, req.user?.userId);

    res.json({
      success: true,
      data: { banner },
      message: 'Banner published successfully',
    });
  });

  /**
   * Archive a banner
   * POST /api/v1/admin/banners/:bannerId/archive
   */
  static archiveBanner = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bannerId } = req.params;
    const environment = req.environment || 'development';

    const banner = await BannerService.archiveBanner(bannerId, environment, req.user?.userId);

    res.json({
      success: true,
      data: { banner },
      message: 'Banner archived successfully',
    });
  });

  /**
   * Duplicate a banner
   * POST /api/v1/admin/banners/:bannerId/duplicate
   */
  static duplicateBanner = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { bannerId } = req.params;
    const environment = req.environment || 'development';

    const banner = await BannerService.duplicateBanner(bannerId, environment, req.user?.userId);

    res.json({
      success: true,
      data: { banner },
      message: 'Banner duplicated successfully',
    });
  });
}

