import { Response } from 'express';
import Joi from 'joi';
import { asyncHandler, GatrixError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/auth';
import { CouponRedeemService } from '../services/CouponRedeemService';

// Validation schema for redeem request
const redeemSchema = Joi.object({
  userId: Joi.string().max(64).required(),
  userName: Joi.string().max(128).required(),
  characterId: Joi.string().max(64).optional(),
  worldId: Joi.string().max(64).optional(),
  platform: Joi.string().max(32).optional(),
  channel: Joi.string().max(64).optional(),
  subChannel: Joi.string().max(64).optional(),
});

export class CouponRedeemController {
  /**
   * Redeem a coupon code
   * POST /api/v1/server/coupons/:code/redeem
   * Requires: X-API-Token header (server SDK token)
   */
  static redeem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.params;

    if (!code) {
      throw new GatrixError('Coupon code is required', 400);
    }

    // Validate request body
    const { error, value } = redeemSchema.validate(req.body);
    if (error) {
      throw new GatrixError(error.message, 400);
    }

    // Redeem coupon
    const result = await CouponRedeemService.redeemCoupon(code, value);

    res.json({
      success: true,
      data: result,
    });
  });
}

