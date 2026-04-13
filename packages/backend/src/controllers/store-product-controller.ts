import { Response } from 'express';
import { asyncHandler, GatrixError } from '../middleware/error-handler';
import { AuthenticatedRequest } from '../middleware/auth';
import StoreProductService from '../services/store-product-service';
import { TagService } from '../services/tag-service';
import { UnifiedChangeGateway } from '../services/unified-change-gateway';

import { createLogger } from '../config/logger';
const logger = createLogger('StoreProductController');

export class StoreProductController {
  /**
   * Get all store products
   * GET /api/v1/admin/store-products
   */
  static getStoreProducts = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { page, limit, search, sortBy, sortOrder, store, isActive } =
        req.query;
      const environmentId = req.environmentId;

      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const result = await StoreProductService.getStoreProducts({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string,
        sortBy: sortBy as string,
        sortOrder: (sortOrder as string)?.toLowerCase() as 'asc' | 'desc',
        store: store as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        environmentId,
      });

      res.json({
        success: true,
        data: result,
        message: 'Store products retrieved successfully',
      });
    }
  );

  /**
   * Get store product statistics
   * GET /api/v1/admin/store-products/stats
   */
  static getStats = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }
      const stats = await StoreProductService.getStats(environmentId);

      res.json({
        success: true,
        data: stats,
        message: 'Store product stats retrieved successfully',
      });
    }
  );

  /**
   * Get a single store product by ID
   * GET /api/v1/admin/store-products/:id
   */
  static getStoreProductById = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Store product ID is required', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const product = await StoreProductService.getStoreProductById(
        id,
        environmentId
      );

      res.json({
        success: true,
        data: { product },
        message: 'Store product retrieved successfully',
      });
    }
  );

  /**
   * Create a new store product
   * POST /api/v1/admin/store-products
   */
  static createStoreProduct = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!userId) {
        throw new GatrixError('User authentication required', 401);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const {
        productId,
        productName,
        store,
        price,
        currency,
        isActive,
        saleStartAt,
        saleEndAt,
        description,
        metadata,
        tagIds,
      } = req.body;

      // Validation
      if (
        !productId ||
        typeof productId !== 'string' ||
        productId.trim().length === 0
      ) {
        throw new GatrixError('Product ID is required', 400);
      }
      if (
        !productName ||
        typeof productName !== 'string' ||
        productName.trim().length === 0
      ) {
        throw new GatrixError('Product name is required', 400);
      }
      if (!store || typeof store !== 'string' || store.trim().length === 0) {
        throw new GatrixError('Store is required', 400);
      }
      if (price === undefined || typeof price !== 'number' || price < 0) {
        throw new GatrixError('Valid price is required', 400);
      }

      const result = await UnifiedChangeGateway.requestCreation(
        userId,
        environmentId,
        'g_store_products',
        {
          productId: productId.trim(),
          productName: productName.trim(),
          store: store.trim(),
          price,
          currency: currency?.trim() || 'USD',
          isActive: isActive !== undefined ? isActive : true,
          saleStartAt: saleStartAt ? new Date(saleStartAt) : null,
          saleEndAt: saleEndAt ? new Date(saleEndAt) : null,
          description: description?.trim() || null,
          metadata: metadata || null,
        },
        async () => {
          const product = await StoreProductService.createStoreProduct({
            productId: productId.trim(),
            productName: productName.trim(),
            store: store.trim(),
            price,
            currency: currency?.trim() || 'USD',
            isActive: isActive !== undefined ? isActive : true,
            saleStartAt: saleStartAt ? new Date(saleStartAt) : null,
            saleEndAt: saleEndAt ? new Date(saleEndAt) : null,
            description: description?.trim() || null,
            metadata: metadata || null,
            createdBy: userId,
            environmentId,
          });

          // Set tags for the product
          if (Array.isArray(tagIds) && tagIds.length > 0) {
            await TagService.setTagsForEntity(
              'store_product',
              product.id,
              tagIds,
              userId
            );
          }

          return product;
        }
      );

      res.status(result.mode === 'CHANGE_REQUEST' ? 202 : 201).json({
        success: true,
        data: result.data
          ? { product: result.data }
          : { changeRequestId: result.changeRequestId },
        message:
          result.mode === 'CHANGE_REQUEST'
            ? 'Store product creation requested'
            : 'Store product created successfully',
      });
    }
  );

  /**
   * Update a store product
   * PUT /api/v1/admin/store-products/:id
   */
  static updateStoreProduct = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Store product ID is required', 400);
      }
      if (!userId) {
        throw new GatrixError('User authentication required', 401);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const {
        productId,
        productName,
        nameKo,
        nameEn,
        nameZh,
        store,
        price,
        currency,
        isActive,
        saleStartAt,
        saleEndAt,
        description,
        descriptionKo,
        descriptionEn,
        descriptionZh,
        metadata,
        tagIds,
        overrideResets,
      } = req.body;

      const result = await UnifiedChangeGateway.processChange(
        userId,
        environmentId,
        'g_store_products',
        id,
        {
          productId: productId?.trim(),
          productName: productName?.trim(),
          nameKo: nameKo !== undefined ? nameKo?.trim() || null : undefined,
          nameEn: nameEn !== undefined ? nameEn?.trim() || null : undefined,
          nameZh: nameZh !== undefined ? nameZh?.trim() || null : undefined,
          store: store?.trim(),
          price,
          currency: currency?.trim(),
          isActive,
          saleStartAt:
            saleStartAt !== undefined
              ? saleStartAt
                ? new Date(saleStartAt)
                : null
              : undefined,
          saleEndAt:
            saleEndAt !== undefined
              ? saleEndAt
                ? new Date(saleEndAt)
                : null
              : undefined,
          description:
            description !== undefined ? description?.trim() || null : undefined,
          descriptionKo:
            descriptionKo !== undefined
              ? descriptionKo?.trim() || null
              : undefined,
          descriptionEn:
            descriptionEn !== undefined
              ? descriptionEn?.trim() || null
              : undefined,
          descriptionZh:
            descriptionZh !== undefined
              ? descriptionZh?.trim() || null
              : undefined,
          metadata,
          overrideResets,
        },
        async (processedData: any) => {
          const product = await StoreProductService.updateStoreProduct(
            id,
            {
              ...processedData,
              updatedBy: userId,
            },
            environmentId
          );

          // Set tags for the product
          if (Array.isArray(tagIds)) {
            await TagService.setTagsForEntity(
              'store_product',
              product.id,
              tagIds,
              userId
            );
          }

          return { product };
        }
      );

      if (result.mode === 'DIRECT') {
        res.json({
          success: true,
          data: result.data,
          message: 'Store product updated successfully',
        });
      } else {
        res.status(202).json({
          success: true,
          data: { changeRequestId: result.changeRequestId },
          message: 'Store product update requested',
        });
      }
    }
  );

  /**
   * Delete a store product
   * DELETE /api/v1/admin/store-products/:id
   */
  static deleteStoreProduct = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Store product ID is required', 400);
      }
      if (!userId) {
        throw new GatrixError('User authentication required', 401);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const result = await UnifiedChangeGateway.requestDeletion(
        userId,
        environmentId,
        'g_store_products',
        id,
        async () => {
          await StoreProductService.deleteStoreProduct(id, environmentId);
        }
      );

      res.status(result.mode === 'CHANGE_REQUEST' ? 202 : 200).json({
        success: true,
        data:
          result.mode === 'CHANGE_REQUEST'
            ? { changeRequestId: result.changeRequestId }
            : null,
        message:
          result.mode === 'CHANGE_REQUEST'
            ? 'Store product deletion requested'
            : 'Store product deleted successfully',
      });
    }
  );

  /**
   * Delete multiple store products
   * DELETE /api/v1/admin/store-products
   */
  static deleteStoreProducts = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { ids } = req.body;
      const environmentId = req.environmentId;

      if (!Array.isArray(ids) || ids.length === 0) {
        throw new GatrixError('Product IDs array is required', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const deletedCount = await StoreProductService.deleteStoreProducts(
        ids,
        environmentId
      );

      res.json({
        success: true,
        data: { deletedCount },
        message: `${deletedCount} store product(s) deleted successfully`,
      });
    }
  );

  /**
   * Toggle store product active status
   * PATCH /api/v1/admin/store-products/:id/toggle-active
   */
  static toggleActive = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const { isActive } = req.body;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Store product ID is required', 400);
      }
      if (isActive === undefined) {
        throw new GatrixError('isActive value is required', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const result = await UnifiedChangeGateway.processChange(
        userId,
        environmentId,
        'g_store_products',
        id,
        { isActive },
        async (processedData: any) => {
          const product = await StoreProductService.toggleActive(
            id,
            (processedData as any).isActive,
            userId,
            environmentId
          );
          return { product };
        }
      );

      if (result.mode === 'DIRECT') {
        res.json({
          success: true,
          data: result.data,
          message: `Store product ${isActive ? 'activated' : 'deactivated'} successfully`,
        });
      } else {
        res.status(202).json({
          success: true,
          data: { changeRequestId: result.changeRequestId },
          message: 'Store product status change requested',
        });
      }
    }
  );

  /**
   * Bulk update active status
   * PATCH /api/v1/admin/store-products/bulk-active
   */
  static bulkUpdateActiveStatus = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { ids, isActive } = req.body;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        throw new GatrixError('Product IDs array is required', 400);
      }
      if (isActive === undefined) {
        throw new GatrixError('isActive value is required', 400);
      }
      if (!userId) {
        throw new GatrixError('User authentication required', 401);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const results = [];
      for (const id of ids) {
        const gatewayResult = await UnifiedChangeGateway.processChange(
          userId,
          environmentId,
          'g_store_products',
          id,
          { isActive },
          async (processedData: any) => {
            const product = await StoreProductService.toggleActive(
              id,
              (processedData as any).isActive,
              userId,
              environmentId
            );
            return product;
          }
        );

        results.push({
          id,
          mode: gatewayResult.mode,
          changeRequestId: gatewayResult.changeRequestId,
          data: gatewayResult.data,
        });
      }

      const hasCR = results.some((r) => r.mode === 'CHANGE_REQUEST');
      const lastCRId = results.find((r) => r.changeRequestId)?.changeRequestId;

      res.status(hasCR ? 202 : 200).json({
        success: true,
        data: hasCR ? { changeRequestId: lastCRId } : { results },
        message: hasCR
          ? `Bulk update requested. ${results.filter((r) => r.mode === 'CHANGE_REQUEST').length} items require approval.`
          : 'All store products updated successfully',
      });
    }
  );

  /**
   * Bulk update active status by filter (for batch processing)
   * PATCH /api/v1/admin/store-products/bulk-active-by-filter
   */
  static bulkUpdateActiveStatusByFilter = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { search, currentIsActive, targetIsActive } = req.body;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const environmentId = req.environmentId;

      if (targetIsActive === undefined) {
        throw new GatrixError('targetIsActive value is required', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const result = await StoreProductService.bulkUpdateActiveStatusByFilter(
        {
          search: search as string,
          currentIsActive:
            currentIsActive !== undefined
              ? Boolean(currentIsActive)
              : undefined,
          targetIsActive: Boolean(targetIsActive),
          environmentId,
        },
        userId
      );

      res.json({
        success: true,
        data: result,
        message: `${result.affectedCount} products ${targetIsActive ? 'activated' : 'deactivated'} successfully`,
      });
    }
  );

  /**
   * Get count of products matching filter criteria (for batch processing preview)
   * GET /api/v1/admin/store-products/count-by-filter
   */
  static getCountByFilter = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { search, isActive } = req.query;
      const environmentId = req.environmentId;

      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const count = await StoreProductService.getCountByFilter({
        search: search as string,
        isActive: isActive !== undefined ? isActive === 'true' : undefined,
        environmentId,
      });

      res.json({
        success: true,
        data: { count },
      });
    }
  );

  /**
   * Preview sync with planning data
   * GET /api/v1/admin/store-products/sync/preview
   */
  static previewSync = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const result = await StoreProductService.previewSync(environmentId);

      res.json({
        success: true,
        data: result,
        message: 'Sync preview generated successfully',
      });
    }
  );

  /**
   * Apply sync with planning data (selective)
   * POST /api/v1/admin/store-products/sync/apply
   */
  static applySync = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const environmentId = req.environmentId;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;
      const selected = req.body; // { toAdd: number[], toUpdate: number[], toDelete: string[] }

      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const result = await StoreProductService.applySync(
        environmentId,
        userId,
        selected
      );

      res.json({
        success: true,
        data: result,
        message: 'Sync applied successfully',
      });
    }
  );

  /**
   * Get planning data values for a store product
   * GET /api/v1/admin/store-products/:id/planning-values
   */
  static getPlanningValues = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environmentId = req.environmentId;

      if (!id) {
        throw new GatrixError('Store product ID is required', 400);
      }

      const planningValues = await StoreProductService.getPlanningValues(
        id,
        environmentId!
      );

      res.json({
        success: true,
        data: planningValues,
      });
    }
  );

  /**
   * Reset all overrides for a store product, reverting to planning data values
   * DELETE /api/v1/admin/store-products/:id/overrides
   */
  static resetOverrides = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params;
      const environmentId = req.environmentId;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;

      if (!id) {
        throw new GatrixError('Store product ID is required', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const product = await StoreProductService.resetOverrides(
        id,
        environmentId,
        userId
      );

      res.json({
        success: true,
        data: { product },
        message: 'All overrides reset successfully',
      });
    }
  );

  /**
   * Reset a single field override, reverting that field to planning data value
   * DELETE /api/v1/admin/store-products/:id/overrides/:field
   */
  static resetFieldOverride = asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const { id, field } = req.params;
      const environmentId = req.environmentId;
      const userId =
        (req as any).userDetails?.id ??
        (req as any).user?.id ??
        (req as any).user?.userId;

      if (!id) {
        throw new GatrixError('Store product ID is required', 400);
      }
      if (!field) {
        throw new GatrixError('Field name is required', 400);
      }
      if (!environmentId) {
        throw new GatrixError('Environment not specified', 400);
      }

      const product = await StoreProductService.resetFieldOverride(
        id,
        environmentId,
        field,
        userId
      );

      res.json({
        success: true,
        data: { product },
        message: `Override for field '${field}' reset successfully`,
      });
    }
  );
}
