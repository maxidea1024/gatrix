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
        'Get service notices for an environment with pagination. Returns a summary list with truncated content. Use get_service_notice_by_id to get the full content of a specific notice.',
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
      const result = await serviceNoticeService.getServiceNotices(1, 20, {
        environmentId: args.environmentId,
        search: args.search,
      });
      // Truncate content to save LLM context window
      const notices = result.notices.map((n) => ({
        ...n,
        content:
          n.content && n.content.length > 200
            ? n.content.substring(0, 200) +
              '... (truncated, use get_service_notice_by_id for full content)'
            : n.content,
      }));
      return { notices, total: result.total };
    },
  },

  {
    tool: {
      name: 'get_service_notice_by_id',
      description:
        'Get a single service notice by ID with full content. Use this to read the complete content before updating it.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          id: {
            type: 'string',
            description: 'The service notice ID',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const serviceNoticeService = (
        await import('../../service-notice-service')
      ).default;
      const notice = await serviceNoticeService.getServiceNoticeById(
        args.id,
        args.environmentId
      );
      if (!notice) {
        return { error: 'Service notice not found' };
      }
      return notice;
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
        'Update an existing service notice. Can change title, content, category, active status, etc. When updating the content field, you MUST provide the complete new HTML content. Always include content in the arguments when the user asks to change the notice body/content.',
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
          content: {
            type: 'string',
            description:
              'New notice content in HTML format. When updating content, provide the complete HTML body. Example: "<p>Updated notice body</p>". You MUST include this field when the user asks to change the notice body/content/text.',
          },
          category: { type: 'string', description: 'New category' },
          isActive: { type: 'boolean', description: 'Active status' },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_UPDATE,
    riskLevel: 'medium',
    handler: async (args) => {
      const logger = (await import('../../../config/logger')).createLogger(
        'AITools:ServiceNotice'
      );
      const serviceNoticeService = (
        await import('../../service-notice-service')
      ).default;
      const { environmentId, id, ...updates } = args;
      logger.info('update_service_notice tool called', {
        id,
        environmentId,
        updateKeys: Object.keys(updates),
        hasTitle: 'title' in updates,
        hasContent: 'content' in updates,
        contentLength: updates.content?.length,
        updates,
      });
      if (Object.keys(updates).length === 0) {
        return {
          error:
            'No fields to update. Please specify at least one field (title, content, category, or isActive).',
        };
      }
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

  {
    tool: {
      name: 'delete_service_notice',
      description: descWithRisk(
        'Delete a service notice permanently. This action cannot be undone.',
        'high'
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
            description: 'The service notice ID to delete',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_DELETE,
    riskLevel: 'high',
    handler: async (args) => {
      const serviceNoticeService = (
        await import('../../service-notice-service')
      ).default;
      await serviceNoticeService.deleteServiceNotice(
        args.id,
        args.environmentId
      );
      return { success: true, deletedId: args.id };
    },
  },
];
