import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import BannerService from "../services/BannerService";
import { UnifiedChangeGateway } from "../services/UnifiedChangeGateway";

export class BannerController {
  /**
   * Get all banners
   * GET /api/v1/admin/banners
   */
  static getBanners = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit, search, status, sortBy, sortOrder } = req.query;

      const environment = req.environment || "development";
      const result = await BannerService.getBanners({
        environment,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        status: status as any,
        sortBy: sortBy as string,
        sortOrder: (sortOrder as string)?.toLowerCase() as "asc" | "desc",
      });

      res.json({
        success: true,
        data: result,
        message: "Banners retrieved successfully",
      });
    },
  );

  /**
   * Get banner by ID
   * GET /api/v1/admin/banners/:bannerId
   */
  static getBannerById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { bannerId } = req.params;
      const environment = req.environment || "development";

      const banner = await BannerService.getBannerById(bannerId, environment);

      res.json({
        success: true,
        data: { banner },
        message: "Banner retrieved successfully",
      });
    },
  );

  /**
   * Create a new banner
   * POST /api/v1/admin/banners
   */
  static createBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const {
        name,
        description,
        width,
        height,
        metadata,
        playbackSpeed,
        sequences,
      } = req.body;
      const environment = req.environment || "development";
      const userId = req.user?.userId;

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.requestCreation(
        userId!,
        environment,
        "g_banners",
        {
          name,
          description,
          width,
          height,
          metadata,
          playbackSpeed,
          sequences,
          environment,
          createdBy: userId,
        },
        async () => {
          const banner = await BannerService.createBanner({
            environment,
            name,
            description,
            width,
            height,
            metadata,
            playbackSpeed,
            sequences,
            createdBy: userId,
          });
          return banner;
        },
      );

      if (gatewayResult.mode === "DIRECT") {
        res.status(201).json({
          success: true,
          data: { banner: gatewayResult.data },
          message: "Banner created successfully",
        });
      } else {
        res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            "Change request created. The banner will be created after approval.",
        });
      }
    },
  );

  /**
   * Update a banner
   * PUT /api/v1/admin/banners/:bannerId
   */
  static updateBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { bannerId } = req.params;
      const {
        name,
        description,
        width,
        height,
        metadata,
        playbackSpeed,
        sequences,
      } = req.body;
      const environment = req.environment || "development";
      const userId = req.user?.userId;

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.processChange(
        userId!,
        environment,
        "g_banners",
        bannerId,
        {
          name,
          description,
          width,
          height,
          metadata,
          playbackSpeed,
          sequences,
          updatedBy: userId,
        },
        async () => {
          const banner = await BannerService.getBannerById(
            bannerId,
            environment,
          );
          return { banner };
        },
      );

      if (gatewayResult.mode === "DIRECT") {
        res.json({
          success: true,
          data: gatewayResult.data,
          message: "Banner updated successfully",
        });
      } else {
        res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            "Change request created. The update will be applied after approval.",
        });
      }
    },
  );

  /**
   * Delete a banner
   * DELETE /api/v1/admin/banners/:bannerId
   */
  static deleteBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { bannerId } = req.params;
      const environment = req.environment || "development";
      const userId = req.user?.userId;

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.requestDeletion(
        userId!,
        environment,
        "g_banners",
        bannerId,
        async () => {
          await BannerService.deleteBanner(bannerId, environment);
        },
      );

      if (gatewayResult.mode === "DIRECT") {
        res.json({
          success: true,
          message: "Banner deleted successfully",
        });
      } else {
        res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            "Change request created. The deletion will be applied after approval.",
        });
      }
    },
  );

  /**
   * Publish a banner
   * POST /api/v1/admin/banners/:bannerId/publish
   */
  static publishBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { bannerId } = req.params;
      const environment = req.environment || "development";
      const userId = req.user?.userId;

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.processChange(
        userId!,
        environment,
        "g_banners",
        bannerId,
        { status: "published", updatedBy: userId },
        async () => {
          const banner = await BannerService.getBannerById(
            bannerId,
            environment,
          );
          return { banner };
        },
      );

      if (gatewayResult.mode === "DIRECT") {
        res.json({
          success: true,
          data: gatewayResult.data,
          message: "Banner published successfully",
        });
      } else {
        res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            "Change request created. The publish action will be applied after approval.",
        });
      }
    },
  );

  /**
   * Archive a banner
   * POST /api/v1/admin/banners/:bannerId/archive
   */
  static archiveBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { bannerId } = req.params;
      const environment = req.environment || "development";
      const userId = req.user?.userId;

      // Use UnifiedChangeGateway for CR support
      const gatewayResult = await UnifiedChangeGateway.processChange(
        userId!,
        environment,
        "g_banners",
        bannerId,
        { status: "archived", updatedBy: userId },
        async () => {
          const banner = await BannerService.getBannerById(
            bannerId,
            environment,
          );
          return { banner };
        },
      );

      if (gatewayResult.mode === "DIRECT") {
        res.json({
          success: true,
          data: gatewayResult.data,
          message: "Banner archived successfully",
        });
      } else {
        res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            "Change request created. The archive action will be applied after approval.",
        });
      }
    },
  );

  /**
   * Duplicate a banner
   * POST /api/v1/admin/banners/:bannerId/duplicate
   */
  static duplicateBanner = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { bannerId } = req.params;
      const environment = req.environment || "development";
      const userId = req.user?.userId;

      // Use UnifiedChangeGateway for CR support (Creation)
      const gatewayResult = await UnifiedChangeGateway.requestCreation(
        userId!,
        environment,
        "g_banners",
        { duplicateFrom: bannerId, environment, createdBy: userId },
        async () => {
          const banner = await BannerService.duplicateBanner(
            bannerId,
            environment,
            userId,
          );
          return banner;
        },
      );

      if (gatewayResult.mode === "DIRECT") {
        res.json({
          success: true,
          data: { banner: gatewayResult.data },
          message: "Banner duplicated successfully",
        });
      } else {
        res.status(202).json({
          success: true,
          data: {
            changeRequestId: gatewayResult.changeRequestId,
            status: gatewayResult.status,
          },
          message:
            "Change request created. The duplication will be applied after approval.",
        });
      }
    },
  );
}
