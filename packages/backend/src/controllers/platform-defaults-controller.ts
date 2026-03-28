import { Response, NextFunction } from 'express';
import {
  PlatformDefaultsService,
  PlatformDefaults,
  PlatformDefaultsMap,
} from '../services/platform-defaults-service';
import { AuthenticatedRequest } from '../middleware/auth';
import { GatrixError, asyncHandler } from '../middleware/error-handler';
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
   * Get default values for all platforms
   * GET /api/v1/admin/platform-defaults
   */
  static getAllDefaults = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId!;
      const defaults =
        await PlatformDefaultsService.getAllDefaults(environmentId);

      res.json({
        success: true,
        data: defaults,
      });
    }
  );

  /**
   * Get default values for a specific platform
   * GET /api/v1/admin/platform-defaults/:platform
   */
  static getPlatformDefaults = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { platform } = req.params;
      const environmentId = req.environmentId!;

      if (!platform) {
        throw new GatrixError('Platform parameter is required', 400);
      }

      const defaults = await PlatformDefaultsService.getPlatformDefaults(
        platform,
        environmentId
      );

      res.json({
        success: true,
        data: {
          platform,
          defaults,
        },
      });
    }
  );

  /**
   * Set default values for a specific platform
   * PUT /api/v1/admin/platform-defaults/:platform
   */
  static setPlatformDefaults = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { platform } = req.params;
      const environmentId = req.environmentId!;

      if (!platform) {
        throw new GatrixError('Platform parameter is required', 400);
      }

      // Validate request body
      const { error, value } = platformDefaultsSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const defaults: PlatformDefaults = value;

      await PlatformDefaultsService.setPlatformDefaults(
        platform,
        defaults,
        (req.user as any).userId,
        environmentId
      );

      res.json({
        success: true,
        message: `Platform defaults updated for ${platform}`,
        data: {
          platform,
          defaults,
        },
      });
    }
  );

  /**
   * Batch set default values for all platforms
   * PUT /api/v1/admin/platform-defaults
   */
  static setAllDefaults = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId!;

      // Validate request body
      const { error, value } = allDefaultsSchema.validate(req.body);
      if (error) {
        throw new GatrixError(error.details[0].message, 400);
      }

      const defaultsMap: PlatformDefaultsMap = value;

      await PlatformDefaultsService.setAllDefaults(
        defaultsMap,
        (req.user as any).userId,
        environmentId
      );

      res.json({
        success: true,
        message: 'All platform defaults updated',
        data: defaultsMap,
      });
    }
  );

  /**
   * Delete default values for a specific platform
   * DELETE /api/v1/admin/platform-defaults/:platform
   */
  static deletePlatformDefaults = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { platform } = req.params;
      const environmentId = req.environmentId!;

      if (!platform) {
        throw new GatrixError('Platform parameter is required', 400);
      }

      await PlatformDefaultsService.deletePlatformDefaults(
        platform,
        (req.user as any).userId,
        environmentId
      );

      res.json({
        success: true,
        message: `Platform defaults deleted for ${platform}`,
      });
    }
  );
}
