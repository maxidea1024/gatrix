import { Response } from 'express';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../middleware/auth';
import StoreProductService from '../services/StoreProductService';
import { TagService } from '../services/TagService';

export class StoreProductController {
  /**
   * Get all store products
   * GET /api/v1/admin/store-products
   */
  static getStoreProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, search, sortBy, sortOrder, store, isActive } = req.query;
    const environment = req.environment;

    if (!environment) {
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
      environment,
    });

    res.json({
      success: true,
      data: result,
      message: 'Store products retrieved successfully',
    });
  });

  /**
   * Get store product statistics
   * GET /api/v1/admin/store-products/stats
   */
  static getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }
    const stats = await StoreProductService.getStats(environment);

    res.json({
      success: true,
      data: stats,
      message: 'Store product stats retrieved successfully',
    });
  });

  /**
   * Get a single store product by ID
   * GET /api/v1/admin/store-products/:id
   */
  static getStoreProductById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment;

    if (!id) {
      throw new GatrixError('Store product ID is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const product = await StoreProductService.getStoreProductById(id, environment);

    res.json({
      success: true,
      data: { product },
      message: 'Store product retrieved successfully',
    });
  });

  /**
   * Create a new store product
   * POST /api/v1/admin/store-products
   */
  static createStoreProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (!userId) {
      throw new GatrixError('User authentication required', 401);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const { productId, productName, store, price, currency, isActive, saleStartAt, saleEndAt, description, metadata, tagIds } = req.body;

    // Validation
    if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
      throw new GatrixError('Product ID is required', 400);
    }
    if (!productName || typeof productName !== 'string' || productName.trim().length === 0) {
      throw new GatrixError('Product name is required', 400);
    }
    if (!store || typeof store !== 'string' || store.trim().length === 0) {
      throw new GatrixError('Store is required', 400);
    }
    if (price === undefined || typeof price !== 'number' || price < 0) {
      throw new GatrixError('Valid price is required', 400);
    }

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
      environment,
    });

    // Set tags for the product
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      await TagService.setTagsForEntity('store_product', product.id, tagIds.map(Number), userId);
    }

    // Load tags for response
    const tags = await TagService.listTagsForEntity('store_product', product.id);

    res.status(201).json({
      success: true,
      data: { product: { ...product, tags } },
      message: 'Store product created successfully',
    });
  });

  /**
   * Update a store product
   * PUT /api/v1/admin/store-products/:id
   */
  static updateStoreProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (!id) {
      throw new GatrixError('Store product ID is required', 400);
    }
    if (!userId) {
      throw new GatrixError('User authentication required', 401);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const { productId, productName, store, price, currency, isActive, saleStartAt, saleEndAt, description, metadata, tagIds } = req.body;

    const product = await StoreProductService.updateStoreProduct(id, {
      productId: productId?.trim(),
      productName: productName?.trim(),
      store: store?.trim(),
      price,
      currency: currency?.trim(),
      isActive,
      saleStartAt: saleStartAt !== undefined ? (saleStartAt ? new Date(saleStartAt) : null) : undefined,
      saleEndAt: saleEndAt !== undefined ? (saleEndAt ? new Date(saleEndAt) : null) : undefined,
      description: description !== undefined ? (description?.trim() || null) : undefined,
      metadata,
      updatedBy: userId,
    }, environment);

    // Set tags for the product
    if (Array.isArray(tagIds)) {
      await TagService.setTagsForEntity('store_product', product.id, tagIds.map(Number), userId);
    }

    // Load tags for response
    const tags = await TagService.listTagsForEntity('store_product', product.id);

    res.json({
      success: true,
      data: { product: { ...product, tags } },
      message: 'Store product updated successfully',
    });
  });

  /**
   * Delete a store product
   * DELETE /api/v1/admin/store-products/:id
   */
  static deleteStoreProduct = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const environment = req.environment;

    if (!id) {
      throw new GatrixError('Store product ID is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    await StoreProductService.deleteStoreProduct(id, environment);

    res.json({
      success: true,
      message: 'Store product deleted successfully',
    });
  });

  /**
   * Delete multiple store products
   * DELETE /api/v1/admin/store-products
   */
  static deleteStoreProducts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    const environment = req.environment;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new GatrixError('Product IDs array is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const deletedCount = await StoreProductService.deleteStoreProducts(ids, environment);

    res.json({
      success: true,
      data: { deletedCount },
      message: `${deletedCount} store product(s) deleted successfully`,
    });
  });

  /**
   * Toggle store product active status
   * PATCH /api/v1/admin/store-products/:id/toggle-active
   */
  static toggleActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const userId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (!id) {
      throw new GatrixError('Store product ID is required', 400);
    }
    if (isActive === undefined) {
      throw new GatrixError('isActive value is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const product = await StoreProductService.toggleActive(id, isActive, userId, environment);

    res.json({
      success: true,
      data: { product },
      message: `Store product ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  });

  /**
   * Bulk update active status
   * PATCH /api/v1/admin/store-products/bulk-active
   */
  static bulkUpdateActiveStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { ids, isActive } = req.body;
    const userId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new GatrixError('Product IDs array is required', 400);
    }
    if (isActive === undefined) {
      throw new GatrixError('isActive value is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const affectedCount = await StoreProductService.bulkUpdateActiveStatus(ids, isActive, userId, environment);

    res.json({
      success: true,
      data: { affectedCount },
      message: `${affectedCount} products ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  });

  /**
   * Bulk update active status by filter (for batch processing)
   * PATCH /api/v1/admin/store-products/bulk-active-by-filter
   */
  static bulkUpdateActiveStatusByFilter = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, currentIsActive, targetIsActive } = req.body;
    const userId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const environment = req.environment;

    if (targetIsActive === undefined) {
      throw new GatrixError('targetIsActive value is required', 400);
    }
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const result = await StoreProductService.bulkUpdateActiveStatusByFilter(
      {
        search: search as string,
        currentIsActive: currentIsActive !== undefined ? Boolean(currentIsActive) : undefined,
        targetIsActive: Boolean(targetIsActive),
        environment,
      },
      userId
    );

    res.json({
      success: true,
      data: result,
      message: `${result.affectedCount} products ${targetIsActive ? 'activated' : 'deactivated'} successfully`,
    });
  });

  /**
   * Get count of products matching filter criteria (for batch processing preview)
   * GET /api/v1/admin/store-products/count-by-filter
   */
  static getCountByFilter = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { search, isActive } = req.query;
    const environment = req.environment;

    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const count = await StoreProductService.getCountByFilter({
      search: search as string,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      environment,
    });

    res.json({
      success: true,
      data: { count },
    });
  });

  /**
   * Preview sync with planning data
   * GET /api/v1/admin/store-products/sync/preview
   */
  static previewSync = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const result = await StoreProductService.previewSync(environment);

    res.json({
      success: true,
      data: result,
      message: 'Sync preview generated successfully',
    });
  });

  /**
   * Apply sync with planning data (selective)
   * POST /api/v1/admin/store-products/sync/apply
   */
  static applySync = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    const userId = (req as any).userDetails?.id ?? (req as any).user?.id ?? (req as any).user?.userId;
    const selected = req.body; // { toAdd: number[], toUpdate: number[], toDelete: string[] }

    if (!environment) {
      throw new GatrixError('Environment not specified', 400);
    }

    const result = await StoreProductService.applySync(environment, userId, selected);

    res.json({
      success: true,
      data: result,
      message: 'Sync applied successfully',
    });
  });
}
