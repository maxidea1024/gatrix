/**
 * Coupon Service
 * Handles coupon redemption
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { RedeemCouponRequest, RedeemCouponResponse } from '../types/api';

export class CouponService {
  private apiClient: ApiClient;
  private logger: Logger;

  constructor(apiClient: ApiClient, logger: Logger) {
    this.apiClient = apiClient;
    this.logger = logger;
  }

  /**
   * Redeem a coupon code
   * POST /api/v1/server/coupons/:code/redeem
   */
  async redeem(request: RedeemCouponRequest): Promise<RedeemCouponResponse> {
    this.logger.info('Redeeming coupon', { code: request.code, userId: request.userId });

    const { code, ...body } = request;

    const response = await this.apiClient.post<RedeemCouponResponse>(
      `/api/v1/server/coupons/${encodeURIComponent(code)}/redeem`,
      body
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to redeem coupon');
    }

    this.logger.info('Coupon redeemed successfully', {
      code,
      userId: request.userId,
      sequence: response.data.sequence,
    });

    return response.data;
  }
}

