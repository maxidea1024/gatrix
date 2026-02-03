import { Router, Response } from 'express';
import { CmsCashShopService } from '../../services/CmsCashShopService';
import { AuthenticatedRequest } from '../../middleware/auth';
import { asyncHandler, GatrixError } from '../../middleware/errorHandler';

const router = Router() as any;

/**
 * GET /api/v1/admin/cms/cash-shop
 * Get all valid CMS CashShop products for the current environment
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const environment = req.environment;
    if (!environment) {
      throw new GatrixError('Environment is required', 400);
    }

    // Get all products with multi-language structure
    const products = await CmsCashShopService.getProducts(environment);

    res.json({
      success: true,
      data: {
        products,
        total: products.length,
      },
    });
  })
);

export default router;
