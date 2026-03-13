/**
 * AI Tools Definition
 *
 * Defines the tools (functions) available to the AI assistant,
 * along with RBAC permission requirements for each tool.
 */

import { createLogger } from '../../config/logger';
import type { ToolDefinition, ToolCall } from './llm-provider';
import { P } from '@gatrix/shared/permissions';

const logger = createLogger('AITools');

// Tool definition with required permission
interface AIToolConfig {
  tool: ToolDefinition;
  requiredPermission: string;
  handler: (args: Record<string, any>, orgId: number) => Promise<any>;
}

// Registry of all available AI tools
const toolRegistry: AIToolConfig[] = [
  // Feature Flags
  {
    tool: {
      name: 'get_feature_flags',
      description:
        'Get list of feature flags for a project. Returns flag names, types, and enabled status.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to query feature flags from',
          },
          search: {
            type: 'string',
            description: 'Optional search term to filter flags by name',
          },
        },
        required: ['projectId'],
      },
    },
    requiredPermission: P.FEATURES_READ,
    handler: async (args, orgId) => {
      // Lazy import to avoid circular dependencies
      const db = (await import('../../config/knex')).default;
      const query = db('g_feature_flags')
        .leftJoin('g_projects', 'g_feature_flags.projectId', 'g_projects.id')
        .where('g_projects.orgId', orgId)
        .where('g_feature_flags.projectId', args.projectId)
        .select(
          'g_feature_flags.id',
          'g_feature_flags.name',
          'g_feature_flags.type',
          'g_feature_flags.description',
          'g_feature_flags.stale'
        )
        .limit(20);

      if (args.search) {
        query.where('g_feature_flags.name', 'like', `%${args.search}%`);
      }

      return await query;
    },
  },

  // Game Worlds
  {
    tool: {
      name: 'get_game_worlds',
      description: 'Get list of game worlds and their current status.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID to query game worlds from',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.GAME_WORLDS_READ,
    handler: async (args, orgId) => {
      const db = (await import('../../config/knex')).default;
      return await db('g_game_worlds')
        .leftJoin(
          'g_environments',
          'g_game_worlds.environmentId',
          'g_environments.id'
        )
        .leftJoin('g_projects', 'g_environments.projectId', 'g_projects.id')
        .where('g_projects.orgId', orgId)
        .where('g_game_worlds.environmentId', args.environmentId)
        .select(
          'g_game_worlds.id',
          'g_game_worlds.name',
          'g_game_worlds.status',
          'g_game_worlds.maxPlayers',
          'g_game_worlds.currentPlayers'
        )
        .limit(50);
    },
  },

  // Maintenance
  {
    tool: {
      name: 'get_maintenance_status',
      description: 'Get current maintenance status for an environment.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID to check maintenance status',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.MAINTENANCE_READ,
    handler: async (args, orgId) => {
      const db = (await import('../../config/knex')).default;
      return await db('g_maintenance')
        .leftJoin(
          'g_environments',
          'g_maintenance.environmentId',
          'g_environments.id'
        )
        .leftJoin('g_projects', 'g_environments.projectId', 'g_projects.id')
        .where('g_projects.orgId', orgId)
        .where('g_maintenance.environmentId', args.environmentId)
        .select(
          'g_maintenance.id',
          'g_maintenance.isEnabled',
          'g_maintenance.startsAt',
          'g_maintenance.endsAt',
          'g_maintenance.reason'
        )
        .orderBy('g_maintenance.createdAt', 'desc')
        .limit(5);
    },
  },

  // Service Notices
  {
    tool: {
      name: 'get_service_notices',
      description: 'Get active service notices for an environment.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID to get service notices from',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.SERVICE_NOTICES_READ,
    handler: async (args, orgId) => {
      const db = (await import('../../config/knex')).default;
      return await db('g_service_notices')
        .leftJoin(
          'g_environments',
          'g_service_notices.environmentId',
          'g_environments.id'
        )
        .leftJoin('g_projects', 'g_environments.projectId', 'g_projects.id')
        .where('g_projects.orgId', orgId)
        .where('g_service_notices.environmentId', args.environmentId)
        .select(
          'g_service_notices.id',
          'g_service_notices.title',
          'g_service_notices.status',
          'g_service_notices.startsAt',
          'g_service_notices.endsAt'
        )
        .orderBy('g_service_notices.createdAt', 'desc')
        .limit(10);
    },
  },

  // Banners
  {
    tool: {
      name: 'get_banners',
      description: 'Get banners for an environment.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID to get banners from',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.BANNERS_READ,
    handler: async (args, orgId) => {
      const db = (await import('../../config/knex')).default;
      return await db('g_banners')
        .leftJoin(
          'g_environments',
          'g_banners.environmentId',
          'g_environments.id'
        )
        .leftJoin('g_projects', 'g_environments.projectId', 'g_projects.id')
        .where('g_projects.orgId', orgId)
        .where('g_banners.environmentId', args.environmentId)
        .select(
          'g_banners.id',
          'g_banners.name',
          'g_banners.status',
          'g_banners.createdAt'
        )
        .orderBy('g_banners.createdAt', 'desc')
        .limit(10);
    },
  },
];

/**
 * Get available AI tools filtered by user permissions
 */
export function getAITools(userPermissions: string[]): ToolDefinition[] {
  return toolRegistry
    .filter((config) => userPermissions.includes(config.requiredPermission))
    .map((config) => config.tool);
}

/**
 * Execute a tool call with permission check
 */
export async function executeToolCall(
  toolCall: ToolCall,
  userPermissions: string[],
  orgId: number
): Promise<any> {
  const toolConfig = toolRegistry.find((t) => t.tool.name === toolCall.name);

  if (!toolConfig) {
    logger.warn('Unknown tool called', { name: toolCall.name });
    return { error: `Unknown tool: ${toolCall.name}` };
  }

  // Check permission
  if (!userPermissions.includes(toolConfig.requiredPermission)) {
    logger.warn('Tool call denied by RBAC', {
      tool: toolCall.name,
      requiredPermission: toolConfig.requiredPermission,
    });
    return {
      error: `Insufficient permissions to execute ${toolCall.name}`,
    };
  }

  try {
    const result = await toolConfig.handler(toolCall.arguments, orgId);
    logger.info('Tool executed successfully', { tool: toolCall.name });
    return result;
  } catch (error: any) {
    logger.error('Tool execution failed', {
      tool: toolCall.name,
      error: error.message,
    });
    return { error: `Tool execution failed: ${error.message}` };
  }
}
