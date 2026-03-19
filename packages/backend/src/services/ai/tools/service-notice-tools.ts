/**
 * AI Tools — Service Notices
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const serviceNoticeTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_service_notices',
      description:
        'Get service notices for an environment with pagination.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID to get service notices from',
          },
          search: {
            type: 'string',
            description: 'Optional search term to filter by title or content',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const serviceNoticeService = (
        await import('../../service-notice-service')
      ).default;
      return await serviceNoticeService.getServiceNotices(1, 20, {
        environmentId: args.environmentId,
        search: args.search,
      });
    },
  },

  {
    tool: {
      name: 'create_service_notice',
      description: descWithRisk(
        'Create a new service notice. Requires title, content, category (maintenance/event/notice/promotion/other), and platforms array.',
        'low'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          title: {
            type: 'string',
            description: 'Notice title',
          },
          content: {
            type: 'string',
            description: 'Notice content (supports HTML)',
          },
          category: {
            type: 'string',
            description:
              'Category: "maintenance", "event", "notice", "promotion", or "other"',
          },
          isActive: {
            type: 'boolean',
            description: 'Whether the notice is active. Defaults to true.',
          },
          platforms: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Target platforms (e.g. ["pc", "mobile"]). Empty array means all platforms.',
          },
          startDate: {
            type: 'string',
            description: 'Optional start date in ISO 8601 format',
          },
          endDate: {
            type: 'string',
            description: 'Optional end date in ISO 8601 format',
          },
        },
        required: ['environmentId', 'title', 'content', 'category'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_CREATE,
    riskLevel: 'low',
    handler: async (args) => {
      const serviceNoticeService = (
        await import('../../service-notice-service')
      ).default;
      return await serviceNoticeService.createServiceNotice(
        {
          title: args.title,
          content: args.content,
          category: args.category,
          isActive: args.isActive ?? true,
          platforms: args.platforms || [],
          startDate: args.startDate,
          endDate: args.endDate,
        },
        args.environmentId
      );
    },
  },

  {
    tool: {
      name: 'update_service_notice',
      description: descWithRisk(
        'Update an existing service notice. Can change title, content, category, active status, etc.',
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
            description: 'The service notice ID to update',
          },
          title: { type: 'string', description: 'New title' },
          content: { type: 'string', description: 'New content' },
          category: { type: 'string', description: 'New category' },
          isActive: { type: 'boolean', description: 'Active status' },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_UPDATE,
    riskLevel: 'medium',
    handler: async (args) => {
      const serviceNoticeService = (
        await import('../../service-notice-service')
      ).default;
      const { environmentId, id, ...updates } = args;
      return await serviceNoticeService.updateServiceNotice(
        id,
        updates,
        environmentId
      );
    },
  },

  {
    tool: {
      name: 'toggle_service_notice',
      description: descWithRisk(
        'Toggle a service notice active/inactive.',
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
            description: 'The service notice ID to toggle',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_UPDATE,
    riskLevel: 'medium',
    handler: async (args) => {
      const serviceNoticeService = (
        await import('../../service-notice-service')
      ).default;
      return await serviceNoticeService.toggleActive(
        args.id,
        args.environmentId
      );
    },
  },
];
