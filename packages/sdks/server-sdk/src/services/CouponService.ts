/**
 * Coupon Service
 * Handles coupon redemption
 * Uses per-environment API pattern: POST /api/v1/server/:env/coupons/:code/redeem
 */

import { ApiClient } from '../client/ApiClient';
import { Logger } from '../utils/logger';
import { RedeemCouponRequest, RedeemCouponResponse } from '../types/api';
import { CouponRedeemError, CouponRedeemErrorCode, isGatrixSDKError } from '../utils/errors';

export class CouponService {
  private apiClient: ApiClient;
  private logger: Logger;
  // Default environment for single-environment mode
  private defaultEnvironment: string;

  constructor(apiClient: ApiClient, logger: Logger, defaultEnvironment: string = 'development') {
    this.apiClient = apiClient;
    this.logger = logger;
    this.defaultEnvironment = defaultEnvironment;
  }

  /**
   * Redeem a coupon code
   * POST /api/v1/server/:env/coupons/:code/redeem
   *
   * @throws {CouponRedeemError} When coupon redemption fails with specific error code
   *
   * Error codes:
   * - COUPON_INVALID_PARAMETERS: Invalid request parameters
   * - COUPON_CODE_NOT_FOUND: Coupon code does not exist
   * - COUPON_ALREADY_USED: Coupon has already been used
   * - COUPON_USER_LIMIT_EXCEEDED: User has reached usage limit
   * - COUPON_NOT_ACTIVE: Coupon is not active
   * - COUPON_NOT_STARTED: Coupon period has not started yet
   * - COUPON_EXPIRED: Coupon has expired
   * - COUPON_INVALID_WORLD: Coupon not available for this game world
   * - COUPON_INVALID_PLATFORM: Coupon not available for this platform
   * - COUPON_INVALID_CHANNEL: Coupon not available for this channel
   * - COUPON_INVALID_SUBCHANNEL: Coupon not available for this subchannel
   * - COUPON_INVALID_USER: Coupon not available for this user
   */
  async redeem(request: RedeemCouponRequest, environment?: string): Promise<RedeemCouponResponse> {
    const env = environment || this.defaultEnvironment;
    this.logger.info('Redeeming coupon', { code: request.code, userId: request.userId, environment: env });

    const { code, ...body } = request;

    try {
      const response = await this.apiClient.post<RedeemCouponResponse>(
        `/api/v1/server/${encodeURIComponent(env)}/coupons/${encodeURIComponent(code)}/redeem`,
        body
      );

      if (!response.success || !response.data) {
        const errorCode = response.error?.code as CouponRedeemErrorCode;
        const message = response.error?.message || 'Failed to redeem coupon';
        throw new CouponRedeemError(
          errorCode || CouponRedeemErrorCode.CODE_NOT_FOUND,
          message,
          400
        );
      }

      this.logger.info('Coupon redeemed successfully', {
        code,
        userId: request.userId,
        sequence: response.data.sequence,
        environment: env,
      });

      return response.data;
    } catch (error) {
      // If already a CouponRedeemError, rethrow
      if (error instanceof CouponRedeemError) {
        throw error;
      }

      // Convert GatrixSDKError to CouponRedeemError
      if (isGatrixSDKError(error)) {
        const errorCode = error.details?.error?.code as CouponRedeemErrorCode;
        const message = error.details?.error?.message || error.message;
        const statusCode = error.statusCode || 500;

        if (errorCode && Object.values(CouponRedeemErrorCode).includes(errorCode)) {
          throw new CouponRedeemError(errorCode, message, statusCode);
        }
      }

      // Rethrow unknown errors
      throw error;
    }
  }
}
