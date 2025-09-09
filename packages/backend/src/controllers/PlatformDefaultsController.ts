import { Response, NextFunction } from 'express';
import { PlatformDefaultsService, PlatformDefaults, PlatformDefaultsMap } from '../services/PlatformDefaultsService';
import { AuthenticatedRequest } from '../middleware/auth';
import { CustomError, asyncHandler } from '../middleware/errorHandler';
import Joi from 'joi';

// Validation schemas
const platformDefaultsSchema = Joi.object({
  gameServerAddress: Joi.string().allow('').optional(),
  patchAddress: Joi.string().allow('').optional(),
});

const allDefaultsSchema = Joi.object().pattern(
  Joi.string(), // platform name
  platformDefaultsSchema
);

export class PlatformDefaultsController {
  /**
   * 모든 플랫폼의 기본값 조회
   * GET /api/v1/admin/platform-defaults
   */
  static getAllDefaults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const defaults = await PlatformDefaultsService.getAllDefaults();
    
    res.json({
      success: true,
      data: defaults,
    });
  });

  /**
   * 특정 플랫폼의 기본값 조회
   * GET /api/v1/admin/platform-defaults/:platform
   */
  static getPlatformDefaults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { platform } = req.params;
    
    if (!platform) {
      throw new CustomError('Platform parameter is required', 400);
    }

    const defaults = await PlatformDefaultsService.getPlatformDefaults(platform);
    
    res.json({
      success: true,
      data: {
        platform,
        defaults,
      },
    });
  });

  /**
   * 특정 플랫폼의 기본값 설정
   * PUT /api/v1/admin/platform-defaults/:platform
   */
  static setPlatformDefaults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { platform } = req.params;
    
    if (!platform) {
      throw new CustomError('Platform parameter is required', 400);
    }

    // Validate request body
    const { error, value } = platformDefaultsSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const defaults: PlatformDefaults = value;
    
    await PlatformDefaultsService.setPlatformDefaults(platform, defaults, (req.user as any).userId);

    res.json({
      success: true,
      message: `Platform defaults updated for ${platform}`,
      data: {
        platform,
        defaults,
      },
    });
  });

  /**
   * 모든 플랫폼의 기본값 일괄 설정
   * PUT /api/v1/admin/platform-defaults
   */
  static setAllDefaults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Validate request body
    const { error, value } = allDefaultsSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.details[0].message, 400);
    }

    const defaultsMap: PlatformDefaultsMap = value;

    await PlatformDefaultsService.setAllDefaults(defaultsMap, (req.user as any).userId);

    res.json({
      success: true,
      message: 'All platform defaults updated',
      data: defaultsMap,
    });
  });

  /**
   * 특정 플랫폼의 기본값 삭제
   * DELETE /api/v1/admin/platform-defaults/:platform
   */
  static deletePlatformDefaults = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { platform } = req.params;
    
    if (!platform) {
      throw new CustomError('Platform parameter is required', 400);
    }

    await PlatformDefaultsService.deletePlatformDefaults(platform, (req.user as any).userId);

    res.json({
      success: true,
      message: `Platform defaults deleted for ${platform}`,
    });
  });
}
