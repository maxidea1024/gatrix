/**
 * AI Tools — Game Worlds
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const gameWorldTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_game_worlds',
      description:
        'Get list of game worlds and their current status for an environment.',
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
    riskLevel: 'read',
    handler: async (args) => {
      const { GameWorldService } = await import('../../game-world-service');
      return await GameWorldService.getAllGameWorlds({
        environmentId: args.environmentId,
      });
    },
  },

  {
    tool: {
      name: 'create_game_world',
      description: descWithRisk(
        'Create a new game world entry. Requires worldId (unique identifier), name, and worldServerAddress.',
        'low'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          worldId: {
            type: 'string',
            description: 'Unique world identifier',
          },
          name: {
            type: 'string',
            description: 'Display name for the game world',
          },
          worldServerAddress: {
            type: 'string',
            description:
              'Server address in URL or host:port format (e.g., https://world.example.com or 192.168.1.100:8080)',
          },
          description: {
            type: 'string',
            description: 'Optional description of the game world',
          },
          isVisible: {
            type: 'boolean',
            description:
              'Whether the world is visible to players. Defaults to true.',
          },
        },
        required: ['environmentId', 'worldId', 'name', 'worldServerAddress'],
      },
    },
    requiredPermission: P.GAME_WORLDS_CREATE,
    riskLevel: 'low',
    handler: async (args, _orgId, userId) => {
      const { GameWorldService } = await import('../../game-world-service');
      return await GameWorldService.createGameWorld(
        {
          worldId: args.worldId,
          name: args.name,
          worldServerAddress: args.worldServerAddress,
          description: args.description,
          isVisible: args.isVisible ?? true,
          createdBy: userId,
        },
        args.environmentId
      );
    },
  },

  {
    tool: {
      name: 'update_game_world',
      description: descWithRisk(
        'Update an existing game world. Can change name, description, server address, etc.',
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
            description: 'The game world record ID',
          },
          name: {
            type: 'string',
            description: 'New display name',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          worldServerAddress: {
            type: 'string',
            description: 'New server address',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.GAME_WORLDS_UPDATE,
    riskLevel: 'medium',
    handler: async (args) => {
      const { GameWorldService } = await import('../../game-world-service');
      const { environmentId, id, ...updates } = args;
      return await GameWorldService.updateGameWorld(id, updates, environmentId);
    },
  },

  {
    tool: {
      name: 'toggle_game_world_visibility',
      description: descWithRisk(
        'Toggle game world visibility on/off. When invisible, the world is hidden from players.',
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
            description: 'The game world record ID to toggle',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.GAME_WORLDS_UPDATE,
    riskLevel: 'medium',
    handler: async (args) => {
      const { GameWorldService } = await import('../../game-world-service');
      return await GameWorldService.toggleVisibility(
        args.id,
        args.environmentId
      );
    },
  },

  {
    tool: {
      name: 'toggle_game_world_maintenance',
      description: descWithRisk(
        'Toggle maintenance mode for a specific game world. Players will be blocked from entering when enabled.',
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
            description: 'The game world record ID',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.GAME_WORLDS_UPDATE,
    riskLevel: 'high',
    handler: async (args) => {
      const { GameWorldService } = await import('../../game-world-service');
      return await GameWorldService.toggleMaintenance(
        args.id,
        args.environmentId
      );
    },
  },
];
