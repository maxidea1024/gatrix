/**
 * AI Tools — Client Versions
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const clientVersionTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_client_versions',
      description:
        'Get list of client versions for a project. Shows version info, platform, status, and update requirements.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID',
          },
        },
        required: ['projectId'],
      },
    },
    requiredPermission: P.CLIENT_VERSIONS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { ClientVersionService } =
        await import('../../client-version-service');
      return await ClientVersionService.getAllClientVersions(
        args.projectId,
        {},
        { page: 1, limit: 20 }
      );
    },
  },

  {
    tool: {
      name: 'create_client_version',
      description: descWithRisk(
        'Register a new client version. Specify platform, version string, and whether update is required.',
        'low'
      ),
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID',
          },
          platform: {
            type: 'string',
            description: 'Platform name (e.g., "pc", "ios", "android")',
          },
          version: {
            type: 'string',
            description: 'Version string (e.g., "1.0.0")',
          },
          status: {
            type: 'string',
            description:
              'Status: "active", "deprecated", or "blocked". Defaults to "active".',
          },
          forceUpdate: {
            type: 'boolean',
            description:
              'Whether to force update for this version. Defaults to false.',
          },
          releaseNotes: {
            type: 'string',
            description: 'Optional release notes',
          },
        },
        required: ['projectId', 'platform', 'version'],
      },
    },
    requiredPermission: P.CLIENT_VERSIONS_CREATE,
    riskLevel: 'low',
    handler: async (args) => {
      const { ClientVersionService } =
        await import('../../client-version-service');
      return await ClientVersionService.createClientVersion(
        {
          projectId: args.projectId,
          platform: args.platform,
          clientVersion: args.version,
          clientStatus: args.status || 'online',
        },
        args.projectId
      );
    },
  },

  {
    tool: {
      name: 'update_client_version',
      description: descWithRisk(
        'Update a client version. Can change status, force update flag, release notes.',
        'medium'
      ),
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID',
          },
          id: {
            type: 'string',
            description: 'The client version record ID',
          },
          status: {
            type: 'string',
            description: 'New status: "active", "deprecated", or "blocked"',
          },
          forceUpdate: {
            type: 'boolean',
            description: 'Whether to force update',
          },
          releaseNotes: {
            type: 'string',
            description: 'Updated release notes',
          },
        },
        required: ['projectId', 'id'],
      },
    },
    requiredPermission: P.CLIENT_VERSIONS_UPDATE,
    riskLevel: 'medium',
    handler: async (args) => {
      const { ClientVersionService } =
        await import('../../client-version-service');
      const { projectId, id, ...updates } = args;
      return await ClientVersionService.updateClientVersion(
        id,
        updates,
        projectId
      );
    },
  },
];
