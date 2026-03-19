/**
 * AI Tools — Maintenance
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const maintenanceTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_maintenance_status',
      description:
        'Get current global maintenance status for an environment, including schedule details.',
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
    riskLevel: 'read',
    handler: async (args) => {
      const VarsModel = (await import('../../../models/vars')).default;
      const is = await VarsModel.get('isMaintenance', args.environmentId);
      const detailRaw = await VarsModel.get(
        'maintenanceDetail',
        args.environmentId
      );
      const detail = detailRaw ? JSON.parse(detailRaw) : null;
      const hasMaintenanceScheduled = is === 'true';

      let isMaintenanceActive = false;
      if (hasMaintenanceScheduled && detail) {
        const now = new Date();
        const startsAt = detail.startsAt ? new Date(detail.startsAt) : null;
        const endsAt = detail.endsAt ? new Date(detail.endsAt) : null;
        const hasStarted = !startsAt || now >= startsAt;
        const hasNotEnded = !endsAt || now < endsAt;
        isMaintenanceActive = hasStarted && hasNotEnded;
      }

      return {
        hasMaintenanceScheduled,
        isMaintenanceActive,
        ...(hasMaintenanceScheduled && detail ? { detail } : {}),
      };
    },
  },

  {
    tool: {
      name: 'set_maintenance_status',
      description: descWithRisk(
        'Enable or disable global maintenance mode for an environment. When enabled, all players will be blocked. Requires a maintenance message.',
        'high'
      ),
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          isMaintenance: {
            type: 'boolean',
            description: 'true to enable maintenance, false to disable',
          },
          message: {
            type: 'string',
            description:
              'Maintenance message to show to players (required when enabling)',
          },
          type: {
            type: 'string',
            description:
              'Maintenance type: "regular" or "emergency". Defaults to "regular".',
          },
          startsAt: {
            type: 'string',
            description:
              'Optional start time in ISO 8601 format. If omitted, starts immediately.',
          },
          endsAt: {
            type: 'string',
            description: 'Optional end time in ISO 8601 format.',
          },
        },
        required: ['environmentId', 'isMaintenance'],
      },
    },
    requiredPermission: P.MAINTENANCE_UPDATE,
    riskLevel: 'high',
    handler: async (args, _orgId, userId) => {
      const VarsModel = (await import('../../../models/vars')).default;
      const { pubSubService } = await import('../../pub-sub-service');
      const { SERVER_SDK_ETAG } = await import('../../../constants/cache-keys');

      const environmentId = args.environmentId;

      // Validate: message required when enabling
      if (args.isMaintenance && (!args.message || !args.message.trim())) {
        return {
          error: 'Maintenance message is required to start maintenance.',
        };
      }

      await VarsModel.set(
        'isMaintenance',
        args.isMaintenance ? 'true' : 'false',
        userId,
        environmentId
      );

      const detail = {
        type: args.type || 'regular',
        startsAt: args.startsAt || null,
        endsAt: args.endsAt || null,
        message: args.message || '',
      };

      await VarsModel.set(
        'maintenanceDetail',
        JSON.stringify(detail),
        userId,
        environmentId
      );

      await pubSubService.invalidateKey(
        `${SERVER_SDK_ETAG.MAINTENANCE}:${environmentId}`
      );

      await pubSubService.publishEvent(
        {
          type: 'maintenance.settings.updated',
          data: { id: 'maintenance', environmentId },
        },
        { environmentId }
      );

      await pubSubService.publishNotification({
        type: 'maintenance_status_change',
        data: {
          isUnderMaintenance: args.isMaintenance,
          ...(args.isMaintenance && detail ? { detail } : {}),
        },
        targetChannels: ['admin', 'general'],
      });

      return {
        success: true,
        isUnderMaintenance: args.isMaintenance,
        ...(args.isMaintenance ? { detail } : {}),
      };
    },
  },
];
