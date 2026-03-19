/**
 * AI Tools — Surveys
 */

import { P } from '@gatrix/shared/permissions';
import { AIToolConfig } from '../ai-tool-types';

export const surveyTools: AIToolConfig[] = [
  {
    tool: {
      name: 'get_surveys',
      description:
        'Get list of surveys for an environment. Returns survey names, status, and configuration.',
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
    requiredPermission: P.SURVEYS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { SurveyService } = await import('../../survey-service');
      return await SurveyService.getSurveys({
        environmentId: args.environmentId,
        page: 1,
        limit: 20,
      });
    },
  },

  {
    tool: {
      name: 'get_survey_by_id',
      description: 'Get detailed information about a specific survey by ID.',
      parameters: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The survey ID',
          },
          environmentId: {
            type: 'string',
            description: 'The environment ID',
          },
        },
        required: ['id', 'environmentId'],
      },
    },
    requiredPermission: P.SURVEYS_READ,
    riskLevel: 'read',
    handler: async (args) => {
      const { SurveyService } = await import('../../survey-service');
      return await SurveyService.getSurveyById(args.id, args.environmentId);
    },
  },
];
