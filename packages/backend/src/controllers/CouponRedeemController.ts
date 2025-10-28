import { Response } from 'express';
import Joi from 'joi';
import { asyncHandler, CustomError } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/auth';
import { CouponRedeemService } from '../services/CouponRedeemService';

// Validation schema for redeem request
const redeemSchema = Joi.object({
  userId: Joi.string().max(64).required(),
  userName: Joi.string().max(128).required(),
  gameWorldId: Joi.string().max(64).optional().allow(null, ''),
  platform: Joi.string().max(32).optional().allow(null, ''),
  channel: Joi.string().max(64).optional().allow(null, ''),
  subchannel: Joi.string().max(64).optional().allow(null, ''),
  requestId: Joi.string().optional().allow(null, ''),
});

export class CouponRedeemController {
  /**
   * Redeem a coupon code
   * POST /api/v1/coupons/:code/redeem
   */
  static redeem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { code } = req.params;

    if (!code) {
      throw new CustomError('Coupon code is required', 400);
    }

    // Validate request body
    const { error, value } = redeemSchema.validate(req.body);
    if (error) {
      throw new CustomError(error.message, 400);
    }

    // Redeem coupon
    const result = await CouponRedeemService.redeemCoupon(code, value);

    res.json({
      success: true,
      data: result,
    });
  });
}

