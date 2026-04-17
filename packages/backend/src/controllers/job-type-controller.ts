import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { JobTypeModel } from '../models/job-type';

import { createLogger } from '../config/logger';
const logger = createLogger('jobTypeController');

// Job Type Get list
export const getJobTypes = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enabled } = req.query;
    const environmentId = req.environmentId!;

    let jobTypes;
    if (enabled === 'true') {
      jobTypes = await JobTypeModel.findEnabled(environmentId);
    } else {
      jobTypes = await JobTypeModel.findAll(environmentId);
    }

    res.json({
      success: true,
      data: jobTypes,
    });
  } catch (error) {
    logger.error('Error getting job types:', error);

    // Return hardcoded data on error
    const fallbackJobTypes = [
      {
        id: 1,
        name: 'mailsend',
        displayName: 'jobTypes.mailsend.displayName',
        description: 'jobTypes.mailsend.description',
        isEnabled: true,
        jobSchema: {
          to: {
            type: 'string',
            label: 'jobTypes.mailsend.fields.to.label',
            required: true,
            description: 'jobTypes.mailsend.fields.to.description',
          },
          subject: {
            type: 'string',
            label: 'jobTypes.mailsend.fields.subject.label',
            required: true,
          },
          body: {
            type: 'text',
            label: 'jobTypes.mailsend.fields.body.label',
            required: true,
          },
        },
      },
      {
        id: 2,
        name: 'http_request',
        displayName: 'jobTypes.httpRequest.displayName',
        description: 'jobTypes.httpRequest.description',
        isEnabled: true,
        jobSchema: {
          url: {
            type: 'string',
            label: 'URL',
            required: true,
            description: 'jobTypes.httpRequest.fields.url.description',
          },
          method: {
            type: 'select',
            label: 'jobTypes.httpRequest.fields.method.label',
            required: true,
            options: ['GET', 'POST', 'PUT', 'DELETE'],
            default: 'GET',
          },
          headers: {
            type: 'object',
            label: 'jobTypes.httpRequest.fields.headers.label',
            description: 'jobTypes.httpRequest.fields.headers.description',
          },
          body: {
            type: 'text',
            label: 'jobTypes.httpRequest.fields.body.label',
            description: 'jobTypes.httpRequest.fields.body.description',
          },
        },
      },
      {
        id: 3,
        name: 'ssh_command',
        displayName: 'jobTypes.sshCommand.displayName',
        description: 'jobTypes.sshCommand.description',
        isEnabled: true,
        jobSchema: {
          host: {
            type: 'string',
            label: 'jobTypes.sshCommand.fields.host.label',
            required: true,
            description: 'jobTypes.sshCommand.fields.host.description',
          },
          port: {
            type: 'number',
            label: 'jobTypes.sshCommand.fields.port.label',
            default: 22,
          },
          username: {
            type: 'string',
            label: 'jobTypes.sshCommand.fields.username.label',
            required: true,
          },
          password: {
            type: 'string',
            label: 'jobTypes.sshCommand.fields.password.label',
            required: true,
            description: 'jobTypes.sshCommand.fields.password.description',
          },
          command: {
            type: 'text',
            label: 'jobTypes.sshCommand.fields.command.label',
            required: true,
            description: 'jobTypes.sshCommand.fields.command.description',
          },
        },
      },
      {
        id: 4,
        name: 'log_message',
        displayName: 'jobTypes.logMessage.displayName',
        description: 'jobTypes.logMessage.description',
        isEnabled: true,
        jobSchema: {
          message: {
            type: 'text',
            label: 'jobTypes.logMessage.fields.message.label',
            required: true,
            description: 'jobTypes.logMessage.fields.message.description',
          },
          level: {
            type: 'select',
            label: 'jobTypes.logMessage.fields.level.label',
            required: true,
            options: ['debug', 'info', 'warn', 'error'],
            default: 'info',
            description: 'jobTypes.logMessage.fields.level.description',
          },
          category: {
            type: 'string',
            label: 'jobTypes.logMessage.fields.category.label',
            required: false,
            default: 'job',
            description: 'jobTypes.logMessage.fields.category.description',
          },
          metadata: {
            type: 'object',
            label: 'jobTypes.logMessage.fields.metadata.label',
            required: false,
            description: 'jobTypes.logMessage.fields.metadata.description',
          },
        },
      },
    ];

    res.json({
      success: true,
      data: fallbackJobTypes,
    });
  }
};

// Job Type Get details
export const getJobType = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const environmentId = req.environmentId!;
    const jobType = await JobTypeModel.findById(id, environmentId);

    if (!jobType) {
      return res.status(404).json({
        success: false,
        message: 'Job type not found',
      });
    }

    res.json({
      success: true,
      data: jobType,
    });
  } catch (error) {
    logger.error('Error getting job type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get job type',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
