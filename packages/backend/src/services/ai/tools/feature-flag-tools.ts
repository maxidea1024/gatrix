/**
 * AI Tools — Feature Flags
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const featureFlagTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_feature_flags',
      description:
        'Get list of feature flags for a project environment. Returns flag names, types, enabled status, and descriptions.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description:
              'The environment ID to query feature flags from (required)',
          },
          search: {
            type: 'string',
            description: 'Optional search term to filter flags by name',
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to scope the query',
          },
        },
        required: ['environmentId'],
      },
    },
    requiredPermission: P.FEATURES_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      return await featureFlagService.listFlags({
        environmentId: args.environmentId,
        search: args.search,
        projectId: args.projectId,
        limit: 20,
      });
    },
  },

  {
    tool: {
      name: 'get_feature_flag',
      description:
        'Get detailed information about a single feature flag by name, including strategies and variants.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          flagName: {
            type: 'string',
            description: 'The feature flag name to look up',
          },
        },
        required: ['environmentId', 'flagName'],
      },
    },
    requiredPermission: P.FEATURES_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      const flag = await featureFlagService.getFlag(
        args.environmentId,
        args.flagName
      );
      if (!flag) {
        return { error: `Flag '${args.flagName}' not found` };
      }
      return flag;
    },
  },

  {
    tool: {
      name: 'create_feature_flag',
      description: descWithRisk(
        'Create a new feature flag. Requires flag name, value type (boolean/string/number/json), enabled and disabled values.',
        'low'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID to create the flag in',
          },
          name: {
            type: 'string',
            description:
              'Flag name (kebab-case recommended, e.g. "my-feature-flag")',
          },
          valueType: {
            type: 'string',
            description:
              'Value type: "boolean", "string", "number", or "json"',
          },
          enabledValue: {
            description:
              'The value returned when the flag is enabled (must match valueType)',
          },
          disabledValue: {
            description:
              'The value returned when the flag is disabled (must match valueType)',
          },
          description: {
            type: 'string',
            description: 'Optional description of the flag',
          },
          flagType: {
            type: 'string',
            description:
              'Flag type: "release", "experiment", "operational", "killSwitch", or "remoteConfig". Defaults to "release".',
          },
          isEnabled: {
            type: 'boolean',
            description:
              'Whether the flag starts enabled. Defaults to false.',
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to scope the flag',
          },
        },
        required: [
          'environmentId',
          'name',
          'valueType',
          'enabledValue',
          'disabledValue',
        ],
      },
    },
    requiredPermission: P.FEATURES_CREATE,
    riskLevel: 'low',
    handler: async (args, _orgId, userId) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      return await featureFlagService.createFlag(
        {
          name: args.name,
          valueType: args.valueType,
          enabledValue: args.enabledValue,
          disabledValue: args.disabledValue,
          description: args.description,
          flagType: args.flagType || 'release',
          isEnabled: args.isEnabled ?? false,
          environmentId: args.environmentId,
          projectId: args.projectId,
        },
        userId
      );
    },
  },

  {
    tool: {
      name: 'update_feature_flag',
      description: descWithRisk(
        'Update an existing feature flag. Can change description, enabled/disabled values, stale status, etc.',
        'medium'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          flagName: {
            type: 'string',
            description: 'The feature flag name to update',
          },
          description: {
            type: 'string',
            description: 'New description',
          },
          enabledValue: {
            description: 'New enabled value',
          },
          disabledValue: {
            description: 'New disabled value',
          },
          stale: {
            type: 'boolean',
            description: 'Mark flag as stale or not',
          },
        },
        required: ['environmentId', 'flagName'],
      },
    },
    requiredPermission: P.FEATURES_UPDATE,
    riskLevel: 'medium',
    handler: async (args, _orgId, userId) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      const { environmentId, flagName, ...updates } = args;
      return await featureFlagService.updateFlag(
        environmentId,
        flagName,
        updates,
        userId
      );
    },
  },

  {
    tool: {
      name: 'toggle_feature_flag',
      description: descWithRisk(
        'Toggle a feature flag on or off. This immediately changes the flag state for all SDK clients.',
        'medium'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          flagName: {
            type: 'string',
            description: 'The feature flag name to toggle',
          },
          isEnabled: {
            type: 'boolean',
            description: 'Set to true to enable, false to disable',
          },
        },
        required: ['environmentId', 'flagName', 'isEnabled'],
      },
    },
    requiredPermission: P.FEATURES_UPDATE,
    riskLevel: 'medium',
    handler: async (args, _orgId, userId) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      return await featureFlagService.toggleFlag(
        args.environmentId,
        args.flagName,
        args.isEnabled,
        userId
      );
    },
  },

  {
    tool: {
      name: 'archive_feature_flag',
      description: descWithRisk(
        'Archive a feature flag. This disables it and hides it from the active list. Can be revived later.',
        'medium'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          flagName: {
            type: 'string',
            description: 'The feature flag name to archive',
          },
        },
        required: ['environmentId', 'flagName'],
      },
    },
    requiredPermission: P.FEATURES_DELETE,
    riskLevel: 'medium',
    handler: async (args, _orgId, userId) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      return await featureFlagService.archiveFlag(
        args.environmentId,
        args.flagName,
        userId
      );
    },
  },
];
