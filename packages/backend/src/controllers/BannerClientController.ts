import { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import BannerService from '../services/BannerService';
import { SDKRequest } from '../middleware/apiTokenAuth';

export class BannerClientController {
  /**
   * Get all published banners for client
   * GET /api/v1/client/banners
   */
  static getBanners = asyncHandler(async (req: SDKRequest, res: Response) => {
    const environment = req.environment || 'development';
    const banners = await BannerService.getPublishedBanners(environment);

    // Transform for client (remove internal fields)
    const clientBanners = banners.map((banner) => ({
      bannerId: banner.bannerId,
      name: banner.name,
      width: banner.width,
      height: banner.height,
      playbackSpeed: banner.playbackSpeed,
      sequences: banner.sequences,
      metadata: banner.metadata,
      version: banner.version,
    }));

    res.json({
      success: true,
      data: {
        banners: clientBanners,
        timestamp: new Date().toISOString(),
      },
    });
  });

  /**
   * Get published banner by ID for client
   * GET /api/v1/client/banners/:bannerId
   */
  static getBannerById = asyncHandler(async (req: SDKRequest, res: Response) => {
    const { bannerId } = req.params;
    const environment = req.environment || 'development';

    const banner = await BannerService.getPublishedBannerById(bannerId, environment);

    // Transform for client (remove internal fields)
    const clientBanner = {
      bannerId: banner.bannerId,
      name: banner.name,
      width: banner.width,
      height: banner.height,
      playbackSpeed: banner.playbackSpeed,
      sequences: banner.sequences,
      metadata: banner.metadata,
      version: banner.version,
    };

    res.json({
      success: true,
      data: {
        banner: clientBanner,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
