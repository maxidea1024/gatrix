/**
 * AI Tools — Coupons
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig } from '../ai-tool-types';

export const couponTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_coupon_settings',
      description:
        'Get list of coupon settings (campaigns) for an environment. Shows coupon types, redemption limits, expiry dates.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.COUPON_SETTINGS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { CouponSettingsService } =
        await import('../../coupon-settings-service');
      return await CouponSettingsService.listSettings({
        environmentId: args.environmentId,
        page: 1,
        limit: 20,
      });
    },
  },

  {
    tool: {
      name: 'get_coupon_usage',
      description:
        'Get usage statistics for a specific coupon setting (campaign).',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          settingId: {
            type: 'string',
            description: 'The coupon setting ID',
          },
        },
        required: ['environmentId', 'settingId'],
      },
    },
    requiredPermission: P.COUPON_SETTINGS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { CouponSettingsService } =
        await import('../../coupon-settings-service');
      return await CouponSettingsService.getUsageBySetting(
        args.settingId,
        {},
        args.environmentId
      );
    },
  },
];
