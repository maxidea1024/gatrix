/**
 * AI Tools — Segments
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const segmentTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_segments',
      description:
        'Get list of segments (user groups defined by constraints) for a project.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to list segments from',
          },
          search: {
            type: 'string',
            description: 'Optional search term to filter segments',
          },
        },
        required: ['projectId'],
      },
    },
    requiredPermission: P.SEGMENTS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      return await featureFlagService.listSegments(
        args.search || undefined,
        args.projectId
      );
    },
  },

  {
    tool: {
      name: 'create_segment',
      description: descWithRisk(
        'Create a new segment with a name and constraints. Segments define user groups for feature flag targeting.',
        'low'
      ),
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID',
          },
          segmentName: {
            type: 'string',
            description: 'Unique segment identifier name',
          },
          displayName: {
            type: 'string',
            description: 'Human-readable display name',
          },
          description: {
            type: 'string',
            description: 'Optional description',
          },
        },
        required: ['projectId', 'segmentName'],
      },
    },
    requiredPermission: P.SEGMENTS_CREATE,
    riskLevel: 'low',
    handler: async (args, _orgId, userId) => {
      const { featureFlagService } = await import('../../feature-flag-service');
      return await featureFlagService.createSegment(
        {
          segmentName: args.segmentName,
          displayName: args.displayName,
          description: args.description,
          constraints: [],
          projectId: args.projectId,
        },
        userId
      );
    },
  },
];
