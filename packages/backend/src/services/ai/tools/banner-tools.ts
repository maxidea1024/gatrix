/**
 * AI Tools — Banners
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const bannerTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_banners',
      description: 'Get banners for an environment with pagination.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID to get banners from',
          },
          search: {
            type: 'string',
            description: 'Optional search term to filter banners by name',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.BANNERS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const BannerService = (await import('../../banner-service')).default;
      return await BannerService.getBanners({
        environmentId: args.environmentId,
        search: args.search,
        limit: 20,
      });
    },
  },

  {
    tool: {
      name: 'create_banner',
      description: descWithRisk(
        'Create a new banner. Requires name (identifier-style, lowercase), width, and height. Banner starts as draft.',
        'low'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          name: {
            type: 'string',
            description:
              'Banner identifier name (lowercase letters, numbers, underscore, hyphen)',
          },
          description: {
            type: 'string',
            description: 'Optional description',
          },
          width: {
            type: 'number',
            description: 'Banner width in pixels. Defaults to 1024.',
          },
          height: {
            type: 'number',
            description: 'Banner height in pixels. Defaults to 512.',
          },
        },
        required: ['environmentId', 'name'],
      },
    },
    requiredPermission: P.BANNERS_CREATE,
    riskLevel: 'low',
    handler: async (args, _orgId, userId) => {
      const BannerService = (await import('../../banner-service')).default;
      return await BannerService.createBanner({
        environmentId: args.environmentId,
        name: args.name,
        description: args.description,
        width: args.width || 1024,
        height: args.height || 512,
        createdBy: userId,
      });
    },
  },

  {
    tool: {
      name: 'publish_banner',
      description: descWithRisk(
        'Publish a draft banner, making it visible to SDK clients.',
        'medium'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          bannerId: {
            type: 'string',
            description: 'The banner ID to publish',
          },
        },
        required: ['environmentId', 'bannerId'],
      },
    },
    requiredPermission: P.BANNERS_UPDATE,
    riskLevel: 'medium',
    handler: async (args, _orgId, userId) => {
      const BannerService = (await import('../../banner-service')).default;
      return await BannerService.publishBanner(
        args.bannerId,
        args.environmentId,
        userId
      );
    },
  },
];
