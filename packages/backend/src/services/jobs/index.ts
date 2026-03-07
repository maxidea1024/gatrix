import { JobFactory } from './job-factory';
import { MailSendJob } from './mail-send-job';
import { HttpRequestJob } from './http-request-job';
import { SshCommandJob } from './ssh-command-job';
import { LogMessageJob } from './log-message-job';
import { createLogger } from '../../config/logger';

const logger = createLogger('index');

// Register job types with Factory
export function initializeJobTypes(): void {
  try {
    JobFactory.registerJobType('mailsend', MailSendJob);
    JobFactory.registerJobType('http_request', HttpRequestJob);
    JobFactory.registerJobType('ssh_command', SshCommandJob);
    JobFactory.registerJobType('log_message', LogMessageJob);

    logger.info('Job types initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job types:', error);
    throw error;
  }
}

export * from './job-factory';
export * from './mail-send-job';
export * from './http-request-job';
export * from './ssh-command-job';
export * from './log-message-job';
