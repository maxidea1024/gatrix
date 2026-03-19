/**
 * AI Tools — Store Products
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const storeProductTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_store_products',
      description:
        'Get list of store products for an environment. Shows product names, prices, status.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          search: {
            type: 'string',
            description: 'Optional search term to filter by name',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.STORE_PRODUCTS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const StoreProductService = (
        await import('../../store-product-service')
      ).default;
      return await StoreProductService.getStoreProducts({
        environmentId: args.environmentId,
        search: args.search,
        limit: 20,
      });
    },
  },

  {
    tool: {
      name: 'get_store_product_stats',
      description:
        'Get store product statistics (total count, active count, etc.).',
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
    requiredPermission: P.STORE_PRODUCTS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const StoreProductService = (
        await import('../../store-product-service')
      ).default;
      return await StoreProductService.getStats(args.environmentId);
    },
  },

  {
    tool: {
      name: 'toggle_store_product',
      description: descWithRisk(
        'Toggle a store product active/inactive.',
        'medium'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          id: {
            type: 'string',
            description: 'The store product ID',
          },
          isActive: {
            type: 'boolean',
            description: 'Set to true to activate, false to deactivate',
          },
        },
        required: ['environmentId', 'id', 'isActive'],
      },
    },
    requiredPermission: P.STORE_PRODUCTS_UPDATE,
    riskLevel: 'medium',
    handler: async (args, _orgId, userId) => {
      const StoreProductService = (
        await import('../../store-product-service')
      ).default;
      return await StoreProductService.toggleActive(
        args.id,
        args.isActive,
        userId,
        args.environmentId
      );
    },
  },
];
