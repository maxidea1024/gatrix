import express from 'express';
import { CouponRedeemController } from '../controllers/CouponRedeemController';

const router = express.Router();

// Redeem coupon
router.post('/:code/redeem', CouponRedeemController.redeem);

export default router;

