/**
 * AI Tools — Reward Templates
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig } from '../ai-tool-types';

export const rewardTemplateTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_reward_templates',
      description:
        'Get list of reward templates for an environment. Reward templates define reusable reward configurations.',
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
    requiredPermission: P.REWARD_TEMPLATES_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const RewardTemplateService = (
        await import('../../reward-template-service')
      ).default;
      return await RewardTemplateService.getRewardTemplates({
        environmentId: args.environmentId,
        page: 1,
        limit: 20,
      });
    },
  },

  {
    tool: {
      name: 'get_reward_template_by_id',
      description:
        'Get detailed information about a specific reward template.',
      parameters: {
        type: 'object',
        properties: {
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
          id: {
            type: 'string',
            description: 'The reward template ID',
          },
        },
        required: ['environmentId', 'id'],
      },
    },
    requiredPermission: P.REWARD_TEMPLATES_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const RewardTemplateService = (
        await import('../../reward-template-service')
      ).default;
      return await RewardTemplateService.getRewardTemplateById(
        args.id,
        args.environmentId
      );
    },
  },
];
