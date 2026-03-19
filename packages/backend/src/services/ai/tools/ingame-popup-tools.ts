/**
 * AI Tools — Ingame Popup Notices
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig, descWithRisk } from '../ai-tool-types';

export const ingamePopupTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_ingame_popups',
      description:
        'Get list of in-game popup notices for an environment.',
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
    requiredPermission: P.INGAME_POPUPS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const service = (await import('../../ingame-popup-notice-service'))
        .default;
      return await service.getIngamePopupNotices(1, 20, {
        environmentId: args.environmentId,
      });
    },
  },

  {
    tool: {
      name: 'toggle_ingame_popup',
      description: descWithRisk(
        'Toggle an in-game popup notice active/inactive.',
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
            description: 'The popup notice ID',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.INGAME_POPUPS_UPDATE,
    riskLevel: 'medium',
    handler: async (args) => {
      const service = (await import('../../ingame-popup-notice-service'))
        .default;
      return await service.toggleActive(args.id, args.environmentId);
    },
  },
];
